#!/usr/bin/env python3
"""Prepara el RESTO del municipio de Es Castell (fuera de la zona detallada de v0.7) con la misma cadena de v0.7.

Pasos (los mismos que v0.7 usó para Santa Anna / casco, con otro recuadro):
  1. OSM de v0.7/data/raw/world.json en el recuadro del municipio (como v0.7/tools/preparar_zona.py).
  2. v0.7/tools/catastro_volumenes.py: volúmenes REALES del Catastro (huella, patios, plantas).
  3. v0.7/tools/aceras_estimadas.py: aceras ESTIMADAS en calles urbanas.
  4. Relieve: MDT del IGN a 10 m (el de municipio.json).
  5. Se descarta lo que ya está en la zona detallada (zone.json) y lo que cae fuera de Es Castell (Maó).
Salida: data/extension/zona_municipio.json (mismo formato que zone.json de v0.7).

Uso (desde menorca3d_v2):  python pipeline/preparar_extension.py [--catastro "ruta/*buildingpart*.gml"]
"""
import argparse, json, math, os, shutil, subprocess, sys, tempfile
import numpy as np
from matplotlib.path import Path

ap = argparse.ArgumentParser()
ap.add_argument('--catastro', default='../menorca3d/menorca3d/data/raw/catastro/*buildingpart*.gml')
ap.add_argument('--v07', default='v0.7')
ap.add_argument('--out', default='data/extension/zona_municipio.json')
A = ap.parse_args()
V = A.v07
W = json.load(open(os.path.join(V, 'data/raw/world.json'), encoding='utf-8'))
M = json.load(open(os.path.join(V, 'public/data/menorca/es-castell/municipio.json'), encoding='utf-8'))
Z = json.load(open(os.path.join(V, 'public/data/menorca/es-castell/santa-anna/zone.json'), encoding='utf-8'))
assert W['origin'] == M['origin'] == Z['origin'], 'world.json, municipio.json y zone.json deben compartir origen'
ZX0, ZX1, ZZ0, ZZ1 = Z['box']                     # zona detallada (ya exportada aparte)
X0, X1, Z0, Z1 = M['box']                         # recuadro del municipio
border = Path(M['border'][0])
inb = lambda p: X0 <= p[0] <= X1 and Z0 <= p[1] <= Z1
anyin = lambda pts: any(inb(p) for p in pts)

# Zonas con estilo: las de v0.7 + Cales Fonts como casco (v2; centro y radio ESTIMADOS desde los nombres de calle de OSM)
ZONES = Z['zones'] + [{'n': 'Cales Fonts', 'x': 170, 'z': -370, 'r': 140, 'casco': True}]

# ---------- 1. OSM en el recuadro (mismos campos que preparar_zona.py) ----------
bl = [{'p': b['pts'], 'h': b['h'], **({'c': b['color']} if b['color'] != '#f4f1e8' else {}), **({'rs': b['roof_shape']} if b.get('roof_shape') else {})}
      for b in W['buildings'] if anyin(b['pts'])]
rd = [{'p': r['pts'], 'w': r['w'], 'c': r['color'], 't': r.get('type'), **({'sw': r['sidewalk']} if r.get('sidewalk') else {}), **({'fw': r['footway']} if r.get('footway') else {})}
      for r in W['roads'] if anyin(r['pts'])]
wl = [{'p': w['pts'], 't': w['type'], **({'h': w['h']} if w.get('h') else {}), **({'m': w['material']} if w.get('material') else {})}
      for w in W.get('walls', []) if anyin(w['pts'])]
plazas = [{'n': r.get('name'), 'p': r['pts']} for r in W['roads'] if r['type'] == 'pedestrian' and len(r['pts']) > 3 and r['pts'][0] == r['pts'][-1] and anyin(r['pts'])]
landmarks = [{'n': b['name'], 'k': 'cuartel' if b['name'].lower().startswith('cuartel') else 'otro', 'p': b['pts']} for b in W['buildings'] if b.get('name') and anyin(b['pts'])]
isl = sorted(M['island'], key=len, reverse=True)
pre = {'box': [X0, X1, Z0, Z1], 'plazas': plazas, 'landmarks': landmarks, 'land': isl[0], 'islands': isl[1:], 'areas': [],
       'buildings': bl, 'roads': rd, 'walls': wl, 'pois': [], 'spawn': [0, 0], 'zones': ZONES, 'attr': W['attribution'], 'origin': W['origin']}

# ---------- 2-3. Herramientas de v0.7 sin cambios, en una carpeta temporal ----------
tmp = tempfile.mkdtemp(prefix='m3d_ext_')
shutil.copytree(os.path.join(V, 'tools'), os.path.join(tmp, 'tools'), ignore=shutil.ignore_patterns('*.json', '__pycache__'))
shutil.copy(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'coords.py'), os.path.join(tmp, 'tools'))   # conversión exacta (geolocal.py de v2)
os.makedirs(os.path.join(tmp, 'data/processed'))
json.dump(pre, open(os.path.join(tmp, 'data/processed/zona.json'), 'w'), separators=(',', ':'))
gml = os.path.abspath(A.catastro)   # patrón glob absoluto: las herramientas se ejecutan en otra carpeta
for cmd in ([sys.executable, 'tools/catastro_volumenes.py', gml], [sys.executable, 'tools/aceras_estimadas.py']):
    print('>', ' '.join(os.path.basename(c) for c in cmd[1:]))
    r = subprocess.run(cmd, cwd=tmp, capture_output=True, text=True)
    print(r.stdout.strip()[-600:])
    if r.returncode: sys.exit('ERROR en ' + cmd[1] + ':\n' + r.stderr[-2000:])
E = json.load(open(os.path.join(tmp, 'data/processed/zona.json')))
shutil.rmtree(tmp, ignore_errors=True)

# ---------- 5. Quitar lo de la zona detallada y lo que queda fuera del municipio ----------
inZone = lambda p: ZX0 <= p[0] <= ZX1 and ZZ0 <= p[1] <= ZZ1
keepPt = lambda p: not inZone(p) and border.contains_point(p)
def densify(p, step=4.0):
    o = [p[0]]
    for a, b in zip(p, p[1:]):
        n = max(1, math.ceil(math.hypot(b[0] - a[0], b[1] - a[1]) / step))
        o += [[a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n] for k in range(1, n + 1)]
    return o
def clip(items):   # parte cada línea en los tramos que quedan fuera de la zona detallada y dentro del municipio
    out = []
    for it in items:
        run = []
        for q in densify(it['p']):
            if keepPt(q): run.append([round(q[0], 2), round(q[1], 2)])
            else:
                if len(run) > 1: out.append({**it, 'p': run})
                run = []
        if len(run) > 1: out.append({**it, 'p': run})
    return out
cen = lambda p: [sum(q[0] for q in p) / len(p), sum(q[1] for q in p) / len(p)]
n0 = len(E['buildings'])
E['buildings'] = [b for b in E['buildings'] if not inZone(cen(b['p'])) and border.contains_point(cen(b['p']))]
E['roads'] = clip([r for r in E['roads'] if not (r['t'] == 'pedestrian' and r['p'][0] == r['p'][-1])])
E['walls'] = clip(E['walls']); E['walks'] = clip(E.get('walks', []))
E['plazas'] = [p for p in E['plazas'] if not inZone(cen(p['p'])) and border.contains_point(cen(p['p']))]
print(f'resto del municipio: {len(E["buildings"])} edificios (de {n0} en el recuadro), {len(E["roads"])} tramos de calle, '
      f'{len(E["walls"])} muros, {len(E["walks"])} aceras, {len(E["plazas"])} plazas')

# ---------- 4. Relieve (10 m, municipio.json) ----------
E['terrain'] = M['terrain']
E['nota'] = 'Resto del municipio de Es Castell (fuera de zone.json). Generado por pipeline/preparar_extension.py con las herramientas de v0.7.'
os.makedirs(os.path.dirname(A.out), exist_ok=True)
json.dump(E, open(A.out, 'w'), separators=(',', ':'))
print(f'escrito {A.out} ({os.path.getsize(A.out) / 1e6:.1f} MB)')
