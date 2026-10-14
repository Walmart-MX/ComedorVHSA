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

   ───────────────────────────────────────────────────────────────
   REVISION (hallazgo real al aplicar): la version original usaba
   supabase_functions.http_request(), una funcion que Supabase SOLO
   aprovisiona cuando se visita Database > Webhooks en el dashboard
   al menos una vez -- en este proyecto nunca se hizo, asi que el
   esquema "supabase_functions" no existe (error 3F000).

   Se reemplaza por pg_net directo (net.http_post): es la extension
   que de verdad ejecuta esas llamadas por debajo de cualquier forma,
   viene habilitada por defecto en todo proyecto hospedado de
   Supabase (no depende de haber tocado la UI de Webhooks), y es
   asincrona (no bloquea el INSERT en reportes_historial mientras
   espera la respuesta del Edge Function).

   El payload se arma a mano con la misma forma {record: {...}} que
   ya espera supabase/functions/notificar-push/index.ts, para no
   tener que tocar esa funcion.

   IMPORTANTE ANTES DE CORRER ESTE ARCHIVO:
   Reemplaza <SERVICE_ROLE_KEY> por la Service Role Key real de
   Project Settings -> API. NO la dejes en el repo de Git en texto
   plano -- corre este bloque directo en el SQL Editor de Supabase,
   no lo commitees con la llave real puesta.
═══════════════════════════════════════════════════════════════ */

create extension if not exists pg_net with schema extensions;

create or replace function public.fn_notificar_push()
returns trigger
language plpgsql
as $$
begin
  perform net.http_post(
    url     := 'https://switfyozjhfceqysvcji.supabase.co/functions/v1/notificar-push',
    headers := jsonb_build_object(
                 'Content-type', 'application/json',
                 'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
               ),
    body    := jsonb_build_object(
                 'type', 'INSERT',
                 'table', 'reportes_historial',
                 'schema', 'public',
                 'record', to_jsonb(new)
               ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists trg_notificar_push on public.reportes_historial;

create trigger trg_notificar_push
  after insert on public.reportes_historial
  for each row execute function public.fn_notificar_push();
