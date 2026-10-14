/* ═══════════════════════════════════════════════════════════════
   PWA: registro de Service Worker, aviso de actualizacion,
   boton discreto de instalacion, y aviso de "sin conexion".
   Nada de esto es obligatorio para que la app funcione -- si el
   navegador no soporta algo, simplemente no se muestra (ver fase 24).
═══════════════════════════════════════════════════════════════ */

let deferredInstallPrompt = null;
const DISMISS_KEY = 'comedor_pwa_install_dismissed';

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
  const banner = document.getElementById('pwa-install-banner');
  const btnInstalar = document.getElementById('btn-pwa-instalar');
  const btnCerrar = document.getElementById('btn-pwa-instalar-cerrar');
  if (!banner || !btnInstalar || !btnCerrar) return;

  // Ya instalada (se abrio como app standalone) o el usuario ya cerro el
  // aviso antes: no insistimos. localStorage aqui es solo una preferencia
  // de UI efimera (no son datos de reportes), no choca con la decision de
  // "sin localStorage" del README -- esa aplicaba a folios/datos de negocio.
  const yaInstalada = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (yaInstalada || fueDescartado()) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    banner.classList.remove('hidden');
  });

  btnInstalar.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    banner.classList.add('hidden');
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  });

  btnCerrar.addEventListener('click', () => {
    banner.classList.add('hidden');
    marcarDescartado();
  });

  window.addEventListener('appinstalled', () => {
    banner.classList.add('hidden');
    deferredInstallPrompt = null;
  });
}

function fueDescartado() {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

function marcarDescartado() {
  try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* sin storage disponible: no pasa nada, solo insistira de nuevo */ }
}

function wireOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;
  const actualizar = () => banner.classList.toggle('hidden', navigator.onLine);
  window.addEventListener('online', actualizar);
  window.addEventListener('offline', actualizar);
  actualizar();
}
