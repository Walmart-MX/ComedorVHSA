import { escapeHtml } from './catalog.js';

/** Renderiza una fila de tarjetas KPI (icono + número + etiqueta) dentro del
    elemento con el id dado. Compartido entre el dashboard general y la
    pestaña de tendencias -- un solo lugar que sabe pintar una tarjeta KPI,
    en vez de repetir el mismo template literal en cada pantalla que
    necesite mostrar indicadores (DRY). Espera objetos { n, l, c, icono }:
    n = valor (número o texto corto), l = etiqueta, c = clase de color
    ('', 'red', 'amber', 'green'), icono = SVG en línea (ver icons.js). */
export function renderKpiGrid(elementId, kpis) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = kpis.map(k => `
    <div class="kpi-card ${k.c}">
      <div class="kpi-icon">${k.icono}</div>
      <div class="kpi-body">
        <div class="kpi-num">${escapeHtml(k.n)}</div>
        <div class="kpi-label">${escapeHtml(k.l)}</div>
      </div>
    </div>`).join('');
}
