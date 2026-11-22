import * as THREE from "three";
import { clamp01, rand } from "@/components/glacialArchive/Cutscene";
import {
  createStage,
  createCrystoMaterials,
  createKeep,
  createGroundFog,
  createGodRay,
  createMeadowDust,
  valeHeight,
  glowTexture,
} from "./CrystoKit";

/* ═════════════════════════════════════════════════════════════════
   CRYSTO III — THE HOLLOW KNIGHT
   The Sunken Keep at dusk, the gate standing open, and the thing
   that has been waiting inside it since the stone went out.
   ═════════════════════════════════════════════════════════════════ */

const DUSK = { top: 0x1d1830, horizon: 0xb26a54, glow: 0xff9a5c, aurora: 0x6b4f86 };

function knight(m) {
  const g = new THREE.Group();
  const armour = new THREE.MeshStandardMaterial({
    color: 0x2a2333, roughness: 0.62, metalness: 0.35,
    emissive: 0x3b1f5c, emissiveIntensity: 0.45,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: 0x1d1826, emissive: 0x8a55d0, emissiveIntensity: 0.9, roughness: 0.5,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 7.4, 3.2), armour);
  body.position.y = 4.4;
  body.castShadow = true;
  g.add(body);

  const pauldron = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.4, 3.6), armour);
  pauldron.position.y = 7.4;
  g.add(pauldron);

  const head = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.6, 2.7), glow);
  head.position.y = 9.4;
  g.add(head);

  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.6, 5), m.stone(0xb9a9d6));
    horn.position.set(sx * 1.1, 11.4, 0);
    horn.rotation.z = sx * 0.3;
    g.add(horn);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 5, 1.3), armour);
    arm.position.set(sx * 3.1, 5.2, 0);
    arm.rotation.z = sx * 0.12;
    g.add(arm);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.6, 1.5), armour);
    leg.position.set(sx * 1.1, 1.6, 0);
    g.add(leg);
  }

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 8.4, 1.1), m.iron());
  blade.position.set(4, 4.6, 0.6);
  blade.rotation.z = 0.08;
  g.add(blade);

  const eye = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(64, "220,160,255"), color: 0xb478ff, transparent: true,
      opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  eye.scale.setScalar(5);
  eye.position.set(0, 9.4, 1.4);
  g.add(eye);

  const halo = new THREE.PointLight(0x8a55d0, 26, 40, 2);
  halo.position.set(0, 8, 0);
  g.add(halo);

  g.userData.eye = eye;
  g.userData.halo = halo;
  return g;
}

/* I — the keep on the ridge */
export function createKeepOne() {
  const m = createCrystoMaterials();
  const stage = createStage({
    sky: DUSK, fog: 0x6b4a52, fogDensity: 0.0044, sun: 0xff9a5c, sunStrength: 1.8,
  });
  const { scene, camera } = stage;

  const keep = createKeep(m, { lit: false });
  keep.position.y = valeHeight(0, 0);
  scene.add(keep);

  const mist = createGroundFog({ size: 400, color: 0xb08a8a, density: 0.55, y: 1.5 });
  scene.add(mist.mesh);

  const update = (t) => {
    stage.sky.update(t);
    mist.update(t * 0.7);
    keep.userData.update(t);
    const e = clamp01(t / 22);
    const k = e * e * (3 - 2 * e);
    camera.position.set(-58 + k * 26, 20 - k * 8, 104 - k * 34);
    camera.lookAt(0, 14, 0);
  };
  return { scene, camera, baseFov: 44, shadowExtent: 95, update };
}

/* II — through the gate, into the yard */
export function createKeepTwo() {
  const m = createCrystoMaterials();
  const stage = createStage({
    sky: DUSK, fog: 0x5c4048, fogDensity: 0.007, sun: 0xff9a5c, sunStrength: 1.4,
  });
  const { scene, camera } = stage;

  const keep = createKeep(m, { lit: false });
  keep.position.y = valeHeight(0, 0);
  scene.add(keep);

  const dust = createMeadowDust({ count: 600, area: 80, height: 22, color: 0xffc9a0 });
  scene.add(dust);

  const update = (t) => {
    stage.sky.update(t);
    keep.userData.update(t);
    dust.userData.update(t);
    const e = clamp01(t / 24);
    const k = e * e * (3 - 2 * e);
    camera.position.set(2 - k * 1.5, 3.4, 52 - k * 16);
    camera.lookAt(0, 10, 0);
  };
  return { scene, camera, baseFov: 42, shadowExtent: 60, update };
}

/* III — the Hollow Knight rises */
export function createKeepThree() {
  const m = createCrystoMaterials();
  const stage = createStage({
    sky: { top: 0x120c1e, horizon: 0x7a4a6a, glow: 0xb478ff, aurora: 0x6b3f96 },
    fog: 0x2a1e33,
    fogDensity: 0.012,
    sun: 0xa678d8,
    sunStrength: 1.1,
  });
  const { scene, camera } = stage;

  const keep = createKeep(m, { lit: false });
  keep.position.set(0, valeHeight(0, 0) - 4, -18);
  keep.scale.setScalar(0.8);
  scene.add(keep);

  const figure = knight(m);
  figure.position.set(0, valeHeight(0, 0), 6);
  scene.add(figure);

  // the crack it climbs out of
  const crack = new THREE.Mesh(
    new THREE.RingGeometry(3, 7, 26),
    new THREE.MeshBasicMaterial({
      color: 0xa878ff, transparent: true, opacity: 0.7,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  crack.rotation.x = -Math.PI / 2;
  crack.position.set(0, valeHeight(0, 0) + 0.3, 6);
  scene.add(crack);

  const rays = [];
  for (let i = 0; i < 3; i++) {
    const ray = createGodRay({ height: 80, radiusTop: 2, radiusBottom: 10, color: 0xb478ff, opacity: 0.1 });
    ray.mesh.position.set(rand(-10, 10), 40, rand(-6, 8));
    scene.add(ray.mesh);
    rays.push(ray);
  }

  const update = (t) => {
    stage.sky.update(t);
    keep.userData.update(t);
    rays.forEach((r) => r.update(t));
    crack.material.opacity = 0.5 + 0.25 * Math.sin(t * 3);
    crack.scale.setScalar(1 + Math.sin(t * 1.6) * 0.06);
    // it stands up out of the ground over the first seconds
    const rise = clamp01(t / 3.2);
    const eased = rise * rise * (3 - 2 * rise);
    figure.position.y = valeHeight(0, 0) - 6 + eased * 6;
    figure.rotation.y = -0.12 + Math.sin(t * 0.3) * 0.05;
    figure.userData.eye.material.opacity = 0.35 + 0.45 * Math.sin(t * 2.2);
    figure.userData.halo.intensity = 18 + 10 * Math.sin(t * 1.7);
    camera.position.set(Math.sin(t * 0.09) * 16, 5.2 + Math.sin(t * 0.2) * 0.4, 34 - t * 0.12);
    camera.lookAt(0, 6.4, 6);
  };
  return { scene, camera, baseFov: 40, shadowExtent: 50, update };
}