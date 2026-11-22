import * as THREE from "three";
import { createSky, createRock, clamp01, glowTexture } from "@/components/glacialArchive/Cutscene";
import createSoulShard from "@/components/realmCinematic/shard";
import {
  createForgeEnvMap,
  createForgeMaterials,
  createLavaGround,
  createLavaGeyser,
  createEmbers,
  createChain,
  createGodRay,
  createBasaltPillar,
  createMagmaTitan,
  createForgeHaze,
  rand,
} from "./CinderKit";

/* ═════════════════════════════════════════════════════════════════
   SCENE THREE — THE FOURTH SHARD
   The soul-shard hangs in chains above the altar while the forge
   tears itself open: lava columns, an ember storm, and the Titan's
   silhouette burning in the dark behind it.
   ═════════════════════════════════════════════════════════════════ */

export default function createCinderShardScene({ renderer }) {
  const scene = new THREE.Scene();
  const materials = createForgeMaterials();
  scene.fog = new THREE.FogExp2(0x240b04, 0.0068);
  // Never clear to black: anything the set does not cover reads as ember haze.
  scene.background = new THREE.Color(0x240b04);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1800);
  camera.position.set(26, 30, 96);

  scene.environment = createForgeEnvMap(renderer);

  const sky = createSky({
    top: 0x0b0302,
    horizon: 0x7a2a08,
    glow: 0xffb070,
    aurora: 0xff5a1a,
    auroraAmount: 0.6,
    moonDir: new THREE.Vector3(0.1, 0.4, -1),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x5a2210, 0x100403, 0.4));

  const key = new THREE.DirectionalLight(0xff9a52, 1.2);
  key.position.set(-40, 70, -90);
  scene.add(key);

  /* fill from the camera side so the altar, columns and titan are lit stone
     rather than a black mass in front of the shard's glow */
  const fill = new THREE.DirectionalLight(0xffa864, 1.2);
  fill.position.set(0, 80, 170);
  scene.add(fill);

  const ground = createLavaGround({ size: 900, hot: 0xff6a1e, deep: 0x0d0403, scale: 1.2 });
  scene.add(ground.mesh);

  /* the altar: stepped basalt dais under the shard */
  for (let i = 0; i < 4; i++) {
    const step = new THREE.Mesh(
      new THREE.CylinderGeometry(30 - i * 5.5, 31 - i * 5.5, 2.6, 8),
      materials.basalt({ color: 0x170d0a }),
    );
    step.position.y = 1.3 + i * 2.5;
    step.rotation.y = i * 0.12;
    scene.add(step);
  }

  /* flanking columns so the frame reads as architecture */
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const pillar = createBasaltPillar({ height: rand(52, 68), radius: rand(3.4, 4.2), materials, seed: side + i });
      pillar.position.set(side * (26 + i * 22), 0, -10 - i * 26);
      scene.add(pillar);
    }
  }

  /* the shard, held aloft */
  const shard = createSoulShard({ size: 4.2, color: 0xffd7a3, coreColor: 0xfff3d0 });
  shard.position.set(0, 34, -6);
  scene.add(shard);

  const shardHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "255,210,150"),
      color: 0xffb877,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  shardHalo.scale.setScalar(110);
  shardHalo.position.copy(shard.position);
  scene.add(shardHalo);

  /* the chains that suspend it */
  const chainMaterial = materials.iron({ color: 0x3b251b, roughness: 0.5 });
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.4;
    scene.add(
      createChain({
        from: new THREE.Vector3(Math.cos(angle) * 46, 118, -6 + Math.sin(angle) * 46),
        to: new THREE.Vector3(Math.cos(angle) * 4.4, 36 + Math.sin(angle) * 1.5, -6 + Math.sin(angle) * 4.4),
        radius: 0.42,
        material: chainMaterial,
      }),
    );
  }

  /* the forge coming apart around it */
  const geysers = [];
  for (let i = 0; i < 5; i++) {
    const geyser = createLavaGeyser({ height: rand(40, 78), radius: rand(3, 5.5), materials });
    // offset so no eruption column stands between the camera and the shard
    const angle = (i / 5) * Math.PI * 2 + Math.PI * 0.62;
    geyser.position.set(Math.cos(angle) * (40 + rand(0, 16)), 0, -6 + Math.sin(angle) * (34 + rand(0, 14)));
    scene.add(geyser);
    geysers.push({ geyser, phase: rand(0, Math.PI * 2) });
  }

  /* debris thrown up from the floor */
  const debrisMaterial = materials.basalt({ color: 0x130a08 });
  const debris = [];
  for (let i = 0; i < 16; i++) {
    const chunk = createRock({ radius: rand(1.4, 4.4), detail: 1, material: debrisMaterial, seed: i * 2.3 });
    chunk.position.set(rand(-52, 52), rand(18, 92), rand(-52, 30));
    scene.add(chunk);
    debris.push({ chunk, spin: rand(-0.4, 0.4), drift: rand(-2, 2), phase: rand(0, Math.PI * 2) });
  }

  /* the Titan watching from the smoke */
  const titan = createMagmaTitan({ materials, scale: 3.2 });
  titan.position.set(-6, -2, -150);
  titan.rotation.y = 0.2;
  scene.add(titan);

  const rays = [];
  for (let i = 0; i < 5; i++) {
    const ray = createGodRay({ height: 170, radiusTop: 3, radiusBottom: 22, color: 0xffb070, opacity: 0.11 });
    ray.mesh.position.set(-44 + i * 22, 86, -40 - i * 8);
    scene.add(ray.mesh);
    rays.push(ray);
  }

  const haze = createForgeHaze({ size: 620, color: 0xff8a44, density: 0.55, y: 5 });
  scene.add(haze.mesh);

  const embers = createEmbers({ count: 3600, area: 240, height: 150, size: 2.8, color: 0xffbe7a });
  scene.add(embers.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    ground.update(time);
    haze.update(time * 1.4);
    embers.update(time);
    for (const ray of rays) ray.update(time);
    for (const entry of geysers) entry.geyser.userData.update(time + entry.phase);
    shard.userData.update(time);

    shardHalo.material.opacity = 0.45 + 0.18 * Math.sin(time * 1.8);

    for (const entry of debris) {
      entry.chunk.rotation.y += entry.spin * delta;
      entry.chunk.rotation.x += entry.spin * 0.6 * delta;
      entry.chunk.position.y += Math.sin(time * 0.6 + entry.phase) * entry.drift * delta;
    }

    const titanCore = titan.userData;
    titanCore.coreHalo.material.opacity = 0.35 + 0.12 * Math.sin(time * 1.3);
    titanCore.coreLight.intensity = 40 + Math.sin(time * 1.7) * 14;

    const intro = clamp01(time / 14);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;
    const orbit = time * 0.09;

    camera.position.set(
      Math.sin(orbit) * (60 - eased * 22) + px * 10,
      30 + eased * 6 - py * 6,
      Math.cos(orbit) * (86 - eased * 32),
    );
    camera.lookAt(px * 6, 32, -6);
  };

  return { scene, camera, baseFov: 40, update };
}