import { supabase, isSupabaseConfigured } from './supabase-client.js';

/**
 * Maneja login/logout del panel admin usando Supabase Auth
 * (reemplaza el usuario/contraseña fijo que traía el prototipo original).
 */
export function initAuth({ onLogin } = {}) {
  const btnShowLogin = document.getElementById('btn-show-login');
  const btnShowAsociado = document.getElementById('btn-show-asociado');
  const btnLogin = document.getElementById('btn-login');
  const btnLogout = document.getElementById('btn-logout');
  const errorBox = document.getElementById('l-error');

  btnShowLogin?.addEventListener('click', showLogin);
  btnShowAsociado?.addEventListener('click', showAsociado);
  btnLogin?.addEventListener('click', handleLogin);
  btnLogout?.addEventListener('click', handleLogout);

  function showLogin() {
    document.getElementById('app-asociado').style.display = 'none';
    document.getElementById('app-login').classList.remove('hidden');
    document.getElementById('btn-admin-wrap').style.display = 'none';
  }

  function showAsociado() {
    document.getElementById('app-asociado').style.display = 'block';
    document.getElementById('app-login').classList.add('hidden');
    document.getElementById('btn-admin-wrap').style.display = 'block';
  }

  function showAdminPanel() {
    document.getElementById('app-login').classList.add('hidden');
    document.getElementById('app-asociado').style.display = 'none';
    document.getElementById('app-admin').classList.remove('hidden');
    document.getElementById('btn-admin-wrap').style.display = 'none';
  }

  async function handleLogin() {
    if (!isSupabaseConfigured) {
      errorBox.textContent = 'El backend todavia no esta configurado (falta js/config.js).';
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
    document.getElementById('app-admin').classList.add('hidden');
    showAsociado();
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
