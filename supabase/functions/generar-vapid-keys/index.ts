// Edge Function TEMPORAL: generar-vapid-keys
//
// Resuelve un problema practico: generar un par de llaves VAPID
// requiere Node.js/openssl, y no siempre se tiene a la mano. Esta
// funcion genera un par valido usando la misma libreria que ya
// usamos para enviar push (npm:web-push), corriendo DENTRO de
// Supabase -- no requiere instalar nada en tu equipo.
//
// COMO USARLA:
//   1. Pega este archivo en Supabase Dashboard -> Edge Functions ->
//      "Deploy a new function" -> nombre: generar-vapid-keys.
//   2. Abre la URL de la funcion UNA vez en el navegador (o con curl).
//   3. Copia "publicKey" y "privateKey" del JSON que regresa.
//   4. Guardalas en Project Settings -> Edge Functions -> Secrets como
//      VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY (y agrega VAPID_SUBJECT,
//      ej. "mailto:soporte@tuempresa.com").
//   5. BORRA esta funcion del dashboard -- ya cumplio su proposito y
//      no tiene ninguna proteccion de acceso (cualquiera con la URL
//      podria generar llaves nuevas, lo cual no es un riesgo de datos
//      pero no tiene caso dejarla viva).

import webpush from "npm:web-push@3.6.7";

Deno.serve(() => {
  const keys = webpush.generateVAPIDKeys();
  return new Response(JSON.stringify(keys, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
});
