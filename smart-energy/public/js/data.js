/* Data layer: Firestore reads (scoped by security rules) + Cloud Functions for every write. */
const Data = (() => {
  const DEF = {
    currency: 'دينار', timezone: 'Asia/Amman', nearTierKwh: 100,
    tiers: [{ kwh: 1000, pct: 20 }, { kwh: 1200, pct: 21 }, { kwh: 1400, pct: 22 }, { kwh: 1600, pct: 24 }, { kwh: 2000, pct: 29 }],
    prices: [{ from: '06:00', to: '17:00', price: 0.19 }, { from: '17:00', to: '06:00', price: 0.25 }],
  };
  let settings = DEF;
  const round3 = (n) => Math.round(n * 1000) / 1000;
  const mapDocs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const q = (col, ...cons) => FB.getDocs(FB.query(FB.collection(FB.db, col), ...cons)).then(mapDocs);
  const one = async (col, id) => { const s = await FB.getDoc(FB.doc(FB.db, col, id)); return s.exists() ? { id: s.id, ...s.data() } : null; };
  const w = (f, v) => FB.where(f, '==', v);

  // ---------- phone / time helpers (same rules as the server) ----------
  function normPhone(p) {
    let d = String(p || '').replace(/\D/g, '').replace(/^00/, '');
    if (d.startsWith('962') && d.length === 12) d = '0' + d.slice(3);
  if (d.length === 9 && d.startsWith('7')) d = '0' + d; // 7XXXXXXXX -> 07XXXXXXXX
    return d;
  }
  const validPhone = (p) => /^\d{8,15}$/.test(normPhone(p));
  function parts(ts) {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timezone, year: 'numeric', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const o = Object.fromEntries(f.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
    return { month: `${o.year}-${o.month}`, minutes: +o.hour * 60 + +o.minute };
  }
  const nowMonth = () => parts(Date.now()).month;
  function recentMonths(n = 12) {
    let [y, m] = nowMonth().split('-').map(Number); const out = [];
    for (let i = 0; i < n; i++) { out.push(`${y}-${String(m).padStart(2, '0')}`); m--; if (m === 0) { m = 12; y--; } }
    return out;
  }
  const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const inRange = (t, a, b) => (a === b ? true : a < b ? t >= a && t < b : t >= a || t < b);
  function priceAt(ts = Date.now()) {
    const { minutes } = parts(ts);
    for (const p of settings.prices) if (inRange(minutes, toMin(p.from), toMin(p.to))) return Number(p.price);
    return Number(settings.prices[0]?.price || 0);
  }

  // ---------- tiers & stats ----------
  const sortedTiers = (t) => [...t].sort((a, b) => a.kwh - b.kwh);
  const tiersFor = (group) => sortedTiers(group && group.tiers && group.tiers.length ? group.tiers : settings.tiers);
  function tierInfo(group, kwh) {
    const tiers = tiersFor(group); let idx = 0;
    tiers.forEach((t, i) => { if (kwh >= t.kwh) idx = i; });
    return { pct: tiers[idx].pct, idx, next: tiers[idx + 1] || null, tiers };
  }
  /** group + stats doc (or null) -> display numbers. Cash-back is on the month's total purchases only. */
  function groupStats(group, st) {
    const kwh = st ? st.kwh : 0, sales = st ? st.sales : 0, tier = tierInfo(group, kwh);
    return { kwh, sales, count: st ? st.count : 0, pct: tier.pct, tier, cashback: round3(sales * tier.pct / 100) };
  }
  const captainShare = (st, phone, pct) => { const m = (st && st.captains && st.captains[phone]) || { kwh: 0, sales: 0, count: 0 }; return { kwh: m.kwh, sales: m.sales, cashback: round3(m.sales * pct / 100) }; };

  // ---------- reads ----------
  async function loadSettings() { const s = await one('settings', 'main'); settings = { ...DEF, ...(s || {}) }; delete settings.id; return settings; }
  const emptyStats = (g, m) => null;
  const api = {
    get settings() { return settings; },
    loadSettings, normPhone, validPhone, nowMonth, recentMonths, priceAt, tierInfo, tiersFor, sortedTiers, groupStats, captainShare, round3,
    groups: () => q('groups'),
    group: (id) => one('groups', id),
    captains: (groupId) => q('captains', w('groupId', groupId)),
    captain: (phone) => one('captains', phone),
    stats: (groupId, month) => one('stats', `${groupId}_${month}`),
    statsMonth: (month) => q('stats', w('month', month)),
    chargesGroup: (groupId, month) => q('charges', w('groupId', groupId), w('month', month)).then((r) => r.sort((a, b) => b.tsMs - a.tsMs)),
    chargesCaptain: (phone, month) => q('charges', w('captainId', phone), w('month', month)).then((r) => r.sort((a, b) => b.tsMs - a.tsMs)),
    payout: (groupId, month) => one('payouts', `${groupId}_${month}`),
    payoutsMonth: (month) => q('payouts', w('month', month)),
    staff: () => q('staff'),
    audit: (n = 150) => q('audit', FB.orderBy('ts', 'desc'), FB.limit(n)),
    notificationsQuery: (groupId, isManager) => FB.query(FB.collection(FB.db, 'notifications'), w('groupId', groupId), ...(isManager ? [] : [w('forCaptains', true)])),

    // ---------- writes / auth ----------
    async fn(name, data) {
      try { return (await FB.call(name)(data)).data; }
      catch (e) { const er = new Error(e.message || 'error'); er.code = String(e.code || '').replace('functions/', ''); er.details = e.details; throw er; }
    },
    write: (action, data) => api.fn('api', { action, data }),
  };
  return api;
})();
