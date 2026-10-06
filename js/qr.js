/**
 * Genera el QR apuntando a la URL real donde vive el sitio (GitHub Pages),
 * en vez de la URL de Netlify hardcodeada que traía el prototipo original
 * (se habría roto en cuanto se moviera de hosting).
 */
export function initQR() {
  document.getElementById('btn-show-qr')?.addEventListener('click', showQR);
  document.getElementById('btn-qr-volver')?.addEventListener('click', hideQR);
}

function showQR() {
  document.getElementById('app-asociado').style.display = 'none';
  document.getElementById('btn-admin-wrap').style.display = 'none';
  document.getElementById('app-qr').classList.remove('hidden');
  generarQR();
}

function hideQR() {
  document.getElementById('app-qr').classList.add('hidden');
  document.getElementById('app-asociado').style.display = 'block';
  document.getElementById('btn-admin-wrap').style.display = 'block';
}

function generarQR() {
  const container = document.getElementById('qr-comedor');
  if (!container || container.hasChildNodes()) return;
  const url = window.location.origin + window.location.pathname;
  // eslint-disable-next-line no-undef -- QRCode viene del script cdnjs cargado en index.html
  new QRCode(container, {
    text: url,
    width: 200, height: 200,
    colorDark: '#0071CE', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
}
