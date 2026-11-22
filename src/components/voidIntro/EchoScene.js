import * as THREE from "three";
import { createSky, clamp01 } from "@/components/glacialArchive/Cutscene";
import {
  createVoidEnvMap,
  createVoidMaterials,
  createStarfield,
  createMemoryVeils,
  createRift,
  createSoulStream,
  createRuneRing,
  createEcho,
  createShatteredPlatform,
} from "./VoidKit";

/* ═════════════════════════════════════════════════════════════════
   SCENE TWO — THE HOLLOW'S ECHO
   A shattered disc of memory-stone hangs in the void. The Echo — a
   Warden wearing the Scribe's face — waits inside rings of running
   runes, the five reclaimed shards orbiting it like moons.
   ═════════════════════════════════════════════════════════════════ */

export default function createEchoScene({ renderer }) {
  const scene = new THREE.Scene();
  const materials = createVoidMaterials();
  scene.fog = new THREE.FogExp2(0x0b0422, 0.0062);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2200);
  camera.position.set(0, 18, 96);

  scene.environment = createVoidEnvMap(renderer);

  const sky = createSky({
    top: 0x04010a,
    horizon: 0x2f0b46,
    glow: 0xc85cff,
    aurora: 0x35d6ff,
    auroraAmount: 0.8,
    moonDir: new THREE.Vector3(0, 0.2, -1),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x4a2280, 0x08030f, 0.4));

  const key = new THREE.DirectionalLight(0xd066ff, 1.6);
  key.position.set(30, 90, -140);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x4ad4ff, 1.5);
  rim.position.set(-90, 40, 60);
  scene.add(rim);

  const stars = createStarfield({ count: 3600, radius: 1200 });
  scene.add(stars.mesh);

  const rift = createRift({ width: 130, height: 400, color: 0xa855f7, opacity: 0.55 });
  rift.mesh.position.set(0, 90, -260);
  scene.add(rift.mesh);

  const platform = createShatteredPlatform({ materials, radius: 38 });
  platform.position.y = 0;
  scene.add(platform);

  const echo = createEcho({ materials, height: 17 });
  echo.position.set(0, 2.2, -18);
  scene.add(echo);

  /* rings of running runes encircling the Warden */
  const rings = [];
  for (let i = 0; i < 4; i++) {
    const ring = createRuneRing({
      radius: 20 + i * 7,
      color: i % 2 ? 0x49d8ff : 0xc06cff,
      opacity: 0.3 + i * 0.04,
      rings: 2,
      glyphs: 38 + i * 8,
    });
    ring.position.set(0, 12 + i * 3, -18);
    scene.add(ring);
    rings.push({ ring, spin: (i % 2 ? -1 : 1) * (0.05 + i * 0.02) });
  }

  /* echoes of the other realms drifting behind the Warden */
  const veils = createMemoryVeils({ count: 8, radius: 150 });
  veils.position.z = -40;
  scene.add(veils);

  const souls = createSoulStream({ count: 1200, radius: 80, height: 100, color: 0xd9bcff });
  souls.mesh.position.set(0, 26, -18);
  scene.add(souls.mesh);

  const motes = createStarfield({ count: 900, radius: 90 });
  scene.add(motes.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    stars.update(time);
    motes.update(time);
    rift.update(time);
    veils.userData.update(time);
    souls.update(time);
    echo.userData.update(time);
    for (const entry of rings) entry.ring.rotation.z += entry.spin * delta;

    const intro = clamp01(time / 16);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;

    camera.position.set(
      px * 14 + Math.sin(time * 0.1) * 3.4,
      20 + eased * 5 - py * 7,
      98 - eased * 40,
    );
    camera.lookAt(px * 8, 13 + eased * 2, -18);
  };

  return { scene, camera, baseFov: 40, update };
}