#!/usr/bin/env python3
"""Añade a data/processed/zona.json el número de plantas del Catastro (INSPIRE Buildings, BuildingPart).

1. Descarga el conjunto ATOM de edificios del municipio de Es Castell desde el servicio INSPIRE del Catastro
   (https://www.catastro.hacienda.gob.es/webinspire/index.html → ATOM de Buildings → Illes Balears → Es Castell).
2. Descomprime el zip en data/raw/catastro/ (contiene un fichero *.buildingpart.gml).
3. python tools/catastro_alturas.py "data/raw/catastro/*buildingpart*.gml"
   Después vuelve a ejecutar tools/procesar_terreno.py para regenerar zone.json.

Plantas: REAL (Catastro). Altura por planta: ESTIMADA (3 m). Revisa la licencia de uso del Catastro antes de publicar.
"""
import glob, json, math, sys
import xml.etree.ElementTree as ET
import numpy as np
from matplotlib.path import Path

FLOOR = 3.0
SRC = sys.argv[1] if len(sys.argv) > 1 else 'data/raw/catastro/*buildingpart*.gml'
Z = json.load(open('data/processed/zona.json'))
lat0, lon0 = Z['origin']['lat'], Z['origin']['lon']
kx, kz = 111320 * math.cos(math.radians(lat0)), 110540

def utm(lat, lon, lc=3.0):  # ETRS89 → UTM huso 31 (EPSG:25831)
    a = 6378137.0; f = 1 / 298.257222101; e2 = f * (2 - f); ep = e2 / (1 - e2); k0 = .9996
    p = np.radians(lat); l = np.radians(lon - lc); s, c, t = np.sin(p), np.cos(p), np.tan(p)
    N = a / np.sqrt(1 - e2 * s * s); T = t * t; C = ep * c * c; A = c * l
    M = a * ((1 - e2/4 - 3*e2**2/64 - 5*e2**3/256)*p - (3*e2/8 + 3*e2**2/32 + 45*e2**3/1024)*np.sin(2*p) + (15*e2**2/256 + 45*e2**3/1024)*np.sin(4*p) - 35*e2**3/3072*np.sin(6*p))
    E = k0*N*(A + (1-T+C)*A**3/6 + (5-18*T+T*T+72*C-58*ep)*A**5/120) + 5e5
    Nn = k0*(M + N*t*(A*A/2 + (5-T+9*C+4*C*C)*A**4/24 + (61-58*T+T*T+600*C-330*ep)*A**6/720))
    return E, Nn

# Ajuste afín local (x,z) ↔ UTM (E,N); error < 0,1 m en 2 km.
g = np.array([[x, z] for x in (-1500, 0, 1500) for z in (-1500, 0, 1500)], float)
E, N = utm(lat0 - g[:, 1] / kz, lon0 + g[:, 0] / kx)
M = np.c_[np.ones(len(g)), g]
cE, cN = np.linalg.lstsq(M, E, rcond=None)[0], np.linalg.lstsq(M, N, rcond=None)[0]
J = np.array([[cE[1], cE[2]], [cN[1], cN[2]]]); Ji = np.linalg.inv(J)
to_local = lambda e, n: (Ji @ np.array([e - cE[0], n - cN[0]])).T

parts = []
for f in glob.glob(SRC):
    for _, el in ET.iterparse(f):
        if el.tag.endswith('}BuildingPart'):
            fl = next((x.text for x in el.iter() if x.tag.endswith('}numberOfFloorsAboveGround') and x.text), None)
            pl = next((x.text for x in el.iter() if x.tag.endswith('}posList') and x.text), None)
            if fl and pl:
                v = np.array(pl.split(), float).reshape(-1, 2)
                loc = to_local(v[:, 0], v[:, 1])
                parts.append((int(fl), loc.mean(axis=0), Path(loc)))
            el.clear()
print('partes del Catastro leídas:', len(parts))
if not parts: sys.exit('No se encontraron BuildingPart con plantas. ¿Ruta correcta al *.buildingpart.gml?')

done = 0
for b in Z['buildings']:
    path = Path(b['p'])
    fl = [p[0] for p in parts if p[0] > 0 and path.contains_point(p[1])]
    if fl:
        b['h'] = max(fl) * FLOOR; b['hs'] = 'catastro'; done += 1
    else:
        b.setdefault('hs', 'estimado')
json.dump(Z, open('data/processed/zona.json', 'w'), ensure_ascii=True, separators=(',', ':'))
print(f'Alturas del Catastro aplicadas a {done} de {len(Z["buildings"])} edificios. Ahora ejecuta tools/procesar_terreno.py')
