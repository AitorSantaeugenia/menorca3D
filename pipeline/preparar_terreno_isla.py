#!/usr/bin/env python3
"""Relieve REAL de toda Menorca para el visor: mosaico de hojas MDT del CNIG/IGN en una malla regular EPSG:25831.

Uso (desde menorca3d_v2):
    python pipeline/preparar_terreno_isla.py                      # lee data/raw/mdt_isla/*.tif y *.asc
    python pipeline/preparar_terreno_isla.py "otra/carpeta/*.tif" --paso 25

Entradas: hojas MDT del Centro de Descargas del CNIG (MDT05, MDT25, MDT200 o el MDT de 50 cm) en ETRS89 / UTM 31N,
en GeoTIFF (.tif) o ESRI ASCII (.asc). Se pueden mezclar resoluciones: donde se solapan, gana la más fina.
Salida: cesium/data/isla.js (alturas ortométricas en decímetros, Int16). El visor la usa fuera de Es Castell, donde
antes el relieve era plano (PLACEHOLDER). Mar y huecos sin dato: 0 m.

Dependencias: numpy y Pillow (las mismas de v0.7). Si Pillow no abre algún GeoTIFF, se intenta con tifffile.
También lee el GeoTIFF del IDE Menorca (pipeline/descargar_ide_menorca.py: data/raw/mdt_isla/mde2007_10m.tif).
Atribución: «MDT © Instituto Geográfico Nacional» (CC BY 4.0 scne.es) o, para el MDE 2007, la del IDE Menorca
(se guarda en isla.js → 'credito' y el visor la muestra).
"""
import argparse, base64, glob, json, math, os, sys
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('entrada', nargs='?', default='data/raw/mdt_isla/*')
ap.add_argument('--paso', type=float, default=40.0, help='tamaño de celda de la malla, en metros (40 por defecto)')
ap.add_argument('--out', default='cesium/data/isla.js')
ap.add_argument('--costa', default='v0.7/public/data/menorca/es-castell/municipio.json',
                help="línea de costa (OSM) para recortar el mar: municipio.json de v0.7 (campo 'island'); '' = sin recorte")
# Rectángulo de Menorca en EPSG:25831 (con margen de mar). Comprobado con pipeline/coords.py: lon 3,79–4,33, lat 39,80–40,10.
ap.add_argument('--bbox', default='565000,4404000,616000,4442000', help='E0,N0,E1,N1')
A = ap.parse_args()
E0, N0, E1, N1 = map(float, A.bbox.split(','))
ST = A.paso
cols, rows = int((E1 - E0) // ST) + 1, int((N1 - N0) // ST) + 1
H = np.full((rows, cols), np.nan, np.float32)       # fila 0 = norte (N1)
RES = np.full((rows, cols), np.inf, np.float32)     # resolución de la fuente que ha escrito cada celda

def read_tif_raw(f):
    """Lector mínimo de TIFF SIN comprimir (tiras o teselas, II o MM, enteros o float), solo numpy.
    Es el formato que sirve el WCS del IDE Menorca (float32 big-endian en teselas). Devuelve (array, {tag: valores})."""
    import struct
    b = open(f, 'rb').read()
    bo = {b'II': '<', b'MM': '>'}[b[:2]]
    if struct.unpack(bo + 'H', b[2:4])[0] != 42: raise ValueError('no es TIFF clásico (¿BigTIFF?)')
    off = struct.unpack(bo + 'I', b[4:8])[0]
    n = struct.unpack(bo + 'H', b[off:off + 2])[0]
    SZ = {1: ('B', 1), 2: ('s', 1), 3: ('H', 2), 4: ('I', 4), 11: ('f', 4), 12: ('d', 8), 16: ('Q', 8)}
    tags = {}
    for k in range(n):
        e = off + 2 + 12 * k
        tag, typ, cnt = struct.unpack(bo + 'HHI', b[e:e + 8])
        if typ not in SZ: continue
        ch, sz = SZ[typ]
        p = e + 8 if sz * cnt <= 4 else struct.unpack(bo + 'I', b[e + 8:e + 12])[0]
        raw = b[p:p + sz * cnt]
        tags[tag] = raw.rstrip(b'\0').decode('latin1') if typ == 2 else list(struct.unpack(bo + ch * cnt, raw))
    g = lambda t, d=None: tags.get(t, [d])[0] if isinstance(tags.get(t, [d]), list) else tags.get(t)
    if g(259, 1) != 1: raise ValueError('TIFF comprimido: instala tifffile (pip install tifffile)')
    if g(277, 1) != 1: raise ValueError('más de una banda')
    W, Hh, bits, fmt = g(256), g(257), g(258, 8), g(339, 1)
    dt = np.dtype(bo + {(3, 32): 'f4', (3, 64): 'f8', (1, 8): 'u1', (1, 16): 'u2', (1, 32): 'u4',
                        (2, 8): 'i1', (2, 16): 'i2', (2, 32): 'i4'}[(fmt, bits)])
    a = np.empty((Hh, W), dt)
    if 322 in tags:                                       # teselas
        tw, th = g(322), g(323)
        offs, nx = tags[324], -(-W // tw)
        for t, o in enumerate(offs):
            ty, tx = divmod(t, nx)
            blk = np.frombuffer(b, dt, tw * th, o).reshape(th, tw)
            h_, w_ = min(th, Hh - ty * th), min(tw, W - tx * tw)
            a[ty * th:ty * th + h_, tx * tw:tx * tw + w_] = blk[:h_, :w_]
    else:                                                 # tiras
        rps, row = g(278, Hh), 0
        for o in tags[273]:
            r = min(rps, Hh - row)
            a[row:row + r] = np.frombuffer(b, dt, r * W, o).reshape(r, W); row += r
    return a.astype(np.float32), tags

def read_tif(f):
    """Devuelve (alturas, x_centro_col0, y_centro_fila0, tamaño_px, nodata).
    Georreferencia: ModelPixelScale + ModelTiepoint (CNIG/IGN) o ModelTransformation (WCS del IDE Menorca)."""
    try:
        a, t = read_tif_raw(f)
        g = lambda n: t.get(n)
    except Exception as e0:
        try:
            from PIL import Image
            Image.MAX_IMAGE_PIXELS = None
            im = Image.open(f); tv = im.tag_v2
            a = np.array(im, dtype=np.float32); g = tv.get
        except Exception:
            import tifffile                               # alternativa para TIFF comprimidos
            with tifffile.TiffFile(f) as tf:
                p = tf.pages[0]
                a = p.asarray().astype(np.float32)
                g = lambda n, P=p: P.tags[n].value if n in P.tags else None
    scale, tie, mtx, geokeys, nod = g(33550), g(33922), g(34264), g(34735), g(42113)
    if isinstance(nod, (list, tuple)): nod = nod[0]
    if isinstance(nod, str): nod = nod.strip('\0 ')
    if scale and tie:
        px, py = float(scale[0]), float(scale[1])
        i, j, X, Y = tie[0], tie[1], tie[3], tie[4]
    elif mtx and len(mtx) >= 8:
        if abs(mtx[1]) > 1e-9 or abs(mtx[4]) > 1e-9: raise ValueError('ráster girado')
        px, py, i, j, X, Y = float(mtx[0]), -float(mtx[5]), 0, 0, float(mtx[3]), float(mtx[7])
    else: raise ValueError('sin georreferencia GeoTIFF')
    if abs(px - py) > 1e-6: raise ValueError('píxel no cuadrado')
    # GTRasterTypeGeoKey (1025): 1 = PixelIsArea (el punto de anclaje es la esquina del píxel), 2 = PixelIsPoint (el centro)
    raster_type = 1
    if geokeys:
        gk = list(geokeys)
        for k in range(4, len(gk), 4):
            if gk[k] == 1025: raster_type = gk[k + 3]
    x0 = X - i * px + (px / 2 if raster_type == 1 else 0)
    y0 = Y + j * py - (py / 2 if raster_type == 1 else 0)
    return a, x0, y0, px, float(nod) if nod not in (None, '') else None

def read_asc(f):
    head = {}
    with open(f) as fh:
        for _ in range(6):
            k, v = fh.readline().split(); head[k.lower()] = float(v)
    a = np.loadtxt(f, skiprows=6, dtype=np.float32)
    c = head['cellsize']
    x0 = head['xllcenter'] if 'xllcenter' in head else head['xllcorner'] + c / 2
    yll = head['yllcenter'] if 'yllcenter' in head else head['yllcorner'] + c / 2
    return a, x0, yll + (a.shape[0] - 1) * c, c, head.get('nodata_value')

files = sorted(f for f in glob.glob(A.entrada) if f.lower().endswith(('.tif', '.tiff', '.asc')))
if not files: sys.exit(f'No hay hojas MDT en {A.entrada!r}. Ejecuta antes pipeline/descargar_ide_menorca.py (o descarga hojas del CNIG, ver README).')
# Primero las de peor resolución: las finas escriben encima
srcs = []
for f in files:
    try:
        a, x0, y0, px, nod = (read_asc if f.lower().endswith('.asc') else read_tif)(f)
    except Exception as e:
        print(f'AVISO: {os.path.basename(f)} no se puede leer ({e}); se omite'); continue
    srcs.append((px, f, a, x0, y0, nod))
srcs.sort(key=lambda s: -s[0])
for px, f, a, x0, y0, nod in srcs:
    a = a.astype(np.float32)
    bad = ~np.isfinite(a) | (a < -1000) | ((a == nod) if nod is not None else False)
    a[bad] = np.nan
    # Reducir por media de bloques hasta ~el paso de la malla (evita ruido al muestrear una hoja de 50 cm cada 40 m)
    k = max(1, int(round(ST / px)))
    if k > 1:
        r, c = a.shape[0] // k * k, a.shape[1] // k * k
        a = np.nanmean(a[:r, :c].reshape(r // k, k, c // k, k), axis=(1, 3)) if r and c else a
        x0, y0, px = x0 + (k - 1) * px / 2, y0 - (k - 1) * px / 2, px * k
    # Celdas de la malla que caen dentro de la hoja: vecino más cercano
    E = E0 + np.arange(cols) * ST; N = N1 - np.arange(rows) * ST
    ci = np.round((E - x0) / px).astype(int); ri = np.round((y0 - N) / px).astype(int)
    okc, okr = (ci >= 0) & (ci < a.shape[1]), (ri >= 0) & (ri < a.shape[0])
    if not okc.any() or not okr.any(): print(f'AVISO: {os.path.basename(f)} cae fuera de Menorca; se omite'); continue
    sub = a[np.ix_(ri[okr], ci[okc])]
    tgt = np.ix_(np.where(okr)[0], np.where(okc)[0])
    better = np.isfinite(sub) & (RES[tgt] >= px)
    H[tgt] = np.where(better, sub, H[tgt]); RES[tgt] = np.where(better, px, RES[tgt])
    print(f'{os.path.basename(f)}: {px:g} m/píxel tras reducir, {int(better.sum())} celdas')

# Recorte por la línea de costa (OSM): el MDE 2007 del IDE trae triángulos sueltos sobre el mar (restos de la
# triangulación, a 0–3 m), que en el visor asomaban como manchas y franjas sobre el agua. Fuera de tierra: mar (0 m).
if A.costa and os.path.exists(A.costa):
    from matplotlib.path import Path
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from coords import v07_local_to_lonlat, lonlat_to_utm
    M = json.load(open(A.costa, encoding='utf-8'))
    rings = [Path([lonlat_to_utm(*v07_local_to_lonlat(x, z, M['origin'])) for x, z in r]) for r in M['island'] if len(r) > 2]
    EE, NN = np.meshgrid(E0 + np.arange(cols) * ST, N1 - np.arange(rows) * ST)
    pts = np.column_stack([EE.ravel(), NN.ravel()]); land = np.zeros(len(pts), bool)
    for r in rings:
        bb = r.get_extents(); m = (pts[:, 0] >= bb.x0) & (pts[:, 0] <= bb.x1) & (pts[:, 1] >= bb.y0) & (pts[:, 1] <= bb.y1)
        land[m] |= r.contains_points(pts[m])
    land = land.reshape(rows, cols)
    print(f'costa: {len(rings)} anillos · {int((np.isfinite(H) & ~land & (np.nan_to_num(H) > 0)).sum())} celdas sobre el mar puestas a 0 m')
    H[~land] = np.nan
cover = np.isfinite(H).mean()
Hq = np.clip(np.nan_to_num(H, nan=0.0), -100, 3000)
Hq = np.round(Hq * 10).astype('<i2')
ide = any(os.path.basename(s[1]).lower().startswith('mde2007') for s in srcs)
ign = any(not os.path.basename(s[1]).lower().startswith('mde2007') for s in srcs)
credito = ' · '.join((["Relieve: MDE 2007 © IDE Menorca (CC BY 4.0). Informació geogràfica de l'administració local de Menorca "
                       "per mitjà del projecte IDE menorca. http://ide.cime.es"] if ide else []) +
                     (['Relieve: MDT © Instituto Geográfico Nacional (CC BY 4.0 scne.es)'] if ign else []))
out = {'nota': 'Relieve de Menorca. Alturas ortométricas en dm. Malla EPSG:25831, fila 0 = norte. '
               'Generado por pipeline/preparar_terreno_isla.py.', 'credito': credito,
       'crs': 'EPSG:25831', 'x0': E0, 'y0': N1, 'step': ST, 'cols': cols, 'rows': rows,
       'fuentes': [os.path.basename(s[1]) for s in srcs], 'h': base64.b64encode(Hq.tobytes()).decode()}
os.makedirs(os.path.dirname(A.out), exist_ok=True)
with open(A.out, 'w', encoding='utf-8') as fh:
    fh.write('// Generado por pipeline/preparar_terreno_isla.py: no editar a mano.\nwindow.MENORCA_ISLA = ')
    json.dump(out, fh, separators=(',', ':')); fh.write(';\n')
print(f'malla {cols} × {rows} a {ST:g} m · con dato: {cover * 100:.1f} % · altura máx. {np.nanmax(H) if cover else 0:.0f} m · '
      f'escrito {A.out} ({os.path.getsize(A.out) / 1e6:.1f} MB)')
