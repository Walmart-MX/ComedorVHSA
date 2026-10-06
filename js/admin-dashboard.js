import { supabase } from './supabase-client.js';
import { CAT_NAMES, CEDIS_NAMES, escapeHtml } from './catalog.js';

let cachedReportes = [];

export function getCachedReportes() {
  return cachedReportes;
}

export async function cargarReportes() {
  const cedisF = document.getElementById('admin-cedis-filter')?.value || 'todos';
  let query = supabase.from('reportes').select('*').order('creado_en', { ascending: false });
  if (cedisF !== 'todos') query = query.eq('cedis', cedisF);
  const { data, error } = await query;
  if (error) {
    console.error('No se pudieron cargar los reportes:', error.message);
    cachedReportes = [];
    return cachedReportes;
  }
  cachedReportes = data || [];
  return cachedReportes;
}

export async function renderDashboard() {
  const r = await cargarReportes();
  const hoy = new Date().toISOString().split('T')[0];
  const fechaDe = (x) => x.creado_en.split('T')[0];

  const kpis = [
    { n: r.length, l: 'Total de reportes', c: '' },
    { n: r.filter(x => fechaDe(x) === hoy).length, l: 'Reportes hoy', c: '' },
    { n: r.filter(x => x.estatus === 'pendiente').length, l: 'Pendientes', c: 'red' },
    { n: r.filter(x => x.estatus === 'revision').length, l: 'En revisión', c: 'amber' },
    { n: r.filter(x => x.estatus === 'atendido').length, l: 'Atendidos', c: 'green' },
    { n: r.filter(x => x.estatus === 'cerrado').length, l: 'Cerrados', c: '' },
    { n: r.filter(x => x.prioridad === 'alta').length, l: 'Prioridad alta', c: 'red' },
    { n: tiempoPromedioGlobal(r), l: 'Tiempo prom. atención (días)', c: '' }
  ];
  document.getElementById('kpi-grid').innerHTML = kpis.map(k =>
    `<div class="kpi-card ${k.c}"><div class="kpi-num">${escapeHtml(k.n)}</div><div class="kpi-label">${escapeHtml(k.l)}</div></div>`
  ).join('');

  renderBarChart('chart-cat', agruparPor(r, 'categoria', CAT_NAMES));
  renderBarChart('chart-dias', ultimosDias(r));
  renderBarChart('chart-pri', [
    { label: 'Alta', valor: r.filter(x => x.prioridad === 'alta').length, clase: 'red' },
    { label: 'Media', valor: r.filter(x => x.prioridad === 'media').length, clase: 'amber' },
    { label: 'Baja', valor: r.filter(x => x.prioridad === 'baja').length, clase: 'green' }
  ]);
  renderBarChart('chart-cedis', agruparPor(r, 'cedis', CEDIS_NAMES));

  renderTendenciaAlert(r);
}

/** Tiempo promedio real (días) entre creación y última actualización de reportes ya atendidos/cerrados. */
function tiempoPromedioGlobal(r) {
  const atendidos = r.filter(x => x.estatus === 'atendido' || x.estatus === 'cerrado');
  if (atendidos.length === 0) return 'N/A';
  const totalDias = atendidos.reduce((acc, x) => {
    const dias = (new Date(x.actualizado_en) - new Date(x.creado_en)) / 86400000;
    return acc + Math.max(dias, 0);
  }, 0);
  return (totalDias / atendidos.length).toFixed(1);
}

function agruparPor(lista, campo, nombres) {
  const conteo = {};
  lista.forEach(x => { conteo[x[campo]] = (conteo[x[campo]] || 0) + 1; });
  return Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: nombres?.[k] || k, valor: v, clase: '' }));
}

function ultimosDias(lista) {
  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dias.push(d.toISOString().split('T')[0]);
  }
  const conteo = {};
  dias.forEach(d => { conteo[d] = 0; });
  lista.forEach(x => {
    const f = x.creado_en.split('T')[0];
    if (conteo[f] !== undefined) conteo[f]++;
  });
  return dias.map(d => ({
    label: new Date(d + 'T12:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
    valor: conteo[d],
    clase: ''
  }));
}

function renderBarChart(elementId, items) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const max = Math.max(...items.map(i => i.valor), 1);
  el.innerHTML = items.map(i => `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(i.label)}</div>
      <div class="bar-track"><div class="bar-fill ${i.clase}" style="width:${Math.round(i.valor / max * 100)}%"></div></div>
      <div class="bar-val">${i.valor}</div>
    </div>`).join('');
}

/** Alerta de tendencia: compara últimos 7 días vs los 7 anteriores por categoría. */
function renderTendenciaAlert(r) {
  const box = document.getElementById('trend-alert');
  if (!box) return;
  const now = Date.now();
  const diasDesde = (x) => (now - new Date(x.creado_en).getTime()) / 86400000;

  const actual = {};
  const previo = {};
  r.forEach(x => {
    const d = diasDesde(x);
    if (d < 7) actual[x.categoria] = (actual[x.categoria] || 0) + 1;
    else if (d < 14) previo[x.categoria] = (previo[x.categoria] || 0) + 1;
  });

  let peorCat = null, peorIncremento = 0;
  Object.keys(actual).forEach(cat => {
    const incremento = actual[cat] - (previo[cat] || 0);
    if (incremento > peorIncremento) { peorIncremento = incremento; peorCat = cat; }
  });

  if (!peorCat || peorIncremento < 2) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'flex';
  box.innerHTML = `
    <div class="icon">!</div>
    <p><strong>Tendencia detectada</strong>Incremento de reportes de <strong>${escapeHtml(CAT_NAMES[peorCat] || peorCat)}</strong> en los últimos 7 días (+${peorIncremento} vs. semana anterior). Se recomienda revisión del área correspondiente.</p>`;
}
