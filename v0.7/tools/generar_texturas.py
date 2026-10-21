#!/usr/bin/env python3
"""Genera las texturas PROCEDURALES del proyecto (albedo + normal, repetibles sin costuras).

Los colores están CALIBRADOS con las fotos propias de referencia (ver docs/REFERENCIAS_VISUALES.md):
no se copia ningún píxel de las fotos, solo se usan sus colores medidos.

Uso:  python tools/generar_texturas.py
Salida: public/assets/textures/<nombre>_albedo.png y <nombre>_normal.png
Requiere: numpy, pillow
"""
import os
import numpy as np
from PIL import Image

OUT = 'public/assets/textures'
N = 512
rng = np.random.default_rng(1771)  # año de fundación de Georgetown


def hexc(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float) / 255


def noise(beta=2.0, n=N, seed=None):
    """Ruido fractal repetible (filtrado en frecuencia): sin costuras por construcción."""
    r = np.random.default_rng(seed) if seed is not None else rng
    f = np.fft.fftfreq(n)
    k = np.sqrt(f[:, None] ** 2 + f[None, :] ** 2)
    k[0, 0] = 1
    spec = (r.normal(size=(n, n)) + 1j * r.normal(size=(n, n))) / k ** (beta / 2)
    spec[0, 0] = 0
    a = np.real(np.fft.ifft2(spec))
    return (a - a.mean()) / (a.std() + 1e-9)


def voronoi(npts, stretch=(1.0, 1.0), n=N, warp=0.0):
    """Celdas de Voronoi repetibles: devuelve F1, F2 (distancias) e índice de celda.
    warp > 0 deforma los bordes con ruido (contornos irregulares, sin costuras)."""
    if isinstance(npts, int):
        pts = rng.random((npts, 2))
    else:
        pts = npts
    ys, xs = np.mgrid[0:n, 0:n] / n
    if warp:
        xs = (xs + warp * noise(3.2, n)) % 1
        ys = (ys + warp * noise(3.2, n)) % 1
    f1 = np.full((n, n), 9.0, np.float32)
    f2 = np.full((n, n), 9.0, np.float32)
    idx = np.zeros((n, n), np.int32)
    sx, sy = stretch
    for i, (px, py) in enumerate(pts):
        dx = np.abs(xs - px); dx = np.minimum(dx, 1 - dx) * sx
        dy = np.abs(ys - py); dy = np.minimum(dy, 1 - dy) * sy
        d = np.sqrt(dx * dx + dy * dy).astype(np.float32)
        closer = d < f1
        f2 = np.where(closer, f1, np.minimum(f2, d))
        idx = np.where(closer, i, idx)
        f1 = np.where(closer, d, f1)
    return f1, f2, idx


def normal_from_height(h, strength):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    nz = np.ones_like(h)
    l = np.sqrt(gx * gx + gy * gy + nz * nz)
    # convención OpenGL (la de Three.js): verde = +Y hacia arriba en la imagen
    return np.stack([(-gx / l + 1) / 2, (gy / l + 1) / 2, (nz / l + 1) / 2], -1)


def save(name, albedo, normal=None):
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray((np.clip(albedo, 0, 1) * 255).astype(np.uint8)).save(f'{OUT}/{name}_albedo.png', optimize=True)
    if normal is not None:
        Image.fromarray((np.clip(normal, 0, 1) * 255).astype(np.uint8)).save(f'{OUT}/{name}_normal.png', optimize=True)
    print('  ', name)


def lerp(a, b, t):
    return a + (b - a) * t[..., None]


# 1) PIEDRA SECA (paret seca) · 2 m x 2 m · calcárea porosa, piezas abultadas en hiladas irregulares
#    Colores medidos en las fotos propias (2/frame_000008, 3/frame_000004): #a5938a, #997a69, #c2b3aa.
def piedra_seca():
    pts = []
    rows = 8
    for r in range(rows):
        y = (r + rng.uniform(.35, .65)) / rows
        k = int(rng.integers(5, 8))
        x0 = rng.uniform(0, 1)
        for xv in np.sort(rng.uniform(0, 1, k)) * 0.12 + np.arange(k) / k:
            pts.append(((x0 + xv) % 1, (y + rng.uniform(-.025, .025)) % 1))
    f1, f2, idx = voronoi(np.array(pts), stretch=(0.7, 1.5), warp=0.012)
    edge = f2 - f1
    width = 0.004 + 0.006 * np.clip(noise(3.0) * .5 + .5, 0, 1)   # junta de anchura irregular
    gap = np.clip((edge - width) / 0.01, 0, 1)
    dome = np.clip(edge * 9, 0, 1) ** .5                          # abultado de cada piedra
    lumps = noise(2.8) * .14 + noise(3.4) * .1                    # superficie irregular (suave)
    pores = np.clip((noise(1.7, seed=7) - 1.9) * 2, 0, 1) * np.clip(noise(1.0, seed=9) - .3, 0, 1)  # poros dispersos
    h = (dome + lumps) * gap - pores * .25
    tone = rng.random(len(pts))[idx]
    pal = [hexc('#cdbfae'), hexc('#c4ae96'), hexc('#b49c86'), hexc('#a98d74'), hexc('#d4c8b9')]
    base = np.zeros((N, N, 3))
    for i, c in enumerate(pal):
        m = (tone >= i / len(pal)) & (tone < (i + 1) / len(pal))
        base[m] = c
    base = lerp(base, hexc('#9a9086'), np.clip(noise(2.6) * .25, 0, .3))       # manchas grises
    base *= (0.95 + 0.05 * noise(1.4))[..., None]
    hs = (dome + lumps) * gap
    gy = (np.roll(hs, -2, 0) - np.roll(hs, 2, 0)) * 20                      # luz cenital horneada
    shade = np.clip(0.78 + gy * 0.6 + dome * 0.25, 0.45, 1.15)
    alb = base * shade[..., None] * (1 - 0.45 * pores)[..., None]
    alb = lerp(hexc('#2e2620'), alb, gap)
    save('piedra_seca', alb, normal_from_height(h, 10))


# 2) APLACADO DE LAJAS (zócalo de piedra irregular) · 2 m · lajas gris pizarra con junta clara
def aplacado():
    g = 7
    pts = np.array([((i + rng.uniform(.15, .85)) / g, (j + rng.uniform(.15, .85)) / g) for i in range(g) for j in range(g)])
    f1, f2, idx = voronoi(pts, stretch=(1.0, 1.15))
    edge = f2 - f1
    mortar = np.clip((edge - 0.006) / 0.01, 0, 1)
    tone = rng.random(len(pts))[idx]
    a, b2, c = hexc('#7e807a'), hexc('#9a9488'), hexc('#8c8f8a')
    base = lerp(lerp(a, c, tone), b2, np.clip(noise(2.0) * .3 + .3, 0, 1))
    base *= (0.9 + 0.1 * noise(0.9)[..., None])
    alb = lerp(hexc('#c4b8a4'), base, mortar)
    h = mortar * (0.6 + 0.4 * np.clip(edge * 15, 0, 1)) + noise(1.2) * .04
    save('aplacado', alb, normal_from_height(h, 7))


# 3) LOSA HIDRÁULICA DE ACERA (relieve de rombos) · 0,66 m = 2 x 2 losas de 33 cm
def acera():
    y, x = np.mgrid[0:N, 0:N] / N * 2            # 2 losas por lado
    fx, fy = x % 1 - .5, y % 1 - .5
    d = np.abs(fx) + np.abs(fy)                  # rombos concéntricos
    ring = np.abs(np.sin(d * np.pi * 5.0))
    groove = np.clip((0.35 - ring) / 0.35, 0, 1)
    diag = np.abs(np.sin((fx + fy) * np.pi * 5.0)) * np.abs(np.sin((fx - fy) * np.pi * 5.0))
    groove = np.maximum(groove, np.clip((0.12 - diag) / 0.12, 0, 1) * (d < .5))
    sq = np.maximum(np.abs(fx), np.abs(fy))
    border = np.clip((sq - 0.47) / 0.03, 0, 1)   # junta entre losas
    h = 1 - 0.55 * groove - 0.9 * border + noise(1.4) * .04
    base = lerp(hexc('#8d7a72'), hexc('#a8978f'), np.clip(noise(2.4) * .35 + .5, 0, 1))
    base *= (0.94 + 0.06 * noise(0.8)[..., None])
    dirt = np.clip(noise(2.6) - .8, 0, 1)
    alb = base * (1 - .28 * groove[..., None]) * (1 - .3 * border[..., None]) * (1 - .15 * dirt[..., None])
    save('acera', alb, normal_from_height(h, 3))


# 4) ASFALTO · 4 m · árido fino, manchas y grietas
def asfalto():
    base = lerp(hexc('#7c7874'), hexc('#959696'), np.clip(noise(2.5) * .3 + .5, 0, 1))
    grain = noise(0.2)
    base *= (0.93 + 0.07 * grain[..., None])
    speck = (rng.random((N, N)) > 0.985)
    base[speck] *= 1.25
    crack = np.zeros((N, N))
    for _ in range(6):                             # grietas: caminos aleatorios
        px, py = rng.integers(0, N, 2).astype(float)
        ang = rng.uniform(0, 2 * np.pi)
        for _ in range(int(rng.integers(80, 260))):
            ang += rng.normal(0, .35)
            px = (px + np.cos(ang) * 1.5) % N; py = (py + np.sin(ang) * 1.5) % N
            crack[int(py), int(px)] = 1
    from PIL import ImageFilter
    crack = np.asarray(Image.fromarray((crack * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))) / 255
    crack = np.clip(crack * 2, 0, 1)
    alb = base * (1 - .3 * crack[..., None])
    h = grain * .05 - crack * .6
    save('asfalto', alb, normal_from_height(h, 4))


# 5) ESTUCO / CAL · 4 m · casi blanco (se multiplica por el color de cada fachada)
def estuco():
    t = 0.93 + 0.035 * noise(2.6) + 0.02 * noise(1.0)
    stains = np.clip(noise(3.0) - 1.2, 0, 1) * .08
    v = np.clip(t - stains, 0, 1)
    alb = np.stack([v, v, v * .99], -1)
    save('estuco', alb, normal_from_height(noise(1.2) * .06 + noise(2.2) * .05, 6))


# 6) TEJA ÁRABE · 2 m (a lo largo del alero) x 2 m (pendiente) · canales y cobijas
def teja():
    y, x = np.mgrid[0:N, 0:N] / N
    cols, rows = 10, 4                              # tejas de ~20 cm de ancho y ~50 cm de largo
    cx = (x * cols) % 1
    col = np.floor(x * cols).astype(int)
    off = (col % 2) * 0.5                           # hiladas alternas
    ry = (y * rows + off) % 1
    row = np.floor(y * rows + off).astype(int)
    prof = np.cos((cx - .5) * np.pi)                # sección curva
    cap = (col % 2 == 1)
    h = np.where(cap, prof * .9 + .3, (1 - prof) * .3)
    h = h - np.clip((ry - .85) / .15, 0, 1) * .6     # solape: sombra al final de cada teja
    tid = (col * 37 + row * 101) % 997
    tone = (np.sin(tid * 12.9898) * 43758.5453) % 1
    base = lerp(hexc('#9a5d4a'), hexc('#c07d63'), tone)   # ver nota de calibración en REFERENCIAS_VISUALES
    base = lerp(base, hexc('#8c8170'), np.clip(noise(2.4) - .9, 0, .5))  # líquenes / suciedad
    shade = np.clip(.75 + .35 * h, .55, 1.1)
    alb = base * shade[..., None]
    save('teja', alb, normal_from_height(h, 18))


# 7) TERRAZA (cubierta plana) · 2 m · baldosa cerámica clara de 30 cm
def terraza():
    y, x = np.mgrid[0:N, 0:N] / N * 6.6
    j = np.minimum(np.abs(x % 1 - .5), np.abs(y % 1 - .5))
    joint = np.clip((0.47 - np.maximum(np.abs(x % 1 - .5), np.abs(y % 1 - .5))) / .03, 0, 1)
    base = lerp(hexc('#b9ad9c'), hexc('#d3cabb'), np.clip(noise(2.2) * .3 + .5, 0, 1))
    alb = base * (0.75 + 0.25 * joint[..., None])
    save('terraza', alb, normal_from_height(joint * .5 + noise(1.2) * .03, 3))
    del j


# 8) LOSA DE PIEDRA DE LA EXPLANADA · 2,4 m · losas grandes gris-beige (medido: #aaa4a0 / #c3b5aa, 18/frame_000001)
def losa_plaza():
    y, x = np.mgrid[0:N, 0:N] / N
    rows, cols = 4, 4                                    # losas de 60 cm, hiladas desplazadas
    ry = y * rows; row = np.floor(ry).astype(int)
    rx = x * cols + (row % 2) * 0.5; col = np.floor(rx).astype(int)
    jx = np.abs(rx % 1 - .5); jy = np.abs(ry % 1 - .5)
    joint = np.clip((0.485 - np.maximum(jx, jy * 0 + jx)) / .01, 0, 1) * np.clip((0.485 - jy) / .01, 0, 1)
    tid = (col * 13 + row * 7) % 97
    tone = (np.sin(tid * 12.9898) * 43758.5453) % 1
    base = lerp(hexc('#aaa39d'), hexc('#c0b6ac'), tone * .45 + .3)
    base = lerp(base, hexc('#8f8a85'), np.clip(noise(2.4) - .7, 0, .5))
    base *= (0.94 + 0.06 * noise(0.9))[..., None]
    alb = base * (0.72 + 0.28 * joint[..., None])
    save('losa_plaza', alb, normal_from_height(joint * .4 + noise(1.0) * .03, 3))


# 9) BALDOSA ROJA CUADRADA DEL CASCO · 1 m · baldosas de 20 cm (medido: #9b8788, 9/frame_000001)
def baldosa_roja():
    y, x = np.mgrid[0:N, 0:N] / N * 5
    j = np.maximum(np.abs(x % 1 - .5), np.abs(y % 1 - .5))
    joint = np.clip((0.46 - j) / .03, 0, 1)
    tid = (np.floor(x) * 7 + np.floor(y) * 3) % 23
    tone = (np.sin(tid * 78.233) * 43758.5453) % 1
    base = lerp(hexc('#8e7a7a'), hexc('#a8918f'), tone * .6 + .2)
    base = lerp(base, hexc('#7e7270'), np.clip(noise(2.5) - .8, 0, .4))
    base *= (0.95 + 0.05 * noise(0.8))[..., None]
    alb = base * (0.7 + 0.3 * joint[..., None])
    save('baldosa_roja', alb, normal_from_height(joint * .5 + noise(1.0) * .03, 3))


# 10) ADOQUÍN GRIS · 1 m · piezas de 20 x 10 cm en hiladas (medido: #aba59c, 16/frame_000011)
def adoquin():
    y, x = np.mgrid[0:N, 0:N] / N
    ry = y * 10; row = np.floor(ry).astype(int)
    rx = x * 5 + (row % 2) * 0.5
    jx = np.abs(rx % 1 - .5); jy = np.abs(ry % 1 - .5)
    joint = np.clip((0.47 - jx) / .03, 0, 1) * np.clip((0.44 - jy) / .06, 0, 1)
    tid = (np.floor(rx) * 11 + row * 5) % 31
    tone = (np.sin(tid * 4.1414) * 43758.5453) % 1
    base = lerp(hexc('#8e8a84'), hexc('#b9b2a8'), tone * .7 + .15)
    base = lerp(base, hexc('#77736e'), np.clip(noise(2.3) - .6, 0, .5))
    alb = base * (0.6 + 0.4 * joint[..., None])
    bev = np.clip(np.minimum((0.5 - jx) * 6, (0.5 - jy) * 4), 0, 1)
    save('adoquin', alb, normal_from_height(bev * .6 + noise(1.0) * .03, 4))


# 11) SILLAREJO DE MARÈS · 2 m · bloques irregulares de piedra arenisca (medido: #978679, 24/frame_000002)
def sillarejo():
    pts = []
    for r in range(10):
        y = (r + .5) / 10; k = int(rng.integers(5, 8)); x0 = rng.uniform(0, 1)
        for xv in np.sort(rng.uniform(0, 1, k)) * .1 + np.arange(k) / k:
            pts.append(((x0 + xv) % 1, (y + rng.uniform(-.02, .02)) % 1))
    f1, f2, idx = voronoi(np.array(pts), stretch=(0.45, 1.9), warp=0.004)
    edge = f2 - f1
    mortar = np.clip((edge - 0.004) / 0.008, 0, 1)
    tone = rng.random(len(pts))[idx]
    base = lerp(hexc('#8d7c6e'), hexc('#bcab9b'), tone)
    base *= (0.9 + 0.1 * noise(1.2))[..., None]
    alb = lerp(hexc('#cfc2b2'), base, mortar)
    save('sillarejo', alb, normal_from_height(mortar * .6 + noise(1.4) * .05, 5))


if __name__ == '__main__':
    print('Generando texturas en', OUT)
    for f in (piedra_seca, aplacado, acera, asfalto, estuco, teja, terraza, losa_plaza, baldosa_roja, adoquin, sillarejo):
        f()
    print('Listo.')
