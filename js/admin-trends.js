import { CAT_NAMES, escapeHtml } from './catalog.js';
import { getCachedReportes } from './admin-dashboard.js';
import { TREND_ICON } from './icons.js';

export function renderTendencias() {
  const r = getCachedReportes();
  const now = Date.now();
  const porCategoria = construirEvolucionSemanal(r, now);

  renderResumenTendencias(porCategoria);
  renderEvolucionSemanal(porCategoria);
  renderHorarios(r);
  renderTiempoPorCategoria(r);
}

/** Agrupa reportes por categoria en 4 cubetas semanales (0 = hace 4 sem, 3 = ultima sem). */
function construirEvolucionSemanal(r, now) {
  const porCategoria = {};
  r.forEach(x => {
    const diasAtras = Math.floor((now - new Date(x.creado_en).getTime()) / 86400000);
    const semIdx = diasAtras < 7 ? 3 : diasAtras < 14 ? 2 : diasAtras < 21 ? 1 : diasAtras < 28 ? 0 : -1;
    if (semIdx < 0) return;
    porCategoria[x.categoria] ??= [0, 0, 0, 0];
    porCategoria[x.categoria][semIdx]++;
  });
  return porCategoria;
}

function renderEvolucionSemanal(porCategoria) {
  const semanas = ['Sem -4', 'Sem -3', 'Sem -2', 'Última sem'];
  let html = '';
  Object.entries(porCategoria)
    .filter(([, valores]) => valores.reduce((a, b) => a + b, 0) > 0)
    .sort((a, b) => b[1].reduce((x, y) => x + y) - a[1].reduce((x, y) => x + y))
    .forEach(([cat, valores]) => {
      const tendenciaTexto = calcularTendencia(valores);
      const maxS = Math.max(...valores, 1);
      html += `<div style="margin-bottom:12px;"><div style="font-size:.75rem;font-weight:800;color:var(--text);margin-bottom:6px;">${escapeHtml(CAT_NAMES[cat] || cat)} <span style="font-weight:400;color:var(--text2);">(${tendenciaTexto})</span></div>`;
      valores.forEach((v, i) => {
        html += `<div class="bar-row"><div class="bar-label" style="width:70px;">${semanas[i]}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(v / maxS * 100)}%"></div></div><div class="bar-val">${v}</div></div>`;
      });
      html += '</div>';
    });

  document.getElementById('chart-semanas').innerHTML = html || '<p style="color:var(--text2);font-size:.8rem;">Sin datos suficientes.</p>';
}

/** Tendencia simple y transparente (sin IA/ML): compara la ultima semana
    contra la inmediata anterior, y detecta si la ultima semana es ademas
    el pico de las ultimas 4. */
function calcularTendencia(valores) {
  const [, , anterior, ultima] = valores;
  const max = Math.max(...valores);
  if (ultima === anterior) return 'estable';
  if (ultima > anterior) {
    const esPico = ultima === max;
    const saltoGrande = anterior > 0 ? ultima >= anterior * 2 : ultima >= 3;
    if (esPico && saltoGrande) return 'incremento significativo';
    if (esPico) return 'pico reciente';
    return 'subiendo';
  }
  return 'bajando';
}

/** Resumen de la pestaña Tendencias: a diferencia de la alerta del dashboard
    (que se oculta si no hay nada relevante), esta seccion SIEMPRE dice algo
    honesto sobre los datos reales -- incluyendo cuando no hay suficientes. */
function renderResumenTendencias(porCategoria) {
  const box = document.getElementById('trend-alert-tendencias');
  const icon = document.getElementById('trend-alert-tendencias-icon');
  const text = document.getElementById('trend-alert-tendencias-text');
  if (!box || !text) return;

  const totalReportes = Object.values(porCategoria).reduce((acc, v) => acc + v.reduce((a, b) => a + b, 0), 0);
  box.style.display = 'flex';
  icon.innerHTML = TREND_ICON;

  if (totalReportes === 0) {
    text.innerHTML = '<strong>Sin datos suficientes</strong>No hay reportes registrados en las últimas 4 semanas para determinar una tendencia.';
    return;
  }

  const peso = { 'incremento significativo': 3, 'pico reciente': 2, 'subiendo': 1, 'bajando': 0, 'estable': 0 };
  let mejor = null;
  Object.entries(porCategoria).forEach(([cat, valores]) => {
    if (valores.reduce((a, b) => a + b, 0) === 0) return;
    const tendencia = calcularTendencia(valores);
    if (!mejor || peso[tendencia] > peso[mejor.tendencia]) mejor = { cat, tendencia };
  });

  if (!mejor || peso[mejor.tendencia] === 0) {
    text.innerHTML = '<strong>Comportamiento estable</strong>No se detectan incrementos relevantes en las categorías de reporte durante las últimas 4 semanas.';
    return;
  }

  const catNombre = escapeHtml(CAT_NAMES[mejor.cat] || mejor.cat);
  const mensajes = {
    'incremento significativo': `Incremento significativo de reportes de <strong>${catNombre}</strong> en la última semana respecto a la anterior.`,
    'pico reciente': `Pico reciente de reportes de <strong>${catNombre}</strong> respecto a las semanas previas.`,
    'subiendo': `Tendencia ascendente de reportes de <strong>${catNombre}</strong> en las últimas semanas.`
  };
  text.innerHTML = `<strong>Tendencia detectada</strong>${mensajes[mejor.tendencia]}`;
}

/** Hora LOCAL del navegador (no UTC crudo), para que el horario pico
    corresponda a la hora real de operacion del comedor, sin importar
    como venga serializado el timestamp desde Supabase. */
function renderHorarios(r) {
  const rangos = ['06-08', '08-10', '10-12', '12-14', '14-16', '16-18', '18-20', '20-22'];
  const horarios = Object.fromEntries(rangos.map(k => [k, 0]));
  r.forEach(x => {
    const hora = new Date(x.creado_en).getHours();
    const rango = rangos.find(rng => {
      const [a, b] = rng.split('-').map(Number);
      return hora >= a && hora < b;
    });
    if (rango) horarios[rango]++;
  });
  const max = Math.max(...Object.values(horarios), 1);
  const picoValor = Math.max(...Object.values(horarios));
  document.getElementById('chart-horario').innerHTML = Object.entries(horarios).map(([k, v]) => `
    <div class="bar-row"><div class="bar-label">${k}h</div><div class="bar-track"><div class="bar-fill ${v === picoValor && v > 0 ? 'red' : ''}" style="width:${Math.round(v / max * 100)}%"></div></div><div class="bar-val">${v}</div></div>`).join('');
}

/** Tiempo de atención REAL por categoría (el prototipo original lo simulaba con Math.random). */
function renderTiempoPorCategoria(r) {
  const porCategoria = {};
  r.filter(x => x.estatus === 'atendido' || x.estatus === 'cerrado').forEach(x => {
    const dias = Math.max((new Date(x.actualizado_en) - new Date(x.creado_en)) / 86400000, 0);
    porCategoria[x.categoria] ??= [];
    porCategoria[x.categoria].push(dias);
  });

  const entradas = Object.entries(porCategoria)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6);

  if (entradas.length === 0) {
    document.getElementById('chart-tiempo').innerHTML = '<p style="color:var(--text2);font-size:.8rem;">Aún no hay reportes atendidos para calcular este dato.</p>';
    return;
  }

  const promedios = entradas.map(([cat, valores]) => ({
    cat, prom: valores.reduce((a, b) => a + b, 0) / valores.length
  }));
  const max = Math.max(...promedios.map(p => p.prom), 1);
  document.getElementById('chart-tiempo').innerHTML = promedios.map(({ cat, prom }) => `
    <div class="bar-row"><div class="bar-label">${escapeHtml(CAT_NAMES[cat] || cat)}</div><div class="bar-track"><div class="bar-fill amber" style="width:${Math.round(prom / max * 100)}%"></div></div><div class="bar-val">${prom.toFixed(1)}d</div></div>`).join('');
}
