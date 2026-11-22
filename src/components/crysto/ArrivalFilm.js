import * as THREE from "three";
import { createHoodedFigure, clamp01, rand } from "@/components/glacialArchive/Cutscene";
import { createFireflies } from "@/components/realmCinematic/finish";
import {
  createStage,
  createCrystoMaterials,
  createVillage,
  scatterTrees,
  createClouds,
  createBirds,
  createMeadowDust,
  createKeep,
  createGroundFog,
  valeHeight,
  glowTexture,
} from "./CrystoKit";

/* ═════════════════════════════════════════════════════════════════
   CRYSTO I — THE VALE OF DRANE
   Coming down out of the cloud onto a continent nobody in the arena
   has ever seen: green hills, a smoke-wisped village of plaster and
   oak, and a keep on the far ridge holding a dark stone.
   ═════════════════════════════════════════════════════════════════ */

const SKY = { top: 0x18355f, horizon: 0xbcd6e8, glow: 0xffe6b8, aurora: 0x8fb7d8 };

function world(m, { trees = 60 } = {}) {
  const village = createVillage(m, { count: 7, radius: 15 });
  village.position.y = valeHeight(0, 0);
  const treesGroup = scatterTrees(m, valeHeight, { count: trees, radius: 210, skip: 32 });
  return { village, treesGroup };
}

/* I — out of the cloud */
export function createArrivalOne() {
  const m = createCrystoMaterials();
  const stage = createStage({ sky: SKY, fog: 0xa8c0cf, fogDensity: 0.0026 });
  const { scene, camera } = stage;

  const { village, treesGroup } = world(m);
  scene.add(village, treesGroup);
  const clouds = createClouds({ count: 18, radius: 240, height: 78 });
  const birds = createBirds({ count: 14, radius: 70, height: 46 });
  scene.add(clouds, birds);

  const update = (t) => {
    stage.sky.update(t);
    clouds.userData.update(t);
    birds.userData.update(t);
    const e = clamp01(t / 22);
    const k = e * e * (3 - 2 * e);
    camera.position.set(-46 + k * 34, 118 - k * 52, 168 - k * 62);
    camera.lookAt(0, 5, 0);
  };
  return { scene, camera, baseFov: 46, shadowExtent: 70, update };
}

/* II — the vale at eye level, the warden at her well */
export function createArrivalTwo() {
  const m = createCrystoMaterials();
  const stage = createStage({ sky: SKY, fog: 0xb7cad4, fogDensity: 0.0042 });
  const { scene, camera } = stage;

  const { village, treesGroup } = world(m, { trees: 48 });
  scene.add(village, treesGroup);

  const warden = createHoodedFigure({ height: 2.3, material: m.cloth(0x2f5f52), seed: 5 });
  warden.position.set(2.6, valeHeight(2.6, 1.8), 1.8);
  warden.rotation.y = -0.6;
  scene.add(warden);

  const lantern = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "255,190,110"), color: 0xffb45c, transparent: true,
      opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  lantern.scale.setScalar(5);
  lantern.position.set(3.1, 2.1, 2.2);
  scene.add(lantern);

  const fireflies = createFireflies({ count: 150, radius: 22, height: 7 });
  const dust = createMeadowDust({ count: 700, area: 70, height: 16 });
  scene.add(fireflies.points, dust);

  const update = (t) => {
    stage.sky.update(t);
    fireflies.update(t);
    dust.userData.update(t);
    lantern.material.opacity = 0.6 + 0.2 * Math.sin(t * 2.4);
    const a = t * 0.055;
    camera.position.set(Math.sin(a) * 15, 3.6 + Math.sin(t * 0.2) * 0.3, Math.cos(a) * 15);
    camera.lookAt(1.2, 3.1, 0.8);
  };
  return { scene, camera, baseFov: 40, shadowExtent: 40, update };
}

/* III — the keep on the far ridge, and the stone that has gone dark */
export function createArrivalThree() {
  const m = createCrystoMaterials();
  const stage = createStage({
    sky: { top: 0x241d3d, horizon: 0xc08a6a, glow: 0xffb27a, aurora: 0x7a5fa0 },
    fog: 0x6f5a63,
    fogDensity: 0.0052,
    sun: 0xffb27a,
    sunStrength: 1.7,
  });
  const { scene, camera } = stage;

  const keep = createKeep(m, { lit: false });
  keep.position.y = valeHeight(0, 0);
  scene.add(keep);

  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rand(60, 190);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const tree = scatterTrees(m, valeHeight, { count: 1, radius: 1, skip: 0 });
    tree.position.set(x, valeHeight(x, z) - 0.4, z);
    scene.add(tree);
  }

  const mist = createGroundFog({ size: 420, color: 0xb9a2a8, density: 0.6, y: 2 });
  scene.add(mist.mesh);

  const update = (t) => {
    stage.sky.update(t);
    mist.update(t * 0.8);
    keep.userData.update(t);
    const e = clamp01(t / 24);
    const k = e * e * (3 - 2 * e);
    camera.position.set(-30 + k * 22, 8 - k * 2.5, 96 - k * 34);
    camera.lookAt(0, 15, 0);
  };
  return { scene, camera, baseFov: 42, shadowExtent: 90, update };
}