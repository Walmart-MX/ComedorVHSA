# Comedor VHSA — Reportes del Comedor

App para que los asociados reporten, **de forma 100% anónima**, situaciones del
servicio de comedor de los CEDIS de Walmart México (temperatura, calidad,
limpieza, tiempo de espera, etc.), con un panel de gestión independiente para
dar seguimiento.

Stack: HTML + CSS + JS vanilla (sin build step) hospedado en **GitHub Pages**,
con **Supabase** como backend (Postgres + Auth + Storage).

## Dos apps independientes (inspirado en TransQR)

```
/           Redirección a /app/ (compatibilidad con links/QR viejos)
/app/       App pública del asociado -- formulario + consulta de folio
/admin/     Panel administrativo -- dashboard, reportes, tendencias, QR
```

Cada una es su propia PWA instalable, con su propio `manifest.webmanifest` y
`service-worker.js` (el *scope* de un Service Worker es la carpeta donde vive
el archivo, así que uno nunca controla al otro). Ningún código del panel
admin (login, gestión, exportaciones) viaja al navegador de un asociado que
solo visita `/app/` -- y viceversa, `/admin/` no carga nada del flujo de
reporte. `css/`, `icons/` y la mayoría de `js/` se comparten entre ambas
(DRY) vía rutas relativas (`../css/styles.css`, `../js/catalog.js`, etc.);
cada carpeta solo trae su propio `index.html`, `manifest.webmanifest` y
`service-worker.js`.

## Anonimato total

El sistema **nunca** pide nombre ni número de asociado, en ningún punto del
flujo. No existe un modo "con mis datos": todo reporte es anónimo, siempre.
En la pantalla de confirmación, de forma completamente opcional, se puede:

- **Compartir por WhatsApp**: un resumen con emojis (folio, categoría,
  comedor, fecha) al número configurado en el panel admin. Si el reporte
  trae foto, se intenta adjuntarla de verdad usando el panel nativo de
  compartir del navegador (Web Share API); si el dispositivo no lo soporta,
  el mensaje de WhatsApp igual incluye el link directo a la foto.
- **Activar notificaciones** de cambios de estatus, ligadas solo al folio
  (`push_subscriptions`, tipo `reporte`), nunca a una persona.

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
index.html               Redirección a ./app/ (no es una app en sí misma)
app/
  index.html              Shell del formulario del asociado + consulta de folio
  manifest.webmanifest    PWA del asociado
  service-worker.js       Cache/offline del asociado
admin/
  index.html              Shell del panel administrativo
  manifest.webmanifest    PWA del admin
  service-worker.js       Cache/offline del admin
css/styles.css            Estilos compartidos por ambas apps
icons/icon.svg            Icono compartido por ambas apps
js/
  config.js               URL + anon key de Supabase (compartido)
  supabase-client.js      Cliente de Supabase (compartido, ESM)
  catalog.js              Catálogos centralizados (compartido)
  icons.js                Iconos SVG en línea (compartido)
  app-config.js           Configuración editable desde el admin (número de WhatsApp)
  pwa.js                  Registro de Service Worker + banners (compartido)
  push.js                 Notificaciones push: por folio (asociado) y admin (compartido)
  main-app.js             Punto de entrada de /app/
  asociado.js              Flujo de reporte del asociado (100% anónimo)
  confirmacion.js         Pantalla post-envío: WhatsApp (con foto) y push
  consulta.js             Consulta pública de un reporte por folio
  main-admin.js           Punto de entrada de /admin/
  auth.js                 Login/logout del panel admin (Supabase Auth)
  admin-dashboard.js       KPIs y gráficas del dashboard
  admin-table.js          Tabla de reportes, filtros, CSV, modal de gestión
  admin-trends.js         Pestaña de tendencias
  admin-config.js         Pestaña "Configuración" (edita el número de WhatsApp)
  qr.js                   Generación del QR del comedor (pestaña "QR del comedor")
supabase/
  migrations/             Esquema SQL (tablas, triggers, RLS, storage)
  functions/notificar-push/  Edge Function de notificaciones push
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
`https://walmart-mx.github.io/ComedorVHSA/` (redirige a `/app/`). El panel
admin vive en `https://walmart-mx.github.io/ComedorVHSA/admin/` -- compártelo
solo con el equipo de comedor, no hay ningún link hacia él desde `/app/`.

## Decisiones de diseño (vs. el prototipo original)

- **Apps independientes** (inspirado en la separación `/app/` + `/admin/` de
  TransQR): el formulario del asociado y el panel administrativo ya no
  comparten una sola página con un password de JavaScript decidiendo qué
  mostrar. Cada uno es su propia PWA, en su propia ruta.
- **Anonimato total**: se eliminó por completo el número de asociado, el
  nombre y el modo "con mis datos". Ya no existe la tabla `asociados` ni la
  verificación contra ella -- nada en el sistema puede identificar a quien
  reportó. El único canal opcional tras enviar el reporte es compartirlo
  por WhatsApp (folio, categoría, comedor, fecha y foto si existe).
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
  "Configuración" del panel admin. Ya no está condicionado a ningún "modo"
  de reporte -- se ofrece siempre que haya un número configurado.
- **Instalación de la app (PWA)**: banner inferior visible e inequívoco
  ("Instalar app"), en vez de un botón circular escondido en una esquina
  que casi nadie notaba.
