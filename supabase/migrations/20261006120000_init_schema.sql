-- ════════════════════════════════════════════════════════════
-- Esquema inicial: Reportes de Oportunidades — Comedor Walmart CEDIS
-- ════════════════════════════════════════════════════════════

-- ── Secuencia para folios únicos (generados en servidor, sin colisiones) ──
create sequence if not exists reportes_folio_seq start 1;

-- ── Tabla principal de reportes ──
create table if not exists public.reportes (
  id              bigint generated always as identity primary key,
  folio           text not null unique,
  categoria       text not null check (categoria in (
                    'temperatura','calidad','coccion','porcion','objeto',
                    'limpieza','espera','atencion','higiene','otra')),
  cedis           text not null check (cedis in (
                    'cedis-villahermosa','cedis-merida','cedis-queretaro','cedis-campeche')),
  comedor         text not null check (comedor in ('principal','secundario')),
  nombre          text,
  numero_empleado text not null,
  descripcion     text not null,
  prioridad       text not null check (prioridad in ('alta','media','baja')),
  estatus         text not null default 'pendiente'
                    check (estatus in ('pendiente','revision','atendido','cerrado')),
  foto_url        text,
  responsable     text,
  accion          text,
  fecha_compromiso date,
  es_demo         boolean not null default false,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create index if not exists idx_reportes_cedis on public.reportes(cedis);
create index if not exists idx_reportes_estatus on public.reportes(estatus);
create index if not exists idx_reportes_categoria on public.reportes(categoria);
create index if not exists idx_reportes_creado_en on public.reportes(creado_en);

-- ── Historial de cambios de estatus (trazabilidad) ──
create table if not exists public.reportes_historial (
  id               bigint generated always as identity primary key,
  reporte_id       bigint not null references public.reportes(id) on delete cascade,
  estatus_anterior text,
  estatus_nuevo    text not null,
  usuario          text not null,
  nota             text,
  creado_en        timestamptz not null default now()
);

create index if not exists idx_historial_reporte on public.reportes_historial(reporte_id);

-- ════════════════════════════════════════════════════════════
-- FUNCIONES Y TRIGGERS (lógica centralizada en servidor — DRY)
-- ════════════════════════════════════════════════════════════

-- Folio automático: COM-<año>-000001
create or replace function public.fn_set_folio()
returns trigger
language plpgsql
as $$
begin
  if new.folio is null or new.folio = '' then
    new.folio := 'COM-' || extract(year from now())::text || '-' ||
                 lpad(nextval('reportes_folio_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_folio on public.reportes;
create trigger trg_set_folio
  before insert on public.reportes
  for each row execute function public.fn_set_folio();

-- actualizado_en automático
create or replace function public.fn_touch_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_actualizado_en on public.reportes;
create trigger trg_touch_actualizado_en
  before update on public.reportes
  for each row execute function public.fn_touch_actualizado_en();

-- Historial inicial automático al crear un reporte
create or replace function public.fn_historial_on_insert()
returns trigger
language plpgsql
as $$
begin
  insert into public.reportes_historial (reporte_id, estatus_anterior, estatus_nuevo, usuario, nota)
  values (new.id, null, new.estatus, 'Sistema',
          case when new.es_demo then 'Reporte creado — DATOS DE DEMOSTRACIÓN' else 'Reporte creado por asociado' end);
  return new;
end;
$$;

drop trigger if exists trg_historial_on_insert on public.reportes;
create trigger trg_historial_on_insert
  after insert on public.reportes
  for each row execute function public.fn_historial_on_insert();

-- Historial automático al cambiar estatus (evita que el front olvide registrar el cambio)
create or replace function public.fn_historial_on_status_change()
returns trigger
language plpgsql
as $$
begin
  if new.estatus is distinct from old.estatus then
    insert into public.reportes_historial (reporte_id, estatus_anterior, estatus_nuevo, usuario, nota)
    values (new.id, old.estatus, new.estatus,
            coalesce(auth.jwt() ->> 'email', 'Administrador'), 'Actualizado desde panel admin');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_historial_on_status_change on public.reportes;
create trigger trg_historial_on_status_change
  after update on public.reportes
  for each row execute function public.fn_historial_on_status_change();

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════
alter table public.reportes enable row level security;
alter table public.reportes_historial enable row level security;

-- Cualquiera (asociado anónimo) puede CREAR un reporte, pero no leer/editar otros
drop policy if exists "anon puede insertar reportes" on public.reportes;
create policy "anon puede insertar reportes"
  on public.reportes for insert
  to anon, authenticated
  with check (true);

-- Solo administradores autenticados pueden ver/editar reportes (panel admin)
drop policy if exists "admin puede leer reportes" on public.reportes;
create policy "admin puede leer reportes"
  on public.reportes for select
  to authenticated
  using (true);

drop policy if exists "admin puede actualizar reportes" on public.reportes;
create policy "admin puede actualizar reportes"
  on public.reportes for update
  to authenticated
  using (true)
  with check (true);

-- Historial: el trigger inserta con privilegios de definer implícitos vía RLS normal,
-- por eso permitimos insert a anon/authenticated (el trigger corre como el rol que dispara el insert/update)
drop policy if exists "insertar historial" on public.reportes_historial;
create policy "insertar historial"
  on public.reportes_historial for insert
  to anon, authenticated
  with check (true);

drop policy if exists "admin puede leer historial" on public.reportes_historial;
create policy "admin puede leer historial"
  on public.reportes_historial for select
  to authenticated
  using (true);

-- ════════════════════════════════════════════════════════════
-- STORAGE: evidencia fotográfica
-- ════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias', 'evidencias', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "anon puede subir evidencia" on storage.objects;
create policy "anon puede subir evidencia"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'evidencias');

drop policy if exists "cualquiera puede ver evidencia" on storage.objects;
create policy "cualquiera puede ver evidencia"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'evidencias');
