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
   THE CHOIR OF ASH — its own place, built for its own line:
   "WE ARE THE LOST LINES. WE WILL NOT BE READ."

   A scriptorium that burned from the inside out: shelves of charred
   codices, loose pages lifting off them by the thousand, and a ring
   of ash-figures whose faces are open books. One camera only — a slow
   drift through the choir at page height.
   ═════════════════════════════════════════════════════════════════ */

function createAshFigure(material, mouth) {
  const figure = new THREE.Group();

  const robe = new THREE.Mesh(new THREE.ConeGeometry(1.5, 6.4, 7, 1, true), material);
  robe.position.y = 3.2;
  figure.add(robe);

  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 8), material);
  shoulders.scale.set(1, 0.42, 0.8);
  shoulders.position.y = 6.2;
  figure.add(shoulders);

  const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.9, 0.6), material);
  head.position.set(0, 7.6, 0.15);
  figure.add(head);

  // the open page it speaks from
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), mouth);
  page.position.set(0, 7.35, 0.5);
  figure.add(page);

  return { figure, page };
}

export default function createChoirOfAshScene({ renderer }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x140b08, 0.017);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1800);
  camera.position.set(-34, 8, 36);
  scene.environment = sentinelEnvironment(renderer, 0x1c0f08, 0x5a2a10, 0x0a0604);

  const sky = createSky({
    top: 0x0b0606,
    horizon: 0x3f1c0e,
    glow: 0xffb070,
    aurora: 0xff7a34,
    auroraAmount: 0.22,
    moonDir: new THREE.Vector3(-0.3, 0.16, -1),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x6a3a2a, 0x120806, 0.42));

  const fireLight = new THREE.DirectionalLight(0xff9a4a, 2.1);
  fireLight.position.set(40, -30, -120);
  scene.add(fireLight);

  const rim = new THREE.DirectionalLight(0x9fc4ff, 0.8);
  rim.position.set(-120, 60, 140);
  scene.add(rim);

  const ground = createSentinelGround({
    size: 1500,
    base: 0x1a120c,
    peak: 0x3d2417,
    amp: 12,
    ridge: 0.35,
    flat: 70,
    roughness: 0.97,
    metalness: 0.08,
  });
  scene.add(ground);

  scene.add(createGodShafts({ count: 6, radius: 70, height: 260, color: 0xffb488, opacity: 0.09 }));

  /* ── the burned shelves: a scriptorium wall, still glowing ─────── */
  const charMaterial = new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 0.95 });
  const emberMaterial = new THREE.MeshBasicMaterial({ color: 0xff7a34, transparent: true, opacity: 0.5 });
  for (let row = 0; row < 5; row++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(420, 1.6, 12), charMaterial);
    shelf.position.set(0, 9 + row * 13, -190 + row * 4);
    scene.add(shelf);

    for (let i = 0; i < 26; i++) {
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(rand(1.4, 2.6), rand(5, 9), 3.4),
        charMaterial,
      );
      book.position.set(-200 + i * 16 + rand(-3, 3), 12 + row * 13, -190 + row * 4);
      book.rotation.z = rand(-0.06, 0.06);
      scene.add(book);

      if (i % 3 === 0) {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.5, rand(2, 5), 0.4), emberMaterial);
        seam.position.set(book.position.x, book.position.y + 1, book.position.z + 1.8);
        scene.add(seam);
      }
    }
  }

  /* ── the pages, lifting by the thousand ────────────────────────── */
  const pageMaterial = new THREE.MeshStandardMaterial({
    color: 0xf2e4c8,
    emissive: 0x5a2410,
    emissiveIntensity: 0.7,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
  });
  const pages = [];
  const pageGeometry = new THREE.PlaneGeometry(1.7, 2.3);
  for (let i = 0; i < 320; i++) {
    const page = new THREE.Mesh(pageGeometry, pageMaterial);
    const angle = rand(0, Math.PI * 2);
    const radius = rand(6, 60);
    page.position.set(Math.cos(angle) * radius, rand(2, 52), Math.sin(angle) * radius - 30);
    page.rotation.set(rand(-1, 1), rand(-3, 3), rand(-1, 1));
    page.userData = {
      rise: rand(1.4, 4.2),
      spin: rand(-1.2, 1.2),
      sway: rand(0.4, 1.6),
      phase: rand(0, Math.PI * 2),
      top: rand(48, 62),
    };
    scene.add(page);
    pages.push(page);
  }

  /* ── the choir: ash figures in a ring, faces open ──────────────── */
  const ashMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a8378,
    emissive: 0x1a120c,
    emissiveIntensity: 0.5,
    roughness: 0.94,
    metalness: 0.06,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide,
  });
  const mouthMaterial = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.95 });

  const choir = [];
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + 0.14;
    const radius = 26 + (i % 3) * 5;
    const { figure, page } = createAshFigure(ashMaterial, mouthMaterial);
    figure.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius - 26);
    figure.rotation.y = -angle + Math.PI / 2;
    figure.scale.setScalar(0.92 + (i % 4) * 0.07);
    scene.add(figure);
    choir.push({ figure, page, phase: rand(0, Math.PI * 2) });
  }

  const embers = createMotes({ count: 2200, area: 200, height: 90, rgb: "255,150,80", size: 2.2, rise: 9 });
  scene.add(embers.points);

  const haze = createGroundFog({ size: 620, color: 0xc07a4a, density: 0.5, y: 2.6 });
  scene.add(haze.mesh);

  const core = glowSprite("255,170,110", 256, 0.32);
  core.position.set(0, 16, -60);
  core.scale.setScalar(150);
  scene.add(core);

  const update = (time, delta, pointer) => {
    sky.update(time);
    haze.update(time * 1.4);
    embers.update(time, delta);

    for (const page of pages) {
      const d = page.userData;
      page.position.y += d.rise * delta;
      page.position.x += Math.sin(time * 0.7 + d.phase) * d.sway * delta;
      page.rotation.x += d.spin * delta * 0.6;
      page.rotation.y += d.spin * delta * 0.35;
      if (page.position.y > d.top) {
        page.position.y = 1.5;
        const angle = rand(0, Math.PI * 2);
        const radius = rand(6, 60);
        page.position.x = Math.cos(angle) * radius;
        page.position.z = Math.sin(angle) * radius - 30;
      }
    }

    for (const member of choir) {
      member.figure.position.y = Math.sin(time * 0.8 + member.phase) * 0.16;
      member.figure.rotation.y += Math.sin(time * 0.4 + member.phase) * delta * 0.05;
      member.page.material.opacity = 0.7 + Math.sin(time * 3.4 + member.phase) * 0.25;
    }

    /* one drift through the choir, at the height of the pages */
    const t = clamp01(time / 24);
    const eased = t * t * (3 - 2 * t);
    camera.position.set(
      -34 + eased * 62 + (pointer?.x ?? 0) * 5,
      8 + eased * 6 - (pointer?.y ?? 0) * 2.4,
      36 - eased * 46,
    );
    camera.lookAt(0 - eased * 4, 13 + eased * 4, -34);
  };

  return { scene, camera, baseFov: 40, update };
}