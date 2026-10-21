#!/usr/bin/env python3
"""Asigna un NÚMERO ESTABLE a cada edificio de la zona y guarda su estado de modelado.

Un «edificio» es una parcela catastral (referencia de 14 caracteres, REAL del Catastro): todas sus piezas
(BuildingPart) comparten número. Los edificios de OSM sin Catastro reciben una clave «osm-x_z» (centro redondeado).

Los números NUNCA se reasignan: si el archivo ya existe, se conservan los números y estados que tenga
y solo se añaden al final los edificios nuevos. Así «edificio nº 123» siempre es el mismo.

Uso: python tools/numerar_edificios.py [public/data/menorca/es-castell/santa-anna]
Lee zone.json de esa carpeta y crea/actualiza edificios.json en la misma carpeta.
Estados: "pendiente" (rojo en el mapa) · "acabado" (verde).
"""
import json, os, sys

DIR = sys.argv[1] if len(sys.argv) > 1 else 'public/data/menorca/es-castell/santa-anna'
ZONE, OUT = os.path.join(DIR, 'zone.json'), os.path.join(DIR, 'edificios.json')
if not os.path.exists(ZONE): sys.exit(f'No encuentro {ZONE}. Ejecuta antes el resto del pipeline (ver README).')


def key(b):
    if b.get('ref'): return b['ref']
    p = b['p'][:-1] if b['p'][0] == b['p'][-1] else b['p']
    return 'osm-%d_%d' % (round(sum(q[0] for q in p) / len(p)), round(sum(q[1] for q in p) / len(p)))


zone = json.load(open(ZONE, encoding='utf-8'))
keys = sorted({key(b) for b in zone['buildings']}, key=lambda k: (k.startswith('osm-'), k))   # Catastro primero, por referencia
old = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {'edificios': []}
lista = old['edificios']
known = {e['ref'] for e in lista}
nuevos = [k for k in keys if k not in known]
n = max((e['n'] for e in lista), default=0)
for k in nuevos:
    n += 1
    lista.append({'n': n, 'ref': k, 'estado': 'pendiente'})
vivos = set(keys)
for e in lista:
    if e['ref'] not in vivos: e['baja'] = True          # ya no está en la zona: se conserva el número, no se reutiliza
    else: e.pop('baja', None)

out = {'nota': 'Números estables de edificio (parcela catastral). Estado: pendiente | acabado. '
               'Se edita desde el mapa grande del juego (doble clic en el minimapa) o a mano.',
       'edificios': lista}
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('{\n"nota": ' + json.dumps(out['nota'], ensure_ascii=False) + ',\n"edificios": [\n')
    f.write(',\n'.join(json.dumps(e, ensure_ascii=False, separators=(',', ':')) for e in lista))   # una línea por edificio: fácil de leer y comparar
    f.write('\n]\n}\n')
cat = sum(1 for k in keys if not k.startswith('osm-'))
print(f'{len(keys)} edificios en la zona ({cat} catastrales, {len(keys) - cat} de OSM); {len(nuevos)} nuevos numerados; '
      f'{sum(1 for e in lista if e.get("estado") == "acabado")} acabados → {OUT}')
