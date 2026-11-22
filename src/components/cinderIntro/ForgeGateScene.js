import * as THREE from "three";
import { createSky, createRock, clamp01 } from "@/components/glacialArchive/Cutscene";
import {
  createForgeEnvMap,
  createForgeMaterials,
  createLavaGround,
  createLavaRiver,
  createEmbers,
  createForgeTemple,
  createForgeHaze,
  rand,
} from "./CinderKit";

/* ═════════════════════════════════════════════════════════════════
   SCENE ONE — THE FORGE GATE
   A lava plain at the end of the world. The forge-temple rises out of
   the melt: two obsidian towers, a burning door, and smoke rolling
   off the ground toward the camera.
   ═════════════════════════════════════════════════════════════════ */

export default function createForgeGateScene({ renderer }) {
  const scene = new THREE.Scene();
  const materials = createForgeMaterials();
  scene.fog = new THREE.FogExp2(0x2a0d05, 0.0027);
  // Never clear to black: anything the set does not cover reads as ember haze.
  scene.background = new THREE.Color(0x2a0d05);

  /* The near plane stays well clear of the set (the closest geometry is the
     ground far below), and a 0.1/3600 range left so few depth values across
     the plain that distant surfaces swapped winners frame to frame — which
     read as a flickering rectangle over the ground. */
  const camera = new THREE.PerspectiveCamera(44, 1, 3, 3600);
  camera.position.set(0, 28, 330);

  scene.environment = createForgeEnvMap(renderer);

  const sunDir = new THREE.Vector3(0.18, 0.16, -0.97).normalize();

  const sky = createSky({
    top: 0x120302,
    horizon: 0x8f3308,
    glow: 0xffb070,
    aurora: 0xff5a1a,
    auroraAmount: 0.9,
    moonDir: sunDir,
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x5e2410, 0x160703, 0.5));

  const keyLight = new THREE.DirectionalLight(0xff9a52, 2.1);
  keyLight.position.copy(sunDir).multiplyScalar(400);
  scene.add(keyLight);

  const rim = new THREE.DirectionalLight(0xff5a1e, 1.4);
  rim.position.set(-120, 40, -260);
  scene.add(rim);

  /* The key light sits beyond the gate, so without this the whole facade
     facing the camera renders unlit and reads as a solid black slab. */
  const facadeFill = new THREE.DirectionalLight(0xffa864, 1.35);
  facadeFill.position.set(0, 150, 420);
  scene.add(facadeFill);

  /* the melt */
  const ground = createLavaGround({ size: 3200, hot: 0xff6a1e, deep: 0x160707, scale: 2.4 });
  ground.mesh.position.y = -0.4;
  scene.add(ground.mesh);

  /* Obsidian spires breaking the plain. They are kept clear of the corridor
     between the camera and the gate — a spire on the flight path used to wash
     the whole frame out with a black slab as the camera pushed through it. */
  const rockMaterial = materials.basalt({ color: 0x241310, roughness: 0.95 });
  for (let i = 0; i < 26; i++) {
    const behindGate = i % 4 === 3;
    const side = i % 2 === 0 ? 1 : -1;
    const x = behindGate ? rand(-520, 520) : side * rand(210, 820);
    const z = behindGate ? -rand(380, 900) : rand(-240, 300);
    const spire = createRock({
      radius: rand(8, 30),
      detail: 2,
      material: rockMaterial,
      seed: i * 3.1,
    });
    spire.position.set(x, rand(-4, 6), z);
    spire.scale.y = rand(1.6, 3.4);
    scene.add(spire);
  }

  /* lava rivers running toward the gate */
  const rivers = [];
  for (let i = 0; i < 3; i++) {
    const river = createLavaRiver({
      length: 640,
      width: 34 - i * 8,
      hot: 0xff7a26,
      speed: 0.5 + i * 0.22,
    });
    river.mesh.position.set(-90 + i * 96, 0.6, 150);
    scene.add(river.mesh);
    rivers.push(river);
  }

  const temple = createForgeTemple({ materials });
  temple.position.set(0, 0, -60);
  scene.add(temple);

  /* smoke rolling across the ground */
  const haze = createForgeHaze({ size: 1400, color: 0xff8a44, density: 0.55, y: 9 });
  scene.add(haze.mesh);

  const embers = createEmbers({ count: 3200, area: 620, height: 140, size: 2.6, color: 0xffb066 });
  scene.add(embers.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    ground.update(time);
    haze.update(time * 1.2);
    embers.update(time);
    for (const river of rivers) river.update(time);
    for (const ray of temple.userData.rays) ray.update(time);

    const intro = clamp01(time / 16);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;

    camera.position.set(
      px * 14 + Math.sin(time * 0.09) * 6,
      30 + eased * 6 - py * 5,
      330 - eased * 168,
    );
    camera.lookAt(px * 10, 66 + eased * 8, -60);
  };

  return { scene, camera, baseFov: 44, update };
}