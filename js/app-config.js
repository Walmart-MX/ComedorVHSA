import { supabase, isSupabaseConfigured } from './supabase-client.js';

/* ═══════════════════════════════════════════════════════════════
   Configuracion operativa editable desde el panel admin (tabla
   app_config, fila unica -- ver supabase/migrations/20261009120000).
   Primer uso: numero de WhatsApp destino para reportes "con mis datos".
   Se cachea en memoria igual que los reportes (ver admin-dashboard.js)
   para no pedirla de nuevo cada vez que una pantalla la necesita.
═══════════════════════════════════════════════════════════════ */

let cache = { whatsapp_destino: '' };

/** Trae la configuracion vigente desde la base y actualiza el cache.
    Se llama una vez al arrancar la app (main.js) y de nuevo cada vez
    que se abre la pestaña de Configuración en el admin. */
export async function cargarConfiguracion() {
  if (!isSupabaseConfigured) return cache;
  const { data, error } = await supabase
    .from('app_config')
    .select('whatsapp_destino')
    .eq('id', 1)
    .single();
  if (!error && data) cache = data;
  return cache;
}

export function getWhatsappDestino() {
  return cache.whatsapp_destino || '';
}

/** Guarda el nuevo numero (o '' para apagar el boton de WhatsApp en la
    confirmacion del asociado). Solo funciona con sesion de admin activa:
    la policy de UPDATE en app_config lo exige, esta funcion no decide
    permisos por su cuenta, solo intenta el update y reporta el resultado. */
export async function actualizarWhatsappDestino(numero) {
  if (!isSupabaseConfigured) return { error: new Error('Backend no configurado') };
  const { error } = await supabase.from('app_config').update({ whatsapp_destino: numero }).eq('id', 1);
  if (!error) cache.whatsapp_destino = numero;
  return { error };
}
