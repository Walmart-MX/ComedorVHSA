"""Genera los iconos PNG (raster) de ambas PWAs a partir de formas simples
dibujadas con Pillow -- sin depender de un conversor de SVG (no hay
cairosvg/Inkscape/ImageMagick disponibles en este entorno).

Por que esto importa (ver auditoria de instalacion de la PWA admin):
- iOS Safari NO soporta SVG en <link rel="apple-touch-icon">: sin un PNG
  real, el icono en la pantalla de inicio queda en blanco o se reemplaza
  por una captura de la pagina. Esto es una limitacion documentada de
  WebKit, no un bug nuestro.
- Los iconos "maskable" de Android (adaptive icons) tienen soporte
  inconsistente para SVG entre versiones de Chrome/Android; PNG es la
  opcion robusta recomendada por la documentacion oficial de web.dev.
- Un solo icono.svg compartido entre /app/ y /admin/ hace que, si alguien
  instala ambas apps en el mismo telefono, se vean IDENTICAS en la
  pantalla de inicio -- confuso para el equipo de comedor. Aqui se genera
  un set de iconos distinto por app (mismo lenguaje visual, acento de
  color distinto) para que se puedan diferenciar de un vistazo.

Uso: python tools/generate_icons.py
Regenera icons/icon-*.png (app) y icons/icon-admin-*.png (admin).
"""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = ROOT / "icons"

BLUE = "#0071CE"
NAVY = "#003087"
WHITE = "#ffffff"


def _line_con_tapas(draw, p1, p2, width, fill):
    """Linea con 'tapas redondeadas' simuladas (Pillow no las dibuja solo
    con ImageDraw.line) -- un circulo del mismo radio en cada extremo."""
    draw.line([p1, p2], fill=fill, width=width)
    r = width / 2
    for (x, y) in (p1, p2):
        draw.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def dibujar_icono_app(size: int) -> Image.Image:
    """Plato + tenedor (app del asociado) -- mismo diseño que icons/icon.svg,
    recreado como bitmap. Escala proporcional desde un lienzo base de 512."""
    img = Image.new("RGB", (size, size), BLUE)
    draw = ImageDraw.Draw(img)
    s = size / 512  # factor de escala

    stroke = max(round(24 * s), 2)
    # Plato
    cx, cy, r = 300 * s, 256 * s, 78 * s
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=WHITE, width=stroke)
    # Mango del tenedor
    _line_con_tapas(draw, (182 * s, 160 * s), (182 * s, 356 * s), stroke, WHITE)
    # Puas del tenedor
    _line_con_tapas(draw, (160 * s, 160 * s), (160 * s, 220 * s), stroke, WHITE)
    _line_con_tapas(draw, (204 * s, 160 * s), (204 * s, 220 * s), stroke, WHITE)
    # Curva que une las puas por abajo (arco = mitad inferior de una elipse)
    bbox = [160 * s, 194 * s, 204 * s, 246 * s]
    draw.arc(bbox, start=0, end=180, fill=WHITE, width=stroke)
    return img


def dibujar_icono_admin(size: int) -> Image.Image:
    """Portapapeles con palomita (panel admin) -- mismo lenguaje visual
    (trazo blanco grueso sobre fondo solido) pero con acento mas oscuro y
    un glifo distinto, para diferenciarlo del icono del asociado."""
    img = Image.new("RGB", (size, size), NAVY)
    draw = ImageDraw.Draw(img)
    s = size / 512

    stroke = max(round(22 * s), 2)
    # Cuerpo del portapapeles (rectangulo redondeado)
    body = [166 * s, 140 * s, 346 * s, 380 * s]
    draw.rounded_rectangle(body, radius=20 * s, outline=WHITE, width=stroke)
    # Clip superior
    clip = [226 * s, 118 * s, 286 * s, 156 * s]
    draw.rounded_rectangle(clip, radius=10 * s, outline=WHITE, width=stroke)
    # Lineas de "lista"
    for y in (330,):
        _line_con_tapas(draw, (196 * s, y * s), (316 * s, y * s), max(round(14 * s), 2), WHITE)
    # Palomita (check) arriba de la lista
    _line_con_tapas(draw, (196 * s, 250 * s), (228 * s, 282 * s), stroke, WHITE)
    _line_con_tapas(draw, (228 * s, 282 * s), (300 * s, 206 * s), stroke, WHITE)
    return img


def guardar_set(nombre: str, dibujar) -> None:
    ICONS_DIR.mkdir(exist_ok=True)
    for size in (192, 512):
        img = dibujar(size)
        img.save(ICONS_DIR / f"icon-{nombre}-{size}.png")
    # El maskable reutiliza el mismo arte: ya vive dentro de la zona segura
    # (ver comentarios en cada funcion de dibujo), solo cambia el "purpose"
    # declarado en el manifest, no el bitmap en si.
    dibujar(512).save(ICONS_DIR / f"icon-{nombre}-maskable-512.png")


if __name__ == "__main__":
    guardar_set("app", dibujar_icono_app)
    guardar_set("admin", dibujar_icono_admin)
    print("Listo: iconos generados en", ICONS_DIR)
