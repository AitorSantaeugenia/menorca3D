#!/usr/bin/env python3
"""Descarga de OpenStreetMap los FAROS y luces de navegación de TODA MENORCA (incluida la bocana del puerto de Maó).

Guarda data/raw/faros.json con posición y etiquetas náuticas REALES (seamark:light:*): color, ritmo
(«Fl(2)», «Oc», «Q»…), periodo, alcance y altura. Después: python tools/preparar_municipio.py

Uso:  python tools/extraer_faros.py [--bbox 39.78,3.78,40.10,4.35] [--insecure]
Datos © colaboradores de OpenStreetMap (ODbL).
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extraer_es_castell import query

ap = argparse.ArgumentParser()
ap.add_argument('--bbox', default='39.78,3.78,40.10,4.35', help='sur,oeste,norte,este (por defecto, toda Menorca)')
ap.add_argument('--out', default='data/raw/faros.json')
ap.add_argument('--insecure', action='store_true', help='no verificar certificados SSL')
a = ap.parse_args()
s, w, n, e = a.bbox.split(',')
sel = f'({s},{w},{n},{e})'
q = (f'[out:json][timeout:90];('
     f'nwr["man_made"="lighthouse"]{sel};'
     f'nwr["seamark:type"~"^light"]{sel};'
     f'nwr["seamark:light:character"]{sel};'
     f'nwr["seamark:light:1:character"]{sel};'
     f');out center tags;')
els = query(q, a.insecure)['elements']
out = []
for el in els:
    t = el.get('tags', {})
    lat, lon = (el['lat'], el['lon']) if 'lat' in el else (el['center']['lat'], el['center']['lon'])
    major = t.get('man_made') == 'lighthouse' or t.get('seamark:type') == 'light_major'
    out.append({'id': f"{el['type']}/{el['id']}", 'name': t.get('name') or t.get('seamark:name') or '',
                'lat': lat, 'lon': lon, 'kind': 'faro' if major else 'luz',
                'tags': {k: v for k, v in t.items() if k.startswith('seamark') or k in ('man_made', 'name', 'height', 'start_date', 'operator')}})
os.makedirs(os.path.dirname(a.out), exist_ok=True)
json.dump(out, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for f in out:
    tg = f['tags']
    print(f"  {f['kind']:4} {f['name'] or '(sin nombre)':35} {tg.get('seamark:light:character', tg.get('seamark:light:1:character', '-')):8} "
          f"{tg.get('seamark:light:colour', tg.get('seamark:light:1:colour', '')):8} periodo {tg.get('seamark:light:period', '?')} s")
print(f'{len(out)} faros/luces → {a.out}. Ahora: python tools/preparar_municipio.py')
