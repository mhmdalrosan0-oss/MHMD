/* Data layer + business rules.
   Storage is localStorage (demo). To go multi-device, replace load()/persist()
   with calls to a cloud database; the rest of the app only uses the Store API. */
const Store = (() => {
  const KEY = 'smart-energy-v1';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const defaults = () => ({
    settings: {
      currency: 'دينار',
      adminHash: null, // null => default password "admin123"
      tiers: [
        { kwh: 1000, pct: 20 }, { kwh: 1200, pct: 21 }, { kwh: 1400, pct: 22 },
        { kwh: 1600, pct: 24 }, { kwh: 2000, pct: 29 },
      ],
      prices: [
        { from: '06:00', to: '17:00', price: 0.19 },
        { from: '17:00', to: '06:00', price: 0.25 },
      ],
    },
    groups: [], captains: [], charges: [], staff: [],
  });

  let db;
  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)) || defaults(); } catch { db = defaults(); }
    const d = defaults();
    db.settings = Object.assign(d.settings, db.settings);
    for (const k of ['groups', 'captains', 'charges', 'staff']) db[k] = db[k] || [];
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch { alert('Storage full / التخزين ممتلئ'); }
  }
  load();

  // ---------- helpers ----------
  const monthKey = (ts) => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const round3 = (n) => Math.round(n * 1000) / 1000;

  async function hash(s) {
    if (window.crypto && crypto.subtle) {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('se:' + s));
      return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
    }
    return 'plain:' + s;
  }

  // ---------- pricing ----------
  function priceAt(ts = Date.now()) {
    const d = new Date(ts), t = d.getHours() * 60 + d.getMinutes();
    for (const p of db.settings.prices) {
      const a = toMin(p.from), b = toMin(p.to);
      const hit = a === b ? true : a < b ? t >= a && t < b : t >= a || t < b;
      if (hit) return Number(p.price);
    }
    return Number(db.settings.prices[0]?.price || 0);
  }
  // true when periods cover exactly 24h with no overlap
  function pricesValid() {
    const cover = new Array(1440).fill(0);
    for (const p of db.settings.prices) {
      const a = toMin(p.from), b = toMin(p.to);
      for (let i = 0; i < 1440; i++) {
        const hit = a === b ? true : a < b ? i >= a && i < b : i >= a || i < b;
        if (hit) cover[i]++;
      }
    }
    return cover.every((c) => c === 1);
  }

  // ---------- tiers ----------
  const sortedTiers = (tiers) => [...tiers].sort((a, b) => a.kwh - b.kwh);
  function tiersFor(group) { return sortedTiers(group && group.tiers && group.tiers.length ? group.tiers : db.settings.tiers); }
  function tierInfo(group, totalKwh) {
    const tiers = tiersFor(group);
    if (!tiers.length) return { pct: 0, idx: -1, next: null, tiers };
    let idx = 0;
    tiers.forEach((t, i) => { if (totalKwh >= t.kwh) idx = i; });
    const next = tiers[idx + 1] || null;
    return { pct: tiers[idx].pct, idx, next, tiers };
  }

  // ---------- stats ----------
  function chargesOf(filter, month) {
    return db.charges.filter((c) => (!month || monthKey(c.ts) === month) &&
      (!filter.groupId || c.groupId === filter.groupId) && (!filter.captainId || c.captainId === filter.captainId));
  }
  function groupStats(groupId, month) {
    const group = db.groups.find((g) => g.id === groupId);
    const cs = chargesOf({ groupId }, month);
    const kwh = round3(cs.reduce((s, c) => s + c.kwh, 0));
    const sales = round3(cs.reduce((s, c) => s + c.amount, 0));
    const tier = tierInfo(group, kwh);
    const cashback = round3(sales * tier.pct / 100);
    return { kwh, sales, pct: tier.pct, tier, cashback, count: cs.length };
  }
  function captainStats(captainId, month) {
    const cap = db.captains.find((c) => c.id === captainId);
    const cs = chargesOf({ captainId }, month);
    const kwh = round3(cs.reduce((s, c) => s + c.kwh, 0));
    const sales = round3(cs.reduce((s, c) => s + c.amount, 0));
    const g = cap ? groupStats(cap.groupId, month) : { pct: 0 };
    return { kwh, sales, cashback: round3(sales * g.pct / 100), count: cs.length };
  }
  function monthsAvailable() {
    const s = new Set(db.charges.map((c) => monthKey(c.ts)));
    s.add(monthKey(Date.now()));
    return [...s].sort().reverse();
  }

  // ---------- mutations ----------
  const normPhone = (p) => String(p || '').replace(/[^\d]/g, '').replace(/^00/, '');
  const validPhone = (p) => normPhone(p).length >= 8;

  function addGroup({ name, managerName, managerPhone, logo }) {
    const g = { id: uid(), name: name.trim(), managerName: managerName.trim(), managerPhone: normPhone(managerPhone), logo: logo || '', tiers: null, createdAt: Date.now() };
    db.groups.push(g);
    db.captains.push({ id: uid(), groupId: g.id, name: g.managerName, phone: g.managerPhone, isManager: true, createdAt: Date.now() });
    persist();
    return g;
  }
  function updateGroup(id, patch) { Object.assign(db.groups.find((g) => g.id === id), patch); persist(); }
  function deleteGroup(id) {
    db.groups = db.groups.filter((g) => g.id !== id);
    db.captains = db.captains.filter((c) => c.groupId !== id);
    db.charges = db.charges.filter((c) => c.groupId !== id);
    persist();
  }
  function findCaptainByPhone(groupId, phone) {
    const p = normPhone(phone);
    return db.captains.find((c) => c.groupId === groupId && c.phone === p);
  }
  function addCaptain(groupId, name, phone) {
    const c = { id: uid(), groupId, name: name.trim(), phone: normPhone(phone), createdAt: Date.now() };
    db.captains.push(c); persist(); return c;
  }
  function deleteCaptain(id) {
    db.captains = db.captains.filter((c) => c.id !== id);
    db.charges = db.charges.filter((c) => c.captainId !== id);
    persist();
  }
  function addCharge(captainId, kwh, staffId, ts = Date.now()) {
    const cap = db.captains.find((c) => c.id === captainId);
    const price = priceAt(ts);
    const ch = { id: uid(), captainId, groupId: cap.groupId, kwh: round3(Number(kwh)), price, amount: round3(kwh * price), staffId: staffId || null, ts };
    db.charges.push(ch); persist(); return ch;
  }
  function deleteCharge(id) { db.charges = db.charges.filter((c) => c.id !== id); persist(); }

  // staff
  function genCode() {
    let c;
    do { c = String(Math.floor(100000 + Math.random() * 900000)); } while (db.staff.some((s) => s.code === c));
    return c;
  }
  function addStaff(name) { const s = { id: uid(), name: name.trim(), code: genCode(), active: true, createdAt: Date.now() }; db.staff.push(s); persist(); return s; }
  function regenStaff(id) { const s = db.staff.find((x) => x.id === id); s.code = genCode(); persist(); return s; }
  function toggleStaff(id) { const s = db.staff.find((x) => x.id === id); s.active = !s.active; persist(); }
  function deleteStaff(id) { db.staff = db.staff.filter((s) => s.id !== id); persist(); }

  // auth
  async function checkAdmin(pw) {
    const h = db.settings.adminHash;
    return h ? (await hash(pw)) === h : pw === 'admin123';
  }
  async function setAdminPassword(pw) { db.settings.adminHash = await hash(pw); persist(); }
  const isDefaultAdmin = () => !db.settings.adminHash;
  const staffByCode = (code) => db.staff.find((s) => s.code === String(code).trim() && s.active);
  const captainsByPhone = (phone) => { const p = normPhone(phone); return p ? db.captains.filter((c) => c.phone === p) : []; };

  function saveSettings(patch) { Object.assign(db.settings, patch); persist(); }

  // data tools
  const exportJSON = () => JSON.stringify(db, null, 1);
  function importJSON(txt) { const o = JSON.parse(txt); if (!o.settings || !o.groups) throw new Error('bad'); db = o; persist(); load(); }
  function reset() { db = defaults(); persist(); }
  function seedDemo() {
    const now = new Date();
    const g = addGroup({ name: 'البرق', managerName: 'أحمد سالم', managerPhone: '0791000001' });
    const names = ['خليل محمود', 'عمر يوسف', 'سامر علي', 'ياسر حسن', 'محمد ناصر', 'بلال عدنان'];
    const caps = names.map((n, i) => addCaptain(g.id, n, '07910001' + String(10 + i)));
    caps.push(db.captains.find((c) => c.isManager && c.groupId === g.id));
    if (!db.staff.length) addStaff('موظف الشحن 1');
    for (let d = 1; d <= Math.min(now.getDate(), 28); d++) {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const cap = caps[Math.floor(Math.random() * caps.length)];
        const ts = new Date(now.getFullYear(), now.getMonth(), d, 7 + Math.floor(Math.random() * 15), Math.floor(Math.random() * 60)).getTime();
        if (ts <= Date.now()) addCharge(cap.id, 20 + Math.floor(Math.random() * 40), db.staff[0].id, ts);
      }
    }
    persist();
  }

  return {
    get db() { return db; }, uid, monthKey, normPhone, validPhone, priceAt, pricesValid, tiersFor, tierInfo, sortedTiers,
    groupStats, captainStats, chargesOf, monthsAvailable,
    addGroup, updateGroup, deleteGroup, addCaptain, deleteCaptain, findCaptainByPhone, addCharge, deleteCharge,
    addStaff, regenStaff, toggleStaff, deleteStaff, checkAdmin, setAdminPassword, isDefaultAdmin, staffByCode, captainsByPhone,
    saveSettings, exportJSON, importJSON, reset, seedDemo,
  };
})();
if (typeof module !== 'undefined') module.exports = Store;
