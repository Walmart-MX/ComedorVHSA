import { supabase, isSupabaseConfigured } from './supabase-client.js';
import { CAT_NAMES, COMEDOR_NAMES, PRIORIDADES, STATUS_PUBLICO, DEFAULT_CEDIS, escapeHtml } from './catalog.js';
import { CATEGORY_ICONS } from './icons.js';
import { WHATSAPP_DESTINO } from './config.js';

let currentCat = null;
let currentFoto = null;
// Datos del asociado ya verificados contra la base (numero_empleado, nombre, area).
// null mientras no se haya verificado o el reporte sea anonimo.
let asociadoVerificado = null;

export function initAsociado() {
  wireCategoryCards();
  wireModoToggle();
  document.getElementById('btn-step2').addEventListener('click', goStep2);
  document.getElementById('btn-goback').addEventListener('click', goBack);
  document.getElementById('photo-area').addEventListener('click', () =>
    document.getElementById('f-foto').click());
  document.getElementById('f-foto').addEventListener('change', onFotoChange);
  document.getElementById('btn-remove-foto').addEventListener('click', removeFoto);
  document.getElementById('btn-verificar-asociado').addEventListener('click', verificarAsociado);
  document.getElementById('btn-enviar-reporte').addEventListener('click', enviarReporte);
  document.getElementById('btn-nuevo-reporte').addEventListener('click', nuevoReporte);
  document.getElementById('btn-copiar-folio').addEventListener('click', copiarFolio);
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

/** Alterna los campos de identificacion segun el modo elegido (anonimo vs con mis datos). */
function wireModoToggle() {
  document.querySelectorAll('input[name="f-modo"]').forEach(radio =>
    radio.addEventListener('change', actualizarVisibilidadModo));
  actualizarVisibilidadModo();
}

function getModoActual() {
  return document.querySelector('input[name="f-modo"]:checked')?.value || 'anonimo';
}

function actualizarVisibilidadModo() {
  const esPersonalizado = getModoActual() === 'personalizado';
  document.getElementById('campos-personalizados').classList.toggle('hidden', !esPersonalizado);
  document.getElementById('modo-hint').textContent = esPersonalizado
    ? 'Podremos identificarte para dar seguimiento a tu reporte.'
    : 'No se asociara tu reporte con tus datos personales.';
  if (!esPersonalizado) {
    asociadoVerificado = null;
    document.getElementById('asociado-resultado').classList.add('hidden');
  }
}

function goStep2() {
  if (!currentCat) return;
  document.getElementById('step-1').classList.add('hidden');
  document.getElementById('step-2').classList.remove('hidden');
  document.getElementById('s2-cat-label').textContent = CAT_NAMES[currentCat];
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

/** Sube la evidencia a Supabase Storage y regresa la URL pública (o null si no hay foto). */
async function subirFoto() {
  if (!currentFoto) return null;
  const ext = currentFoto.name.split('.').pop() || 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('evidencias').upload(path, currentFoto);
  if (error) {
    console.error('No se pudo subir la foto:', error.message);
    return null;
  }
  const { data } = supabase.storage.from('evidencias').getPublicUrl(path);
  return data.publicUrl;
}

/** Busca al asociado por numero de empleado. La base solo tiene numero,
    nombre y area -- nunca telefono, por eso jamas se pide WhatsApp aqui. */
async function verificarAsociado() {
  const numero = document.getElementById('f-empleado').value.trim();
  const box = document.getElementById('asociado-resultado');

  if (!numero) {
    asociadoVerificado = null;
    box.className = 'no-encontrado';
    box.textContent = 'Escribe tu número de asociado.';
    box.classList.remove('hidden');
    return;
  }
  if (!isSupabaseConfigured) return;

  const btn = document.getElementById('btn-verificar-asociado');
  btn.disabled = true;
  btn.textContent = 'Buscando...';

  const { data, error } = await supabase.rpc('buscar_asociado', { p_numero_empleado: numero });

  btn.disabled = false;
  btn.textContent = 'Verificar';

  if (error || !data || data.length === 0) {
    asociadoVerificado = null;
    box.className = 'no-encontrado';
    box.innerHTML = 'No encontramos un asociado con ese número. Verifica que sea correcto, o cambia a reporte anónimo arriba.';
    box.classList.remove('hidden');
    return;
  }

  asociadoVerificado = { numero_empleado: numero, nombre: data[0].nombre, area: data[0].area };
  box.className = 'encontrado';
  box.innerHTML = `Asociado identificado<br><strong>${escapeHtml(data[0].nombre)}</strong>${data[0].area ? ' — ' + escapeHtml(data[0].area) : ''}`;
  box.classList.remove('hidden');
}

async function enviarReporte() {
  if (!isSupabaseConfigured) {
    alert('El sistema no está disponible en este momento. Intenta más tarde.');
    return;
  }
  const modo = getModoActual();
  const comedor = document.getElementById('f-comedor').value;
  const descripcion = document.getElementById('f-desc').value.trim();

  if (!comedor || !descripcion) {
    alert('Completa el comedor y la descripción antes de enviar.');
    return;
  }

  let numero_empleado = null, nombre = null;
  if (modo === 'personalizado') {
    if (!asociadoVerificado) {
      alert('Verifica tu número de asociado antes de continuar, o cambia a reporte anónimo.');
      return;
    }
    numero_empleado = asociadoVerificado.numero_empleado;
    nombre = asociadoVerificado.nombre;
  }

  const btn = document.getElementById('btn-enviar-reporte');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const foto_url = await subirFoto();

  // RPC en vez de insert().select() directo: el rol anon puede INSERTAR pero
  // a proposito no puede LEER la tabla reportes en general (nadie sin login
  // deberia poder listar todos los reportes via la API). El RPC corre con
  // privilegios elevados y solo regresa los campos que esta pantalla necesita.
  const { data, error } = await supabase.rpc('crear_reporte', {
    p_categoria: currentCat,
    p_cedis: DEFAULT_CEDIS,
    p_comedor: comedor,
    p_nombre: nombre,
    p_numero_empleado: numero_empleado,
    p_descripcion: descripcion,
    p_prioridad: PRIORIDADES[currentCat],
    p_foto_url: foto_url,
    p_modo_reporte: modo
  });

  btn.disabled = false;
  btn.textContent = 'Enviar reporte';

  if (error) {
    console.error(error);
    alert('No pudimos guardar tu reporte. Revisa tu conexión e intenta de nuevo.');
    return;
  }

  mostrarConfirmacion(data[0]);
}

function mostrarConfirmacion(r) {
  document.getElementById('step-2').classList.add('hidden');
  document.getElementById('step-confirm').classList.remove('hidden');
  document.getElementById('c-folio').textContent = r.folio;
  document.getElementById('c-cat').textContent = CAT_NAMES[r.categoria];
  document.getElementById('c-comedor').textContent = COMEDOR_NAMES[r.comedor] || r.comedor;
  document.getElementById('c-fecha').textContent = new Date(r.creado_en).toLocaleString('es-MX');
  document.getElementById('c-estado').textContent = STATUS_PUBLICO[r.estatus] || r.estatus;

  // WhatsApp es un canal complementario: el reporte ya quedo guardado arriba,
  // independientemente de que este boton se use o no (y de que el numero de
  // destino este configurado). Ver js/config.js -> WHATSAPP_DESTINO.
  const whatsappBtn = document.getElementById('btn-whatsapp-confirmar');
  if (WHATSAPP_DESTINO) {
    const resumen = `Reporte de comedor\nFolio: ${r.folio}\nCategoria: ${CAT_NAMES[r.categoria]}\nUbicacion: ${COMEDOR_NAMES[r.comedor] || r.comedor}\nFecha: ${new Date(r.creado_en).toLocaleString('es-MX')}`;
    whatsappBtn.href = `https://wa.me/${WHATSAPP_DESTINO}?text=${encodeURIComponent(resumen)}`;
    whatsappBtn.classList.remove('hidden');
  } else {
    whatsappBtn.classList.add('hidden');
  }
}

function copiarFolio() {
  const folio = document.getElementById('c-folio').textContent;
  const btn = document.getElementById('btn-copiar-folio');
  const original = btn.textContent;
  navigator.clipboard?.writeText(folio).then(() => {
    btn.textContent = 'Copiado';
    setTimeout(() => { btn.textContent = original; }, 1500);
  }).catch(() => {
    alert(`Tu folio es: ${folio}`);
  });
}

function nuevoReporte() {
  currentCat = null;
  asociadoVerificado = null;
  document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('f-empleado').value = '';
  document.getElementById('asociado-resultado').classList.add('hidden');
  document.getElementById('f-modo-anonimo').checked = true;
  actualizarVisibilidadModo();
  document.getElementById('f-comedor').value = '';
  document.getElementById('f-desc').value = '';
  removeFoto();
  const btn = document.getElementById('btn-step2');
  btn.style.opacity = '.5';
  btn.style.pointerEvents = 'none';
  document.getElementById('step-confirm').classList.add('hidden');
  document.getElementById('step-1').classList.remove('hidden');
}
