import * as THREE from 'three';
import { dayNight } from '../core/dayNight.js';
// Escena del juego. El modo día/noche (core/dayNight.js) cambia cielo, niebla y luces con una transición suave.
const DAY = { sky: new THREE.Color(0xbfe3f2), near: 160, far: 900, hemi: [new THREE.Color(0xffffff), new THREE.Color(0x8a9a78), 2.4], sun: [new THREE.Color(0xfff2d8), 2.2], pos: new THREE.Vector3(300, 400, 150) };
const NIGHT = { sky: new THREE.Color(0x0b1426), near: 40, far: 520, hemi: [new THREE.Color(0x7f95c8), new THREE.Color(0x1c2230), .7], sun: [new THREE.Color(0xa9bdff), .55], pos: new THREE.Vector3(400, 120, 80) };
export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.setSize(innerWidth, innerHeight);
  const scene = new THREE.Scene(), sky = new THREE.Color();
  scene.background = sky; scene.fog = new THREE.Fog(sky, 160, 900);
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 5000);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9a78, 2.4); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2); sun.position.copy(DAY.pos); scene.add(sun);   // de noche hace de luna
  dayNight.on(n => {
    sky.copy(DAY.sky).lerp(NIGHT.sky, n); scene.fog.color.copy(sky);
    scene.fog.near = DAY.near + (NIGHT.near - DAY.near) * n; scene.fog.far = DAY.far + (NIGHT.far - DAY.far) * n;
    hemi.color.copy(DAY.hemi[0]).lerp(NIGHT.hemi[0], n); hemi.groundColor.copy(DAY.hemi[1]).lerp(NIGHT.hemi[1], n); hemi.intensity = DAY.hemi[2] + (NIGHT.hemi[2] - DAY.hemi[2]) * n;
    sun.color.copy(DAY.sun[0]).lerp(NIGHT.sun[0], n); sun.intensity = DAY.sun[1] + (NIGHT.sun[1] - DAY.sun[1]) * n; sun.position.copy(DAY.pos).lerp(NIGHT.pos, n);
  });
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  return { renderer, scene, camera };
}
