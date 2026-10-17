/**
 * Genera el QR apuntando a la URL real donde vive la app del asociado
 * (GitHub Pages), en vez de la URL de Netlify hardcodeada que traía el
 * prototipo original (se habría roto en cuanto se moviera de hosting).
 * Vive en el panel admin (pestaña "QR del comedor") -- es una herramienta
 * de gestión para imprimir el cartel, no algo que un asociado necesite ver.
 */

function urlApp() {
  return new URL('../app/', window.location.href).href;
}

export function renderQR() {
  const container = document.getElementById('qr-comedor');
  if (!container || container.hasChildNodes()) return;
  // eslint-disable-next-line no-undef -- QRCode viene del script cdnjs cargado en admin/index.html
  new QRCode(container, {
    text: urlApp(),
    width: 170, height: 170,
    colorDark: '#003087', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
}

/** qrcodejs dibuja en un <canvas> oculto y además genera un <img> visible
    con el dataURL ya calculado (así el cartel se puede "guardar imagen"
    con clic derecho). Probamos el canvas primero (toDataURL fresco) y si
    no existe caemos al <img>, que ya trae el dataURL listo en su src. */
function obtenerQrDataUrl() {
  const canvas = document.querySelector('#qr-comedor canvas');
  if (canvas) {
    try {
      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('No se pudo leer el canvas del QR, se intentará con el <img>:', err);
    }
  }
  const img = document.querySelector('#qr-comedor img');
  return img?.src || null;
}

/** Conecta el botón "Descargar cartel en PDF" una sola vez. Separado de
    renderQR() a propósito: renderQR() se vuelve a llamar cada vez que se
    abre la pestaña (y se protege con hasChildNodes para no duplicar el
    canvas), mientras que el botón solo necesita su listener una vez. */
export function initQR() {
  const btn = document.getElementById('btn-descargar-pdf');
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = '1';
  btn.addEventListener('click', descargarPdfCartel);
}

/* ═══════════════════════════════════════════════════════════════
   Helpers de dibujo -- nada de esto depende de datos del reporte, son
   piezas visuales reutilizables para armar el cartel (DRY: una sola
   función por efecto, en vez de repetir las mismas cuentas de color o
   de ángulo cada vez que se necesita un degradado o una marca de agua).
═══════════════════════════════════════════════════════════════ */
function hexARgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** jsPDF (build base, sin plugins extra) no trae relleno con degradado
    real -- lo simulamos pintando franjas horizontales muy delgadas que
    van interpolando de un color a otro. Barato de calcular y se ve
    indistinguible de un degradado real a resolución de impresión. */
function dibujarBandaDegradado(doc, width, height, colorInicio, colorFin) {
  const franjas = 60;
  const alto = height / franjas;
  const inicio = hexARgb(colorInicio);
  const fin = hexARgb(colorFin);
  for (let i = 0; i < franjas; i++) {
    const t = i / (franjas - 1);
    const r = Math.round(inicio[0] + (fin[0] - inicio[0]) * t);
    const g = Math.round(inicio[1] + (fin[1] - inicio[1]) * t);
    const b = Math.round(inicio[2] + (fin[2] - inicio[2]) * t);
    doc.setFillColor(r, g, b);
    // +0.5 de margen para que no queden líneas blancas entre franjas por
    // redondeo de subpíxel al exportar.
    doc.rect(0, i * alto, width, alto + 0.5, 'F');
  }
}

/** El plato + tenedor del ícono de la app (icons/icon.svg), reducido a
    líneas y un círculo para poder dibujarlo con las primitivas de jsPDF.
    Se usa como marca de agua tenue en las esquinas del banner, igual que
    en el cartel de la página web (misma opacidad: .12). */
function dibujarPlatoYTenedor(doc, cx, cy, escala) {
  doc.setDrawColor('#ffffff');
  doc.setLineWidth(1.8 * escala);
  doc.circle(cx, cy, 11 * escala, 'S');
  doc.line(cx - 16 * escala, cy - 9 * escala, cx - 16 * escala, cy + 9 * escala);
  doc.line(cx - 18.5 * escala, cy - 9 * escala, cx - 18.5 * escala, cy - 3 * escala);
  doc.line(cx - 13.5 * escala, cy - 9 * escala, cx - 13.5 * escala, cy - 3 * escala);
}

/** Marcas de agua opcionales: si el navegador/versión de jsPDF no soporta
    GState (opacidad), simplemente no se dibujan -- son decorativas, nunca
    bloquean la generación del cartel. */
function dibujarMarcasDeAgua(doc, pageWidth, bannerHeight) {
  try {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.12 }));
    dibujarPlatoYTenedor(doc, 8, 14, 1.6);
    dibujarPlatoYTenedor(doc, pageWidth - 14, bannerHeight - 20, 2.1);
    doc.restoreGraphicsState();
  } catch (err) {
    console.error('No se pudo dibujar la marca de agua decorativa del cartel:', err);
  }
}

/** El cartel en PDF reemplaza al viejo "Ctrl+P" (window.print): aquella
    opción imprimía literalmente la pantalla del admin tal cual. Este PDF
    SÍ está pensado como pieza para imprimir y pegar en la pared -- replica
    el mismo lenguaje visual del cartel que se ve en el panel (banner
    degradado azul, acentos amarillos, marco punteado) en vez de una hoja
    blanca con texto plano. A propósito NO se imprime la URL del QR: el
    cartel es para escanear, no para teclear a mano. */
function descargarPdfCartel() {
  const qrDataUrl = obtenerQrDataUrl();
  if (!qrDataUrl) {
    alert('El código QR todavía no está listo, espera un momento e intenta de nuevo.');
    return;
  }

  // eslint-disable-next-line no-undef -- jsPDF viene del script cdnjs cargado en admin/index.html
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const azulOscuro = '#003087';
  const azul = '#0071CE';
  const amarillo = '#FFC220';

  // ── Banner superior: degradado + marcas de agua, igual que el cartel web ──
  const bannerHeight = 184;
  dibujarBandaDegradado(doc, pageWidth, bannerHeight, azulOscuro, azul);
  dibujarMarcasDeAgua(doc, pageWidth, bannerHeight);

  // Insignia "ESCANÉAME"
  const badgeW = 48, badgeH = 9;
  doc.setFillColor(amarillo);
  doc.roundedRect((pageWidth - badgeW) / 2, 13, badgeW, badgeH, 4.5, 4.5, 'F');
  doc.setTextColor(azulOscuro);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ESCANÉAME', pageWidth / 2, 19, { align: 'center' });

  // Título
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text('Reporta una situación', pageWidth / 2, 36, { align: 'center' });
  doc.text('del comedor desde tu celular', pageWidth / 2, 45, { align: 'center' });

  // Tarjeta blanca con el QR y marco punteado amarillo (misma idea que
  // .qr-poster-frame en la web).
  const qrSize = 68;
  const padInterno = 9;
  const frameSize = qrSize + padInterno * 2;
  const frameX = (pageWidth - frameSize) / 2;
  const frameY = 56;
  doc.setFillColor('#ffffff');
  doc.roundedRect(frameX, frameY, frameSize, frameSize, 4, 4, 'F');
  doc.setDrawColor(amarillo);
  doc.setLineWidth(1.3);
  // Algunas builds viejas de jsPDF no traen setLineDashPattern -- se valida
  // una sola vez en vez de un try/catch por cada llamada (la función no
  // existe o existe, nunca a medias).
  const soportaPunteado = typeof doc.setLineDashPattern === 'function';
  if (soportaPunteado) doc.setLineDashPattern([2.2, 1.6], 0);
  doc.roundedRect(frameX + 3, frameY + 3, frameSize - 6, frameSize - 6, 3, 3, 'S');
  if (soportaPunteado) doc.setLineDashPattern([], 0);
  doc.addImage(qrDataUrl, 'PNG', frameX + padInterno, frameY + padInterno, qrSize, qrSize);

  // Bullets de beneficio, en blanco/amarillo sobre el banner.
  const features = [
    'Repórtalo en menos de un minuto',
    'Consulta el avance con tu folio',
    '100% confidencial y anónimo'
  ];
  const featureStartY = frameY + frameSize + 14;
  const featureTextX = pageWidth / 2 - 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  features.forEach((texto, i) => {
    const y = featureStartY + i * 9;
    doc.setFillColor(amarillo);
    doc.circle(featureTextX - 6, y - 1.4, 1.7, 'F');
    doc.setTextColor('#ffffff');
    doc.text(texto, featureTextX, y);
  });

  // ── Cuerpo inferior (fondo blanco): qué es, seguimiento, confidencialidad ──
  const bloques = [
    {
      titulo: '¿Qué es esta app?',
      texto: 'Una herramienta para reportar cualquier situación del comedor (temperatura de los '
        + 'alimentos, limpieza, calidad, porciones, objetos extraños, atención, entre otras) en menos '
        + 'de un minuto, directamente desde tu celular.'
    },
    {
      titulo: 'Da seguimiento a tu reporte',
      texto: 'Con el folio que recibes al enviar tu reporte puedes consultar en todo momento su '
        + 'estatus: recibido, en revisión, atendido o cerrado, hasta ver su resolución.'
    },
    {
      titulo: 'Tu reporte es 100% confidencial',
      texto: 'Nunca se pide tu nombre ni tu número de asociado. Todo reporte es anónimo, siempre -- '
        + 'nadie puede identificar quién lo envió.'
    }
  ];

  let y = bannerHeight + 18;
  const marginX = 22;
  const maxWidth = pageWidth - marginX * 2;
  bloques.forEach((bloque) => {
    doc.setTextColor(azul);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(bloque.titulo, marginX, y);
    y += 6;
    doc.setTextColor('#333333');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    const lineas = doc.splitTextToSize(bloque.texto, maxWidth);
    doc.text(lineas, marginX, y);
    y += lineas.length * 5 + 7;
  });

  // Pie de página con el llamado a la acción.
  doc.setFillColor(amarillo);
  doc.rect(0, pageHeight - 18, pageWidth, 18, 'F');
  doc.setTextColor(azulOscuro);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Escanéalo y hazte escuchar', pageWidth / 2, pageHeight - 8, { align: 'center' });

  doc.save('cartel-reporte-comedor.pdf');
}
