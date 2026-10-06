import { supabase, isSupabaseConfigured } from './supabase-client.js';
import {
  CAT_NAMES, CEDIS_NAMES, PRI_LABELS, PRI_BADGE,
  STATUS_LABELS, STATUS_BADGE, escapeHtml
} from './catalog.js';
import { getCachedReportes } from './admin-dashboard.js';

let editingId = null;

export function initAdminTable() {
  ['f-search', 'f-cat', 'f-pri', 'f-status'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('input', renderTabla);
    el?.addEventListener('change', renderTabla);
  });
  document.getElementById('btn-export-csv')?.addEventListener('click', exportCSV);
  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
  document.getElementById('m-status-sel')?.addEventListener('change', cambiarEstatusPendiente);
  document.getElementById('btn-guardar-accion')?.addEventListener('click', guardarAccion);
}

export function renderTabla() {
  let r = getCachedReportes();
  const search = document.getElementById('f-search')?.value.toLowerCase() || '';
  const catF = document.getElementById('f-cat')?.value || '';
  const priF = document.getElementById('f-pri')?.value || '';
  const staF = document.getElementById('f-status')?.value || '';
  if (search) r = r.filter(x => x.folio.toLowerCase().includes(search));
  if (catF) r = r.filter(x => x.categoria === catF);
  if (priF) r = r.filter(x => x.prioridad === priF);
  if (staF) r = r.filter(x => x.estatus === staF);
  r = [...r].sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));

  document.getElementById('tabla-body').innerHTML = r.map(x => `
    <tr>
      <td><span class="td-folio" data-id="${x.id}">${escapeHtml(x.folio)}${x.es_demo ? '<br><span style="font-size:.6rem;color:var(--text2);">demo</span>' : ''}</span></td>
      <td>${escapeHtml(x.creado_en.split('T')[0])}</td><td>${escapeHtml(x.creado_en.split('T')[1]?.slice(0, 5) || '')}</td>
      <td>${escapeHtml(CEDIS_NAMES[x.cedis] || x.cedis)}</td>
      <td>${x.comedor === 'principal' ? 'Principal' : 'Secundario'}</td>
      <td>${escapeHtml(CAT_NAMES[x.categoria] || x.categoria)}</td>
      <td><span class="badge ${PRI_BADGE[x.prioridad]}">${PRI_LABELS[x.prioridad]}</span></td>
      <td>${escapeHtml(x.nombre || 'Anónimo')}<br><span style="font-size:.68rem;color:var(--text2);">${escapeHtml(x.numero_empleado)}</span></td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(x.descripcion)}">${escapeHtml(x.descripcion)}</td>
      <td><span class="badge ${STATUS_BADGE[x.estatus]}">${STATUS_LABELS[x.estatus]}</span></td>
    </tr>`).join('');

  document.querySelectorAll('.td-folio').forEach(el =>
    el.addEventListener('click', () => openModal(Number(el.dataset.id))));
}

async function openModal(id) {
  const r = getCachedReportes().find(x => x.id === id);
  if (!r) return;
  editingId = id;
  document.getElementById('m-folio').textContent = r.folio + (r.es_demo ? ' (DEMO)' : '');
  document.getElementById('m-fecha').textContent = `${r.creado_en.split('T')[0]} ${r.creado_en.split('T')[1]?.slice(0, 5) || ''}`;
  document.getElementById('m-cat').textContent = CAT_NAMES[r.categoria] || r.categoria;
  document.getElementById('m-pri').textContent = PRI_LABELS[r.prioridad];
  document.getElementById('m-cedis').textContent = CEDIS_NAMES[r.cedis] || r.cedis;
  document.getElementById('m-comedor').textContent = r.comedor === 'principal' ? 'Principal' : 'Secundario';
  document.getElementById('m-asociado').textContent = r.nombre || 'Anónimo';
  document.getElementById('m-empleado').textContent = r.numero_empleado;
  document.getElementById('m-desc').textContent = r.descripcion;
  document.getElementById('m-status-sel').value = r.estatus;
  document.getElementById('m-status-sel').dataset.original = r.estatus;
  document.getElementById('m-responsable').value = r.responsable || '';
  document.getElementById('m-accion').value = r.accion || '';
  document.getElementById('m-fecha-comp').value = r.fecha_compromiso || '';
  document.getElementById('modal-detalle').classList.remove('hidden');

  await cargarHistorial(id);
}

async function cargarHistorial(reporteId) {
  const box = document.getElementById('m-historial');
  if (!isSupabaseConfigured) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = '<p style="font-size:.78rem;color:var(--text2);">Cargando...</p>';
  const { data, error } = await supabase
    .from('reportes_historial')
    .select('*')
    .eq('reporte_id', reporteId)
    .order('creado_en', { ascending: true });
  if (error) {
    box.innerHTML = '<p style="font-size:.78rem;color:var(--text2);">No se pudo cargar el historial.</p>';
    return;
  }
  box.innerHTML = (data || []).map(h => `
    <div class="history-item">
      <div class="history-dot"></div>
      <div class="history-text">
        <strong>${h.estatus_anterior ? `${STATUS_LABELS[h.estatus_anterior]} -> ${STATUS_LABELS[h.estatus_nuevo]}` : STATUS_LABELS[h.estatus_nuevo]}</strong>
        ${new Date(h.creado_en).toLocaleString('es-MX')} - ${escapeHtml(h.usuario)}${h.nota ? `<br>${escapeHtml(h.nota)}` : ''}
      </div>
    </div>`).join('');
}

function closeModal() {
  document.getElementById('modal-detalle').classList.add('hidden');
  editingId = null;
}

// El cambio real de estatus se guarda hasta dar "Guardar gestión" (evita updates a medias).
function cambiarEstatusPendiente() { /* el valor queda en el <select>, se persiste en guardarAccion() */ }

async function guardarAccion() {
  if (editingId === null) return;
  if (!isSupabaseConfigured) return;
  const nuevoEstatus = document.getElementById('m-status-sel').value;
  const payload = {
    estatus: nuevoEstatus,
    responsable: document.getElementById('m-responsable').value,
    accion: document.getElementById('m-accion').value,
    fecha_compromiso: document.getElementById('m-fecha-comp').value || null
  };
  const { error } = await supabase.from('reportes').update(payload).eq('id', editingId);
  if (error) {
    console.error(error);
    alert('No se pudo guardar la gestión. Intenta de nuevo.');
    return;
  }
  closeModal();
  document.dispatchEvent(new CustomEvent('reportes:actualizados'));
  alert('Gestión guardada correctamente.');
}

function exportCSV() {
  const r = getCachedReportes();
  const headers = ['Folio', 'Fecha', 'CEDIS', 'Comedor', 'Categoria', 'Prioridad', 'Asociado', 'No Empleado', 'Descripcion', 'Estatus', 'Responsable', 'Accion', 'Demo'];
  const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = r.map(x => [
    x.folio, x.creado_en.split('T')[0], CEDIS_NAMES[x.cedis] || x.cedis,
    x.comedor === 'principal' ? 'Principal' : 'Secundario',
    CAT_NAMES[x.categoria] || x.categoria, x.prioridad, x.nombre || 'Anonimo',
    x.numero_empleado, x.descripcion, x.estatus, x.responsable || '', x.accion || '',
    x.es_demo ? 'SI' : 'NO'
  ].map(csvCell).join(','));
  const csv = [headers.map(csvCell).join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reportes-comedor-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
