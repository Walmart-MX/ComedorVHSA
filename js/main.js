import { initAsociado } from './asociado.js';
import { initConsulta } from './consulta.js';
import { initAuth } from './auth.js';
import { initQR } from './qr.js';
import { isSupabaseConfigured } from './supabase-client.js';
import { renderDashboard } from './admin-dashboard.js';
import { initAdminTable, renderTabla } from './admin-table.js';
import { renderTendencias } from './admin-trends.js';

if (!isSupabaseConfigured) {
  document.getElementById('backend-warning')?.classList.remove('hidden');
}

initAsociado();
initConsulta();
initQR();
initAdminTable();
initAuth({ onLogin: onAdminLogin });

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => showAdminTab(tab.dataset.tab, tab));
});

// Cuando se guarda una gestión en el modal, refrescamos dashboard + tabla.
document.addEventListener('reportes:actualizados', refrescarTodo);

function onAdminLogin() {
  refrescarTodo();
}

async function refrescarTodo() {
  await renderDashboard();
  const tabActiva = document.querySelector('.nav-tab.active')?.dataset.tab || 'dashboard';
  if (tabActiva === 'reportes') renderTabla();
  if (tabActiva === 'tendencias') renderTendencias();
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
