/* ═══════════════════════════════════════════════════════════════
   Flujo de reporte del asociado -- 100% anónimo, sin excepción.
   No se pide numero de asociado ni nombre en ningun punto: eliminar
   esa friccion (y ese riesgo de privacidad) era el pedido explicito
   del cliente. Lo que pasa DESPUES de guardar el reporte (compartir
   por WhatsApp, pedir atencion personalizada, activar notificaciones)
   vive en confirmacion.js -- este archivo solo arma y envia el reporte.
═══════════════════════════════════════════════════════════════ */

import { supabase, isSupabaseConfigured } from './supabase-client.js';
import { PRIORIDADES, DEFAULT_CEDIS } from './catalog.js';
import { CATEGORY_ICONS, CHECK_ICON } from './icons.js';
import { mostrarConfirmacion } from './confirmacion.js';

let currentCat = null;
let currentFoto = null;

export function initAsociado() {
  document.getElementById('confirm-icon').innerHTML = CHECK_ICON;
  wireCategoryCards();
  document.getElementById('btn-step2').addEventListener('click', goStep2);
  document.getElementById('btn-goback').addEventListener('click', goBack);
  document.getElementById('photo-area').addEventListener('click', () =>
    document.getElementById('f-foto').click());
  document.getElementById('f-foto').addEventListener('change', onFotoChange);
  document.getElementById('btn-remove-foto').addEventListener('click', removeFoto);
  document.getElementById('btn-enviar-reporte').addEventListener('click', enviarReporte);
  document.getElementById('btn-nuevo-reporte').addEventListener('click', nuevoReporte);
}

function wireCategoryCards() {
  // role="button" + tabindex + keydown: las tarjetas son operables con teclado,
  // no solo con mouse/touch (el prototipo original fallaba aqui - WCAG 2.1.1).
  document.querySelectorAll('.cat-card').forEach(card => {
    const icono = CATEGORY_ICONS[card.dataset.cat];
    if (icono) card.insertAdjacentHTML('afterbegin', icono);
    card.addEventListener('click', () => selectCat(card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectCat(card);
      }
    });
  });
}

function selectCat(card) {
  document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  currentCat = card.dataset.cat;
  const btn = document.getElementById('btn-step2');
  btn.style.opacity = '1';
  btn.style.pointerEvents = 'auto';
}

function goStep2() {
  if (!currentCat) return;
  document.getElementById('step-1').classList.add('hidden');
  document.getElementById('step-2').classList.remove('hidden');
  document.getElementById('s2-cat-label').textContent = document.querySelector(`.cat-card[data-cat="${currentCat}"] .cat-name`)?.textContent || '';
  document.getElementById('f-datetime').textContent = new Date().toLocaleString('es-MX');
}

function goBack() {
  document.getElementById('step-2').classList.add('hidden');
  document.getElementById('step-1').classList.remove('hidden');
}

function onFotoChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('La foto supera el tamaño máximo de 5 MB.');
    e.target.value = '';
    return;
  }
  currentFoto = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const prev = document.getElementById('photo-preview');
    prev.src = ev.target.result;
    prev.style.display = 'block';
    document.getElementById('btn-remove-foto').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function removeFoto() {
  currentFoto = null;
  document.getElementById('f-foto').value = '';
  document.getElementById('photo-preview').style.display = 'none';
  document.getElementById('btn-remove-foto').classList.add('hidden');
}

/** Evita que una llamada de red colgada deje el formulario congelado para
    siempre -- el fetch del navegador NO tiene timeout por defecto, asi que
    sin esto, un problema de red/CORS en Storage o en el RPC deja el boton
    "Enviando..." deshabilitado de por vida (hallazgo real en pruebas). */
function conTimeout(promesa, ms, mensaje) {
  return Promise.race([
    promesa,
    new Promise((_, reject) => setTimeout(() => reject(new Error(mensaje)), ms))
  ]);
}

/** Sube la evidencia a Supabase Storage y regresa la URL pública (o null si no hay foto,
    o si la subida falla/se cuelga -- una foto que no sube nunca debe bloquear el reporte). */
async function subirFoto() {
  if (!currentFoto) return null;
  try {
    const ext = currentFoto.name.split('.').pop() || 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await conTimeout(
      supabase.storage.from('evidencias').upload(path, currentFoto),
      15000,
      'La subida de la foto tardó demasiado.'
    );
    if (error) {
      console.error('No se pudo subir la foto:', error.message);
      return null;
    }
    const { data } = supabase.storage.from('evidencias').getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error('No se pudo subir la foto:', err.message || err);
    return null;
  }
}

async function enviarReporte() {
  if (!isSupabaseConfigured) {
    alert('El sistema no está disponible en este momento. Intenta más tarde.');
    return;
  }
  const comedor = document.getElementById('f-comedor').value;
  const descripcion = document.getElementById('f-desc').value.trim();

  if (!comedor || !descripcion) {
    alert('Completa el comedor y la descripción antes de enviar.');
    return;
  }

  const btn = document.getElementById('btn-enviar-reporte');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  // Blindaje general: CUALQUIER falla inesperada de aqui en adelante (red
  // caida, timeout, error de Supabase) cae en el catch de abajo y el
  // finally reactiva el boton -- antes un error sin capturar en cualquiera
  // de estos pasos (incluyendo un fetch colgado sin timeout) dejaba el
  // boton trabado en "Enviando..." para siempre (hallazgo real reportado).
  try {
    const foto_url = await subirFoto();

    // RPC en vez de insert().select() directo: el rol anon puede INSERTAR pero
    // a proposito no puede LEER la tabla reportes en general (nadie sin login
    // deberia poder listar todos los reportes via la API). El RPC corre con
    // privilegios elevados y solo regresa los campos que esta pantalla necesita.
    const { data, error } = await conTimeout(
      supabase.rpc('crear_reporte', {
        p_categoria: currentCat,
        p_cedis: DEFAULT_CEDIS,
        p_comedor: comedor,
        p_descripcion: descripcion,
        p_prioridad: PRIORIDADES[currentCat],
        p_foto_url: foto_url
      }),
      20000,
      'El envío del reporte tardó demasiado.'
    );

    if (error) throw error;

    mostrarConfirmacion({ ...data[0], foto_url });
  } catch (err) {
    console.error(err);
    alert('No pudimos guardar tu reporte. Revisa tu conexión e intenta de nuevo.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar reporte';
  }
}

function nuevoReporte() {
  currentCat = null;
  document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('f-comedor').value = '';
  document.getElementById('f-desc').value = '';
  removeFoto();
  const btn = document.getElementById('btn-step2');
  btn.style.opacity = '.5';
  btn.style.pointerEvents = 'none';
  document.getElementById('step-confirm').classList.add('hidden');
  document.getElementById('step-1').classList.remove('hidden');
}
