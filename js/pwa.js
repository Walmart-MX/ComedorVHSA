/* ═══════════════════════════════════════════════════════════════
   PWA: registro de Service Worker, aviso de actualizacion,
   boton discreto de instalacion, y aviso de "sin conexion".
   Nada de esto es obligatorio para que la app funcione -- si el
   navegador no soporta algo, simplemente no se muestra (ver fase 24).
═══════════════════════════════════════════════════════════════ */

let deferredInstallPrompt = null;

export function initPWA() {
  registrarServiceWorker();
  wireInstallPrompt();
  wireOfflineBanner();
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./service-worker.js').then((reg) => {
    // Si ya hay un SW esperando (actualizacion descargada en background), avisamos.
    if (reg.waiting) mostrarBannerActualizacion(reg);

    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      if (!nuevo) return;
      nuevo.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
          mostrarBannerActualizacion(reg);
        }
      });
    });
  }).catch((err) => console.error('No se pudo registrar el Service Worker:', err));

  // Cuando el nuevo SW toma control, recargamos UNA vez (el usuario ya lo pidio).
  let yaRecargo = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (yaRecargo) return;
    yaRecargo = true;
    window.location.reload();
  });
}

function mostrarBannerActualizacion(reg) {
  const banner = document.getElementById('pwa-update-banner');
  if (!banner) return;
  banner.classList.remove('hidden');
  document.getElementById('btn-pwa-actualizar')?.addEventListener('click', () => {
    reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
  }, { once: true });
}

function wireInstallPrompt() {
  const btn = document.getElementById('btn-instalar-app');
  if (!btn) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    btn.classList.remove('hidden');
  });

  btn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    btn.classList.add('hidden');
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  });

  window.addEventListener('appinstalled', () => {
    btn.classList.add('hidden');
    deferredInstallPrompt = null;
  });
}

function wireOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;
  const actualizar = () => banner.classList.toggle('hidden', navigator.onLine);
  window.addEventListener('online', actualizar);
  window.addEventListener('offline', actualizar);
  actualizar();
}
