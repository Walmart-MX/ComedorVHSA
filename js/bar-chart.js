import { escapeHtml } from './catalog.js';

/** Pinta una fila de barras horizontales (etiqueta + barra + valor) dentro
    del elemento con el id dado. Vive en infraestructura genérica (junto a
    catalog.js/icons.js) porque la usan TANTO el panel admin (dashboard,
    tendencias, campañas) COMO la app del asociado (resultados de encuesta)
    -- nunca al revés, nunca importando un módulo propio de la otra app
    (ver nota de arquitectura en js/main-app.js). */
export function renderBarChart(elementId, items) {
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
