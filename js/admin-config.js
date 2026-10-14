import { getWhatsappDestino, actualizarWhatsappDestino, cargarConfiguracion } from './app-config.js';

/** Pestaña "Configuración" del panel admin: hoy solo controla el número
    de WhatsApp al que los asociados pueden enviar el resumen de su reporte
    (ver js/asociado.js). Si mañana se agregan más ajustes operativos,
    esta es la pestaña donde deberían vivir -- no un archivo nuevo por
    cada ajuste suelto (YAGNI: no creamos key/value genérico hasta que
    de verdad haga falta más de un ajuste). */
export function initAdminConfig() {
  document.getElementById('btn-guardar-whatsapp')?.addEventListener('click', guardarWhatsapp);
}

/** Se llama cada vez que el admin abre la pestaña, para reflejar el valor
    real guardado (por si otro admin lo cambió desde otra sesión). */
export async function renderConfigTab() {
  await cargarConfiguracion();
  const input = document.getElementById('cfg-whatsapp');
  if (input) input.value = getWhatsappDestino();
  ocultarMensaje();
}

function ocultarMensaje() {
  document.getElementById('cfg-whatsapp-msg')?.classList.add('hidden');
}

function mostrarMensaje(texto, tipo) {
  const msg = document.getElementById('cfg-whatsapp-msg');
  if (!msg) return;
  msg.textContent = texto;
  msg.className = `form-hint ${tipo === 'error' ? 'cfg-msg-error' : 'cfg-msg-ok'}`;
  msg.classList.remove('hidden');
}

async function guardarWhatsapp() {
  const input = document.getElementById('cfg-whatsapp');
  const numero = input.value.trim();

  // Mismo formato que valida la BD (constraint app_config_whatsapp_formato):
  // validamos aqui tambien para dar feedback inmediato, sin round-trip.
  if (numero && !/^[0-9]{10,15}$/.test(numero)) {
    mostrarMensaje('El número debe tener solo dígitos, con código de país (10 a 15 dígitos). Ej. 529931234567', 'error');
    return;
  }

  const btn = document.getElementById('btn-guardar-whatsapp');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  const { error } = await actualizarWhatsappDestino(numero);
  btn.disabled = false;
  btn.textContent = 'Guardar número';

  if (error) {
    console.error(error);
    mostrarMensaje('No se pudo guardar. Intenta de nuevo.', 'error');
    return;
  }
  mostrarMensaje(
    numero
      ? 'Número guardado. El botón de WhatsApp ya está activo para reportes "con mis datos de asociado".'
      : 'Número eliminado. El botón de WhatsApp quedará oculto hasta configurar uno nuevo.',
    'ok'
  );
}
