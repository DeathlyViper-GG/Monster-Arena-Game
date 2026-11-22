import * as THREE from "three";
import { clamp01 } from "@/components/glacialArchive/Cutscene";
import { createFireflies } from "@/components/realmCinematic/finish";
import {
  createStage,
  createCrystoMaterials,
  createShrine,
  createGodRay,
  createGroundFog,
  scatterTrees,
  valeHeight,
  glowTexture,
  rand,
} from "./CrystoKit";

/* ═════════════════════════════════════════════════════════════════
   CRYSTO II — THE THREE LIGHTS
   The last shrine wakes: cold stone, a ring of light running out
   across the grass, and three coloured beams standing over the vale.
   ═════════════════════════════════════════════════════════════════ */

const COLD = { top: 0x141c2e, horizon: 0x6d7f96, glow: 0x9fb7cc, aurora: 0x5f7fa0 };
const WARM = { top: 0x1b2f52, horizon: 0xc9d8df, glow: 0xffe3b0, aurora: 0x9fc4dd };

/* I — the shrine asleep in the mist */
export function createShrineOne() {
  const m = createCrystoMaterials();
  const stage = createStage({ sky: COLD, fog: 0x7d8b9c, fogDensity: 0.0072, sun: 0xaec4d8, sunStrength: 1.2 });
  const { scene, camera } = stage;

  const shrine = createShrine(m, { color: 0x7dffa3, lit: false });
  shrine.position.y = valeHeight(0, 0);
  scene.add(shrine);

  const trees = scatterTrees(m, valeHeight, { count: 26, radius: 70, skip: 26 });
  scene.add(trees);
  const mist = createGroundFog({ size: 240, color: 0xc8d4de, density: 0.85, y: 1.2 });
  scene.add(mist.mesh);

  const update = (t) => {
    stage.sky.update(t);
    mist.update(t * 0.7);
    shrine.userData.update(t);
    const a = t * 0.07;
    camera.position.set(Math.sin(a) * 22, 6 + Math.sin(t * 0.15) * 0.6, Math.cos(a) * 22);
    camera.lookAt(0, 7, 0);
  };
  return { scene, camera, baseFov: 42, shadowExtent: 45, update };
}

/* II — the orb wakes and light runs out over the ground */
export function createShrineTwo() {
  const m = createCrystoMaterials();
  const stage = createStage({ sky: WARM, fog: 0xa9bdc9, fogDensity: 0.0055, sun: 0xffe2b0, sunStrength: 2.1 });
  const { scene, camera } = stage;

  const shrine = createShrine(m, { color: 0x7dffa3, lit: true });
  shrine.position.y = valeHeight(0, 0);
  scene.add(shrine);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(13, 15, 64),
    new THREE.MeshBasicMaterial({
      color: 0x9dffc0, transparent: true, opacity: 0.85,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = valeHeight(0, 0) + 1.4;
  scene.add(ring);

  const rays = [];
  for (let i = 0; i < 4; i++) {
    const ray = createGodRay({ height: 90, radiusTop: 2.4, radiusBottom: 12, color: 0x9dffc0, opacity: 0.12 });
    ray.mesh.position.set(rand(-9, 9), 45, rand(-9, 9));
    scene.add(ray.mesh);
    rays.push(ray);
  }

  const fireflies = createFireflies({ count: 140, radius: 26, height: 12, color: 0xc8ffe0 });
  scene.add(fireflies.points);

  const update = (t) => {
    stage.sky.update(t);
    shrine.userData.update(t);
    fireflies.update(t);
    rays.forEach((r) => r.update(t));
    const grow = 1 + ((t * 2.2) % 12);
    ring.scale.setScalar(grow);
    ring.material.opacity = Math.max(0, 0.85 * (1 - (grow - 1) / 12));
    const a = -t * 0.05;
    camera.position.set(Math.sin(a) * 26, 8.5, Math.cos(a) * 26);
    camera.lookAt(0, 8, 0);
  };
  return { scene, camera, baseFov: 44, shadowExtent: 45, update };
}

/* III — three lights across the land */
export function createShrineThree() {
  const m = createCrystoMaterials();
  const stage = createStage({ sky: WARM, fog: 0xb9c9d2, fogDensity: 0.0034, sun: 0xffe2b0, sunStrength: 2.3 });
  const { scene, camera } = stage;

  const lights = [
    { x: -44, z: 18, color: 0x7dffa3 },
    { x: 52, z: -26, color: 0xff9a5c },
    { x: -18, z: -58, color: 0x6fd0ff },
  ];
  const beams = [];
  lights.forEach((l) => {
    const shrine = createShrine(m, { color: l.color, lit: true });
    shrine.position.set(l.x, valeHeight(l.x, l.z), l.z);
    shrine.scale.setScalar(0.8);
    scene.add(shrine);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 2.4, 130, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: l.color, transparent: true, opacity: 0.28,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    beam.position.set(l.x, valeHeight(l.x, l.z) + 65, l.z);
    scene.add(beam);
    beams.push({ beam, shrine, phase: rand(0, 6.28) });
  });

  const trees = scatterTrees(m, valeHeight, { count: 40, radius: 130, skip: 22 });
  scene.add(trees);

  const update = (t) => {
    stage.sky.update(t);
    beams.forEach((b) => {
      b.shrine.userData.update(t);
      b.beam.material.opacity = 0.2 + 0.1 * Math.sin(t * 1.6 + b.phase);
    });
    const e = clamp01(t / 20);
    const k = e * e * (3 - 2 * e);
    camera.position.set(0, 26 + k * 14, 92 - k * 22);
    camera.lookAt(0, 18, -6);
  };
  return { scene, camera, baseFov: 46, shadowExtent: 90, update };
}