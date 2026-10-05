/* Smart Energy – UI (Firebase edition).
   Hash router: #/login, #/captain, #/notifications, #/staff, #/g/:id (QR target), #/admin/:tab[/:groupId] */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let lang = localStorage.getItem('se-lang') || 'ar';
  const t = (k, vars) => { let s = (I18N[lang][k] ?? I18N.ar[k] ?? k); if (vars) for (const v in vars) s = s.split('{' + v + '}').join(vars[v]); return s; };
  const applyLang = () => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; };
  const num = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
  const money = (n) => num(n, 3) + ' ' + Data.settings.currency;
  const tsOf = (x) => (x && x.toMillis ? x.toMillis() : x);
  const fmtDate = (ts) => new Date(tsOf(ts)).toLocaleString(lang === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: Data.settings.timezone });
  const initials = (s) => (s || '?').trim().charAt(0);
  const errMsg = (e) => {
    if (e && e.message && I18N.ar['err_' + e.message]) return t('err_' + e.message);
    if (e && (e.code === 'unavailable' || /network|fetch/i.test(e.message || ''))) return t('err_network');
    return t('err_generic');
  };

  let sess = null;         // {role, uid, captainId, groupId, isManager, staffId, name}
  let pending = null;      // hash to open after login
  let month = null;
  let installEvt = null;

  async function refreshSess() {
    const u = FB.auth.currentUser;
    if (!u) { sess = null; return; }
    const c = (await u.getIdTokenResult()).claims;
    if (!c.role) { await FB.signOut(FB.auth); sess = null; return; }
    sess = { role: c.role, uid: u.uid, captainId: c.captainId, groupId: c.groupId, isManager: !!c.isManager, staffId: c.staffId, name: c.name || u.email };
  }

  function toast(msg, bad) {
    const d = document.createElement('div'); d.className = 'toast' + (bad ? ' bad' : ''); d.textContent = msg;
    $('#toasts').appendChild(d); setTimeout(() => d.remove(), 3600);
  }
  function modal(html, mount) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="overlay"><div class="modal">${html}</div></div>`;
    const close = () => { root.innerHTML = ''; };
    root.querySelector('.overlay').addEventListener('click', (e) => { if (e.target.classList.contains('overlay')) close(); });
    root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    if (mount) mount(root.querySelector('.modal'), close);
    return close;
  }
  const confirmBox = (msg, ok) => modal(`<p>${esc(msg)}</p><div class="row"><button class="btn danger" id="yes">${t('confirm')}</button><button class="btn" data-close>${t('cancel')}</button></div>`,
    (m, close) => $('#yes', m).onclick = () => { close(); ok(); });
  const go = (h) => { if (location.hash === h) render(); else location.hash = h; };
  /** wrap an async click handler: disables the button, reports errors as toasts */
  const safe = (btn, fn) => async (ev) => {
    if (btn.disabled) return; btn.disabled = true;
    try { await fn(ev); } catch (e) { toast(errMsg(e), true); console.error(e); } finally { btn.disabled = false; }
  };

  const BOLT = '<svg viewBox="0 0 24 24"><path fill="#f0c419" d="M13 2 4 14h6l-2 8 10-13h-6z"/></svg>';

  // ---------- notifications (captains) ----------
  let notifs = [], unsubNotif = null, notifFirst = true;
  const seenKey = () => 'se-seen-' + (sess && sess.captainId);
  const lastSeen = () => +localStorage.getItem(seenKey()) || 0;
  const unreadCount = () => notifs.filter((n) => n.tsMs > lastSeen()).length;
  function notifText(n) {
    const p = Object.assign({}, n.params, { month: n.params && n.params.month });
    let body = t('n_' + n.type, p);
    if (n.type === 'payout' && n.params.note) body += `\n${t('note')}: ${n.params.note}`;
    return { title: t('n_' + n.type + '_t'), body };
  }
  function updateBell() { const d = $('#bellDot'); if (!d) return; const c = unreadCount(); d.textContent = c; d.classList.toggle('hide', !c); }
  function startNotif() {
    stopNotif(); if (!sess || sess.role !== 'captain') return;
    notifFirst = true;
    unsubNotif = FB.onSnapshot(Data.notificationsQuery(sess.groupId, sess.isManager), (snap) => {
      notifs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((n) => n.tsMs).sort((a, b) => b.tsMs - a.tsMs);
      if (!notifFirst) snap.docChanges().forEach((c) => { if (c.type === 'added') { const x = notifText({ id: c.doc.id, ...c.doc.data() }); toast('🔔 ' + x.title + ': ' + x.body.split('\n')[0]); } });
      notifFirst = false; updateBell();
      if (location.hash === '#/notifications') render();
    }, () => {});
  }
  function stopNotif() { if (unsubNotif) unsubNotif(); unsubNotif = null; notifs = []; }

  // ---------- layout ----------
  const homeOf = () => (sess ? { admin: '#/admin/dash', staff: '#/staff', captain: '#/captain' }[sess.role] : '#/login');
  function shell(inner, { nav } = {}) {
    return `<header class="topbar no-print">
      <a class="brand" href="${homeOf()}">${BOLT}<span>SMART <b>ENERGY</b></span></a><div class="spacer"></div>
      ${installEvt ? `<button class="btn" id="installBtn">⬇ ${t('install_app')}</button>` : ''}
      ${sess && sess.role === 'captain' ? `<a class="btn bellbtn" href="#/notifications" aria-label="${t('notifications')}">🔔<span class="dot hide" id="bellDot"></span></a>` : ''}
      <button class="btn" id="langBtn">${t('lang')}</button>
      ${sess ? `<button class="btn" id="logoutBtn">${t('logout')}</button>` : ''}
    </header>${nav || ''}<main class="wrap">${inner}</main>`;
  }
  function bindShell() {
    const lb = $('#langBtn'); if (lb) lb.onclick = () => { lang = lang === 'ar' ? 'en' : 'ar'; localStorage.setItem('se-lang', lang); applyLang(); render(); };
    const ob = $('#logoutBtn'); if (ob) ob.onclick = async () => { stopNotif(); await FB.signOut(FB.auth); sess = null; go('#/login'); };
    const ib = $('#installBtn'); if (ib) ib.onclick = async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; ib.remove(); };
    updateBell();
  }
  const monthSelect = () => `<select id="monthSel" style="width:auto">${Data.recentMonths().map((m) => `<option ${m === month ? 'selected' : ''}>${m}</option>`).join('')}</select>`;
  function bindMonth() { const m = $('#monthSel'); if (m) m.onchange = () => { month = m.value; render(); }; }
  const loading = () => { app.innerHTML = shell(`<div class="center muted" style="padding:3rem">${t('loading')}</div>`); bindShell(); };

  function progressCard(st) {
    const ti = st.tier; let prog = 100, txt = t('reached_top');
    if (ti.next) {
      const base = ti.tiers[ti.idx].kwh;
      prog = Math.max(2, Math.min(100, ((st.kwh - base) / (ti.next.kwh - base)) * 100));
      txt = `${t('next_tier')}: ${num(ti.next.kwh)} ${t('kwh')} → ${ti.next.pct}% · ${t('need_more')} ${num(Math.max(0, ti.next.kwh - st.kwh), 1)} ${t('kwh')}`;
    }
    return `<div class="bar"><i style="width:${prog}%"></i></div><div class="muted">${txt}</div>`;
  }
  function tiersList(st) {
    return `<div class="tiers">${st.tier.tiers.map((x, i) => `<div class="tier ${i === st.tier.idx ? 'on' : i < st.tier.idx ? 'done' : ''}">
      <span>${i === 0 ? t('tier_base', { k: num(x.kwh) }) : t('tier_row', { k: num(x.kwh) })}</span><b>${x.pct}%</b></div>`).join('')}</div>`;
  }
  const groupAvatar = (g) => `<div class="avatar">${g.logo ? `<img src="${g.logo}" alt="">` : esc(initials(g.name))}</div>`;

  // ---------- QR helpers ----------
  function drawQR(canvas, text, { title } = {}) {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), cell = 10, pad = 30, head = title ? 70 : 0, W = n * cell + pad * 2, H = W + head;
    canvas.width = W; canvas.height = H; const x = canvas.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    if (title) { x.fillStyle = '#1f4d22'; x.font = 'bold 30px Tahoma, sans-serif'; x.textAlign = 'center'; x.fillText(title, W / 2, 46); }
    x.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect(pad + c * cell, head + r * cell, cell, cell);
  }
  const groupURL = (id) => location.href.split('#')[0].replace(/\?.*$/, '') + '#/g/' + id;

  // ---------- login ----------
  function viewLogin() {
    let role = pending && pending.startsWith('#/g/') ? 'staff' : 'captain';
    const draw = () => {
      app.innerHTML = shell(`<div class="login">
        <img class="logo" src="img/logo-full.png" alt="Smart Energy">
        <p class="center muted">${t('tagline')}</p>
        <div class="tabs">${['captain', 'staff', 'admin'].map((r) => `<button data-r="${r}" class="${r === role ? 'on' : ''}">${t('role_' + r)}</button>`).join('')}</div>
        <div class="card">
          ${pending && role === 'staff' ? `<div class="warn">${t('login_staff_first')}</div>` : ''}
          <form id="lf">
            ${role === 'captain' ? `<p class="muted" style="margin-top:0">${t('login_hint_captain')}</p><label>${t('phone')}</label><input type="tel" id="f1" inputmode="tel" autocomplete="tel" placeholder="07XXXXXXXX" class="ltr">
              <label>${t('auth_code')}</label><input type="text" id="f2" inputmode="numeric" maxlength="6" class="codeinput" autocomplete="one-time-code">` : ''}
            ${role === 'staff' ? `<label>${t('code6')}</label><input type="password" id="f1" inputmode="numeric" maxlength="6" class="codeinput" autocomplete="off">` : ''}
            ${role === 'admin' ? `<label>${t('email')}</label><input type="text" id="f1" inputmode="email" autocomplete="username" class="ltr"><label>${t('password')}</label><input type="password" id="f2" autocomplete="current-password">` : ''}
            <div class="err" id="err"></div>
            <button class="btn primary block big" style="margin-top:1rem">${t('enter')}</button>
          </form>
          ${role === 'captain' ? `<button class="btn block" id="actBtn" style="margin-top:.75rem">${t('activate_first')}</button>` : ''}
        </div></div>`);
      bindShell();
      app.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => { role = b.dataset.r; draw(); });
      const ab = $('#actBtn'); if (ab) ab.onclick = activationFlow;
      const form = $('#lf'), sub = form.querySelector('button.primary');
      form.onsubmit = (e) => { e.preventDefault(); safe(sub, async () => {
        const v1 = $('#f1').value.trim(), v2 = $('#f2') ? $('#f2').value.trim() : '', err = $('#err'); err.textContent = '';
        try {
          if (role === 'admin') {
            await FB.signInWithEmailAndPassword(FB.auth, v1, v2);
            try { await Data.fn('adminClaim'); await FB.auth.currentUser.getIdToken(true); }
            catch (e2) { await FB.signOut(FB.auth); throw e2; }
          } else if (role === 'staff') {
            await FB.signInWithCustomToken(FB.auth, (await Data.fn('staffLogin', { code: v1 })).token);
          } else {
            await FB.signInWithCustomToken(FB.auth, (await Data.fn('captainLogin', { phone: v1, code: v2 })).token);
          }
        } catch (e) { err.textContent = e.code && e.code.startsWith('auth/') ? t('err_bad_credentials') : errMsg(e); return; }
        await afterLogin();
      })(); };
    };
    draw();
  }
  async function afterLogin() {
    await refreshSess(); if (!sess) return; await Data.loadSettings(); month = Data.nowMonth(); startNotif();
    const p = pending; pending = null; go(p || homeOf());
  }

  function activationFlow() {
    modal(`<h3>${t('activation_title')}</h3><div id="step"></div>`, (m, close) => {
      const step = $('#step', m);
      const s1 = () => {
        step.innerHTML = `<label>${t('phone')}</label><input type="tel" id="p" inputmode="tel" class="ltr" placeholder="07XXXXXXXX">
          <label>${t('activation_code')}</label><input type="text" id="a" inputmode="numeric" maxlength="8" class="codeinput" style="letter-spacing:.3em">
          <div class="err" id="e"></div><div class="row" style="margin-top:1rem"><button class="btn primary" id="ok" style="flex:1">${t('next')}</button><button class="btn" data-close>${t('cancel')}</button></div>`;
        step.querySelector('[data-close]').onclick = close;
        const ok = $('#ok', step);
        ok.onclick = safe(ok, async () => {
          const phone = $('#p', step).value, act = $('#a', step).value.trim();
          try { const r = await Data.fn('captainEnrollStart', { phone, activation: act }); s2(phone, act, r); }
          catch (e) { $('#e', step).textContent = errMsg(e); }
        });
      };
      const s2 = (phone, act, r) => {
        step.innerHTML = `<p class="muted">${t('activate_scan')}</p><div class="qrbox"><canvas id="aq" style="width:220px"></canvas></div>
          <div class="muted center">${t('activate_secret')}:<br><b class="ltr" style="word-break:break-all;user-select:all">${r.secret}</b></div>
          <label>${t('activate_confirm')}</label><input type="text" id="c" inputmode="numeric" maxlength="6" class="codeinput" autocomplete="one-time-code">
          <div class="err" id="e"></div><div class="row" style="margin-top:1rem"><button class="btn primary" id="ok" style="flex:1">${t('confirm')}</button><button class="btn" data-close>${t('cancel')}</button></div>`;
        drawQR($('#aq', step), r.uri); step.querySelector('[data-close]').onclick = close;
        const ok = $('#ok', step);
        ok.onclick = safe(ok, async () => {
          try {
            const res = await Data.fn('captainEnrollFinish', { phone, activation: act, code: $('#c', step).value.trim() });
            await FB.signInWithCustomToken(FB.auth, res.token); close(); toast(t('activated')); await afterLogin();
          } catch (e) { $('#e', step).textContent = errMsg(e); }
        });
      };
      s1();
    });
  }

  // ---------- captain ----------
  async function viewCaptain() {
    loading();
    const [cap, group] = await Promise.all([Data.captain(sess.captainId), Data.group(sess.groupId)]);
    if (!cap || !group) { await FB.signOut(FB.auth); sess = null; return go('#/login'); }
    const [stDoc, hist, payout] = await Promise.all([Data.stats(group.id, month), Data.chargesCaptain(cap.phone, month), Data.payout(group.id, month)]);
    const gs = Data.groupStats(group, stDoc), me = Data.captainShare(stDoc, cap.phone, gs.pct);
    app.innerHTML = shell(`
      <div class="row between"><div class="row">${groupAvatar(group)}<div><h2 style="margin:0">${t('welcome')} ${esc(cap.name)}${cap.isManager ? ' ⭐' : ''}</h2><div class="muted">${esc(group.name)}</div></div></div>${monthSelect()}</div>
      ${payout ? `<div class="card" style="margin-top:1rem;border:2px solid var(--green)"><div class="row between"><b>✅ ${t('payout_paid')} — ${money(payout.amount)}</b><span class="muted">${fmtDate(payout.paidAt)}</span></div>${payout.note ? `<div class="muted">${t('note')}: ${esc(payout.note)}</div>` : ''}</div>` : ''}
      <div class="grid g2" style="margin:1rem 0">
        <div class="stat hl"><div class="v">${num(me.kwh, 1)}</div><div class="l">${t('my_kwh')} (${t('kwh')})</div></div>
        <div class="stat"><div class="v">${num(gs.kwh, 1)}</div><div class="l">${t('group_kwh')} (${t('kwh')})</div></div>
        <div class="stat"><div class="v pct">${gs.pct}%</div><div class="l">${t('cashback_pct')}</div></div>
        ${cap.isManager ? `<div class="stat"><div class="v">${money(gs.cashback)}</div><div class="l">${t('manager_cashback')}</div></div>`
          : `<div class="stat"><div class="v">${money(me.cashback)}</div><div class="l">${t('my_share')}</div></div>`}
      </div>
      <div class="card">${progressCard(gs)}</div>
      <div class="card"><h3>${t('tiers_title')}</h3>${tiersList(gs)}</div>
      <div class="card"><h3>${t('history')}</h3>${hist.length ? `<div class="tablewrap"><table><tr><th>${t('date')}</th><th>${t('kwh')}</th><th>${t('amount')}</th></tr>
        ${hist.map((c) => `<tr><td>${fmtDate(c.tsMs)}</td><td>${num(c.kwh, 1)}</td><td>${money(c.amount)}</td></tr>`).join('')}</table></div>` : `<div class="muted">${t('no_data')}</div>`}</div>`);
    bindShell(); bindMonth();
  }

  function viewNotifications() {
    localStorage.setItem(seenKey(), String(Date.now()));
    app.innerHTML = shell(`<h2>🔔 ${t('notifications')}</h2><div class="card">${notifs.length ? `<ul class="list">${notifs.map((n) => { const x = notifText(n); return `<li class="item"><div class="grow"><div class="t">${esc(x.title)}</div><div style="white-space:pre-line">${esc(x.body)}</div><div class="s">${fmtDate(n.tsMs)}</div></div></li>`; }).join('')}</ul>` : `<div class="muted center">${t('no_notifications')}</div>`}</div>
      <a class="btn" href="#/captain">${t('back')}</a>`);
    bindShell();
  }

  // ---------- staff ----------
  let scanStream = null, scanRaf = null;
  function stopScan() { cancelAnimationFrame(scanRaf); if (scanStream) scanStream.getTracks().forEach((x) => x.stop()); scanStream = null; }
  async function viewStaff() {
    loading();
    const groups = await Data.groups();
    app.innerHTML = shell(`
      <div class="card center"><h2>${t('scan_title')}</h2><p class="muted">${t('scan_hint')}</p>
        <div id="scanArea"></div><button class="btn primary big block" id="camBtn">${t('start_camera')}</button><div class="err" id="camErr"></div></div>
      <div class="card"><h3>${t('scan_or_pick')}</h3><input type="search" id="gsearch" placeholder="${t('search')}"><ul class="list" id="glist"></ul></div>`);
    bindShell();
    const drawList = () => {
      const qs = $('#gsearch').value.trim().toLowerCase();
      const gs = groups.filter((g) => g.name.toLowerCase().includes(qs));
      $('#glist').innerHTML = gs.length ? gs.map((g) => `<li class="item clickable" data-g="${g.id}">${groupAvatar(g)}<div class="grow"><div class="t">${esc(g.name)}</div><div class="s">${esc(g.managerName)}</div></div></li>`).join('') : `<li class="muted">${t('no_data')}</li>`;
      $('#glist').querySelectorAll('[data-g]').forEach((li) => li.onclick = () => go('#/g/' + li.dataset.g));
    };
    $('#gsearch').oninput = drawList; drawList();
    const handle = (txt) => { const m = String(txt).match(/#\/g\/([\w-]+)/); if (m) { stopScan(); go('#/g/' + m[1]); return true; } return false; };
    $('#camBtn').onclick = async () => {
      if (scanStream) { stopScan(); $('#scanArea').innerHTML = ''; $('#camBtn').textContent = t('start_camera'); return; }
      try {
        scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        $('#scanArea').innerHTML = '<div class="scanbox"><video playsinline muted></video></div>';
        const v = $('#scanArea video'); v.srcObject = scanStream; await v.play();
        $('#camBtn').textContent = t('stop_camera');
        const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
        const tick = () => {
          if (!scanStream) return;
          if (v.readyState === v.HAVE_ENOUGH_DATA) {
            cv.width = v.videoWidth; cv.height = v.videoHeight; cx.drawImage(v, 0, 0);
            const r = jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height);
            if (r && handle(r.data)) return;
          }
          scanRaf = requestAnimationFrame(tick);
        };
        tick();
      } catch { $('#camErr').textContent = t('camera_fail'); }
    };
  }

  const activationModal = (name, code, next) => modal(`<div class="center"><h3>${t('act_title')}</h3><div class="muted">${t('act_for')}: <b>${esc(name)}</b></div>
    <div style="font-size:2.4rem;font-weight:800;letter-spacing:.25em;color:var(--green-d);margin:.6rem 0" class="ltr">${code}</div><p class="muted">${t('act_hint')}</p>
    <button class="btn primary block" id="go">${next ? t('next') : t('close')}</button></div>`, (m, close) => { $('#go', m).onclick = () => { close(); if (next) next(); }; });

  async function viewStaffGroup(groupId) {
    loading();
    const m = Data.nowMonth(), group = await Data.group(groupId).catch(() => null);
    if (!group) { app.innerHTML = shell(`<div class="card center">${t('group_not_found')}<br><br><a class="btn" href="#/staff">${t('back')}</a></div>`); return bindShell(); }
    const [stDoc, caps, charges] = await Promise.all([Data.stats(groupId, m), Data.captains(groupId), Data.chargesGroup(groupId, m)]);
    caps.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const gs = Data.groupStats(group, stDoc), recent = charges.slice(0, 6);
    app.innerHTML = shell(`
      <div class="row between"><div class="row">${groupAvatar(group)}<div><h2 style="margin:0">${esc(group.name)}</h2><div class="muted">${t('price_now')}: ${Data.priceAt()} ${t('per_kwh')}</div></div></div><a class="btn sm" href="#/staff">${t('back')}</a></div>
      <div class="grid g2" style="margin:1rem 0"><div class="stat hl"><div class="v">${num(gs.kwh, 1)}</div><div class="l">${t('total_kwh')}</div></div><div class="stat"><div class="v pct">${gs.pct}%</div><div class="l">${t('cashback_pct')}</div></div></div>
      <div class="card">${progressCard(gs)}</div>
      <div class="grid g2"><button class="btn primary big" id="newCap">＋ ${t('new_captain')}</button><button class="btn yellow big" id="pickCap">${t('pick_captain')}</button></div>
      <div class="card" style="margin-top:1rem"><h3>${t('recent_charges')}</h3>${recent.length ? `<ul class="list">${recent.map((c) => `<li class="item"><div class="grow"><div class="t">${esc(c.captainName)}</div><div class="s">${fmtDate(c.tsMs)}</div></div><b>${num(c.kwh, 1)} ${t('kwh')}</b></li>`).join('')}</ul>` : `<div class="muted">${t('no_data')}</div>`}</div>`);
    bindShell();

    const chargeForm = (cap) => modal(`<div class="row"><div class="avatar">${esc(initials(cap.name))}</div><div><h3 style="margin:0">${esc(cap.name)}</h3><div class="muted ltr">${esc(cap.phone)}</div></div></div>
      <label>${t('charge_kwh')}</label><input type="number" id="kwh" inputmode="decimal" step="0.1" min="0" style="font-size:1.6rem;text-align:center">
      <div class="muted" id="est"></div><div class="err" id="e"></div>
      <div class="row" style="margin-top:1rem"><button class="btn primary" id="ok" style="flex:1">${t('add_charge')}</button><button class="btn" data-close>${t('cancel')}</button></div>`, (mm, close) => {
      const inp = $('#kwh', mm), p = Data.priceAt();
      inp.oninput = () => { $('#est', mm).textContent = inp.value > 0 ? `${t('est_amount')}: ${money(inp.value * p)} (${p} ${t('per_kwh')})` : ''; };
      setTimeout(() => inp.focus(), 50);
      const ok = $('#ok', mm);
      ok.onclick = safe(ok, async () => {
        const v = parseFloat(inp.value); if (!(v > 0) || v > 300) return ($('#e', mm).textContent = t('err_bad_kwh'));
        try { await Data.write('addCharge', { captainPhone: cap.phone, kwh: v }); close(); toast(`${t('charge_saved')}: ${cap.name} – ${num(v, 1)} ${t('kwh')}`); render(); }
        catch (e) { $('#e', mm).textContent = errMsg(e); }
      });
    });

    $('#pickCap').onclick = () => modal(`<h3>${t('captains')}</h3><input type="search" id="cs" placeholder="${t('search')}"><ul class="list" id="cl"></ul><button class="btn block" data-close>${t('close')}</button>`, (mm, close) => {
      const draw = () => {
        const qs = $('#cs', mm).value.trim().toLowerCase();
        const f = caps.filter((c) => c.name.toLowerCase().includes(qs) || c.phone.includes(qs));
        $('#cl', mm).innerHTML = f.length ? f.map((c) => `<li class="item clickable" data-c="${c.phone}"><div class="avatar">${esc(initials(c.name))}</div><div class="grow"><div class="t">${esc(c.name)}</div><div class="s ltr">${esc(c.phone)}</div></div></li>`).join('') : `<li class="muted">${t('no_captains')}</li>`;
        $('#cl', mm).querySelectorAll('[data-c]').forEach((li) => li.onclick = () => { close(); chargeForm(caps.find((c) => c.phone === li.dataset.c)); });
      };
      $('#cs', mm).oninput = draw; draw();
    });

    $('#newCap').onclick = () => modal(`<h3>${t('new_captain')}</h3>
      <label>${t('name')}</label><input type="text" id="n"><label>${t('phone')}</label><input type="tel" id="p" inputmode="tel" class="ltr" placeholder="07XXXXXXXX"><div class="muted">${t('phone_hint')}</div>
      <div id="dup"></div><div class="err" id="e"></div>
      <div class="row" style="margin-top:1rem"><button class="btn primary" id="ok" style="flex:1">${t('add')}</button><button class="btn" data-close>${t('cancel')}</button></div>`, (mm, close) => {
      const ok = $('#ok', mm);
      ok.onclick = safe(ok, async () => {
        const n = $('#n', mm).value.trim(), p = $('#p', mm).value, e = $('#e', mm); e.textContent = ''; $('#dup', mm).innerHTML = '';
        if (!n) return (e.textContent = t('name_required'));
        if (!Data.validPhone(p)) return (e.textContent = t('invalid_phone'));
        try {
          const r = await Data.write('addCaptain', { groupId, name: n, phone: p });
          close(); toast(t('captain_added')); const c = { phone: r.phone, name: n };
          activationModal(n, r.activation, () => chargeForm(c));
        } catch (er) {
          if (er.code === 'already-exists' && er.details) {
            const d = er.details;
            if (d.sameGroup) {
              $('#dup', mm).innerHTML = `<div class="warn">⚠️ ${t('captain_exists')} <b>${esc(d.name)}</b><br><button class="btn sm yellow" id="useEx" style="margin-top:.5rem">${t('use_existing')}</button></div>`;
              $('#useEx', mm).onclick = () => { close(); chargeForm({ phone: d.phone, name: d.name }); };
            } else $('#dup', mm).innerHTML = `<div class="warn" style="border-color:var(--danger)">⛔ ${t('captain_other_group', { g: esc(d.groupName || '?') })}</div>`;
          } else e.textContent = errMsg(er);
        }
      });
    });
  }

  // ---------- admin ----------
  const TABS = ['dash', 'groups', 'staff', 'audit', 'settings'];
  const adminNav = (tab) => `<nav class="nav no-print">${TABS.map((x) => `<a href="#/admin/${x}" class="${x === tab ? 'on' : ''}">${t('nav_' + x)}</a>`).join('')}</nav>`;
  async function viewAdmin(tab, arg) {
    loading();
    if (tab === 'groups' && arg) return adminGroup(arg);
    return ({ dash: adminDash, groups: adminGroups, staff: adminStaff, audit: adminAudit, settings: adminSettings }[tab] || adminDash)();
  }
  const toCSV = (rows) => '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  function download(name, content, type = 'text/csv;charset=utf-8') {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const payBadge = (p) => (p ? `<span class="badge">✅ ${t('payout_paid')}</span>` : `<span class="badge off">${t('payout_pending')}</span>`);

  async function adminDash() {
    const [groups, stats, payouts, caps] = await Promise.all([Data.groups(), Data.statsMonth(month), Data.payoutsMonth(month), FB.getDocs(FB.collection(FB.db, 'captains'))]);
    const sm = Object.fromEntries(stats.map((s) => [s.groupId, s])), pm = Object.fromEntries(payouts.map((p) => [p.groupId, p]));
    const rows = groups.map((g) => ({ g, st: Data.groupStats(g, sm[g.id]), po: pm[g.id] })).sort((a, b) => b.st.kwh - a.st.kwh);
    const sum = (f) => rows.reduce((s, r) => s + f(r), 0), totalKwh = sum((r) => r.st.kwh);
    const days = new Date(+month.slice(0, 4), +month.slice(5), 0).getDate(), daily = new Array(days).fill(0);
    const monthCharges = await q_charges(month); monthCharges.forEach((c) => { daily[+new Date(c.tsMs).toLocaleString('en-GB', { day: 'numeric', timeZone: Data.settings.timezone }) - 1] += c.kwh; });
    const mx = Math.max(1, ...daily);
    app.innerHTML = shell(`
      <div class="row between"><h2>${t('nav_dash')}</h2>${monthSelect()}</div>
      <div class="grid g2">
        <div class="stat hl"><div class="v">${num(totalKwh, 1)}</div><div class="l">${t('total_kwh')}</div></div>
        <div class="stat"><div class="v">${money(sum((r) => r.st.sales))}</div><div class="l">${t('sales')}</div></div>
        <div class="stat"><div class="v">${money(sum((r) => r.st.cashback))}</div><div class="l">${t('cashback')}</div></div>
        <div class="stat"><div class="v">${groups.length} / ${caps.size}</div><div class="l">${t('groups_count')} / ${t('captains_count')}</div></div>
      </div>
      <div class="card" style="margin-top:1rem"><h3>${t('daily_chart')}</h3>
        <div class="chart">${daily.map((v, i) => `<div style="height:${(v / mx) * 100}%" title="${i + 1}: ${num(v, 1)}"></div>`).join('')}</div><div class="chartx"><span>1</span><span>${days}</span></div></div>
      <div class="card"><div class="row between"><h3>${t('top_groups')}</h3><button class="btn sm" id="csv">${t('export_csv')}</button></div>
        ${rows.length ? `<div class="tablewrap"><table><tr><th>${t('group_name')}</th><th>${t('kwh')}</th><th>%</th><th>${t('sales')}</th><th>${t('cashback')}</th><th>${t('payout_status')}</th></tr>
        ${rows.map(({ g, st, po }) => `<tr class="clickable" data-g="${g.id}"><td><b>${esc(g.name)}</b></td><td>${num(st.kwh, 1)}</td><td>${st.pct}%</td><td>${money(st.sales)}</td><td><b>${money(po ? po.amount : st.cashback)}</b></td><td>${payBadge(po)}</td></tr>`).join('')}</table></div>` : `<div class="muted">${t('no_groups')}</div>`}</div>`, { nav: adminNav('dash') });
    bindShell(); bindMonth();
    app.querySelectorAll('[data-g]').forEach((r) => r.onclick = () => go('#/admin/groups/' + r.dataset.g));
    $('#csv').onclick = () => download(`cashback-${month}.csv`, toCSV([[t('group_name'), t('manager'), 'kWh', '%', t('sales'), t('cashback'), t('payout_status')],
      ...rows.map(({ g, st, po }) => [g.name, g.managerName + ' ' + g.managerPhone, st.kwh, st.pct, st.sales, po ? po.amount : st.cashback, po ? t('payout_paid') : t('payout_pending')])]));
  }
  const q_charges = (m) => FB.getDocs(FB.query(FB.collection(FB.db, 'charges'), FB.where('month', '==', m))).then((s) => s.docs.map((d) => d.data()));

  function readLogo(file, cb) {
    if (!file) return cb('');
    const img = new Image(), fr = new FileReader();
    fr.onload = () => { img.onload = () => { const s = 160, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'); const m = Math.min(img.width, img.height); x.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s); cb(c.toDataURL('image/jpeg', .8)); }; img.src = fr.result; };
    fr.readAsDataURL(file);
  }

  async function adminGroups() {
    const [groups, stats] = await Promise.all([Data.groups(), Data.statsMonth(month)]);
    const sm = Object.fromEntries(stats.map((s) => [s.groupId, s]));
    app.innerHTML = shell(`<div class="row between"><h2>${t('nav_groups')}</h2><button class="btn primary" id="addG">＋ ${t('add_group')}</button></div>
      <div class="card">${groups.length ? `<ul class="list">${groups.map((g) => { const st = Data.groupStats(g, sm[g.id]); return `<li class="item clickable" data-g="${g.id}">${groupAvatar(g)}<div class="grow"><div class="t">${esc(g.name)}</div><div class="s">${esc(g.managerName)} · <span class="ltr">${esc(g.managerPhone)}</span></div></div><div><b>${num(st.kwh, 0)}</b> <span class="muted">${t('kwh')}</span><br><span class="badge">${st.pct}%</span></div></li>`; }).join('')}</ul>` : `<div class="muted center">${t('no_groups')}</div>`}</div>`, { nav: adminNav('groups') });
    bindShell();
    app.querySelectorAll('[data-g]').forEach((r) => r.onclick = () => go('#/admin/groups/' + r.dataset.g));
    $('#addG').onclick = () => modal(`<h3>${t('add_group')}</h3>
      <label>${t('group_name')}</label><input type="text" id="gn"><label>${t('manager_name')}</label><input type="text" id="mn">
      <label>${t('manager_phone')}</label><input type="tel" id="mp" class="ltr" placeholder="07XXXXXXXX"><label>${t('logo')}</label><input type="file" id="lg" accept="image/*">
      <div class="err" id="e"></div><div class="row" style="margin-top:1rem"><button class="btn primary" id="ok" style="flex:1">${t('save')}</button><button class="btn" data-close>${t('cancel')}</button></div>`, (mm, close) => {
      const ok = $('#ok', mm);
      ok.onclick = safe(ok, async () => {
        const gn = $('#gn', mm).value.trim(), mn = $('#mn', mm).value.trim(), mp = $('#mp', mm).value;
        if (!gn || !mn) return ($('#e', mm).textContent = t('name_required'));
        if (!Data.validPhone(mp)) return ($('#e', mm).textContent = t('invalid_phone'));
        const logo = await new Promise((res) => readLogo($('#lg', mm).files[0], res));
        try {
          const r = await Data.write('createGroup', { name: gn, managerName: mn, managerPhone: mp, logo }); close(); toast(t('group_saved'));
          activationModal(mn, r.activation, () => go('#/admin/groups/' + r.groupId));
        } catch (e) { $('#e', mm).textContent = errMsg(e); }
      });
    });
  }

  async function adminGroup(id) {
    const group = await Data.group(id).catch(() => null);
    if (!group) return go('#/admin/groups');
    const [stDoc, caps, charges, payout] = await Promise.all([Data.stats(id, month), Data.captains(id), Data.chargesGroup(id, month), Data.payout(id, month)]);
    const gs = Data.groupStats(group, stDoc);
    const members = caps.map((c) => ({ c, s: Data.captainShare(stDoc, c.phone, gs.pct) })).sort((a, b) => b.s.kwh - a.s.kwh);
    const ended = month < Data.nowMonth();
    app.innerHTML = shell(`
      <div class="row between"><div class="row">${groupAvatar(group)}<div><h2 style="margin:0">${esc(group.name)}</h2><div class="muted">${esc(group.managerName)} · <span class="ltr">${esc(group.managerPhone)}</span></div></div></div>
        <div class="row">${monthSelect()}<a class="btn sm" href="#/admin/groups">${t('back')}</a></div></div>
      <div class="grid g2" style="margin:1rem 0">
        <div class="stat hl"><div class="v">${num(gs.kwh, 1)}</div><div class="l">${t('total_kwh')}</div></div>
        <div class="stat"><div class="v pct">${gs.pct}%</div><div class="l">${t('cashback_pct')}</div></div>
        <div class="stat"><div class="v">${money(gs.sales)}</div><div class="l">${t('sales')}</div></div>
        <div class="stat"><div class="v">${money(gs.cashback)}</div><div class="l">${t('cashback')}</div></div></div>
      <div class="card">${progressCard(gs)}</div>
      <div class="card" style="border:2px solid ${payout ? 'var(--green)' : 'var(--line)'}"><h3>${t('payout_title')} · ${month}</h3>
        <div class="muted">${t('payout_to_manager')}: <b>${esc(group.managerName)}</b> <span class="ltr">${esc(group.managerPhone)}</span></div>
        ${payout ? `<p>${payBadge(payout)} <b>${t('deposited_amount')}: ${money(payout.amount)}</b> (${payout.pct}%)<br><span class="muted">${fmtDate(payout.paidAt)} · ${t('paid_by')} ${esc(payout.paidBy)}</span>${payout.note ? `<br>${t('note')}: ${esc(payout.note)}` : ''}</p><button class="btn danger sm" id="undoPay">${t('undo_payout')}</button>`
          : ended ? `<p>${payBadge(null)} · ${money(gs.cashback)}</p><button class="btn primary" id="markPay">💰 ${t('mark_paid')}</button>` : `<p class="muted">${t('month_not_ended_hint')}</p>`}</div>
      <div class="card"><h3>${t('members')} (${caps.length})</h3><div class="tablewrap"><table><tr><th>${t('name')}</th><th>${t('phone')}</th><th></th><th>${t('kwh')}</th><th>${t('share')}</th><th></th></tr>
        ${members.map(({ c, s }) => `<tr><td>${esc(c.name)}${c.isManager ? ' ⭐' : ''}</td><td class="ltr">${esc(c.phone)}</td><td><span class="badge ${c.enrolled ? '' : 'off'}">${c.enrolled ? t('enrolled') : t('not_enrolled')}</span></td><td>${num(s.kwh, 1)}</td><td>${money(s.cashback)}</td>
          <td style="white-space:nowrap"><button class="btn sm" data-rs="${c.phone}" title="${t('reset_captain')}">🔑</button> ${c.isManager ? '' : `<button class="btn danger sm" data-dc="${c.phone}">✕</button>`}</td></tr>`).join('')}</table></div></div>
      <div class="card"><h3>${t('history')}</h3>${charges.length ? `<div class="tablewrap"><table><tr><th>${t('date')}</th><th>${t('name')}</th><th>${t('kwh')}</th><th>${t('amount')}</th><th>${t('staff')}</th><th></th></tr>
        ${charges.slice(0, 60).map((c) => `<tr><td>${fmtDate(c.tsMs)}</td><td>${esc(c.captainName)}</td><td>${num(c.kwh, 1)}</td><td>${money(c.amount)}</td><td>${esc(c.staffName || '-')}</td><td><button class="btn danger sm" data-dch="${c.id}">✕</button></td></tr>`).join('')}</table></div>` : `<div class="muted">${t('no_data')}</div>`}</div>
      <div class="card"><h3>${t('group_tiers')}</h3><label style="margin:0"><input type="checkbox" id="custT" ${group.tiers ? 'checked' : ''}> ${t('custom_tiers')}</label>
        <div id="tEd" class="${group.tiers ? '' : 'hide'}" style="margin-top:.5rem"></div><div class="muted" style="margin-top:.4rem">${group.tiers ? '' : t('use_default_tiers')}</div></div>
      <div class="card qrbox"><h3>${t('qr_code')}</h3><canvas id="qr" style="width:260px"></canvas><p class="muted">${t('qr_hint')}</p>
        <div class="row no-print" style="justify-content:center"><button class="btn primary" id="dl">${t('download_qr')}</button><button class="btn" id="pr">${t('print')}</button><button class="btn" id="cp">${t('copy_link')}</button></div></div>
      <div class="row no-print"><button class="btn" id="eg">${t('edit')}</button><button class="btn danger" id="dg">${t('delete')}</button></div>`, { nav: adminNav('groups') });
    bindShell(); bindMonth(); drawQR($('#qr'), groupURL(id), { title: group.name });
    $('#dl').onclick = () => { const a = document.createElement('a'); a.href = $('#qr').toDataURL('image/png'); a.download = `qr-${group.name}.png`; a.click(); };
    $('#pr').onclick = () => window.print();
    $('#cp').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(groupURL(id)); toast(t('copied')); };
    const mutate = (action, data, after) => async () => { try { const r = await Data.write(action, data); if (after) after(r); else render(); } catch (e) { toast(errMsg(e), true); } };

    const mp = $('#markPay'); if (mp) mp.onclick = () => modal(`<h3>💰 ${t('mark_paid')}</h3><p>${month} · <b>${esc(group.managerName)}</b> <span class="ltr">${esc(group.managerPhone)}</span><br>${t('deposited_amount')}: <b>${money(gs.cashback)}</b> (${gs.pct}%)</p>
      <label>${t('payout_note')}</label><input type="text" id="nt" maxlength="500"><div class="muted">${t('payout_note_hint')}</div><div class="err" id="e"></div>
      <div class="row" style="margin-top:1rem"><button class="btn primary" id="ok" style="flex:1">${t('confirm')}</button><button class="btn" data-close>${t('cancel')}</button></div>`, (m, close) => {
      const ok = $('#ok', m);
      ok.onclick = safe(ok, async () => { try { await Data.write('markPayout', { groupId: id, month, note: $('#nt', m).value }); close(); render(); } catch (e) { $('#e', m).textContent = errMsg(e); } });
    });
    const up = $('#undoPay'); if (up) up.onclick = () => confirmBox(t('undo_q'), mutate('unmarkPayout', { groupId: id, month }));
    app.querySelectorAll('[data-dc]').forEach((b) => b.onclick = () => confirmBox(t('delete_captain_q'), mutate('deleteCaptain', { phone: b.dataset.dc })));
    app.querySelectorAll('[data-rs]').forEach((b) => b.onclick = () => confirmBox(t('reset_q'), mutate('resetCaptain', { phone: b.dataset.rs }, (r) => { const c = caps.find((x) => x.phone === b.dataset.rs); activationModal(c.name, r.activation, null); render(); })));
    app.querySelectorAll('[data-dch]').forEach((b) => b.onclick = () => confirmBox(t('delete_charge_q'), mutate('deleteCharge', { chargeId: b.dataset.dch })));
    $('#dg').onclick = () => confirmBox(t('delete_group_q'), mutate('deleteGroup', { groupId: id }, () => go('#/admin/groups')));
    $('#eg').onclick = () => modal(`<h3>${t('edit')}</h3><label>${t('group_name')}</label><input type="text" id="gn" value="${esc(group.name)}"><label>${t('manager_name')}</label><input type="text" id="mn" value="${esc(group.managerName)}">
      <label>${t('logo')}</label><input type="file" id="lg" accept="image/*"><div class="err" id="e"></div>
      <div class="row" style="margin-top:1rem"><button class="btn primary" id="ok" style="flex:1">${t('save')}</button><button class="btn" data-close>${t('cancel')}</button></div>`, (mm, close) => {
      const ok = $('#ok', mm);
      ok.onclick = safe(ok, async () => {
        const gn = $('#gn', mm).value.trim(), mn = $('#mn', mm).value.trim(); if (!gn || !mn) return ($('#e', mm).textContent = t('name_required'));
        const logo = await new Promise((res) => readLogo($('#lg', mm).files[0], res));
        try { await Data.write('updateGroup', { groupId: id, name: gn, managerName: mn, logo: logo || undefined }); close(); toast(t('group_saved')); render(); } catch (e) { $('#e', mm).textContent = errMsg(e); }
      });
    });
    const tEd = $('#tEd');
    $('#custT').onchange = async (e) => { try { await Data.write('updateGroup', { groupId: id, tiers: e.target.checked ? Data.tiersFor(null).map((x) => ({ ...x })) : null }); render(); } catch (er) { toast(errMsg(er), true); } };
    if (group.tiers) { tEd.innerHTML = tierEditorHTML(group.tiers); wireTierEditor(tEd, (l) => mutate('updateGroup', { groupId: id, tiers: l }, () => { toast(t('settings_saved')); render(); })()); }
  }

  function tierEditorHTML(list) {
    return `<div class="tablewrap"><table><tr><th>${t('tier_kwh')}</th><th>${t('tier_pct')}</th><th></th></tr>
      ${list.map((x) => `<tr><td><input type="number" class="tk" value="${x.kwh}" min="0"></td><td><input type="number" class="tp" value="${x.pct}" min="0" max="100" step="0.5"></td><td><button class="btn danger sm rm">✕</button></td></tr>`).join('')}</table></div>
      <div class="row" style="margin-top:.5rem"><button class="btn sm add">＋ ${t('add_tier')}</button><button class="btn primary sm sv">${t('save')}</button></div>`;
  }
  function wireTierEditor(root, onSave) {
    const read = () => [...root.querySelectorAll('tr')].slice(1).map((tr) => ({ kwh: parseFloat(tr.querySelector('.tk').value), pct: parseFloat(tr.querySelector('.tp').value) })).filter((x) => x.kwh >= 0 && x.pct >= 0);
    const redraw = (l) => { root.innerHTML = tierEditorHTML(l); wireTierEditor(root, onSave); };
    root.querySelectorAll('.rm').forEach((b, i) => b.onclick = () => { const l = read(); l.splice(i, 1); redraw(l); });
    root.querySelector('.add').onclick = () => { const l = read(), last = l[l.length - 1] || { kwh: 0, pct: 0 }; l.push({ kwh: last.kwh + 200, pct: last.pct + 1 }); redraw(l); };
    root.querySelector('.sv').onclick = () => { const l = Data.sortedTiers(read()); if (l.length) onSave(l); };
  }

  async function adminStaff() {
    const staff = await Data.staff();
    app.innerHTML = shell(`<div class="row between"><h2>${t('nav_staff')}</h2><button class="btn primary" id="addS">＋ ${t('staff_add')}</button></div>
      <div class="card">${staff.length ? `<ul class="list">${staff.map((s) => `<li class="item"><div class="avatar">${esc(initials(s.name))}</div><div class="grow"><div class="t">${esc(s.name)} <span class="badge ${s.active ? '' : 'off'}">${s.active ? t('active') : t('disabled')}</span></div><div class="s">${t('code')}: ••••••</div></div>
        <button class="btn sm" data-rg="${s.id}" title="${t('gen_code')}">🔄</button><button class="btn sm" data-tg="${s.id}" title="${t('toggle')}">⏻</button><button class="btn danger sm" data-dl="${s.id}">✕</button></li>`).join('')}</ul>` : `<div class="muted center">${t('no_data')}</div>`}</div>`, { nav: adminNav('staff') });
    bindShell();
    const showCode = (name, code) => modal(`<div class="center"><div class="muted">${t('new_code_for')} ${esc(name)}</div><div style="font-size:2.6rem;font-weight:800;letter-spacing:.3em;color:var(--green-d)" class="ltr">${code}</div><p class="muted">${t('act_hint').split('.')[0]}.</p><button class="btn block" data-close>${t('close')}</button></div>`);
    const act = (fn) => async () => { try { await fn(); } catch (e) { toast(errMsg(e), true); } };
    $('#addS').onclick = () => modal(`<h3>${t('staff_add')}</h3><label>${t('staff_name')}</label><input type="text" id="n"><div class="err" id="e"></div>
      <div class="row" style="margin-top:1rem"><button class="btn primary" id="ok" style="flex:1">${t('add')}</button><button class="btn" data-close>${t('cancel')}</button></div>`, (mm, close) => {
      const ok = $('#ok', mm);
      ok.onclick = safe(ok, async () => { const n = $('#n', mm).value.trim(); if (!n) return ($('#e', mm).textContent = t('name_required')); try { const r = await Data.write('createStaff', { name: n }); close(); await render(); showCode(n, r.code); } catch (e) { $('#e', mm).textContent = errMsg(e); } });
    });
    app.querySelectorAll('[data-rg]').forEach((b) => b.onclick = act(async () => { const r = await Data.write('regenStaff', { staffId: b.dataset.rg }); showCode(staff.find((s) => s.id === b.dataset.rg).name, r.code); }));
    app.querySelectorAll('[data-tg]').forEach((b) => b.onclick = act(async () => { await Data.write('toggleStaff', { staffId: b.dataset.tg }); render(); }));
    app.querySelectorAll('[data-dl]').forEach((b) => b.onclick = () => confirmBox(t('delete') + '?', act(async () => { await Data.write('deleteStaff', { staffId: b.dataset.dl }); render(); })));
  }

  let auditFilter = 'all';
  async function adminAudit() {
    const rows = await Data.audit(200);
    const shown = rows.filter((r) => auditFilter === 'all' || r.actorRole === auditFilter);
    const fmt = (d) => { const s = JSON.stringify(d || {}); return s.length > 220 ? s.slice(0, 220) + '…' : s; };
    app.innerHTML = shell(`<div class="row between"><h2>${t('audit_title')}</h2><div class="tabs" style="margin:0">${['all', 'admin', 'staff', 'captain'].map((f) => `<button data-f="${f}" class="${f === auditFilter ? 'on' : ''}">${t('f_' + f)}</button>`).join('')}</div></div>
      <div class="card"><div class="tablewrap"><table><tr><th>${t('date')}</th><th>${t('actor')}</th><th>${t('action')}</th><th>${t('target')}</th><th>${t('details')}</th></tr>
      ${shown.length ? shown.map((r) => `<tr><td style="white-space:nowrap">${r.ts ? fmtDate(r.ts) : ''}</td><td><span class="badge">${t('role_' + r.actorRole)}</span> ${esc(r.actorName)}</td><td><b>${t('a_' + r.action)}</b></td><td>${esc((r.target && r.target.name) || '')}</td><td class="ltr" style="font-size:.78rem;max-width:320px;word-break:break-all">${esc(fmt(r.details))}</td></tr>`).join('') : `<tr><td colspan="5" class="muted center">${t('no_data')}</td></tr>`}</table></div></div>`, { nav: adminNav('audit') });
    bindShell();
    app.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { auditFilter = b.dataset.f; adminAudit(); });
  }

  async function adminSettings() {
    await Data.loadSettings(); const S = Data.settings;
    app.innerHTML = shell(`<h2>${t('nav_settings')}</h2>
      <div class="card"><h3>${t('tiers_settings')}</h3><div id="tEd">${tierEditorHTML(S.tiers)}</div><p class="muted">${t('tiers_note')}</p></div>
      <div class="card"><h3>${t('prices_settings')}</h3><div id="pEd"></div></div>
      <div class="card"><h3>${t('currency')} / ${t('timezone')}</h3><div class="row"><input type="text" id="cur" value="${esc(S.currency)}" style="max-width:140px"><input type="text" id="tz" value="${esc(S.timezone)}" class="ltr" style="max-width:220px"></div>
        <label>${t('near_tier')}</label><input type="number" id="near" value="${S.nearTierKwh}" min="0" style="max-width:140px"><button class="btn primary sm" id="miscS" style="margin-top:.6rem">${t('save')}</button></div>`, { nav: adminNav('settings') });
    bindShell();
    const save = async (patch) => { try { await Data.write('saveSettings', patch); await Data.loadSettings(); toast(t('settings_saved')); } catch (e) { toast(errMsg(e), true); } };
    wireTierEditor($('#tEd'), (l) => save({ tiers: l }));
    const pEd = $('#pEd');
    const drawP = (list) => {
      pEd.innerHTML = `<div class="tablewrap"><table><tr><th>${t('from')}</th><th>${t('to')}</th><th>${t('price')}</th><th></th></tr>${list.map((p) => `<tr><td><input type="time" class="pf" value="${p.from}"></td><td><input type="time" class="pt" value="${p.to}"></td><td><input type="number" class="pp" step="0.001" min="0" value="${p.price}"></td><td><button class="btn danger sm rm">✕</button></td></tr>`).join('')}</table></div>
        <div class="row" style="margin-top:.5rem"><button class="btn sm add">＋ ${t('add_price')}</button><button class="btn primary sm sv">${t('save')}</button></div>`;
      const read = () => [...pEd.querySelectorAll('tr')].slice(1).map((tr) => ({ from: tr.querySelector('.pf').value, to: tr.querySelector('.pt').value, price: parseFloat(tr.querySelector('.pp').value) })).filter((p) => p.from && p.to && p.price >= 0);
      pEd.querySelectorAll('.rm').forEach((b, i) => b.onclick = () => { const l = read(); l.splice(i, 1); drawP(l); });
      pEd.querySelector('.add').onclick = () => { const l = read(); l.push({ from: '00:00', to: '00:00', price: 0.2 }); drawP(l); };
      pEd.querySelector('.sv').onclick = () => { const l = read(); if (l.length) save({ prices: l }); };
    };
    drawP(S.prices);
    $('#miscS').onclick = () => save({ currency: $('#cur').value.trim(), timezone: $('#tz').value.trim(), nearTierKwh: parseFloat($('#near').value) });
  }

  // ---------- router ----------
  let renderToken = 0;
  async function render() {
    const my = ++renderToken;
    stopScan(); $('#modal-root').innerHTML = '';
    if (!FB.configured) { app.innerHTML = shell(`<div class="card center"><h2>${t('setup_title')}</h2><p>${t('setup_body')}</p></div>`); return bindShell(); }
    const h = location.hash || '#/login', parts = h.replace(/^#\//, '').split('/'), r = parts[0];
    try {
      if (r === 'g') { if (!sess || (sess.role !== 'staff' && sess.role !== 'admin')) { pending = h; return viewLogin(); } return await viewStaffGroup(parts[1]); }
      if (r === 'admin') { if (!sess || sess.role !== 'admin') { pending = h; return viewLogin(); } return await viewAdmin(parts[1] || 'dash', parts[2]); }
      if (r === 'staff') { if (!sess || sess.role !== 'staff') { pending = h; return viewLogin(); } return await viewStaff(); }
      if (r === 'captain') { if (!sess || sess.role !== 'captain') return viewLogin(); return await viewCaptain(); }
      if (r === 'notifications') { if (!sess || sess.role !== 'captain') return viewLogin(); return viewNotifications(); }
      if (sess) return go(homeOf());
      viewLogin();
    } catch (e) {
      if (my !== renderToken) return;
      console.error(e);
      app.innerHTML = shell(`<div class="card center"><p class="err">${errMsg(e)}</p><button class="btn" onclick="location.reload()">↻</button></div>`); bindShell();
    }
  }

  window.addEventListener('hashchange', render);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (!$('#installBtn')) render(); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !(FB.emu)) navigator.serviceWorker.register('sw.js').catch(() => {});

  (async () => {
    applyLang();
    if (FB.configured) {
      try { await FB.ready; await refreshSess(); if (sess) { await Data.loadSettings(); month = Data.nowMonth(); startNotif(); } } catch (e) { console.error(e); }
    }
    if (!month) month = Data.nowMonth();
    render();
  })();
})();
