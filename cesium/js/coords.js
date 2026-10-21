// lon/lat ETRS89 -> UTM huso 31N (EPSG:25831), series de Krüger (misma fórmula que pipeline/coords.py, error < 1 mm).
(function () {
  const a = 6378137, f = 1 / 298.257222101, k0 = 0.9996, n = f / (2 - f), e = Math.sqrt(f * (2 - f));
  const A = a / (1 + n) * (1 + n * n / 4 + n ** 4 / 64 + n ** 6 / 256);
  const al = [n / 2 - 2 * n ** 2 / 3 + 5 * n ** 3 / 16 + 41 * n ** 4 / 180 - 127 * n ** 5 / 288 + 7891 * n ** 6 / 37800,
    13 * n ** 2 / 48 - 3 * n ** 3 / 5 + 557 * n ** 4 / 1440 + 281 * n ** 5 / 630 - 1983433 * n ** 6 / 1935360,
    61 * n ** 3 / 240 - 103 * n ** 4 / 140 + 15061 * n ** 5 / 26880 + 167603 * n ** 6 / 181440,
    49561 * n ** 4 / 161280 - 179 * n ** 5 / 168 + 6601661 * n ** 6 / 7257600,
    34729 * n ** 5 / 80640 - 3418889 * n ** 6 / 1995840,
    212378941 * n ** 6 / 319334400];
  window.toUTM31 = function (lon, lat) {
    const p = lat * Math.PI / 180, l = (lon - 3) * Math.PI / 180;
    const t = Math.sinh(Math.atanh(Math.sin(p)) - e * Math.atanh(e * Math.sin(p)));
    const xi = Math.atan2(t, Math.cos(l)), eta = Math.asinh(Math.sin(l) / Math.hypot(t, Math.cos(l)));
    let x = eta, y = xi;
    al.forEach((c, i) => { const j = 2 * (i + 1); x += c * Math.cos(j * xi) * Math.sinh(j * eta); y += c * Math.sin(j * xi) * Math.cosh(j * eta); });
    return [500000 + k0 * A * x, k0 * A * y];
  };
})();
