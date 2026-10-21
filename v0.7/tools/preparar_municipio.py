#!/usr/bin/env python3
"""Datos de la PANTALLA DE INICIO: todo el municipio de Es Castell visto de noche.

Genera public/data/menorca/es-castell/municipio.json (mismas coordenadas locales que zone.json) con:
  - frontera del municipio: unión de las parcelas y polígonos del Catastro (REAL, simplificada a ~3 m)
  - relieve a 10 m a partir del MDT 50 cm del IGN (REAL, remuestreado); sin dato = mar
  - volúmenes de todos los edificios del municipio (Catastro, REAL; 3 m por planta ESTIMADO)
  - calles de OSM (REAL) para las luces de la ciudad
  - faros y luces de navegación de OSM (REAL) si existe data/raw/faros.json (python tools/extraer_faros.py)
  - contorno de toda Menorca (OSM, REAL) desde public/data/menorca/outline.json (python tools/extraer_contorno_menorca.py)
  - faros principales de la isla: si OSM no los trae, posición y altura de la lista de faros de España (Wikipedia); su ritmo queda ESTIMADO

Uso (desde la raíz del proyecto):
  python tools/preparar_municipio.py [--parcelas "data/raw/catastro/*cadastral*.gml"]
                                     [--edificios "data/raw/catastro/*buildingpart*.gml"] [--mdt "data/raw/mdt/*.tif"]
Necesita: numpy, scipy, matplotlib, tifffile (pip install scipy si falta).
"""
import argparse, base64, glob, json, math, os, sys
import xml.etree.ElementTree as ET
import numpy as np
from scipy import ndimage
sys.path.insert(0, 'tools'); from geolocal import utm

ap = argparse.ArgumentParser()
ap.add_argument('--parcelas', default='data/raw/catastro/*cadastral*.gml')
ap.add_argument('--edificios', default='data/raw/catastro/*buildingpart*.gml')
ap.add_argument('--mdt', default='data/raw/mdt/*.tif')
ap.add_argument('--out', default='public/data/menorca/es-castell/municipio.json')
A = ap.parse_args()
FLOOR, CELL, STEP = 3.0, 4.0, 10.0

origin = json.load(open('data/processed/zona.json'))['origin']
lat0, lon0 = origin['lat'], origin['lon']; kx, kz = 111320 * math.cos(math.radians(lat0)), 110540


def utm_inv(E, N, lc=3.0):
    """UTM 31 (ETRS89) → latitud, longitud (fórmulas de Snyder)."""
    a = 6378137.0; f = 1 / 298.257222101; e2 = f * (2 - f); ep = e2 / (1 - e2); k0 = .9996
    M = N / k0; mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256)); e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * np.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * np.sin(4 * mu) + 151 * e1 ** 3 / 96 * np.sin(6 * mu) + 1097 * e1 ** 4 / 512 * np.sin(8 * mu)
    s, c, t = np.sin(p1), np.cos(p1), np.tan(p1); C1 = ep * c * c; T1 = t * t; N1 = a / np.sqrt(1 - e2 * s * s); R1 = a * (1 - e2) / (1 - e2 * s * s) ** 1.5
    D = (E - 5e5) / (N1 * k0)
    lat = p1 - N1 * t / R1 * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep - 3 * C1 * C1) * D ** 6 / 720)
    lon = (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep + 24 * T1 * T1) * D ** 5 / 120) / c
    return np.degrees(lat), lc + np.degrees(lon)


def loc(e, n):
    """UTM 31 → coordenadas locales del juego, con la misma fórmula que src/core/geo.js (x = (lon-lon0)·kx, z = -(lat-lat0)·kz)."""
    la, lo = utm_inv(np.asarray(e, float), np.asarray(n, float))
    return np.c_[(lo - lon0) * kx, -(la - lat0) * kz]


_la, _lo = utm_inv(*utm(np.array([lat0 + .02]), np.array([lon0 - .03])))
print(f'comprobación UTM ida y vuelta: {abs(_la[0] - lat0 - .02) * 1e5:.3f}e-5°')


def rings(files, tag, want_floors=False):
    out = []
    for f in files:
        for _, el in ET.iterparse(f):
            if not el.tag.endswith('}' + tag): continue
            fl = next((int(x.text) for x in el.iter() if x.tag.endswith('}numberOfFloorsAboveGround') and x.text), 0) if want_floors else 0
            for x in el.iter():
                if x.tag.endswith('}exterior'):
                    pl = next((y.text for y in x.iter() if y.tag.endswith('}posList')), None)
                    if pl:
                        v = np.array(pl.split(), float).reshape(-1, 2); out.append((loc(v[:, 0], v[:, 1]), fl))
            el.clear()
    return out


def dp(pts, tol):
    """Douglas-Peucker (iterativo). Los anillos cerrados se parten por el punto más lejano al primero."""
    if len(pts) < 3: return pts
    if np.allclose(pts[0], pts[-1]):
        k = int(np.argmax(np.hypot(*(pts - pts[0]).T)))
        return np.vstack([dp(pts[:k + 1], tol)[:-1], dp(pts[k:], tol)])
    keep = np.zeros(len(pts), bool); keep[0] = keep[-1] = True; st = [(0, len(pts) - 1)]
    while st:
        i, j = st.pop(); a, b = pts[i], pts[j]; d = b - a; L = np.hypot(*d) or 1e-9
        seg = pts[i + 1:j]
        if not len(seg): continue
        dist = np.abs(d[0] * (seg[:, 1] - a[1]) - d[1] * (seg[:, 0] - a[0])) / L
        k = int(np.argmax(dist))
        if dist[k] > tol: keep[i + 1 + k] = True; st += [(i, i + 1 + k), (i + 1 + k, j)]
    return pts[keep]


# ---------- 1. Frontera: unión rasterizada de parcelas y polígonos ----------
pf = sorted(glob.glob(A.parcelas))
if not pf: sys.exit(f'No encuentro las parcelas del Catastro ({A.parcelas}). Copia A_ES_SDGC_CP_07064_cadastralparcel.gml '
                     'y A_ES_SDGC_CP_07064_cadastralzoning.gml en data/raw/catastro/')
polys = rings([f for f in pf if 'zoning' not in f], 'CadastralParcel') + rings([f for f in pf if 'zoning' in f], 'CadastralZoning')
allp = np.vstack([p for p, _ in polys])
X0, Z0 = np.floor(allp.min(0) / 100) * 100 - 400; X1, Z1 = np.ceil(allp.max(0) / 100) * 100 + 400
print(f'{len(polys)} polígonos catastrales; extensión x {X0:.0f}..{X1:.0f}, z {Z0:.0f}..{Z1:.0f}')
from PIL import Image, ImageDraw
W, H = int((X1 - X0) / CELL), int((Z1 - Z0) / CELL)
im = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(im)
for p, _ in polys: dr.polygon([((x - X0) / CELL, (z - Z0) / CELL) for x, z in p], fill=1)
mask = np.array(im, bool)
mask = ndimage.binary_closing(mask, iterations=4)          # rellena calles y caminos entre parcelas (~16 m)
mask = ndimage.binary_fill_holes(mask)
lab, n = ndimage.label(mask); sizes = ndimage.sum(mask, lab, range(1, n + 1))
mask = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s * CELL * CELL > 3000])
import contourpy
border = []
for seg in contourpy.contour_generator(z=np.pad(mask, 1).astype(float)).lines(.5):
    p = np.c_[X0 + (seg[:, 0] - 1 + .5) * CELL, Z0 + (seg[:, 1] - 1 + .5) * CELL]
    p = dp(p, 3.0)
    if len(p) > 3: border.append(np.round(p, 1).tolist())
border.sort(key=len, reverse=True)
print(f'frontera: {len(border)} polígonos ({sum(map(len, border))} vértices), superficie {mask.sum() * CELL * CELL / 1e6:.2f} km²')

# ---------- 2. Relieve a 10 m ----------
xs = np.arange(X0, X1 + 1, STEP); zs = np.arange(Z0, Z1 + 1, STEP); GX, GZ = np.meshgrid(xs, zs)
E, N = utm(lat0 - GZ / kz, lon0 + GX / kx); Hh = np.full(GX.shape, np.nan)
mf = sorted(glob.glob(A.mdt))
import tifffile
for f in mf:
    try:
        with tifffile.TiffFile(f) as tf:
            pg = tf.pages[0]; e0, n0 = pg.tags[33922].value[3:5]; a = pg.asarray().astype(np.float32)
    except Exception as ex:
        print(f'  {os.path.basename(f)}: ERROR al leer ({ex}); se omite'); continue
    a[a < -1000] = np.nan; F = int(STEP / .5); r, c = a.shape; r2, c2 = r // F * F, c // F * F
    with np.errstate(all='ignore'): b = np.nanmean(a[:r2, :c2].reshape(r2 // F, F, c2 // F, F), axis=(1, 3))
    ci = ((E - e0) / STEP).astype(int); ri = ((n0 - N) / STEP).astype(int)
    m = (ci >= 0) & (ri >= 0) & (ci < b.shape[1]) & (ri < b.shape[0]) & np.isnan(Hh)
    Hh[m] = b[ri[m], ci[m]]
    print(f'  {os.path.basename(f)}: {int(m.sum())} puntos')
inside = ndimage.map_coordinates(mask.astype(float), [(GZ - Z0) / CELL, (GX - X0) / CELL], order=0) > .5
falta = inside & np.isnan(Hh)
print(f'relieve: {Hh.shape[1]}×{Hh.shape[0]} puntos; dentro del municipio sin MDT: {falta.sum()} ({falta.sum() / max(1, inside.sum()) * 100:.1f} %)')
if not mf: print('AVISO: sin hojas del MDT, el municipio se verá plano.')
Hq = np.where(np.isnan(Hh), -32768, np.round(Hh * 10)).astype('<i2')   # -32768 = sin dato (mar o fuera de las hojas)

# ---------- 3. Edificios ----------
ef = sorted(glob.glob(A.edificios)); bld = []
for p, fl in rings(ef, 'BuildingPart', True):
    if fl <= 0: continue
    q = dp(p[:-1] if np.allclose(p[0], p[-1]) else p, .4)
    if len(q) >= 3: bld.append([fl] + np.round(q, 1).ravel().tolist())
print(f'edificios: {len(bld)} piezas con plantas')

# ---------- 4. Calles (OSM) y lugares ----------
W0 = json.load(open('data/raw/world.json', encoding='utf-8'))
roads = []
for r in W0['roads']:
    t = r.get('type') or r.get('t') or ''
    if t in ('footway', 'path', 'steps', 'track', 'cycleway', 'bridleway'): continue
    p = dp(np.array(r.get('pts') or r.get('p'), float), 2.0)
    roads.append({'t': t, 'p': np.round(p, 1).tolist()})
print(f'calles: {len(roads)}')

# ---------- 5. Contorno de la isla (OSM) ----------
island = []
if os.path.exists('public/data/menorca/outline.json'):
    from collections import defaultdict
    lines = [[tuple(q) for q in l] for l in json.load(open('public/data/menorca/outline.json'))]
    rings_ = [l for l in lines if l[0] == l[-1]]; op = [l for l in lines if l[0] != l[-1]]
    st_ = defaultdict(list); used = set()
    for i, l in enumerate(op): st_[l[0]].append(i)
    for i, l in enumerate(op):                      # encadenar los tramos de costa abiertos
        if i in used: continue
        used.add(i); c = list(l)
        while c[-1] != c[0]:
            nx = [j for j in st_.get(c[-1], []) if j not in used]
            if not nx: break
            used.add(nx[0]); c += op[nx[0]][1:]
        if c[0] == c[-1]: rings_.append(c)
    for r in rings_:
        a = np.array(r); xy = np.c_[(a[:, 0] - lon0) * kx, -(a[:, 1] - lat0) * kz]
        sup = abs(np.sum(xy[:-1, 0] * xy[1:, 1] - xy[1:, 0] * xy[:-1, 1])) / 2
        if sup > 20000: island.append(np.round(dp(xy, 8.0), 0).tolist())
    island.sort(key=len, reverse=True)
    print(f'isla: {len(island)} polígonos (Menorca + islotes > 2 ha), {len(island[0]) if island else 0} vértices en la costa principal')
else:
    print('AVISO: falta public/data/menorca/outline.json → sin isla (python tools/extraer_contorno_menorca.py)')

# ---------- 6. Faros: OSM + faros principales ----------
# Posición, altura focal y alcance de los faros principales: «List of lighthouses in Spain» (Wikipedia, CC BY-SA).
# Solo se usan si OSM no tiene un faro a < 400 m. Ritmo desconocido → ESTIMADO (destello cada 5 s).
PRINCIPALES = [('Cap d\'Artrutx', 39 + 55 / 60 + 21 / 3600, 3 + 49 / 60 + 27 / 3600, 45, 19), ('Cavalleria', 40 + 5 / 60 + 21 / 3600, 4 + 5 / 60 + 32 / 3600, 94, 26),
               ('Ciutadella', 39 + 59 / 60 + 46 / 3600, 3 + 49 / 60 + 22 / 3600, 21, 14), ('Favàritx', 39 + 59 / 60 + 50 / 3600, 4 + 16 / 60 + 1 / 3600, 47, 21),
               ('Illa de l\'Aire', 39 + 47 / 60 + 58 / 3600, 4 + 17 / 60 + 35 / 3600, 53, 18), ('Punta Nati', 40 + 3 / 60 + 1 / 3600, 3 + 49 / 60 + 25 / 3600, 42, 18)]
faros = json.load(open('data/raw/faros.json', encoding='utf-8')) if os.path.exists('data/raw/faros.json') else []
if not faros: print('AVISO: no hay data/raw/faros.json (python tools/extraer_faros.py): solo faros principales con ritmo ESTIMADO')
for f in faros: f['x'], f['z'] = round((f['lon'] - lon0) * kx, 1), round(-(f['lat'] - lat0) * kz, 1)
# Un faro de OSM sin datos de luz junto a una luz con datos (p. ej. Far de Maó y «Punta San Carlos»): se fusionan
for f in [f for f in faros if f['kind'] == 'faro' and not any('character' in k for k in f['tags'])]:
    luz = min((g for g in faros if g is not f and any('character' in k for k in g['tags'])), key=lambda g: math.hypot(g['x'] - f['x'], g['z'] - f['z']), default=None)
    if luz and math.hypot(luz['x'] - f['x'], luz['z'] - f['z']) < 40:
        f['tags'] = {**luz['tags'], **f['tags']}; faros.remove(luz)
for name, la, lo, hgt, rng in PRINCIPALES:
    x, z = (lo - lon0) * kx, -(la - lat0) * kz
    if any(f['kind'] == 'faro' and math.hypot(f['x'] - x, f['z'] - z) < 400 for f in faros): continue
    faros.append({'name': name, 'kind': 'faro', 'lat': la, 'lon': lo, 'x': round(x, 1), 'z': round(z, 1), 'ritmo': 'ESTIMADO',
                  'tags': {'seamark:light:height': str(hgt), 'seamark:light:range': str(rng), 'seamark:light:colour': 'white'}})
print(f'faros: {sum(f["kind"] == "faro" for f in faros)} faros y {sum(f["kind"] != "faro" for f in faros)} luces de navegación')

out = {'nota': 'Pantalla de inicio. Frontera y edificios: Catastro. Relieve: MDT IGN. Calles, costa y faros: OSM. Ver docs/DATA_SOURCES.md',
       'origin': origin, 'box': [float(X0), float(X1), float(Z0), float(Z1)], 'border': border,
       'terrain': {'x0': float(X0), 'z0': float(Z0), 'step': STEP, 'cols': len(xs), 'rows': len(zs), 'h': base64.b64encode(Hq.tobytes()).decode()},
       'buildings': bld, 'roads': roads, 'faros': faros, 'island': island}
os.makedirs(os.path.dirname(A.out), exist_ok=True)
json.dump(out, open(A.out, 'w'), separators=(',', ':'))
print(f'Listo: {A.out} ({os.path.getsize(A.out) / 1e6:.1f} MB)')
