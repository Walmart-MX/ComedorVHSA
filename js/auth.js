import { supabase, isSupabaseConfigured } from './supabase-client.js';

/**
 * Login/logout del panel admin usando Supabase Auth. Vive en su propia
 * app (admin/index.html), separada del formulario del asociado -- ya no
 * hay nada que "mostrar/ocultar" entre dos experiencias en una sola
 * página: aquí solo hay login o panel.
 */
export function initAuth({ onLogin } = {}) {
  const btnLogin = document.getElementById('btn-login');
  const btnLogout = document.getElementById('btn-logout');
  const errorBox = document.getElementById('l-error');

  btnLogin?.addEventListener('click', handleLogin);
  btnLogout?.addEventListener('click', handleLogout);

  function showAdminPanel() {
    document.getElementById('app-login').classList.add('hidden');
    document.getElementById('app-admin').classList.remove('hidden');
  }

  function showLogin() {
    document.getElementById('app-admin').classList.add('hidden');
    document.getElementById('app-login').classList.remove('hidden');
  }

  async function handleLogin() {
    if (!isSupabaseConfigured) {
      errorBox.textContent = 'El sistema aún no está configurado. Contacta al equipo de soporte técnico.';
      errorBox.style.display = 'block';
      return;
    }
    const email = document.getElementById('l-user').value.trim();
    const password = document.getElementById('l-pass').value;
    errorBox.style.display = 'none';
    btnLogin.disabled = true;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    btnLogin.disabled = false;
    if (error) {
      errorBox.textContent = 'Correo o contraseña incorrectos.';
      errorBox.style.display = 'block';
      return;
    }
    showAdminPanel();
    onLogin?.();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    showLogin();
  }

  // Si ya hay sesion activa (recarga de pagina), entrar directo al panel.
  if (isSupabaseConfigured) {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        showAdminPanel();
        onLogin?.();
      }
    });
  }
}
