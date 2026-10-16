// Edge Function: notificar-push
// Fase 5-7 del plan PWA. Disparada por el trigger trg_notificar_push
// (ver supabase/migrations/20261008130100_trigger_notificar_push.sql)
// cada vez que se inserta una fila en reportes_historial -- es decir,
// en CADA creacion de reporte y en CADA cambio de estatus.
//
// Reglas de negocio (actualizado: anonimato total, ver migracion
// 20261010120000_anonimato_total.sql):
//   - Reporte nuevo (estatus_anterior IS NULL) -> avisa a TODOS los
//     admins con suscripcion activa.
//   - Cambio de estatus de CUALQUIER reporte   -> avisa a quien se haya
//     suscrito a ESE folio en particular (tabla push_subscriptions,
//     tipo='reporte'), si el nuevo estatus es revision/atendido/cerrado.
//     La suscripcion nunca identifica a una persona -- solo "alguien
//     con este navegador quiere avisos de este folio", por eso ya no
//     importa si el reporte es anonimo o no: TODOS lo son.
//
// Variables de entorno requeridas (Supabase Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (estas dos ya existen
//   automaticamente en todo Edge Function de Supabase, no hay que
//   configurarlas a mano).

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:soporte@example.com";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CAT_NAMES: Record<string, string> = {
  temperatura: "Temperatura", calidad: "Calidad y frescura", coccion: "Cocción",
  porcion: "Porción", objeto: "Objeto extraño", limpieza: "Limpieza",
  espera: "Tiempo de espera", atencion: "Atención",
  higiene: "Higiene", otra: "Otra incidencia"
};
const COMEDOR_NAMES: Record<string, string> = { secos: "Comedor Secos", perecederos: "Comedor Perecederos" };
const PRI_LABELS: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };

Deno.serve(async (req) => {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error("Faltan VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY en los secrets.");
      return new Response("vapid no configurado", { status: 200 });
    }

    const payload = await req.json();
    const record = payload?.record;
    if (!record) return new Response("sin registro", { status: 200 });

    const { reporte_id, estatus_anterior, estatus_nuevo } = record;

    const { data: reporte, error } = await supabaseAdmin
      .from("reportes")
      .select("folio, categoria, comedor, prioridad")
      .eq("id", reporte_id)
      .single();

    if (error || !reporte) return new Response("reporte no encontrado", { status: 200 });

    if (estatus_anterior === null) {
      await notificarAdmins(reporte);
    } else {
      await notificarPorFolio(reporte, estatus_nuevo);
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("notificar-push error:", err);
    // 200 a proposito: evita que Supabase reintente el webhook en bucle.
    return new Response("error interno", { status: 200 });
  }
});

async function notificarAdmins(reporte: any) {
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("*")
    .eq("tipo", "admin")
    .eq("activa", true);

  const payload = JSON.stringify({
    title: "Nuevo reporte de comedor",
    body: `${CAT_NAMES[reporte.categoria] || reporte.categoria} · ${COMEDOR_NAMES[reporte.comedor] || reporte.comedor} · Prioridad ${PRI_LABELS[reporte.prioridad] || reporte.prioridad} · Folio ${reporte.folio}`,
    tag: `reporte-${reporte.folio}`,
    data: { url: `./index.html?admin_folio=${reporte.folio}` }
  });

  await enviarATodos(subs || [], payload);
}

async function notificarPorFolio(reporte: any, estatusNuevo: string) {
  const textos: Record<string, string> = {
    revision: `Tu reporte ${reporte.folio} está siendo revisado.`,
    atendido: `Tu reporte ${reporte.folio} fue atendido.`,
    cerrado: `Tu reporte ${reporte.folio} fue cerrado.`
  };
  const body = textos[estatusNuevo];
  if (!body) return; // "pendiente" u otro estatus no listado: no se notifica

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("*")
    .eq("tipo", "reporte")
    .eq("folio", reporte.folio)
    .eq("activa", true);

  const payload = JSON.stringify({
    title: "Actualización de tu reporte",
    body,
    tag: `reporte-${reporte.folio}`,
    data: { url: `./index.html?folio=${reporte.folio}` }
  });

  await enviarATodos(subs || [], payload);
}

async function enviarATodos(subs: any[], payloadJson: string) {
  await Promise.allSettled(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        payloadJson
      );
      await supabaseAdmin.from("push_subscriptions").update({ visto_en: new Date().toISOString() }).eq("id", sub.id);
    } catch (err: any) {
      // 404/410 = la suscripcion ya no existe en el navegador del usuario
      // (desinstalo la app, borro datos, etc). La apagamos para no
      // seguir intentando enviarle para siempre (fase 15 del plan).
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        await supabaseAdmin.from("push_subscriptions").update({ activa: false }).eq("id", sub.id);
      } else {
        console.error("Error enviando push a subscription", sub.id, err?.message || err);
      }
    }
  }));
}
