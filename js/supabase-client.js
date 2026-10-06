import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Usamos el bundle UMD oficial de supabase-js (cargado como <script> clasico
// en index.html, ver window.supabase) en vez de importarlo desde esm.sh:
// esm.sh reparte el paquete en varios sub-modulos (auth-js, postgrest-js,
// storage-js...) y en la practica eso rompio el apikey header por defecto
// (la API respondia 401 'No API key found in request'). El bundle UMD de
// jsDelivr es un solo archivo auto-contenido, sin ese problema.
const { createClient } = window.supabase;

// Mientras config.js tenga placeholders (proyecto Supabase aun no enlazado),
// evitamos que createClient() tire toda la app - en vez de eso mostramos un
// aviso claro y dejamos el resto de la pagina utilizable.
export const isSupabaseConfigured =
  !SUPABASE_URL.includes('REPLACE_WITH') && !SUPABASE_ANON_KEY.includes('REPLACE_WITH');

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase aun no esta configurado: llena js/config.js con la URL y anon key reales.'
  );
}
