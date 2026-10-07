/* ═══════════════════════════════════════════════════════════════
   Ajustes mayores solicitados (revision integral TransQR):

   1) Reversion: el telefono de WhatsApp del asociado NUNCA debe
      guardarse (la base de asociados no tiene telefonos, y el
      cliente aclaro que WhatsApp es un canal, no un dato a
      registrar). Se elimina la columna y el constraint que la
      referenciaba.
   2) Nueva tabla "asociados": numero_empleado -> nombre + area.
      Solo accesible via funcion segura (buscar_asociado), nunca
      por SELECT directo desde el frontend.
   3) Reporte personalizado ya no pide nombre a mano: se obtiene
      de la tabla de asociados via el numero de empleado.
   4) CEDIS: se pone 'cedis-villahermosa' como default (unica sede
      operando hoy), sin perder la flexibilidad de la tabla para
      soportar otros CEDIS en el futuro.
═══════════════════════════════════════════════════════════════ */

-- ── 1) Revertir telefono_whatsapp (diseño descartado) ──
alter table public.reportes drop constraint if exists reportes_modo_reporte_consistente;
alter table public.reportes drop column if exists telefono_whatsapp;

-- Nuevo constraint de consistencia: personalizado requiere numero_empleado + nombre
-- (ambos provienen de la tabla de asociados, nunca capturados a mano).
alter table public.reportes add constraint reportes_modo_reporte_consistente check (
  (modo_reporte = 'anonimo') or
  (modo_reporte = 'personalizado' and numero_empleado is not null and nombre is not null)
);

-- ── 2) CEDIS: default a Villahermosa (unica sede activa hoy) ──
alter table public.reportes alter column cedis set default 'cedis-villahermosa';

-- ── 3) Tabla de asociados ──
-- Solo numero de asociado, nombre y area -- NUNCA telefono (no existe en la fuente real).
create table if not exists public.asociados (
  numero_empleado text primary key,
  nombre          text not null,
  area            text,
  creado_en       timestamptz not null default now()
);

alter table public.asociados enable row level security;

-- A proposito NO hay policy de SELECT para anon/authenticated: la tabla completa
-- nunca debe poder listarse desde el frontend. El unico acceso es via la funcion
-- buscar_asociado() (SECURITY DEFINER), que regresa solo nombre+area de UN match exacto.
drop policy if exists "nadie lee asociados directo" on public.asociados;

-- ── 4) Funcion segura: buscar un asociado por numero de empleado ──
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

-- ── 5) Funcion segura: consultar el avance de un reporte por folio ──
-- Expone SOLO lo que el asociado necesita ver. NUNCA nombre, numero de
-- empleado, responsable interno ni accion administrativa.
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

-- ── 6) Funcion segura: linea de tiempo publica de un reporte ──
-- Solo estatus + fecha. Nada de "usuario" ni "nota" (eso es admin-only).
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
