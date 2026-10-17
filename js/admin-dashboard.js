import { supabase, isSupabaseConfigured } from './supabase-client.js';
import { CAT_NAMES, COMEDOR_NAMES, fechaLocalISO, escapeHtml } from './catalog.js';
import {
  TREND_ICON, CLIPBOARD_ICON, CALENDAR_ICON, ALERT_CIRCLE_ICON,
  EYE_ICON, CHECK_CIRCLE_ICON, LOCK_ICON, ALERT_TRIANGLE_ICON, CLOCK_ICON
} from './icons.js';
import { renderKpiGrid } from './kpi-grid.js';

let cachedReportes = [];

export function getCachedReportes() {
  return cachedReportes;
}

export async function cargarReportes() {
  if (!isSupabaseConfigured) {
    cachedReportes = [];
    return cachedReportes;
  }
  const { data, error } = await supabase.from('reportes').select('*').order('creado_en', { ascending: false });
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

  // Indicadores: uno global y uno por nave (secos/perecederos), misma
  // tarjeta y misma fórmula para los tres -- construirKpis() no sabe ni
  // le importa si la lista que recibe ya viene filtrada por comedor.
  renderKpiGrid('kpi-grid', construirKpis(r));
  renderKpiGrid('kpi-grid-secos', construirKpis(r.filter(x => x.comedor === 'secos')));
  renderKpiGrid('kpi-grid-perecederos', construirKpis(r.filter(x => x.comedor === 'perecederos')));

  renderBarChart('chart-cat', agruparPor(r, 'categoria', CAT_NAMES));
  renderBarChart('chart-dias', ultimosDias(r));
  renderBarChart('chart-pri', [
    { label: 'Alta', valor: r.filter(x => x.prioridad === 'alta').length, clase: 'red' },
    { label: 'Media', valor: r.filter(x => x.prioridad === 'media').length, clase: 'amber' },
    { label: 'Baja', valor: r.filter(x => x.prioridad === 'baja').length, clase: 'green' }
  ]);
  renderBarChart('chart-cedis', agruparPor(r, 'comedor', COMEDOR_NAMES));

  renderTendenciaAlert(r);
}

/** Arma el set de 8 indicadores a partir de CUALQUIER lista de reportes --
    la lista completa para el indicador global, o ya filtrada por comedor
    para el indicador de una nave. Una sola fórmula, nunca duplicada. */
function construirKpis(lista) {
  const hoy = fechaLocalISO(new Date());
  const fechaDe = (x) => fechaLocalISO(x.creado_en);
  const vencidos = lista.filter(x =>
    x.fecha_compromiso && x.fecha_compromiso < hoy &&
    x.estatus !== 'atendido' && x.estatus !== 'cerrado'
  ).length;
  return [
    { n: lista.length, l: 'Total de reportes', c: '', icono: CLIPBOARD_ICON },
    { n: lista.filter(x => fechaDe(x) === hoy).length, l: 'Reportes hoy', c: '', icono: CALENDAR_ICON },
    { n: lista.filter(x => x.estatus === 'pendiente').length, l: 'Pendientes', c: 'red', icono: ALERT_CIRCLE_ICON },
    { n: lista.filter(x => x.estatus === 'revision').length, l: 'En revisión', c: 'amber', icono: EYE_ICON },
    { n: lista.filter(x => x.estatus === 'atendido').length, l: 'Atendidos', c: 'green', icono: CHECK_CIRCLE_ICON },
    { n: lista.filter(x => x.estatus === 'cerrado').length, l: 'Cerrados', c: '', icono: LOCK_ICON },
    { n: vencidos, l: 'Vencidos', c: vencidos > 0 ? 'red' : '', icono: ALERT_TRIANGLE_ICON },
    { n: tiempoPromedioGlobal(lista), l: 'Tiempo promedio de atención (días)', c: '', icono: CLOCK_ICON }
  ];
}

/** Tiempo promedio real (días) entre creación y última actualización de
    reportes ya atendidos/cerrados. Exportada porque admin-trends.js la
    reutiliza para su propio indicador -- misma fórmula, un solo lugar. */
export function tiempoPromedioGlobal(r) {
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
    dias.push(fechaLocalISO(d));
  }
  const conteo = {};
  dias.forEach(d => { conteo[d] = 0; });
  lista.forEach(x => {
    const f = fechaLocalISO(x.creado_en);
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
  el.innerHTML = items.map(i => {
    const porcentaje = Math.round(i.valor / max * 100);
    return `
    <div class="bar-row">
      <div class="bar-label" title="${escapeHtml(i.label)}">${escapeHtml(i.label)}</div>
      <div class="bar-track" title="${porcentaje}% del máximo"><div class="bar-fill ${i.clase}" style="width:${porcentaje}%"></div></div>
      <div class="bar-val">${i.valor}</div>
    </div>`;
  }).join('');
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
    <div class="icon">${TREND_ICON}</div>
    <p><strong>Tendencia detectada</strong>Incremento de reportes de <strong>${escapeHtml(CAT_NAMES[peorCat] || peorCat)}</strong> en los últimos 7 días (+${peorIncremento} vs. semana anterior). Se recomienda revisión del área correspondiente.</p>`;
}
