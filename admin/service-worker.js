/* ═══════════════════════════════════════════════════════════════
   Service Worker — Panel Admin (Reportes Comedor)
   Independiente del Service Worker de /app/ -- ver app/service-worker.js
   para la explicacion completa de la estrategia (es la misma aqui).
═══════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `comedor-admin-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  './index.html',
  './manifest.webmanifest',
  '../css/styles.css',
  '../icons/icon.svg',
  '../icons/icon-admin-192.png',
  '../icons/icon-admin-512.png',
  '../icons/icon-admin-maskable-512.png',
  '../js/main-admin.js',
  '../js/auth.js',
  '../js/admin-dashboard.js',
  '../js/admin-table.js',
  '../js/admin-trends.js',
  '../js/admin-config.js',
  '../js/qr.js',
  '../js/catalog.js',
  '../js/config.js',
  '../js/icons.js',
  '../js/supabase-client.js',
  '../js/app-config.js',
  '../js/pwa.js',
  '../js/push.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
    // Sin self.skipWaiting() a proposito: ver app/service-worker.js.
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase/CDN: sin tocar

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, resClone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fresh = fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, resClone));
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});

/* ─── Push notifications de admin ─── */
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }

  const title = payload.title || 'Reportes del Comedor';
  const options = {
    body: payload.body || '',
    icon: '../icons/icon.svg',
    badge: '../icons/icon.svg',
    tag: payload.tag,
    data: payload.data || {}
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || './index.html', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
