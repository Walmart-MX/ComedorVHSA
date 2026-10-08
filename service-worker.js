/* ═══════════════════════════════════════════════════════════════
   Service Worker — Reportes Comedor
   Estrategia deliberadamente conservadora (ver fase 9/23 del plan PWA):
   - Navegacion (HTML): red primero, cache como respaldo si no hay
     conexion. Asi el usuario SIEMPRE ve la version mas nueva cuando
     hay internet, nunca queda "atrapado" con una version vieja.
   - Estaticos propios (css/js/icons): cache primero, se refresca en
     segundo plano. Es contenido versionado por nosotros, no cambia
     a cada rato.
   - Todo lo que NO es del mismo origen (Supabase, CDN de qrcode y
     supabase-js) se deja pasar tal cual: cero cache, cero logica
     offline ahi -- esos recursos necesitan ser siempre en vivo.
   - NO hay cola de envio offline de reportes (decision explicita:
     si no hay conexion, se le avisa al usuario, no se inventa
     sincronizacion en segundo plano).
═══════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `comedor-shell-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './icons/icon.svg',
  './js/main.js',
  './js/asociado.js',
  './js/consulta.js',
  './js/auth.js',
  './js/qr.js',
  './js/catalog.js',
  './js/config.js',
  './js/icons.js',
  './js/supabase-client.js',
  './js/admin-dashboard.js',
  './js/admin-table.js',
  './js/admin-trends.js',
  './js/pwa.js',
  './js/push.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
    // OJO: sin self.skipWaiting() aqui a proposito. El SW nuevo se queda
    //

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
          caches.open(CACHE_NAME).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fresh = fetch(req).then((res) => {
        caches.open(CACHE_NAME).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});

/* ─── Push notifications ───
   El payload lo arma la Edge Function notificar-push (ver supabase/functions).
   Formato esperado: { title, body, tag, data: { url } } */
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }

  const title = payload.title || 'Reportes Comedor';
  const options = {
    body: payload.body || '',
    icon: './icons/icon.svg',
    badge: './icons/icon.svg',
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
