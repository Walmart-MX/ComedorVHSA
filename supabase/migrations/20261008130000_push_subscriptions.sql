/* ═══════════════════════════════════════════════════════════════
   Push Subscriptions -- Fase 4 del plan PWA.

   Se reviso el esquema existente antes de crear esto (punto 20/29 del
   plan): NO existia ninguna tabla, RPC, Edge Function ni secret de
   push/VAPID en el proyecto. Esto es infraestructura nueva.

   Patron reutilizado del proyecto (igual que "asociados"): RLS
   encendido, SIN policies de acceso directo para anon/authenticated.
   Todo el acceso pasa por funciones SECURITY DEFINER angostas que
   validan la identidad antes de guardar nada.

   Dos tipos de suscripcion, nunca mezclados:
   - 'asociado': requiere numero_empleado que SI exista en la tabla
     asociados (no se puede registrar una suscripcion para un numero
     inventado). Jamas se crea para reportes anonimos.
   - 'admin'   : requiere sesion real de Supabase Auth (auth.uid()).
     No hay forma de registrar una suscripcion de admin sin haber
     iniciado sesion -- cierra el hueco del punto 18 ("un usuario NO
     debe poder registrar una suscripcion como si fuera administrador").
═══════════════════════════════════════════════════════════════ */

create table if not exists public.push_subscriptions (
  id              bigint generated always as identity primary key,
  tipo            text not null check (tipo in ('asociado', 'admin')),
  numero_empleado text,
  admin_user_id   uuid references auth.users(id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth_key        text not null,
  user_agent      text,
  creado_en       timestamptz not null default now(),
  visto_en        timestamptz not null default now(),
  activa          boolean not null default true,
  constraint push_subscriptions_identidad_check check (
    (tipo = 'admin'    and admin_user_id is not null and numero_empleado is null) or
    (tipo = 'asociado' and numero_empleado is not null and admin_user_id is null)
  )
);

create index if not exists idx_push_subs_numero_empleado on public.push_subscriptions(numero_empleado) where tipo = 'asociado';
create index if not exists idx_push_subs_admin on public.push_subscriptions(admin_user_id) where tipo = 'admin';
create index if not exists idx_push_subs_activa on public.push_subscriptions(activa);

alter table public.push_subscriptions enable row level security;
-- A proposito: CERO policies de select/insert/update/delete para anon/authenticated.
-- La Edge Function usa el service_role key (bypassa RLS por diseño de Supabase).
-- El frontend solo puede tocar esta tabla a traves de las funciones de abajo.

-- ── Registrar suscripcion de asociado identificado ──
-- Valida contra la tabla real de asociados: no se puede inventar un numero.
create or replace function public.guardar_push_subscription_asociado(
  p_numero_empleado text,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.asociados where numero_empleado = p_numero_empleado) then
    raise exception 'numero_empleado no encontrado';
  end if;

  insert into public.push_subscriptions (tipo, numero_empleado, endpoint, p256dh, auth_key, user_agent)
  values ('asociado', p_numero_empleado, p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
    set numero_empleado = excluded.numero_empleado,
        p256dh = excluded.p256dh,
        auth_key = excluded.auth_key,
        user_agent = excluded.user_agent,
        activa = true,
        visto_en = now();
end;
$$;

grant execute on function public.guardar_push_subscription_asociado(text, text, text, text, text) to anon, authenticated;

-- ── Registrar suscripcion de administrador ──
-- auth.uid() viene del JWT de la sesion real -- un anon (sin login) no tiene
-- uid, asi que la funcion rechaza el intento. No se puede "fingir" ser admin.
create or replace function public.guardar_push_subscription_admin(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Se requiere sesion de administrador para activar notificaciones.';
  end if;

  insert into public.push_subscriptions (tipo, admin_user_id, endpoint, p256dh, auth_key, user_agent)
  values ('admin', auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
    set admin_user_id = excluded.admin_user_id,
        p256dh = excluded.p256dh,
        auth_key = excluded.auth_key,
        user_agent = excluded.user_agent,
        activa = true,
        visto_en = now();
end;
$$;

grant execute on function public.guardar_push_subscription_admin(text, text, text, text) to authenticated;

-- ── Desactivar la suscripcion del dispositivo actual (el usuario apaga notificaciones) ──
create or replace function public.desactivar_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_subscriptions set activa = false where endpoint = p_endpoint;
$$;

grant execute on function public.desactivar_push_subscription(text) to anon, authenticated;
