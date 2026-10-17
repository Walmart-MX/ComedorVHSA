import { supabase, isSupabaseConfigured } from './supabase-client.js';

/* ═══════════════════════════════════════════════════════════════
   Tarjeta "Seguridad de la cuenta" en Configuración: deja al admin
   cambiar su propia contraseña sin pasar por el flujo de "olvidé mi
   contraseña" de Supabase. supabase.auth.updateUser() funciona con la
   sesión ya activa (estás viendo esto porque ya iniciaste sesión), no
   hace falta reescribir la contraseña actual -- Supabase confía en la
   sesión vigente como el factor de autenticación.
═══════════════════════════════════════════════════════════════ */

const MIN_LARGO = 8;

export function initAdminPassword() {
  document.getElementById('btn-cambiar-password')?.addEventListener('click', cambiarPassword);
}

function ocultarMensaje() {
  document.getElementById('cfg-password-msg')?.classList.add('hidden');
}

function mostrarMensaje(texto, tipo) {
  const msg = document.getElementById('cfg-password-msg');
  if (!msg) return;
  msg.textContent = texto;
  msg.className = `form-hint ${tipo === 'error' ? 'cfg-msg-error' : 'cfg-msg-ok'}`;
  msg.classList.remove('hidden');
}

async function cambiarPassword() {
  ocultarMensaje();
  if (!isSupabaseConfigured) {
    mostrarMensaje('El sistema aún no está configurado. Contacta al equipo de soporte técnico.', 'error');
    return;
  }
  const inputNueva = document.getElementById('cfg-password-nueva');
  const inputConfirmar = document.getElementById('cfg-password-confirmar');
  const nueva = inputNueva.value;
  const confirmacion = inputConfirmar.value;

  if (nueva.length < MIN_LARGO) {
    mostrarMensaje(`La contraseña debe tener al menos ${MIN_LARGO} caracteres.`, 'error');
    return;
  }
  if (nueva !== confirmacion) {
    mostrarMensaje('Las contraseñas no coinciden.', 'error');
    return;
  }

  const btn = document.getElementById('btn-cambiar-password');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  const { error } = await supabase.auth.updateUser({ password: nueva });
  btn.disabled = false;
  btn.textContent = 'Cambiar contraseña';

  if (error) {
    console.error(error);
    mostrarMensaje('No se pudo cambiar la contraseña. Intenta de nuevo.', 'error');
    return;
  }
  inputNueva.value = '';
  inputConfirmar.value = '';
  mostrarMensaje('Contraseña actualizada correctamente.', 'ok');
}
