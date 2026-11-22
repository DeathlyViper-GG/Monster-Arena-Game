import * as THREE from "three";
import { createSky, clamp01 } from "@/components/glacialArchive/Cutscene";
import {
  createVoidEnvMap,
  createVoidMaterials,
  createStarfield,
  createFloatingFragments,
  createMemoryVeils,
  createRift,
  createSoulStream,
  createRuneRing,
  rand,
} from "./VoidKit";

/* ═════════════════════════════════════════════════════════════════
   SCENE ONE — THE FRACTURE
   The camera drifts through a tear in the world: fragments of every
   realm tumbling in the dark, memory-light bleeding between them,
   and a rift opening ahead.
   ═════════════════════════════════════════════════════════════════ */

export default function createFractureScene({ renderer }) {
  const scene = new THREE.Scene();
  const materials = createVoidMaterials();
  scene.fog = new THREE.FogExp2(0x0a0420, 0.0021);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 4000);
  camera.position.set(0, 16, 190);

  scene.environment = createVoidEnvMap(renderer);

  const sky = createSky({
    top: 0x050109,
    horizon: 0x3c0f57,
    glow: 0xd066ff,
    aurora: 0x35d6ff,
    auroraAmount: 1,
    moonDir: new THREE.Vector3(0.1, 0.28, -0.95),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x5a2a8a, 0x0a0418, 0.55));

  const riftLight = new THREE.DirectionalLight(0xd066ff, 1.9);
  riftLight.position.set(0, 120, -320);
  scene.add(riftLight);

  const cyanFill = new THREE.DirectionalLight(0x49d8ff, 0.9);
  cyanFill.position.set(-160, 60, 140);
  scene.add(cyanFill);

  const stars = createStarfield({ count: 5200, radius: 1500 });
  scene.add(stars.mesh);

  const rift = createRift({ width: 150, height: 480, color: 0xd066ff, opacity: 0.85 });
  rift.mesh.position.set(0, 74, -340);
  scene.add(rift.mesh);

  const innerRift = createRift({ width: 46, height: 400, color: 0xf2d4ff, opacity: 0.9 });
  innerRift.mesh.position.set(0, 74, -338);
  scene.add(innerRift.mesh);

  const fragments = createFloatingFragments({ count: 46, radius: 300, materials });
  scene.add(fragments);

  const veils = createMemoryVeils({ count: 9, radius: 230 });
  scene.add(veils);

  const souls = createSoulStream({ count: 1800, radius: 120, height: 120, color: 0xc9a4ff });
  souls.mesh.position.set(0, 40, -220);
  scene.add(souls.mesh);

  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = createRuneRing({
      radius: 30 + i * 12,
      color: i % 2 ? 0x49d8ff : 0xb06cff,
      opacity: 0.32,
      rings: 2,
      glyphs: 34 + i * 6,
    });
    ring.position.set(rand(-40, 40), 30 + i * 22, -150 - i * 50);
    ring.rotation.z = rand(-0.3, 0.3);
    scene.add(ring);
    rings.push({ ring, spin: rand(-0.09, 0.09) });
  }

  const update = (time, delta, pointer) => {
    sky.update(time);
    stars.update(time);
    rift.update(time);
    innerRift.update(time);
    fragments.userData.update(time);
    veils.userData.update(time);
    souls.update(time);
    for (const entry of rings) entry.ring.rotation.z += entry.spin * delta;

    const intro = clamp01(time / 18);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;

    camera.position.set(
      px * 20 + Math.sin(time * 0.07) * 8,
      20 + eased * 10 - py * 12,
      200 - eased * 108,
    );
    camera.lookAt(px * 12, 70 + eased * 8, -340);
  };

  return { scene, camera, baseFov: 46, update };
}