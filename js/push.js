/* ═══════════════════════════════════════════════════════════════
   Push notifications -- Fase 4/6/7 del plan PWA.

   Deliberadamente "dormido" hasta que VAPID_PUBLIC_KEY (js/config.js)
   tenga un valor real: sin eso no hay forma de suscribirse, asi que
   todo este modulo se vuelve no-op sin romper nada (fase 24: detectar
   capacidad, no romper la app si falta).

   Reglas de negocio que este archivo respeta (NO decide el permiso
   por el usuario, NO lo pide automaticamente):
   - Anonimo:       nunca se ofrece activar notificaciones.
   - Personalizado: se ofrece DESPUES de guardar el reporte (nunca
     antes, nunca como requisito).
   - Admin:         se ofrece solo despues de iniciar sesion real.
═══════════════════════════════════════════════════════════════ */

import { supabase } from './supabase-client.js';
import { VAPID_PUBLIC_KEY } from './config.js';

function soportaPush() {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function suscribirse() {
  const reg = await navigator.serviceWorker.ready;
  const existente = await reg.pushManager.getSubscription();
  if (existente) return existente;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });
}

/** Asociado identificado: se llama SOLO desde la pantalla de confirmacion,
    SOLO en modo 'personalizado', y SOLO si el usuario toca el boton. */
export async function activarNotificacionesAsociado(numeroEmpleado, onResultado) {
  if (!soportaPush()) return onResultado?.(false, 'no-soportado');
  if (Notification.permission === 'denied') return onResultado?.(false, 'denegado');

  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return onResultado?.(false, 'denegado');

    const sub = await suscribirse();
    const json = sub.toJSON();
    const { error } = await supabase.rpc('guardar_push_subscription_asociado', {
      p_numero_empleado: numeroEmpleado,
      p_endpoint: json.endpoint,
      p_p256dh: json.keys.p256dh,
      p_auth: json.keys.auth,
      p_user_agent: navigator.userAgent
    });
    if (error) throw error;
    onResultado?.(true);
  } catch (err) {
    console.error('No se pudo activar notificaciones:', err);
    onResultado?.(false, 'error');
  }
}

/** Admin: se llama desde un boton en el panel, solo visible tras login. */
export async function activarNotificacionesAdmin(onResultado) {
  if (!soportaPush()) return onResultado?.(false, 'no-soportado');
  if (Notification.permission === 'denied') return onResultado?.(false, 'denegado');

  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return onResultado?.(false, 'denegado');

    const sub = await suscribirse();
    const json = sub.toJSON();
    const { error } = await supabase.rpc('guardar_push_subscription_admin', {
      p_endpoint: json.endpoint,
      p_p256dh: json.keys.p256dh,
      p_auth: json.keys.auth,
      p_user_agent: navigator.userAgent
    });
    if (error) throw error;
    onResultado?.(true);
  } catch (err) {
    console.error('No se pudo activar notificaciones de admin:', err);
    onResultado?.(false, 'error');
  }
}

export function pushDisponible() {
  return soportaPush();
}
