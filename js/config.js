/* ═══════════════════════════════════════════
   CONFIGURACIÓN PÚBLICA DE SUPABASE
   La URL y la anon key son seguras de exponer en el frontend:
   el acceso real está controlado por Row Level Security (RLS)
   en la base de datos, no por mantener esto en secreto.
═══════════════════════════════════════════ */
export const SUPABASE_URL = 'REPLACE_WITH_PROJECT_URL';
export const SUPABASE_ANON_KEY = 'REPLACE_WITH_ANON_KEY';
