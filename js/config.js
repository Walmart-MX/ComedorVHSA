/* ═══════════════════════════════════════════
   CONFIGURACIÓN PÚBLICA DE SUPABASE
   La URL y la anon key son seguras de exponer en el frontend:
   el acceso real está controlado por Row Level Security (RLS)
   en la base de datos, no por mantener esto en secreto.
═══════════════════════════════════════════ */
export const SUPABASE_URL = 'https://switfyozjhfceqysvcji.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3aXRmeW96amhmY2VxeXN2Y2ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMDAxODQsImV4cCI6MjEwNjg3NjE4NH0.0VlMLBYw7zSHOiSuECXp3JmoeRMcAwE90p198f8VfJg';

/* Numero de WhatsApp (de la empresa/comedor) al que se dirige el mensaje de
   confirmacion precargado despues de enviar un reporte. Formato: solo
   digitos, con codigo de pais (ej. 529931234567 para Mexico). Mientras
   quede vacio, el boton de WhatsApp de la confirmacion permanece oculto
   (no inventamos un numero -- ver conversacion con el cliente). */
export const WHATSAPP_DESTINO = '';

/* Llave publica VAPID para suscripciones push (Web Push API). Generada
   junto con su contraparte privada (que NUNCA va aqui, solo vive como
   secret en la Edge Function). Mientras quede vacia, js/push.js se
   desactiva solo -- no rompe nada, simplemente no ofrece notificaciones. */
export const VAPID_PUBLIC_KEY = '';
