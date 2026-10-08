import { initAsociado } from './asociado.js';
import { initConsulta, consultarFolioDesdeURL } from './consulta.js';
import { initAuth } from './auth.js';
import { initQR } from './qr.js';
import { isSupabaseConfigured } from './supabase-client.js';
import { renderDashboard } from './admin-dashboard.js';
import { initAdminTable, renderTabla, abrirReportePorFolio } from './admin-table.js';
import { renderTendencias } from './admin-trends.js';
import { initPWA } from './pwa.js';
import { activarNotificacionesAdmin, pushDisponible } from './push.js';

if (!isSupabaseConfigured) {
  document.getElementById('backend-warning')?.classList.remove('hidden');
}

initAsociado();
initConsulta();
initQR();
initAdminTable();
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

/* Deep links desde notificaciones push (ver service-worker.js):
   ?folio=XXX        -> abre la consulta publica de ese folio (asociado)
   ?admin_folio=XXX  -> abre el modal de ese reporte en el panel admin
   Si el admin aun no ha iniciado sesion, el folio se guarda y se abre
   en cuanto el login se complete (ver onAdminLogin). */
let folioAdminPendiente = null;

function manejarDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const folio = params.get('folio');
  const adminFolio = params.get('admin_folio');

  if (folio) consultarFolioDesdeURL(folio);
  if (adminFolio) folioAdminPendiente = adminFolio;
}

function showAdminTab(name, el) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  ['dashboard', 'reportes', 'tendencias'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('hidden', t !== name);
  });
  if (name === 'reportes') renderTabla();
  if (name === 'tendencias') renderTendencias();
}
