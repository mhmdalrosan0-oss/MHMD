/* App-shell cache so the installed app opens instantly. Data always comes from the network. */
const V = 'se-shell-v3';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/firebase-config.js', 'js/i18n.js', 'js/data.js', 'js/app.js',
  'vendor/firebase.bundle.js', 'vendor/qrcode.js', 'vendor/jsQR.js', 'img/logo-full.png', 'img/icon-192.png', 'manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return; // Firebase/API calls go straight to network
  // stale-while-revalidate for the shell
  e.respondWith(caches.open(V).then(async (c) => {
    const hit = await c.match(r, { ignoreSearch: true });
    const net = fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});

/* ---- Web Push (FCM data messages) ---- */
self.addEventListener('push', (e) => {
  let p = {}; try { p = e.data ? e.data.json() : {}; } catch { /* ignore */ }
  const d = p.data || p.notification || p;
  if (!d.title && !d.body) return;
  e.waitUntil(self.registration.showNotification(d.title || 'Smart Energy', {
    body: d.body || '', icon: 'img/icon-192.png', badge: 'img/icon-192.png', tag: d.tag || 'se', renotify: true, dir: 'auto', data: { url: d.url || './#/notifications' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './#/notifications', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if (c.url.startsWith(self.registration.scope) && 'focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
