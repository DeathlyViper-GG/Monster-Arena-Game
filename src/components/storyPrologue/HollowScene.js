import * as THREE from "three";
import {
  clamp01,
  createCracks,
  createSky,
  glowTexture,
} from "@/components/glacialArchive/Cutscene";
import {
  REALM_LIGHTS,
  createEmbers,
  createPrologueEnvMap,
  createPrologueMaterials,
  createSoulShard,
  rgbOf,
} from "./PrologueKit";
import { createHollowPresence } from "./PrologueSets";

/* ═════════════════════════════════════════════════════════════════
   BEAT V — COME, THEN
   "Then come. Slay my Wardens. Reclaim what was theirs. And when you
    are whole, I will show you the power that made me."
   The Hollow King fills the void: one enormous eye, a crown of horns,
   chains hanging out of the dark, and the five shards circling him.
   ═════════════════════════════════════════════════════════════════ */

const VIOLET = 0x9a4cff;

export default function createHollowScene({ renderer }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0616, 0.0021);
  scene.background = new THREE.Color(0x0a0616);

  const camera = new THREE.PerspectiveCamera(46, 1, 1, 4000);
  camera.position.set(0, 12, 220);

  scene.environment = createPrologueEnvMap(renderer, { top: 0x080312, horizon: 0x2e1550, ground: 0x05020c });
  const lib = createPrologueMaterials();

  const sky = createSky({
    top: 0x020107,
    horizon: 0x2a1148,
    glow: 0xc07cff,
    aurora: 0x5a1f9c,
    auroraAmount: 0.9,
    moonDir: new THREE.Vector3(0, 0.3, -0.95),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x3a1f60, 0x05020c, 0.5));

  const key = new THREE.DirectionalLight(0xc79cff, 1.1);
  key.position.set(-180, 240, 220);
  scene.add(key);

  const beneath = new THREE.DirectionalLight(VIOLET, 2.1);
  beneath.position.set(0, -120, 60);
  scene.add(beneath);

  /* a floor of black glass so the eye has something to stand on */
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(620, 84),
    lib.stone({ color: 0x0e0a18, roughness: 0.24, metalness: 0.62 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1;
  scene.add(floor);

  scene.add(createCracks({ count: 34, start: 12, radius: 340, color: 0xa874ff, y: 0.1 }));

  const hollow = createHollowPresence({ materials: lib });
  hollow.group.position.set(0, 96, -260);
  scene.add(hollow.group);

  /* the five reclaimed shards, circling him */
  const shards = REALM_LIGHTS.map((realm, i) => {
    const mesh = createSoulShard({ color: realm.color, size: 2.1 });
    scene.add(mesh);
    return {
      mesh,
      radius: 150 + i * 16,
      speed: 0.12 + i * 0.014,
      phase: (i / REALM_LIGHTS.length) * Math.PI * 2,
      height: 74 + i * 13,
    };
  });

  /* a colossal rune circle standing behind him */
  const sealRunes = new THREE.Mesh(
    new THREE.TorusGeometry(210, 2.6, 8, 96),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(VIOLET).multiplyScalar(1.5), transparent: true, opacity: 0.5 }),
  );
  sealRunes.position.set(0, 120, -420);
  scene.add(sealRunes);

  const sealGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, rgbOf(VIOLET)),
      color: VIOLET,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sealGlow.scale.setScalar(700);
  sealGlow.position.set(0, 120, -430);
  scene.add(sealGlow);

  const embers = createEmbers({ count: 2600, area: 620, height: 260, size: 1.7, color: 0xc9a4ff });
  scene.add(embers.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    embers.update(time);

    /* the eye breathes, and the pupil wakes */
    const open = clamp01((time - 1.2) / 3.4);
    hollow.pupil.scale.set(0.55 + open * 0.55, 0.55 + open * 0.55, 0.42);
    hollow.iris.rotation.z = time * 0.06;
    hollow.iris.material.color.setHex(VIOLET).multiplyScalar(2.2 + Math.sin(time * 1.7) * 0.5);
    hollow.spark.scale.setScalar(0.8 + Math.sin(time * 2.4) * 0.18 + open * 0.5);
    hollow.eyeLight.intensity = 90 + Math.sin(time * 2.1) * 24 + open * 60;
    hollow.halo.material.opacity = 0.22 + 0.1 * Math.sin(time * 1.3);
    hollow.mass.scale.set(1, 1.14 + Math.sin(time * 0.5) * 0.012, 0.92);

    for (const shard of shards) {
      const a = time * shard.speed + shard.phase;
      shard.mesh.position.set(
        Math.cos(a) * shard.radius,
        shard.height + Math.sin(time * 0.6 + shard.phase) * 12,
        -170 + Math.sin(a) * shard.radius * 0.45,
      );
      shard.mesh.rotation.set(time * 0.9, time * 1.3, time * 0.6);
    }

    sealRunes.rotation.z = time * 0.02;

    const intro = clamp01(time / 18);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;

    camera.position.set(
      px * 22 + Math.sin(time * 0.07) * 8,
      10 + eased * 62 - py * 14,
      224 - eased * 90,
    );
    camera.lookAt(px * 12, 96 + eased * 12, -260);
  };

  return { scene, camera, baseFov: 46, update };
}