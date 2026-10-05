/* Smart Energy – Cloud Functions.
   All writes go through here (Firestore rules deny client writes), so the
   audit log cannot be bypassed and TOTP secrets never reach the browser. */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const crypto = require('crypto');
const totp = require('./totp');

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
const { FieldValue: FV } = require('firebase-admin/firestore');
setGlobalOptions({ region: process.env.FUNCTIONS_REGION || 'europe-west1', maxInstances: 10 });

const MAX_KWH = 300;
const ACTIVATION_DAYS = 7;
const err = (code, msg, details) => new HttpsError(code, msg, details);

// ---------------------------------------------------------------- helpers
const DEFAULT_SETTINGS = {
  currency: 'دينار', timezone: 'Asia/Amman', nearTierKwh: 100,
  tiers: [{ kwh: 1000, pct: 20 }, { kwh: 1200, pct: 21 }, { kwh: 1400, pct: 22 }, { kwh: 1600, pct: 24 }, { kwh: 2000, pct: 29 }],
  prices: [{ from: '06:00', to: '17:00', price: 0.19 }, { from: '17:00', to: '06:00', price: 0.25 }],
};
async function getSettings(tx) {
  const ref = db.doc('settings/main');
  const s = tx ? await tx.get(ref) : await ref.get();
  return { ...DEFAULT_SETTINGS, ...(s.exists ? s.data() : {}) };
}
const round3 = (n) => Math.round(n * 1000) / 1000;
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '').replace(/^00/, '');
  if (d.startsWith('962') && d.length === 12) d = '0' + d.slice(3);
  if (d.length === 9 && d.startsWith('7')) d = '0' + d; // 7XXXXXXXX -> 07XXXXXXXX
  return d;
}
const validPhone = (p) => /^\d{8,15}$/.test(p);
const cleanStr = (v, max = 80) => String(v ?? '').trim().slice(0, max);

let pepper;
async function hmac(code) {
  if (!pepper) {
    const ref = db.doc('secrets/_pepper');
    await db.runTransaction(async (tx) => {
      const s = await tx.get(ref);
      if (s.exists) pepper = s.data().v; else { pepper = crypto.randomBytes(32).toString('hex'); tx.set(ref, { v: pepper }); }
    });
  }
  return crypto.createHmac('sha256', pepper).update(String(code)).digest('hex');
}
const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function clientIp(req) {
  const h = req.rawRequest && req.rawRequest.headers;
  return String((h && h['x-forwarded-for'] || (req.rawRequest && req.rawRequest.ip) || 'x').split(',')[0]).trim();
}

// brute-force protection: N failures => 15 min lock
async function lockCheck(key) {
  const s = await db.doc('rl/' + key).get();
  if (s.exists && s.data().until > Date.now()) throw err('resource-exhausted', 'locked');
}
async function lockFail(key, max = 5) {
  const ref = db.doc('rl/' + key);
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref), d = s.exists ? s.data() : { n: 0, until: 0 };
    const n = d.until && d.until < Date.now() ? 1 : (d.n || 0) + 1;
    tx.set(ref, { n, until: n >= max ? Date.now() + 15 * 60000 : 0 });
  });
}
const lockClear = (key) => db.doc('rl/' + key).delete().catch(() => {});

// time zone aware month / minute-of-day
function localParts(ts, tz) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { month: `${p.year}-${p.month}`, minutes: +p.hour * 60 + +p.minute };
}
const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const inRange = (t, a, b) => (a === b ? true : a < b ? t >= a && t < b : t >= a || t < b);
function priceAt(settings, ts) {
  const { minutes } = localParts(ts, settings.timezone);
  for (const p of settings.prices) if (inRange(minutes, toMin(p.from), toMin(p.to))) return Number(p.price);
  return Number(settings.prices[0].price);
}
function pricesCoverDay(prices) {
  const c = new Array(1440).fill(0);
  for (const p of prices) { const a = toMin(p.from), b = toMin(p.to); for (let i = 0; i < 1440; i++) if (inRange(i, a, b)) c[i]++; }
  return c.every((x) => x === 1);
}
function tierInfo(tiersIn, kwh) {
  const tiers = [...tiersIn].sort((a, b) => a.kwh - b.kwh);
  let idx = 0; tiers.forEach((t, i) => { if (kwh >= t.kwh) idx = i; });
  return { pct: tiers[idx].pct, idx, next: tiers[idx + 1] || null };
}
const groupTiers = (group, settings) => (group.tiers && group.tiers.length ? group.tiers : settings.tiers);
const statsId = (g, m) => `${g}_${m}`;

function validateTiers(t) {
  if (!Array.isArray(t) || !t.length || t.length > 12) throw err('invalid-argument', 'bad_tiers');
  const out = t.map((x) => ({ kwh: Number(x.kwh), pct: Number(x.pct) }));
  if (out.some((x) => !(x.kwh >= 0) || !(x.pct >= 0 && x.pct <= 100))) throw err('invalid-argument', 'bad_tiers');
  return out.sort((a, b) => a.kwh - b.kwh);
}

function audit(tx, actor, action, target, details = {}) {
  tx.set(db.collection('audit').doc(), { ts: FV.serverTimestamp(), actorRole: actor.role, actorId: actor.id, actorName: actor.name, action, target, details });
}
function notify(tx, groupId, type, params, { forCaptains }, outbox) {
  if (outbox) outbox.push({ groupId, type, params, forCaptains: !!forCaptains });
  tx.set(db.collection('notifications').doc(), { groupId, type, params, forManager: true, forCaptains: !!forCaptains, ts: FV.serverTimestamp(), tsMs: Date.now() });
}
async function deleteQuery(q) {
  for (;;) {
    const s = await q.limit(400).get();
    if (s.empty) return 0;
    const b = db.batch(); s.docs.forEach((d) => b.delete(d.ref)); await b.commit();
  }
}
const randDigits = (n) => String(crypto.randomInt(0, 10 ** n)).padStart(n, '0');
async function newActivation() {
  const code = randDigits(8);
  return { code, data: { hash: await hmac(code), exp: Date.now() + ACTIVATION_DAYS * 86400000, tries: 0 } };
}
async function newStaffCode() {
  for (let i = 0; i < 20; i++) {
    const code = randDigits(6), h = await hmac(code);
    const dup = await db.collection('secrets').where('type', '==', 'staff').where('codeHash', '==', h).limit(1).get();
    if (dup.empty) return { code, hash: h };
  }
  throw err('internal', 'code_gen_failed');
}

// ------------------------------------------------------------------ push (FCM)
const PUSH_TEXT = {
  ar: {
    near: ['اقتراب من الشريحة التالية', (p) => `باقي ${p.remaining} ك.و للوصول إلى ${p.pct}%`],
    reached: ['شريحة جديدة', (p) => `وصلت مجموعتكم إلى شريحة استرداد ${p.pct}% 🎉`],
    payout: ['تم إيداع الاسترداد النقدي', (p) => `تم إيداع الاسترداد النقدي لشهر ${p.month} بقيمة ${p.amount} ${p.currency} لمدير المجموعة` + (p.note ? `\nملاحظة: ${p.note}` : '')],
    payout_undo: ['تحديث على الاسترداد', (p) => `تم إلغاء تأكيد إيداع الاسترداد لشهر ${p.month}`],
  },
  en: {
    near: ['Close to the next tier', (p) => `${p.remaining} kWh left to reach ${p.pct}%`],
    reached: ['New tier', (p) => `Your group reached the ${p.pct}% cashback tier 🎉`],
    payout: ['Cashback deposited', (p) => `Cashback for ${p.month} (${p.amount} ${p.currency}) has been deposited to the group manager` + (p.note ? `\nNote: ${p.note}` : '')],
    payout_undo: ['Cashback update', (p) => `Deposit confirmation for ${p.month} was cancelled`],
  },
};
function pushText(n, lang) {
  const d = (PUSH_TEXT[lang] || PUSH_TEXT.ar)[n.type];
  return d ? { title: d[0], body: d[1](n.params || {}) } : null;
}
/** Sends each notification to the registered devices of its audience. Never throws (push is best effort). */
async function pushAll(outbox) {
  for (const n of outbox) {
    try {
      let q = db.collection('fcmTokens').where('groupId', '==', n.groupId);
      if (!n.forCaptains) q = q.where('isManager', '==', true);
      const docs = (await q.get()).docs;
      for (const lang of ['ar', 'en']) {
        const mine = docs.filter((d) => (d.data().lang === 'en' ? 'en' : 'ar') === lang), text = pushText(n, lang);
        if (!mine.length || !text) continue;
        for (let i = 0; i < mine.length; i += 500) {
          const chunk = mine.slice(i, i + 500);
          const res = await admin.messaging().sendEachForMulticast({
            tokens: chunk.map((d) => d.data().token),
            data: { title: text.title, body: text.body, url: './#/notifications', tag: n.type },
            webpush: { headers: { Urgency: 'high', TTL: '86400' } },
          });
          const dead = [];
          res.responses.forEach((r, k) => { if (!r.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(r.error && r.error.code)) dead.push(chunk[k].ref.delete()); });
          await Promise.all(dead);
        }
      }
    } catch (e) { console.warn('push failed', e.message); }
  }
}

exports.registerPush = onCall(async (req) => {
  const c = req.auth && req.auth.token;
  if (!c || c.role !== 'captain') throw err('unauthenticated', 'login_required');
  const token = cleanStr(req.data && req.data.token, 4096);
  if (token.length < 20) throw err('invalid-argument', 'bad_input');
  await db.doc('fcmTokens/' + sha(token)).set({ token, captainId: c.captainId, groupId: c.groupId, isManager: !!c.isManager, lang: req.data.lang === 'en' ? 'en' : 'ar', ts: FV.serverTimestamp() });
  return { ok: true };
});
exports.unregisterPush = onCall(async (req) => {
  const c = req.auth && req.auth.token, token = cleanStr(req.data && req.data.token, 4096);
  if (!c || !token) return { ok: true };
  const ref = db.doc('fcmTokens/' + sha(token)), s = await ref.get();
  if (s.exists && s.data().captainId === c.captainId) await ref.delete();
  return { ok: true };
});

// ------------------------------------------------------- public: logins
exports.staffLogin = onCall(async (req) => {
  const code = cleanStr(req.data && req.data.code, 6);
  const key = 'ip_' + sha(clientIp(req));
  await lockCheck(key);
  if (!/^\d{6}$/.test(code)) { await lockFail(key, 10); throw err('permission-denied', 'bad_credentials'); }
  const h = await hmac(code);
  const q = await db.collection('secrets').where('type', '==', 'staff').where('codeHash', '==', h).limit(1).get();
  const st = q.empty ? null : await db.doc('staff/' + q.docs[0].data().staffId).get();
  if (!st || !st.exists || !st.data().active) { await lockFail(key, 10); throw err('permission-denied', 'bad_credentials'); }
  await lockClear(key);
  const token = await auth.createCustomToken('staff:' + st.id, { role: 'staff', staffId: st.id, name: st.data().name });
  return { token };
});

async function checkActivation(phone, activation, ipKey) {
  const capKey = 'cap_' + phone;
  await lockCheck(capKey); await lockCheck(ipKey);
  const ref = db.doc('secrets/cap_' + phone), s = await ref.get();
  const a = s.exists && s.data().activation;
  const ok = a && a.exp > Date.now() && /^\d{8}$/.test(activation) && safeEq(a.hash, await hmac(activation));
  if (!ok) { await lockFail(capKey); await lockFail(ipKey, 20); throw err('permission-denied', 'bad_activation'); }
  return { ref, data: s.data() };
}
const capToken = async (cap) => auth.createCustomToken('cap:' + cap.phone, { role: 'captain', captainId: cap.phone, groupId: cap.groupId, isManager: !!cap.isManager });

exports.captainEnrollStart = onCall(async (req) => {
  const phone = normPhone(req.data && req.data.phone), act = cleanStr(req.data && req.data.activation, 8);
  const { ref } = await checkActivation(phone, act, 'ip_' + sha(clientIp(req)));
  const secret = totp.newSecret();
  await ref.update({ pending: secret });
  return { secret, uri: totp.otpauth(phone, secret) };
});

exports.captainEnrollFinish = onCall(async (req) => {
  const phone = normPhone(req.data && req.data.phone), act = cleanStr(req.data && req.data.activation, 8), code = cleanStr(req.data && req.data.code, 6);
  const ipKey = 'ip_' + sha(clientIp(req));
  const { ref, data } = await checkActivation(phone, act, ipKey);
  const step = data.pending ? totp.verify(data.pending, code, 0) : null;
  if (!step) { await lockFail('cap_' + phone); throw err('permission-denied', 'bad_code'); }
  const capRef = db.doc('captains/' + phone);
  const cap = (await capRef.get()).data();
  await db.runTransaction(async (tx) => {
    tx.update(ref, { totp: { secret: data.pending, lastStep: step }, activation: FV.delete(), pending: FV.delete() });
    tx.update(capRef, { enrolled: true });
    audit(tx, { role: 'captain', id: phone, name: cap.name }, 'captainEnrolled', { phone, groupId: cap.groupId });
  });
  await lockClear('cap_' + phone);
  return { token: await capToken(cap) };
});

exports.captainLogin = onCall(async (req) => {
  const phone = normPhone(req.data && req.data.phone), code = cleanStr(req.data && req.data.code, 6);
  const capKey = 'cap_' + phone, ipKey = 'ip_' + sha(clientIp(req));
  await lockCheck(capKey); await lockCheck(ipKey);
  const [sref, cref] = [db.doc('secrets/cap_' + phone), db.doc('captains/' + phone)];
  const [s, c] = await Promise.all([sref.get(), cref.get()]);
  const t = s.exists && s.data().totp;
  const step = t ? totp.verify(t.secret, code, t.lastStep) : null;
  if (!c.exists || !step) { await lockFail(capKey); await lockFail(ipKey, 20); throw err('permission-denied', 'bad_credentials'); }
  await sref.update({ 'totp.lastStep': step }); // one-time use per step
  await lockClear(capKey);
  return { token: await capToken(c.data()) };
});

exports.adminClaim = onCall(async (req) => {
  const email = req.auth && req.auth.token.email;
  const allowed = String(process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
  if (!email || !allowed.includes(email.toLowerCase())) throw err('permission-denied', 'not_admin');
  await auth.setCustomUserClaims(req.auth.uid, { role: 'admin' });
  return { ok: true };
});

// ------------------------------------------------------------- main API
const ACTIONS = {};
const A = (name, roles, fn) => { ACTIONS[name] = { roles, fn }; };

async function actorOf(req, role) {
  if (role === 'admin') return { role, id: req.auth.uid, name: req.auth.token.email || 'admin' };
  const st = await db.doc('staff/' + req.auth.token.staffId).get();
  if (!st.exists || !st.data().active) throw err('permission-denied', 'staff_disabled');
  return { role, id: st.id, name: st.data().name };
}

exports.api = onCall(async (req) => {
  const role = req.auth && req.auth.token.role;
  if (role !== 'admin' && role !== 'staff') throw err('unauthenticated', 'login_required');
  const { action, data } = req.data || {};
  const h = ACTIONS[action];
  if (!h || !h.roles.includes(role)) throw err('permission-denied', 'forbidden');
  return h.fn(data || {}, await actorOf(req, role));
});

// ----- groups
A('createGroup', ['admin'], async (d, actor) => {
  const name = cleanStr(d.name), managerName = cleanStr(d.managerName), phone = normPhone(d.managerPhone);
  const logo = typeof d.logo === 'string' && d.logo.startsWith('data:image/') && d.logo.length < 60000 ? d.logo : '';
  if (!name || !managerName || !validPhone(phone)) throw err('invalid-argument', 'bad_input');
  const act = await newActivation();
  const gref = db.collection('groups').doc();
  await db.runTransaction(async (tx) => {
    const cap = await tx.get(db.doc('captains/' + phone));
    if (cap.exists) throw err('already-exists', 'dup_captain', { phone, name: cap.data().name, sameGroup: false });
    tx.set(gref, { name, managerName, managerPhone: phone, logo, tiers: null, createdAt: FV.serverTimestamp() });
    tx.set(db.doc('captains/' + phone), { phone, name: managerName, groupId: gref.id, isManager: true, enrolled: false, createdAt: FV.serverTimestamp() });
    tx.set(db.doc('secrets/cap_' + phone), { type: 'captain', totp: null, activation: act.data });
    audit(tx, actor, 'createGroup', { groupId: gref.id, name }, { managerName, managerPhone: phone });
  });
  return { groupId: gref.id, activation: act.code };
});

A('updateGroup', ['admin'], async (d, actor) => {
  const ref = db.doc('groups/' + cleanStr(d.groupId, 40));
  await db.runTransaction(async (tx) => {
    const g = await tx.get(ref); if (!g.exists) throw err('not-found', 'no_group');
    const old = g.data(), patch = {}, changes = {};
    if (d.name !== undefined) { const v = cleanStr(d.name); if (!v) throw err('invalid-argument', 'bad_input'); if (v !== old.name) { patch.name = v; changes.name = [old.name, v]; } }
    if (d.managerName !== undefined) { const v = cleanStr(d.managerName); if (!v) throw err('invalid-argument', 'bad_input'); if (v !== old.managerName) { patch.managerName = v; changes.managerName = [old.managerName, v]; tx.update(db.doc('captains/' + old.managerPhone), { name: v }); } }
    if (d.logo) { if (!String(d.logo).startsWith('data:image/') || d.logo.length > 60000) throw err('invalid-argument', 'bad_input'); patch.logo = d.logo; changes.logo = 'changed'; }
    if (d.tiers !== undefined) { const v = d.tiers === null ? null : validateTiers(d.tiers); patch.tiers = v; changes.tiers = [old.tiers, v]; }
    if (!Object.keys(patch).length) return;
    tx.update(ref, patch);
    audit(tx, actor, 'updateGroup', { groupId: ref.id, name: old.name }, changes);
  });
  return { ok: true };
});

A('deleteGroup', ['admin'], async (d, actor) => {
  const id = cleanStr(d.groupId, 40), gref = db.doc('groups/' + id), g = await gref.get();
  if (!g.exists) throw err('not-found', 'no_group');
  const caps = await db.collection('captains').where('groupId', '==', id).get();
  const n = { captains: caps.size, charges: (await db.collection('charges').where('groupId', '==', id).count().get()).data().count };
  for (const c of caps.docs) { await db.doc('secrets/cap_' + c.id).delete(); await auth.revokeRefreshTokens('cap:' + c.id).catch(() => {}); await c.ref.delete(); }
  for (const col of ['charges', 'stats', 'payouts', 'notifications', 'fcmTokens']) await deleteQuery(db.collection(col).where('groupId', '==', id));
  await db.runTransaction(async (tx) => { tx.delete(gref); audit(tx, actor, 'deleteGroup', { groupId: id, name: g.data().name }, n); });
  return { ok: true };
});

// ----- captains
A('addCaptain', ['admin', 'staff'], async (d, actor) => {
  const groupId = cleanStr(d.groupId, 40), name = cleanStr(d.name), phone = normPhone(d.phone);
  if (!name || !validPhone(phone)) throw err('invalid-argument', 'bad_input');
  const act = await newActivation();
  await db.runTransaction(async (tx) => {
    const [g, ex] = await Promise.all([tx.get(db.doc('groups/' + groupId)), tx.get(db.doc('captains/' + phone))]);
    if (!g.exists) throw err('not-found', 'no_group');
    if (ex.exists) {
      const same = ex.data().groupId === groupId;
      let groupName = g.data().name;
      if (!same) groupName = (await tx.get(db.doc('groups/' + ex.data().groupId))).data()?.name || '';
      throw err('already-exists', 'dup_captain', { phone, name: ex.data().name, sameGroup: same, groupName });
    }
    tx.set(db.doc('captains/' + phone), { phone, name, groupId, isManager: false, enrolled: false, createdAt: FV.serverTimestamp() });
    tx.set(db.doc('secrets/cap_' + phone), { type: 'captain', totp: null, activation: act.data });
    audit(tx, actor, 'addCaptain', { groupId, name: g.data().name }, { captain: name, phone });
  });
  return { phone, activation: act.code };
});

A('resetCaptain', ['admin'], async (d, actor) => {
  const phone = normPhone(d.phone), act = await newActivation();
  await db.runTransaction(async (tx) => {
    const c = await tx.get(db.doc('captains/' + phone)); if (!c.exists) throw err('not-found', 'no_captain');
    tx.set(db.doc('secrets/cap_' + phone), { type: 'captain', totp: null, activation: act.data });
    tx.update(c.ref, { enrolled: false });
    audit(tx, actor, 'resetCaptain', { groupId: c.data().groupId, name: c.data().name }, { phone });
  });
  await auth.revokeRefreshTokens('cap:' + phone).catch(() => {});
  await deleteQuery(db.collection('fcmTokens').where('captainId', '==', phone));
  return { activation: act.code };
});

A('deleteCaptain', ['admin'], async (d, actor) => {
  const phone = normPhone(d.phone);
  await db.runTransaction(async (tx) => {
    const c = await tx.get(db.doc('captains/' + phone)); if (!c.exists) throw err('not-found', 'no_captain');
    if (c.data().isManager) throw err('failed-precondition', 'is_manager');
    tx.delete(c.ref); tx.delete(db.doc('secrets/cap_' + phone));
    audit(tx, actor, 'deleteCaptain', { groupId: c.data().groupId, name: c.data().name }, { phone });
  });
  await auth.revokeRefreshTokens('cap:' + phone).catch(() => {});
  await deleteQuery(db.collection('fcmTokens').where('captainId', '==', phone));
  return { ok: true };
});

// ----- charges
A('addCharge', ['admin', 'staff'], async (d, actor) => {
  const phone = normPhone(d.captainPhone), kwh = round3(Number(d.kwh));
  if (!(kwh > 0 && kwh <= MAX_KWH)) throw err('invalid-argument', 'bad_kwh');
  const ts = Date.now(), outbox = [];
  const result = await db.runTransaction(async (tx) => {
    outbox.length = 0;
    const capSnap = await tx.get(db.doc('captains/' + phone)); if (!capSnap.exists) throw err('not-found', 'no_captain');
    const cap = capSnap.data();
    const [gSnap, settings] = await Promise.all([tx.get(db.doc('groups/' + cap.groupId)), getSettings(tx)]);
    const group = gSnap.data(), month = localParts(ts, settings.timezone).month;
    const sref = db.doc('stats/' + statsId(cap.groupId, month)), sSnap = await tx.get(sref);
    const st = sSnap.exists ? sSnap.data() : { groupId: cap.groupId, month, kwh: 0, sales: 0, count: 0, captains: {}, nearNotified: 0 };
    const price = priceAt(settings, ts), amount = round3(kwh * price);
    const before = tierInfo(groupTiers(group, settings), st.kwh);
    const mine = st.captains[phone] || { kwh: 0, sales: 0, count: 0 };
    const next = {
      groupId: cap.groupId, month, kwh: round3(st.kwh + kwh), sales: round3(st.sales + amount), count: st.count + 1,
      captains: { ...st.captains, [phone]: { kwh: round3(mine.kwh + kwh), sales: round3(mine.sales + amount), count: mine.count + 1 } },
      nearNotified: st.nearNotified || 0,
    };
    const after = tierInfo(groupTiers(group, settings), next.kwh);
    if (after.idx > before.idx) notify(tx, cap.groupId, 'reached', { pct: after.pct, month }, { forCaptains: true }, outbox);
    if (after.next) {
      const remaining = round3(after.next.kwh - next.kwh);
      if (remaining > 0 && remaining <= settings.nearTierKwh && next.nearNotified !== after.next.kwh) {
        notify(tx, cap.groupId, 'near', { remaining, pct: after.next.pct, month }, { forCaptains: false }, outbox);
        next.nearNotified = after.next.kwh;
      }
    }
    const cref = db.collection('charges').doc();
    tx.set(cref, { captainId: phone, captainName: cap.name, groupId: cap.groupId, month, kwh, price, amount, staffId: actor.role === 'staff' ? actor.id : null, staffName: actor.name, ts: FV.serverTimestamp(), tsMs: ts });
    tx.set(sref, next);
    audit(tx, actor, 'addCharge', { groupId: cap.groupId, name: group.name }, { captain: cap.name, phone, kwh, amount });
    return { chargeId: cref.id, price, amount };
  });
  await pushAll(outbox);
  return result;
});

A('deleteCharge', ['admin'], async (d, actor) => {
  const ref = db.doc('charges/' + cleanStr(d.chargeId, 40));
  await db.runTransaction(async (tx) => {
    const c = await tx.get(ref); if (!c.exists) throw err('not-found', 'no_charge');
    const ch = c.data(), sref = db.doc('stats/' + statsId(ch.groupId, ch.month)), s = await tx.get(sref);
    if (s.exists) {
      const st = s.data(), m = st.captains[ch.captainId] || { kwh: 0, sales: 0, count: 0 };
      tx.update(sref, {
        kwh: round3(Math.max(0, st.kwh - ch.kwh)), sales: round3(Math.max(0, st.sales - ch.amount)), count: Math.max(0, st.count - 1),
        [`captains.${ch.captainId}`]: { kwh: round3(Math.max(0, m.kwh - ch.kwh)), sales: round3(Math.max(0, m.sales - ch.amount)), count: Math.max(0, m.count - 1) },
      });
    }
    tx.delete(ref);
    audit(tx, actor, 'deleteCharge', { groupId: ch.groupId, name: '' }, { captain: ch.captainName, phone: ch.captainId, kwh: ch.kwh, amount: ch.amount, month: ch.month, staff: ch.staffName });
  });
  return { ok: true };
});

// ----- staff
A('createStaff', ['admin'], async (d, actor) => {
  const name = cleanStr(d.name); if (!name) throw err('invalid-argument', 'bad_input');
  const c = await newStaffCode(), ref = db.collection('staff').doc();
  await db.runTransaction(async (tx) => {
    tx.set(ref, { name, active: true, createdAt: FV.serverTimestamp() });
    tx.set(db.doc('secrets/staff_' + ref.id), { type: 'staff', staffId: ref.id, codeHash: c.hash });
    audit(tx, actor, 'createStaff', { staffId: ref.id, name }, {});
  });
  return { staffId: ref.id, code: c.code };
});
A('regenStaff', ['admin'], async (d, actor) => {
  const id = cleanStr(d.staffId, 40), c = await newStaffCode();
  await db.runTransaction(async (tx) => {
    const s = await tx.get(db.doc('staff/' + id)); if (!s.exists) throw err('not-found', 'no_staff');
    tx.set(db.doc('secrets/staff_' + id), { type: 'staff', staffId: id, codeHash: c.hash });
    audit(tx, actor, 'regenStaff', { staffId: id, name: s.data().name }, {});
  });
  await auth.revokeRefreshTokens('staff:' + id).catch(() => {});
  return { code: c.code };
});
A('toggleStaff', ['admin'], async (d, actor) => {
  const id = cleanStr(d.staffId, 40);
  const active = await db.runTransaction(async (tx) => {
    const s = await tx.get(db.doc('staff/' + id)); if (!s.exists) throw err('not-found', 'no_staff');
    tx.update(s.ref, { active: !s.data().active });
    audit(tx, actor, 'toggleStaff', { staffId: id, name: s.data().name }, { active: !s.data().active });
    return !s.data().active;
  });
  return { active };
});
A('deleteStaff', ['admin'], async (d, actor) => {
  const id = cleanStr(d.staffId, 40);
  await db.runTransaction(async (tx) => {
    const s = await tx.get(db.doc('staff/' + id)); if (!s.exists) throw err('not-found', 'no_staff');
    tx.delete(s.ref); tx.delete(db.doc('secrets/staff_' + id));
    audit(tx, actor, 'deleteStaff', { staffId: id, name: s.data().name }, {});
  });
  await auth.revokeRefreshTokens('staff:' + id).catch(() => {});
  return { ok: true };
});

// ----- settings
A('saveSettings', ['admin'], async (d, actor) => {
  const ref = db.doc('settings/main'), patch = {};
  if (d.tiers !== undefined) patch.tiers = validateTiers(d.tiers);
  if (d.prices !== undefined) {
    if (!Array.isArray(d.prices) || !d.prices.length) throw err('invalid-argument', 'bad_prices');
    patch.prices = d.prices.map((p) => ({ from: String(p.from), to: String(p.to), price: Number(p.price) }));
    if (patch.prices.some((p) => !/^\d{2}:\d{2}$/.test(p.from) || !/^\d{2}:\d{2}$/.test(p.to) || !(p.price >= 0))) throw err('invalid-argument', 'bad_prices');
    if (!pricesCoverDay(patch.prices)) throw err('invalid-argument', 'prices_overlap');
  }
  if (d.currency !== undefined) patch.currency = cleanStr(d.currency, 12) || 'JD';
  if (d.timezone !== undefined) { try { new Intl.DateTimeFormat('en', { timeZone: d.timezone }); } catch { throw err('invalid-argument', 'bad_tz'); } patch.timezone = d.timezone; }
  if (d.nearTierKwh !== undefined) { const v = Number(d.nearTierKwh); if (!(v >= 0 && v <= 10000)) throw err('invalid-argument', 'bad_input'); patch.nearTierKwh = v; }
  await db.runTransaction(async (tx) => {
    const old = await getSettings(tx), changes = {};
    for (const k of Object.keys(patch)) changes[k] = [old[k], patch[k]];
    tx.set(ref, patch, { merge: true });
    audit(tx, actor, 'saveSettings', { name: Object.keys(patch).join(',') }, changes);
  });
  return { ok: true };
});

// ----- payout (cash-back deposited to the group manager)
A('markPayout', ['admin'], async (d, actor) => {
  const groupId = cleanStr(d.groupId, 40), month = cleanStr(d.month, 7), note = cleanStr(d.note, 500);
  if (!/^\d{4}-\d{2}$/.test(month)) throw err('invalid-argument', 'bad_input');
  const outbox = [];
  const result = await db.runTransaction(async (tx) => {
    outbox.length = 0;
    const settings = await getSettings(tx);
    if (month >= localParts(Date.now(), settings.timezone).month) throw err('failed-precondition', 'month_not_ended');
    const pref = db.doc('payouts/' + statsId(groupId, month));
    const [g, s, p] = await Promise.all([tx.get(db.doc('groups/' + groupId)), tx.get(db.doc('stats/' + statsId(groupId, month))), tx.get(pref)]);
    if (!g.exists) throw err('not-found', 'no_group');
    if (p.exists) throw err('already-exists', 'already_paid');
    const st = s.exists ? s.data() : { kwh: 0, sales: 0 };
    const pct = tierInfo(groupTiers(g.data(), settings), st.kwh).pct, amount = round3(st.sales * pct / 100);
    tx.set(pref, { groupId, month, groupName: g.data().name, kwh: st.kwh, sales: st.sales, pct, amount, note, paid: true, paidAt: FV.serverTimestamp(), paidBy: actor.name });
    notify(tx, groupId, 'payout', { month, amount, currency: settings.currency, note }, { forCaptains: true }, outbox);
    audit(tx, actor, 'markPayout', { groupId, name: g.data().name }, { month, amount, pct, note });
    return { amount, pct };
  });
  await pushAll(outbox);
  return result;
});
A('unmarkPayout', ['admin'], async (d, actor) => {
  const groupId = cleanStr(d.groupId, 40), month = cleanStr(d.month, 7), pref = db.doc('payouts/' + statsId(groupId, month)), outbox = [];
  await db.runTransaction(async (tx) => {
    outbox.length = 0;
    const p = await tx.get(pref); if (!p.exists) throw err('not-found', 'no_payout');
    tx.delete(pref);
    notify(tx, groupId, 'payout_undo', { month }, { forCaptains: true }, outbox);
    audit(tx, actor, 'unmarkPayout', { groupId, name: p.data().groupName }, { month, amount: p.data().amount });
  });
  await pushAll(outbox);
  return { ok: true };
});

exports._test = { pushText, tierInfo, priceAt, localParts, pricesCoverDay, normPhone };
