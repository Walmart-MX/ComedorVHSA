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

/** El cartel en PDF reemplaza al viejo "Ctrl+P" (window.print): aquella
    opción imprimía literalmente la pantalla del admin tal cual, sin
    pensarse como un documento para pegar en la pared. Este PDF SÍ está
    pensado para eso -- trae el QR, una explicación breve de para qué
    sirve, y el mensaje de confidencialidad que ya es política del
    proyecto (ver README "Anonimato total"). */
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
  const azulOscuro = '#003087';
  const azul = '#0071CE';
  const amarillo = '#FFC220';

  // Encabezado de color, igual a la paleta del panel (nada de inventar
  // colores nuevos solo para este documento).
  doc.setFillColor(azulOscuro);
  doc.rect(0, 0, pageWidth, 48, 'F');
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Reporta una situación del comedor', pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Escanea el código con la cámara de tu celular', pageWidth / 2, 32, { align: 'center' });

  // QR centrado, con marco amarillo (mismo acento que el resto de la marca).
  const qrSize = 80;
  const qrX = (pageWidth - qrSize) / 2;
  const qrY = 60;
  doc.setDrawColor(amarillo);
  doc.setLineWidth(1.5);
  doc.roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 3, 3, 'S');
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  doc.setTextColor(azulOscuro);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(urlApp(), pageWidth / 2, qrY + qrSize + 14, { align: 'center' });

  // Cuerpo: qué es, para qué sirve, confidencialidad -- el contenido que
  // pidió el admin para que el cartel invite a usar la app, no solo a
  // escanear un código sin contexto.
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
      texto: 'Nunca se pide tu nombre ni tu número de empleado. Todo reporte es anónimo, siempre -- '
        + 'nadie puede identificar quién lo envió.'
    }
  ];

  let y = qrY + qrSize + 28;
  const marginX = 20;
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
    y += lineas.length * 5 + 8;
  });

  // Pie de página con el llamado a la acción.
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(amarillo);
  doc.rect(0, pageHeight - 18, pageWidth, 18, 'F');
  doc.setTextColor(azulOscuro);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Escanéalo y hazte escuchar', pageWidth / 2, pageHeight - 8, { align: 'center' });

  doc.save('cartel-reporte-comedor.pdf');
}
