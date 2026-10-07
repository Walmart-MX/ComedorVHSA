/* crear_reporte: se quita p_telefono_whatsapp (diseño descartado -- ver
   migracion 20261007140000). La funcion anterior tenia 10 parametros con
   2 opcionales al final; como ninguno de los dos se usaba todavia desde
   produccion real, se recrea limpia en vez de arrastrar el parametro
   muerto para siempre. */

drop function if exists public.crear_reporte(
  text, text, text, text, text, text, text, text, text, text
);

create or replace function public.crear_reporte(
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
