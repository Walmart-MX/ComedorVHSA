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

   IMPORTANTE ANTES DE CORRER ESTE ARCHIVO (leer completo):
   Este trigger llama a la Edge Function con la Service Role Key del
   proyecto -- esa llave se salta TODO row level security, asi que
   JAMAS debe escribirse en texto plano dentro de un archivo que se
   commitea a git (un migration.sql versionado es exactamente eso).

   En vez de eso, la llave real se guarda UNA SOLA VEZ, a mano, en el
   SQL Editor del dashboard de Supabase (nunca en un archivo del repo)
   usando Supabase Vault:

     select vault.create_secret(
       '<pega aqui la Service Role Key real, solo en el SQL Editor>',
       'notificar_push_service_role_key'
     );

   La funcion de abajo la lee por NOMBRE en tiempo de ejecucion via
   vault.decrypted_secrets -- el valor real nunca queda en ningun
   archivo versionado.

   HALLAZGO DE SEGURIDAD (corregido en esta revision): una version
   anterior de este archivo tenia la Service Role Key real escrita en
   texto plano aqui mismo. Si ese commit llego a subirse a un remoto
   (GitHub, etc.), la llave debe considerarse comprometida: hay que
   REGENERARLA de inmediato en Project Settings -> API -> Service Role
   Key -> "Generate new key". Reescribir el archivo no revierte una
   llave que ya fue expuesta -- solo rotarla en Supabase lo hace.
═══════════════════════════════════════════════════════════════ */

create extension if not exists pg_net with schema extensions;

create or replace function public.fn_notificar_push()
returns trigger
language plpgsql
as $$
declare
  v_service_key text;
begin
  select decrypted_secret into v_service_key
  from vault.decrypted_secrets
  where name = 'notificar_push_service_role_key'
  limit 1;

  -- Si el secreto todavia no se configuro en Vault, no truena el INSERT en
  -- reportes_historial (eso rompería la creacion de reportes) -- solo se
  -- omite el aviso push silenciosamente.
  if v_service_key is null then
    return new;
  end if;

  perform net.http_post(
    url     := 'https://switfyozjhfceqysvcji.supabase.co/functions/v1/notificar-push',
    headers := jsonb_build_object(
                 'Content-type', 'application/json',
                 'Authorization', 'Bearer ' || v_service_key
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
