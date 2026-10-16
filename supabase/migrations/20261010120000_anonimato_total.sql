/* ═══════════════════════════════════════════════════════════════
   ANONIMATO TOTAL + apps independientes (inspirado en TransQR)
   ───────────────────────────────────────────────────────────────
   Decision del cliente: TODO reporte es anonimo, sin excepcion.
   Se elimina por completo la posibilidad de identificar al asociado
   (numero de empleado, nombre, modo "personalizado"). Esto es seguro
   de hacer de forma limpia (sin migrar datos viejos) porque, segun
   el estado del proyecto en el README, todavia no hay ni un usuario
   admin real ni reportes de produccion -- no hay nada que preservar.

   Cambios:
   1) reportes: se quitan numero_empleado, nombre y modo_reporte.
      crear_reporte() se recrea sin esos parametros.
   2) Se elimina la tabla "asociados" y buscar_asociado(): ya no existe
      ningun flujo que necesite verificar un numero de empleado.
   3) push_subscriptions: el tipo 'asociado' (ligado a numero_empleado)
      se reemplaza por 'reporte' (ligado al folio). Así, un asociado
      puede seguir recibiendo avisos de SU reporte sin que el sistema
      sepa quien es -- la suscripcion solo conoce el folio, nunca una
      identidad persistente entre reportes.
   4) Nueva tabla "reportes_atencion": permite, de forma 100% opcional
      y voluntaria DESPUES de enviar el reporte, dejar un contacto
      (telefono/WhatsApp) para que el equipo de comedor pueda dar
      seguimiento personalizado a ESE folio en particular. Nunca se
      cruza con nombre/numero de empleado (ya no existen en el
      sistema) y solo el panel admin puede leerla.
═══════════════════════════════════════════════════════════════ */

-- ── 1) Limpiar crear_reporte: fuera numero_empleado/nombre/modo_reporte ──
drop function if exists public.crear_reporte(text, text, text, text, text, text, text, text);
drop function if exists public.crear_reporte(text, text, text, text, text, text, text, text, text);
drop function if exists public.crear_reporte(text, text, text, text, text, text, text, text, text, text);

alter table public.reportes drop constraint if exists reportes_modo_reporte_consistente;
alter table public.reportes drop constraint if exists reportes_modo_reporte_check;
alter table public.reportes drop column if exists numero_empleado;
alter table public.reportes drop column if exists nombre;
alter table public.reportes drop column if exists modo_reporte;

create function public.crear_reporte(
  p_categoria text,
  p_cedis text,
  p_comedor text,
  p_descripcion text,
  p_prioridad text,
  p_foto_url text
)
returns table (
  folio text,
  categoria text,
  prioridad text,
  cedis text,
  comedor text,
  estatus text,
  creado_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into public.reportes (categoria, cedis, comedor, descripcion, prioridad, foto_url)
  values (p_categoria, p_cedis, p_comedor, p_descripcion, p_prioridad, p_foto_url)
  returning reportes.id into v_id;

  return query
    select r.folio, r.categoria, r.prioridad, r.cedis, r.comedor, r.estatus, r.creado_en
    from public.reportes r
    where r.id = v_id;
end;
$$;

grant execute on function public.crear_reporte(text, text, text, text, text, text) to anon, authenticated;

-- ── 2) Fuera la tabla de asociados y su funcion de busqueda ──
drop function if exists public.buscar_asociado(text);
drop table if exists public.asociados;

-- ── 3) push_subscriptions: 'asociado'+numero_empleado -> 'reporte'+folio ──
alter table public.push_subscriptions drop constraint if exists push_subscriptions_identidad_check;
drop index if exists idx_push_subs_numero_empleado;

alter table public.push_subscriptions add column if not exists folio text references public.reportes(folio) on delete cascade;
alter table public.push_subscriptions drop column if exists numero_empleado;

-- Las suscripciones viejas de tipo 'asociado' ya quedaron huerfanas (se
-- borro la columna que las sostenia) -- se eliminan, el usuario las vuelve
-- a crear la proxima vez que abra su confirmacion (nunca se pierde nada
-- critico, es solo una suscripcion de notificaciones del navegador).
delete from public.push_subscriptions where tipo = 'asociado';

alter table public.push_subscriptions add constraint push_subscriptions_identidad_check check (
  (tipo = 'admin'   and admin_user_id is not null and folio is null) or
  (tipo = 'reporte' and folio is not null and admin_user_id is null)
);

create index if not exists idx_push_subs_folio on public.push_subscriptions(folio) where tipo = 'reporte';

create or replace function public.guardar_push_subscription_reporte(
  p_folio text,
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
  if not exists (select 1 from public.reportes where folio = p_folio) then
    raise exception 'folio no encontrado';
  end if;

  insert into public.push_subscriptions (tipo, folio, endpoint, p256dh, auth_key, user_agent)
  values ('reporte', p_folio, p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
    set folio = excluded.folio,
        p256dh = excluded.p256dh,
        auth_key = excluded.auth_key,
        user_agent = excluded.user_agent,
        activa = true,
        visto_en = now();
end;
$$;

grant execute on function public.guardar_push_subscription_reporte(text, text, text, text, text) to anon, authenticated;
drop function if exists public.guardar_push_subscription_asociado(text, text, text, text, text);

-- ── 4) Atencion personalizada opcional, ligada SOLO al folio ──
create table if not exists public.reportes_atencion (
  id          bigint generated always as identity primary key,
  folio       text not null references public.reportes(folio) on delete cascade,
  medio       text not null check (medio in ('whatsapp', 'llamada')),
  contacto    text not null,
  atendido    boolean not null default false,
  creado_en   timestamptz not null default now()
);

create index if not exists idx_reportes_atencion_folio on public.reportes_atencion(folio);

alter table public.reportes_atencion enable row level security;

-- Nadie (ni anon ni authenticated) inserta directo: solo la funcion de
-- abajo, que primero valida que el folio exista de verdad.
drop policy if exists "admin lee solicitudes de atencion" on public.reportes_atencion;
create policy "admin lee solicitudes de atencion"
  on public.reportes_atencion for select
  to authenticated
  using (true);

drop policy if exists "admin actualiza solicitudes de atencion" on public.reportes_atencion;
create policy "admin actualiza solicitudes de atencion"
  on public.reportes_atencion for update
  to authenticated
  using (true)
  with check (true);

create or replace function public.solicitar_atencion_personalizada(
  p_folio text,
  p_medio text,
  p_contacto text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.reportes where folio = p_folio) then
    raise exception 'folio no encontrado';
  end if;

  insert into public.reportes_atencion (folio, medio, contacto)
  values (p_folio, p_medio, p_contacto);
end;
$$;

grant execute on function public.solicitar_atencion_personalizada(text, text, text) to anon, authenticated;
