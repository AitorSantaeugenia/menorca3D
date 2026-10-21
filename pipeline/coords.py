"""Sistema de coordenadas de Menorca 3D v2.

Sistema de trabajo: ETRS89 / UTM huso 31N (EPSG:25831), metros. Es el sistema nativo del Catastro (INSPIRE) y del
MDT del IGN que ya tenemos. El visor (CesiumJS) recibe longitud/latitud ETRS89 en grados, que se trata como WGS84
(diferencia de centímetros, irrelevante a esta escala).

Conversión exacta UTM <-> geográficas con las series de Krüger (orden 6, error < 1 mm en el huso), sin dependencias.
Cuando pyproj esté disponible se puede comparar con: pyproj.Transformer.from_crs(25831, 4258, always_xy=True).

Alturas: el MDT del IGN da altitud ORTOMÉTRICA (sobre el nivel del mar, geoide EGM08-REDNAP). Cesium usa altura
ELIPSOIDAL. En Menorca la diferencia (ondulación del geoide) es de unos 50 m (VALOR APROXIMADO, sin verificar con el
modelo oficial). Mientras el terreno del visor sea solo el MDT propio, todo usa altitud ortométrica y es coherente; si
se mezcla con un terreno elipsoidal (Cesium World Terrain, 3D Tiles de terceros) habrá que aplicar el geoide.
"""
import math

A = 6378137.0                    # GRS80 (ETRS89)
F = 1 / 298.257222101
K0 = 0.9996
E0, N0 = 500000.0, 0.0
LON0_ZONE31 = 3.0                # meridiano central del huso 31

_n = F / (2 - F)
_A = A / (1 + _n) * (1 + _n**2 / 4 + _n**4 / 64 + _n**6 / 256)
_alpha = [
    _n / 2 - 2 * _n**2 / 3 + 5 * _n**3 / 16 + 41 * _n**4 / 180 - 127 * _n**5 / 288 + 7891 * _n**6 / 37800,
    13 * _n**2 / 48 - 3 * _n**3 / 5 + 557 * _n**4 / 1440 + 281 * _n**5 / 630 - 1983433 * _n**6 / 1935360,
    61 * _n**3 / 240 - 103 * _n**4 / 140 + 15061 * _n**5 / 26880 + 167603 * _n**6 / 181440,
    49561 * _n**4 / 161280 - 179 * _n**5 / 168 + 6601661 * _n**6 / 7257600,
    34729 * _n**5 / 80640 - 3418889 * _n**6 / 1995840,
    212378941 * _n**6 / 319334400,
]
_beta = [
    _n / 2 - 2 * _n**2 / 3 + 37 * _n**3 / 96 - _n**4 / 360 - 81 * _n**5 / 512 + 96199 * _n**6 / 604800,
    _n**2 / 48 + _n**3 / 15 - 437 * _n**4 / 1440 + 46 * _n**5 / 105 - 1118711 * _n**6 / 3870720,
    17 * _n**3 / 480 - 37 * _n**4 / 840 - 209 * _n**5 / 4480 + 5569 * _n**6 / 90720,
    4397 * _n**4 / 161280 - 11 * _n**5 / 504 - 830251 * _n**6 / 7257600,
    4583 * _n**5 / 161280 - 108847 * _n**6 / 3991680,
    20648693 * _n**6 / 638668800,
]
_e = math.sqrt(F * (2 - F))


def lonlat_to_utm(lon, lat, lon0=LON0_ZONE31):
    """Grados (ETRS89) -> (E, N) en metros, EPSG:25831."""
    phi, lam = math.radians(lat), math.radians(lon - lon0)
    t = math.sinh(math.atanh(math.sin(phi)) - _e * math.atanh(_e * math.sin(phi)))
    xi, eta = math.atan2(t, math.cos(lam)), math.asinh(math.sin(lam) / math.hypot(t, math.cos(lam)))
    x = eta + sum(a * math.cos(2 * j * xi) * math.sinh(2 * j * eta) for j, a in enumerate(_alpha, 1))
    y = xi + sum(a * math.sin(2 * j * xi) * math.cosh(2 * j * eta) for j, a in enumerate(_alpha, 1))
    return E0 + K0 * _A * x, N0 + K0 * _A * y


def utm_to_lonlat(E, N, lon0=LON0_ZONE31):
    """(E, N) EPSG:25831 -> (lon, lat) en grados ETRS89."""
    xi, eta = (N - N0) / (K0 * _A), (E - E0) / (K0 * _A)
    xi_ = xi - sum(b * math.sin(2 * j * xi) * math.cosh(2 * j * eta) for j, b in enumerate(_beta, 1))
    eta_ = eta - sum(b * math.cos(2 * j * xi) * math.sinh(2 * j * eta) for j, b in enumerate(_beta, 1))
    chi = math.asin(math.sin(xi_) / math.cosh(eta_))
    phi = chi
    for _ in range(8):           # latitud conforme -> geodésica (iteración de Newton sobre tau)
        tau = math.tan(phi)
        s = math.sinh(_e * math.atanh(_e * tau / math.sqrt(1 + tau * tau)))
        tp = tau * math.sqrt(1 + s * s) - s * math.sqrt(1 + tau * tau)
        dt = (math.tan(chi) - tp) / math.sqrt(1 + tp * tp) * (1 + (1 - _e**2) * tau * tau) / ((1 - _e**2) * math.sqrt(1 + tau * tau))
        phi = math.atan(tau + dt)
    lam = math.atan2(math.sinh(eta_), math.cos(xi_))
    return lon0 + math.degrees(lam), math.degrees(phi)


# Origen local común a TODA la isla (para visores o cálculos en metros planos, p. ej. Three.js o WorldMirror).
# Redondo y dentro de Menorca, en EPSG:25831. Local: x = E - E_ORIGEN (este), y = N - N_ORIGEN (norte), z = altura.
ISLAND_ORIGIN_UTM = (590000.0, 4420000.0)


def utm_to_island_local(E, N):
    return E - ISLAND_ORIGIN_UTM[0], N - ISLAND_ORIGIN_UTM[1]


def island_local_to_utm(x, y):
    return x + ISLAND_ORIGIN_UTM[0], y + ISLAND_ORIGIN_UTM[1]


# Proyección local del proyecto v0.7 (src/core/geo.js): equirectangular con origen por zona, x = este, z = SUR.
# Solo para leer datos ya procesados por v0.7; no usar para datos nuevos.
def v07_local_to_lonlat(x, z, origin):
    kx, kz = 111320 * math.cos(math.radians(origin['lat'])), 110540
    return origin['lon'] + x / kx, origin['lat'] - z / kz


if __name__ == '__main__':
    import sys
    sys.path.insert(0, 'v0.7/tools'); sys.path.insert(0, '../v0.7/tools')
    # 1) Ida y vuelta en todo el rectángulo de Menorca
    worst = 0
    for lat in [39.80 + i * 0.02 for i in range(13)]:
        for lon in [3.79 + i * 0.05 for i in range(14)]:
            E, N = lonlat_to_utm(lon, lat); lo, la = utm_to_lonlat(E, N)
            E2, N2 = lonlat_to_utm(lo, la); worst = max(worst, math.hypot(E2 - E, N2 - N))
    print(f'ida y vuelta: error máximo {worst * 1000:.4f} mm')
    # 2) Comparación con la fórmula de Snyder de v0.7 (tools/geolocal.py), si está disponible
    try:
        from geolocal import utm as snyder
        d = max(math.hypot(*(a - b for a, b in zip(lonlat_to_utm(lo, la), map(float, snyder(la, lo)))))
                for la in (39.82, 39.88, 39.95, 40.05) for lo in (3.82, 4.0, 4.29, 4.32))
        print(f'diferencia con la fórmula de v0.7 (Snyder): {d * 1000:.2f} mm')
    except ImportError:
        print('(sin v0.7/tools/geolocal.py: comparación omitida)')
    # 3) Ayuntamiento de Es Castell (OSM)
    E, N = lonlat_to_utm(4.2908, 39.8803); print(f'Ayuntamiento Es Castell: E {E:.2f}  N {N:.2f}  local isla {utm_to_island_local(E, N)}')
