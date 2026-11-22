import * as THREE from "three";
import { createHoodedFigure, clamp01, rand } from "@/components/glacialArchive/Cutscene";
import { createFireflies } from "@/components/realmCinematic/finish";
import {
  createStage,
  createCrystoMaterials,
  createSunstone,
  createVillage,
  scatterTrees,
  createBirds,
  createGodRay,
  createClouds,
  valeHeight,
  glowTexture,
} from "./CrystoKit";

/* ═════════════════════════════════════════════════════════════════
   CRYSTO IV — THE SUNSTONE
   The stone wakes in the dark hall, and the vale it was keeping warm
   finally sees its sun again.
   ═════════════════════════════════════════════════════════════════ */

const DAWN = { top: 0x1d2f57, horizon: 0xffcf9a, glow: 0xfff0c8, aurora: 0xa8c8e0 };

/* The hall the Sunstone stands in: a round wall and a dark ceiling, so the
   chamber reads as architecture instead of a field at night. */
function hall(m, scene) {
  const wallMat = m.stone(0x4d4a44);
  wallMat.side = THREE.BackSide;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(46, 46, 36, 24, 1, true), wallMat);
  wall.position.y = 17;
  scene.add(wall);
  const ceiling = new THREE.Mesh(
    new THREE.CircleGeometry(46, 24),
    new THREE.MeshStandardMaterial({ color: 0x181820, roughness: 1 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 34;
  scene.add(ceiling);
}

/* I — the hall, and the dead stone */
export function createDawnOne() {
  const m = createCrystoMaterials();
  const stage = createStage({
    sky: { top: 0x0a0c14, horizon: 0x2c3140, glow: 0x6a7590, aurora: 0x3f4a66 },
    fog: 0x14161f,
    fogDensity: 0.016,
    sun: 0x8fa4c8,
    sunStrength: 0.8,
    size: 12,
    segments: 3,
    heightFn: () => -26,
  });
  const { scene, camera } = stage;
  hall(m, scene);

  // the hall floor and its columns
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(46, 46, 1.6, 24), m.stone(0x5d5a52));
  floor.position.y = -0.8;
  floor.receiveShadow = true;
  scene.add(floor);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 26, 10), m.stone(0x6f6a60));
    col.position.set(Math.cos(a) * 26, 13, Math.sin(a) * 26);
    col.castShadow = true;
    scene.add(col);
  }

  const stone = createSunstone(m, { lit: false, scale: 1.3 });
  scene.add(stone);

  const shaft = createGodRay({ height: 60, radiusTop: 6, radiusBottom: 12, color: 0x9fb7d8, opacity: 0.07 });
  shaft.mesh.position.set(0, 30, 0);
  scene.add(shaft.mesh);

  const update = (t) => {
    stage.sky.update(t);
    stone.userData.update(t);
    shaft.update(t);
    const a = t * 0.06;
    camera.position.set(Math.sin(a) * 20, 6.5, Math.cos(a) * 20);
    camera.lookAt(0, 9, 0);
  };
  return { scene, camera, baseFov: 42, shadowExtent: 55, update };
}

/* II — it wakes */
export function createDawnTwo() {
  const m = createCrystoMaterials();
  const stage = createStage({
    sky: { top: 0x1a1a2c, horizon: 0xffc98a, glow: 0xfff2d0, aurora: 0xb8905f },
    fog: 0x3a2f34,
    fogDensity: 0.011,
    sun: 0xffd9a0,
    sunStrength: 1.9,
    size: 12,
    segments: 3,
    heightFn: () => -26,
  });
  const { scene, camera } = stage;
  hall(m, scene);

  const floor = new THREE.Mesh(new THREE.CylinderGeometry(46, 46, 1.6, 24), m.stone(0x6b665c));
  floor.position.y = -0.8;
  floor.receiveShadow = true;
  scene.add(floor);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 26, 10), m.stone(0x7a746a));
    col.position.set(Math.cos(a) * 26, 13, Math.sin(a) * 26);
    col.castShadow = true;
    scene.add(col);
  }

  const stone = createSunstone(m, { lit: true, scale: 1.3 });
  scene.add(stone);

  const rays = [];
  for (let i = 0; i < 5; i++) {
    const ray = createGodRay({ height: 80, radiusTop: 2, radiusBottom: 14, color: 0xffd9a0, opacity: 0.14 });
    ray.mesh.position.set(rand(-14, 14), 40, rand(-14, 14));
    scene.add(ray.mesh);
    rays.push(ray);
  }

  const sparks = createFireflies({ count: 220, radius: 30, height: 26, color: 0xffe0a0 });
  scene.add(sparks.points);

  const burst = new THREE.Mesh(
    new THREE.RingGeometry(4, 7, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffe6b0, transparent: true, opacity: 0.8,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  burst.rotation.x = -Math.PI / 2;
  burst.position.y = 0.4;
  scene.add(burst);

  const update = (t) => {
    stage.sky.update(t);
    stone.userData.update(t);
    sparks.update(t);
    rays.forEach((r) => r.update(t));
    const grow = 1 + ((t * 3) % 16);
    burst.scale.setScalar(grow);
    burst.material.opacity = Math.max(0, 0.8 * (1 - (grow - 1) / 16));
    const a = -t * 0.05;
    camera.position.set(Math.sin(a) * 23, 7.4, Math.cos(a) * 23);
    camera.lookAt(0, 9, 0);
  };
  return { scene, camera, baseFov: 44, shadowExtent: 55, update };
}

/* III — dawn over the vale */
export function createDawnThree() {
  const m = createCrystoMaterials();
  const stage = createStage({
    sky: { top: 0x2b4a7a, horizon: 0xffd6a2, glow: 0xfff6d8, aurora: 0xbfd8ec },
    fog: 0xc9d6d6,
    fogDensity: 0.003,
    sun: 0xffdca8,
    sunStrength: 2.7,
  });
  const { scene, camera } = stage;

  const village = createVillage(m, { count: 7, radius: 15 });
  village.position.set(0, valeHeight(0, 0), 0);
  scene.add(village);

  const trees = scatterTrees(m, valeHeight, { count: 70, radius: 190, skip: 28 });
  scene.add(trees);

  const hero = createHoodedFigure({ height: 2.4, material: m.cloth(0x2f6b4a), seed: 9 });
  hero.position.set(-6, valeHeight(-6, 34) + 0.2, 34);
  hero.rotation.y = 0.35;
  scene.add(hero);

  const sun = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(256, "255,240,200"), color: 0xfff0c0, transparent: true,
      opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  sun.scale.setScalar(220);
  sun.position.set(-120, 60, -280);
  scene.add(sun);

  const clouds = createClouds({ count: 14, radius: 260, height: 70 });
  const birds = createBirds({ count: 18, radius: 90, height: 40 });
  scene.add(clouds, birds);

  const update = (t) => {
    stage.sky.update(t);
    clouds.userData.update(t);
    birds.userData.update(t);
    const e = clamp01(t / 26);
    const k = e * e * (3 - 2 * e);
    camera.position.set(-30 - k * 10, 26 + k * 10, 96 - k * 24);
    camera.lookAt(-8, 10, 0);
  };
  return { scene, camera, baseFov: 46, shadowExtent: 90, update };
}