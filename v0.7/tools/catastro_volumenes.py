#!/usr/bin/env python3
"""Sustituye los edificios de data/processed/zona.json por los VOLÚMENES del Catastro (una pieza por BuildingPart,
con su número de plantas y sus patios). Los edificios de OSM sin ninguna parte catastral dentro se conservan.

Uso: python tools/catastro_volumenes.py "data/raw/catastro/*buildingpart*.gml"
Después: python tools/procesar_terreno.py "data/raw/mdt/*.tif"
Plantas y huellas: REAL (Catastro). Altura por planta: ESTIMADA (3 m). Tejados: PROCEDURALES.
"""
import glob, json, sys, numpy as np
import xml.etree.ElementTree as ET
from collections import defaultdict
from matplotlib.path import Path
sys.path.insert(0, 'tools'); from geolocal import utm_to_local

FLOOR, SRC = 3.0, (sys.argv[1] if len(sys.argv) > 1 else 'data/raw/catastro/*buildingpart*.gml')
Z = json.load(open('data/processed/zona.json')); X0, X1, Z0, Z1 = Z['box']
loc = utm_to_local(Z['origin'])
rd = lambda a: [[round(float(x), 2), round(float(z), 2)] for x, z in a]

parts = []
for f in glob.glob(SRC):
    for _, el in ET.iterparse(f):
        if not el.tag.endswith('}BuildingPart'): continue
        fid = next(v for k, v in el.attrib.items() if k.endswith('}id'))
        fl = next((int(x.text) for x in el.iter() if x.tag.endswith('}numberOfFloorsAboveGround') and x.text), 0)
        ext, holes = None, []
        for x in el.iter():
            if x.tag.endswith('}exterior') or x.tag.endswith('}interior'):
                pl = next((y.text for y in x.iter() if y.tag.endswith('}posList')), None)
                if pl:
                    v = np.array(pl.split(), float).reshape(-1, 2); r = loc(v[:, 0], v[:, 1])
                    if x.tag.endswith('}exterior'): ext = r
                    else: holes.append(r)
        el.clear()
        if fl > 0 and ext is not None and ((ext[:, 0] > X0) & (ext[:, 0] < X1) & (ext[:, 1] > Z0) & (ext[:, 1] < Z1)).any():
            parts.append({'id': fid.split('.')[-1].split('_part')[0], 'fl': fl, 'ext': ext, 'holes': holes})
print('partes catastrales con plantas en la zona:', len(parts))

# ¿Está la parte pegada a otro edificio (medianera)? Vértices ajenos a < 0,5 m de sus lados.
G, cells = 10.0, defaultdict(list)
for i, p in enumerate(parts):
    for x, z in p['ext']: cells[(int(x // G), int(z // G))].append((x, z, p['id']))
def attached(p):
    e = p['ext']
    for k in range(len(e) - 1):
        a, b = e[k], e[k + 1]; ab = b - a; L2 = ab @ ab or 1e-9
        for cx in range(int(min(a[0], b[0]) // G) - 1, int(max(a[0], b[0]) // G) + 2):
            for cz in range(int(min(a[1], b[1]) // G) - 1, int(max(a[1], b[1]) // G) + 2):
                for x, z, bid in cells.get((cx, cz), ()):
                    if bid == p['id']: continue
                    q = np.array([x, z]); t = min(1, max(0, (q - a) @ ab / L2))
                    if np.hypot(*(a + t * ab - q)) < .5: return True
    return False

out = []
nparts = defaultdict(int)
for p in parts: nparts[p['id']] += 1
for p in parts:
    b = {'p': rd(p['ext']), 'h': p['fl'] * FLOOR, 'hs': 'catastro', 'ref': p['id']}
    if p['holes']: b['holes'] = [rd(h) for h in p['holes']]
    if attached(p): b['att'] = 1
    if nparts[p['id']] > 1: b['multi'] = 1
    out.append(b)
cent = np.array([p['ext'][:-1].mean(axis=0) for p in parts])
kept = 0
for b in Z['buildings']:  # OSM sin Catastro (p. ej. fuera del municipio)
    if not Path(b['p']).contains_points(cent).any():
        b['hs'] = b.get('hs') if b.get('hs') not in (None, 'catastro') else 'osm'; out.append(b); kept += 1
Z['buildings'] = out
json.dump(Z, open('data/processed/zona.json', 'w'), ensure_ascii=True, separators=(',', ':'))
print(f'volúmenes del Catastro: {len(parts)} · edificios OSM conservados: {kept} · adosados: {sum(1 for b in out if b.get("att"))}')
