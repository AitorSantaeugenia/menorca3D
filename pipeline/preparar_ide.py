#!/usr/bin/env python3
"""Pasa las capas del IDE Menorca (data/raw/ide_menorca, EPSG:25831) al marco local de v0.7 para exportar_glb.mjs.

Uso (desde menorca3d_v2, después de pipeline/descargar_ide_menorca.py):
    python pipeline/preparar_ide.py
Después se regeneran los modelos de calle:
    node pipeline/exportar_glb.mjs --zona
    node pipeline/exportar_glb.mjs --zonefile data/extension/zona_municipio.json --name municipio

Capas (todas REALES, cartografía 1:5.000 del Consell Insular, CC BY 4.0):
  aceras    re007urb_vorera       polígonos (con huecos)
  escaleras re007urb_escala       polígonos
  porches   re007urb_porxo        polígonos; tipo: Por (porche), Mq/Marq (marquesina)
  arboles   re007urb_arbres       puntos
  paredes   re007rus_parets5000   líneas; tipo: paret seca, muro de contención, marjada (bancal)
Se conserva solo lo que cae dentro del municipio de Es Castell (frontera de v0.7). Cada elemento lleva 'z' = 1 si su
centro cae en la zona detallada de v0.7 (zone.json), para repartirlo entre los modelos «calle» y «municipio_calle».
Coordenadas: UTM → lon/lat con la conversión exacta de pipeline/coords.py → marco local de v0.7 (x este, z sur).
Salida: data/ide/ide_local.json
"""
import argparse, json, math, os, sys
from matplotlib.path import Path

sys.path.insert(0, os.path.dirname(__file__))
from coords import utm_to_lonlat

ap = argparse.ArgumentParser()
ap.add_argument('--raw', default='data/raw/ide_menorca')
ap.add_argument('--v07', default='v0.7')
ap.add_argument('--out', default='data/ide/ide_local.json')
A = ap.parse_args()

M = json.load(open(os.path.join(A.v07, 'public/data/menorca/es-castell/municipio.json'), encoding='utf-8'))
Z = json.load(open(os.path.join(A.v07, 'public/data/menorca/es-castell/santa-anna/zone.json'), encoding='utf-8'))
O = M['origin']; assert Z['origin'] == O
kx, kz = 111320 * math.cos(math.radians(O['lat'])), 110540
ZX0, ZX1, ZZ0, ZZ1 = Z['box']
borders = [Path(b) for b in M['border']]

def loc(E, N):
    lon, lat = utm_to_lonlat(E, N)
    return [round((lon - O['lon']) * kx, 2), round(-(lat - O['lat']) * kz, 2)]
def cen(p): return [sum(q[0] for q in p) / len(p), sum(q[1] for q in p) / len(p)]
def keep(c): return any(b.contains_point(c) for b in borders)
def inZ(c): return 1 if ZX0 <= c[0] <= ZX1 and ZZ0 <= c[1] <= ZZ1 else 0
def load(capa):
    f = os.path.join(A.raw, capa + '.geojson')
    if not os.path.exists(f): sys.exit(f'Falta {f}: ejecuta antes pipeline/descargar_ide_menorca.py')
    return json.load(open(f, encoding='utf-8'))['features']
def polys(g):   # Polygon / MultiPolygon → [[anillo exterior, huecos...], ...] sin repetir el primer punto
    if not g: return []
    P = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates'] if g['type'] == 'MultiPolygon' else []
    out = []
    for poly in P:
        rings = []
        for r in poly:
            r = [loc(q[0], q[1]) for q in r]
            if len(r) > 1 and r[0] == r[-1]: r.pop()
            if len(r) >= 3: rings.append(r)
        if rings: out.append(rings)
    return out
def simplify(p, tol=0.25):   # Douglas-Peucker: quita vértices redundantes de la digitalización (error < tol m)
    if len(p) < 3: return p
    a, c = p[0], p[-1]; dx, dz = c[0] - a[0], c[1] - a[1]; L = math.hypot(dx, dz)
    d = [abs(dz * (q[0] - a[0]) - dx * (q[1] - a[1])) / L if L > 1e-9 else math.hypot(q[0] - a[0], q[1] - a[1]) for q in p[1:-1]]
    i = max(range(len(d)), key=d.__getitem__)
    if d[i] <= tol: return [a, c]
    return simplify(p[:i + 2], tol)[:-1] + simplify(p[i + 1:], tol)
def lines(g):
    if not g: return []
    L = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates'] if g['type'] == 'MultiLineString' else []
    return [simplify([loc(q[0], q[1]) for q in l]) for l in L if len(l) > 1]

out, n_in = {}, {}
def poly_layer(key, capa, extra=lambda p: {}):
    res, tot = [], 0
    for f in load(capa):
        for rings in polys(f['geometry']):
            tot += 1; c = cen(rings[0])
            if keep(c): res.append({'r': rings, 'z': inZ(c), **extra(f['properties'])})
    out[key] = res; n_in[key] = (len(res), tot)

poly_layer('aceras', 're007urb_vorera')
poly_layer('escaleras', 're007urb_escala')
TIPO_PORXO = {'Por': 'porche', 'Mq': 'marquesina', 'Marq': 'marquesina'}
poly_layer('porches', 're007urb_porxo', lambda p: {'t': TIPO_PORXO.get(p.get('cadtext'), 'otro')})
out['porches'] = [p for p in out['porches'] if p['t'] != 'otro']

arb, tot = [], 0
for f in load('re007urb_arbres'):
    g = f['geometry']
    if not g or g['type'] != 'Point': continue
    tot += 1; q = loc(*g['coordinates'][:2])
    if keep(q): arb.append([q[0], q[1], inZ(q)])
out['arboles'] = arb; n_in['arboles'] = (len(arb), tot)

TIPO_PARET = {'Mur, Paret o Tàpia (LS)': 'paret', 'Mur de Contenció (LS)': 'contencion', 'Marjada (LS)': 'marjada'}
par, tot = [], 0
for f in load('re007rus_parets5000'):
    t = TIPO_PARET.get(f['properties'].get('dstipus'), 'paret')
    for l in lines(f['geometry']):
        tot += 1
        # partir por la frontera: solo los tramos dentro del municipio
        run = []
        for q in l:
            if keep(q): run.append(q)
            else:
                if len(run) > 1: par.append({'p': run, 't': t, 'z': inZ(cen(run))})
                run = []
        if len(run) > 1: par.append({'p': run, 't': t, 'z': inZ(cen(run))})
out['paredes'] = par; n_in['paredes'] = (len(par), tot)

out['nota'] = ("Capas del IDE Menorca en el marco local de v0.7 (x este, z sur; origen en 'origin'). "
               "Informació geogràfica de l'administració local de Menorca per mitjà del projecte IDE menorca. "
               "http://ide.cime.es (CC BY 4.0). Generado por pipeline/preparar_ide.py.")
out['origin'] = O
os.makedirs(os.path.dirname(A.out), exist_ok=True)
json.dump(out, open(A.out, 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
for k, (a, b) in n_in.items(): print(f'{k}: {a} dentro de Es Castell (de {b} descargados)')
print(f'escrito {A.out} ({os.path.getsize(A.out) / 1e6:.1f} MB)')
