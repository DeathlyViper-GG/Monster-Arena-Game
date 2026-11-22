import * as THREE from "three";
import { createSky, clamp01, glowTexture } from "@/components/glacialArchive/Cutscene";
import createSoulShard from "@/components/realmCinematic/shard";
import {
  createVoidEnvMap,
  createVoidMaterials,
  createStarfield,
  createRift,
  createSoulStream,
  createRuneRing,
  rand,
} from "./VoidKit";

/* ═════════════════════════════════════════════════════════════════
   SCENE THREE — THE FINAL SHARD
   The last piece of the Scribe's soul hangs inside a cage of broken
   casket-shards while the souls of five realms stream into it. One
   shard left, and the door opens.
   ═════════════════════════════════════════════════════════════════ */

export default function createVoidShardScene({ renderer }) {
  const scene = new THREE.Scene();
  const materials = createVoidMaterials();
  scene.fog = new THREE.FogExp2(0x0c0424, 0.0055);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2400);
  camera.position.set(52, 34, 74);

  scene.environment = createVoidEnvMap(renderer);

  const sky = createSky({
    top: 0x04010a,
    horizon: 0x35094f,
    glow: 0xe0a4ff,
    aurora: 0x35d6ff,
    auroraAmount: 0.85,
    moonDir: new THREE.Vector3(0, 0.35, -1),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x4c2486, 0x08030f, 0.42));

  const key = new THREE.DirectionalLight(0xe0b4ff, 1.5);
  key.position.set(-60, 90, -120);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x4ad4ff, 1.8);
  rim.position.set(80, 30, 90);
  scene.add(rim);

  const stars = createStarfield({ count: 4200, radius: 1300 });
  scene.add(stars.mesh);

  const rift = createRift({ width: 220, height: 520, color: 0xbe5cff, opacity: 0.5 });
  rift.mesh.position.set(0, 60, -300);
  scene.add(rift.mesh);

  /* the last shard */
  const shard = createSoulShard({ size: 5.4, color: 0xf0d9ff, coreColor: 0xfff6ff });
  shard.position.set(0, 34, 0);
  scene.add(shard);

  const bloom = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "230,190,255"),
      color: 0xd6a4ff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  bloom.scale.setScalar(150);
  bloom.position.copy(shard.position);
  scene.add(bloom);

  /* the broken casket: shards orbiting the last piece */
  const cage = [];
  const cageMaterial = materials.ice({ color: 0xc9b0ff, opacity: 0.55, roughness: 0.12 });
  for (let i = 0; i < 14; i++) {
    const sliver = new THREE.Mesh(new THREE.OctahedronGeometry(rand(1.6, 4.2), 0), cageMaterial);
    scene.add(sliver);
    cage.push({ sliver, phase: rand(0, Math.PI * 2), radius: rand(15, 27), speed: rand(0.12, 0.3), tilt: rand(-0.6, 0.6) });
  }

  /* souls of the five realms streaming in */
  const souls = createSoulStream({ count: 2200, radius: 110, height: 130, color: 0xd9bcff });
  souls.mesh.position.set(0, 34, 0);
  scene.add(souls.mesh);

  const embers = createSoulStream({ count: 900, radius: 60, height: 80, color: 0x7ce8ff });
  embers.mesh.position.set(0, 30, 0);
  scene.add(embers.mesh);

  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = createRuneRing({
      radius: 26 + i * 9,
      color: i % 2 ? 0x4ad4ff : 0xd6a4ff,
      opacity: 0.26 + i * 0.05,
      rings: 2,
      glyphs: 40 + i * 8,
    });
    ring.position.set(0, 34, 0);
    scene.add(ring);
    rings.push({ ring, spin: (i % 2 ? -1 : 1) * (0.06 + i * 0.03), tilt: rand(-0.2, 0.2) });
  }

  const motes = createStarfield({ count: 1200, radius: 140 });
  scene.add(motes.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    stars.update(time);
    motes.update(time);
    rift.update(time);
    souls.update(time);
    embers.update(time);
    shard.userData.update(time);

    bloom.material.opacity = 0.5 + 0.2 * Math.sin(time * 1.9);

    for (const entry of cage) {
      const angle = time * entry.speed + entry.phase;
      entry.sliver.position.set(
        Math.cos(angle) * entry.radius,
        shard.position.y + Math.sin(angle * 1.3 + entry.phase) * entry.radius * 0.34,
        Math.sin(angle) * entry.radius,
      );
      entry.sliver.rotation.y = time * 0.6 + entry.phase;
      entry.sliver.rotation.x = time * 0.4 + entry.tilt;
    }

    for (const entry of rings) {
      entry.ring.rotation.z += entry.spin * delta;
      entry.ring.rotation.x = entry.tilt + Math.sin(time * 0.3) * 0.05;
    }

    const intro = clamp01(time / 14);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;
    const orbit = time * 0.075;

    camera.position.set(
      Math.sin(orbit) * (78 - eased * 24) + px * 12,
      34 + eased * 6 - py * 7,
      Math.cos(orbit) * (78 - eased * 24),
    );
    camera.lookAt(px * 5, 33, 0);
  };

  return { scene, camera, baseFov: 38, update };
}