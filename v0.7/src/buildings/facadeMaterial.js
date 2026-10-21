import * as THREE from 'three';
import { tex } from '../core/textures.js';
import { uNight } from '../core/dayNight.js';
// Material de fachada: estuco (textura PROCEDURAL) × color de cada edificio + huecos y molduras dibujados en el shader.
// Todo calibrado con las fotos propias (docs/REFERENCIAS_VISUALES.md). Sin imágenes de terceros.
// Atributos: aWall = (coordenada de vano, metros de altura, largo del lado, nº de vanos);
//            aFac  = (ancho de vano m, altura del muro m, estilo, semilla = edificio * 16 + lado).
// Estilos:
//   0 casco: recercado blanco con arco rebajado, persianas verdes/azules, zócalo, cornisa y a veces pilastras blancas
//   1 Ayuntamiento y 4 cuarteles de la Explanada: rojo, esquinas dentadas blancas, recercados, zócalo y cornisa blancos
//   2 residencial (urbanizaciones): persianas mallorquinas y alero de teja dentado
//   3 residencial con zócalo de lajas
//   5 casco con fachada de sillarejo de marès
export function createFacadeMaterial() {
  const st = tex('estuco'), ap = tex('aplacado'), si = tex('sillarejo');
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, map: st.map, normalMap: st.normalMap, normalScale: new THREE.Vector2(.35, .35) });
  m.onBeforeCompile = sh => {
    sh.uniforms.uAplacado = { value: ap.map }; sh.uniforms.uSillarejo = { value: si.map }; sh.uniforms.uNight = uNight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aWall; attribute vec4 aFac; varying vec4 vWall; varying vec4 vFac; varying vec2 vM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWall = aWall; vFac = aFac; vM = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uAplacado; uniform sampler2D uSillarejo; uniform float uNight;
vec3 gLit = vec3(0.);   // de noche: luz de las ventanas encendidas (PROCEDURAL)
varying vec4 vWall; varying vec4 vFac; varying vec2 vM;
float h1(float n) { return fract(sin(n) * 43758.5453); }
vec3 sl(vec3 c) { return pow(c, vec3(2.2)); } // color sRGB → lineal`)
      .replace('#include <color_fragment>', `#include <color_fragment>
if (vFac.x > 0.0) {
  float sw = floor(vFac.w + 0.5);                                   // redondeo: la interpolación no da enteros exactos
  float bw = vFac.x, H = vFac.y, style = floor(vFac.z + 0.5), bs = floor(sw / 16.0), side = sw - bs * 16.0;
  float L = vWall.z, bay = floor(vWall.x), lx = fract(vWall.x) * bw, v = vWall.y, u = vWall.x * bw;
  float fl = floor(v / 3.0), fy = v - fl * 3.0, cx = abs(lx - bw * 0.5), edge = min(u, L - u);
  float dfy = fwidth(v), dlx = fwidth(vWall.x) * bw;               // tamaño del píxel en metros (antialias)
  vec3 white = sl(vec3(0.93, 0.92, 0.88));
  float rnd = h1(bay * 12.99 + side * 3.17 + bs * 0.731 + fl * 5.3), pick = h1(bs * 1.37);
  bool casco = style < 0.5 || style > 4.5, civic = (style > 0.5 && style < 1.5) || (style > 3.5 && style < 4.5), resid = style > 1.5 && style < 3.5;
  if (style > 4.5) diffuseColor.rgb = texture2D(uSillarejo, vM * 0.5).rgb;
  vec3 wall = diffuseColor.rgb;
  // ---- molduras ----
  if (civic) {
    float wq = mod(floor(v / 0.45), 2.0) < 1.0 ? 0.8 : 0.45;        // esquinas dentadas (cadenas de sillares)
    if (edge < wq || v < 0.55 || v > H - 0.35) diffuseColor.rgb = white;
  } else if (casco) {
    if (v < 0.7) diffuseColor.rgb = h1(bs * 2.3) < 0.5 ? wall * 0.8 : sl(vec3(0.78, 0.72, 0.62));   // zócalo
    if (v > H - 0.28 || (h1(bs * 5.1) < 0.4 && edge < 0.3)) diffuseColor.rgb = white;              // cornisa y pilastras
  } else if (resid) {
    float d = H - v, t = fract(u * 3.3), tooth = 0.3 * (1.0 - abs(t - 0.5) * 2.0);                // alero de teja dentado
    if (d < 0.32) diffuseColor.rgb = d < tooth ? sl(vec3(0.72, 0.40, 0.30)) : white;
    if (style > 2.5 && v < 0.85) diffuseColor.rgb = texture2D(uAplacado, vM * 0.5).rgb;            // zócalo de lajas
  }
  // ---- color de carpintería (medido en las fotos) ----
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
  float arch = (casco || civic) ? 0.14 * sqrt(max(0.0, 1.0 - pow(cx / (hw + fr), 2.0))) : 0.0;   // arco rebajado
  if (!blank && fl * 3.0 + y1 + 0.3 < H && cx < hw + fr && fy > y0 - fr && fy < y1 + fr + arch) {
    if (cx < hw && fy > y0 && fy < y1 + arch * 0.6) {
      bool closed = !door && h1(rnd * 91.7) < 0.5;
      if (door) {
        diffuseColor.rgb = h1(bs * 2.9) < 0.6 ? shut * 0.9 : sl(vec3(0.33, 0.24, 0.18));
        if (cx < 0.02) diffuseColor.rgb *= 0.7;
      } else if (closed) {
        float slat = step(0.45, fract((fy - y0) * 12.0)), aa = clamp(1.0 - dfy * 24.0, 0.0, 1.0);
        diffuseColor.rgb = shut * (0.78 + 0.22 * mix(0.55, slat, aa));
        if (cx < 0.02) diffuseColor.rgb *= 0.65;                                  // junta entre hojas
      } else {
        diffuseColor.rgb = sl(vec3(0.15, 0.18, 0.21));                              // vidrio
        float on = step(0.55, h1(rnd * 53.1 + 7.0));
        if (cx < hw - (civic ? 0.0 : 0.12) && on > 0.5) gLit = mix(vec3(1.0, 0.62, 0.30), vec3(1.0, 0.80, 0.55), h1(rnd * 9.7)) * 1.6;
        if (cx < 0.03 || abs(fy - (y0 + y1) * 0.5) < 0.025) diffuseColor.rgb = civic ? shut : sl(vec3(0.85));
        if (!civic && hw - cx < 0.12) diffuseColor.rgb = shut * 0.9;                // persiana abierta, recogida
      }
      if (balcony && fy < 1.0 && (fract(lx * 9.0) < 0.25 || fy > 0.94 || fy < 0.06)) diffuseColor.rgb = sl(vec3(0.10));   // barandilla
    } else diffuseColor.rgb = resid ? wall * 0.88 : (style > 4.5 ? sl(vec3(0.80, 0.74, 0.64)) : white);   // recercado
  }
}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gLit * uNight;');
  };
  return m;
}
