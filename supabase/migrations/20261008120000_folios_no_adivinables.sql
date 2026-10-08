/* ═══════════════════════════════════════════════════════════════
   Folios no adivinables (hallazgo de seguridad, revision quirurgica).

   Problema real: el folio se generaba con una secuencia pura
   (COM-2026-000001, 000002, 000003...). Como consultar_reporte()
   es publica y solo valida que el folio exista, CUALQUIERA podia
   recorrer numeros consecutivos y leer categoria/comedor/descripcion/
   estatus de TODOS los reportes del sistema, no solo el propio.

   La propiedad "secuencial" del folio nunca se uso para nada en el
   codigo (el admin ordena por creado_en, no por folio), asi que
   quitarla no rompe ninguna funcionalidad existente.

   Solucion: mismo formato visible (COM-<año>-XXXXXXXX), pero el
   codigo ahora es un bloque aleatorio de 8 caracteres hexadecimales
   (uuid random recortado) en vez de un contador. ~4,300 millones de
   combinaciones por año -- enumerar se vuelve inviable en la practica.

   Los folios YA EMITIDOS (formato viejo, con numeros consecutivos)
   siguen funcionando exactamente igual: no se tocan, no se migran,
   la unicidad y el lookup por folio no dependen del formato.
═══════════════════════════════════════════════════════════════ */

create or replace function public.fn_set_folio()
returns trigger
language plpgsql
as $$
declare
  v_codigo text;
  v_intentos int := 0;
begin
  if new.folio is null or new.folio = '' then
    loop
      v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      new.folio := 'COM-' || extract(year from now())::text || '-' || v_codigo;
      v_intentos := v_intentos + 1;
      exit when v_intentos > 5 or not exists (
        select 1 from public.reportes where folio = new.folio
      );
    end loop;
  end if;
  return new;
end;
$$;

-- La secuencia reportes_folio_seq queda sin usar pero NO se elimina:
-- es inofensiva y borrarla no aporta nada, solo agrega riesgo.
