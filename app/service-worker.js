/* ═══════════════════════════════════════════════════════════════
   Service Worker — App del Asociado (Reportes Comedor)
   Independiente del Service Worker de /admin/ -- el scope de un SW
   es la carpeta donde vive el archivo, así que uno nunca controla
   al otro (ver README.md, sección "Apps independientes").

   Estrategia (igual que antes de separar las apps):
   - Navegacion (HTML): red primero, cache como respaldo si no hay
     conexion.
   - Estaticos propios (css/js/icons): cache primero, se refresca en
     segundo plano.
   - Todo lo que NO es del mismo origen (Supabase, CDN de supabase-js)
     se deja pasar tal cual: cero cache, cero logica offline ahi.
   - NO hay cola de envio offline de reportes (decision explicita).
═══════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `comedor-app-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  './index.html',
  './manifest.webmanifest',
  '../css/styles.css',
  '../icons/icon.svg',
  '../icons/icon-app-192.png',
  '../icons/icon-app-512.png',
  '../icons/icon-app-maskable-512.png',
  '../js/main-app.js',
  '../js/asociado.js',
  '../js/confirmacion.js',
  '../js/consulta.js',
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
    // OJO: sin self.skipWaiting() aqui a proposito. El SW nuevo se queda
    // "esperando" hasta que el usuario confirme el banner de actualizacion
    // (ver js/pwa.js) -- asi no le cambiamos el tapete a medio reporte.
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

/* ─── Push notifications (ligadas a un folio, nunca a una identidad) ───
   El payload lo arma la Edge Function notificar-push (ver supabase/functions). */
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }

  const title = payload.title || 'Reportes del Comedor';
  const options = {
    body: payload.body || '',
    icon: '../icons/icon-app-192.png',
    badge: '../icons/icon-app-192.png',
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
