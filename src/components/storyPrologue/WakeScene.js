import * as THREE from "three";
import {
  clamp01,
  createCracks,
  createGroundFog,
  createHoodedFigure,
  createRuneCircle,
  createSky,
  createTerrain,
  fbm2,
} from "@/components/glacialArchive/Cutscene";
import { createEmbers, createGodRay } from "./PrologueKit";
import {
  createPrologueEnvMap,
  createPrologueMaterials,
  createRealmLights,
} from "./PrologueKit";

/* ═════════════════════════════════════════════════════════════════
   BEAT I — WAKING
   "I wake in a place I do not know, wearing a name I barely
    remember — the Last Scribe."
   The Scribe on cold stone, one shaft of pale light, and five realm
   lights burning far off in the dark.
   ═════════════════════════════════════════════════════════════════ */

export default function createWakeScene({ renderer }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070a13, 0.0135);
  scene.background = new THREE.Color(0x070a13);

  // Keep the near plane generous: a 0.1/1400 range starves depth precision and
  // distant surfaces then trade winners frame to frame (flicker).
  const camera = new THREE.PerspectiveCamera(42, 1, 1, 1400);
  camera.position.set(0, 2.2, 34);

  scene.environment = createPrologueEnvMap(renderer);
  const lib = createPrologueMaterials();

  const sky = createSky({
    top: 0x01030a,
    horizon: 0x111a2d,
    glow: 0x9fc0ff,
    aurora: 0x2b3f7a,
    auroraAmount: 0.3,
    moonDir: new THREE.Vector3(-0.32, 0.22, -0.9),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x2a3a58, 0x03050a, 0.62));

  const key = new THREE.DirectionalLight(0xb9cdf5, 1.1);
  key.position.set(-34, 92, 62);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x7fa8ff, 1.7);
  rim.position.set(12, 32, -96);
  scene.add(rim);

  /* the shaft of waking light, pooling on the stone */
  const shaft = createGodRay({ height: 130, radiusTop: 4, radiusBottom: 22, color: 0xc6d8ff, opacity: 0.1 });
  shaft.mesh.position.set(0, 58, -3);
  scene.add(shaft.mesh);

  const pool = new THREE.PointLight(0xd2e2ff, 42, 78, 2);
  pool.position.set(0, 16, 2);
  scene.add(pool);

  const heightFn = (x, z) =>
    (fbm2(x * 0.012, z * 0.012, 4) - 0.5) * 1.7 + (fbm2(x * 0.06, z * 0.06, 3) - 0.5) * 0.22;

  const terrain = createTerrain({
    size: 460,
    segments: 220,
    heightFn,
    colors: { snow: 0x93a4c2, rock: 0x1d2637, shadow: 0x070a12 },
    material: lib.stone({ vertexColors: true, color: 0x9aa6bd, roughness: 0.93, metalness: 0.08 }),
  });
  scene.add(terrain);

  scene.add(createCracks({ count: 22, start: 3.5, radius: 70, color: 0x8fa6d8, y: 0.07 }));
  scene.add(createRuneCircle({ radius: 7.4, color: 0x9fc0ff, opacity: 0.3, y: 0.06, rings: 2, glyphs: 34 }));

  /* the Scribe */
  const scribe = createHoodedFigure({
    height: 4.5,
    material: lib.cloth({
      color: 0x0e1620,
      sheenColor: new THREE.Color(0x9fc2ff),
      sheen: 1,
      roughness: 0.9,
      emissive: 0x0a1a2c,
      emissiveIntensity: 0.9,
    }),
    seed: 3.4,
  });
  scribe.position.set(0, 0.08, 0);
  scene.add(scribe);

  /* the five realms, still far away */
  const realmLights = createRealmLights({ radius: 340, y: 52, scale: 54, arc: 1.02 });
  scene.add(realmLights.group);

  const dust = createEmbers({ count: 1600, area: 90, height: 54, size: 1.4, color: 0xcfdcff });
  scene.add(dust.mesh);

  const fog = createGroundFog({ size: 190, color: 0x8098c8, density: 0.55, y: 0.55 });
  scene.add(fog.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    shaft.update(time);
    dust.update(time);
    fog.update(time);
    realmLights.update(time);

    /* the Scribe stirs, rises, and settles into standing */
    const stir = clamp01(time / 5.5);
    scribe.position.y = 0.08 - 0.42 * (1 - stir);
    scribe.rotation.z = Math.sin(time * 0.6) * 0.014 * (1 - stir);
    scribe.rotation.y = Math.sin(time * 0.34) * 0.06;
    pool.intensity = 38 + Math.sin(time * 1.1) * 5;

    const intro = clamp01(time / 15);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;

    camera.position.set(
      px * 1.4 + Math.sin(time * 0.11) * 0.5,
      1.5 + eased * 4.6 - py * 0.7,
      33 - eased * 11.5,
    );
    camera.lookAt(px * 0.7, 3.1 + eased * 1.5, 0);
  };

  return { scene, camera, baseFov: 42, update };
}