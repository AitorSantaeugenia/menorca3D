#!/usr/bin/env python3
"""
Descarga de OpenStreetMap (Overpass API) la zona de Es Castell
(incluye Santa Anna y Sol del Este si OSM las tiene dentro del municipio)
y genera world.json en metros locales para el juego 3D.

Uso:
    python extraer_es_castell.py
    python extraer_es_castell.py --bbox 39.860,4.270,39.890,4.310   # sur,oeste,norte,este
    python extraer_es_castell.py --tif MDT.tif                      # elevación opcional

Solo usa la librería estándar. Para --tif hacen falta: pip install rasterio pyproj
Datos © colaboradores de OpenStreetMap (ODbL). Hay que mostrar la atribución en el juego.
"""
import argparse, json, math, re, ssl, sys, urllib.error, urllib.parse, urllib.request

OVERPASS = ["https://overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter"]
# Rectángulo (sur, oeste, norte, este) que cubre el municipio de Es Castell, con
# margen de mar. Ajústalo con --bbox si ves que falta o sobra terreno.
DEFAULT_BBOX = (39.850, 4.265, 39.890, 4.310)

# Colores por categoría (paleta estilo mapa estándar). OSM no guarda texturas de
# fachada; solo usamos building:colour cuando está etiquetado.
AREA_COLORS = {
    "water": "#aad3df", "sea": "#aad3df", "beach": "#f5e9c6", "sand": "#f5e9c6",
    "wood": "#add19e", "scrub": "#c8d7ab", "grassland": "#cdebb0", "grass": "#cdebb0",
    "park": "#c8facc", "garden": "#cdebb0", "pitch": "#aae0cb", "residential": "#e0dfdf",
    "commercial": "#f2dad9", "industrial": "#ebdbe8", "farmland": "#eef0d5",
    "rock": "#cfcfc4", "bare_rock": "#cfcfc4", "cliff": "#a9a9a0", "military": "#e5c9c9",
}
ROAD_COLORS = {"footway": "#f08080", "path": "#f08080", "pedestrian": "#dddde8",
               "residential": "#ffffff", "service": "#ffffff", "primary": "#e892a2",
               "secondary": "#f7d28b", "tertiary": "#fefeb2", "track": "#c0a060"}
ROAD_WIDTH = {"primary": 9, "secondary": 8, "tertiary": 7, "residential": 6,
              "service": 4, "pedestrian": 5, "footway": 2, "path": 1.5, "track": 3}
DEFAULT_BUILDING = "#f4f1e8"
WALL_TYPES = {"wall", "city_wall", "retaining_wall", "fence", "hedge", "guard_rail", "kerb"}  # cal blanca, típica de Menorca

def ssl_context(insecure):
    if insecure:
        return ssl._create_unverified_context()
    try:  # paquete certifi: certificados actualizados (pip install certifi)
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return None

def query(q, insecure=False):
    data = urllib.parse.urlencode({"data": q}).encode()
    last = ""
    for url in OVERPASS:
        req = urllib.request.Request(url, data=data, headers={"User-Agent": "menorca3d/0.1"})
        print("Servidor:", url)
        try:
            with urllib.request.urlopen(req, timeout=180, context=ssl_context(insecure)) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            last = f"error HTTP {e.code}"
        except urllib.error.URLError as e:
            last = str(e)
        print("  Falló:", last)
    if "CERTIFICATE" in last:
        sys.exit("\nError de certificados SSL en todos los servidores.\n"
                 "1) Comprueba que la fecha y hora de Windows son correctas.\n"
                 "2) Prueba: pip install certifi\n"
                 "3) Si sigue igual: python extraer_es_castell.py --insecure")
    sys.exit("\nNo se pudo descargar. Reintenta en unos minutos.")

def build_query(bbox):
    if bbox:
        s, w, n, e = bbox
        sel = f"({s},{w},{n},{e})"
        head = ""
    else:
        sel = "(area.a)"
        head = 'area["name"="Es Castell"]["boundary"="administrative"]->.a;'
    body = "".join(f'{t}{f}{sel};' for t in ("way", "node") for f in (
        ['["amenity"="pharmacy"]', '["shop"="supermarket"]', '["name"~"Espl?anada",i]',
         '["shop"]["name"]', '["amenity"]["name"]'])) + "".join(
        f'way{f}{sel};' for f in ('["building"]', '["highway"]', '["landuse"]',
                                  '["natural"]', '["leisure"]', '["waterway"]', '["barrier"]'))
    return f"[out:json][timeout:180];{head}({body});out geom;"

def to_css(c):
    return c if c and re.match(r"^#[0-9a-fA-F]{3,8}$", c) else (c or None)

def poi_kind(tags):
    n = tags.get("name", "")
    if tags.get("amenity") == "pharmacy": return "farmacia"
    if tags.get("shop") == "supermarket": return "supermercado"
    if "esplanada" in n.lower() or "explanada" in n.lower(): return "explanada"
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bbox"); ap.add_argument("--tif"); ap.add_argument("--out", default="world.json")
    ap.add_argument("--insecure", action="store_true", help="no verificar certificados SSL")
    a = ap.parse_args()
    bbox = tuple(map(float, a.bbox.split(","))) if a.bbox else DEFAULT_BBOX
    print("Descargando de Overpass...")
    els = query(build_query(bbox), a.insecure)["elements"]
    print(len(els), "elementos")
    if not els:
        sys.exit("Overpass no devolvió datos (puede estar saturado o el rectángulo es incorrecto).\n"
                 "Espera un par de minutos y repite, o prueba otro --bbox sur,oeste,norte,este")

    lats, lons = [], []
    for e in els:
        for g in e.get("geometry", []) or []: lats.append(g["lat"]); lons.append(g["lon"])
        if e["type"] == "node": lats.append(e["lat"]); lons.append(e["lon"])
    lat0, lon0 = (min(lats) + max(lats)) / 2, (min(lons) + max(lons)) / 2
    kx, kz = 111320 * math.cos(math.radians(lat0)), 110540
    P = lambda lat, lon: [round((lon - lon0) * kx, 1), round(-(lat - lat0) * kz, 1)]  # norte = -z

    out = {"origin": {"lat": lat0, "lon": lon0}, "buildings": [], "roads": [], "areas": [], "walls": [],
           "pois": [], "attribution": "© OpenStreetMap contributors"}
    seen = set()
    for e in els:
        t = e.get("tags", {})
        pts = [P(g["lat"], g["lon"]) for g in e.get("geometry", [])] if e["type"] == "way" else None
        pos = P(e["lat"], e["lon"]) if e["type"] == "node" else (
            [round(sum(p[0] for p in pts) / len(pts), 1), round(sum(p[1] for p in pts) / len(pts), 1)] if pts else None)
        kind = poi_kind(t)
        if (kind or (t.get("name") and (t.get("shop") or t.get("amenity")))) and pos:
            key = (t.get("name"), tuple(pos))
            if key not in seen:
                seen.add(key)
                out["pois"].append({"name": t.get("name", kind), "kind": kind or t.get("shop") or t.get("amenity"),
                                    "important": bool(kind), "x": pos[0], "z": pos[1]})
        if e["type"] != "way" or not pts: continue
        if "building" in t:
            h = float(re.sub(r"[^0-9.]", "", t.get("height", "")) or 0) or \
                float(t.get("building:levels", 2)) * 3
            out["buildings"].append({"pts": pts, "h": round(h, 1),
                                     "color": to_css(t.get("building:colour")) or DEFAULT_BUILDING,
                                     "roof": to_css(t.get("roof:colour")), "roof_shape": t.get("roof:shape"), "name": t.get("name")})
        elif t.get("barrier") in WALL_TYPES:
            hh = re.sub(r"[^0-9.]", "", t.get("height", ""))
            out["walls"].append({"pts": pts, "type": t["barrier"], "h": float(hh) if hh else None,
                                 "material": t.get("wall") or t.get("material")})
        elif "highway" in t:
            k = t["highway"]
            out["roads"].append({"pts": pts, "type": k, "w": ROAD_WIDTH.get(k, 4),
                                 "color": ROAD_COLORS.get(k, "#ffffff"), "name": t.get("name"),
                                 "sidewalk": t.get("sidewalk") or t.get("sidewalk:both"), "footway": t.get("footway")})
        else:
            k = next((t[x] for x in ("natural", "landuse", "leisure", "waterway") if x in t), None)
            if k: out["areas"].append({"pts": pts, "kind": k, "color": AREA_COLORS.get(k, "#e8e8e8")})

    if a.tif:  # malla de alturas cada 10 m (MDT del IGN/CNIG, p. ej. MDT02/MDT05)
        import rasterio
        from pyproj import Transformer
        ds = rasterio.open(a.tif)
        tr = Transformer.from_crs("EPSG:4326", ds.crs, always_xy=True)
        xs = [p[0] for k in ("buildings", "roads", "areas") for o in out[k] for p in o["pts"]]
        zs = [p[1] for k in ("buildings", "roads", "areas") for o in out[k] for p in o["pts"]]
        x0, x1, z0, z1, step = min(xs), max(xs), min(zs), max(zs), 10
        cols, rows = int((x1 - x0) / step) + 1, int((z1 - z0) / step) + 1
        coords = [tr.transform(lon0 + (x0 + i * step) / kx, lat0 - (z0 + j * step) / kz)
                  for j in range(rows) for i in range(cols)]
        vals = [v[0] if v[0] > -1000 else 0 for v in ds.sample(coords)]
        out["height"] = {"x0": x0, "z0": z0, "step": step, "cols": cols, "rows": rows,
                         "data": [round(float(v), 1) for v in vals]}

    json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"Listo: {a.out} · {len(out['buildings'])} edificios, {len(out['roads'])} calles, "
          f"{len(out['areas'])} zonas, {len(out['pois'])} puntos de interés")
    for p in out["pois"]:
        if p["important"]: print("  ★", p["kind"], "-", p["name"])

if __name__ == "__main__":
    main()
