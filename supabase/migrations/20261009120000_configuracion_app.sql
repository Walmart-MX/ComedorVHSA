/* ═══════════════════════════════════════════════════════════════
   Configuracion de la app editable desde el panel admin.
   ───────────────────────────────────────────────────────────────
   Primer caso de uso: el numero de WhatsApp al que llegan los
   reportes (antes vivia hardcodeado y vacio en js/config.js -- para
   cambiarlo habia que tocar codigo y volver a desplegar). Ahora es
   un dato operativo que el propio equipo de Comedor VHSA puede
   actualizar desde la pestaña "Configuración" del panel, sin
   depender de un developer ni de un nuevo despliegue.

   Patron: tabla "singleton" (una sola fila, id fijo en 1) en vez de
   key/value generico -- mas simple de leer/escribir y suficiente
   mientras solo haya un puñado de ajustes. Si en el futuro crecen,
   se puede migrar a key/value sin romper esto (el frontend ya lee
   por nombre de columna, no por posicion).
═══════════════════════════════════════════════════════════════ */

create table if not exists public.app_config (
  id               int primary key default 1,
  whatsapp_destino text,
  actualizado_en   timestamptz not null default now(),
  constraint app_config_singleton check (id = 1),
  -- Solo digitos (con codigo de pais), o vacio/NULL para apagar el boton
  -- de WhatsApp en la confirmacion del asociado (ver js/asociado.js).
  constraint app_config_whatsapp_formato check (
    whatsapp_destino is null or whatsapp_destino = '' or whatsapp_destino ~ '^[0-9]{10,15}$'
  )
);

insert into public.app_config (id, whatsapp_destino)
values (1, '')
on conflict (id) do nothing;

-- Reutiliza el trigger generico que ya existe para "reportes" (DRY -- ver
-- fn_touch_actualizado_en en 20261006120000_init_schema.sql): solo toca
-- new.actualizado_en, no depende de columnas especificas de esa tabla.
drop trigger if exists trg_touch_app_config on public.app_config;
create trigger trg_touch_app_config
  before update on public.app_config
  for each row execute function public.fn_touch_actualizado_en();

alter table public.app_config enable row level security;

-- Lectura publica: el asociado anonimo/identificado necesita saber si hay
-- un numero configurado para decidir si mostrar el boton de WhatsApp.
drop policy if exists "cualquiera puede leer configuracion" on public.app_config;
create policy "cualquiera puede leer configuracion"
  on public.app_config for select
  to anon, authenticated
  using (true);

-- Escritura solo para administradores autenticados (mismo criterio que
-- la policy de update en reportes: cualquier admin logueado puede).
drop policy if exists "admin puede actualizar configuracion" on public.app_config;
create policy "admin puede actualizar configuracion"
  on public.app_config for update
  to authenticated
  using (true)
  with check (true);

-- Sin policy de insert/delete a proposito: la fila unica ya quedo sembrada
-- arriba: nadie (ni admin) deberia poder crear una segunda fila ni borrarla.
