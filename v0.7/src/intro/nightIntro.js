import * as THREE from 'three';
import { uNight, dayNight } from '../core/dayNight.js';
// Pantalla de inicio: toda Menorca, de día o de noche (municipio.json, tools/preparar_municipio.py).
//   Es Castell: frontera y edificios (Catastro), relieve (MDT IGN), calles (OSM): REAL.
//   Resto de la isla: contorno REAL (OSM); de momento todo campo, con un relieve suave PLACEHOLDER.
//   Faros: posición, color y secuencia de destellos de OSM (REAL); los que OSM no trae, de la lista de faros
//   de España con ritmo ESTIMADO.
//   PROCEDURAL: ventanas encendidas, farolas, cielo, sol, luna y oleaje.
const MOON = new THREE.Vector3(.40, .34, -.85).normalize();   // luna al nornordeste: su reflejo cae sobre el mar, a la derecha de la isla
const SUN = new THREE.Vector3(-.35, .55, -.76).normalize();   // sol al noroeste: brilla sobre el mar, detrás de la isla
const FOG_N = new THREE.Color().setRGB(.010, .016, .032), FOG_D = new THREE.Color().setRGB(.50, .64, .78);
const GLSL = `float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
uniform float uNight, uTime; uniform vec3 uL, uFog; uniform float uFogD;`;
const OUT = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>';
const FOG_GLSL = 'float fd = length(vW - cameraPosition) * uFogD; c = mix(c, uFog, 1. - exp(-fd * fd));';
// Hierba del resto de la isla (día / noche)
const GRASS = `vec3 grass(vec3 w, float dif){ float n = vnoise(w.xz / 900.) * .6 + vnoise(w.xz / 140.) * .4;
  vec3 d = mix(vec3(.16, .26, .08), vec3(.30, .36, .13), n) * (.35 + .75 * dif);
  vec3 nn = vec3(.022, .034, .026) + dif * vec3(.05, .07, .05);
  return mix(d, nn, uNight); }`;

export async function createNightIntro(canvas, url, { marks = [] } = {}) {
  const r = await fetch(url); if (!r.ok) throw new Error('No se pudo cargar ' + url);
  const D = await r.json(), T = D.terrain, [X0, X1, Z0, Z1] = D.box;
  const raw = new Int16Array(Uint8Array.from(atob(T.h), c => c.charCodeAt(0)).buffer);
  const hAt = (i, j) => { i = Math.max(0, Math.min(T.cols - 1, i)); j = Math.max(0, Math.min(T.rows - 1, j)); const v = raw[j * T.cols + i]; return v == -32768 || v <= 2 ? -5 : v / 10; };   // ≤ 0,2 m o sin dato = mar
  const Hreal = (x, z) => {
    const u = (x - T.x0) / T.step, v = (z - T.z0) / T.step, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    return (hAt(i, j) * (1 - fu) + hAt(i + 1, j) * fu) * (1 - fv) + (hAt(i, j + 1) * (1 - fu) + hAt(i + 1, j + 1) * fu) * fv;
  };
  const pip = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > z) != (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const inside = (x, z) => D.border.some(p => pip(x, z, p));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 8, 300000);
  const pxScale = { value: 1 }, setScale = () => { pxScale.value = innerHeight * Math.min(devicePixelRatio, 1.5) / (2 * Math.tan(camera.fov * Math.PI / 360)); };
  const onResize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); setScale(); };
  addEventListener('resize', onResize); setScale();
  const uTime = { value: 0 }, box = new THREE.Vector4(X0, Z0, X1 - X0, Z1 - Z0);
  const uL = { value: new THREE.Vector3() }, uFog = { value: new THREE.Color() }, uFogD = { value: 1 / 90000 };
  const common = { uNight, uL, uFog, uFogD, uTime };

  // ---- Isla: máscara de la costa ----
  const isl = D.island && D.island.length ? D.island : [[[X0, Z0], [X1, Z0], [X1, Z1], [X0, Z1]]];
  let I0 = 1e9, I1 = -1e9, J0 = 1e9, J1 = -1e9; for (const q of isl[0]) { I0 = Math.min(I0, q[0]); I1 = Math.max(I1, q[0]); J0 = Math.min(J0, q[1]); J1 = Math.max(J1, q[1]); }
  I0 -= 1500; I1 += 1500; J0 -= 1500; J1 += 1500;
  const iBox = new THREE.Vector4(I0, J0, I1 - I0, J1 - J0), IW = 4096, IH = Math.round(IW * (J1 - J0) / (I1 - I0));
  const drawIsl = (g, w, h) => { g.fillStyle = '#fff'; for (const p of isl) { g.beginPath(); p.forEach((q, i) => { const a = (q[0] - I0) / (I1 - I0) * w, b = (q[1] - J0) / (J1 - J0) * h; i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); g.fill(); } };
  const ic = document.createElement('canvas'); ic.width = IW; ic.height = IH; const ig = ic.getContext('2d'); ig.filter = 'blur(.8px)'; drawIsl(ig, IW, IH);
  const islTex = new THREE.CanvasTexture(ic); islTex.flipY = false;
  // Costa difuminada (~100 m): espuma de las olas rompiendo junto a la orilla
  const oc = document.createElement('canvas'); oc.width = 2048; oc.height = Math.round(2048 * IH / IW); const og = oc.getContext('2d'); og.filter = 'blur(4px)'; drawIsl(og, oc.width, oc.height);
  const foamTex = new THREE.CanvasTexture(oc); foamTex.flipY = false;
  // Caída hacia la costa (para el relieve PLACEHOLDER): máscara muy difuminada leída en CPU
  const fc = document.createElement('canvas'); fc.width = 512; fc.height = Math.round(512 * IH / IW); const fg = fc.getContext('2d', { willReadFrequently: true });
  fg.filter = 'blur(5px)'; drawIsl(fg, fc.width, fc.height); const fall = fg.getImageData(0, 0, fc.width, fc.height).data;
  const coast = (x, z) => { const i = Math.round((x - I0) / (I1 - I0) * (fc.width - 1)), j = Math.round((z - J0) / (J1 - J0) * (fc.height - 1)); return i < 0 || j < 0 || i >= fc.width || j >= fc.height ? 0 : fall[(j * fc.width + i) * 4] / 255; };
  const fbm = (x, z) => { let s = 0, a = 1, f = 1 / 7000; for (let o = 0; o < 4; o++) { s += a * (Math.sin(x * f * 1.7 + o * 1.3) * Math.cos(z * f * 2.1 - o * .7) + .6 * Math.sin((x + z) * f * 1.1 + o)); a *= .5; f *= 2.1; } return s; };
  const inBoxD = (x, z) => Math.max(X0 - x, x - X1, Z0 - z, z - Z1, 0);
  // Altura del campo: relieve suave PLACEHOLDER que se funde con el MDT real alrededor de Es Castell
  const Hfield = (x, z) => {
    const c = coast(x, z), k = Math.min(1, c * 1.8), hp = 1.5 + (13 + 9 * Math.max(-1, Math.min(1, fbm(x, z) / 2.5))) * k * k * (3 - 2 * k), d = inBoxD(x, z);   // la máscara recorta la costa
    if (d > 2500) return hp;
    const hr = Hreal(Math.max(X0, Math.min(X1, x)), Math.max(Z0, Math.min(Z1, z)));
    const w = d / 2500, s = w * w * (3 - 2 * w); return hr + (hp - hr) * s;
  };
  const Hgt = (x, z) => x >= X0 && x <= X1 && z >= Z0 && z <= Z1 ? Hreal(x, z) : Hfield(x, z);

  // ---- Texturas de Es Castell: máscara del municipio y luces de la ciudad ----
  const S = 1024, toPx = (x, z) => [(x - X0) / (X1 - X0) * S, (z - Z0) / (Z1 - Z0) * S];
  const mc = document.createElement('canvas'); mc.width = mc.height = S; const mg = mc.getContext('2d');
  mg.filter = 'blur(1.2px)'; mg.fillStyle = '#fff';
  for (const p of D.border) { mg.beginPath(); p.forEach((q, i) => { const [a, b] = toPx(q[0], q[1]); i ? mg.lineTo(a, b) : mg.moveTo(a, b); }); mg.closePath(); mg.fill(); }
  const maskTex = new THREE.CanvasTexture(mc); maskTex.flipY = false;
  const G = 40, near = new Set();
  for (const b of D.buildings) { let cx = 0, cz = 0; const n = (b.length - 1) / 2; for (let k = 1; k < b.length; k += 2) { cx += b[k]; cz += b[k + 1]; } near.add(Math.floor(cx / n / G) + ',' + Math.floor(cz / n / G)); }
  const urban = (x, z) => { const i = Math.floor(x / G), j = Math.floor(z / G); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (near.has(i + a + ',' + (j + b))) return true; return false; };
  const lamps = []; let acc = 0;
  for (const rd of D.roads) for (let k = 0; k < rd.p.length - 1; k++) {
    const [ax, az] = rd.p[k], [bx, bz] = rd.p[k + 1], L = Math.hypot(bx - ax, bz - az);
    for (; acc < L; acc += 28) { const x = ax + (bx - ax) * acc / L, z = az + (bz - az) * acc / L; if (urban(x, z) && inside(x, z)) lamps.push(x, z); }
    acc -= L;
  }
  const lc = document.createElement('canvas'); lc.width = lc.height = S; const lg = lc.getContext('2d');
  lg.fillStyle = '#000'; lg.fillRect(0, 0, S, S); lg.globalCompositeOperation = 'lighter';
  const rad = 6, spot = lg.createRadialGradient(0, 0, 0, 0, 0, rad); spot.addColorStop(0, 'rgba(255,255,255,.3)'); spot.addColorStop(1, 'rgba(255,255,255,0)'); lg.fillStyle = spot;
  for (let k = 0; k < lamps.length; k += 2) { const [a, b] = toPx(lamps[k], lamps[k + 1]); lg.setTransform(1, 0, 0, 1, a, b); lg.fillRect(-rad, -rad, rad * 2, rad * 2); }
  const lightTex = new THREE.CanvasTexture(lc); lightTex.flipY = false;

  // ---- Cielo ----
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(200000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: { ...common, uMoon: { value: MOON }, uSun: { value: SUN } },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `${GLSL} uniform vec3 uMoon, uSun; varying vec3 vD;
      void main(){
        vec3 d = normalize(vD); float y = max(d.y, 0.);
        vec3 cn = mix(uFog * 1.15, vec3(.003, .006, .016), pow(y, .35));
        vec2 s = vec2(atan(d.z, d.x), asin(clamp(d.y, -1., 1.))) * 260.; vec2 cl = floor(s), f = fract(s) - .5;
        float h = hash(cl), st = step(.986, h) * smoothstep(.32, .0, length(f - (vec2(hash(cl + 3.1), hash(cl + 7.7)) - .5) * .5));
        cn += st * (.45 + .55 * sin(uTime * (1.5 + h * 3.) + h * 60.)) * smoothstep(.02, .2, d.y) * vec3(.9, .95, 1.) * 1.4;
        float m = dot(d, uMoon); cn += smoothstep(.99993, .99996, m) * vec3(1., .97, .88) * 3. + pow(max(m, 0.), 30000.) * vec3(.25, .26, .28) + pow(max(m, 0.), 300.) * vec3(.01, .014, .02);
        vec3 cd = mix(uFog * 1.05, vec3(.10, .26, .58), pow(y, .5));
        float sn = dot(d, uSun); cd += smoothstep(.99985, .9999, sn) * vec3(6., 5.5, 4.5) + pow(max(sn, 0.), 60.) * vec3(.5, .42, .3);
        vec3 c = mix(cd, cn, uNight); gl_FragColor = vec4(c, 1.); ${OUT}
      }`,
  })));

  // ---- Campo del resto de la isla (rejilla de 200 m) ----
  { const ST = 200, nx = Math.ceil((I1 - I0) / ST) + 1, nz = Math.ceil((J1 - J0) / ST) + 1;
    const g = new THREE.PlaneGeometry(1, 1, nx - 1, nz - 1), p = g.attributes.position;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = I0 + i * ST, z = J0 + j * ST; p.setXYZ(j * nx + i, x, Hfield(x, z), z); }
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { ...common, uIsl: { value: islTex }, uIBox: { value: iBox }, uBox: { value: box } },
      vertexShader: 'varying vec3 vW; varying vec3 vN; void main(){ vW = position; vN = normal; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }',
      fragmentShader: `${GLSL} ${GRASS} uniform sampler2D uIsl; uniform vec4 uIBox, uBox; varying vec3 vW; varying vec3 vN;
        void main(){
          vec2 b = (vW.xz - uBox.xy) / uBox.zw; if (b.x > .001 && b.y > .001 && b.x < .999 && b.y < .999) discard;   // Es Castell: terreno real
          if (texture2D(uIsl, (vW.xz - uIBox.xy) / uIBox.zw).r < .5) discard;
          vec3 c = grass(vW, max(dot(normalize(vN), uL), 0.)); ${FOG_GLSL} gl_FragColor = vec4(c, 1.); ${OUT}
        }`,
    })));
  }

  // ---- Terreno real alrededor de Es Castell (20 m) ----
  const st = 2, nc = Math.floor((T.cols - 1) / st) + 1, nr = Math.floor((T.rows - 1) / st) + 1;
  const tg = new THREE.PlaneGeometry(1, 1, nc - 1, nr - 1), tp = tg.attributes.position;
  for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) { const k = j * nc + i, x = T.x0 + i * st * T.step, z = T.z0 + j * st * T.step; tp.setXYZ(k, x, hAt(i * st, j * st), z); }
  tg.computeVertexNormals();   // (x, y) del plano → (x, -z): el orden de los triángulos ya mira hacia arriba
  scene.add(new THREE.Mesh(tg, new THREE.ShaderMaterial({
    uniforms: { ...common, uMask: { value: maskTex }, uLights: { value: lightTex }, uBox: { value: box } },
    vertexShader: 'varying vec3 vW; varying vec3 vN; void main(){ vW = position; vN = normal; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }',
    fragmentShader: `${GLSL} ${GRASS} uniform sampler2D uMask, uLights; uniform vec4 uBox; varying vec3 vW; varying vec3 vN;
      void main(){
        vec2 uv = (vW.xz - uBox.xy) / uBox.zw; float m = texture2D(uMask, uv).r, ins = smoothstep(.3, .7, m);
        float dif = max(dot(normalize(vN), uL), 0.), hi = clamp(vW.y / 70., 0., 1.), gl = texture2D(uLights, uv).r;
        vec3 inN = mix(vec3(.022, .030, .027), vec3(.032, .034, .034), hi) + dif * mix(vec3(.05, .065, .06), vec3(.07, .07, .072), hi) + gl * gl * vec3(1., .48, .18) * .9;
        vec3 g0 = grass(vW, dif), inD = mix(g0 * vec3(1.08, 1.02, .9), vec3(.55, .53, .49) * (.35 + .75 * dif), clamp(gl * 1.6, 0., .55));   // de día: campo y zonas urbanas algo más claras
        vec3 c = mix(g0, mix(inD, inN, uNight), ins);
        c += (1. - smoothstep(0., .25, abs(m - .5))) * mix(vec3(.9, .95, 1.) * .35, vec3(.30, .62, 1.) * 1.3, uNight) * step(-.5, vW.y);   // frontera de Es Castell
        ${FOG_GLSL} gl_FragColor = vec4(c, 1.); ${OUT}
      }`,
  })));

  // ---- Mar ----
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(500000, 500000).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { ...common, uLights: { value: lightTex }, uBox: { value: box }, uFoam: { value: foamTex }, uIBox: { value: iBox } },
    vertexShader: 'varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position, 1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }',
    fragmentShader: `${GLSL} uniform sampler2D uLights, uFoam; uniform vec4 uBox, uIBox; varying vec3 vW;
      vec2 wv(vec2 p, vec2 d, float k, float s){ float a = dot(p, d) * k + uTime * s; return d * k * cos(a); }
      void main(){
        float dist = length(vW - cameraPosition), px = length(fwidth(vW.xz));
        // Oleaje en tres escalas; cada una se apaga cuando un píxel es mayor que su longitud de onda (sin moiré)
        float a1 = clamp(1.2 - px * .35, 0., 1.), a2 = clamp(1.4 - px * .02, 0., 1.), a3 = clamp(1.4 - px * .004, 0., 1.);
        vec2 g = (wv(vW.xz, vec2(.8, .6), .045, 1.1) * .5 + wv(vW.xz, vec2(-.3, .95), .07, 1.6) * .35 + wv(vW.xz, vec2(.97, -.24), .12, 2.3) * .2) * a1 * 1.4;
        g += (wv(vW.xz, vec2(.6, .8), .0042, .55) + wv(vW.xz, vec2(-.75, .66), .0061, .7) * .7 + wv(vW.xz, vec2(.99, .1), .0088, .9) * .5) * a2 * 30.;   // marejada (~1 km)
        g += (wv(vW.xz, vec2(.7, .71), .00055, .22) + wv(vW.xz, vec2(-.5, .87), .0008, .3) * .6) * a3 * 90.;                                         // mar de fondo (~10 km)
        float swell = vnoise(vW.xz / 1800. + uTime * .05) * vnoise(vW.xz / 600. - uTime * .09);
        float wc = smoothstep(.8, .96, vnoise(vW.xz / 320. + vec2(uTime * .12, uTime * .07))) * smoothstep(.3, .75, swell) * clamp(1.5 - px * .006, 0., 1.);   // borreguitos de espuma
        vec3 n = normalize(vec3(-g.x, 1., -g.y)), v = normalize(cameraPosition - vW), rf = reflect(-v, n);
        float fr = .02 + .98 * pow(1. - max(dot(n, v), 0.), 5.), m = max(dot(rf, uL), 0.);
        float rough = clamp(px / 120., 0., 1.);   // de lejos el oleaje no se resuelve: brillo ancho y suave, no un espejo
        vec3 skyN = mix(uFog * 2.2, vec3(.006, .012, .028), pow(max(rf.y, 0.), .35)), skyD = mix(uFog, vec3(.10, .26, .58), pow(max(rf.y, 0.), .5));
        vec3 cn = vec3(.006, .015, .032) * (1. - fr) + skyN * fr + (pow(m, mix(1500., 30., rough)) * mix(3., .07, rough) + pow(m, 200.) * .05 * (1. - rough)) * vec3(1., .9, .75);
        vec3 cd = vec3(.010, .075, .16) * (1. - fr) + skyD * fr + (pow(m, mix(4000., 40., rough)) * mix(3., .2, rough) + pow(m, 400.) * .1 * (1. - rough)) * vec3(1., .95, .85);
        vec3 c = mix(cd, cn, uNight);
        c += mix(vec3(.55, .6, .62), vec3(.03, .04, .05), uNight) * wc + mix(vec3(.09, .13, .16), vec3(.012, .02, .03), uNight) * smoothstep(.45, .9, swell) * a2 + mix(vec3(.03, .05, .07), vec3(.006, .01, .016), uNight) * max(dot(n, uL), 0.) * (1. - uNight * .5);   // crestas: manchas claras que se mueven
        // Espuma en la orilla: franjas que avanzan hacia la costa y se deshacen
        vec2 fu = (vW.xz - uIBox.xy) / uIBox.zw;
        if (fu.x > 0. && fu.y > 0. && fu.x < 1. && fu.y < 1.) {
          float sh = texture2D(uFoam, fu).r, band = smoothstep(.02, .25, sh) * (1. - smoothstep(.45, .6, sh));
          float lap = smoothstep(.55, 1., sin(sh * 40. - uTime * 1.6 + vnoise(vW.xz / 150.) * 6.)) * band;
          c += (band * .25 + lap * .6) * mix(vec3(.75, .82, .85), vec3(.05, .07, .09), uNight);
        }
        vec2 uv = (vW.xz - uBox.xy) / uBox.zw;
        if (uv.x > 0. && uv.y > 0. && uv.x < 1. && uv.y < 1.) c += texture2D(uLights, uv).r * vec3(1., .5, .2) * .3 * uNight;   // reflejo de la ciudad
        ${FOG_GLSL} gl_FragColor = vec4(c, 1.); ${OUT}
      }`,
  })));

  // ---- Edificios de Es Castell: ventanas encendidas de noche ----
  const pos = [], uvs = [], seeds = [], nor = [];
  D.buildings.forEach((b, bi) => {
    const fl = b[0], pts = []; for (let k = 1; k < b.length; k += 2) pts.push(new THREE.Vector2(b[k], b[k + 1]));
    let base = Infinity; for (const p of pts) base = Math.min(base, Hreal(p.x, p.y)); base = Math.max(0, base) - .5;
    const top = base + .5 + fl * 3, cw = THREE.ShapeUtils.isClockWise(pts);
    let u = 0;
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], c = pts[(k + 1) % pts.length], L = a.distanceTo(c); if (L < .1) continue;
      let nx = c.y - a.y, nz = -(c.x - a.x); if (cw) { nx = -nx; nz = -nz; } const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
      const P = [[a.x, base, a.y, u, 0], [c.x, base, c.y, u + L, 0], [c.x, top, c.y, u + L, top - base], [a.x, top, a.y, u, top - base]];
      for (const i of (cw ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3])) { pos.push(P[i][0], P[i][1], P[i][2]); uvs.push(P[i][3], P[i][4]); seeds.push(bi); nor.push(nx, 0, nz); }
      u += L;
    }
    for (const t of THREE.ShapeUtils.triangulateShape(pts, [])) for (const i of (cw ? [t[0], t[2], t[1]] : t)) { pos.push(pts[i].x, top, pts[i].y); uvs.push(-1, -1); seeds.push(bi); nor.push(0, 1, 0); }
  });
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  bg.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1)); bg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  scene.add(new THREE.Mesh(bg, new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: { ...common },
    vertexShader: 'attribute float aSeed; varying vec2 vUv; varying float vS; varying vec3 vN; varying vec3 vW; void main(){ vUv = uv; vS = aSeed; vN = normal; vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }',
    fragmentShader: `${GLSL} varying vec2 vUv; varying float vS; varying vec3 vN; varying vec3 vW;
      void main(){
        float dif = max(dot(normalize(vN), uL), 0.);
        vec3 cn = vec3(.045, .048, .058) + dif * vec3(.16, .17, .20);
        vec3 cd = (vUv.x >= 0. ? vec3(.80, .78, .73) : vec3(.62, .58, .54)) * (.45 + .6 * dif);
        if (vUv.x >= 0.) {
          vec2 q = vUv / vec2(3.4, 3.), cl = floor(q), f = fract(q);
          float h = hash(cl + vec2(vS * .173, vS * .311)), lit = step(.7, h) * step(.5, q.y);
          lit *= step(.5, .5 + .5 * sin(uTime * .05 + h * 400.));                                   // alguna luz se apaga despacio
          float win = step(.28, f.x) * step(f.x, .72) * step(.3, f.y) * step(f.y, .78);
          float px = max(length(fwidth(q)), 1e-4), det = clamp(1.6 - px * 3., 0., 1.);             // de lejos: brillo medio
          vec3 lc = h > .96 ? vec3(.55, .7, 1.) : mix(vec3(1., .62, .28), vec3(1., .82, .55), fract(h * 37.));
          cn += lc * mix(.3 * .21, lit * win, det) * 2.6;
          cd = mix(cd, cd * .55, win * det * .8);                                                     // de día: huecos oscuros
        }
        vec3 c = mix(cd, cn, uNight); ${FOG_GLSL} gl_FragColor = vec4(c, 1.); ${OUT}
      }`,
  })));

  // ---- Puntos de luz (farolas, faros) ----
  const spriteMat = () => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: pxScale, uOn: { value: 1 } },
    vertexShader: 'attribute vec3 color; attribute float aI; attribute vec2 aS; varying vec3 vC; uniform float uScale, uOn; void main(){ vC = color * aI * uOn; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = clamp(aS.x * uScale / -mv.z, aS.y, 90.); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; void main(){ float d = length(gl_PointCoord - .5) * 2.; float a = exp(-d * d * 6.) * .6 + exp(-d * d * 30.); gl_FragColor = vec4(vC * a, 1.); }',
  });
  const points = (arr, cols, intens, sizes) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setAttribute('aI', new THREE.Float32BufferAttribute(intens, 1)); g.setAttribute('aS', new THREE.Float32BufferAttribute(sizes, 2));
    const p = new THREE.Points(g, spriteMat()); p.frustumCulled = false; scene.add(p); return p;
  };
  let lampPts;
  { const P = [], C = [], I = [], Z = [];
    for (let k = 0; k < lamps.length; k += 2) { const x = lamps[k], z = lamps[k + 1], h = Math.abs(Math.sin(x * 12.9 + z * 78.2)) * 1e4 % 1; P.push(x, Hreal(x, z) + 6, z); h < .25 ? C.push(.95, .95, 1) : C.push(1, .62, .25); I.push(.9 + h * .4); Z.push(26, 1.2); }
    lampPts = points(P, C, I, Z);
  }
  // Faros y luces de navegación: secuencia REAL de OSM (seamark:light:sequence) o, si falta, según character/group/period
  const COL = { white: [1, .97, .9], red: [1, .15, .1], green: [.2, 1, .35], yellow: [1, .85, .2], blue: [.3, .5, 1] };
  const faros = D.faros.map(f => {
    const t = f.tags || {}, g = k => t['seamark:light:' + k] ?? t['seamark:light:1:' + k];
    const col = COL[(g('colour') || 'white').split(';')[0]] || COL.white, gh = Math.max(0, Hgt(f.x, f.z));
    const y = Math.max(gh + (f.kind == 'faro' ? 18 : 4), parseFloat(g('height')) || 0);
    return { ...f, col, y, gh, range: parseFloat(g('range')) || (f.kind == 'faro' ? 15 : 2), pattern: pattern(g('character'), g('group'), parseFloat(g('period')), g('sequence')) };
  });
  const faroPts = faros.length ? points(faros.flatMap(f => [f.x, f.y, f.z]), faros.flatMap(f => f.col), faros.map(() => 1), faros.flatMap(f => f.kind == 'faro' ? [500, 4] : [40, 2])) : null;
  const beams = [], tower = new THREE.MeshLambertMaterial({ color: '#e9e6df' });
  scene.add(new THREE.HemisphereLight('#dfe9f5', '#556644', 1.2));
  for (const f of faros) if (f.kind == 'faro') {
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, f.y - f.gh, 10), tower); tw.position.set(f.x, (f.y + f.gh) / 2, f.z); scene.add(tw);
    const L = Math.max(2500, Math.min(16000, f.range * 1852 * .3)), beam = new THREE.Group(); beam.position.set(f.x, f.y, f.z);
    for (const s of [1, -1]) {
      beam.add(new THREE.Mesh(new THREE.ConeGeometry(L * .05, L, 24, 1, true).translate(0, -L / 2, 0).rotateZ(s * Math.PI / 2), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uC: { value: new THREE.Color(...f.col) }, uK: { value: 1 }, uLen: { value: L } },
        vertexShader: 'uniform float uLen; varying float vL; varying vec3 vN, vV; void main(){ vL = abs(position.x) / uLen; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform vec3 uC; uniform float uK; varying float vL; varying vec3 vN, vV; void main(){ float e = abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(uC * pow(e, 2.) * (1. - vL) * (1. - vL) * .3 * uK, 1.); }',
      })));
    }
    scene.add(beam); beams.push({ beam, f, speed: 2 * Math.PI / Math.max(8, (f.pattern.period || 5) * 2) });
  }
  // Destino: anillo y columna de luz
  const markGroup = new THREE.Group(); scene.add(markGroup);
  const labels = [];
  const label = (text, x, y, z, cls = '') => { const el = document.createElement('div'); el.className = 'ilabel ' + cls; el.textContent = text; document.body.appendChild(el); labels.push({ el, p: new THREE.Vector3(x, y, z) }); };
  for (const f of faros) if (f.kind == 'faro' && f.name) label(f.name, f.x, f.y + 200, f.z, 'faro');
  for (const m of marks) {
    const y = Math.max(0, Hgt(m.x, m.z)) + 3; label(m.name, m.x, y + 900, m.z, 'dest');
    const mat = o => new THREE.MeshBasicMaterial({ color: '#6fd3ff', transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(160, 210, 64).rotateX(-Math.PI / 2), mat(.8)); ring.position.set(m.x, y, m.z); markGroup.add(ring);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 800, 8, 1, true).translate(0, 400, 0), mat(.55)); col.position.set(m.x, y, m.z); markGroup.add(col);
  }

  // ---- Cámara: órbita lenta alrededor de la isla ----
  const cx = (I0 + I1) / 2, cz = (J0 + J1) / 2, center = new THREE.Vector3(cx, 0, cz);
  // Distancia para que quepa la isla de punta a punta (Ciutadella a la izquierda, Maó y Es Castell a la derecha)
  let R = 1; const fitR = () => { const hf = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect); R = Math.max((I1 - I0) * .5 / Math.tan(hf) * .9, (J1 - J0) * 1.5); };
  fitR(); addEventListener('resize', fitR);
  let ang = 0, fly = null, hold = false, running = true, last = performance.now();
  const look = new THREE.Vector3(), v = new THREE.Vector3();
  const orbit = (a, out, k = 1) => out.set(cx + Math.sin(a) * R * k, R * k * .72, cz + Math.cos(a) * R * k);
  orbit(ang, camera.position); camera.lookAt(center); look.copy(center);
  const unsub = dayNight.on(n => {
    uL.value.copy(MOON).lerp(SUN, 1 - n).normalize(); uFog.value.copy(FOG_D).lerp(FOG_N, n);
    uFogD.value = 1 / (90000 + 60000 * (1 - n)); renderer.toneMappingExposure = 1.15 - .25 * (1 - n);
    lampPts.material.uniforms.uOn.value = n; if (faroPts) faroPts.material.uniforms.uOn.value = .1 + .9 * n;
    for (const b of beams) b.beam.visible = n > .05;
  });
  const loop = now => {
    if (!running) return; requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now; uTime.value += dt;
    if (hold) { /* vuelo terminado: cámara quieta hasta el fundido */ }
    else if (!fly) { const t = uTime.value; orbit(ang + .07 * Math.sin(t * .09) + .025 * Math.sin(t * .23), camera.position, 1 + .025 * Math.sin(t * .13));   // vaivén suave que vuelve a su sitio
      camera.position.y += Math.sin(uTime.value * .17) * R * .01; camera.lookAt(center); }
    else {
      fly.t += dt; const k = Math.min(1, fly.t / fly.dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(fly.p0, fly.p1, e); camera.position.y += Math.sin(Math.PI * e) * fly.arc;
      look.lerpVectors(fly.l0, fly.l1, Math.min(1, e * 1.4)); camera.lookAt(look);
      camera.fov = fly.f0 + (60 - fly.f0) * e; camera.updateProjectionMatrix(); setScale();
      if (k >= 1) { const r = fly.res; fly = null; hold = true; r(); }
    }
    if (faroPts) { const A = faroPts.geometry.attributes.aI; faros.forEach((f, i) => A.setX(i, .2 + f.pattern.at(uTime.value) * 1.8)); A.needsUpdate = true; }
    for (const b of beams) { b.beam.rotation.y = uTime.value * b.speed; b.beam.children.forEach(c => { c.material.uniforms.uK.value = (.35 + .65 * b.f.pattern.at(uTime.value)) * uNight.value; }); }
    const pulse = .5 + .5 * Math.sin(uTime.value * 2.2); markGroup.children.forEach((c, i) => { c.material.opacity = (i % 2 ? .35 : .55) + pulse * .35; if (!(i % 2)) c.scale.setScalar(1 + pulse * .15); });
    for (const l of labels) {
      v.copy(l.p).project(camera); const on = !fly && !hold && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      l.el.style.display = on ? 'block' : 'none';
      if (on) { l.el.style.left = (v.x * .5 + .5) * innerWidth + 'px'; l.el.style.top = (-v.y * .5 + .5) * innerHeight + 'px'; }
    }
    // Plano cercano según la altura de la cámara: desde 30 km de altura hace falta para que el mar y la hierba no parpadeen
    const nearP = Math.max(5, Math.min(4000, camera.position.y * .12)); if (Math.abs(nearP - camera.near) > 1) { camera.near = nearP; camera.updateProjectionMatrix(); }
    renderer.render(scene, camera);
  };
  requestAnimationFrame(loop);

  return {
    Hgt, faros: faros.length,
    // Vuelo hasta la vista aérea del juego: cámara a 600 m sobre el punto, mirando hacia abajo (como scene/followCamera)
    flyTo(x, y, z, dur = 7) {
      return new Promise(res => {
        fly = { t: 0, dur, p0: camera.position.clone(), p1: new THREE.Vector3(x, y + 600, z + 1), l0: (fly ? look : center).clone(), l1: new THREE.Vector3(x, y, z), f0: camera.fov, arc: 1500, res };
      });
    },
    fadeOut(ms = 1400) {
      canvas.style.transition = `opacity ${ms}ms`; canvas.style.opacity = 0; labels.forEach(l => l.el.remove());
      return new Promise(res => setTimeout(() => { running = false; unsub(); removeEventListener('resize', onResize); renderer.dispose(); renderer.forceContextLoss(); canvas.style.display = 'none'; res(); }, ms));
    },
  };
}

// Ritmo de una luz náutica (OSM seamark:light:*). Devuelve { period, at(t) → 0..1 }.
//   Si hay «sequence» (p. ej. "0.5+(1.5)+0.5+(4.5)": encendida 0,5 s, apagada 1,5 s…) se usa tal cual (REAL).
//   Si no: F fija · Fl destellos · LFl destellos largos · Q / VQ centelleante · Oc ocultaciones · Iso isofase.
export function pattern(ch = 'Fl', group = '1', period = NaN, sequence = '') {
  const seq = [];   // [encendida, duración]
  if (sequence) for (const tk of String(sequence).split(/[+,]/)) { const m = tk.trim().match(/^(\()?\s*([\d.]+)\s*\)?$/); if (m && +m[2] > 0) seq.push([m[1] ? 0 : 1, +m[2]]); }
  if (!seq.length) {
    ch = String(ch || 'Fl').trim(); const groups = String(group || '1').split('+').map(g => parseInt(g) || 1);
    if (/^F$/i.test(ch)) return { period: 0, at: () => 1 };
    if (/^Iso/i.test(ch)) { const P = period || 4; seq.push([1, P / 2], [0, P / 2]); }
    else if (/^Oc/i.test(ch)) { const P = period || 5; for (const g of groups) for (let i = 0; i < g; i++) seq.push([0, 1], [1, .7]); const used = seq.reduce((s, x) => s + x[1], 0); seq.push([1, Math.max(.5, P - used)]); }
    else if (/^V?Q/i.test(ch)) { const f = /^VQ/i.test(ch) ? .25 : .5, n = groups.reduce((a, b) => a + b, 0) || 1; for (let i = 0; i < n; i++) seq.push([1, f * .4], [0, f * .6]); if (period) seq.push([0, Math.max(0, period - n * f)]); }
    else { const on = /^LFl/i.test(ch) ? 2 : .5, P = period || 5; groups.forEach((g, gi) => { for (let i = 0; i < g; i++) seq.push([1, on], [0, 1]); if (gi < groups.length - 1) seq.push([0, 1.5]); }); const used = seq.reduce((s, x) => s + x[1], 0); seq.push([0, Math.max(.5, P - used)]); }
  }
  const P = seq.reduce((s, x) => s + x[1], 0);
  return { period: P, at(t) { let r = t % P; for (const [o, d] of seq) { if (r < d) return o ? Math.min(1, Math.min(r, d - r) * 12 + .2) : 0; r -= d; } return 0; } };
}
