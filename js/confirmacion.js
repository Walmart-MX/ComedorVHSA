/* ═══════════════════════════════════════════════════════════════
   Pantalla de confirmación ("tu reporte se registró"). Todo lo que
   pasa AQUÍ es opcional y ocurre DESPUÉS de que el reporte ya se
   guardó -- nada de esto bloquea ni condiciona el registro:
     1) Copiar el folio.
     2) Compartir el reporte por WhatsApp (resumen con emojis, y la
        foto de evidencia si el reporte trae una).
     3) Activar notificaciones del folio (ver push.js) -- ligadas
        solo al folio, nunca a una persona.
═══════════════════════════════════════════════════════════════ */

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

/* Un emoji por categoría, solo para que el mensaje de WhatsApp se lea con
   más cuerpo y sea fácil de identificar de un vistazo -- son decorativos,
   nunca reemplazan el texto (accesible igual para quien lee el mensaje
   sin que su app muestre emojis). */
const CAT_EMOJI = {
  temperatura: '\u{1F321}\u{FE0F}',
  calidad: '\u{1F34E}',
  coccion: '\u{1F525}',
  porcion: '\u{1F37D}\u{FE0F}',
  objeto: '\u{26A0}\u{FE0F}',
  limpieza: '\u{2728}',
  espera: '\u{23F3}',
  atencion: '\u{1F4AC}',
  higiene: '\u{1F9FC}',
  otra: '\u{1F4DD}'
};

function construirResumenWhatsapp(r) {
  const emojiCat = CAT_EMOJI[r.categoria] || '\u{1F4CB}';
  const lineas = [
    `*Reporte del comedor* \u{1F37D}\u{FE0F}`,
    `\u{1F3F7}\u{FE0F} Folio: ${r.folio}`,
    `${emojiCat} Categoría: ${CAT_NAMES[r.categoria]}`,
    `\u{1F4CD} Comedor: ${COMEDOR_NAMES[r.comedor] || r.comedor}`,
    `\u{1F4C5} Fecha: ${new Date(r.creado_en).toLocaleString('es-MX')}`
  ];
  if (r.foto_url) lineas.push(`\u{1F4F7} Foto: ${r.foto_url}`);
  return lineas.join('\n');
}

/** El botón de WhatsApp comparte el reporte (folio/categoría/comedor/fecha,
    y la foto si existe) -- es simplemente un canal adicional para avisar al
    equipo, nunca una condición para registrar el reporte (que ya se guardó
    antes de llegar aquí). Se vuelve a pedir la configuración (en vez de
    confiar en el cache que cargó main-app.js al arrancar) porque esa carga
    inicial podría no haber terminado todavía. */
async function wireWhatsapp(r) {
  let btn = document.getElementById('btn-whatsapp-confirmar');
  if (!btn) return;
  btn.replaceWith(btn.cloneNode(true)); // evita listeners duplicados entre reportes
  btn = document.getElementById('btn-whatsapp-confirmar');
  btn.classList.add('hidden');

  try {
    await Promise.race([
      cargarConfiguracion(),
      new Promise((resolve) => setTimeout(resolve, 4000))
    ]);
  } catch (err) {
    console.error('No se pudo refrescar la configuración de WhatsApp:', err.message || err);
  }

  if (!getWhatsappDestino()) return;
  btn.classList.remove('hidden');
  btn.addEventListener('click', () => compartirPorWhatsapp(r));
}

/** Intenta adjuntar la FOTO real al compartir (Web Share API, disponible en
    la mayoría de navegadores móviles): se abre el panel nativo de compartir
    y el usuario elige WhatsApp ahí. Si el dispositivo no lo soporta, o algo
    falla al traer la foto, se cae al enlace clásico de WhatsApp (wa.me) con
    el resumen en texto -- ese SIEMPRE incluye la URL de la foto como un
    link, así que la foto sigue siendo accesible con un toque aunque no
    viaje "adjunta" de verdad. */
async function compartirPorWhatsapp(r) {
  const destino = getWhatsappDestino();
  if (!destino) return;
  const resumen = construirResumenWhatsapp(r);

  if (r.foto_url && navigator.share && navigator.canShare) {
    try {
      const respuesta = await fetch(r.foto_url);
      const blob = await respuesta.blob();
      const archivo = new File([blob], 'evidencia-comedor.jpg', { type: blob.type || 'image/jpeg' });
      if (navigator.canShare({ files: [archivo] })) {
        await navigator.share({ files: [archivo], text: resumen, title: 'Reporte del comedor' });
        return;
      }
    } catch (err) {
      // Fetch/permiso/cancelado: no es un error fatal, solo significa que
      // usamos el enlace de WhatsApp de abajo en vez del share nativo.
      console.error('No se pudo compartir la foto directamente, se usará WhatsApp con el enlace en el texto:', err);
    }
  }

  window.open(`https://wa.me/${destino}?text=${encodeURIComponent(resumen)}`, '_blank', 'noopener');
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
