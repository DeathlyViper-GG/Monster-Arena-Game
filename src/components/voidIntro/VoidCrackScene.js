import * as THREE from "three";
import { createSky, createRock, clamp01, glowTexture, smoothstep } from "@/components/glacialArchive/Cutscene";
import {
  createVoidEnvMap,
  createVoidMaterials,
  createStarfield,
  createRift,
  createSoulStream,
  createShatteredPlatform,
  rand,
} from "./VoidKit";

/* ═════════════════════════════════════════════════════════════════
   SCENE FOUR — THE SEAM GIVES
   The last shard is dragged apart by everything poured into it: the
   crystal splits down the middle, light drives through the crack,
   shockwaves roll off it and the casket-shards are thrown clear.
   ═════════════════════════════════════════════════════════════════ */

export default function createVoidCrackScene({ renderer }) {
  const scene = new THREE.Scene();
  const materials = createVoidMaterials();
  scene.fog = new THREE.FogExp2(0x140530, 0.0058);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2400);
  camera.position.set(0, 36, 74);

  scene.environment = createVoidEnvMap(renderer);

  const sky = createSky({
    top: 0x06020e,
    horizon: 0x4f0c72,
    glow: 0xf4c8ff,
    aurora: 0x3ae0ff,
    auroraAmount: 1,
    moonDir: new THREE.Vector3(0, 0.32, -1),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x5e2a9c, 0x0a0414, 0.55));

  const key = new THREE.DirectionalLight(0xf2ccff, 2.0);
  key.position.set(-60, 90, -110);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x5ce0ff, 1.6);
  rim.position.set(70, 40, 80);
  scene.add(rim);

  const stars = createStarfield({ count: 3600, radius: 1200 });
  scene.add(stars.mesh);

  const rift = createRift({ width: 200, height: 480, color: 0x9c4ec4, opacity: 0.34 });
  rift.mesh.position.set(0, 70, -320);
  scene.add(rift.mesh);

  const platform = createShatteredPlatform({ materials, radius: 32 });
  platform.position.y = -10;
  scene.add(platform);

  /* ── the shard, split into two halves down its long axis ── */
  const centre = new THREE.Vector3(0, 36, 0);
  const halfMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe6ccff,
    emissive: new THREE.Color(0xbe7bff),
    emissiveIntensity: 1.1,
    roughness: 0.07,
    metalness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.92,
    envMapIntensity: 2.6,
  });

  const halves = [];
  for (const side of [-1, 1]) {
    const half = new THREE.Mesh(new THREE.OctahedronGeometry(5.6, 0), halfMaterial);
    half.scale.set(0.44, 1.24, 0.62);
    half.position.copy(centre);
    scene.add(half);
    halves.push({ half, side });
  }

  /* the fissure running down the seam */
  const seam = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 17),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xffffff).multiplyScalar(3),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  seam.position.copy(centre);
  scene.add(seam);

  const coreFlare = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "255,244,255"),
      color: 0xf0d6ff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  coreFlare.scale.setScalar(120);
  coreFlare.position.copy(centre);
  scene.add(coreFlare);

  const coreLight = new THREE.PointLight(0xe8c8ff, 40, 420, 2);
  coreLight.position.copy(centre);
  scene.add(coreLight);

  /* ── cracks of light driven out of the core ── */
  const fissureMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xdfc4ff).multiplyScalar(2.4),
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const fissures = [];
  for (let i = 0; i < 16; i++) {
    const crack = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.02, 1, 5), fissureMaterial);
    const direction = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-0.8, 0.8)).normalize();
    crack.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    crack.position.copy(centre).addScaledVector(direction, 0.5);
    scene.add(crack);
    fissures.push({ crack, direction, length: rand(9, 26), delay: rand(0, 0.5) });
  }

  /* ── shockwaves rolling off the break ── */
  const shockwaves = [];
  const waveMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xcfa6ff).multiplyScalar(1.6),
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 84), waveMaterial.clone());
    ring.position.copy(centre);
    scene.add(ring);
    shockwaves.push({ ring, offset: i / 3 });
  }

  /* ── the casket-shards thrown clear ── */
  const debrisMaterial = materials.ice({ color: 0xd9bcff, opacity: 0.7, roughness: 0.1 });
  const debris = [];
  for (let i = 0; i < 18; i++) {
    const chunk = new THREE.Mesh(new THREE.OctahedronGeometry(rand(0.9, 2.6), 0), debrisMaterial);
    const direction = new THREE.Vector3(rand(-1, 1), rand(-0.6, 1), rand(-0.9, 0.9)).normalize();
    scene.add(chunk);
    debris.push({ chunk, direction, speed: rand(8, 26), spin: rand(-1.4, 1.4), lag: rand(0, 0.4) });
  }

  const rubbleMaterial = materials.stone({ color: 0x342a52, roughness: 0.7, metalness: 0.2 });
  const rubble = [];
  for (let i = 0; i < 10; i++) {
    const rock = createRock({ radius: rand(1.4, 3.4), detail: 1, material: rubbleMaterial, seed: i * 2.1 });
    const direction = new THREE.Vector3(rand(-1, 1), rand(-0.8, 0.4), rand(-1, 1)).normalize();
    scene.add(rock);
    rubble.push({ rock, direction, speed: rand(4, 14), spin: rand(-0.9, 0.9), lag: rand(0, 0.6) });
  }

  /* ── souls pouring in, then blown back out ── */
  const souls = createSoulStream({ count: 2400, radius: 96, height: 140, color: 0xd9bcff });
  souls.mesh.position.copy(centre);
  scene.add(souls.mesh);

  const sparks = createSoulStream({ count: 1100, radius: 46, height: 70, color: 0x8cf0ff });
  sparks.mesh.position.copy(centre);
  scene.add(sparks.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    stars.update(time);
    rift.update(time);
    souls.update(time);
    sparks.update(time);

    /* the split: everything keys off this one curve */
    const split = smoothstep(0.4, 3.2, time);
    const flare = Math.max(0, Math.sin(clamp01(time / 5) * Math.PI)) * 0.6 + split * 0.4;

    for (const { half, side } of halves) {
      half.position.x = centre.x + side * (0.5 + split * 9);
      half.position.y = centre.y + split * 3.4;
      half.rotation.z = side * split * 0.5;
      half.rotation.y = time * 0.22 * side;
    }

    seam.scale.x = 1 + split * 5;
    seam.scale.y = 1 + split * 0.3;
    seam.material.opacity = 0.9 * (1 - smoothstep(0.5, 1, split)) + 0.25;
    seam.rotation.z = Math.sin(time * 0.4) * 0.05;

    coreFlare.scale.setScalar(120 + flare * 220 + Math.sin(time * 6) * 8);
    coreFlare.material.opacity = 0.5 + flare * 0.45;
    coreLight.intensity = 40 + flare * 130 + Math.sin(time * 9) * 12;

    fissureMaterial.opacity = 0.85 * (1 - smoothstep(0.25, 0.85, split));
    for (const { crack, direction, length, delay } of fissures) {
      const grow = smoothstep(delay, delay + 1.4, time);
      crack.scale.y = Math.max(0.001, length * grow * (1 - split * 0.35));
      crack.position.copy(centre).addScaledVector(direction, crack.scale.y * 0.5);
    }

    for (const { ring, offset } of shockwaves) {
      const p = ((time * 0.32 + offset) % 1);
      const radius = 4 + p * 120;
      ring.scale.set(radius, radius, radius);
      ring.rotation.z = time * 0.1 + offset;
      ring.material.opacity = Math.max(0, 0.5 * (1 - p)) * split;
    }

    for (const { chunk, direction, speed, spin, lag } of debris) {
      const travel = Math.max(0, time - 0.6 - lag) * speed * split;
      chunk.position.copy(centre).addScaledVector(direction, 4 + travel);
      chunk.rotation.set(time * spin, time * spin * 0.7, time * spin * 1.3);
      chunk.scale.setScalar(1 + split * 0.2);
    }

    for (const { rock, direction, speed, spin, lag } of rubble) {
      const travel = Math.max(0, time - 0.7 - lag) * speed;
      rock.position.copy(centre).addScaledVector(direction, 3 + travel);
      rock.rotation.set(time * spin, time * spin * 0.6, time * spin);
    }

    for (const child of platform.children) {
      child.position.y += Math.sin(time * 0.9 + child.position.x) * 0.004;
    }

    const push = smoothstep(0, 9, time);
    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;

    camera.position.set(
      Math.sin(time * 0.09) * 4 + px * 9,
      38 + Math.cos(time * 0.13) * 2 + py * 6,
      74 - push * 26,
    );
    camera.lookAt(0, 33 + push * 6, 0);
  };

  return { scene, camera, baseFov: 42, update };
}