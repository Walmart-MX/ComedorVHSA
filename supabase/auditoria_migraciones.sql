/* ═══════════════════════════════════════════════════════════════
   AUDITORÍA DE MIGRACIONES APLICADAS
   ───────────────────────────────────────────────────────────────
   No reemplaza el historial real de supabase_migrations.schema_migrations
   (que no vemos porque el CLI está bloqueado por la red corporativa) --
   en vez de eso, verifica la EXISTENCIA REAL de cada objeto en la base,
   que es la verdad de campo sin importar si se aplicó por CLI o pegado
   a mano en el SQL Editor (que es justo como se debe aplicar el trigger
   de push, por diseño -- ver 20261008130100).

   Pégala completa en el SQL Editor de Supabase y corre. Cada columna
   en 'false' te dice qué migración correr todavía.
═══════════════════════════════════════════════════════════════ */

select
  exists (select 1 from information_schema.tables
          where table_schema = 'public' and table_name = 'asociados')
    as tabla_asociados,                              -- 20261007150000_reparacion_consolidada.sql

  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'reportes' and column_name = 'modo_reporte')
    as columna_modo_reporte,                          -- 20261007150000_reparacion_consolidada.sql

  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'buscar_asociado')
    as funcion_buscar_asociado,                       -- 20261007150000_reparacion_consolidada.sql

  exists (select 1 from information_schema.routines
          where routine_schema = 'public' and routine_name = 'crear_reporte'
          and routine_definition ilike '%p_modo_reporte%')
    as crear_reporte_version_con_modo,                -- 20261007150000_reparacion_consolidada.sql

  (select prosrc ilike '%gen_random_uuid%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'fn_set_folio')
    as folios_no_adivinables,                         -- 20261008120000_folios_no_adivinables.sql

  exists (select 1 from information_schema.tables
          where table_schema = 'public' and table_name = 'push_subscriptions')
    as tabla_push_subscriptions,                      -- 20261008130000_push_subscriptions.sql

  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'guardar_push_subscription_admin')
    as funcion_push_admin,                            -- 20261008130000_push_subscriptions.sql

  exists (select 1 from pg_trigger where tgname = 'trg_notificar_push')
    as trigger_notificar_push,                        -- 20261008130100_trigger_notificar_push.sql (manual, con llave real)

  exists (select 1 from information_schema.tables
          where table_schema = 'public' and table_name = 'app_config')
    as tabla_app_config;                              -- 20261009120000_configuracion_app.sql (la mas reciente, casi seguro falta)
