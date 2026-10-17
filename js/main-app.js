/* Punto de entrada de la app del asociado (app/index.html). Completamente
   independiente del panel admin -- ver js/main-admin.js -- ni un solo
   import se comparte entre ambos que no sea infraestructura genérica
   (config, cliente de Supabase, catálogos, iconos). */

import { initAsociado } from './asociado.js';
import { initConsulta, consultarFolioDesdeURL } from './consulta.js';
import { initCampanas } from './campanas.js';
import { isSupabaseConfigured } from './supabase-client.js';
import { cargarConfiguracion } from './app-config.js';
import { initPWA } from './pwa.js';

if (!isSupabaseConfigured) {
  document.getElementById('backend-warning')?.classList.remove('hidden');
}

cargarConfiguracion();
initAsociado();
initConsulta();
initCampanas();
initPWA();

// Deep link desde una notificacion push ligada a un folio (ver service-worker.js):
// ?folio=XXX -> abre directo la consulta publica de ese folio.
const folio = new URLSearchParams(window.location.search).get('folio');
if (folio) consultarFolioDesdeURL(folio);
