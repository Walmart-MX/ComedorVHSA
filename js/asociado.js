import { supabase, isSupabaseConfigured } from './supabase-client.js';
import { CAT_NAMES, COMEDOR_NAMES, PRIORIDADES, PRI_LABELS, PRI_COLOR_VAR } from './catalog.js';

let currentCat = null;
let currentFoto = null;

export function initAsociado() {
  wireCategoryCards();
  wireModoToggle();
  document.getElementById('btn-step2').addEventListener('click', goStep2);
  document.getElementById('btn-goback').addEventListener('click', goBack);
  document.getElementById('photo-area').addEventListener('click', () =>
    document.getElementById('f-foto').click());
  document.getElementById('f-foto').addEventListener('change', onFotoChange);
  document.getElementById('btn-remove-foto').addEventListener('click', removeFoto);
  document.getElementById('btn-enviar-reporte').addEventListener('click', enviarReporte);
  document.getElementById('btn-nuevo-reporte').addEventListener('click', nuevoReporte);

  // Preselección de CEDIS vía QR por sede: ?cedis=cedis-villahermosa
  const cedisParam = new URLSearchParams(window.location.search).get('cedis');
  if (cedisParam) {
    const el = document.getElementById('f-cedis');
    if (el) el.value = cedisParam;
  }
}

function wireCategoryCards() {
  // role="button" + tabindex + keydown: las tarjetas son operables con teclado,
  // no solo con mouse/touch (el prototipo original fallaba aquí - WCAG 2.1.1).
  document.querySelectorAll('.cat-card').forEach(card => {
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

/** Alterna los campos de nombre/numero/WhatsApp segun el modo elegido (anonimo vs personalizado). */
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
    ? 'Un asesor te dara seguimiento por WhatsApp con el numero que dejes aqui.'
    : 'Tu reporte se publica en la plataforma sin datos personales.';
}

function goStep2() {
  if (!currentCat) return;
  document.getElementById('step-1').classList.add('hidden');
  document.getElementById('step-2').classList.remove('hidden');
  document.getElementById('s2-cat-label').textContent = CAT_NAMES[currentCat];

  const prioridad = PRIORIDADES[currentCat];
  document.getElementById('pri-dot').style.background = PRI_COLOR_VAR[prioridad];
  document.getElementById('pri-label').textContent = PRI_LABELS[prioridad];
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

async function enviarReporte() {
  if (!isSupabaseConfigured) {
    alert('El backend todavia no esta configurado. Intenta mas tarde.');
    return;
  }
  const modo = getModoActual();
  const cedis = document.getElementById('f-cedis').value;
  const comedor = document.getElementById('f-comedor').value;
  const descripcion = document.getElementById('f-desc').value.trim();

  if (!cedis || !comedor || !descripcion) {
    alert('Por favor completa los campos obligatorios.');
    return;
  }

  // Los datos personales solo aplican (y son obligatorios) en modo personalizado.
  let numero_empleado = null, nombre = null, telefono_whatsapp = null;
  if (modo === 'personalizado') {
    numero_empleado = document.getElementById('f-empleado').value.trim();
    nombre = document.getElementById('f-nombre').value.trim();
    telefono_whatsapp = document.getElementById('f-whatsapp').value.trim();
    if (!numero_empleado || !nombre || !telefono_whatsapp) {
      alert('Para el reporte personalizado, completa tu numero de asociado, nombre y WhatsApp.');
      return;
    }
    if (!/^\d{10}$/.test(telefono_whatsapp.replace(/\D/g, ''))) {
      alert('Ingresa un numero de WhatsApp valido a 10 digitos.');
      return;
    }
  }

  const btn = document.getElementById('btn-enviar-reporte');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const foto_url = await subirFoto();

  // Usamos un RPC (funcion de base de datos) en vez de insert().select()
  // directo: el rol anon puede INSERTAR pero a proposito no puede LEER
  // la tabla reportes en general (para que nadie sin login pueda listar
  // todos los reportes via la API). insert().select() exige una politica
  // de SELECT para el RETURNING, lo cual rompia con 'row-level security
  // policy'. El RPC corre con privilegios elevados y solo regresa los
  // campos que esta pantalla necesita.
  const { data, error } = await supabase.rpc('crear_reporte', {
    p_categoria: currentCat,
    p_cedis: cedis,
    p_comedor: comedor,
    p_nombre: nombre,
    p_numero_empleado: numero_empleado,
    p_descripcion: descripcion,
    p_prioridad: PRIORIDADES[currentCat],
    p_foto_url: foto_url,
    p_modo_reporte: modo,
    p_telefono_whatsapp: telefono_whatsapp
  });

  btn.disabled = false;
  btn.textContent = 'Enviar reporte';

  if (error) {
    console.error(error);
    alert('No se pudo enviar el reporte. Intenta de nuevo en unos segundos.');
    return;
  }

  mostrarConfirmacion(data[0]);
}

function mostrarConfirmacion(r) {
  document.getElementById('step-2').classList.add('hidden');
  document.getElementById('step-confirm').classList.remove('hidden');
  document.getElementById('c-folio').textContent = r.folio;
  document.getElementById('c-cat').textContent = CAT_NAMES[r.categoria];
  document.getElementById('c-pri').textContent = PRI_LABELS[r.prioridad];
  document.getElementById('c-fecha').textContent = new Date(r.creado_en).toLocaleString('es-MX');
  const cedisLabel = document.querySelector(`#f-cedis option[value="${r.cedis}"]`)?.textContent;
  document.getElementById('c-cedis').textContent = cedisLabel || r.cedis;
  document.getElementById('c-comedor').textContent = COMEDOR_NAMES[r.comedor] || r.comedor;
}

function nuevoReporte() {
  currentCat = null;
  document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('f-empleado').value = '';
  document.getElementById('f-nombre').value = '';
  document.getElementById('f-whatsapp').value = '';
  document.getElementById('f-modo-anonimo').checked = true;
  actualizarVisibilidadModo();
  document.getElementById('f-cedis').value = '';
  document.getElementById('f-comedor').value = '';
  document.getElementById('f-desc').value = '';
  removeFoto();
  const btn = document.getElementById('btn-step2');
  btn.style.opacity = '.5';
  btn.style.pointerEvents = 'none';
  document.getElementById('step-confirm').classList.add('hidden');
  document.getElementById('step-1').classList.remove('hidden');
}
