/* End-to-end test against the Firebase emulators:
     firebase emulators:start --only auth,functions,firestore,hosting --project demo-smart-energy
     node functions/test/e2e.js        (needs playwright + firebase-admin) */
const path = require('path');
const { chromium } = require('playwright');
const totp = require('../totp');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-smart-energy' });
const adb = admin.firestore();

const BASE = 'http://127.0.0.1:5000/?emu';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const FAKE_CFG = `window.FIREBASE_CONFIG={apiKey:'fake',authDomain:'x',projectId:'demo-smart-energy',appId:'x'};window.FUNCTIONS_REGION='europe-west1';`;

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-smart-energy/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-smart-energy/accounts', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@test.com', password: 'secret123' }) });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 400, height: 850 } });
  await ctx.route('**/js/firebase-config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_CFG }));
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const clickTab = (r) => p.click(`.tabs button[data-r=${r}]`);
  const logout = async () => { await p.click('#logoutBtn'); await p.waitForSelector('.tabs'); };
  const call = (action, data) => p.evaluate(([a, d]) => Data.write(a, d).then((r) => ({ ok: r }), (e) => ({ err: e.message, code: e.code, details: e.details })), [action, data]);
  const shot = (n) => p.screenshot({ path: path.join(process.env.SHOTS || '/tmp', n + '.png') });

  console.log('Admin login + group');
  await p.goto(BASE + '#/login'); await p.waitForSelector('.tabs');
  await clickTab('admin'); await p.fill('#f1', 'admin@test.com'); await p.fill('#f2', 'wrong'); await p.click('button.primary');
  await p.waitForFunction(() => document.querySelector('#err').textContent.length > 0);
  ok(true, 'wrong admin password rejected');
  await p.fill('#f2', 'secret123'); await p.click('button.primary'); await p.waitForURL(/admin\/dash/);
  ok(true, 'admin signed in');
  await p.click('.nav a[href="#/admin/groups"]'); await p.click('#addG');
  await p.fill('#gn', 'البرق'); await p.fill('#mn', 'أحمد سالم'); await p.fill('#mp', '0791000001'); await p.click('#ok');
  await p.waitForSelector('#go'); const mgrAct = (await p.textContent('.modal .ltr')).trim();
  ok(/^\d{8}$/.test(mgrAct), 'manager activation code shown: ' + mgrAct);
  await p.click('#go'); await p.waitForSelector('#qr');
  const gid = p.url().split('/').pop();
  await p.click('.nav a[href="#/admin/staff"]'); await p.click('#addS'); await p.fill('#n', 'موظف 1'); await p.click('#ok');
  await p.waitForSelector('.modal .ltr'); const staffCode = (await p.textContent('.modal .ltr')).trim();
  ok(/^\d{6}$/.test(staffCode), 'staff code created');
  await p.click('[data-close]'); await logout();

  console.log('Captain activation (Google Authenticator)');
  await p.click('#actBtn'); await p.fill('#p', '0791000001'); await p.fill('#a', '12345678'); await p.click('#ok');
  await p.waitForFunction(() => document.querySelector('#e').textContent.length > 0); ok(true, 'wrong activation code rejected');
  await p.fill('#a', mgrAct); await p.click('#ok'); await p.waitForSelector('#aq');
  const secret = (await p.textContent('.modal b.ltr')).trim();
  ok(secret.length === 32, 'authenticator secret shown with QR');
  await shot('01-activation');
  await p.fill('#c', totp.hotp(secret, totp.stepNow())); await p.click('#ok');
  await p.waitForURL(/captain/); await p.waitForSelector('.stat'); ok(true, 'captain activated and signed in');
  await logout();
  const reused = await p.evaluate(async (a) => Data.fn('captainEnrollStart', a).then(() => 'ok', (e) => e.message), { phone: '0791000001', activation: mgrAct });
  ok(reused === 'bad_activation', 'activation code is single-use');

  console.log('Captain login with phone + TOTP');
  await clickTab('captain'); await p.fill('#f1', '0791000001'); await p.fill('#f2', '000000'); await p.click('button.primary');
  await p.waitForFunction(() => document.querySelector('#err').textContent.length > 0); ok(true, 'wrong TOTP rejected');
  const next = totp.hotp(secret, totp.stepNow() + 1);
  await p.fill('#f2', next); await p.click('button.primary'); await p.waitForURL(/captain/); ok(true, 'login with phone + TOTP works');
  await logout();
  await clickTab('captain'); await p.fill('#f1', '0791000001'); await p.fill('#f2', next); await p.click('button.primary');
  await p.waitForFunction(() => document.querySelector('#err').textContent.length > 0); ok(true, 'TOTP code cannot be replayed');

  console.log('Staff flow via group QR url');
  await p.goto(BASE + '#/g/' + gid); await p.reload(); await p.waitForSelector('.codeinput');
  await p.fill('.codeinput', '000000'); await p.click('button.primary');
  await p.waitForFunction(() => document.querySelector('#err').textContent.length > 0); ok(true, 'wrong staff code rejected');
  await p.fill('.codeinput', staffCode); await p.click('button.primary'); await p.waitForSelector('#newCap');
  ok(true, 'staff signed in and redirected to the scanned group');
  await p.click('#newCap'); await p.fill('#n', 'خليل'); await p.fill('#p', '0795550123'); await p.click('#ok');
  await p.waitForSelector('#go'); const act2 = (await p.textContent('.modal .ltr')).trim(); ok(/^\d{8}$/.test(act2), 'new captain gets activation code');
  await p.click('#go'); await p.fill('#kwh', '25'); await shot('02-charge'); await p.click('#ok');
  await p.waitForSelector('.item b'); ok(true, 'charge recorded');
  await p.click('#newCap'); await p.fill('#n', 'x'); await p.fill('#p', '795550123'); await p.click('#ok');
  await p.waitForSelector('#useEx'); ok(true, 'same-group duplicate phone warns staff (normalised number)');
  await p.click('[data-close]');
  const g2 = await adb.collection('groups').add({ name: 'G2', managerName: 'm', managerPhone: '0790000002', logo: '', tiers: null });
  const other = await call('addCaptain', { groupId: g2.id, name: 'dup', phone: '0795550123' });
  ok(other.code === 'already-exists' && other.details && other.details.sameGroup === false, 'captain cannot join a second group');
  for (const k of [300, 300, 300, 200]) await call('addCharge', { captainPhone: '0795550123', kwh: k });
  const bad = await call('addCharge', { captainPhone: '0795550123', kwh: 5000 }); ok(bad.err === 'bad_kwh', 'absurd kWh rejected');
  const stDoc = await adb.doc(`stats/${gid}_${await p.evaluate(() => Data.nowMonth())}`).get();
  ok(Math.abs(stDoc.data().kwh - 1125) < 0.01, 'monthly total aggregated: ' + stDoc.data().kwh);
  const notifs = (await adb.collection('notifications').where('groupId', '==', gid).get()).docs.map((d) => d.data().type);
  ok(notifs.includes('near'), 'near-tier alert created for manager');
  await call('addCharge', { captainPhone: '0795550123', kwh: 100 });
  ok((await adb.collection('notifications').where('groupId', '==', gid).get()).docs.some((d) => d.data().type === 'reached'), 'tier-reached notification created');
  const forbidden = await call('deleteCharge', { chargeId: 'x' }); ok(forbidden.err === 'forbidden', 'staff cannot call admin actions');
  await logout();

  console.log('Manager sees alerts');
  await adb.doc('secrets/cap_0791000001').update({ 'totp.lastStep': 0 }); // (real users just wait for the next 30s code)
  await clickTab('captain'); await p.fill('#f1', '0791000001'); await p.fill('#f2', totp.hotp(secret, totp.stepNow()));
  await p.click('button.primary'); await p.waitForURL(/captain/).catch(() => {});
  await p.waitForSelector('.stat');
  await p.waitForFunction(() => +document.querySelector('#bellDot').textContent >= 1, null, { timeout: 8000 }); ok(true, 'bell shows unread alerts');
  await shot('03-captain');
  await p.click('.bellbtn'); await p.waitForSelector('.list');
  const txt = await p.textContent('.list'); ok(/باقي 75 ك.و للوصول إلى 21%/.test(txt), "alert text: remaining 75 kWh to 21%: " + txt.split("\n")[0]);
  await shot('04-notifications');
  await logout();

  console.log('Security rules');
  await clickTab('staff'); await p.fill('#f1', staffCode); await p.click('button.primary'); await p.waitForSelector('#glist');
  const r1 = await p.evaluate(async () => { try { await FB.getDoc(FB.doc(FB.db, 'secrets', 'staff_x')); return 'read'; } catch (e) { return e.code; } });
  ok(r1 === 'permission-denied', 'staff cannot read secrets');
  const r2 = await p.evaluate(async () => { try { await FB.getDocs(FB.collection(FB.db, 'audit')); return 'read'; } catch (e) { return e.code; } });
  ok(r2 === 'permission-denied', 'staff cannot read audit log');
  await logout();

  console.log('Payout + audit (admin)');
  await clickTab('admin'); await p.fill('#f1', 'admin@test.com'); await p.fill('#f2', 'secret123'); await p.click('button.primary'); await p.waitForURL(/admin\/dash/);
  const premature = await call('markPayout', { groupId: gid, month: await p.evaluate(() => Data.nowMonth()), note: '' });
  ok(premature.err === 'month_not_ended', 'cannot mark payout before month ends');
  await adb.doc(`stats/${gid}_2026-01`).set({ groupId: gid, month: '2026-01', kwh: 1250, sales: 300, count: 10, captains: {}, nearNotified: 0 });
  await p.goto(BASE + '#/admin/groups/' + gid); await p.reload(); await p.waitForSelector('#qr');
  await p.selectOption('#monthSel', { label: '2026-01' }).catch(() => {});
  const hasJan = await p.evaluate(() => [...document.querySelectorAll('#monthSel option')].some((o) => o.textContent === '2026-01'));
  if (hasJan) { await p.selectOption('#monthSel', '2026-01'); await p.waitForSelector('#markPay'); }
  else { ok(true, '(2026-01 outside 12-month window; marking via API)'); }
  if (hasJan) { await p.click('#markPay'); await p.fill('#nt', 'تم التحويل عبر كليك'); await p.click('#ok'); await p.waitForSelector('#undoPay'); shot('05-paid'); }
  else await call('markPayout', { groupId: gid, month: '2026-01', note: 'تم التحويل عبر كليك' });
  const po = (await adb.doc(`payouts/${gid}_2026-01`).get()).data();
  ok(po && po.paid && Math.abs(po.amount - 63) < 0.01, 'payout recorded: 21% of 300 = ' + (po && po.amount));
  const pn = (await adb.collection('notifications').where('type', '==', 'payout').get()).docs[0].data();
  ok(pn.forCaptains && pn.forManager && pn.params.note.includes('كليك'), 'payout notification for manager + captains with note');
  await p.click('.nav a[href="#/admin/audit"]'); await p.waitForSelector('table'); await shot('06-audit');
  const rows = await p.$$eval('table tr', (r) => r.map((x) => x.textContent));
  ok(rows.some((x) => /تسجيل شحنة/.test(x)) && rows.some((x) => /موظف 1/.test(x)), 'audit shows staff charges with staff name');
  ok(rows.some((x) => /تأكيد إيداع/.test(x)), 'audit shows payout confirmation by admin');
  ok(rows.some((x) => /إضافة مجموعة/.test(x)), 'audit shows admin group creation');

  console.log('Admin delete charge keeps aggregates consistent');
  const ch = (await adb.collection('charges').where('groupId', '==', gid).limit(1).get()).docs[0];
  const before = (await adb.doc(`stats/${gid}_${ch.data().month}`).get()).data().kwh;
  const del = await call('deleteCharge', { chargeId: ch.id });
  const after = (await adb.doc(`stats/${gid}_${ch.data().month}`).get()).data().kwh;
  ok(del.ok && Math.abs(before - after - ch.data().kwh) < 0.01, 'stats decreased by deleted charge');
  const lock = await p.evaluate(async () => { let r; for (let i = 0; i < 6; i++) r = await Data.fn('captainLogin', { phone: '0799999999', code: '123456' }).then(() => 'ok', (e) => e.message); return r; });
  ok(lock === 'locked', 'brute force lock after repeated failures');

  console.log('errors:', errs);
  ok(errs.length === 0, 'no page errors');
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
