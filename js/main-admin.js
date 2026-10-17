/* Punto de entrada del panel admin (admin/index.html). Completamente
   independiente de la app del asociado -- ver js/main-app.js. */

import { initAuth } from './auth.js';
import { isSupabaseConfigured } from './supabase-client.js';
import { renderDashboard } from './admin-dashboard.js';
import { initAdminTable, renderTabla, abrirReportePorFolio } from './admin-table.js';
import { renderTendencias } from './admin-trends.js';
import { initAdminConfig, renderConfigTab } from './admin-config.js';
import { initAdminPassword } from './admin-password.js';
import { initAdminCampanas, renderCampanasTab } from './admin-campanas.js';
import { cargarConfiguracion } from './app-config.js';
import { initPWA } from './pwa.js';
import { renderQR, initQR } from './qr.js';
import { activarNotificacionesAdmin, pushDisponible } from './push.js';

if (!isSupabaseConfigured) {
  document.getElementById('backend-warning')?.classList.remove('hidden');
}

/* Deep link desde una notificacion push de admin (?admin_folio=XXX en la
   URL, ver service-worker.js). Declarada ANTES de llamar a cualquier
   funcion que la use (manejarDeepLink, mas abajo) -- un "let" solo existe
   a partir de su propia linea (temporal dead zone); si la llamada hubiera
   ocurrido antes, el script entero se habria roto con un ReferenceError y
   ni siquiera el cambio de pestañas del panel habria quedado conectado
   (hallazgo real reportado: el admin se quedaba atorado en "Resumen"). */
let folioAdminPendiente = null;

cargarConfiguracion();
initAdminTable();
initAdminConfig();
initAdminPassword();
initAdminCampanas();
initQR();
initAuth({ onLogin: onAdminLogin });
initPWA();
manejarDeepLink();

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => showAdminTab(tab.dataset.tab, tab));
});

// Cuando se guarda una gestión en el modal, refrescamos dashboard + tabla.
document.addEventListener('reportes:actualizados', refrescarTodo);

function onAdminLogin() {
  refrescarTodo().then(() => {
    if (folioAdminPendiente) {
      abrirReportePorFolio(folioAdminPendiente);
      folioAdminPendiente = null;
    }
  });
  wireNotificacionesAdmin();
}

function wireNotificacionesAdmin() {
  const btn = document.getElementById('btn-activar-notif-admin');
  if (!btn || !pushDisponible()) return;
  btn.style.display = 'inline-block';
  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = 'Activando...';
    activarNotificacionesAdmin((ok) => {
      btn.disabled = false;
      btn.textContent = ok ? 'Notificaciones activadas' : 'Activar notificaciones';
      if (ok) btn.disabled = true;
    });
  }, { once: true });
}

async function refrescarTodo() {
  await renderDashboard();
  const tabActiva = document.querySelector('.nav-tab.active')?.dataset.tab || 'dashboard';
  if (tabActiva === 'reportes') renderTabla();
  if (tabActiva === 'tendencias') renderTendencias();
}

function manejarDeepLink() {
  folioAdminPendiente = new URLSearchParams(window.location.search).get('admin_folio');
}

function showAdminTab(name, el) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  ['dashboard', 'reportes', 'tendencias', 'campanas', 'config', 'qr'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('hidden', t !== name);
  });
  if (name === 'reportes') renderTabla();
  if (name === 'tendencias') renderTendencias();
  if (name === 'campanas') renderCampanasTab();
  if (name === 'config') renderConfigTab();
  if (name === 'qr') renderQR();
}
