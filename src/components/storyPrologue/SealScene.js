import * as THREE from "three";
import {
  clamp01,
  createCracks,
  createGroundFog,
  createSky,
  createTerrain,
  fbm2,
} from "@/components/glacialArchive/Cutscene";
import { createEmbers } from "./PrologueKit";
import { createPrologueEnvMap, createPrologueMaterials } from "./PrologueKit";
import { createSealWall } from "./PrologueSets";

/* ═════════════════════════════════════════════════════════════════
   BEAT II — THE SEALS
   "Do you know how many ages I have waited behind these seals?"
   A colossal door held shut by five glowing seals and chains, with
   something violet pressing against it from the far side.
   ═════════════════════════════════════════════════════════════════ */

export default function createSealScene({ renderer }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0714, 0.0042);
  scene.background = new THREE.Color(0x0a0714);

  const camera = new THREE.PerspectiveCamera(44, 1, 1, 3000);
  camera.position.set(0, 92, 330);

  scene.environment = createPrologueEnvMap(renderer, { top: 0x07040f, horizon: 0x2a1740, ground: 0x040208 });
  const lib = createPrologueMaterials();

  const sky = createSky({
    top: 0x030108,
    horizon: 0x241038,
    glow: 0xb478ff,
    aurora: 0x4a1f80,
    auroraAmount: 0.7,
    moonDir: new THREE.Vector3(0.1, 0.24, -0.96),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x3a2058, 0x05030a, 0.55));

  const key = new THREE.DirectionalLight(0xb894ff, 1.2);
  key.position.set(-120, 220, 260);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x8a4cff, 1.6);
  rim.position.set(60, 120, -320);
  scene.add(rim);

  const heightFn = (x, z) =>
    (fbm2(x * 0.008, z * 0.008, 4) - 0.5) * 3 + (fbm2(x * 0.04, z * 0.04, 3) - 0.5) * 0.4;

  const terrain = createTerrain({
    size: 1400,
    segments: 200,
    heightFn,
    colors: { snow: 0x4d4363, rock: 0x1b1626, shadow: 0x06040b },
    material: lib.stone({ vertexColors: true, color: 0x8a80a8, roughness: 0.95, metalness: 0.06 }),
  });
  scene.add(terrain);

  scene.add(createCracks({ count: 30, start: 30, radius: 300, color: 0xa06cff, y: 0.12 }));

  const wall = createSealWall({ materials: lib });
  wall.position.set(0, 0, -30);
  scene.add(wall);

  const dust = createEmbers({ count: 2200, area: 320, height: 220, size: 1.8, color: 0xc9a4ff });
  scene.add(dust.mesh);

  const fog = createGroundFog({ size: 620, color: 0x9a6ad8, density: 0.4, y: 4 });
  scene.add(fog.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    dust.update(time);
    fog.update(time);
    wall.userData.update(time);

    const intro = clamp01(time / 16);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;

    camera.position.set(
      px * 16 + Math.sin(time * 0.08) * 3,
      94 + eased * 6 - py * 10,
      330 - eased * 180,
    );
    camera.lookAt(px * 9, 100 + eased * 6, -30);
  };

  return { scene, camera, baseFov: 44, update };
}