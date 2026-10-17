/* ═══════════════════════════════════════════════════════════════
   Campañas (encuestas y avisos) del lado del asociado: un banner en
   inicio avisa que hay novedades, y una pantalla aparte lista todas
   las campañas vigentes (RLS ya filtra activas + en rango de fechas,
   ver 20261011120000_campanas.sql -- este archivo no vuelve a validar
   eso, confía en la política del servidor).

   "Un voto por dispositivo" es a propósito solo del lado del cliente
   (localStorage): no existe ningún identificador de dispositivo en el
   servidor -- guardar uno rompería el anonimato total del proyecto.
   No es infalible (borrar datos del navegador permite volver a votar),
   pero es el trade-off correcto para no sacrificar la anonimidad.
═══════════════════════════════════════════════════════════════ */

import { supabase, isSupabaseConfigured } from './supabase-client.js';
import { escapeHtml } from './catalog.js';
import { renderBarChart } from './bar-chart.js';

const LS_PREFIX = 'campana_voto_';

export function initCampanas() {
  document.getElementById('btn-ver-campanas')?.addEventListener('click', mostrarCampanas);
  document.getElementById('btn-volver-inicio-campanas')?.addEventListener('click', volverInicio);
  document.getElementById('campanas-contenido')?.addEventListener('click', onClickVotar);
  cargarBanner();
}

/** Trae las campañas vigentes una sola vez al cargar la app, solo para
    decidir si mostrar el banner de inicio y con qué texto. */
async function cargarBanner() {
  if (!isSupabaseConfigured) return;
  const { data, error } = await supabase.from('campanas').select('titulo');
  const banner = document.getElementById('campanas-banner');
  if (error || !data || data.length === 0 || !banner) return;

  document.getElementById('campanas-banner-titulo').textContent =
    data.length === 1 ? data[0].titulo : `Tenemos ${data.length} novedades para ti`;
  banner.classList.remove('hidden');
}

function mostrarCampanas() {
  document.getElementById('step-1').classList.add('hidden');
  document.getElementById('step-campanas').classList.remove('hidden');
  renderListaCampanas();
}

function volverInicio() {
  document.getElementById('step-campanas').classList.add('hidden');
  document.getElementById('step-1').classList.remove('hidden');
}

async function renderListaCampanas() {
  const box = document.getElementById('campanas-contenido');
  if (!box) return;
  box.innerHTML = '<p style="color:var(--text2);font-size:.85rem;">Cargando...</p>';

  if (!isSupabaseConfigured) {
    box.innerHTML = '<p style="color:var(--text2);font-size:.85rem;">El sistema no está disponible en este momento.</p>';
    return;
  }

  const { data, error } = await supabase.from('campanas').select('*').order('creado_en', { ascending: false });
  if (error || !data) {
    box.innerHTML = '<p style="color:var(--text2);font-size:.85rem;">No se pudieron cargar los avisos. Intenta de nuevo.</p>';
    return;
  }
  if (data.length === 0) {
    box.innerHTML = '<p style="color:var(--text2);font-size:.85rem;">No hay avisos ni encuestas por el momento. Vuelve pronto.</p>';
    return;
  }

  box.innerHTML = data.map(renderTarjeta).join('');
  await Promise.all(
    data.filter(c => c.tipo === 'encuesta' && yaVoto(c.id)).map(mostrarResultados)
  );
}

function yaVoto(campanaId) {
  return !!localStorage.getItem(LS_PREFIX + campanaId);
}

function renderTarjeta(c) {
  if (c.tipo === 'aviso') {
    return `
      <div class="campana-card">
        <span class="badge badge-blue">Aviso</span>
        <h3>${escapeHtml(c.titulo)}</h3>
        ${c.descripcion ? `<p>${escapeHtml(c.descripcion)}</p>` : ''}
      </div>`;
  }

  if (yaVoto(c.id)) {
    return `
      <div class="campana-card">
        <span class="badge badge-green">Encuesta · ya votaste, gracias</span>
        <h3>${escapeHtml(c.titulo)}</h3>
        ${c.descripcion ? `<p>${escapeHtml(c.descripcion)}</p>` : ''}
        <div class="bar-chart" id="campana-resultados-${c.id}" style="margin-top:10px;"></div>
      </div>`;
  }

  const opciones = (c.opciones || []).map(op => `
    <label class="campana-opcion">
      <input type="radio" name="campana-${c.id}" value="${escapeHtml(op)}">
      <span>${escapeHtml(op)}</span>
    </label>`).join('');

  return `
    <div class="campana-card" data-campana-id="${c.id}">
      <span class="badge badge-blue">Encuesta</span>
      <h3>${escapeHtml(c.titulo)}</h3>
      ${c.descripcion ? `<p>${escapeHtml(c.descripcion)}</p>` : ''}
      <div class="campana-opciones">${opciones}</div>
      <button type="button" class="btn-primary campana-votar" data-id="${c.id}" style="margin-top:10px;width:auto;padding:8px 20px;">Votar</button>
    </div>`;
}

async function onClickVotar(e) {
  const btn = e.target.closest('.campana-votar');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const card = btn.closest('.campana-card');
  const seleccion = card?.querySelector(`input[name="campana-${id}"]:checked`);
  if (!seleccion) {
    alert('Elige una opción antes de votar.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Enviando...';
  const { error } = await supabase.from('campana_votos').insert({ campana_id: id, opcion: seleccion.value });
  if (error) {
    console.error(error);
    btn.disabled = false;
    btn.textContent = 'Votar';
    alert('No se pudo registrar tu voto. Intenta de nuevo.');
    return;
  }

  localStorage.setItem(LS_PREFIX + id, seleccion.value);
  renderListaCampanas(); // re-pinta todo: simple, y ya trae el resultado fresco
}

async function mostrarResultados(c) {
  const { data: votos, error } = await supabase.from('campana_votos').select('opcion').eq('campana_id', c.id);
  const elementId = `campana-resultados-${c.id}`;
  const el = document.getElementById(elementId);
  if (!el) return;
  if (error || !votos || votos.length === 0) {
    el.innerHTML = '<p style="font-size:.78rem;color:var(--text2);">Sé el primero en votar.</p>';
    return;
  }

  const conteo = {};
  (c.opciones || []).forEach(op => { conteo[op] = 0; });
  votos.forEach(v => { conteo[v.opcion] = (conteo[v.opcion] || 0) + 1; });

  const items = Object.entries(conteo).map(([label, valor]) => ({ label, valor, clase: '' }));
  renderBarChart(elementId, items);
}
