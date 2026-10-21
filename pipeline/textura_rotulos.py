#!/usr/bin/env python3
"""Rótulos de comercios con texto (texturas para v0.7/src/buildings/farmacia.js).

Genera en v0.7/public/assets/textures:
  rotulo_farmacia_albedo.png   rótulo largo (fachada de la calle con aparcamiento): «Farmàcia» + placa con el nombre
  rotulo_farmacia2_albedo.png  rótulo corto (fachada de la esquina): «Farmàcia»
  rotulo_farmacia3_albedo.png  Farmàcia Alicia Quesada (fontanilles.js): placa blanca con «FARMACIA» en verde
y su *_normal.png plano. Colores y composición ESTIMADOS a partir de las fotos de referencia (rótulo morado con letras
blancas finas y franja magenta abajo). La textura entera cubre un tramo de rótulo (UV 0–1).

Uso (desde menorca3d_v2):  python pipeline/textura_rotulos.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'v0.7', 'public', 'assets', 'textures')
FONT = '/usr/share/fonts/opentype/inter/Inter-Light.otf'
for f in (FONT, '/usr/share/fonts/opentype/inter/Inter-Thin.otf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-ExtraLight.ttf',
          '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'C:/Windows/Fonts/segoeuil.ttf', 'C:/Windows/Fonts/arial.ttf'):
    if os.path.exists(f):
        FONT = f; break
PURPLE, MAGENTA, WHITE = (104, 42, 104), (150, 52, 140), (246, 244, 248)


def rotulo(path, w_m, textos, placa=None, h_m=.62, ppm=200):
    W, H = int(w_m * ppm), int(h_m * ppm)
    im = Image.new('RGB', (W, H), PURPLE)
    d = ImageDraw.Draw(im)
    d.rectangle([0, int(H * .86), W, H], fill=MAGENTA)                       # franja inferior
    d.rectangle([0, 0, W, int(H * .04)], fill=(80, 30, 80))                  # canto superior
    f = ImageFont.truetype(FONT, int(H * .5))
    for x_m in textos:
        t = 'Farmàcia'; bw = d.textlength(t, font=f)
        d.text((x_m * ppm - bw / 2, H * .43), t, font=f, fill=WHITE, anchor='lm')
    if placa:   # placa con el nombre de la titular (fondo morado, marco blanco fino)
        x0, x1 = (placa - .9) * ppm, (placa + .9) * ppm
        d.rectangle([x0, H * .2, x1, H * .66], outline=WHITE, width=3)
        fs = ImageFont.truetype(FONT, int(H * .16))
        d.text(((x0 + x1) / 2, H * .43), 'Teresa Hernández Jansà', font=fs, fill=WHITE, anchor='mm')
    im.save(path)
    Image.new('RGB', (8, 8), (128, 128, 255)).save(path.replace('_albedo', '_normal'))
    print('escrito', path, im.size)


def rotulo_quesada(path, w_m=7.4, h_m=.6, ppm=200):
    """Farmàcia Alicia Quesada (Carrer Fontanilles 47): placa blanca, «FARMACIA» en verde y el nombre de la titular."""
    W, H = int(w_m * ppm), int(h_m * ppm)
    im = Image.new('RGB', (W, H), (247, 247, 244)); d = ImageDraw.Draw(im)
    bold = '/usr/share/fonts/opentype/inter/Inter-Bold.otf'
    fb = ImageFont.truetype(bold if os.path.exists(bold) else FONT, int(H * .62))
    x = 1.0 * ppm
    for ch in 'FARMACIA':   # letras espaciadas, como en la foto
        d.text((x, H * .52), ch, font=fb, fill=(20, 110, 55), anchor='lm'); x += d.textlength(ch, font=fb) + H * .1
    fs = ImageFont.truetype(FONT, int(H * .17))
    d.text((5.55 * ppm, H * .7), 'Lda. Alicia Quesada Rodríguez', font=fs, fill=(70, 70, 70), anchor='lm')
    im.save(path)
    Image.new('RGB', (8, 8), (128, 128, 255)).save(path.replace('_albedo', '_normal'))
    print('escrito', path, im.size)


if __name__ == '__main__':
    # Largos de los tramos: deben coincidir con LONG y SHORT de farmacia.js
    rotulo(os.path.join(OUT, 'rotulo_farmacia_albedo.png'), 14.0, [5.6, 12.6], placa=9.0)
    rotulo(os.path.join(OUT, 'rotulo_farmacia2_albedo.png'), 7.0, [3.5])
    rotulo_quesada(os.path.join(OUT, 'rotulo_farmacia3_albedo.png'))   # largo: 9,0 − 1,6 m de fontanilles.js
