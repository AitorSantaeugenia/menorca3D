"""Conversión entre coordenadas locales del juego (x este, z sur, metros) y UTM 31 ETRS89 (EPSG:25831)."""
import math, numpy as np

def utm(lat, lon, lc=3.0):
    a = 6378137.0; f = 1 / 298.257222101; e2 = f * (2 - f); ep = e2 / (1 - e2); k0 = .9996
    p = np.radians(lat); l = np.radians(lon - lc); s, c, t = np.sin(p), np.cos(p), np.tan(p)
    N = a / np.sqrt(1 - e2 * s * s); T = t * t; C = ep * c * c; A = c * l
    M = a * ((1 - e2/4 - 3*e2**2/64 - 5*e2**3/256)*p - (3*e2/8 + 3*e2**2/32 + 45*e2**3/1024)*np.sin(2*p) + (15*e2**2/256 + 45*e2**3/1024)*np.sin(4*p) - 35*e2**3/3072*np.sin(6*p))
    E = k0*N*(A + (1-T+C)*A**3/6 + (5-18*T+T*T+72*C-58*ep)*A**5/120) + 5e5
    Nn = k0*(M + N*t*(A*A/2 + (5-T+9*C+4*C*C)*A**4/24 + (61-58*T+T*T+600*C-330*ep)*A**6/720))
    return E, Nn

def utm_to_local(origin):
    """Devuelve f(E, N) -> array (n, 2) local.
    v2: si está pipeline/coords.py (copiado junto a este archivo), conversión EXACTA UTM -> lon/lat -> local, válida en
    todo el municipio. Si no, el ajuste afín original de v0.7 (error < 0,1 m en ±1,5 km, ~3 m a 4,5 km)."""
    try:
        from coords import utm_to_lonlat
        lat0, lon0 = origin['lat'], origin['lon']; kx, kz = 111320 * math.cos(math.radians(lat0)), 110540
        def exact(e, n):
            e, n = np.atleast_1d(np.asarray(e, float)), np.atleast_1d(np.asarray(n, float))
            ll = np.array([utm_to_lonlat(a, b) for a, b in zip(e, n)])
            return np.c_[(ll[:, 0] - lon0) * kx, -(ll[:, 1] - lat0) * kz]
        return exact
    except ImportError:
        pass
    lat0, lon0 = origin['lat'], origin['lon']; kx, kz = 111320 * math.cos(math.radians(lat0)), 110540
    g = np.array([[x, z] for x in (-1500, 0, 1500) for z in (-1500, 0, 1500)], float)
    E, N = utm(lat0 - g[:, 1] / kz, lon0 + g[:, 0] / kx)
    M = np.c_[np.ones(len(g)), g]
    cE, cN = np.linalg.lstsq(M, E, rcond=None)[0], np.linalg.lstsq(M, N, rcond=None)[0]
    Ji = np.linalg.inv(np.array([[cE[1], cE[2]], [cN[1], cN[2]]]))
    return lambda e, n: (Ji @ np.array([np.asarray(e) - cE[0], np.asarray(n) - cN[0]])).T
