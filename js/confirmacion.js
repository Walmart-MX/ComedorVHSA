/* ═══════════════════════════════════════════════════════════════
   Pantalla de confirmación ("tu reporte se registró"). Todo lo que
   pasa AQUÍ es opcional y ocurre DESPUÉS de que el reporte ya se
   guardó -- nada de esto bloquea ni condiciona el registro:
     1) Copiar el folio.
     2) Compartir el resumen por WhatsApp (el reporte sigue siendo
        anónimo: solo se comparte el folio/categoría/fecha, nunca un
        dato que identifique a quien reportó).
     3) Pedir atención personalizada: dejar voluntariamente un medio
        de contacto ligado SOLO al folio (nunca a una identidad), para
        que el equipo de comedor pueda buscar a esa persona en el
        comedor o llamarle, sin que el sistema sepa quién es.
     4) Activar notificaciones del folio (ver push.js) -- también
        ligadas solo al folio, nunca a una persona.
═══════════════════════════════════════════════════════════════ */

import { supabase, isSupabaseConfigured } from './supabase-client.js';
import { CAT_NAMES, COMEDOR_NAMES, STATUS_PUBLICO } from './catalog.js';
import { getWhatsappDestino, cargarConfiguracion } from './app-config.js';
import { activarNotificacionesReporte, pushDisponible } from './push.js';

let folioActual = null;

export function mostrarConfirmacion(r) {
  folioActual = r.folio;
  document.getElementById('step-2').classList.add('hidden');
  document.getElementById('step-confirm').classList.remove('hidden');
  document.getElementById('c-folio').textContent = r.folio;
  document.getElementById('c-cat').textContent = CAT_NAMES[r.categoria];
  document.getElementById('c-comedor').textContent = COMEDOR_NAMES[r.comedor] || r.comedor;
  document.getElementById('c-fecha').textContent = new Date(r.creado_en).toLocaleString('es-MX');
  document.getElementById('c-estado').textContent = STATUS_PUBLICO[r.estatus] || r.estatus;

  wireCopiarFolio();
  wireWhatsapp(r);
  wireAtencionPersonalizada();
  mostrarOpcionNotificaciones();
}

function wireCopiarFolio() {
  const btn = document.getElementById('btn-copiar-folio');
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = '1';
  btn.addEventListener('click', () => {
    const folio = document.getElementById('c-folio').textContent;
    const original = btn.textContent;
    navigator.clipboard?.writeText(folio).then(() => {
      btn.textContent = 'Copiado';
      setTimeout(() => { btn.textContent = original; }, 1500);
    }).catch(() => alert(`Tu folio es: ${folio}`));
  });
}

/** El botón de WhatsApp comparte un resumen SIN datos personales (el
    reporte es siempre anónimo) -- es simplemente un canal adicional para
    avisar al equipo, nunca una condición para registrar el reporte. Se
    vuelve a pedir la configuración (en vez de confiar en el cache que
    cargó main-app.js al arrancar) porque esa carga inicial podría no
    haber terminado todavía. */
async function wireWhatsapp(r) {
  const btn = document.getElementById('btn-whatsapp-confirmar');
  if (!btn) return;
  try {
    await Promise.race([
      cargarConfiguracion(),
      new Promise((resolve) => setTimeout(resolve, 4000))
    ]);
  } catch (err) {
    console.error('No se pudo refrescar la configuración de WhatsApp:', err.message || err);
  }
  const destino = getWhatsappDestino();
  if (!destino) {
    btn.classList.add('hidden');
    return;
  }
  const resumen = `Reporte registrado en el sistema de comedor (anónimo)\nFolio: ${r.folio}\nCategoría: ${CAT_NAMES[r.categoria]}\nComedor: ${COMEDOR_NAMES[r.comedor] || r.comedor}\nFecha: ${new Date(r.creado_en).toLocaleString('es-MX')}`;
  btn.href = `https://wa.me/${destino}?text=${encodeURIComponent(resumen)}`;
  btn.classList.remove('hidden');
}

/** "Recibir atención personalizada": revela un mini-formulario opcional
    para dejar un medio de contacto ligado SOLO al folio -- nunca pide
    nombre ni número de asociado. Quien no lo use, queda 100% anónimo. */
function wireAtencionPersonalizada() {
  const btnAbrir = document.getElementById('btn-abrir-atencion');
  const form = document.getElementById('atencion-form');
  const btnEnviar = document.getElementById('btn-enviar-atencion');
  const resultado = document.getElementById('atencion-resultado');
  if (!btnAbrir || !form || !btnEnviar) return;

  form.classList.add('hidden');
  resultado.classList.add('hidden');
  document.getElementById('atencion-contacto').value = '';
  btnAbrir.classList.remove('hidden');

  btnAbrir.replaceWith(btnAbrir.cloneNode(true));
  const btnAbrirNuevo = document.getElementById('btn-abrir-atencion');
  btnAbrirNuevo.addEventListener('click', () => {
    btnAbrirNuevo.classList.add('hidden');
    form.classList.remove('hidden');
  });

  btnEnviar.replaceWith(btnEnviar.cloneNode(true));
  document.getElementById('btn-enviar-atencion').addEventListener('click', enviarSolicitudAtencion);
}

async function enviarSolicitudAtencion() {
  const medio = document.getElementById('atencion-medio').value;
  const contacto = document.getElementById('atencion-contacto').value.trim();
  const resultado = document.getElementById('atencion-resultado');
  const btn = document.getElementById('btn-enviar-atencion');

  if (!contacto) {
    resultado.className = 'form-hint cfg-msg-error';
    resultado.textContent = 'Escribe un número de teléfono o WhatsApp para que te contactemos.';
    resultado.classList.remove('hidden');
    return;
  }
  if (!isSupabaseConfigured || !folioActual) return;

  btn.disabled = true;
  btn.textContent = 'Enviando...';
  const { error } = await supabase.rpc('solicitar_atencion_personalizada', {
    p_folio: folioActual,
    p_medio: medio,
    p_contacto: contacto
  });
  btn.disabled = false;
  btn.textContent = 'Solicitar atención';

  resultado.classList.remove('hidden');
  if (error) {
    console.error(error);
    resultado.className = 'form-hint cfg-msg-error';
    resultado.textContent = 'No se pudo enviar tu solicitud. Intenta de nuevo.';
    return;
  }
  resultado.className = 'form-hint cfg-msg-ok';
  resultado.textContent = 'Listo. El equipo de comedor te contactará pronto. Tu reporte sigue siendo anónimo en el sistema.';
  document.getElementById('atencion-form').classList.add('hidden');
}

/** Notificaciones ligadas SOLO al folio (nunca a una persona): se ofrece
    SIEMPRE tras guardar el reporte, SOLO si el navegador/VAPID lo soportan. */
function mostrarOpcionNotificaciones() {
  const box = document.getElementById('push-opt-in');
  if (!pushDisponible() || !folioActual) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  const btn = document.getElementById('btn-activar-notif-asociado');
  const resultado = document.getElementById('push-opt-in-resultado');
  resultado.classList.add('hidden');
  btn.classList.remove('hidden');
  btn.disabled = false;
  btn.textContent = 'Activar notificaciones';

  const handler = () => {
    btn.disabled = true;
    btn.textContent = 'Activando...';
    activarNotificacionesReporte(folioActual, (ok, motivo) => {
      btn.disabled = false;
      resultado.classList.remove('hidden');
      if (ok) {
        btn.classList.add('hidden');
        resultado.textContent = 'Notificaciones activadas para este folio.';
      } else {
        btn.textContent = 'Activar notificaciones';
        resultado.textContent = motivo === 'denegado'
          ? 'No diste permiso de notificaciones. Puedes seguir consultando tu folio manualmente.'
          : 'No se pudo activar en este momento.';
      }
    });
  };
  btn.replaceWith(btn.cloneNode(true)); // evita listeners duplicados entre reportes
  document.getElementById('btn-activar-notif-asociado').addEventListener('click', handler);
}
