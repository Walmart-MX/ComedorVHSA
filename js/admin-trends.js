import { CAT_NAMES, escapeHtml } from './catalog.js';
import { getCachedReportes } from './admin-dashboard.js';

export function renderTendencias() {
  const r = getCachedReportes();
  const now = Date.now();

  renderEvolucionSemanal(r, now);
  renderHorarios(r);
  renderTiempoPorCategoria(r);
}

function renderEvolucionSemanal(r, now) {
  const semanas = ['Sem -4', 'Sem -3', 'Sem -2', 'Última sem'];
  const porCategoria = {};
  r.forEach(x => {
    const diasAtras = Math.floor((now - new Date(x.creado_en).getTime()) / 86400000);
    const semIdx = diasAtras < 7 ? 3 : diasAtras < 14 ? 2 : diasAtras < 21 ? 1 : diasAtras < 28 ? 0 : -1;
    if (semIdx < 0) return;
    porCategoria[x.categoria] ??= [0, 0, 0, 0];
    porCategoria[x.categoria][semIdx]++;
  });

  let html = '';
  Object.entries(porCategoria)
    .filter(([, valores]) => valores.reduce((a, b) => a + b, 0) > 0)
    .sort((a, b) => b[1].reduce((x, y) => x + y) - a[1].reduce((x, y) => x + y))
    .forEach(([cat, valores]) => {
      const tendenciaTexto = valores[3] > valores[0] ? '(subiendo)' : valores[3] < valores[0] ? '(bajando)' : '(estable)';
      const maxS = Math.max(...valores, 1);
      html += `<div style="margin-bottom:12px;"><div style="font-size:.75rem;font-weight:800;color:var(--text);margin-bottom:6px;">${escapeHtml(CAT_NAMES[cat] || cat)} <span style="font-weight:400;color:var(--text2);">${tendenciaTexto}</span></div>`;
      valores.forEach((v, i) => {
        html += `<div class="bar-row"><div class="bar-label" style="width:70px;">${semanas[i]}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(v / maxS * 100)}%"></div></div><div class="bar-val">${v}</div></div>`;
      });
      html += '</div>';
    });

  document.getElementById('chart-semanas').innerHTML = html || '<p style="color:var(--text2);font-size:.8rem;">Sin datos suficientes.</p>';
}

function renderHorarios(r) {
  const rangos = ['06-08', '08-10', '10-12', '12-14', '14-16', '16-18', '18-20', '20-22'];
  const horarios = Object.fromEntries(rangos.map(k => [k, 0]));
  r.forEach(x => {
    const hora = Number(x.creado_en.split('T')[1]?.slice(0, 2) ?? -1);
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
