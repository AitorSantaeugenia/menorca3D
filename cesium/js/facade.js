// Fachadas de v0.7 en Cesium: port del shader de v0.7/src/buildings/facadeMaterial.js a un CustomShader.
// Mismos estilos, colores medidos en las fotos propias y reglas PROCEDURALES de huecos, persianas y molduras.
// Datos por vértice que escribe pipeline/exportar_glb.mjs: _AWALL (vano, altura, largo del lado, nº de vanos),
// _AFAC (ancho de vano, altura del muro, estilo, semilla) y _UVM (UV en metros).
// Diferencias con v0.7: texture() en lugar de texture2D(), y las texturas de lajas y sillarejo se pasan a lineal a mano.
window.FACADE_GLSL = `
float h1(float n) { return fract(sin(n) * 43758.5453); }
vec3 sl(vec3 c) { return pow(c, vec3(2.2)); }
void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  vec4 vWall = fsInput.attributes.awall, vFac = fsInput.attributes.afac;
  vec2 vM = fsInput.attributes.uvm;
  if (vFac.x <= 0.0) return;
  vec3 dc = material.diffuse, gLit = vec3(0.0);
  float sw = floor(vFac.w + 0.5);
  float bw = vFac.x, H = vFac.y, style = floor(vFac.z + 0.5), bs = floor(sw / 16.0), side = sw - bs * 16.0;
  float L = vWall.z, bay = floor(vWall.x), lx = fract(vWall.x) * bw, v = vWall.y, u = vWall.x * bw;
  float fl = floor(v / 3.0), fy = v - fl * 3.0, cx = abs(lx - bw * 0.5), edge = min(u, L - u);
  float dfy = fwidth(v);
  vec3 white = sl(vec3(0.93, 0.92, 0.88));
  float rnd = h1(bay * 12.99 + side * 3.17 + bs * 0.731 + fl * 5.3), pick = h1(bs * 1.37);
  bool casco = style < 0.5 || style > 4.5, civic = (style > 0.5 && style < 1.5) || (style > 3.5 && style < 4.5), resid = style > 1.5 && style < 3.5;
  if (style > 4.5) dc = sl(texture(u_sillarejo, vM * 0.5).rgb);
  vec3 wall = dc;
  // ---- molduras ----
  if (civic) {
    float wq = mod(floor(v / 0.45), 2.0) < 1.0 ? 0.8 : 0.45;
    if (edge < wq || v < 0.55 || v > H - 0.35) dc = white;
  } else if (casco) {
    if (v < 0.7) dc = h1(bs * 2.3) < 0.5 ? wall * 0.8 : sl(vec3(0.78, 0.72, 0.62));
    if (v > H - 0.28 || (h1(bs * 5.1) < 0.4 && edge < 0.3)) dc = white;
  } else if (resid) {
    float d = H - v, t = fract(u * 3.3), tooth = 0.3 * (1.0 - abs(t - 0.5) * 2.0);
    if (d < 0.32) dc = d < tooth ? sl(vec3(0.72, 0.40, 0.30)) : white;
    if (style > 2.5 && v < 0.85) dc = sl(texture(u_aplacado, vM * 0.5).rgb);
  }
  // ---- carpintería ----
  vec3 shut;
  if (resid) shut = pick < 0.5 ? sl(vec3(0.294, 0.404, 0.463)) : (pick < 0.75 ? sl(vec3(0.176, 0.380, 0.310)) : sl(vec3(0.90, 0.90, 0.87)));
  else if (civic) shut = sl(vec3(0.15, 0.33, 0.27));
  else shut = pick < 0.45 ? sl(vec3(0.180, 0.388, 0.416)) : (pick < 0.7 ? sl(vec3(0.12, 0.35, 0.27)) : (pick < 0.9 ? sl(vec3(0.208, 0.275, 0.341)) : sl(vec3(0.25, 0.54, 0.54))));
  // ---- huecos ----
  bool door = fl < 0.5 && rnd < (casco ? 0.4 : civic ? 0.15 : 0.18);
  bool balcony = !door && fl > 0.5 && casco && rnd < 0.18;
  bool blank = rnd > (casco ? 0.86 : civic ? 0.97 : 0.78);
  float hw = door ? min(0.55, bw * 0.24) : (resid ? min(0.6, bw * 0.24) : min(0.45, bw * 0.2));
  float y0 = door || balcony ? 0.02 : 0.9, y1 = door ? 2.45 : (resid ? 2.2 : 2.4);
  float fr = resid ? 0.05 : 0.14;
  float arch = (casco || civic) ? 0.14 * sqrt(max(0.0, 1.0 - pow(cx / (hw + fr), 2.0))) : 0.0;
  if (!blank && fl * 3.0 + y1 + 0.3 < H && cx < hw + fr && fy > y0 - fr && fy < y1 + fr + arch) {
    if (cx < hw && fy > y0 && fy < y1 + arch * 0.6) {
      bool closed = !door && h1(rnd * 91.7) < 0.5;
      if (door) {
        dc = h1(bs * 2.9) < 0.6 ? shut * 0.9 : sl(vec3(0.33, 0.24, 0.18));
        if (cx < 0.02) dc *= 0.7;
      } else if (closed) {
        float slat = step(0.45, fract((fy - y0) * 12.0)), aa = clamp(1.0 - dfy * 24.0, 0.0, 1.0);
        dc = shut * (0.78 + 0.22 * mix(0.55, slat, aa));
        if (cx < 0.02) dc *= 0.65;
      } else {
        dc = sl(vec3(0.15, 0.18, 0.21));
        float on = step(0.55, h1(rnd * 53.1 + 7.0));
        if (cx < hw - (civic ? 0.0 : 0.12) && on > 0.5) gLit = mix(vec3(1.0, 0.62, 0.30), vec3(1.0, 0.80, 0.55), h1(rnd * 9.7)) * 1.6;
        if (cx < 0.03 || abs(fy - (y0 + y1) * 0.5) < 0.025) dc = civic ? shut : sl(vec3(0.85));
        if (!civic && hw - cx < 0.12) dc = shut * 0.9;
      }
      if (balcony && fy < 1.0 && (fract(lx * 9.0) < 0.25 || fy > 0.94 || fy < 0.06)) dc = sl(vec3(0.10));
    } else dc = resid ? wall * 0.88 : (style > 4.5 ? sl(vec3(0.80, 0.74, 0.64)) : white);
  }
  material.diffuse = dc;
  material.emissive += gLit * u_night;
}`;

// Crea el CustomShader con las texturas de lajas y sillarejo de un modelo exportado.
window.createFacadeShader = function (C, texUrls) {
  return new C.CustomShader({
    lightingModel: C.LightingModel.PBR,
    uniforms: {
      u_night: { type: C.UniformType.FLOAT, value: 1 },
      u_aplacado: { type: C.UniformType.SAMPLER_2D, value: new C.TextureUniform({ url: texUrls.aplacado, repeat: true }) },
      u_sillarejo: { type: C.UniformType.SAMPLER_2D, value: new C.TextureUniform({ url: texUrls.sillarejo, repeat: true }) },
    },
    fragmentShaderText: window.FACADE_GLSL,
  });
};
