#!/usr/bin/env python3
"""Genera aceras ESTIMADAS a ambos lados de las calles urbanas (casco de Es Castell y urbanizaciones como
Santa Anna y Sol del Este, donde las fotos propias muestran acera de losa en casi todas las calles) si OSM no las tiene.
Cada tramo se ajusta al espacio real entre la calzada y las fachadas (Catastro/OSM): ancho máx. 1,8 m,
se omite si caben menos de 0,8 m y se corta en los cruces. Ejecutar después de catastro_volumenes.py
y antes de procesar_terreno.py.   Uso: python tools/aceras_estimadas.py
"""
import json, math
from collections import defaultdict

CX, CZ, R = -150, -380, 330          # casco de Es Castell (ESTIMADO; mismo círculo que la zona del HUD)
TYPES = {'residential', 'tertiary', 'secondary', 'primary', 'unclassified'}
MAXW, MINW, G = 1.8, 0.8, 10.0
Z = json.load(open('data/processed/zona.json'))

def densify(p, step):
    o = [p[0]]
    for a, b in zip(p, p[1:]):
        n = max(1, math.ceil(math.hypot(b[0]-a[0], b[1]-a[1]) / step))
        o += [[a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n] for k in range(1, n+1)]
    return o

def cells_of(a, b, r=0):
    for gx in range(int((min(a[0], b[0])-r)//G), int((max(a[0], b[0])+r)//G)+1):
        for gz in range(int((min(a[1], b[1])-r)//G), int((max(a[1], b[1])+r)//G)+1):
            yield gx, gz

edges = defaultdict(list)                 # lados de fachada
for b in Z['buildings']:
    for a, c in zip(b['p'], b['p'][1:]):
        for k in cells_of(a, c): edges[k].append((a, c))
for w in Z.get('walls', []):            # tapias y muros de parcela también limitan la acera
    for a, c in zip(w['p'], w['p'][1:]):
        for k in cells_of(a, c): edges[k].append((a, c))
nearb = set()                           # celdas con edificios (zona urbana)
for b in Z['buildings']:
    for x, z in b['p']: nearb.add((int(x // 40), int(z // 40)))
def urban(x, z):
    gx, gz = int(x // 40), int(z // 40)
    return any((gx + i, gz + j) in nearb for i in (-1, 0, 1) for j in (-1, 0, 1))
roads = defaultdict(list)                 # ejes de calle, para detectar cruces
for i, r in enumerate(Z['roads']):
    for a, c in zip(r['p'], r['p'][1:]):
        for k in cells_of(a, c, r['w']/2+1): roads[k].append((a, c, r['w']/2+1, i))

def facade_dist(o, d, maxd=9.0):
    best, seen = maxd, set()
    for t in range(0, int(maxd)+3, 2):
        k = (int((o[0]+d[0]*t)//G), int((o[1]+d[1]*t)//G))
        if k in seen: continue
        seen.add(k)
        for a, b in edges.get(k, ()):
            ex, ez = b[0]-a[0], b[1]-a[1]; den = d[0]*ez - d[1]*ex
            if abs(den) < 1e-9: continue
            wx, wz = a[0]-o[0], a[1]-o[1]
            t_, u = (wx*ez - wz*ex)/den, (wx*d[1] - wz*d[0])/den
            if 0 <= u <= 1 and 0 < t_ < best: best = t_
    return best

def seg_dist(x, z, a, b):
    dx, dz = b[0]-a[0], b[1]-a[1]; L = dx*dx + dz*dz or 1e-9
    t = max(0, min(1, ((x-a[0])*dx + (z-a[1])*dz)/L))
    return math.hypot(a[0]+t*dx-x, a[1]+t*dz-z)

def crossing(x, z, ri):
    return any(i != ri and seg_dist(x, z, a, b) < r for a, b, r, i in roads.get((int(x//G), int(z//G)), ()))

walks = []
for ri, r in enumerate(Z['roads']):
    if r.get('t') not in TYPES or r.get('sw') or r.get('fw'): continue
    p, hw = densify(r['p'], 3), r['w']/2
    for side in (1, -1):
        run, ws = [], []
        def flush():
            if len(run) >= 3: walks.append({'p': [[round(x, 2), round(z, 2)] for x, z in run], 'w': round(min(ws), 2), 'e': 1})
            run.clear(); ws.clear()
        for i, q in enumerate(p):
            a, b = p[max(0, i-1)], p[min(len(p)-1, i+1)]
            dx, dz = b[0]-a[0], b[1]-a[1]; l = math.hypot(dx, dz) or 1
            n = (-dz/l*side, dx/l*side)
            sw = min(MAXW, facade_dist(q, n) - hw - .1)
            c = (q[0]+n[0]*(hw+sw/2), q[1]+n[1]*(hw+sw/2))
            if (math.hypot(q[0]-CX, q[1]-CZ) < R or urban(q[0], q[1])) and sw >= MINW and not crossing(c[0], c[1], ri):
                run.append(c); ws.append(sw)
            else: flush()
        flush()
Z['walks'] = walks
json.dump(Z, open('data/processed/zona.json', 'w'), ensure_ascii=True, separators=(',', ':'))
L = sum(math.hypot(b[0]-a[0], b[1]-a[1]) for w in walks for a, b in zip(w['p'], w['p'][1:]))
print(f'aceras estimadas: {len(walks)} tramos, {L/1000:.1f} km')
