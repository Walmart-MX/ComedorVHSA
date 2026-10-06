import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

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
