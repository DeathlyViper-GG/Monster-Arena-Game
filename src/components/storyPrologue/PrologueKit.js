import * as THREE from "three";
import {
  glowTexture,
  createEnvMap,
  createMaterialLibrary,
} from "@/components/glacialArchive/Cutscene";

/* ═════════════════════════════════════════════════════════════════
   THE PROLOGUE — shared kit.
   The five realm accents, the environment light, and the soul-shard
   the whole story turns on.
   ═════════════════════════════════════════════════════════════════ */

export const REALM_LIGHTS = [
  { key: "meadow", color: 0x7dffa3 },
  { key: "dunes", color: 0xffd782 },
  { key: "glacial", color: 0x9fdcff },
  { key: "cinder", color: 0xff7a3c },
  { key: "void", color: 0xc07cff },
];

export const rgbOf = (hex) => {
  const color = new THREE.Color(hex);
  return `${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)}`;
};

export function createPrologueEnvMap(renderer, opts) {
  return createEnvMap(renderer, opts || { top: 0x05060e, horizon: 0x1b2334, ground: 0x03040a });
}

export function createPrologueMaterials() {
  return createMaterialLibrary();
}

/** The five realms, seen as far-off lights — what the Scribe must reclaim. */
export function createRealmLights({ radius = 420, y = 60, scale = 60, arc = 1.05 } = {}) {
  const group = new THREE.Group();
  const items = [];

  REALM_LIGHTS.forEach((realm, i) => {
    const a = -arc + (i / (REALM_LIGHTS.length - 1)) * arc * 2;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(128, rgbOf(realm.color)),
        color: realm.color,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    sprite.scale.setScalar(scale);
    sprite.position.set(
      Math.sin(a) * radius,
      y + Math.cos(a * 1.7) * 22,
      -Math.cos(a) * radius,
    );
    group.add(sprite);
    items.push({ sprite, phase: i * 1.27 });
  });

  return {
    group,
    update(time) {
      for (const item of items) {
        item.sprite.material.opacity = 0.3 + 0.24 * Math.sin(time * 0.7 + item.phase);
      }
    },
  };
}

/** A soul-shard: a faceted crystal with a hot core and its own halo. */
export function createSoulShard({ color = 0xdce9ff, size = 1 } = {}) {
  const group = new THREE.Group();

  const shell = new THREE.Mesh(
    new THREE.OctahedronGeometry(size, 0),
    new THREE.MeshPhysicalMaterial({
      color: 0xeaf4ff,
      roughness: 0.07,
      metalness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.92,
      emissive: new THREE.Color(color),
      emissiveIntensity: 1.7,
      envMapIntensity: 2,
    }),
  );
  shell.scale.set(1, 2.5, 1);
  group.add(shell);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, rgbOf(color)),
      color,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.scale.setScalar(size * 7.5);
  group.add(halo);

  group.userData.halo = halo;
  group.userData.shell = shell;
  return group;
}

/** Drifting dust — the same GPU ember field the Cinder forge uses. */
export { createEmbers, createGodRay, createChain } from "@/components/cinderIntro/CinderKit";