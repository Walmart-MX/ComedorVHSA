/**
 * Genera el QR apuntando a la URL real donde vive la app del asociado
 * (GitHub Pages), en vez de la URL de Netlify hardcodeada que traía el
 * prototipo original (se habría roto en cuanto se moviera de hosting).
 * Vive en el panel admin (pestaña "QR del comedor") -- es una herramienta
 * de gestión para imprimir el cartel, no algo que un asociado necesite ver.
 */
export function renderQR() {
  const container = document.getElementById('qr-comedor');
  if (!container || container.hasChildNodes()) return;
  const url = new URL('../app/', window.location.href).href;
  // eslint-disable-next-line no-undef -- QRCode viene del script cdnjs cargado en admin/index.html
  new QRCode(container, {
    text: url,
    width: 200, height: 200,
    colorDark: '#0071CE', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
}
