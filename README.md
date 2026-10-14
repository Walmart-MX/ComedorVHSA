# Comedor VHSA — Reportes del Comedor

App para que los asociados reporten situaciones del servicio de comedor de
los CEDIS de Walmart México (temperatura, calidad, limpieza, tiempo de
espera, etc.), con un panel de gestión de reportes del comedor para dar
seguimiento.

Stack: HTML + CSS + JS vanilla (sin build step) hospedado en **GitHub Pages**,
con **Supabase** como backend (Postgres + Auth + Storage).

## Estado del proyecto

- [x] Esquema de base de datos (`supabase/migrations/`)
- [x] Frontend reescrito en módulos (sin `localStorage` de datos de negocio,
      sin credenciales hardcodeadas, con RLS real)
- [x] Proyecto de Supabase creado y enlazado (`js/config.js` tiene la URL
      y anon key reales)
- [ ] Primer usuario admin creado en Supabase Auth (confirmar en
      Authentication > Users del dashboard de Supabase)
- [ ] Secret `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` configurado en la Edge
      Function `notificar-push` (sin esto, push queda desactivado solo,
      no rompe nada -- ver js/push.js)
- [ ] Trigger `trg_notificar_push` aplicado con la Service Role Key real
      (ver advertencia en `20261008130100_trigger_notificar_push.sql`:
      el archivo en el repo trae un placeholder a propósito, se corre a
      mano en el SQL Editor con la llave real)
- [ ] GitHub Pages activado

## Estructura

```
index.html              Shell principal (markup, sin lógica inline)
css/styles.css           Estilos (extraídos del prototipo original)
js/
  config.js              URL + anon key de Supabase (público, seguro de exponer)
  supabase-client.js      Cliente de Supabase (ESM, vía esm.sh)
  catalog.js              Catálogos centralizados (categorías, CEDIS, prioridades...)
  app-config.js           Configuración editable desde el admin (hoy: número de WhatsApp)
  auth.js                 Login/logout del panel admin (Supabase Auth)
  asociado.js              Flujo de reporte del asociado
  admin-dashboard.js       KPIs y gráficas del dashboard
  admin-table.js          Tabla de reportes, filtros, CSV, modal de gestión
  admin-trends.js         Pestaña de tendencias
  admin-config.js         Pestaña "Configuración" (edita el número de WhatsApp)
  qr.js                   Generación del QR para imprimir en el comedor
  main.js                 Punto de entrada, conecta todo lo anterior
supabase/
  migrations/             Esquema SQL (tablas, triggers, RLS, storage)
```

## Pendiente para dejarlo 100% funcional

### 1. Confirmar la organización de Supabase (paso manual, una sola vez)

Supabase exige confirmar organizaciones nuevas desde su dashboard web antes
de permitir crear proyectos por API (es un control anti-abuso de ellos, no
nuestro). Pasos:

1. Entra a <https://supabase.com/dashboard>
2. Abre la organización **Walmart-MX** (ya creada vía CLI)
3. Sigue el flujo de "crear proyecto" ahí mismo una vez (plan Free, sin
   tarjeta) — esto "activa" la organización para la API
4. Avísame y retomo desde ahí: crear el proyecto `comedor-vhsa` por CLI,
   correr la migración (`supabase db push`), y llenar `js/config.js` con la
   URL y anon key reales.

### 2. Crear el primer usuario admin

Una vez exista el proyecto, se crea un usuario en **Authentication > Users**
del dashboard de Supabase (correo + contraseña). Ese es el login real del
panel admin — ya no hay usuario/contraseña fijo en el código.

### 3. GitHub Pages

Una vez tengamos `js/config.js` lleno, hacemos push y activo Pages
(`main` branch, carpeta raíz). El sitio queda en:
`https://walmart-mx.github.io/ComedorVHSA/`

## Decisiones de diseño (vs. el prototipo original)

- **Folios sin colisión y no adivinables**: generados por un trigger de
  Postgres con un código aleatorio (no un contador consecutivo ni un
  `localStorage` del navegador), para que la consulta pública por folio no
  se pueda usar para "recorrer" y leer reportes ajenos.
- **Historial automático**: triggers en la base de datos registran cada
  cambio de estatus, así nunca se pierde un paso aunque alguien edite la
  tabla directo en SQL.
- **Fotos de evidencia**: se suben a Supabase Storage (bucket `evidencias`)
  en vez de perderse como en el prototipo original (el botón de adjuntar
  foto no guardaba nada).
- **Seguridad**: Row Level Security en Postgres — cualquiera puede *crear*
  un reporte, pero solo administradores autenticados pueden leer/editar.
  Login real con Supabase Auth (antes: usuario/contraseña fijo en el código
  fuente, visible para cualquiera).
- **Sin XSS**: todo texto escrito por asociados se escapa antes de
  insertarse en el HTML del panel admin.
- **Accesibilidad**: las tarjetas de categoría son operables con teclado
  (antes solo funcionaban con clic/touch).
- **Tiempo de atención real**: se calcula de las fechas reales de los
  reportes, ya no con `Math.random()` como en el prototipo original.
- **WhatsApp configurable sin tocar código**: el número de destino vive en
  la base de datos (tabla `app_config`) y se edita desde la pestaña
  "Configuración" del panel admin. Antes estaba hardcodeado en
  `js/config.js`: cambiarlo exigía un developer y un redeploy completo.
- **Instalación de la app (PWA)**: banner inferior visible e inequívoco
  ("Instalar app"), en vez de un botón circular escondido en una esquina
  que casi nadie notaba.
- **Acceso admin discreto**: ya no es un botón flotante siempre visible
  encima del contenido del asociado -- es un link de pie de página, sin
  perder accesibilidad (sin trucos de opacidad que violen contraste WCAG).
