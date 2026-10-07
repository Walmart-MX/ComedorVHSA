/* ═══════════════════════════════════════════════════════════════
   crear_reporte: agrega soporte para modo anonimo/personalizado.
   Los parametros nuevos van al final CON default, para que la
   funcion siga siendo "reemplazable" (create or replace) y las
   llamadas viejas con 8 argumentos sigan funcionando sin romperse.
═══════════════════════════════════════════════════════════════ */

create or replace function public.crear_reporte(
  p_categoria text,
  p_cedis text,
  p_comedor text,
  p_nombre text,
  p_numero_empleado text,
  p_descripcion text,
  p_prioridad text,
  p_foto_url text,
  p_modo_reporte text default 'anonimo',
  p_telefono_whatsapp text default null
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
    descripcion, prioridad, foto_url, modo_reporte, telefono_whatsapp
  ) values (
    p_categoria, p_cedis, p_comedor, p_nombre, p_numero_empleado,
    p_descripcion, p_prioridad, p_foto_url, p_modo_reporte, p_telefono_whatsapp
  )
  returning reportes.id into v_id;

  return query
    select r.folio, r.categoria, r.prioridad, r.cedis, r.comedor, r.creado_en
    from public.reportes r
    where r.id = v_id;
end;
$$;

grant execute on function public.crear_reporte(
  text, text, text, text, text, text, text, text, text, text
) to anon, authenticated;
