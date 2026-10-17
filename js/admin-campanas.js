import { supabase, isSupabaseConfigured } from './supabase-client.js';
import { escapeHtml, fechaLocalISO } from './catalog.js';
import { renderBarChart } from './bar-chart.js';

/* ═══════════════════════════════════════════════════════════════
   Pestaña "Campañas" del panel admin: crear/gestionar encuestas
   (ej. "elige el menú de la próxima semana") y avisos (ej.
   mantenimiento) que el asociado ve en su app. Ver migración
   20261011120000_campanas.sql para el modelo de datos y las
   políticas de seguridad.
═══════════════════════════════════════════════════════════════ */

const MIN_OPCIONES = 2;
const MAX_OPCIONES = 6;

export function initAdminCampanas() {
  document.getElementById('cam-tipo')?.addEventListener('change', actualizarVisibilidadOpciones);
  document.getElementById('btn-agregar-opcion')?.addEventListener('click', () => agregarOpcionInput());
  document.getElementById('btn-crear-campana')?.addEventListener('click', crearCampana);
  document.getElementById('campanas-lista')?.addEventListener('click', onClickLista);
  reiniciarFormulario();
}

/** Se llama cada vez que el admin abre la pestaña, para reflejar altas/bajas
    hechas desde otra sesión (mismo criterio que renderConfigTab/renderQR). */
export async function renderCampanasTab() {
  const box = document.getElementById('campanas-lista');
  if (!box) return;
  if (!isSupabaseConfigured) {
    box.innerHTML = '<p style="color:var(--text2);font-size:.85rem;">El sistema a\u00fan no est\u00e1 configurado.</p>';
    return;
  }
  box.innerHTML = '<p style="color:var(--text2);font-size:.85rem;">Cargando campañas...</p>';

  const { data: campanas, error } = await supabase
    .from('campanas')
    .select('*')
    .order('creado_en', { ascending: false });

  if (error) {
    console.error(error);
    box.innerHTML = '<p style="color:var(--text2);font-size:.85rem;">No se pudieron cargar las campañas.</p>';
    return;
  }

  if (!campanas || campanas.length === 0) {
    box.innerHTML = '<p style="color:var(--text2);font-size:.85rem;">Aún no has publicado ninguna campaña.</p>';
    return;
  }

  box.innerHTML = campanas.map(renderTarjetaCampana).join('');

  // Resultados de encuesta: una consulta de votos por campaña tipo encuesta.
  await Promise.all(campanas.filter(c => c.tipo === 'encuesta').map(renderResultadosCampana));
}

function estadoCampana(c) {
  const hoy = fechaLocalISO(new Date());
  if (!c.activa) return { texto: 'Inactiva', clase: 'badge-gray' };
  if (hoy < c.fecha_inicio) return { texto: 'Programada', clase: 'badge-blue' };
  if (hoy > c.fecha_fin) return { texto: 'Finalizada', clase: 'badge-gray' };
  return { texto: 'Vigente', clase: 'badge-green' };
}

function renderTarjetaCampana(c) {
  const estado = estadoCampana(c);
  const tipoLabel = c.tipo === 'encuesta' ? 'Encuesta' : 'Aviso';
  const rango = `${formatFecha(c.fecha_inicio)} – ${formatFecha(c.fecha_fin)}`;
  return `
    <div class="chart-card" style="margin-bottom:14px;" data-campana-id="${c.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div style="min-width:0;">
          <span class="badge badge-blue">${tipoLabel}</span>
          <span class="badge ${estado.clase}">${estado.texto}</span>
          <h4 style="margin-top:8px;font-size:.95rem;">${escapeHtml(c.titulo)}</h4>
          ${c.descripcion ? `<p style="font-size:.8rem;color:var(--text2);margin-top:4px;">${escapeHtml(c.descripcion)}</p>` : ''}
          <p style="font-size:.72rem;color:var(--text2);margin-top:6px;">${rango}</p>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;">
          <button type="button" class="btn-secondary" style="width:auto;padding:6px 12px;font-size:.75rem;" data-action="toggle" data-id="${c.id}" data-activa="${c.activa}">${c.activa ? 'Desactivar' : 'Activar'}</button>
          <button type="button" class="btn-secondary" style="width:auto;padding:6px 12px;font-size:.75rem;color:var(--red);" data-action="eliminar" data-id="${c.id}">Eliminar</button>
        </div>
      </div>
      ${c.tipo === 'encuesta' ? `<div class="bar-chart" id="cam-resultados-${c.id}" style="margin-top:14px;"></div>` : ''}
    </div>`;
}

async function renderResultadosCampana(c) {
  const { data: votos, error } = await supabase
    .from('campana_votos')
    .select('opcion')
    .eq('campana_id', c.id);

  const elementId = `cam-resultados-${c.id}`;
  if (error || !votos) {
    console.error(error);
    return;
  }
  if (votos.length === 0) {
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = '<p style="font-size:.78rem;color:var(--text2);">Todavía no hay votos.</p>';
    return;
  }

  const conteo = {};
  (c.opciones || []).forEach(op => { conteo[op] = 0; });
  votos.forEach(v => { conteo[v.opcion] = (conteo[v.opcion] || 0) + 1; });

  const items = Object.entries(conteo).map(([label, valor]) => ({ label, valor, clase: '' }));
  renderBarChart(elementId, items);
}

function formatFecha(iso) {
  return new Date(iso + 'T12:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function onClickLista(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === 'eliminar') eliminarCampana(id);
  if (btn.dataset.action === 'toggle') toggleActiva(id, btn.dataset.activa !== 'true');
}

async function eliminarCampana(id) {
  if (!confirm('¿Eliminar esta campaña? También se borrarán sus votos. Esta acción no se puede deshacer.')) return;
  const { error } = await supabase.from('campanas').delete().eq('id', id);
  if (error) {
    console.error(error);
    alert('No se pudo eliminar la campaña. Intenta de nuevo.');
    return;
  }
  renderCampanasTab();
}

async function toggleActiva(id, nuevoValor) {
  const { error } = await supabase.from('campanas').update({ activa: nuevoValor }).eq('id', id);
  if (error) {
    console.error(error);
    alert('No se pudo actualizar la campaña. Intenta de nuevo.');
    return;
  }
  renderCampanasTab();
}

/* ── Formulario de alta ── */

function actualizarVisibilidadOpciones() {
  const esEncuesta = document.getElementById('cam-tipo').value === 'encuesta';
  document.getElementById('cam-opciones-wrap').classList.toggle('hidden', !esEncuesta);
}

function agregarOpcionInput(valor = '') {
  const lista = document.getElementById('cam-opciones-lista');
  if (lista.children.length >= MAX_OPCIONES) return;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:6px;';
  row.innerHTML = `
    <input class="form-input cam-opcion-input" type="text" placeholder="Opción" maxlength="80" value="${escapeHtml(valor)}">
    <button type="button" class="btn-secondary cam-quitar-opcion" style="width:auto;padding:6px 10px;flex-shrink:0;">&times;</button>`;
  row.querySelector('.cam-quitar-opcion').addEventListener('click', () => {
    if (lista.children.length > MIN_OPCIONES) row.remove();
  });
  lista.appendChild(row);
}

function reiniciarFormulario() {
  document.getElementById('cam-tipo').value = 'encuesta';
  document.getElementById('cam-titulo').value = '';
  document.getElementById('cam-descripcion').value = '';
  document.getElementById('cam-inicio').value = '';
  document.getElementById('cam-fin').value = '';
  const lista = document.getElementById('cam-opciones-lista');
  if (lista) {
    lista.innerHTML = '';
    for (let i = 0; i < MIN_OPCIONES; i++) agregarOpcionInput();
  }
  actualizarVisibilidadOpciones();
  ocultarMensaje();
}

function ocultarMensaje() {
  document.getElementById('cam-msg')?.classList.add('hidden');
}

function mostrarMensaje(texto, tipo) {
  const msg = document.getElementById('cam-msg');
  if (!msg) return;
  msg.textContent = texto;
  msg.className = `form-hint ${tipo === 'error' ? 'cfg-msg-error' : 'cfg-msg-ok'}`;
  msg.classList.remove('hidden');
}

async function crearCampana() {
  ocultarMensaje();
  const tipo = document.getElementById('cam-tipo').value;
  const titulo = document.getElementById('cam-titulo').value.trim();
  const descripcion = document.getElementById('cam-descripcion').value.trim();
  const fechaInicio = document.getElementById('cam-inicio').value;
  const fechaFin = document.getElementById('cam-fin').value;

  if (!titulo || !fechaInicio || !fechaFin) {
    mostrarMensaje('Completa título, fecha de inicio y fecha de fin.', 'error');
    return;
  }
  if (fechaFin < fechaInicio) {
    mostrarMensaje('La fecha de fin no puede ser anterior a la fecha de inicio.', 'error');
    return;
  }

  let opciones = null;
  if (tipo === 'encuesta') {
    opciones = Array.from(document.querySelectorAll('.cam-opcion-input'))
      .map(input => input.value.trim())
      .filter(Boolean);
    if (opciones.length < MIN_OPCIONES) {
      mostrarMensaje(`Agrega al menos ${MIN_OPCIONES} opciones para la encuesta.`, 'error');
      return;
    }
  }

  const btn = document.getElementById('btn-crear-campana');
  btn.disabled = true;
  btn.textContent = 'Publicando...';
  const { error } = await supabase.from('campanas').insert({
    tipo, titulo, descripcion: descripcion || null,
    opciones, fecha_inicio: fechaInicio, fecha_fin: fechaFin
  });
  btn.disabled = false;
  btn.textContent = 'Publicar campaña';

  if (error) {
    console.error(error);
    mostrarMensaje('No se pudo publicar la campaña. Intenta de nuevo.', 'error');
    return;
  }

  reiniciarFormulario();
  mostrarMensaje('Campaña publicada correctamente.', 'ok');
  renderCampanasTab();
}
