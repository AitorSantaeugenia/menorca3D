#!/usr/bin/env python3
"""Textura PROCEDURAL de sillería de marés claro (iglesia del Roser).

Hiladas de 0,5 m y sillares de 0,7 a 1,5 m, color medido a ojo en las fotos (beige grisáceo), juntas finas y algo de
manchas de intemperie. 512 × 512 px = 4 × 4 m (TEXTURES.sillar.size = 4), repetible en las dos direcciones.
Salida: v0.7/public/assets/textures/sillar_albedo.png y sillar_normal.png (relieve de las juntas).
Uso (desde menorca3d_v2):  python pipeline/textura_sillar.py
"""
import numpy as np
from PIL import Image, ImageFilter

N, ROWS, rng = 512, 8, np.random.default_rng(1734)
H = N // ROWS
base = np.array([212, 202, 182], float)
img = np.zeros((N, N, 3)); joint = np.zeros((N, N))
for r in range(ROWS):
    x, off = 0, int(rng.integers(0, N))
    widths = []
    while x < N:
        w = int(rng.integers(90, 192)); w = N - x if N - x - w < 80 else w; widths.append(w); x += w
    if sum(widths) > N: widths[-1] -= sum(widths) - N
    x = off
    for w in widths:
        tint = base * (1 + rng.normal(0, .035)) + rng.normal(0, 1.5, 3)   # variación sobre todo de luminosidad
        cols = (np.arange(x, x + w) % N)
        img[r * H:(r + 1) * H][:, cols] = tint
        joint[r * H:(r + 1) * H, x % N] = 1          # junta vertical
        x += w
    joint[r * H, :] = 1                               # junta horizontal
# grano de la piedra y manchas suaves (repetibles: ruido periódico por FFT)
def periodic_noise(scale):
    f = np.fft.fftfreq(N)[:, None] ** 2 + np.fft.fftfreq(N)[None, :] ** 2
    spec = (rng.normal(size=(N, N)) + 1j * rng.normal(size=(N, N))) * np.exp(-f * (N / scale) ** 2)
    n = np.real(np.fft.ifft2(spec)); return (n - n.mean()) / (n.std() + 1e-9)
img += periodic_noise(1.5)[..., None] * 5 + periodic_noise(40)[..., None] * 6
img += rng.normal(0, 3.5, (N, N))[..., None]
jm = np.maximum(joint, np.roll(joint, 1, 0)) ; jm = np.maximum(jm, np.roll(joint, 1, 1))
img = img * (1 - jm[..., None] * .22)
img = np.clip(img, 0, 255).astype(np.uint8)
out = 'v0.7/public/assets/textures/sillar'
Image.fromarray(img).save(out + '_albedo.png')
# Normal: juntas hundidas
h = Image.fromarray((255 * (1 - jm)).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
hh = np.asarray(h, float) / 255
dx = (np.roll(hh, -1, 1) - np.roll(hh, 1, 1)) * 2; dy = (np.roll(hh, -1, 0) - np.roll(hh, 1, 0)) * 2
nz = np.ones_like(dx); L = np.sqrt(dx ** 2 + dy ** 2 + 1)
nrm = np.stack([(-dx / L + 1) * 127.5, (-dy / L + 1) * 127.5, (nz / L + 1) * 127.5], -1).astype(np.uint8)
Image.fromarray(nrm).save(out + '_normal.png')
print('escrito', out + '_albedo.png', 'y', out + '_normal.png', '· color medio', img.reshape(-1, 3).mean(0).round())
