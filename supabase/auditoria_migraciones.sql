/* ═══════════════════════════════════════════════════════════════
   AUDITORÍA DE MIGRACIONES APLICADAS (actualizada tras el cambio a
   anonimato total + el hallazgo de seguridad del trigger de push)
   ───────────────────────────────────────────────────────────────
   No reemplaza el historial real de supabase_migrations.schema_migrations
   (bloqueado por la red corporativa) -- en vez de eso, verifica la
   EXISTENCIA REAL de cada objeto en la base, que es la verdad de campo
   sin importar si se aplicó por CLI o pegado a mano en el SQL Editor.

   Pégala completa en el SQL Editor de Supabase y corre. Lee la columna
   "esperado" de cada fila (comentario) para saber si "true" es bueno o malo.
═══════════════════════════════════════════════════════════════ */

select
  -- Todo lo de abajo debe dar FALSE: son los objetos de identificación
  -- que se eliminaron a propósito en 20261010120000_anonimato_total.sql.
  -- Si alguno da TRUE, esa migración no se aplicó todavía.
  not exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'asociados')
    as ok_sin_tabla_asociados,

  not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'reportes'
              and column_name in ('numero_empleado', 'nombre', 'modo_reporte'))
    as ok_sin_columnas_identificacion,

  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'buscar_asociado')
    as ok_sin_funcion_buscar_asociado,

  not exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'reportes_atencion')
    as ok_sin_tabla_atencion_personalizada,  -- se quitó: solo queda compartir por WhatsApp

  -- Estos deben dar TRUE: son la infraestructura vigente.
  (select prosrc ilike '%gen_random_uuid%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'fn_set_folio')
    as ok_folios_no_adivinables,                       -- 20261008120000

  exists (select 1 from information_schema.tables
          where table_schema = 'public' and table_name = 'push_subscriptions')
    as ok_tabla_push_subscriptions,                     -- 20261008130000

  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'push_subscriptions' and column_name = 'folio')
    as ok_push_subscriptions_usa_folio,                 -- 20261010120000 (antes usaba numero_empleado)

  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'guardar_push_subscription_admin')
    as ok_funcion_push_admin,                           -- 20261008130000

  exists (select 1 from pg_trigger where tgname = 'trg_notificar_push')
    as ok_trigger_notificar_push,                       -- 20261008130100 (manual)

  exists (select 1 from information_schema.tables
          where table_schema = 'public' and table_name = 'app_config')
    as ok_tabla_app_config,                             -- 20261009120000

  -- CRÍTICO (hallazgo de seguridad): sin este secreto en Vault, el
  -- trigger de push queda en modo "silencioso" (no manda nada, pero
  -- tampoco rompe nada) -- ver comentario completo en
  -- 20261008130100_trigger_notificar_push.sql. Si da FALSE, corre ahí
  -- mismo (en este SQL Editor, NUNCA en un archivo de git):
  --   select vault.create_secret('<tu Service Role Key real>', 'notificar_push_service_role_key');
  exists (select 1 from vault.secrets where name = 'notificar_push_service_role_key')
    as ok_vault_service_role_key_configurado,

  -- Si esto da TRUE, la llave real que se filtró en el archivo .sql
  -- sigue viva dentro de la función en la base de datos -- hay que
  -- correr de nuevo el bloque "create or replace function
  -- public.fn_notificar_push()" ya corregido (usa Vault) para
  -- sobreescribirla, ADEMÁS de rotar la llave en Project Settings > API.
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'fn_notificar_push'
          and p.prosrc ilike '%eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9%')
    as alerta_llave_real_todavia_en_la_funcion;
