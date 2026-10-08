/* ═══════════════════════════════════════════════════════════════
   Conecta reportes_historial -> Edge Function notificar-push.

   Por que reportes_historial y no reportes directamente: la tabla
   historial YA registra, en un solo lugar, tanto la creacion de un
   reporte (estatus_anterior IS NULL) como cada cambio de estatus
   (estatus_anterior IS NOT NULL) -- ver fn_historial_on_insert() y
   fn_historial_on_status_change() en 20261006120000_init_schema.sql.
   Enganchar aqui evita duplicar esa logica de "que evento ocurrio"
   en dos lugares distintos.

   La Edge Function decide, leyendo ese mismo payload, a quien avisar:
   - estatus_anterior NULL          -> admins (nuevo reporte)
   - estatus_anterior NOT NULL      -> el asociado dueño del reporte
     (solo si el reporte es modo_reporte='personalizado'; los
     anonimos jamas generan push, por diseño)

   IMPORTANTE ANTES DE CORRER ESTE ARCHIVO:
   Reemplaza <SERVICE_ROLE_KEY> por la Service Role Key real de
   Project Settings -> API. NO la dejes en el repo de Git en texto
   plano -- corre este bloque directo en el SQL Editor de Supabase,
   no lo commitees con la llave real puesta.
═══════════════════════════════════════════════════════════════ */

drop trigger if exists trg_notificar_push on public.reportes_historial;

create trigger trg_notificar_push
  after insert on public.reportes_historial
  for each row
  execute function supabase_functions.http_request(
    'https://switfyozjhfceqysvcji.supabase.co/functions/v1/notificar-push',
    'POST',
    '{"Content-type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}',
    '{}',
    '5000'
  );
