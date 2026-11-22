import * as THREE from "three";
import { createSky, createRuneCircle, clamp01 } from "@/components/glacialArchive/Cutscene";
import {
  createForgeEnvMap,
  createForgeMaterials,
  createLavaGround,
  createLavaRiver,
  createLavaGeyser,
  createEmbers,
  createGodRay,
  createChain,
  createBasaltPillar,
  createMagmaTitan,
  createForgeHaze,
  rand,
} from "./CinderKit";

/* ═════════════════════════════════════════════════════════════════
   SCENE TWO — THE CHAINED TITAN
   Inside the forge-cathedral: a colonnade of basalt columns, chains
   falling from the vault, god-rays raking through smoke, and the
   Magma Titan bound before the altar of the fourth shard.
   ═════════════════════════════════════════════════════════════════ */

export default function createTitanScene({ renderer }) {
  const scene = new THREE.Scene();
  const materials = createForgeMaterials();
  scene.fog = new THREE.FogExp2(0x1e0803, 0.0058);
  // Never clear to black: anything the set does not cover reads as ember haze.
  scene.background = new THREE.Color(0x1e0803);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2200);
  camera.position.set(0, 15, 108);

  scene.environment = createForgeEnvMap(renderer);

  /* a sliver of furnace sky behind the vault */
  const sky = createSky({
    top: 0x0d0302,
    horizon: 0x6e2406,
    glow: 0xffa15c,
    aurora: 0xff5a1a,
    auroraAmount: 0.5,
    moonDir: new THREE.Vector3(0, 0.3, -1),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x4a1c0c, 0x120503, 0.42));

  const altarLight = new THREE.DirectionalLight(0xff9a52, 1.5);
  altarLight.position.set(20, 60, -140);
  scene.add(altarLight);

  /* fill from the camera side so the titan's torso and the colonnade read as
     stone instead of a black silhouette against the altar light */
  const fill = new THREE.DirectionalLight(0xffa864, 1.25);
  fill.position.set(0, 90, 220);
  scene.add(fill);

  /* the floor of the cathedral, split by molten channels */
  const ground = createLavaGround({ size: 1400, hot: 0xff6a1e, deep: 0x0e0404, scale: 1.6 });
  scene.add(ground.mesh);

  for (const side of [-1, 1]) {
    const channel = createLavaRiver({ length: 260, width: 14, hot: 0xff8a34, speed: 0.75 });
    channel.mesh.position.set(side * 17, 0.7, -20);
    scene.add(channel.mesh);
    scene.userData[side === -1 ? "channelL" : "channelR"] = channel;
  }

  /* colonnade */
  const pillars = [];
  for (let i = 0; i < 7; i++) {
    const z = 36 - i * 30;
    for (const side of [-1, 1]) {
      const pillar = createBasaltPillar({ height: rand(46, 56), radius: rand(2.6, 3.4), materials, seed: i * 2 + side });
      pillar.position.set(side * 27, 0, z);
      scene.add(pillar);
      pillars.push(pillar);
    }
  }

  /* vault ribs overhead */
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(
      new THREE.TorusGeometry(34, 1.5, 8, 26, Math.PI),
      materials.obsidian({ color: 0x120a09 }),
    );
    rib.position.set(0, 54, 34 - i * 32);
    scene.add(rib);
  }

  /* chains falling out of the dark */
  const chainMaterial = materials.iron({ color: 0x33201a, roughness: 0.55 });
  const chains = [];
  for (let i = 0; i < 9; i++) {
    const x = -22 + i * 5.5;
    const chain = createChain({
      from: new THREE.Vector3(x, 66, rand(-6, 18)),
      to: new THREE.Vector3(x + rand(-3, 3), rand(18, 34), rand(-6, 18)),
      radius: 0.55,
      material: chainMaterial,
    });
    scene.add(chain);
    chains.push({ chain, phase: rand(0, Math.PI * 2) });
  }

  /* god-rays through the smoke */
  const rays = [];
  for (let i = 0; i < 6; i++) {
    const ray = createGodRay({
      height: 130,
      radiusTop: 2.4,
      radiusBottom: 20,
      color: 0xffb070,
      opacity: 0.1 + i * 0.008,
    });
    ray.mesh.position.set(-30 + i * 12, 66, -20 - i * 16);
    ray.mesh.rotation.z = rand(-0.1, 0.1);
    scene.add(ray.mesh);
    rays.push(ray);
  }

  /* the titan, bound */
  const titan = createMagmaTitan({ materials, scale: 2.5 });
  titan.position.set(0, 0, -52);
  titan.rotation.y = 0.12;
  scene.add(titan);

  /* its bindings run up out of frame */
  for (const side of [-1, 1]) {
    scene.add(
      createChain({
        from: new THREE.Vector3(side * 13.6, 30.6, -51),
        to: new THREE.Vector3(side * 26, 78, -44),
        radius: 0.7,
        material: chainMaterial,
      }),
    );
  }

  const altarRune = createRuneCircle({ radius: 26, color: 0xff7a2a, opacity: 0.45, y: 0.9, rings: 3, glyphs: 44 });
  altarRune.position.z = -20;
  scene.add(altarRune);

  const risingLava = createLavaGeyser({ height: 54, radius: 5, materials });
  risingLava.position.set(0, 0, -10);
  scene.add(risingLava);

  const haze = createForgeHaze({ size: 700, color: 0xff8a44, density: 0.52, y: 7 });
  scene.add(haze.mesh);

  const embers = createEmbers({ count: 2800, area: 220, height: 120, size: 2.4, color: 0xffb066 });
  scene.add(embers.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    ground.update(time);
    haze.update(time * 1.3);
    embers.update(time);
    for (const ray of rays) ray.update(time);
    scene.userData.channelL?.update(time);
    scene.userData.channelR?.update(time);
    risingLava.userData.update(time);

    for (const entry of chains) {
      entry.chain.rotation.z = Math.sin(time * 0.35 + entry.phase) * 0.035;
    }

    altarRune.rotation.z = time * 0.045;

    // the core breathes
    const titanCore = titan.userData;
    titanCore.coreMaterial.color.setHex(0xff8c34);
    titanCore.coreMaterial.color.multiplyScalar(2.4 + Math.sin(time * 1.9) * 0.7);
    titanCore.coreLight.intensity = 70 + Math.sin(time * 2.4) * 26;
    titanCore.coreHalo.material.opacity = 0.72 + Math.sin(time * 1.6) * 0.16;
    titan.scale.setScalar(2.5 + Math.sin(time * 0.9) * 0.02);
    titan.position.y = Math.sin(time * 0.7) * 0.4;

    const intro = clamp01(time / 16);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;

    camera.position.set(
      px * 10 + Math.sin(time * 0.11) * 3.2,
      16 + eased * 12 - py * 4,
      110 - eased * 46,
    );
    camera.lookAt(px * 8, 32 + eased * 6, -52);
  };

  return { scene, camera, baseFov: 42, update };
}