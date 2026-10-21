#!/usr/bin/env python3
"""Prepara los datos del visor CesiumJS (cesium/data/es-castell.js) a partir de fuentes REALES.

Ejecutar desde la carpeta raíz de menorca3d_v2:
    python pipeline/preparar_cesium.py
    python pipeline/preparar_cesium.py --catastro "ruta/*buildingpart*.gml"

Entradas (solo lectura):
  - Catastro INSPIRE BuildingPart del municipio 07064 (EPSG:25831). Por defecto, el original de ../menorca3d.
  - v0.7/public/data/menorca/es-castell/municipio.json: relieve (MDT IGN a 10 m), calles OSM, frontera y faros.
  - v0.7/public/data/menorca/es-castell/santa-anna/edificios.json: número estable de cada parcela.
  - v0.7/public/data/menorca/outline.json: costa de Menorca (OSM).

Salida: un archivo .js (no .json) para que el visor funcione también abriendo index.html con doble clic.

Estado de cada dato (como en v0.7): huellas y plantas REALES (Catastro), reproyectadas EXACTAMENTE de EPSG:25831 a
lon/lat con pipeline/coords.py; altura 3 m por planta ESTIMADA; calles, frontera, relieve y faros vienen de v0.7 en
su proyección local (x este, z sur) y se devuelven a lon/lat con la inversa de esa misma proyección (error < 1 m
cerca del origen, algunos metros en los extremos del municipio: ver README).
"""
import argparse, base64, glob, json, math, os, sys
import xml.etree.ElementTree as ET
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from coords import utm_to_lonlat, v07_local_to_lonlat

ap = argparse.ArgumentParser()
ap.add_argument('--catastro', default='../menorca3d/menorca3d/data/raw/catastro/*buildingpart*.gml')
ap.add_argument('--v07', default='v0.7')
ap.add_argument('--out', default='cesium/data/es-castell.js')
A = ap.parse_args()

FLOOR = 3.0
MUNI = json.load(open(os.path.join(A.v07, 'public/data/menorca/es-castell/municipio.json'), encoding='utf-8'))
O = MUNI['origin']
kx, kz = 111320 * math.cos(math.radians(O['lat'])), 110540

# ---------- Relieve (MDT IGN remuestreado a 10 m por v0.7; decímetros Int16) ----------
T = MUNI['terrain']
# Relieve fino (5 m) de la zona detallada de v0.7 (zone.json): tiene prioridad, para que los modelos de v0.7
# (calculados sobre ese mismo relieve) asienten exactamente en el terreno del visor.
ZONE = json.load(open(os.path.join(A.v07, 'public/data/menorca/es-castell/santa-anna/zone.json'), encoding='utf-8'))
assert ZONE['origin'] == O, 'zone.json y municipio.json deben compartir origen'
TF = ZONE['terrain']
grids = [(TF, np.frombuffer(base64.b64decode(TF['h']), dtype='<i2').reshape(TF['rows'], TF['cols']) / 10.0),
         (T, np.frombuffer(base64.b64decode(T['h']), dtype='<i2').reshape(T['rows'], T['cols']) / 10.0)]
def ground(lon, lat):
    x, z = (lon - O['lon']) * kx, -(lat - O['lat']) * kz
    for G, H in grids:
        u, v = (x - G['x0']) / G['step'], (z - G['z0']) / G['step']
        if not (0 <= u < G['cols'] - 1 and 0 <= v < G['rows'] - 1): continue
        i, j = int(u), int(v); fu, fv = u - i, v - j
        return float((H[j, i] * (1 - fu) + H[j, i + 1] * fu) * (1 - fv) + (H[j + 1, i] * (1 - fu) + H[j + 1, i + 1] * fu) * fv)
    return 0.0

# ---------- Edificios: Catastro BuildingPart, reproyección exacta ----------
nums = {}
ep = os.path.join(A.v07, 'public/data/menorca/es-castell/santa-anna/edificios.json')
if os.path.exists(ep):
    for e in json.load(open(ep, encoding='utf-8'))['edificios']: nums[e['ref']] = e['n']

files = sorted(glob.glob(A.catastro))
if not files: sys.exit(f'ERROR: no encuentro el GML del Catastro en {A.catastro!r} (usa --catastro)')
ring = lambda pl: [round(c, 7) for E, N in np.array(pl.split(), float).reshape(-1, 2) for c in utm_to_lonlat(E, N)]
bld, skipped = [], 0
for f in files:
    for _, el in ET.iterparse(f):
        if not el.tag.endswith('}BuildingPart'): continue
        fid = next(v for k, v in el.attrib.items() if k.endswith('}id'))
        fl = next((int(x.text) for x in el.iter() if x.tag.endswith('}numberOfFloorsAboveGround') and x.text), 0)
        ext, holes = None, []
        for x in el.iter():
            if x.tag.endswith('}exterior') or x.tag.endswith('}interior'):
                pl = next((y.text for y in x.iter() if y.tag.endswith('}posList')), None)
                if not pl: continue
                if x.tag.endswith('}exterior'): ext = ring(pl)
                else: holes.append(ring(pl))
        el.clear()
        if fl <= 0 or ext is None: skipped += 1; continue
        ref = fid.split('.')[-1].split('_part')[0]
        base = max(0.0, min(ground(ext[k], ext[k + 1]) for k in range(0, len(ext), 2)))   # mar = 0 (PLACEHOLDER)
        b = {'r': ref, 'f': fl, 'b': round(base, 1), 'p': ext}
        if holes: b['h'] = holes
        if ref in nums: b['n'] = nums[ref]
        bld.append(b)
print(f'edificios: {len(bld)} piezas con plantas ({skipped} sin plantas sobre rasante o sin geometría, descartadas)')

# ---------- Calles, frontera y faros (de v0.7) ----------
ll = lambda pts: [round(c, 6) for x, z in pts for c in v07_local_to_lonlat(x, z, O)]
roads = [{'t': r['t'], 'p': ll(r['p'])} for r in MUNI['roads']]
border = [ll(r) for r in MUNI['border']]
faros = [{'name': f.get('name', ''), 'kind': f['kind'], 'lat': f['lat'], 'lon': f['lon'], 'tags': f.get('tags', {}),
          'ritmo': f.get('ritmo') or ('REAL' if any('character' in k or 'sequence' in k for k in f.get('tags', {})) else 'ESTIMADO'),
          'g': round(ground(f['lon'], f['lat']), 1)} for f in MUNI['faros']]
coast = json.load(open(os.path.join(A.v07, 'public/data/menorca/outline.json'), encoding='utf-8'))
print(f'calles: {len(roads)} · frontera: {len(border)} anillo(s) · faros y luces: {len(faros)} · costa: {len(coast)} tramos')

out = {
    'nota': 'Generado por pipeline/preparar_cesium.py. Coordenadas lon/lat ETRS89 (≈WGS84). Alturas ortométricas (MDT IGN).',
    'fuentes': ['Edificios: © Dirección General del Catastro (INSPIRE BuildingPart, EPSG:25831)',
                'Relieve: MDT 50 cm © Instituto Geográfico Nacional (remuestreado a 5 m en la zona detallada y a 10 m en el resto)',
                'Calles, costa y faros: © colaboradores de OpenStreetMap (ODbL)'],
    'origin': O,
    'terrain': {'x0': T['x0'], 'z0': T['z0'], 'step': T['step'], 'cols': T['cols'], 'rows': T['rows'], 'h': T['h'], 'kx': kx, 'kz': kz},
    'terrain_fino': {'x0': TF['x0'], 'z0': TF['z0'], 'step': TF['step'], 'cols': TF['cols'], 'rows': TF['rows'], 'h': TF['h']},
    'buildings': bld, 'roads': roads, 'border': border, 'faros': faros, 'coast': coast,
}
os.makedirs(os.path.dirname(A.out), exist_ok=True)
with open(A.out, 'w', encoding='utf-8') as fh:
    fh.write('// Generado por pipeline/preparar_cesium.py: no editar a mano.\nwindow.MENORCA_DATA = ')
    json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    fh.write(';\n')
print(f'escrito {A.out} ({os.path.getsize(A.out) / 1e6:.1f} MB)')
