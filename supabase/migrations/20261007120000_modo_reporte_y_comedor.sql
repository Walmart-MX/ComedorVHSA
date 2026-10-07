/* ═══════════════════════════════════════════════════════════════
   Ajustes solicitados:
   1) Renombrar comedor: 'principal'/'secundario' -> 'secos'/'perecederos'
   2) Reporte anonimo vs personalizado:
      - anonimo: no se pide numero de asociado ni nombre.
      - personalizado: numero de asociado + nombre + telefono de
        WhatsApp obligatorios, para dar seguimiento 1-a-1.
═══════════════════════════════════════════════════════════════ */

-- ── 1) Renombrar valores de comedor ──
alter table public.reportes drop constraint if exists reportes_comedor_check;

update public.reportes set comedor = 'secos' where comedor = 'principal';
update public.reportes set comedor = 'perecederos' where comedor = 'secundario';

alter table public.reportes
  add constraint reportes_comedor_check check (comedor in ('secos', 'perecederos'));

-- ── 2) numero_empleado ya no es obligatorio a nivel BD (los anonimos no lo traen) ──
alter table public.reportes alter column numero_empleado drop not null;

-- ── 3) Nuevas columnas: modo de reporte + telefono de contacto ──
alter table public.reportes
  add column if not exists modo_reporte text not null default 'anonimo'
    check (modo_reporte in ('anonimo', 'personalizado'));

alter table public.reportes
  add column if not exists telefono_whatsapp text;

-- Si es personalizado, numero_empleado y nombre deben venir; si es anonimo, deben ir vacios.
-- (Validacion de forma, no de contenido -- el check real de "obligatorio" vive en el
-- formulario; este constraint es una red de seguridad a nivel de datos.)
alter table public.reportes drop constraint if exists reportes_modo_reporte_consistente;
alter table public.reportes add constraint reportes_modo_reporte_consistente check (
  (modo_reporte = 'anonimo') or
  (modo_reporte = 'personalizado' and numero_empleado is not null and nombre is not null and telefono_whatsapp is not null)
);
