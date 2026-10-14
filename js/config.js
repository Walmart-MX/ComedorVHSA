/* ═══════════════════════════════════════════
   CONFIGURACIÓN PÚBLICA DE SUPABASE
   La URL y la anon key son seguras de exponer en el frontend:
   el acceso real está controlado por Row Level Security (RLS)
   en la base de datos, no por mantener esto en secreto.
═══════════════════════════════════════════ */
export const SUPABASE_URL = 'https://switfyozjhfceqysvcji.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3aXRmeW96amhmY2VxeXN2Y2ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMDAxODQsImV4cCI6MjEwNjg3NjE4NH0.0VlMLBYw7zSHOiSuECXp3JmoeRMcAwE90p198f8VfJg';

/* El numero de WhatsApp destino YA NO vive aqui: es un dato operativo que
   cambia con el tiempo (vacaciones, cambio de responsable, etc.), asi que
   se movio a la base de datos (tabla app_config) y se edita desde la
   pestaña "Configuración" del panel admin -- ver js/app-config.js. Tenerlo
   en un archivo de codigo fuente obligaba a un developer + un redeploy
   solo para cambiar un numero de telefono. */

/* Llave publica VAPID para suscripciones push (Web Push API). Generada
   junto con su contraparte privada (que NUNCA va aqui, solo vive como
   secret en la Edge Function). Mientras quede vacia, js/push.js se
   desactiva solo -- no rompe nada, simplemente no ofrece notificaciones. */
export const VAPID_PUBLIC_KEY = 'BMr8BnP3n2PG9kfJCt0uQkRTzE2MbkIL-E0vYHVI0LTCHsHm2zEnZwKqL91TpOxfYxtdOfdSmPJ9x59x3xvZI5A';
