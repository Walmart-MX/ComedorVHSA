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
  comedor, fecha) al número configurado en el panel admin, abierto siempre
  vía `wa.me` directo a ese número -- sin pasar por el selector de
  contactos del sistema. Si el reporte trae foto, su URL viaja como un
  link dentro del mismo mensaje de texto (WhatsApp no soporta adjuntar
  archivos reales vía enlace, solo texto precargado).
- **Activar notificaciones** de cambios de estatus, ligadas solo al folio
  (`push_subscriptions`, tipo `reporte`), nunca a una persona.
- [x] Esquema de base de datos (`supabase/migrations/`) -- confirmado en
      vivo: `guardar_push_subscription_reporte` responde con el error de
      negocio esperado (folio no encontrado) para un folio sintético, lo
      que confirma que la migración `20261010120000_anonimato_total.sql`
      ya está aplicada en el proyecto real.
- [x] Frontend reescrito en módulos (sin `localStorage` de datos de negocio,
      sin credenciales hardcodeadas, con RLS real)
- [x] Proyecto de Supabase creado y enlazado (`js/config.js` tiene la URL
      y anon key reales -- el anon key SÍ es seguro de exponer, ver
      comentario en ese archivo)
- [ ] Primer usuario admin creado en Supabase Auth (confirmar en
      Authentication > Users del dashboard de Supabase)
- [ ] Secret `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`
      configurado en la Edge Function `notificar-push` (sin esto, push
      queda desactivado solo del lado del servidor -- la llave pública en
      `js/config.js` ya es real y válida, verificada estructuralmente,
      pero eso no confirma que el *secret* privado en el servidor exista)
- [ ] Edge Function `notificar-push` desplegada (`supabase functions
      deploy notificar-push`) -- no se pudo confirmar desde el navegador
      por CORS (la función está pensada para ser llamada desde Postgres,
      no desde un navegador, así que esto es normal y no es un error)
- [ ] **Secreto de Vault `notificar_push_service_role_key` creado** --
      corre en el SQL Editor de Supabase (nunca en un archivo del repo):
      `select vault.create_secret('<Service Role Key real>', 'notificar_push_service_role_key');`
      Sin esto el trigger de push queda en modo silencioso (no rompe nada,
      simplemente no avisa a nadie).
- [ ] Trigger `trg_notificar_push` re-aplicado con la versión corregida de
      `20261008130100_trigger_notificar_push.sql` (ver ` Hallazgo de
      seguridad` más abajo -- **esto es urgente, no opcional**)
- [ ] GitHub Pages activado

**Hallazgo de seguridad (corregido en el código, acción pendiente en
Supabase):** una versión anterior de `20261008130100_trigger_notificar_push.sql`
tenía la Service Role Key real del proyecto escrita en texto plano. Ya se
corrigió en el repo (ahora usa Supabase Vault, ver el propio archivo), pero
eso **no** revierte una llave que ya pudo haber sido aplicada a la base de
datos real. Pasos obligatorios, en este orden:
1. Rotar la Service Role Key ahora mismo: Project Settings → API → Service
   Role Key → generar una nueva. Esto invalida la llave filtrada sin
   importar dónde haya quedado una copia.
2. Correr `supabase/auditoria_migraciones.sql` en el SQL Editor y revisar
   la columna `alerta_llave_real_todavia_en_la_funcion` -- si da `true`,
   la función en la base todavía tiene la llave vieja grabada.
3. Crear el secreto de Vault (ver arriba) y volver a correr el bloque
   `create or replace function public.fn_notificar_push()` ya corregido
   para que la función en la base deje de tener cualquier llave en texto
   plano.

## Estado del proyecto

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
