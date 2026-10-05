/* Smart Energy – UI. Hash router: #/login, #/captain, #/staff, #/g/:id (QR target), #/admin/:tab[/:groupId] */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let lang = localStorage.getItem('se-lang') || 'ar';
  const t = (k, vars) => { let s = (I18N[lang][k] ?? I18N.ar[k] ?? k); if (vars) for (const v in vars) s = s.replace('{' + v + '}', vars[v]); return s; };
  const applyLang = () => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; };
  const num = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
  const money = (n) => num(n, 3) + ' ' + Store.db.settings.currency;
  const fmtDate = (ts) => new Date(ts).toLocaleString(lang === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const initials = (s) => (s || '?').trim().charAt(0);

  // ---------- session ----------
  const getSess = () => { try { return JSON.parse(localStorage.getItem('se-session')) || null; } catch { return null; } };
  const setSess = (s) => s ? localStorage.setItem('se-session', JSON.stringify(s)) : localStorage.removeItem('se-session');
  let pending = null; // hash to open after login
  let month = Store.monthKey(Date.now());

  function toast(msg, bad) {
    const d = document.createElement('div'); d.className = 'toast' + (bad ? ' bad' : ''); d.textContent = msg;
    $('#toasts').appendChild(d); setTimeout(() => d.remove(), 3200);
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

  const BOLT = '<svg viewBox="0 0 24 24"><path fill="#f0c419" d="M13 2 4 14h6l-2 8 10-13h-6z"/></svg>';

  // ---------- layout ----------
  function shell(inner, { nav } = {}) {
    const s = getSess();
    const home = s ? { admin: '#/admin/dash', staff: '#/staff', captain: '#/captain' }[s.role] : '#/login';
    return `<header class="topbar no-print">
      <a class="brand" href="${home}">${BOLT}<span>SMART <b>ENERGY</b></span></a><div class="spacer"></div>
      <button class="btn" id="langBtn">${t('lang')}</button>
      ${s ? `<button class="btn" id="logoutBtn">${t('logout')}</button>` : ''}
    </header>${nav || ''}<main class="wrap">${inner}</main>`;
  }
  function bindShell() {
    const lb = $('#langBtn'); if (lb) lb.onclick = () => { lang = lang === 'ar' ? 'en' : 'ar'; localStorage.setItem('se-lang', lang); applyLang(); render(); };
    const ob = $('#logoutBtn'); if (ob) ob.onclick = () => { setSess(null); go('#/login'); };
  }
  const monthSelect = () => `<select id="monthSel" style="width:auto">${Store.monthsAvailable().map((m) => `<option ${m === month ? 'selected' : ''}>${m}</option>`).join('')}</select>`;
  function bindMonth() { const m = $('#monthSel'); if (m) m.onchange = () => { month = m.value; render(); }; }

  function progressCard(group, st) {
    const ti = st.tier;
    let prog = 100, txt = t('reached_top');
    if (ti.next) {
      const base = ti.tiers[ti.idx].kwh;
      prog = Math.max(2, Math.min(100, ((st.kwh - base) / (ti.next.kwh - base)) * 100));
      txt = `${t('next_tier')}: ${num(ti.next.kwh)} ${t('kwh')} → ${ti.next.pct}% · ${t('need_more')} ${num(Math.max(0, ti.next.kwh - st.kwh), 1)} ${t('kwh')}`;
    }
    return `<div class="bar"><i style="width:${prog}%"></i></div><div class="muted">${txt}</div>`;
  }
  function tiersList(group, st) {
    const tiers = Store.tiersFor(group);
    return `<div class="tiers">${tiers.map((x, i) => `<div class="tier ${i === st.tier.idx ? 'on' : i < st.tier.idx ? 'done' : ''}">
      <span>${i === 0 ? t('tier_base', { k: num(x.kwh) }) : t('tier_row', { k: num(x.kwh) })}</span><b>${x.pct}%</b></div>`).join('')}</div>`;
  }
  const groupAvatar = (g) => `<div class="avatar">${g.logo ? `<img src="${g.logo}" alt="">` : esc(initials(g.name))}</div>`;

  // ---------- login ----------
  function viewLogin() {
    let role = 'captain';
    if (pending && pending.startsWith('#/g/')) role = 'staff';
    const draw = () => {
      app.innerHTML = shell(`<div class="login">
        <img class="logo" src="img/logo-full.png" alt="Smart Energy">
        <p class="center muted">${t('tagline')}</p>
        <div class="tabs">${['captain', 'staff', 'admin'].map((r) => `<button data-r="${r}" class="${r === role ? 'on' : ''}">${t('role_' + r)}</button>`).join('')}</div>
        <div class="card">
          ${pending && role === 'staff' ? `<div class="warn">${t('login_staff_first')}</div>` : ''}
          <form id="lf">
            ${role === 'captain' ? `<label>${t('phone')}</label><input type="tel" id="f" inputmode="tel" autocomplete="tel" placeholder="07XXXXXXXX" class="ltr">` : ''}
            ${role === 'staff' ? `<label>${t('code6')}</label><input type="password" id="f" inputmode="numeric" maxlength="6" class="codeinput" autocomplete="off">` : ''}
            ${role === 'admin' ? `<label>${t('password')}</label><input type="password" id="f" autocomplete="current-password">` : ''}
            <div class="err" id="err"></div>
            <button class="btn primary block big" style="margin-top:1rem">${t('enter')}</button>
          </form>
        </div></div>`);
      bindShell();
      app.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => { role = b.dataset.r; draw(); });
      $('#lf').onsubmit = async (e) => {
        e.preventDefault(); const v = $('#f').value, err = $('#err'); err.textContent = '';
        const after = (def) => { const p = pending; pending = null; go(p || def); };
        if (role === 'admin') { if (await Store.checkAdmin(v)) { setSess({ role: 'admin' }); after('#/admin/dash'); } else err.textContent = t('wrong_pass'); }
        else if (role === 'staff') { const s = Store.staffByCode(v); if (s) { setSess({ role: 'staff', staffId: s.id }); after('#/staff'); } else err.textContent = t('wrong_code'); }
        else {
          const caps = Store.captainsByPhone(v);
          if (!caps.length) err.textContent = t('phone_not_found');
          else if (caps.length === 1) { setSess({ role: 'captain', captainId: caps[0].id }); go('#/captain'); }
          else modal(`<h3>${t('choose_group')}</h3><ul class="list">${caps.map((c) => { const g = Store.db.groups.find((x) => x.id === c.groupId); return `<li class="item clickable" data-c="${c.id}">${groupAvatar(g)}<div class="grow t">${esc(g.name)}</div></li>`; }).join('')}</ul>`,
            (m, close) => m.querySelectorAll('[data-c]').forEach((li) => li.onclick = () => { close(); setSess({ role: 'captain', captainId: li.dataset.c }); go('#/captain'); }));
        }
      };
    };
    draw();
  }

  // ---------- captain ----------
  function viewCaptain() {
    const s = getSess(); const cap = Store.db.captains.find((c) => c.id === s.captainId);
    if (!cap) { setSess(null); return go('#/login'); }
    const group = Store.db.groups.find((g) => g.id === cap.groupId);
    const me = Store.captainStats(cap.id, month), gs = Store.groupStats(group.id, month);
    const hist = Store.chargesOf({ captainId: cap.id }, month).sort((a, b) => b.ts - a.ts);
    app.innerHTML = shell(`
      <div class="row between"><div class="row">${groupAvatar(group)}<div><h2 style="margin:0">${t('welcome')} ${esc(cap.name)}</h2><div class="muted">${esc(group.name)}</div></div></div>${monthSelect()}</div>
      <div class="grid g2" style="margin:1rem 0">
        <div class="stat hl"><div class="v">${num(me.kwh, 1)}</div><div class="l">${t('my_kwh')} (${t('kwh')})</div></div>
        <div class="stat"><div class="v">${num(gs.kwh, 1)}</div><div class="l">${t('group_kwh')} (${t('kwh')})</div></div>
        <div class="stat"><div class="v pct">${gs.pct}%</div><div class="l">${t('cashback_pct')}</div></div>
        <div class="stat"><div class="v">${money(me.cashback)}</div><div class="l">${t('my_share')}</div></div>
      </div>
      <div class="card">${progressCard(group, gs)}</div>
      <div class="card"><h3>${t('tiers_title')}</h3>${tiersList(group, gs)}</div>
      <div class="card"><h3>${t('history')}</h3>${hist.length ? `<div class="tablewrap"><table><tr><th>${t('date')}</th><th>${t('kwh')}</th><th>${t('amount')}</th></tr>
        ${hist.map((c) => `<tr><td>${fmtDate(c.ts)}</td><td>${num(c.kwh, 1)}</td><td>${money(c.amount)}</td></tr>`).join('')}</table></div>` : `<div class="muted">${t('no_data')}</div>`}</div>`);
    bindShell(); bindMonth();
  }

  // ---------- staff ----------
  let scanStream = null, scanRaf = null;
  function stopScan() { cancelAnimationFrame(scanRaf); if (scanStream) scanStream.getTracks().forEach((x) => x.stop()); scanStream = null; }
  function viewStaff() {
    app.innerHTML = shell(`
      <div class="card center"><h2>${t('scan_title')}</h2><p class="muted">${t('scan_hint')}</p>
        <div id="scanArea"></div><button class="btn primary big block" id="camBtn">${t('start_camera')}</button><div class="err" id="camErr"></div></div>
      <div class="card"><h3>${t('scan_or_pick')}</h3><input type="search" id="gsearch" placeholder="${t('search')}">
        <ul class="list" id="glist"></ul></div>`);
    bindShell();
    const drawList = () => {
      const q = $('#gsearch').value.trim().toLowerCase();
      const gs = Store.db.groups.filter((g) => g.name.toLowerCase().includes(q));
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

  function viewStaffGroup(groupId) {
    const group = Store.db.groups.find((g) => g.id === groupId);
    if (!group) { app.innerHTML = shell(`<div class="card center">${t('group_not_found')}<br><br><a class="btn" href="#/staff">${t('back')}</a></div>`); return bindShell(); }
    const m = Store.monthKey(Date.now()), gs = Store.groupStats(groupId, m);
    const caps = Store.db.captains.filter((c) => c.groupId === groupId).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const recent = Store.chargesOf({ groupId }, m).sort((a, b) => b.ts - a.ts).slice(0, 6);
    app.innerHTML = shell(`
      <div class="row between"><div class="row">${groupAvatar(group)}<div><h2 style="margin:0">${esc(group.name)}</h2><div class="muted">${t('price_now')}: ${Store.priceAt()} ${t('per_kwh')}</div></div></div><a class="btn sm" href="#/staff">${t('back')}</a></div>
      <div class="grid g2" style="margin:1rem 0"><div class="stat hl"><div class="v">${num(gs.kwh, 1)}</div><div class="l">${t('total_kwh')}</div></div><div class="stat"><div class="v pct">${gs.pct}%</div><div class="l">${t('cashback_pct')}</div></div></div>
      <div class="card">${progressCard(group, gs)}</div>
      <div class="grid g2"><button class="btn primary big" id="newCap">＋ ${t('new_captain')}</button><button class="btn yellow big" id="pickCap">${t('pick_captain')}</button></div>
      <div class="card" style="margin-top:1rem"><h3>${t('recent_charges')}</h3>${recent.length ? `<ul class="list">${recent.map((c) => { const cp = Store.db.captains.find((x) => x.id === c.captainId); return `<li class="item"><div class="grow"><div class="t">${esc(cp?.name)}</div><div class="s">${fmtDate(c.ts)}</div></div><b>${num(c.kwh, 1)} ${t('kwh')}</b></li>`; }).join('')}</ul>` : `<div class="muted">${t('no_data')}</div>`}</div>`);
    bindShell();

    const chargeForm = (cap) => modal(`<div class="row"><div class="avatar">${esc(initials(cap.name))}</div><div><h3 style="margin:0">${esc(cap.name)}</h3><div class="muted ltr">${esc(cap.phone)}</div></div></div>
      <label>${t('charge_kwh')}</label><input type="number" id="kwh" inputmode="decimal" step="0.1" min="0" style="font-size:1.6rem;text-align:center" autofocus>
      <div class="muted" id="est"></div><div class="err" id="e"></div>
      <div class="row" style="margin-top:1rem"><button class="btn primary" id="ok" style="flex:1">${t('add_charge')}</button><button class="btn" data-close>${t('cancel')}</button></div>`, (mm, close) => {
      const inp = $('#kwh', mm), p = Store.priceAt();
      inp.oninput = () => { $('#est', mm).textContent = inp.value > 0 ? `${t('est_amount')}: ${money(inp.value * p)} (${p} ${t('per_kwh')})` : ''; };
      setTimeout(() => inp.focus(), 50);
      $('#ok', mm).onclick = () => {
        const v = parseFloat(inp.value); if (!(v > 0) || v > 1000) return ($('#e', mm).textContent = t('invalid_number'));
        Store.addCharge(cap.id, v, getSess().staffId); close(); toast(`${t('charge_saved')}: ${esc(cap.name)} – ${num(v, 1)} ${t('kwh')}`); render();
      };
    });

    $('#pickCap').onclick = () => modal(`<h3>${t('captains')}</h3><input type="search" id="cs" placeholder="${t('search')}"><ul class="list" id="cl"></ul><button class="btn block" data-close>${t('close')}</button>`, (mm, close) => {
      const draw = () => {
        const q = $('#cs', mm).value.trim().toLowerCase();
        const f = caps.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
        $('#cl', mm).innerHTML = f.length ? f.map((c) => `<li class="item clickable" data-c="${c.id}"><div class="avatar">${esc(initials(c.name))}</div><div class="grow"><div class="t">${esc(c.name)}</div><div class="s ltr">${esc(c.phone)}</div></div></li>`).join('') : `<li class="muted">${t('no_captains')}</li>`;
        $('#cl', mm).querySelectorAll('[data-c]').forEach((li) => li.onclick = () => { close(); chargeForm(caps.find((c) => c.id === li.dataset.c)); });
      };
      $('#cs', mm).oninput = draw; draw();
    });

    $('#newCap').onclick = () => modal(`<h3>${t('new_captain')}</h3>
      <label>${t('name')}</label><input type="text" id="n"><label>${t('phone')}</label><input type="tel" id="p" inputmode="tel" class="ltr" placeholder="07XXXXXXXX"><div class="muted">${t('phone_hint')}</div>
      <div id="dup"></div><div class="err" id="e"></div>
      <div class="row" style="margin-top:1rem"><button class="btn primary" id="ok" style="flex:1">${t('add')}</button><button class="btn" data-close>${t('cancel')}</button></div>`, (mm, close) => {
      $('#ok', mm).onclick = () => {
        const n = $('#n', mm).value.trim(), p = $('#p', mm).value, e = $('#e', mm); e.textContent = ''; $('#dup', mm).innerHTML = '';
        if (!n) return (e.textContent = t('name_required'));
        if (!Store.validPhone(p)) return (e.textContent = t('invalid_phone'));
        const ex = Store.findCaptainByPhone(groupId, p);
        if (ex) {
          $('#dup', mm).innerHTML = `<div class="warn">⚠️ ${t('captain_exists')} <b>${esc(ex.name)}</b><br><button class="btn sm yellow" id="useEx" style="margin-top:.5rem">${t('use_existing')}</button></div>`;
          $('#useEx', mm).onclick = () => { close(); chargeForm(ex); };
          return;
        }
        const c = Store.addCaptain(groupId, n, p); close(); toast(t('captain_added')); chargeForm(c);
      };
    });
  }

  // ---------- admin ----------
  const TABS = ['dash', 'groups', 'staff', 'settings'];
  function adminNav(tab) { return `<nav class="nav no-print">${TABS.map((x) => `<a href="#/admin/${x}" class="${x === tab ? 'on' : ''}">${t('nav_' + { dash: 'dash', groups: 'groups', staff: 'staff', settings: 'settings' }[x])}</a>`).join('')}</nav>`; }

  function viewAdmin(tab, arg) {
    if (tab === 'groups' && arg) return adminGroup(arg);
    const fn = { dash: adminDash, groups: adminGroups, staff: adminStaff, settings: adminSettings }[tab] || adminDash;
    fn();
  }

  function adminDash() {
    const db = Store.db, groups = db.groups;
    const rows = groups.map((g) => ({ g, st: Store.groupStats(g.id, month) })).sort((a, b) => b.st.kwh - a.st.kwh);
    const totalKwh = rows.reduce((s, r) => s + r.st.kwh, 0), totalSales = rows.reduce((s, r) => s + r.st.sales, 0), totalCb = rows.reduce((s, r) => s + r.st.cashback, 0);
    const days = new Date(+month.slice(0, 4), +month.slice(5), 0).getDate(), daily = new Array(days).fill(0);
    Store.chargesOf({}, month).forEach((c) => { daily[new Date(c.ts).getDate() - 1] += c.kwh; });
    const mx = Math.max(1, ...daily);
    app.innerHTML = shell(`
      <div class="row between"><h2>${t('nav_dash')}</h2>${monthSelect()}</div>
      <div class="grid g2">
        <div class="stat hl"><div class="v">${num(totalKwh, 1)}</div><div class="l">${t('total_kwh')}</div></div>
        <div class="stat"><div class="v">${money(totalSales)}</div><div class="l">${t('sales')}</div></div>
        <div class="stat"><div class="v">${money(totalCb)}</div><div class="l">${t('cashback')}</div></div>
        <div class="stat"><div class="v">${groups.length} / ${db.captains.length}</div><div class="l">${t('groups_count')} / ${t('captains_count')}</div></div>
      </div>
      <div class="card" style="margin-top:1rem"><h3>${t('daily_chart')}</h3>
        <div class="chart">${daily.map((v, i) => `<div style="height:${(v / mx) * 100}%" title="${i + 1}: ${num(v, 1)}"></div>`).join('')}</div>
        <div class="chartx"><span>1</span><span>${days}</span></div></div>
      <div class="card"><div class="row between"><h3>${t('top_groups')}</h3><button class="btn sm" id="csv">${t('export_csv')}</button></div>
        ${rows.length ? `<div class="tablewrap"><table><tr><th>${t('group_name')}</th><th>${t('kwh')}</th><th>%</th><th>${t('sales')}</th><th>${t('cashback')}</th></tr>
        ${rows.map(({ g, st }) => `<tr class="clickable" data-g="${g.id}"><td><b>${esc(g.name)}</b></td><td>${num(st.kwh, 1)}</td><td>${st.pct}%</td><td>${money(st.sales)}</td><td><b>${money(st.cashback)}</b></td></tr>`).join('')}</table></div>` : `<div class="muted">${t('no_groups')}</div>`}</div>`, { nav: adminNav('dash') });
    bindShell(); bindMonth();
    app.querySelectorAll('[data-g]').forEach((r) => r.onclick = () => go('#/admin/groups/' + r.dataset.g));
    $('#csv').onclick = () => download(`cashback-${month}.csv`, toCSV([[t('group_name'), t('manager'), 'kWh', '%', t('sales'), t('cashback')], ...rows.map(({ g, st }) => [g.name, g.managerName + ' ' + g.managerPhone, st.kwh, st.pct, st.sales, st.cashback])]));
  }
  const toCSV = (rows) => '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  function download(name, content, type = 'text/csv;charset=utf-8') {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function readLogo(file, cb) {
    if (!file) return cb('');
    const img = new Image(), fr = new FileReader();
    fr.onload = () => { img.onload = () => { const s = 160, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'); const m = Math.min(img.width, img.height); x.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s); cb(c.toDataURL('image/jpeg', .8)); }; img.src = fr.result; };
    fr.readAsDataURL(file);
  }

  function adminGroups() {
    const groups = Store.db.groups;
    app.innerHTML = shell(`<div class="row between"><h2>${t('nav_groups')}</h2><button class="btn primary" id="addG">＋ ${t('add_group')}</button></div>
      <div class="card">${groups.length ? `<ul class="list">${groups.map((g) => { const st = Store.groupStats(g.id, month); return `<li class="item clickable" data-g="${g.id}">${groupAvatar(g)}<div class="grow"><div class="t">${esc(g.name)}</div><div class="s">${esc(g.managerName)} · <span class="ltr">${esc(g.managerPhone)}</span></div></div><div><b>${num(st.kwh, 0)}</b> <span class="muted">${t('kwh')}</span><br><span class="badge">${st.pct}%</span></div></li>`; }).join('')}</ul>` : `<div class="muted center">${t('no_groups')}</div>`}</div>`, { nav: adminNav('groups') });
    bindShell();
    app.querySelectorAll('[data-g]').forEach((r) => r.onclick = () => go('#/admin/groups/' + r.dataset.g));
    $('#addG').onclick = () => modal(`<h3>${t('add_group')}</h3>
      <label>${t('group_name')}</label><input type="text" id="gn"><label>${t('manager_name')}</label><input type="text" id="mn">
      <label>${t('manager_phone')}</label><input type="tel" id="mp" class="ltr" placeholder="07XXXXXXXX"><label>${t('logo')}</label><input type="file" id="lg" accept="image/*">
      <div class="err" id="e"></div><div class="row" style="margin-top:1rem"><button class="btn primary" id="ok" style="flex:1">${t('save')}</button><button class="btn" data-close>${t('cancel')}</button></div>`, (mm, close) => {
      $('#ok', mm).onclick = () => {
        const gn = $('#gn', mm).value.trim(), mn = $('#mn', mm).value.trim(), mp = $('#mp', mm).value;
        if (!gn || !mn) return ($('#e', mm).textContent = t('name_required'));
        if (!Store.validPhone(mp)) return ($('#e', mm).textContent = t('invalid_phone'));
        readLogo($('#lg', mm).files[0], (logo) => { const g = Store.addGroup({ name: gn, managerName: mn, managerPhone: mp, logo }); close(); toast(t('group_saved')); go('#/admin/groups/' + g.id); });
      };
    });
  }

  function groupURL(id) { return location.href.split('#')[0] + '#/g/' + id; }
  function drawQR(group, canvas) {
    const q = qrcode(0, 'M'); q.addData(groupURL(group.id)); q.make();
    const n = q.getModuleCount(), cell = 10, pad = 30, head = 70, W = n * cell + pad * 2, H = W + head;
    canvas.width = W; canvas.height = H; const x = canvas.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#1f4d22'; x.font = 'bold 30px Tahoma, sans-serif'; x.textAlign = 'center'; x.fillText(group.name, W / 2, 46);
    x.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect(pad + c * cell, head + r * cell, cell, cell);
  }

  function adminGroup(id) {
    const group = Store.db.groups.find((g) => g.id === id);
    if (!group) return go('#/admin/groups');
    const st = Store.groupStats(id, month);
    const caps = Store.db.captains.filter((c) => c.groupId === id).map((c) => ({ c, s: Store.captainStats(c.id, month) })).sort((a, b) => b.s.kwh - a.s.kwh);
    const charges = Store.chargesOf({ groupId: id }, month).sort((a, b) => b.ts - a.ts).slice(0, 40);
    app.innerHTML = shell(`
      <div class="row between"><div class="row">${groupAvatar(group)}<div><h2 style="margin:0">${esc(group.name)}</h2><div class="muted">${esc(group.managerName)} · <span class="ltr">${esc(group.managerPhone)}</span></div></div></div>
        <div class="row">${monthSelect()}<a class="btn sm" href="#/admin/groups">${t('back')}</a></div></div>
      <div class="grid g2" style="margin:1rem 0">
        <div class="stat hl"><div class="v">${num(st.kwh, 1)}</div><div class="l">${t('total_kwh')}</div></div>
        <div class="stat"><div class="v pct">${st.pct}%</div><div class="l">${t('cashback_pct')}</div></div>
        <div class="stat"><div class="v">${money(st.sales)}</div><div class="l">${t('sales')}</div></div>
        <div class="stat"><div class="v">${money(st.cashback)}</div><div class="l">${t('cashback')}</div></div></div>
      <div class="card">${progressCard(group, st)}</div>
      <div class="card"><h3>${t('members')} (${caps.length})</h3><div class="tablewrap"><table><tr><th>${t('name')}</th><th>${t('phone')}</th><th>${t('kwh')}</th><th>${t('share')}</th><th></th></tr>
        ${caps.map(({ c, s }) => `<tr><td>${esc(c.name)}${c.isManager ? ' ⭐' : ''}</td><td class="ltr">${esc(c.phone)}</td><td>${num(s.kwh, 1)}</td><td>${money(s.cashback)}</td><td><button class="btn danger sm" data-dc="${c.id}">✕</button></td></tr>`).join('')}</table></div></div>
      <div class="card"><h3>${t('history')}</h3>${charges.length ? `<div class="tablewrap"><table><tr><th>${t('date')}</th><th>${t('name')}</th><th>${t('kwh')}</th><th>${t('amount')}</th><th>${t('staff')}</th><th></th></tr>
        ${charges.map((c) => { const cp = Store.db.captains.find((x) => x.id === c.captainId), sf = Store.db.staff.find((x) => x.id === c.staffId); return `<tr><td>${fmtDate(c.ts)}</td><td>${esc(cp?.name)}</td><td>${num(c.kwh, 1)}</td><td>${money(c.amount)}</td><td>${esc(sf?.name || '-')}</td><td><button class="btn danger sm" data-dch="${c.id}">✕</button></td></tr>`; }).join('')}</table></div>` : `<div class="muted">${t('no_data')}</div>`}</div>
      <div class="card"><h3>${t('group_tiers')}</h3><div class="row"><label style="margin:0"><input type="checkbox" id="custT" ${group.tiers ? 'checked' : ''}> ${t('custom_tiers')}</label></div>
        <div id="tEd" class="${group.tiers ? '' : 'hide'}"></div><div class="muted" style="margin-top:.4rem">${group.tiers ? '' : t('use_default_tiers')}</div></div>
      <div class="card qrbox"><h3>${t('qr_code')}</h3><canvas id="qr" style="width:260px"></canvas><p class="muted">${t('qr_hint')}</p>
        <div class="row no-print" style="justify-content:center"><button class="btn primary" id="dl">${t('download_qr')}</button><button class="btn" id="pr">${t('print')}</button><button class="btn" id="cp">${t('copy_link')}</button></div></div>
      <div class="row no-print"><button class="btn" id="eg">${t('edit')}</button><button class="btn danger" id="dg">${t('delete')}</button></div>`, { nav: adminNav('groups') });
    bindShell(); bindMonth(); drawQR(group, $('#qr'));
    $('#dl').onclick = () => { const a = document.createElement('a'); a.href = $('#qr').toDataURL('image/png'); a.download = `qr-${group.name}.png`; a.click(); };
    $('#pr').onclick = () => window.print();
    $('#cp').onclick = () => { navigator.clipboard?.writeText(groupURL(id)); toast(t('copied')); };
    app.querySelectorAll('[data-dc]').forEach((b) => b.onclick = () => confirmBox(t('delete_captain_q'), () => { Store.deleteCaptain(b.dataset.dc); render(); }));
    app.querySelectorAll('[data-dch]').forEach((b) => b.onclick = () => confirmBox(t('delete_charge_q'), () => { Store.deleteCharge(b.dataset.dch); render(); }));
    $('#dg').onclick = () => confirmBox(t('delete_group_q'), () => { Store.deleteGroup(id); go('#/admin/groups'); });
    $('#eg').onclick = () => modal(`<h3>${t('edit')}</h3><label>${t('group_name')}</label><input type="text" id="gn" value="${esc(group.name)}"><label>${t('manager_name')}</label><input type="text" id="mn" value="${esc(group.managerName)}">
      <label>${t('manager_phone')}</label><input type="tel" id="mp" class="ltr" value="${esc(group.managerPhone)}"><label>${t('logo')}</label><input type="file" id="lg" accept="image/*">
      <div class="err" id="e"></div><div class="row" style="margin-top:1rem"><button class="btn primary" id="ok" style="flex:1">${t('save')}</button><button class="btn" data-close>${t('cancel')}</button></div>`, (mm, close) => {
      $('#ok', mm).onclick = () => {
        if (!$('#gn', mm).value.trim() || !$('#mn', mm).value.trim()) return ($('#e', mm).textContent = t('name_required'));
        if (!Store.validPhone($('#mp', mm).value)) return ($('#e', mm).textContent = t('invalid_phone'));
        const patch = { name: $('#gn', mm).value.trim(), managerName: $('#mn', mm).value.trim(), managerPhone: Store.normPhone($('#mp', mm).value) };
        const fin = (logo) => { if (logo) patch.logo = logo; Store.updateGroup(id, patch); close(); toast(t('group_saved')); render(); };
        const f = $('#lg', mm).files[0]; f ? readLogo(f, fin) : fin('');
      };
    });
    const tEd = $('#tEd');
    $('#custT').onchange = (e) => {
      if (e.target.checked) { Store.updateGroup(id, { tiers: Store.tiersFor(null).map((x) => ({ ...x })) }); } else Store.updateGroup(id, { tiers: null });
      render();
    };
    if (group.tiers) {
      tEd.innerHTML = tierEditorHTML(group.tiers);
      wireTierEditor(tEd, group.tiers, (list) => { Store.updateGroup(id, { tiers: list }); toast(t('settings_saved')); render(); });
    }
  }

  // tier editor (shared by default settings and per-group)
  function tierEditorHTML(list) {
    return `<div class="tablewrap"><table><tr><th>${t('tier_kwh')}</th><th>${t('tier_pct')}</th><th></th></tr>
      ${list.map((x) => `<tr><td><input type="number" class="tk" value="${x.kwh}" min="0"></td><td><input type="number" class="tp" value="${x.pct}" min="0" max="100" step="0.5"></td><td><button class="btn danger sm rm">✕</button></td></tr>`).join('')}</table></div>
      <div class="row" style="margin-top:.5rem"><button class="btn sm add">＋ ${t('add_tier')}</button><button class="btn primary sm sv">${t('save')}</button></div>`;
  }
  function wireTierEditor(root, list, onSave) {
    const read = () => [...root.querySelectorAll('tr')].slice(1).map((tr) => ({ kwh: parseFloat(tr.querySelector('.tk').value), pct: parseFloat(tr.querySelector('.tp').value) })).filter((x) => x.kwh >= 0 && x.pct >= 0);
    root.querySelectorAll('.rm').forEach((b, i) => b.onclick = () => { const l = read(); l.splice(i, 1); root.innerHTML = tierEditorHTML(l); wireTierEditor(root, l, onSave); });
    root.querySelector('.add').onclick = () => { const l = read(); const last = l[l.length - 1] || { kwh: 0, pct: 0 }; l.push({ kwh: last.kwh + 200, pct: last.pct + 1 }); root.innerHTML = tierEditorHTML(l); wireTierEditor(root, l, onSave); };
    root.querySelector('.sv').onclick = () => { const l = Store.sortedTiers(read()); if (!l.length) return; onSave(l); };
  }

  function adminStaff() {
    const staff = Store.db.staff;
    app.innerHTML = shell(`<div class="row between"><h2>${t('nav_staff')}</h2><button class="btn primary" id="addS">＋ ${t('staff_add')}</button></div>
      <div class="card">${staff.length ? `<ul class="list">${staff.map((s) => `<li class="item"><div class="avatar">${esc(initials(s.name))}</div><div class="grow"><div class="t">${esc(s.name)} <span class="badge ${s.active ? '' : 'off'}">${s.active ? t('active') : t('disabled')}</span></div><div class="s">${t('code')}: <b class="ltr" style="letter-spacing:.2em">${s.code}</b></div></div>
        <button class="btn sm" data-rg="${s.id}">🔄</button><button class="btn sm" data-tg="${s.id}">⏻</button><button class="btn danger sm" data-dl="${s.id}">✕</button></li>`).join('')}</ul>` : `<div class="muted center">${t('no_data')}</div>`}</div>`, { nav: adminNav('staff') });
    bindShell();
    $('#addS').onclick = () => modal(`<h3>${t('staff_add')}</h3><label>${t('staff_name')}</label><input type="text" id="n"><div class="err" id="e"></div>
      <div class="row" style="margin-top:1rem"><button class="btn primary" id="ok" style="flex:1">${t('add')}</button><button class="btn" data-close>${t('cancel')}</button></div>`, (mm, close) => {
      $('#ok', mm).onclick = () => { const n = $('#n', mm).value.trim(); if (!n) return ($('#e', mm).textContent = t('name_required')); const s = Store.addStaff(n); close(); showCode(s); };
    });
    const showCode = (s) => modal(`<div class="center"><div class="muted">${t('new_code_for')} ${esc(s.name)}</div><div style="font-size:2.6rem;font-weight:800;letter-spacing:.3em;color:var(--green-d)" class="ltr">${s.code}</div><button class="btn block" data-close>${t('close')}</button></div>`, null);
    app.querySelectorAll('[data-rg]').forEach((b) => b.onclick = () => { const s = Store.regenStaff(b.dataset.rg); render(); showCode(s); });
    app.querySelectorAll('[data-tg]').forEach((b) => b.onclick = () => { Store.toggleStaff(b.dataset.tg); render(); });
    app.querySelectorAll('[data-dl]').forEach((b) => b.onclick = () => confirmBox(t('delete') + '?', () => { Store.deleteStaff(b.dataset.dl); render(); }));
  }

  function adminSettings() {
    const S = Store.db.settings;
    app.innerHTML = shell(`<h2>${t('nav_settings')}</h2>
      <div class="warn">${t('storage_warn')}</div>${Store.isDefaultAdmin() ? `<div class="warn" style="border-color:var(--danger)">${t('default_pass_warn')}</div>` : ''}
      <div class="card"><h3>${t('tiers_settings')}</h3><div id="tEd">${tierEditorHTML(S.tiers)}</div><p class="muted">${t('tiers_note')}</p></div>
      <div class="card"><h3>${t('prices_settings')}</h3><div id="pEd"></div></div>
      <div class="card"><h3>${t('currency')}</h3><div class="row"><input type="text" id="cur" value="${esc(S.currency)}" style="max-width:160px"><button class="btn primary sm" id="curS">${t('save')}</button></div></div>
      <div class="card"><h3>${t('admin_password')}</h3><label>${t('new_password')}</label><input type="password" id="npw" autocomplete="new-password"><button class="btn primary sm" id="pwS" style="margin-top:.6rem">${t('change_password')}</button></div>
      <div class="card"><h3>${t('data_tools')}</h3><div class="row"><button class="btn" id="exp">${t('export_backup')}</button><label class="btn" style="margin:0">${t('import_backup')}<input type="file" id="imp" accept=".json" hidden></label>
        <button class="btn yellow" id="demo">${t('load_demo')}</button><button class="btn danger" id="rst">${t('reset_all')}</button></div></div>`, { nav: adminNav('settings') });
    bindShell();
    wireTierEditor($('#tEd'), S.tiers, (l) => { Store.saveSettings({ tiers: l }); toast(t('settings_saved')); render(); });
    const pEd = $('#pEd');
    const drawP = (list) => {
      pEd.innerHTML = `<div class="tablewrap"><table><tr><th>${t('from')}</th><th>${t('to')}</th><th>${t('price')}</th><th></th></tr>${list.map((p) => `<tr><td><input type="time" class="pf" value="${p.from}"></td><td><input type="time" class="pt" value="${p.to}"></td><td><input type="number" class="pp" step="0.001" min="0" value="${p.price}"></td><td><button class="btn danger sm rm">✕</button></td></tr>`).join('')}</table></div>
        <div class="row" style="margin-top:.5rem"><button class="btn sm add">＋ ${t('add_price')}</button><button class="btn primary sm sv">${t('save')}</button></div>`;
      const read = () => [...pEd.querySelectorAll('tr')].slice(1).map((tr) => ({ from: tr.querySelector('.pf').value, to: tr.querySelector('.pt').value, price: parseFloat(tr.querySelector('.pp').value) })).filter((p) => p.from && p.to && p.price >= 0);
      pEd.querySelectorAll('.rm').forEach((b, i) => b.onclick = () => { const l = read(); l.splice(i, 1); drawP(l); });
      pEd.querySelector('.add').onclick = () => { const l = read(); l.push({ from: '00:00', to: '00:00', price: 0.2 }); drawP(l); };
      pEd.querySelector('.sv').onclick = () => { const l = read(); if (!l.length) return; Store.saveSettings({ prices: l }); toast(Store.pricesValid() ? t('settings_saved') : t('overlap_warn'), !Store.pricesValid()); };
    };
    drawP(S.prices);
    $('#curS').onclick = () => { Store.saveSettings({ currency: $('#cur').value.trim() || 'JD' }); toast(t('settings_saved')); };
    $('#pwS').onclick = async () => { const v = $('#npw').value; if (v.length < 6) return toast('≥ 6', true); await Store.setAdminPassword(v); toast(t('password_changed')); render(); };
    $('#exp').onclick = () => download('smart-energy-backup.json', Store.exportJSON(), 'application/json');
    $('#imp').onchange = (e) => { const f = e.target.files[0]; if (!f) return; f.text().then((x) => { try { Store.importJSON(x); toast(t('settings_saved')); render(); } catch { toast('Invalid file', true); } }); };
    $('#demo').onclick = () => { Store.seedDemo(); toast(t('demo_loaded')); render(); };
    $('#rst').onclick = () => confirmBox(t('reset_q'), () => { Store.reset(); setSess(null); go('#/login'); });
  }

  // ---------- router ----------
  function render() {
    stopScan();
    $('#modal-root').innerHTML = '';
    const h = location.hash || '#/login';
    const parts = h.replace(/^#\//, '').split('/');
    const s = getSess(), r = parts[0];
    if (r === 'g') {
      if (!s || (s.role !== 'staff' && s.role !== 'admin')) { pending = h; return viewLogin(); }
      return viewStaffGroup(parts[1]);
    }
    if (r === 'admin') { if (!s || s.role !== 'admin') { pending = h; return viewLogin(); } return viewAdmin(parts[1] || 'dash', parts[2]); }
    if (r === 'staff') { if (!s || s.role !== 'staff') { pending = h; return viewLogin(); } return viewStaff(); }
    if (r === 'captain') { if (!s || s.role !== 'captain') return viewLogin(); return viewCaptain(); }
    if (s) return go({ admin: '#/admin/dash', staff: '#/staff', captain: '#/captain' }[s.role]);
    viewLogin();
  }
  window.addEventListener('hashchange', render);
  applyLang(); render();
})();
