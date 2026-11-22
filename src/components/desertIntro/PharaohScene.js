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
  createSandVortex,
  createSunFlare,
  createGroundFog,
  createRuneCircle,
  createPharaoh,
} from "./DesertKit";

/* ═════════════════════════════════════════════════════════════════
   SCENE TWO — THE PHARAOH OF GLASS
   A colossus of sand-fused glass standing in the wreck of a storm,
   sand spiralling around him, shattered panes orbiting like knives,
   and two cold blue eyes burning behind the mask.
   ═════════════════════════════════════════════════════════════════ */

export default function createPharaohScene({ renderer }) {
  const scene = new THREE.Scene();
  const mats = createDesertMaterials();

  scene.fog = new THREE.FogExp2(0x33200f, 0.0135);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 2200);
  camera.position.set(0, 4.8, 30);

  scene.environment = createDesertEnvMap(renderer);

  const sunDir = new THREE.Vector3(-0.28, 0.09, -0.95).normalize();

  const sky = createDesertSky({
    top: 0x120820,
    horizon: 0xc8622a,
    sun: 0xffe9b8,
    dust: 0xb8783c,
    sunDir,
  });
  scene.add(sky.mesh);

  const flare = createSunFlare({ position: sunDir.clone().multiplyScalar(700), size: 260 });
  scene.add(flare.group);

  /* lighting */
  scene.add(new THREE.HemisphereLight(0x5c3140, 0x190c06, 0.5));

  const keyLight = new THREE.DirectionalLight(0xffab66, 2.2);
  keyLight.position.set(-60, 46, 40);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xbfe7ff, 3.6);
  rimLight.position.set(18, 22, -46);
  scene.add(rimLight);

  const groundLight = new THREE.PointLight(0xff9c4a, 30, 46, 2);
  groundLight.position.set(0, 1.2, 2.6);
  scene.add(groundLight);

  const eyeLight = new THREE.PointLight(0x9ff2ff, 18, 20, 2);
  eyeLight.position.set(0, 7.6, 1.8);
  scene.add(eyeLight);

  /* a flattened storm crater */
  const heightFn = (x, z) => {
    const distance = Math.hypot(x, z);
    const flat = smoothstep(7, 34, distance);
    const dunes = (fbm2(x * 0.012, z * 0.012, 4) - 0.5) * 13 * flat;
    const rim = Math.exp(-Math.pow((distance - 46) / 22, 2)) * 7 * flat;
    const grit = (fbm2(x * 0.08, z * 0.08, 3) - 0.5) * 0.5;
    return dunes + rim + grit;
  };

  const terrain = createDuneField({
    size: 700,
    segments: 220,
    heightFn,
    material: mats.sand({ vertexColors: true, roughness: 0.97, metalness: 0.02 }),
  });
  scene.add(terrain);

  /* a circle of gold runes cut into the sand */
  const runeRing = createRuneCircle({
    radius: 8.6,
    color: 0xffd7a0,
    opacity: 0.36,
    y: 0.09,
    rings: 2,
    glyphs: 52,
  });
  scene.add(runeRing);

  /* the colossus */
  const pharaoh = createPharaoh(mats);
  scene.add(pharaoh.group);

  /* the sand veil that streams off him */
  const veil = createSandVortex({ count: 3200, radius: 5.2, height: 16, color: 0xffd39a, opacity: 0.62 });
  veil.mesh.position.y = -0.4;
  scene.add(veil.mesh);

  /* shattered panes orbiting like knives */
  const halo = [];
  for (let i = 0; i < 16; i++) {
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(rand(0.12, 0.3), 0),
      mats.glass({ color: 0xd8f2ff, opacity: 0.72, emissive: 0x2e7f9e, emissiveIntensity: 1.5 }),
    );
    shard.scale.set(1, rand(2.2, 4.0), 1);
    scene.add(shard);
    halo.push({
      mesh: shard,
      radius: rand(2.6, 6.2),
      speed: rand(0.1, 0.3) * (i % 2 === 0 ? 1 : -1),
      phase: rand(0, TAU),
      y: rand(1.8, 10.6),
      bob: rand(0.3, 1.1),
    });
  }

  /* a congregation of glass statues watching */
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * TAU + 0.6;
    const distance = rand(15, 22);
    const statue = new THREE.Mesh(
      new THREE.CapsuleGeometry(rand(0.7, 1.1), rand(3.2, 5.4), 6, 14),
      mats.glass({ color: 0xa9cfe6, opacity: 0.4, emissive: 0x1d3c4d, emissiveIntensity: 0.7 }),
    );
    const sx = Math.cos(angle) * distance;
    const sz = Math.sin(angle) * distance;
    statue.position.set(sx, heightFn(sx, sz) + 2, sz);
    statue.rotation.y = rand(0, TAU);
    scene.add(statue);
  }

  /* storm and haze */
  const storm = createSandStorm({ count: 5200, area: 170, height: 60, size: 1.35, speed: 1.5, opacity: 0.34 });
  scene.add(storm.mesh);

  const haze = createGroundFog({ size: 240, color: 0xe0a267, density: 0.58, y: 1.1 });
  scene.add(haze.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    storm.update(time * 1.4);
    haze.update(time * 1.6);
    veil.update(time);

    const breath = 1 + Math.sin(time * 1.05) * 0.009;
    pharaoh.group.scale.set(1, breath, 1);
    pharaoh.group.rotation.y = (pointer?.x ?? 0) * 0.06 + Math.sin(time * 0.17) * 0.04;
    pharaoh.group.position.y = Math.sin(time * 0.42) * 0.06;
    pharaoh.crown.rotation.y = time * 0.14;

    const flicker = 0.72 + Math.sin(time * 2.6) * 0.16 + Math.sin(time * 7.1) * 0.08;
    eyeLight.intensity = 17 * flicker;
    pharaoh.eyeMaterial.color.setRGB(0.62 * flicker * 6, 0.94 * flicker * 6, flicker * 6);
    pharaoh.hemGlow.material.opacity = 0.22 + Math.sin(time * 0.9) * 0.07;

    runeRing.rotation.z = time * 0.05;
    runeRing.material.opacity = 0.3 + Math.sin(time * 1.1) * 0.09;
    groundLight.intensity = 28 + Math.sin(time * 1.4) * 7;

    for (const item of halo) {
      const a = time * item.speed + item.phase;
      item.mesh.position.set(
        Math.cos(a) * item.radius,
        item.y + Math.sin(time * 0.6 + item.phase) * item.bob,
        Math.sin(a) * item.radius,
      );
      item.mesh.rotation.set(time * 1.1 + item.phase, time * 1.6, time * 0.8);
    }

    const intro = clamp01(time / 11);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;

    camera.position.set(
      px * 2.6 + Math.sin(time * 0.19) * 0.7,
      4.4 + eased * 2.2 + Math.sin(time * 0.33) * 0.12,
      31 - eased * 10.5,
    );
    camera.lookAt(px * 1.1, 6.2 + eased * 1.1 + Math.sin(time * 0.26) * 0.12, 0);
  };

  return { scene, camera, baseFov: 44, update };
}