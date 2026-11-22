import * as THREE from "three";
import { clamp01, rand, createSky, createGroundFog } from "@/components/glacialArchive/Cutscene";
import {
  createMotes,
  glowSprite,
  createGodShafts,
  createSentinelGround,
  sentinelEnvironment,
} from "../SentinelKit";

/* ═════════════════════════════════════════════════════════════════
   THE HOURGLASS STAG — built for its own line:
   "I WILL PUT THIS FIGHT BACK WHERE IT STARTED. AS MANY TIMES AS IT
    TAKES."

   A bone-white plain with no horizon, where the same instant is
   standing in four places at once: the stag and three earlier copies
   of it, each a little further off and a little fainter. Its antlers
   are hourglasses, and their sand runs upward. One camera only — a
   descent from the copies to the living head.
   ═════════════════════════════════════════════════════════════════ */

function createHourglass({ height = 2.6, radius = 0.85, glass, sand }) {
  const group = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.ConeGeometry(radius, height * 0.5, 10), glass);
  upper.position.y = height * 0.25;
  upper.rotation.x = Math.PI;
  group.add(upper);

  const lower = new THREE.Mesh(new THREE.ConeGeometry(radius, height * 0.5, 10), glass);
  lower.position.y = -height * 0.25;
  group.add(lower);

  const waist = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, height * 0.14, 8), glass);
  group.add(waist);

  const fill = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.62, height * 0.3, 10), sand);
  fill.position.y = height * 0.16;
  fill.rotation.x = Math.PI;
  group.add(fill);

  for (const y of [height * 0.52, -height * 0.52]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.16, radius * 1.16, height * 0.07, 12), glass);
    cap.position.y = y;
    group.add(cap);
  }
  return group;
}

function createStag({ bone, glass, sand, ember }) {
  const stag = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(2.1, 5.4, 6, 14), bone);
  body.rotation.z = Math.PI / 2;
  body.position.y = 6.2;
  stag.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 12), bone);
  chest.scale.set(1, 1.05, 0.92);
  chest.position.set(2.6, 6.4, 0);
  stag.add(chest);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.7, 5.2, 10), bone);
  neck.position.set(4.6, 8.9, 0);
  neck.rotation.z = -0.5;
  stag.add(neck);

  const head = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.7, 1.6), bone);
  head.position.set(6.6, 10.7, 0);
  head.rotation.z = -0.16;
  stag.add(head);

  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1, 1.1), bone);
  muzzle.position.set(8.2, 10.2, 0);
  muzzle.rotation.z = -0.22;
  stag.add(muzzle);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), ember);
    eye.position.set(7.1, 11, side * 0.72);
    stag.add(eye);
  }

  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 5.4, 7), bone);
      leg.position.set(-2.6 + i * 1.9, 3.1, side * 1.35);
      leg.rotation.z = (i % 2 ? 0.04 : -0.04);
      stag.add(leg);
    }
  }

  /* the antlers: hourglasses growing out of the skull */
  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 3.2, 6), bone);
    beam.position.set(6.3, 12.6, side * 0.85);
    beam.rotation.set(side * 0.5, 0, 0.3);
    stag.add(beam);

    for (let i = 0; i < 3; i++) {
      const hourglass = createHourglass({
        height: 1.5 + i * 0.4,
        radius: 0.44 + i * 0.06,
        glass,
        sand,
      });
      hourglass.position.set(5.9 + i * 1.1, 13.6 + i * 1.05, side * (1.2 + i * 0.6));
      hourglass.rotation.z = -0.2 - i * 0.16;
      stag.add(hourglass);
    }
  }

  return stag;
}

export default function createHourglassStagScene({ renderer }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0d1418, 0.011);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2200);
  camera.position.set(-24, 46, 84);
  scene.environment = sentinelEnvironment(renderer, 0x101a20, 0xb9cbd4, 0x05090c);

  const sky = createSky({
    top: 0x05090d,
    horizon: 0x93a8b4,
    glow: 0xe8f4ff,
    aurora: 0x7fd8ff,
    auroraAmount: 0.34,
    moonDir: new THREE.Vector3(0.2, 0.34, -1),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0xc8dce8, 0x0a1014, 0.9));

  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(-60, 120, -80);
  scene.add(key);

  const cold = new THREE.DirectionalLight(0x8fd8ff, 1.2);
  cold.position.set(90, 40, 120);
  scene.add(cold);

  const ground = createSentinelGround({
    size: 1800,
    base: 0x0b1114,
    peak: 0x2b3a42,
    amp: 10,
    ridge: 0.22,
    flat: 80,
    roughness: 0.44,
    metalness: 0.46,
    envMapIntensity: 1.3,
  });
  scene.add(ground);

  scene.add(createGodShafts({ count: 6, radius: 75, height: 300, color: 0xdff2ff, opacity: 0.1 }));

  const bone = new THREE.MeshStandardMaterial({
    color: 0xeef3f4,
    roughness: 0.42,
    metalness: 0.16,
    emissive: 0x1a2a30,
    emissiveIntensity: 0.5,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xd8f4ff,
    roughness: 0.06,
    metalness: 0,
    transparent: true,
    opacity: 0.34,
    clearcoat: 1,
    side: THREE.DoubleSide,
  });
  const sand = new THREE.MeshBasicMaterial({ color: 0xfff0c8 });
  const ember = new THREE.MeshBasicMaterial({ color: 0xbdf0ff });

  /* the stag, then three copies of the moment it already lived */
  const living = createStag({ bone, glass, sand, ember });
  living.position.set(0, 0, 0);
  scene.add(living);

  const copies = [];
  for (let i = 1; i <= 3; i++) {
    const ghostBone = bone.clone();
    ghostBone.transparent = true;
    ghostBone.opacity = 0.42 - i * 0.09;
    ghostBone.depthWrite = false;
    const ghost = createStag({ bone: ghostBone, glass, sand, ember });
    ghost.position.set(-i * 6.5, 0, -i * 30);
    ghost.scale.setScalar(1 - i * 0.05);
    scene.add(ghost);
    copies.push({ ghost, lag: i * 0.55, phase: rand(0, 6) });
  }

  /* sand running the wrong way */
  const sandUp = createMotes({ count: 2600, area: 220, height: 70, rgb: "255,240,200", size: 1.9, rise: -14 });
  scene.add(sandUp.points);

  const haze = createGroundFog({ size: 700, color: 0xa8c4d2, density: 0.3, y: 1.4 });
  scene.add(haze.mesh);

  const halo = glowSprite("200,240,255", 256, 0.26);
  halo.position.set(6, 14, 0);
  halo.scale.setScalar(60);
  scene.add(halo);

  const update = (time, delta, pointer) => {
    sky.update(time);
    haze.update(time * 1.1);
    sandUp.update(time, delta);

    living.position.y = Math.sin(time * 0.9) * 0.18;
    living.rotation.y = Math.sin(time * 0.22) * 0.06;

    for (const copy of copies) {
      const beat = Math.sin((time - copy.lag) * 0.9);
      copy.ghost.position.y = beat * 0.18;
      copy.ghost.rotation.y = Math.sin((time - copy.lag) * 0.22) * 0.06;
    }

    /* down from the copies to the living antlers */
    const t = clamp01(time / 22);
    const eased = t * t * (3 - 2 * t);
    camera.position.set(
      -24 + eased * 14 + (pointer?.x ?? 0) * 6,
      46 - eased * 30 - (pointer?.y ?? 0) * 3,
      84 - eased * 58,
    );
    camera.lookAt(2 + eased * 4, 13 + eased * 2, 0);
  };

  return { scene, camera, baseFov: 42, update };
}