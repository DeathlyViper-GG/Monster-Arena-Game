import * as THREE from "three";
import {
  TAU,
  clamp01,
  rand,
  smoothstep,
  createDesertEnvMap,
  createDesertMaterials,
  createDesertSky,
  createDuneField,
  duneHeight,
  createSandStorm,
  createSunFlare,
  createObelisk,
  createSandCurtain,
  createGroundFog,
} from "./DesertKit";

/* ═════════════════════════════════════════════════════════════════
   SCENE ONE — THE SUNKEN DUNES
   A dusk desert: glaring low sun, layered crest lines receding to the
   horizon, wind-driven sand, and Nhalori obelisks half-swallowed by
   the drift.
   ═════════════════════════════════════════════════════════════════ */

export default function createDunesScene({ renderer }) {
  const scene = new THREE.Scene();
  const mats = createDesertMaterials();

  scene.fog = new THREE.FogExp2(0x4a2412, 0.0024);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 3200);
  camera.position.set(0, 17, 92);

  scene.environment = createDesertEnvMap(renderer);

  const sunDir = new THREE.Vector3(0.34, 0.1, -0.93).normalize();

  const sky = createDesertSky({
    top: 0x1a0b28,
    horizon: 0xe07a34,
    sun: 0xfff1c6,
    dust: 0xcf9450,
    sunDir,
  });
  scene.add(sky.mesh);

  const flare = createSunFlare({ position: sunDir.clone().multiplyScalar(1400), size: 520 });
  scene.add(flare.group);

  /* lighting: burning low sun + cool sky bounce */
  scene.add(new THREE.HemisphereLight(0x6a3a52, 0x2a1408, 0.55));

  const sunLight = new THREE.DirectionalLight(0xffb473, 2.7);
  sunLight.position.copy(sunDir).multiplyScalar(400);
  scene.add(sunLight);

  const fill = new THREE.DirectionalLight(0x8fa8cc, 0.55);
  fill.position.set(-160, 90, 220);
  scene.add(fill);

  /* the dune sea */
  const terrain = createDuneField({
    size: 2600,
    segments: 320,
    material: mats.sand({ vertexColors: true, roughness: 0.98, metalness: 0.02 }),
  });
  scene.add(terrain);

  /* half-buried Nhalori obelisks along a receding ridge */
  const obeliskMaterial = mats.stone({ color: 0x7a5a35, roughness: 0.92 });
  const runeGold = mats.gold({ emissive: 0x7a4a12, emissiveIntensity: 0.9 });
  const ruins = [
    { x: -74, z: -210, h: 34, r: 2.1 },
    { x: -46, z: -252, h: 22, r: 1.6 },
    { x: 58, z: -232, h: 30, r: 1.9 },
    { x: 96, z: -290, h: 18, r: 1.4 },
    { x: -140, z: -330, h: 26, r: 1.7 },
  ];
  for (let i = 0; i < ruins.length; i++) {
    const ruin = ruins[i];
    const ground = duneHeight(ruin.x, ruin.z);
    const obelisk = createObelisk({
      height: ruin.h,
      radius: ruin.r,
      material: obeliskMaterial,
      runeMaterial: runeGold,
      seed: i,
    });
    obelisk.position.set(ruin.x, ground - ruin.h * 0.28, ruin.z);
    obelisk.rotation.z = rand(-0.05, 0.05);
    scene.add(obelisk);
  }

  /* a buried wall catching the light */
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(150, 12, 9, 24, 4, 3),
    mats.stone({ color: 0x6c4d2d, roughness: 0.95 }),
  );
  const wallGround = duneHeight(-120, -262);
  wall.position.set(-120, wallGround - 3.4, -262);
  wall.rotation.y = -0.34;
  wall.rotation.z = 0.03;
  scene.add(wall);

  /* wind curtains sweeping the middle distance */
  const curtains = [];
  for (let i = 0; i < 4; i++) {
    const curtain = createSandCurtain({
      width: 460 + i * 120,
      height: 120 + i * 26,
      x: -120 + i * 96,
      z: -150 - i * 120,
      opacity: 0.1 + i * 0.02,
    });
    scene.add(curtain);
    curtains.push({ mesh: curtain, drift: rand(2.4, 5.6), phase: rand(0, TAU) });
  }

  /* ground haze + the storm itself */
  const haze = createGroundFog({ size: 900, color: 0xe3ab72, density: 0.46, y: 5.5 });
  scene.add(haze.mesh);

  const storm = createSandStorm({ count: 11000, area: 360, height: 96, size: 1.7, speed: 1.1, opacity: 0.42 });
  scene.add(storm.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    haze.update(time * 1.25);
    storm.update(time);

    flare.halo.material.opacity = 0.6 + Math.sin(time * 0.6) * 0.07;
    flare.streak.material.opacity = 0.28 + Math.sin(time * 0.43) * 0.06;
    flare.disc.rotation.y = time * 0.02;

    for (const curtain of curtains) {
      curtain.mesh.position.x += Math.sin(time * 0.1 + curtain.phase) * curtain.drift * delta;
      curtain.mesh.position.x += 3.2 * delta;
      if (curtain.mesh.position.x > 260) curtain.mesh.position.x = -260;
      curtain.mesh.material.opacity = 0.09 + 0.05 * Math.sin(time * 0.34 + curtain.phase);
    }

    const intro = clamp01(time / 12);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;

    camera.position.set(
      px * 7 + Math.sin(time * 0.08) * 3.4,
      18 + eased * 4.5 + Math.sin(time * 0.22) * 0.34,
      94 - eased * 46,
    );
    camera.lookAt(px * 6, 12 + eased * 1.5, -400);
  };

  return { scene, camera, baseFov: 44, update };
}