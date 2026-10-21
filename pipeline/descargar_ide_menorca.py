#!/usr/bin/env python3
"""Descarga datos REALES del IDE Menorca (Consell Insular de Menorca) para Es Castell y el relieve de toda la isla.

Uso (desde menorca3d_v2, con conexión a internet; solo usa la biblioteca estándar de Python):
    python pipeline/descargar_ide_menorca.py
    python pipeline/descargar_ide_menorca.py --sin-relieve      # solo las capas vectoriales

Qué descarga (servicios públicos de https://ide.cime.es, GeoServer «base_referencia»):
  - data/raw/ide_menorca/<capa>.geojson   capas vectoriales 1:5.000 de Es Castell, en EPSG:25831 (WFS):
        vorera (aceras), carrer (superficie de calle), escala (escaleras), porxo (porches), constru (construcciones),
        arbres (árboles), jardins, zverda (zonas verdes), piscina, parets5000 (paredes secas), cotes (cotas),
        portals (números de portal), illaurb (manzanas)
  - data/raw/mdt_isla/mde2007_10m.tif     «Model elevacions de Menorca 2007» (MDT 1:5.000 del CIME), toda la isla,
        remuestreado por el servidor a 10 m (WCS). Después: python pipeline/preparar_terreno_isla.py

Licencia de los datos (según el propio servicio): Creative Commons Attribution 4.0 (CC BY 4.0).
Atribución obligatoria: «Informació geogràfica de l'administració local de Menorca per mitjà del projecte IDE menorca.
http://ide.cime.es». Se guarda en data/raw/ide_menorca/LICENCIA.txt.
"""
import argparse, json, os, sys, time, urllib.parse, urllib.request

BASE = 'https://ide.cime.es/geoserver2/base_referencia'
# Rectángulo del municipio de Es Castell + 200 m (EPSG:25831), calculado desde la frontera de municipio.json
BBOX = (607902, 4410839, 612174, 4416205)
CAPAS = ['re007urb_vorera', 're007urb_carrer', 're007urb_escala', 're007urb_porxo', 're007urb_constru', 're007urb_arbres',
         're007urb_jardins', 're007urb_zverda', 're007urb_piscina', 're007rus_parets5000', 're007urb_cotes',
         're007urb_portals', 're007urb_illaurb']
# MDE 2007 de toda Menorca (extensión publicada por el WCS)
ISLA = (567492.5, 4406262.5, 613552.5, 4438802.5)
ATRIB = ("Informació geogràfica de l'administració local de Menorca per mitjà del projecte IDE menorca. http://ide.cime.es\n"
         "Licencia: Creative Commons Attribution 4.0 Internacional (CC BY 4.0) https://creativecommons.org/licenses/by/4.0/\n")

ap = argparse.ArgumentParser()
ap.add_argument('--sin-relieve', action='store_true')
ap.add_argument('--resolucion', type=float, default=10.0, help='resolución del relieve en metros (5 = nativa, ~240 MB)')
A = ap.parse_args()

def get(url, out, intentos=3):
    for k in range(intentos):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'menorca3d-v2 (proyecto personal)'})
            with urllib.request.urlopen(req, timeout=300) as r, open(out + '.part', 'wb') as f:
                while True:
                    b = r.read(1 << 20)
                    if not b: break
                    f.write(b)
            os.replace(out + '.part', out)
            return os.path.getsize(out)
        except Exception as e:
            print(f'   intento {k + 1} fallido: {e}'); time.sleep(3 * (k + 1))
    sys.exit(f'ERROR: no se pudo descargar {url}')

os.makedirs('data/raw/ide_menorca', exist_ok=True)
open('data/raw/ide_menorca/LICENCIA.txt', 'w', encoding='utf-8').write(ATRIB)
for c in CAPAS:
    q = {'SERVICE': 'WFS', 'VERSION': '1.1.0', 'REQUEST': 'GetFeature', 'TYPENAME': 'base_referencia:' + c,
         'SRSNAME': 'EPSG:25831', 'BBOX': ','.join(map(str, BBOX)) + ',EPSG:25831', 'OUTPUTFORMAT': 'application/json'}
    out = f'data/raw/ide_menorca/{c}.geojson'
    n = get(BASE + '/wfs?' + urllib.parse.urlencode(q), out)
    try: nf = len(json.load(open(out, encoding='utf-8'))['features'])
    except Exception: sys.exit(f'ERROR: {out} no es GeoJSON válido (¿ha cambiado el servicio?)')
    print(f'{c}: {nf} elementos, {n / 1e6:.1f} MB')

if not A.sin_relieve:
    os.makedirs('data/raw/mdt_isla', exist_ok=True)
    q = {'SERVICE': 'WCS', 'VERSION': '1.0.0', 'REQUEST': 'GetCoverage', 'COVERAGE': 'base_referencia:MO007MDT_mde2007',
         'CRS': 'EPSG:25831', 'BBOX': ','.join(map(str, ISLA)), 'RESX': A.resolucion, 'RESY': A.resolucion, 'FORMAT': 'GeoTIFF'}
    out = f'data/raw/mdt_isla/mde2007_{A.resolucion:g}m.tif'
    print(f'relieve de Menorca a {A.resolucion:g} m (puede tardar unos minutos)…')
    n = get(BASE + '/wcs?' + urllib.parse.urlencode(q), out)
    if open(out, 'rb').read(4) not in (b'MM\x00*', b'II*\x00'): sys.exit(f'ERROR: {out} no es un GeoTIFF')
    print(f'{out}: {n / 1e6:.1f} MB')
print('Hecho. Datos: © IDE Menorca (CC BY 4.0).')
