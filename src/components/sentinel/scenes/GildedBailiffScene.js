import * as THREE from "three";
import { clamp01, rand, createSky, createGroundFog } from "@/components/glacialArchive/Cutscene";
import {
  createFrozenCrowd,
  glowSprite,
  createGodShafts,
  createSentinelGround,
  sentinelEnvironment,
} from "../SentinelKit";

/* ═════════════════════════════════════════════════════════════════
   THE GILDED BAILIFF — built for its own line:
   "THE TOWN IS PRESERVED. PRESERVATION REMOVES VARIABLES. YOU ARE
    VARIABLES."

   A market square with everything stopped exactly where it stood:
   a crowd mid-turn, leaves held in the air, a fountain caught in its
   own arc — all sealed under a dome of glass and gold ribbing. In the
   middle of it the Bailiff, leafed in gold, blind behind its mask,
   holding up the writ that stopped them. One camera only — a rise
   from the cobbles to the mask and the paper.
   ═════════════════════════════════════════════════════════════════ */

function createBailiff({ gold, plate, mask, writGlow }) {
  const figure = new THREE.Group();

  const robe = new THREE.Mesh(new THREE.ConeGeometry(2.4, 12, 9, 1, true), plate);
  robe.position.y = 6;
  figure.add(robe);

  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.1, 1.4, 9), gold);
  skirt.position.y = 0.7;
  figure.add(skirt);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.1, 5.2, 9), plate);
  torso.position.y = 12.6;
  figure.add(torso);

  for (let i = 0; i < 5; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.58 + i * 0.09, 0.11, 8, 18), gold);
    band.position.y = 10.6 + i * 0.95;
    band.rotation.x = Math.PI / 2;
    figure.add(band);
  }

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.2, 2.2, 9, 1, true), gold);
  collar.position.y = 16.2;
  figure.add(collar);

  const head = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 2.4, 9), plate);
  head.position.y = 18.1;
  figure.add(head);

  /* the mask: no eyes, only a seam where they should be */
  const maskPlate = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.2, 0.5), gold);
  maskPlate.position.set(0, 18.2, 1.05);
  figure.add(maskPlate);

  const seam = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.09, 0.1), writGlow);
  seam.position.set(0, 18.5, 1.32);
  figure.add(seam);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.2, 0.7, 9), gold);
  crown.position.y = 19.5;
  figure.add(crown);

  /* arms: one at rest, one holding the writ up */
  const restArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 3.4, 6, 10), plate);
  restArm.position.set(-1.9, 13.4, 0.3);
  restArm.rotation.z = 0.28;
  figure.add(restArm);

  const raisedArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 3.8, 6, 10), plate);
  raisedArm.position.set(2.1, 14.6, 0.7);
  raisedArm.rotation.z = -0.72;
  figure.add(raisedArm);

  /* the writ itself */
  const scroll = new THREE.Group();
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 3.6),
    new THREE.MeshStandardMaterial({
      color: 0xfff2d2,
      emissive: 0x8a5a12,
      emissiveIntensity: 1.5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.96,
    }),
  );
  scroll.add(paper);

  for (let i = 0; i < 7; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(rand(1.2, 2.2), 0.06), writGlow);
    line.position.set(0, 1.35 - i * 0.42, 0.02);
    scroll.add(line);
  }

  for (const side of [-1, 1]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.9, 8), gold);
    rod.position.set(side * 1.35, 0, 0);
    scroll.add(rod);
  }

  scroll.position.set(4.4, 16.4, 1.2);
  scroll.rotation.y = -0.34;
  scroll.rotation.z = -0.1;
  figure.add(scroll);

  return { figure, scroll, paper, seam };
}

export default function createGildedBailiffScene({ renderer }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0e1410, 0.012);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 2200);
  camera.position.set(-6, 2, 46);
  scene.environment = sentinelEnvironment(renderer, 0x0c140f, 0xd8a94a, 0x05080a);

  const sky = createSky({
    top: 0x05090a,
    horizon: 0x2f3a24,
    glow: 0xffd98a,
    aurora: 0xd8a94a,
    auroraAmount: 0.2,
    moonDir: new THREE.Vector3(0.16, 0.3, -1),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x9a8a58, 0x0a1008, 0.6));

  const key = new THREE.DirectionalLight(0xffd694, 2.4);
  key.position.set(40, 110, -70);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9fe4c8, 0.9);
  rim.position.set(-90, 40, 120);
  scene.add(rim);

  /* ── the square ───────────────────────────────────────────────── */
  const ground = createSentinelGround({
    size: 800,
    base: 0x1b1811,
    peak: 0x3b3324,
    amp: 3.4,
    ridge: 0.22,
    flat: 90,
    roughness: 0.88,
    metalness: 0.18,
    normalTiles: 30,
  });
  scene.add(ground);

  /* the dome throws its light down as bars onto the stopped crowd */
  scene.add(createGodShafts({ count: 5, radius: 34, height: 150, color: 0xffe2a8, opacity: 0.13, tilt: 0.1 }));

  const cobble = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.94 });
  for (let i = 0; i < 90; i++) {
    const stone = new THREE.Mesh(new THREE.BoxGeometry(rand(1.6, 3), 0.34, rand(1.6, 3)), cobble);
    const angle = rand(0, Math.PI * 2);
    const radius = rand(6, 96);
    stone.position.set(Math.cos(angle) * radius, 0.1, Math.sin(angle) * radius);
    stone.rotation.y = rand(0, Math.PI);
    scene.add(stone);
  }

  /* a fountain stopped in its own arc */
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 7.6, 1.6, 16),
    new THREE.MeshStandardMaterial({ color: 0x33301f, roughness: 0.85, metalness: 0.3 }),
  );
  basin.position.set(-24, 0.8, -30);
  scene.add(basin);

  const waters = new THREE.MeshStandardMaterial({
    color: 0xd8f4ff,
    transparent: true,
    opacity: 0.42,
    roughness: 0.05,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 12; i++) {
    const jet = new THREE.Mesh(new THREE.TorusGeometry(1.1 + i * 0.24, 0.05, 6, 20, Math.PI), waters);
    jet.position.set(-24, 3.4 + i * 0.34, -30);
    jet.rotation.set(0.4, i * 0.5, 0);
    scene.add(jet);
  }

  /* the crowd, exactly as it was standing */
  const crowdMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4436, roughness: 0.92, metalness: 0.1 });
  const crowd = createFrozenCrowd({ count: 22, radius: 38, material: crowdMaterial, seed: 11 });
  scene.add(crowd.group);

  /* leaves held in the air — the preservation made visible */
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0xc8a24a,
    roughness: 0.9,
    side: THREE.DoubleSide,
    emissive: 0x3a2408,
    emissiveIntensity: 0.6,
  });
  const leafGeometry = new THREE.PlaneGeometry(0.7, 1.1);
  for (let i = 0; i < 220; i++) {
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    const angle = rand(0, Math.PI * 2);
    const radius = rand(4, 70);
    leaf.position.set(Math.cos(angle) * radius, rand(1.5, 30), Math.sin(angle) * radius);
    leaf.rotation.set(rand(-1.2, 1.2), rand(-3, 3), rand(-1.2, 1.2));
    scene.add(leaf);
  }

  /* ── the dome: glass panels in gold ribs ─────────────────────── */
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(100, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({
      color: 0xd8f0ff,
      transparent: true,
      opacity: 0.07,
      roughness: 0.04,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  scene.add(dome);

  const goldRib = new THREE.MeshStandardMaterial({ color: 0xd8a94a, roughness: 0.32, metalness: 0.92 });
  for (let i = 0; i < 12; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(100, 0.32, 6, 60, Math.PI), goldRib);
    rib.position.y = 0;
    rib.rotation.y = (i / 12) * Math.PI;
    scene.add(rib);
  }
  for (const y of [32, 62, 88]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(Math.sqrt(Math.max(1, 100 * 100 - y * y)), 0.24, 6, 70),
      goldRib,
    );
    ring.position.y = y;
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
  }

  /* ── the Bailiff ─────────────────────────────────────────────── */
  const gold = new THREE.MeshStandardMaterial({
    color: 0xd8a94a,
    roughness: 0.28,
    metalness: 0.94,
    emissive: 0x3a2408,
    emissiveIntensity: 0.6,
  });
  const plate = new THREE.MeshStandardMaterial({
    color: 0x6a5a2a,
    roughness: 0.42,
    metalness: 0.86,
    emissive: 0x1a1408,
    emissiveIntensity: 0.5,
  });
  const mask = new THREE.MeshStandardMaterial({ color: 0xe8c472, roughness: 0.24, metalness: 0.95 });
  const writGlow = new THREE.MeshBasicMaterial({ color: 0xfff0b8 });
  const bailiff = createBailiff({ gold, plate, mask, writGlow });
  scene.add(bailiff.figure);

  const writLight = new THREE.PointLight(0xffe7a8, 120, 70, 2);
  writLight.position.set(15, 17.5, 6);
  scene.add(writLight);

  const halo = glowSprite("255,220,150", 256, 0.3);
  halo.position.set(14, 17, 4);
  halo.scale.setScalar(58);
  scene.add(halo);

  const haze = createGroundFog({ size: 420, color: 0x9a8a4a, density: 0.4, y: 1.2 });
  scene.add(haze.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    haze.update(time * 0.9);

    // the writ is the only thing in the square that moves
    bailiff.scroll.rotation.z = -0.1 + Math.sin(time * 0.7) * 0.035;
    bailiff.paper.material.emissiveIntensity = 1.3 + Math.sin(time * 2.1) * 0.35;
    bailiff.seam.material.color.setScalar(1);
    writLight.intensity = 104 + Math.sin(time * 2.4) * 30;
    halo.material.opacity = 0.24 + Math.sin(time * 1.7) * 0.07;

    /* up from the cobbles to the mask and the paper */
    const t = clamp01(time / 20);
    const eased = t * t * (3 - 2 * t);
    camera.position.set(
      -6 + eased * 8 + (pointer?.x ?? 0) * 5,
      2 + eased * 15 - (pointer?.y ?? 0) * 2.5,
      46 - eased * 27,
    );
    camera.lookAt(3 + eased * 5, 12 + eased * 6, 0);
  };

  return { scene, camera, baseFov: 44, update };
}