/* ═══════════════════════════════════════════
   CATÁLOGOS CENTRALIZADOS (una sola fuente de verdad)
   Antes estaban duplicados hasta 4 veces en el HTML original.
═══════════════════════════════════════════ */

export const PRIORIDADES = {
  temperatura: 'alta', objeto: 'alta', higiene: 'alta',
  calidad: 'media', coccion: 'media', porcion: 'media',
  limpieza: 'media', espera: 'media', atencion: 'media',
  otra: 'baja'
};

export const CAT_NAMES = {
  temperatura: 'Temperatura', calidad: 'Calidad y frescura',
  coccion: 'Cocción', porcion: 'Porción',
  objeto: 'Objeto extraño', limpieza: 'Limpieza',
  espera: 'Tiempo de espera', atencion: 'Atención',
  higiene: 'Higiene', otra: 'Otra incidencia'
};

export const CEDIS_NAMES = {
  'cedis-villahermosa': 'CEDIS Villahermosa',
  'cedis-merida': 'CEDIS Mérida',
  'cedis-queretaro': 'CEDIS Querétaro',
  'cedis-campeche': 'CEDIS Campeche'
};

export const COMEDOR_NAMES = {
  secos: 'Comedor Secos',
  perecederos: 'Comedor Perecederos'
};

export const MODO_REPORTE_LABELS = {
  anonimo: 'Anónimo',
  personalizado: 'Personalizado (WhatsApp)'
};

export const PRI_LABELS = { alta: 'Alta', media: 'Media', baja: 'Baja' };
export const PRI_BADGE = { alta: 'badge-red', media: 'badge-amber', baja: 'badge-green' };
export const PRI_COLOR_VAR = { alta: 'var(--red)', media: 'var(--amber)', baja: 'var(--green)' };

export const STATUS_LABELS = {
  pendiente: 'Pendiente', revision: 'En revisión',
  atendido: 'Atendido', cerrado: 'Cerrado'
};
export const STATUS_BADGE = {
  pendiente: 'badge-red', revision: 'badge-amber',
  atendido: 'badge-green', cerrado: 'badge-gray'
};

/** Escapa texto generado por usuarios antes de insertarlo en innerHTML (anti-XSS). */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
