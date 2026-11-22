import * as THREE from "three";
import {
  clamp01,
  createCracks,
  createGroundFog,
  createSky,
  createTerrain,
  fbm2,
  ridged2,
  smoothstep,
} from "@/components/glacialArchive/Cutscene";
import { createEmbers } from "./PrologueKit";
import { createPrologueEnvMap, createPrologueMaterials } from "./PrologueKit";
import { createRuinedEmpire } from "./PrologueSets";

/* ═════════════════════════════════════════════════════════════════
   BEAT III — NHALORI
   "I am the Hollow King of Nhalori — an empire that crumbled to dust
    while I endured."
   A dust-storm avenue of broken columns, ending at a black spire with
   a crown of horns.
   ═════════════════════════════════════════════════════════════════ */

export default function createEmpireScene({ renderer }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x3a2a18, 0.0046);
  scene.background = new THREE.Color(0x3a2a18);

  const camera = new THREE.PerspectiveCamera(46, 1, 1, 3000);
  camera.position.set(0, 16, 170);

  scene.environment = createPrologueEnvMap(renderer, { top: 0x1d1409, horizon: 0x6a4a26, ground: 0x120c05 });
  const lib = createPrologueMaterials();

  const sky = createSky({
    top: 0x140c06,
    horizon: 0x7a5528,
    glow: 0xffc98a,
    aurora: 0xc08a3a,
    auroraAmount: 0.55,
    moonDir: new THREE.Vector3(-0.2, 0.3, -0.94),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x8a6636, 0x140c06, 0.68));

  const sun = new THREE.DirectionalLight(0xffc482, 2.2);
  sun.position.set(-160, 200, -280);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xd8a870, 1.1);
  fill.position.set(120, 120, 240);
  scene.add(fill);

  const heightFn = (x, z) => {
    const distance = Math.hypot(x, z);
    const dunes = (fbm2(x * 0.006, z * 0.006, 4) - 0.45) * 16;
    const ridges = ridged2(x * 0.0016, z * 0.0016, 4);
    const far = smoothstep(200, 620, distance) * (ridges * 130 - 20);
    return dunes * smoothstep(30, 120, distance) + far;
  };

  const terrain = createTerrain({
    size: 1500,
    segments: 240,
    heightFn,
    colors: { snow: 0xd8bd92, rock: 0x7a5f3c, shadow: 0x2a1d10 },
    material: lib.snow({ vertexColors: true, color: 0xc9ac80, roughness: 0.96, metalness: 0.04 }),
  });
  scene.add(terrain);

  scene.add(createCracks({ count: 22, start: 12, radius: 260, color: 0xffb066, y: 0.16 }));

  scene.add(createRuinedEmpire({ materials: lib }));

  const dust = createEmbers({ count: 2800, area: 420, height: 200, size: 1.9, color: 0xe8c898 });
  scene.add(dust.mesh);

  const haze = createGroundFog({ size: 700, color: 0xd8b48a, density: 0.5, y: 3 });
  scene.add(haze.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    dust.update(time);
    haze.update(time * 1.3);

    const intro = clamp01(time / 16);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;

    camera.position.set(
      px * 12 + Math.sin(time * 0.09) * 4,
      14 + eased * 12 - py * 8,
      172 - eased * 118,
    );
    camera.lookAt(px * 8, 62 + eased * 20, -252);
  };

  return { scene, camera, baseFov: 46, update };
}