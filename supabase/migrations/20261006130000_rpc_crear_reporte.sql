/* ═══════════════════════════════════════════════════════════════
   RPC crear_reporte
   ───────────────────────────────────────────────────────────────
   Por qué existe: el rol "anon" tiene permiso de INSERT en
   public.reportes, pero a propósito NO tiene permiso de SELECT
   (no queremos que cualquiera sin login pueda leer todos los
   reportes vía la API REST). El problema es que supabase-js hace
   `.insert(...).select().single()` para traer de vuelta el folio
   recien generado, y ese RETURNING exige que la fila pase también
   una política de SELECT -> sin ella, Postgres truena con
   "new row violates row-level security policy", aunque el INSERT
   en sí esté permitido.

   La solución estándar de Postgres/Supabase para "puedo escribir
   pero no puedo leer en general" es una función SECURITY DEFINER:
   corre con privilegios del dueño (bypassa RLS para su propia
   lógica interna, las CHECK constraints de la tabla se siguen
   aplicando igual) y solo expone los campos que el formulario
   necesita para la pantalla de confirmación.
═══════════════════════════════════════════════════════════════ */

create or replace function public.crear_reporte(
  p_categoria text,
  p_cedis text,
  p_comedor text,
  p_nombre text,
  p_numero_empleado text,
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
    descripcion, prioridad, foto_url
  ) values (
    p_categoria, p_cedis, p_comedor, p_nombre, p_numero_empleado,
    p_descripcion, p_prioridad, p_foto_url
  )
  returning reportes.id into v_id;

  return query
    select r.folio, r.categoria, r.prioridad, r.cedis, r.comedor, r.creado_en
    from public.reportes r
    where r.id = v_id;
end;
$$;

-- Solo exponemos ESTA funcion al rol anonimo, no acceso de lectura general.
grant execute on function public.crear_reporte(
  text, text, text, text, text, text, text, text
) to anon, authenticated;
