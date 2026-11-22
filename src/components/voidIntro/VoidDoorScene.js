import * as THREE from "three";
import { createSky, clamp01, glowTexture, smoothstep } from "@/components/glacialArchive/Cutscene";
import {
  createVoidEnvMap,
  createVoidMaterials,
  createStarfield,
  createRift,
  createSoulStream,
  createRuneRing,
  createShatteredPlatform,
  rand,
} from "./VoidKit";

/* ═════════════════════════════════════════════════════════════════
   SCENE FIVE — THE DOORWAY
   The shard does not shatter; it opens. A door stands where it hung,
   the souls of five realms pour out of it, and something waits on
   the far side of the light.
   ═════════════════════════════════════════════════════════════════ */

export default function createVoidDoorScene({ renderer }) {
  const scene = new THREE.Scene();
  const materials = createVoidMaterials();
  scene.fog = new THREE.FogExp2(0x1c0838, 0.0042);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2600);
  camera.position.set(0, 40, 78);

  scene.environment = createVoidEnvMap(renderer);

  const sky = createSky({
    top: 0x08020f,
    horizon: 0x63108c,
    glow: 0xffd2ff,
    aurora: 0x46e6ff,
    auroraAmount: 1.1,
    moonDir: new THREE.Vector3(0, 0.3, -1),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x6a2cb0, 0x0d0418, 0.6));

  const key = new THREE.DirectionalLight(0xffd0ff, 2.2);
  key.position.set(-70, 100, -120);
  scene.add(key);

  const stars = createStarfield({ count: 3800, radius: 1400 });
  scene.add(stars.mesh);

  /* ── the door: a rift standing where the shard hung ── */
  const doorY = 62;
  const doorOuter = createRift({ width: 150, height: 420, color: 0xc069ff, opacity: 0.85 });
  doorOuter.mesh.position.set(0, doorY, -70);
  scene.add(doorOuter.mesh);

  const doorCore = createRift({ width: 42, height: 380, color: 0xfff4ff, opacity: 1 });
  doorCore.mesh.position.set(0, doorY, -66);
  scene.add(doorCore.mesh);

  const doorGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "255,236,255"),
      color: 0xf4d8ff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  doorGlow.scale.set(620, 760, 1);
  doorGlow.position.set(0, doorY, -74);
  scene.add(doorGlow);

  const doorLight = new THREE.PointLight(0xf0d2ff, 180, 900, 2);
  doorLight.position.set(0, doorY, -30);
  scene.add(doorLight);

  /* ── the shard, opened out into a frame around the door ── */
  const frame = [];
  const frameMaterial = materials.ice({ color: 0xe2c4ff, opacity: 0.66, roughness: 0.1 });
  for (let i = 0; i < 20; i++) {
    const sliver = new THREE.Mesh(new THREE.OctahedronGeometry(rand(1.6, 4.6), 0), frameMaterial);
    const angle = (i / 20) * Math.PI * 2;
    sliver.position.set(Math.cos(angle) * 52, doorY + Math.sin(angle) * 120, -64);
    sliver.rotation.z = angle;
    scene.add(sliver);
    frame.push({ sliver, angle, radius: rand(46, 60), wobble: rand(0.4, 1.4), phase: rand(0, Math.PI * 2) });
  }

  /* ── souls pouring out of the door ── */
  const souls = createSoulStream({ count: 2600, radius: 120, height: 150, color: 0xe0c2ff });
  souls.mesh.position.set(0, doorY, -30);
  scene.add(souls.mesh);

  const sparks = createSoulStream({ count: 1200, radius: 70, height: 90, color: 0x8cf0ff });
  sparks.mesh.position.set(0, doorY - 10, -20);
  scene.add(sparks.mesh);

  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = createRuneRing({
      radius: 40 + i * 16,
      color: i % 2 ? 0x4ad4ff : 0xd6a4ff,
      opacity: 0.22 + i * 0.05,
      rings: 2,
      glyphs: 44 + i * 8,
    });
    ring.position.set(0, doorY - 6, -50);
    scene.add(ring);
    rings.push({ ring, spin: (i % 2 ? -1 : 1) * (0.05 + i * 0.03) });
  }

  /* ── the ground coming apart under the light ── */
  const platform = createShatteredPlatform({ materials, radius: 34 });
  platform.position.y = -12;
  scene.add(platform);

  const drifters = [];
  for (const child of platform.children) {
    drifters.push({ child, base: child.position.y, lift: rand(1.5, 6), phase: rand(0, Math.PI * 2) });
  }

  const motes = createStarfield({ count: 1400, radius: 160 });
  scene.add(motes.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    stars.update(time);
    motes.update(time);
    doorOuter.update(time);
    doorCore.update(time);
    souls.update(time);
    sparks.update(time);

    const open = smoothstep(0, 6, time);
    doorGlow.material.opacity = 0.55 + open * 0.35 + Math.sin(time * 1.6) * 0.06;
    doorLight.intensity = 120 + open * 90 + Math.sin(time * 2.3) * 20;

    for (const entry of frame) {
      const swell = open * entry.radius;
      entry.sliver.position.set(
        Math.cos(entry.angle) * (36 + swell * 0.5),
        doorY + Math.sin(entry.angle) * (96 + swell * 0.6) + Math.sin(time * entry.wobble + entry.phase) * 3,
        -64,
      );
      entry.sliver.rotation.y = time * 0.3 + entry.phase;
      entry.sliver.rotation.z = entry.angle + Math.sin(time * 0.6 + entry.phase) * 0.2;
    }

    for (const entry of rings) {
      entry.ring.rotation.z += entry.spin * delta;
      entry.ring.rotation.x = Math.sin(time * 0.25) * 0.06;
    }

    for (const entry of drifters) {
      entry.child.position.y = entry.base + open * entry.lift + Math.sin(time * 0.8 + entry.phase) * 0.6;
      entry.child.rotation.y += delta * 0.05;
    }

    const pull = smoothstep(0, 11, time);
    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;

    camera.position.set(
      Math.sin(time * 0.07) * 8 + px * 10,
      38 + pull * 16 - py * 7,
      68 + pull * 44,
    );
    camera.lookAt(0, doorY - 14 + pull * 4, -60);
  };

  return { scene, camera, baseFov: 40, update };
}