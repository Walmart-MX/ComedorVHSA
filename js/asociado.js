import { supabase, isSupabaseConfigured } from './supabase-client.js';
import { CAT_NAMES, PRIORIDADES, PRI_LABELS, PRI_COLOR_VAR } from './catalog.js';

let currentCat = null;
let currentFoto = null;

export function initAsociado() {
  wireCategoryCards();
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
  const numero_empleado = document.getElementById('f-empleado').value.trim();
  const cedis = document.getElementById('f-cedis').value;
  const comedor = document.getElementById('f-comedor').value;
  const descripcion = document.getElementById('f-desc').value.trim();
  if (!numero_empleado || !cedis || !comedor || !descripcion) {
    alert('Por favor completa los campos obligatorios.');
    return;
  }

  const btn = document.getElementById('btn-enviar-reporte');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const foto_url = await subirFoto();

  const { data, error } = await supabase
    .from('reportes')
    .insert({
      categoria: currentCat,
      cedis, comedor,
      nombre: document.getElementById('f-nombre').value.trim() || null,
      numero_empleado,
      descripcion,
      prioridad: PRIORIDADES[currentCat],
      foto_url
    })
    .select()
    .single();

  btn.disabled = false;
  btn.textContent = 'Enviar reporte';

  if (error) {
    console.error(error);
    alert('No se pudo enviar el reporte. Intenta de nuevo en unos segundos.');
    return;
  }

  mostrarConfirmacion(data);
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
  document.getElementById('c-comedor').textContent = r.comedor === 'principal' ? 'Comedor Principal' : 'Comedor Secundario';
}

function nuevoReporte() {
  currentCat = null;
  document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('f-empleado').value = '';
  document.getElementById('f-nombre').value = '';
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
