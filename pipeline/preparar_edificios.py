#!/usr/bin/env python3
"""Estados de los edificios (pendiente / acabado) para el mapa grande del visor: cesium/data/edificios.js.

Fuente: v0.7/public/data/menorca/es-castell/santa-anna/edificios.json (números estables y estado de cada parcela,
el mismo archivo que usa el mapa de v0.7). Si exportas desde el mapa del visor (botón Exportar), puedes pasar ese
archivo: python pipeline/preparar_edificios.py ruta/edificios.json
Solo se guardan los que NO están pendientes (el resto se dan por pendientes).
"""
import json, sys
src = sys.argv[1] if len(sys.argv) > 1 else 'v0.7/public/data/menorca/es-castell/santa-anna/edificios.json'
E = json.load(open(src, encoding='utf-8'))['edificios']
est = {e['ref']: e['estado'] for e in E if e.get('estado', 'pendiente') != 'pendiente' and not e.get('baja')}
out = 'cesium/data/edificios.js'
with open(out, 'w', encoding='utf-8') as f:
    f.write('// Generado por pipeline/preparar_edificios.py: no editar a mano. Estado de cada parcela (si no aparece: pendiente).\n')
    f.write('window.MENORCA_ESTADOS = ' + json.dumps(est, separators=(',', ':')) + ';\n')
print(f'{len(E)} edificios en {src}; {len(est)} no pendientes → {out}')
