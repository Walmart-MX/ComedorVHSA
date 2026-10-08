import { supabase, isSupabaseConfigured } from './supabase-client.js';
import { CAT_NAMES, COMEDOR_NAMES, STATUS_PUBLICO, escapeHtml } from './catalog.js';

export function initConsulta() {
  document.getElementById('btn-ir-consulta').addEventListener('click', mostrarConsulta);
  document.getElementById('btn-volver-inicio-consulta').addEventListener('click', volverInicio);
  document.getElementById('btn-consultar-folio').addEventListener('click', buscarFolio);
  document.getElementById('consulta-folio').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); buscarFolio(); }
  });
}

function mostrarConsulta() {
  document.getElementById('step-1').classList.add('hidden');
  document.getElementById('step-consulta').classList.remove('hidden');
  document.getElementById('consulta-resultado').classList.add('hidden');
  document.getElementById('consulta-no-encontrado').classList.add('hidden');
}

function volverInicio() {
  document.getElementById('step-consulta').classList.add('hidden');
  document.getElementById('step-1').classList.remove('hidden');
}

async function buscarFolio() {
  const folio = document.getElementById('consulta-folio').value.trim().toUpperCase();
  await ejecutarConsulta(folio);
}

/** Entrada para deep links (?folio=XXX en la URL, ver service-worker.js /
    js/main.js). Lleva al usuario directo a la pantalla de consulta con el
    folio ya resuelto, sin que tenga que volver a escribirlo. */
export function consultarFolioDesdeURL(folio) {
  mostrarConsulta();
  const input = document.getElementById('consulta-folio');
  input.value = folio.trim().toUpperCase();
  ejecutarConsulta(input.value);
}

async function ejecutarConsulta(folio) {
  const resultado = document.getElementById('consulta-resultado');
  const noEncontrado = document.getElementById('consulta-no-encontrado');
  const cargando = document.getElementById('consulta-cargando');

  resultado.classList.add('hidden');
  noEncontrado.classList.add('hidden');

  if (!folio) {
    noEncontrado.textContent = 'Escribe un folio para consultar.';
    noEncontrado.classList.remove('hidden');
    return;
  }
  if (!isSupabaseConfigured) return;

  cargando.classList.remove('hidden');
  const btn = document.getElementById('btn-consultar-folio');
  btn.disabled = true;

  const [{ data, error }, { data: historial }] = await Promise.all([
    supabase.rpc('consultar_reporte', { p_folio: folio }),
    supabase.rpc('consultar_historial_publico', { p_folio: folio })
  ]);

  cargando.classList.add('hidden');
  btn.disabled = false;

  if (error || !data || data.length === 0) {
    noEncontrado.textContent = 'No encontramos un reporte con ese folio. Verifica que esté completo y sin espacios.';
    noEncontrado.classList.remove('hidden');
    return;
  }

  renderResultado(data[0], historial || []);
}

function renderResultado(r, historial) {
  document.getElementById('q-folio').textContent = r.folio;
  document.getElementById('q-cat').textContent = CAT_NAMES[r.categoria] || r.categoria;
  document.getElementById('q-comedor').textContent = COMEDOR_NAMES[r.comedor] || r.comedor;
  document.getElementById('q-fecha').textContent = new Date(r.creado_en).toLocaleString('es-MX');
  document.getElementById('q-actualizado').textContent = new Date(r.actualizado_en).toLocaleString('es-MX');
  document.getElementById('q-estado').textContent = STATUS_PUBLICO[r.estatus] || r.estatus;
  document.getElementById('q-desc').textContent = r.descripcion;

  // Linea de tiempo publica: solo estatus + fecha (nunca usuario/nota internos).
  const box = document.getElementById('q-historial');
  if (!historial.length) {
    box.innerHTML = '<p style="font-size:.78rem;color:var(--text2);">Sin movimientos registrados todavía.</p>';
  } else {
    box.innerHTML = historial.map(h => `
      <div class="history-item">
        <div class="history-dot"></div>
        <div class="history-text">
          <strong>${escapeHtml(STATUS_PUBLICO[h.estatus_nuevo] || h.estatus_nuevo)}</strong><br>
          ${new Date(h.creado_en).toLocaleString('es-MX')}
        </div>
      </div>`).join('');
  }

  document.getElementById('consulta-resultado').classList.remove('hidden');
}
