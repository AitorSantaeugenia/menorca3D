#!/usr/bin/env python3
"""Descarga la línea de costa de Menorca (OSM, ODbL) y guarda public/data/menorca/outline.json
como lista de polilíneas [lon, lat] simplificadas, para el mapa de entrada. Uso: python tools/extraer_contorno_menorca.py [--insecure]"""
import json, os, ssl, sys, urllib.parse, urllib.request
Q = '[out:json][timeout:180];way["natural"="coastline"](39.78,3.77,40.10,4.34);out geom;'
ctx = ssl._create_unverified_context() if '--insecure' in sys.argv else None
req = urllib.request.Request('https://overpass-api.de/api/interpreter', data=urllib.parse.urlencode({'data': Q}).encode(), headers={'User-Agent': 'menorca3d/0.1'})
with urllib.request.urlopen(req, timeout=200, context=ctx) as r: els = json.load(r)['elements']
lines = [[[round(g['lon'], 4), round(g['lat'], 4)] for g in e['geometry'][::3] + [e['geometry'][-1]]] for e in els if e.get('geometry')]
os.makedirs('public/data/menorca', exist_ok=True)
json.dump(lines, open('public/data/menorca/outline.json', 'w'), separators=(',', ':'))
print(len(lines), 'tramos de costa guardados')
