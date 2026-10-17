import { supabase, isSupabaseConfigured } from './supabase-client.js';
import {
  CAT_NAMES, COMEDOR_NAMES, PRI_LABELS, PRI_BADGE,
  STATUS_LABELS, STATUS_BADGE, fechaLocalISO, escapeHtml
} from './catalog.js';
import { getCachedReportes } from './admin-dashboard.js';
import { CAMERA_ICON } from './icons.js';

let editingId = null;

export function initAdminTable() {
  ['f-search', 'f-comedor', 'f-cat', 'f-pri', 'f-status'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('input', renderTabla);
    el?.addEventListener('change', renderTabla);
  });
  document.getElementById('f-foto')?.addEventListener('change', renderTabla);
  document.getElementById('btn-export-csv')?.addEventListener('click', exportCSV);
  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
  document.getElementById('m-status-sel')?.addEventListener('change', cambiarEstatusPendiente);
  document.getElementById('btn-guardar-accion')?.addEventListener('click', guardarAccion);
}

/** Fecha y hora en la zona LOCAL del navegador -- ver nota en fechaLocalISO()
    sobre por que nunca hay que usar creado_en.split('T') crudo (eso muestra
    la hora UTC de Postgres como si fuera la hora local del CEDIS). */
function formatFecha(creadoEn) {
  return new Date(creadoEn).toLocaleDateString('es-MX');
}
function formatHora(creadoEn) {
  return new Date(creadoEn).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export function renderTabla() {
  let r = getCachedReportes();
  const search = document.getElementById('f-search')?.value.toLowerCase() || '';
  const comedorF = document.getElementById('f-comedor')?.value || '';
  const catF = document.getElementById('f-cat')?.value || '';
  const priF = document.getElementById('f-pri')?.value || '';
  const staF = document.getElementById('f-status')?.value || '';
  const soloFoto = document.getElementById('f-foto')?.checked || false;
  if (search) r = r.filter(x => x.folio.toLowerCase().includes(search));
  if (comedorF) r = r.filter(x => x.comedor === comedorF);
  if (catF) r = r.filter(x => x.categoria === catF);
  if (priF) r = r.filter(x => x.prioridad === priF);
  if (staF) r = r.filter(x => x.estatus === staF);
  if (soloFoto) r = r.filter(x => !!x.foto_url);
  r = [...r].sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));

  document.getElementById('tabla-body').innerHTML = r.map(x => `
    <tr>
      <td><span class="td-folio" data-id="${x.id}">${escapeHtml(x.folio)}${x.es_demo ? '<br><span style="font-size:.6rem;color:var(--text2);">demo</span>' : ''}</span></td>
      <td>${escapeHtml(formatFecha(x.creado_en))}</td><td>${escapeHtml(formatHora(x.creado_en))}</td>
      <td>${COMEDOR_NAMES[x.comedor] || x.comedor}</td>
      <td>${escapeHtml(CAT_NAMES[x.categoria] || x.categoria)}</td>
      <td><span class="badge ${PRI_BADGE[x.prioridad]}">${PRI_LABELS[x.prioridad]}</span></td>
      <td class="td-foto" data-id="${x.id}" title="${x.foto_url ? 'Con foto adjunta' : 'Sin foto'}">${x.foto_url ? `<span style="color:var(--blue);">${CAMERA_ICON}<span class="sr-only">Con foto adjunta</span></span>` : `<span aria-hidden="true" style="color:var(--text2);">\u2014</span>`}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(x.descripcion)}">${escapeHtml(x.descripcion)}</td>
      <td><span class="badge ${STATUS_BADGE[x.estatus]}">${STATUS_LABELS[x.estatus]}</span></td>
      <td><button type="button" class="btn-ver-reporte" data-id="${x.id}">Ver reporte</button></td>
    </tr>`).join('');

  document.querySelectorAll('.td-folio, .td-foto, .btn-ver-reporte').forEach(el =>
    el.addEventListener('click', () => openModal(Number(el.dataset.id))));
}

async function openModal(id) {
  const r = getCachedReportes().find(x => x.id === id);
  if (!r) return;
  editingId = id;
  document.getElementById('m-folio').textContent = r.folio + (r.es_demo ? ' (DEMO)' : '');
  document.getElementById('m-fecha').textContent = `${formatFecha(r.creado_en)} ${formatHora(r.creado_en)}`;
  document.getElementById('m-cat').textContent = CAT_NAMES[r.categoria] || r.categoria;
  document.getElementById('m-pri').textContent = PRI_LABELS[r.prioridad];
  document.getElementById('m-comedor').textContent = COMEDOR_NAMES[r.comedor] || r.comedor;
  document.getElementById('m-desc').textContent = r.descripcion;
  mostrarFotoEnModal(r.foto_url);
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

// Muestra la foto de evidencia en el modal si el reporte tiene una (foto_url),
// o un texto "Sin foto adjunta" si no. La imagen es clickeable para abrirla
// a tamano completo en una pestana nueva.
function mostrarFotoEnModal(fotoUrl) {
  const img = document.getElementById('m-foto-img');
  const link = document.getElementById('m-foto-link');
  const vacio = document.getElementById('m-foto-vacio');
  if (fotoUrl) {
    img.src = fotoUrl;
    link.href = fotoUrl;
    img.style.display = 'block';
    link.style.display = 'block';
    vacio.style.display = 'none';
  } else {
    img.removeAttribute('src');
    img.style.display = 'none';
    link.style.display = 'none';
    vacio.style.display = 'block';
  }
}

/** Deep link desde una notificacion push de admin (?admin_folio=XXX).
    Busca en el cache ya cargado -- si el admin apenas inicio sesion,
    main.js espera a que renderDashboard() llene el cache antes de llamar esto. */
export function abrirReportePorFolio(folio) {
  const r = getCachedReportes().find(x => x.folio === folio);
  if (r) openModal(r.id);
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
    alert('No se pudo guardar el seguimiento. Intenta de nuevo.');
    return;
  }
  closeModal();
  document.dispatchEvent(new CustomEvent('reportes:actualizados'));
  alert('Seguimiento guardado correctamente.');
}

function exportCSV() {
  const r = getCachedReportes();
  const headers = ['Folio', 'Fecha', 'Comedor', 'Categoria', 'Prioridad', 'Situacion', 'Estado', 'Responsable', 'Accion implementada', 'Foto adjunta', 'Demo'];
  const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = r.map(x => [
    x.folio, fechaLocalISO(x.creado_en),
    COMEDOR_NAMES[x.comedor] || x.comedor,
    CAT_NAMES[x.categoria] || x.categoria, x.prioridad,
    x.descripcion, x.estatus, x.responsable || '', x.accion || '',
    x.foto_url ? 'SI' : 'NO',
    x.es_demo ? 'SI' : 'NO'
  ].map(csvCell).join(','));
  const csv = [headers.map(csvCell).join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reportes-comedor-${fechaLocalISO(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
