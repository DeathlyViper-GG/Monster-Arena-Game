import * as THREE from "three";
import {
  TAU,
  clamp01,
  rand,
  fbm2,
  smoothstep,
  glowTexture,
  createDesertEnvMap,
  createDesertMaterials,
  createDesertSky,
  createDuneField,
  createSandStorm,
  createSunFlare,
  createGroundFog,
  createRuneCircle,
  createObelisk,
  createGlassPyramid,
} from "./DesertKit";

/* ═════════════════════════════════════════════════════════════════
   SCENE THREE — THE GLASS TOMB
   The prismatic pyramid on its plinth, the second shard burning inside
   it, a gold rune circle in the drift, obelisks keeping watch, and the
   storm closing overhead.
   ═════════════════════════════════════════════════════════════════ */

export default function createPyramidScene({ renderer }) {
  const scene = new THREE.Scene();
  const mats = createDesertMaterials();

  scene.fog = new THREE.FogExp2(0x3a2110, 0.0085);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2200);
  camera.position.set(0, 11, 58);

  scene.environment = createDesertEnvMap(renderer);

  const sunDir = new THREE.Vector3(0.12, 0.07, -0.99).normalize();

  const sky = createDesertSky({
    top: 0x150a22,
    horizon: 0xd86f2f,
    sun: 0xffedc2,
    dust: 0xc48344,
    sunDir,
  });
  scene.add(sky.mesh);

  const flare = createSunFlare({ position: sunDir.clone().multiplyScalar(900), size: 340 });
  scene.add(flare.group);

  scene.add(new THREE.HemisphereLight(0x5e3342, 0x1b0d07, 0.52));

  const sunLight = new THREE.DirectionalLight(0xffb070, 2.3);
  sunLight.position.copy(sunDir).multiplyScalar(320);
  scene.add(sunLight);

  const rimLight = new THREE.DirectionalLight(0xa9ddff, 2.4);
  rimLight.position.set(-40, 40, 90);
  scene.add(rimLight);

  /* flat plateau ringed by dunes */
  const heightFn = (x, z) => {
    const distance = Math.hypot(x, z);
    const plateau = smoothstep(34, 96, distance);
    const dunes = (fbm2(x * 0.011, z * 0.011, 4) - 0.5) * 20 * plateau;
    const drift = Math.exp(-Math.pow((distance - 120) / 70, 2)) * 14;
    const grit = (fbm2(x * 0.07, z * 0.07, 3) - 0.5) * 0.5;
    return dunes + drift * plateau + grit;
  };

  const terrain = createDuneField({
    size: 1100,
    segments: 260,
    heightFn,
    material: mats.sand({ vertexColors: true, roughness: 0.97, metalness: 0.02 }),
  });
  scene.add(terrain);

  /* gold rune circle in the drift around the plinth */
  const outerRing = createRuneCircle({
    radius: 24,
    color: 0xffd7a0,
    opacity: 0.32,
    y: 0.1,
    rings: 2,
    glyphs: 64,
  });
  scene.add(outerRing);

  const innerRing = createRuneCircle({
    radius: 12.5,
    color: 0xffe4bb,
    opacity: 0.42,
    y: 0.14,
    rings: 1,
    glyphs: 40,
  });
  scene.add(innerRing);

  /* the tomb */
  const pyramid = createGlassPyramid({ base: 9.5, height: 14, mats });
  scene.add(pyramid.group);

  /* obelisks keeping watch */
  const obeliskMaterial = mats.stone({ color: 0x74542f, roughness: 0.92 });
  const runeGold = mats.gold({ emissive: 0x7d4a10, emissiveIntensity: 0.95 });
  for (let i = 0; i < 4; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const depth = i < 2 ? 14 : -16;
    const obelisk = createObelisk({
      height: i < 2 ? 22 : 17,
      radius: 1.5,
      material: obeliskMaterial,
      runeMaterial: runeGold,
      seed: i * 1.7,
    });
    obelisk.position.set(side * (i < 2 ? 22 : 19), 0, depth);
    obelisk.rotation.z = side * 0.02;
    scene.add(obelisk);
  }

  /* sand streaming through the storm */
  const storm = createSandStorm({ count: 8200, area: 260, height: 80, size: 1.55, speed: 1.25, opacity: 0.4 });
  scene.add(storm.mesh);

  const haze = createGroundFog({ size: 460, color: 0xe2a870, density: 0.5, y: 2.2 });
  scene.add(haze.mesh);

  /* sand pouring off the pyramid's edges */
  const spilling = [];
  for (let i = 0; i < 3; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(128, "255,214,160"),
        color: 0xffc98f,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sprite.scale.set(rand(9, 16), rand(16, 26), 1);
    sprite.position.set(rand(-7, 7), rand(2, 7), rand(-7, 7));
    scene.add(sprite);
    spilling.push({ sprite, phase: rand(0, TAU), drift: rand(0.4, 1.1) });
  }

  const update = (time, delta, pointer) => {
    sky.update(time);
    storm.update(time);
    haze.update(time * 1.15);

    pyramid.shard.rotation.y = time * 0.34;
    pyramid.shard.position.y = 14 * 0.42 + Math.sin(time * 0.7) * 0.22;
    pyramid.core.rotation.y = -time * 0.6;
    pyramid.innerLight.intensity = 40 + Math.sin(time * 1.6) * 10 + Math.sin(time * 3.4) * 4;
    pyramid.halo.material.opacity = 0.48 + Math.sin(time * 1.2) * 0.12;
    pyramid.shell.material.opacity = 0.46 + Math.sin(time * 0.8) * 0.06;

    outerRing.rotation.z = time * 0.022;
    innerRing.rotation.z = -time * 0.034;
    outerRing.material.opacity = 0.26 + Math.sin(time * 0.9) * 0.07;
    innerRing.material.opacity = 0.34 + Math.sin(time * 1.3) * 0.08;

    for (const item of spilling) {
      item.sprite.position.y += Math.sin(time * 0.6 + item.phase) * 0.01;
      item.sprite.material.opacity = 0.12 + Math.sin(time * 0.5 + item.phase) * 0.05;
      item.sprite.position.x += Math.sin(time * 0.14 + item.phase) * item.drift * delta;
    }

    const intro = clamp01(time / 12);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;

    camera.position.set(
      px * 3.4 + Math.sin(time * 0.1) * 1.1,
      11.5 - eased * 3.4 + Math.sin(time * 0.24) * 0.16,
      58 - eased * 25,
    );
    camera.lookAt(px * 1.2, 7.6 + eased * 1.8, 0);
  };

  return { scene, camera, baseFov: 42, update };
}