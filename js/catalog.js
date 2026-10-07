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

// Traduccion a lenguaje humano para el asociado (pantalla de confirmacion y
// consulta de folio). Los nombres internos (arriba) son para el admin.
export const STATUS_PUBLICO = {
  pendiente: 'Recibimos tu reporte',
  revision: 'El equipo esta revisando tu reporte',
  atendido: 'Tu reporte fue atendido',
  cerrado: 'Tu reporte fue atendido y cerrado'
};

// Unica sede operando actualmente. La tabla/BD sigue soportando otros CEDIS
// (ver CEDIS_NAMES) para no cerrar la puerta a futuro, pero la interfaz
// publica ya no pide elegir CEDIS -- se usa este valor fijo.
export const DEFAULT_CEDIS = 'cedis-villahermosa';

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
