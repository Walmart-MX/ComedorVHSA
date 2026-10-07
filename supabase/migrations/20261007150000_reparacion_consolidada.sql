/* ═══════════════════════════════════════════════════════════════
   SCRIPT CONSOLIDADO DE REPARACION
   ───────────────────────────────────────────────────────────────
   Combina, en orden seguro, todo lo que debio aplicarse en pasos
   anteriores y que quedo pendiente:
     1) Renombrar comedor a secos/perecederos.
     2) numero_empleado opcional (reportes anonimos).
     3) Columna modo_reporte (anonimo/personalizado).
     4) Quitar telefono_whatsapp (diseño descartado, si llego a existir).
     5) CEDIS default a Villahermosa.
     6) Tabla de asociados + funciones seguras de consulta publica.
   Cada paso usa IF EXISTS / IF NOT EXISTS: es seguro correrlo las
   veces que haga falta, sin importar que tanto se haya aplicado ya.
═══════════════════════════════════════════════════════════════ */

-- ── 1) Comedor: renombrar valores ──
alter table public.reportes drop constraint if exists reportes_comedor_check;
update public.reportes set comedor = 'secos' where comedor = 'principal';
update public.reportes set comedor = 'perecederos' where comedor = 'secundario';
alter table public.reportes add constraint reportes_comedor_check check (comedor in ('secos', 'perecederos'));

-- ── 2) numero_empleado ya no obligatorio a nivel BD ──
alter table public.reportes alter column numero_empleado drop not null;

-- ── 3) Columna modo_reporte ──
alter table public.reportes add column if not exists modo_reporte text not null default 'anonimo';
alter table public.reportes drop constraint if exists reportes_modo_reporte_check;
alter table public.reportes add constraint reportes_modo_reporte_check check (modo_reporte in ('anonimo', 'personalizado'));

-- ── 4) Quitar telefono_whatsapp (diseño descartado) ──
alter table public.reportes drop constraint if exists reportes_modo_reporte_consistente;
alter table public.reportes drop column if exists telefono_whatsapp;

alter table public.reportes add constraint reportes_modo_reporte_consistente check (
  (modo_reporte = 'anonimo') or
  (modo_reporte = 'personalizado' and numero_empleado is not null and nombre is not null)
);

-- ── 5) CEDIS default a Villahermosa ──
alter table public.reportes alter column cedis set default 'cedis-villahermosa';

-- ── 6) Tabla de asociados (solo numero, nombre, area -- nunca telefono) ──
create table if not exists public.asociados (
  numero_empleado text primary key,
  nombre          text not null,
  area            text,
  creado_en       timestamptz not null default now()
);

alter table public.asociados enable row level security;
-- A proposito SIN policy de SELECT: la tabla nunca se lista completa desde
-- el frontend, solo via buscar_asociado() (funcion segura mas abajo).

-- ── 7) Funciones seguras de consulta publica ──
create or replace function public.buscar_asociado(p_numero_empleado text)
returns table (nombre text, area text)
language sql
security definer
stable
set search_path = public
as $$
  select a.nombre, a.area
  from public.asociados a
  where a.numero_empleado = p_numero_empleado;
$$;

grant execute on function public.buscar_asociado(text) to anon, authenticated;

create or replace function public.consultar_reporte(p_folio text)
returns table (
  folio text,
  categoria text,
  comedor text,
  descripcion text,
  estatus text,
  creado_en timestamptz,
  actualizado_en timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select r.folio, r.categoria, r.comedor, r.descripcion, r.estatus,
         r.creado_en, r.actualizado_en
  from public.reportes r
  where r.folio = p_folio;
$$;

grant execute on function public.consultar_reporte(text) to anon, authenticated;

create or replace function public.consultar_historial_publico(p_folio text)
returns table (estatus_nuevo text, creado_en timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select h.estatus_nuevo, h.creado_en
  from public.reportes_historial h
  join public.reportes r on r.id = h.reporte_id
  where r.folio = p_folio
  order by h.creado_en asc;
$$;

grant execute on function public.consultar_historial_publico(text) to anon, authenticated;

-- ── 8) crear_reporte: version final (sin whatsapp, con modo_reporte) ──
-- Se eliminan TODAS las versiones anteriores conocidas para evitar ambiguedad
-- de sobrecarga (Postgres permite funciones con el mismo nombre y distinta
-- cantidad de parametros coexistiendo, lo cual confunde a PostgREST).
drop function if exists public.crear_reporte(text, text, text, text, text, text, text, text);
drop function if exists public.crear_reporte(text, text, text, text, text, text, text, text, text);
drop function if exists public.crear_reporte(text, text, text, text, text, text, text, text, text, text);

create function public.crear_reporte(
  p_categoria text,
  p_cedis text,
  p_comedor text,
  p_nombre text,
  p_numero_empleado text,
  p_descripcion text,
  p_prioridad text,
  p_foto_url text,
  p_modo_reporte text default 'anonimo'
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
  insert into public.reportes (
    categoria, cedis, comedor, nombre, numero_empleado,
    descripcion, prioridad, foto_url, modo_reporte
  ) values (
    p_categoria, p_cedis, p_comedor, p_nombre, p_numero_empleado,
    p_descripcion, p_prioridad, p_foto_url, p_modo_reporte
  )
  returning reportes.id into v_id;

  return query
    select r.folio, r.categoria, r.prioridad, r.cedis, r.comedor, r.estatus, r.creado_en
    from public.reportes r
    where r.id = v_id;
end;
$$;

grant execute on function public.crear_reporte(
  text, text, text, text, text, text, text, text, text
) to anon, authenticated;
