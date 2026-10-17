/* ═══════════════════════════════════════════════════════════════
   Campañas: encuestas (ej. "elige el menú de la próxima semana") y
   avisos (ej. mantenimiento, cierre temporal) que el admin publica y
   el asociado ve en la app -- mismo espíritu de anonimato total que
   el resto del proyecto (ver 20261010120000_anonimato_total.sql):
   un voto es solo {campana_id, opcion, fecha}, sin nada que permita
   identificar a quién lo emitió. El control de "un voto por persona"
   se decidió a propósito como best-effort del lado del cliente
   (localStorage, ver js/campanas.js), nunca con un identificador de
   dispositivo guardado en el servidor -- eso rompería la anonimidad.
═══════════════════════════════════════════════════════════════ */

create table if not exists public.campanas (
  id            bigint generated always as identity primary key,
  tipo          text not null check (tipo in ('encuesta', 'aviso')),
  titulo        text not null,
  descripcion   text,
  opciones      jsonb,
  fecha_inicio  date not null,
  fecha_fin     date not null,
  activa        boolean not null default true,
  creado_en     timestamptz not null default now(),
  constraint campanas_fechas check (fecha_fin >= fecha_inicio),
  -- Un aviso nunca trae opciones; una encuesta SIEMPRE trae 2+ opciones
  -- (el "is not null" explícito evita el hueco clásico de CHECK donde
  -- comparar contra NULL da UNKNOWN y la fila pasaría sin querer).
  constraint campanas_opciones_validas check (
    (tipo = 'aviso' and opciones is null)
    or
    (tipo = 'encuesta' and opciones is not null
      and jsonb_typeof(opciones) = 'array' and jsonb_array_length(opciones) >= 2)
  )
);

create index if not exists idx_campanas_vigencia on public.campanas(activa, fecha_inicio, fecha_fin);

-- ── Votos de encuesta: una fila anónima por voto, nada de identificar a nadie ──
create table if not exists public.campana_votos (
  id          bigint generated always as identity primary key,
  campana_id  bigint not null references public.campanas(id) on delete cascade,
  opcion      text not null,
  creado_en   timestamptz not null default now()
);

create index if not exists idx_campana_votos_campana on public.campana_votos(campana_id);

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════
alter table public.campanas enable row level security;
alter table public.campana_votos enable row level security;

-- El asociado (anon) solo ve campañas activas y dentro de su rango de fechas
-- -- nada de programadas a futuro, finalizadas o desactivadas manualmente.
drop policy if exists "anon lee campañas vigentes" on public.campanas;
create policy "anon lee campañas vigentes"
  on public.campanas for select
  to anon
  using (activa = true and current_date between fecha_inicio and fecha_fin);

-- El admin ve TODAS (programadas, finalizadas, inactivas) para poder gestionarlas.
drop policy if exists "admin lee todas las campañas" on public.campanas;
create policy "admin lee todas las campañas"
  on public.campanas for select
  to authenticated
  using (true);

drop policy if exists "admin crea campañas" on public.campanas;
create policy "admin crea campañas"
  on public.campanas for insert
  to authenticated
  with check (true);

drop policy if exists "admin actualiza campañas" on public.campanas;
create policy "admin actualiza campañas"
  on public.campanas for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "admin elimina campañas" on public.campanas;
create policy "admin elimina campañas"
  on public.campanas for delete
  to authenticated
  using (true);

-- Votos: cualquiera (asociado anónimo) puede votar y leer los resultados --
-- no hay nada identificable en esta tabla, mostrar el acumulado en vivo es
-- justo lo que se pidió (resultados visibles para todos tras votar).
drop policy if exists "cualquiera vota" on public.campana_votos;
create policy "cualquiera vota"
  on public.campana_votos for insert
  to anon, authenticated
  with check (true);

drop policy if exists "cualquiera lee resultados" on public.campana_votos;
create policy "cualquiera lee resultados"
  on public.campana_votos for select
  to anon, authenticated
  using (true);
