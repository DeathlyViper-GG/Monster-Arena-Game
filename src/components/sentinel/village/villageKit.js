import * as THREE from "three";
import {
  createSky,
  createRuneCircle,
  glowTexture,
  rand,
} from "@/components/glacialArchive/Cutscene";
import { createBarrel, createCrate, createFestoon, createStall } from "./villageMarket";

/* ═════════════════════════════════════════════════════════════════
   HOLLOWMERE — the village on the seam.

   Everything here is flat-shaded low-poly so it sits in the same family
   as the arena: a green with a well and a shrine, turf-roofed houses,
   fenced gardens, a hollow arch that is the way out, and — past the
   arch — the Margin Quarter, walled off when the seals were numbered
   and opened only by five iron keys.

   The people who live here are built next door, in villagePeople.
   ═════════════════════════════════════════════════════════════════ */

const TAU = Math.PI * 2;

function flat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88,
    metalness: 0.05,
    flatShading: true,
    ...extra,
  });
}

function glowSprite(rgb, size = 128, opacity = 0.6) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(size, rgb),
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  return sprite;
}

/* ── ground, green and paths ──────────────────────────────── */

function createGround() {
  const geometry = new THREE.CircleGeometry(48, 84);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colors = [];
  const grass = new THREE.Color(0x2f4d3f);
  const deep = new THREE.Color(0x152a26);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const n = 0.5 + 0.5 * Math.sin(x * 0.23 + 1.2) * Math.cos(z * 0.19 - 0.4);
    const c = grass.clone().lerp(deep, n * 0.55);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, flatShading: true }),
  );
}

function createGreen() {
  const group = new THREE.Group();
  const turf = new THREE.Mesh(new THREE.CircleGeometry(12.4, 9), flat(0x3d6350, { roughness: 0.94 }));
  turf.rotation.x = -Math.PI / 2;
  turf.position.y = 0.03;
  group.add(turf);

  const ring = new THREE.Mesh(new THREE.RingGeometry(12.6, 14.6, 56), flat(0x5c5340, { roughness: 0.95 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);

  /* four spoke paths out to the houses */
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * TAU + Math.PI / 4;
    const path = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 16), flat(0x5c5340, { roughness: 0.95 }));
    path.rotation.x = -Math.PI / 2;
    path.rotation.z = -angle;
    path.position.set(Math.sin(angle) * 20, 0.04, Math.cos(angle) * 20);
    group.add(path);
  }

  /* standing stones ringing the green */
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.3;
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.9, rand(1.1, 1.9), 0.6), flat(0x4b5a55));
    stone.position.set(Math.sin(a) * 13.4, stone.geometry.parameters.height / 2, Math.cos(a) * 13.4);
    stone.rotation.y = -a + rand(-0.15, 0.15);
    group.add(stone);
  }
  return group;
}

/* ── houses ───────────────────────────────────────────────── */

function createHouse(accent, seed) {
  const group = new THREE.Group();
  const radius = rand(2.6, 3.5);
  const height = rand(3.0, 4.2);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.06, height, 7),
    flat(0x8a7d63, { roughness: 0.92 }),
  );
  body.position.y = height / 2;
  group.add(body);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.5, radius * 1.15, 7), flat(0x33463a, { roughness: 0.95 }));
  roof.position.y = height + radius * 0.5;
  roof.rotation.y = 0.22;
  group.add(roof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.7, 0.2), flat(0x2a2118));
  door.position.set(0, 0.85, radius * 1.0);
  group.add(door);

  for (const side of [-1, 1]) {
    const window = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.62),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.85 }),
    );
    window.position.set(side * radius * 0.62, height * 0.62, radius * 0.86);
    window.rotation.y = side * 0.5;
    group.add(window);
    const halo = glowSprite("255,214,150", 64, 0.32);
    halo.position.copy(window.position).add(new THREE.Vector3(0, 0, 0.12));
    halo.scale.setScalar(2.1);
    group.add(halo);
  }

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.3, 0.6), flat(0x5c5347));
  chimney.position.set(radius * 0.4, height + radius * 0.9, -radius * 0.3);
  group.add(chimney);

  const smoke = glowSprite("180,200,190", 64, 0.16);
  smoke.position.set(chimney.position.x, chimney.position.y + 1.1, chimney.position.z);
  smoke.scale.set(1.6, 2.4, 1);
  group.add(smoke);

  return { group, radius, chimney, smoke, seed };
}

function createTree(seed) {
  const group = new THREE.Group();
  const height = rand(4.2, 7.4);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.4, height, 6),
    flat(0x3b2f26),
  );
  trunk.position.y = height / 2;
  group.add(trunk);

  const canopy = flat(0x2c5445, { roughness: 0.95 });
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(rand(1.5, 2.3) - i * 0.25, rand(2.2, 3.0), 6), canopy);
    cone.position.y = height * 0.72 + i * 1.15;
    cone.rotation.y = seed + i;
    group.add(cone);
  }
  return { group, height };
}

function createLantern(color) {
  const group = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 4.2, 6), flat(0x2b2f2c));
  post.position.y = 2.1;
  group.add(post);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.09, 0.09), flat(0x2b2f2c));
  arm.position.set(0.4, 4.16, 0);
  group.add(arm);

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshBasicMaterial({ color }));
  bulb.position.set(0.82, 3.92, 0);
  group.add(bulb);

  const halo = glowSprite("255,214,150", 128, 0.5);
  halo.position.copy(bulb.position);
  halo.scale.setScalar(4.2);
  group.add(halo);
  return { group, halo, bulb };
}

function createWell() {
  const group = new THREE.Group();
  const stone = flat(0x55605a);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.85, 0.55), stone);
    block.position.set(Math.sin(a) * 1.75, 0.42, Math.cos(a) * 1.75);
    block.rotation.y = -a;
    group.add(block);
  }
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 18),
    new THREE.MeshBasicMaterial({ color: 0x2a6f80 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.16;
  group.add(water);

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.1, 0.16), flat(0x3b2f26));
    post.position.set(side * 1.5, 1.55, 0);
    group.add(post);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.1, 4), flat(0x33463a));
  roof.position.y = 3.4;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  const glow = glowSprite("140,220,255", 128, 0.4);
  glow.position.y = 0.9;
  glow.scale.setScalar(3.4);
  group.add(glow);
  return { group, glow };
}

function createShrine(accent) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.5, 0.7, 8), flat(0x4a5a58));
  base.position.y = 0.35;
  group.add(base);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.72, 3.2, 8), flat(0x3d4c4a));
  column.position.y = 2.2;
  group.add(column);

  const shard = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.62, 0),
    new THREE.MeshStandardMaterial({
      color: 0xd8f5ff,
      emissive: accent,
      emissiveIntensity: 1.6,
      flatShading: true,
      roughness: 0.2,
      metalness: 0.2,
    }),
  );
  shard.scale.set(1, 2.1, 1);
  shard.position.y = 4.9;
  group.add(shard);

  const halo = glowSprite("180,240,255", 128, 0.55);
  halo.position.y = 4.9;
  halo.scale.setScalar(6.5);
  group.add(halo);

  const runes = createRuneCircle({ radius: 9.6, color: accent, opacity: 0.28, y: 0.09, rings: 2, glyphs: 34 });
  group.add(runes);
  return { group, shard, halo, runes };
}

function createArch() {
  const group = new THREE.Group();
  const stone = flat(0x4e5b57);
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 5.6, 1.1), stone);
    pillar.position.set(side * 2.6, 2.8, 0);
    group.add(pillar);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.0, 1.1), stone);
  lintel.position.y = 6.0;
  group.add(lintel);

  const veil = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 5.2),
    new THREE.MeshBasicMaterial({
      color: 0x9fe3ff,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  veil.position.y = 2.7;
  group.add(veil);

  const halo = glowSprite("160,230,255", 128, 0.35);
  halo.position.y = 3.2;
  halo.scale.setScalar(8);
  group.add(halo);
  return { group, veil };
}

/* ── a house with a staircase ──────────────────────────────────
   Turf-roofed like the rest, but with an outside stair up to a
   railed porch, and a five-lock door set into the wall under it.
   The porch is real ground: the engine walks you up it. */

export const STAIR_DECK = { z: 5.6, w: 4.8, d: 3.8, y: 2.3 };
export const STAIR_RUN = { z0: 7.5, z1: 11.1, w: 2.6, y1: 2.3 };

function createStairHouse(accent, seed) {
  const group = new THREE.Group();
  const radius = 3.3;
  const height = 4.4;

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.05, height, 7),
    flat(0x8a7d63, { roughness: 0.92 }),
  );
  body.position.y = height / 2;
  group.add(body);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 1.5, radius * 1.15, 7),
    flat(0x33463a, { roughness: 0.95 }),
  );
  roof.position.y = height + radius * 0.5;
  roof.rotation.y = 0.22;
  group.add(roof);

  for (const side of [-1, 1]) {
    const window = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.62),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.85 }),
    );
    window.position.set(side * radius * 0.62, height * 0.72, radius * 0.86);
    window.rotation.y = side * 0.5;
    group.add(window);
    const halo = glowSprite("255,214,150", 64, 0.3);
    halo.position.copy(window.position).add(new THREE.Vector3(0, 0, 0.12));
    halo.scale.setScalar(2.1);
    group.add(halo);
  }

  /* the porch */
  const deckTop = new THREE.Mesh(new THREE.BoxGeometry(STAIR_DECK.w, 0.32, STAIR_DECK.d), flat(0x6b5f4c));
  deckTop.position.set(0, STAIR_DECK.y - 0.16, STAIR_DECK.z);
  group.add(deckTop);

  const support = flat(0x4d4a41);
  for (const sx of [-1, 1]) {
    for (const sz of [0, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, STAIR_DECK.y, 0.26), support);
      post.position.set(sx * (STAIR_DECK.w / 2 - 0.2), STAIR_DECK.y / 2 - 0.16, STAIR_DECK.z + (sz ? 1 : -1) * (STAIR_DECK.d / 2 - 0.2));
      group.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, STAIR_DECK.d), flat(0x7d6d55));
    rail.position.set(sx * (STAIR_DECK.w / 2 - 0.05), STAIR_DECK.y + 0.55, STAIR_DECK.z);
    group.add(rail);
  }

  /* the stair run, seven solid steps down to the road */
  const steps = 7;
  const run = (STAIR_RUN.z1 - STAIR_RUN.z0) / steps;
  for (let i = 0; i < steps; i++) {
    const top = STAIR_RUN.y1 * (1 - (i + 0.5) / steps);
    const step = new THREE.Mesh(new THREE.BoxGeometry(STAIR_RUN.w, Math.max(0.22, top), run), flat(0x6f6350));
    step.position.set(0, Math.max(0.22, top) / 2, STAIR_RUN.z0 + (i + 0.5) * run);
    group.add(step);
  }

  /* the five-lock door */
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.16, 1.95, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.8, metalness: 0.3, flatShading: true }),
  );
  door.position.set(0, STAIR_DECK.y + 1.0, radius * 0.95);
  group.add(door);

  const locks = [];
  for (let i = 0; i < 5; i++) {
    const lock = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.028, 5, 10),
      new THREE.MeshStandardMaterial({ color: 0x8d7a55, emissive: 0xffb447, emissiveIntensity: 0.25, roughness: 0.4, metalness: 0.6 }),
    );
    lock.position.set(-0.4 + i * 0.2, STAIR_DECK.y + 0.55, radius * 0.95 + 0.1);
    group.add(lock);
    locks.push(lock);
  }

  const doorHalo = glowSprite("255,206,140", 128, 0.16);
  doorHalo.position.set(0, STAIR_DECK.y + 1.0, radius * 0.95 + 0.2);
  doorHalo.scale.setScalar(3.4);
  group.add(doorHalo);

  return { group, radius, door, doorHalo, locks, seed };
}

/* ── fences and kitchen gardens ───────────────────────────────
   The small things that make a green read as a worked village
   rather than a stage: split-rail fences, and plots turned over
   for cabbages. */

function createFence(x, z, rotY, length = 4.2) {
  const group = new THREE.Group();
  const wood = flat(0x6b5b45, { roughness: 0.94 });
  const posts = Math.max(2, Math.round(length / 1.4) + 1);
  for (let i = 0; i < posts; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.1, 0.13), wood);
    post.position.set(-length / 2 + (i / (posts - 1)) * length, 0.55, 0);
    group.add(post);
  }
  for (const y of [0.46, 0.86]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.09, 0.07), wood);
    rail.position.y = y;
    group.add(rail);
  }
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  return group;
}

function createGarden(x, z, rotY, seed = 0) {
  const group = new THREE.Group();
  const soil = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2), flat(0x3a2f24, { roughness: 0.98 }));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.05;
  group.add(soil);

  const leaf = flat(0x4a7a50, { roughness: 0.9 });
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const tuft = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.32 + ((row + col + seed) % 3) * 0.08, 5),
        leaf,
      );
      tuft.position.set(-1.3 + col * 0.65, 0.2, -0.66 + row * 0.66);
      group.add(tuft);
    }
  }
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  return group;
}

/* ── the Margin Quarter ───────────────────────────────────────
   The half of Hollowmere that was walled off when the seals were
   numbered: a flagged square, two houses, its own lanterns, and a
   five-lock gate that only the iron keys will lift. */

export const QUARTER = { wallZ: 34.4, backZ: 41.2, half: 12.4, gateHalf: 2.7, height: 2.8 };

function createWallRun(group, x0, z0, x1, z1, rows = 3) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const length = Math.hypot(dx, dz);
  const rot = Math.atan2(-dz, dx);
  const count = Math.max(1, Math.round(length / 1.15));
  const blockHeight = QUARTER.height / rows;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const block = new THREE.Mesh(
        new THREE.BoxGeometry((length / count) * 0.94, blockHeight * 0.92, 0.78),
        flat((r + i) % 2 ? 0x5b655d : 0x4d5750, { roughness: 0.95 }),
      );
      block.position.set(x0 + dx * t, blockHeight * (r + 0.5), z0 + dz * t);
      block.rotation.y = rot;
      group.add(block);
    }
  }
}

function createMarginQuarter() {
  const group = new THREE.Group();
  const { wallZ, backZ, half, gateHalf, height } = QUARTER;

  createWallRun(group, -half, wallZ, -gateHalf, wallZ);
  createWallRun(group, gateHalf, wallZ, half, wallZ);
  createWallRun(group, -half, wallZ, -half, backZ);
  createWallRun(group, half, wallZ, half, backZ);
  createWallRun(group, -half, backZ, half, backZ);

  const postMat = flat(0x4a544d, { roughness: 0.9 });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.62, height + 0.9, 0.72), postMat);
    post.position.set(side * (gateHalf + 0.28), (height + 0.9) / 2, wallZ);
    group.add(post);
  }

  const gate = new THREE.Mesh(
    new THREE.BoxGeometry(gateHalf * 2, height * 0.92, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x392a1c, roughness: 0.82, metalness: 0.35, flatShading: true }),
  );
  gate.position.set(0, height * 0.46, wallZ);
  group.add(gate);

  const locks = [];
  for (let i = 0; i < 5; i++) {
    const lock = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.032, 5, 10),
      new THREE.MeshStandardMaterial({ color: 0x8d7a55, emissive: 0xffb447, emissiveIntensity: 0.3, roughness: 0.4, metalness: 0.6 }),
    );
    lock.position.set(-0.72 + i * 0.36, height * 0.52, wallZ + 0.16);
    group.add(lock);
    locks.push(lock);
  }

  const gateGlow = glowSprite("255,206,140", 128, 0.12);
  gateGlow.position.set(0, height * 0.55, wallZ + 0.32);
  gateGlow.scale.setScalar(3.4);
  group.add(gateGlow);

  const paving = new THREE.Mesh(new THREE.CircleGeometry(8.2, 22), flat(0x5a5b52, { roughness: 0.96 }));
  paving.rotation.x = -Math.PI / 2;
  paving.position.set(0, 0.04, (wallZ + backZ) / 2 + 0.4);
  group.add(paving);

  const lanterns = [];
  for (const [x, z] of [[-9.6, wallZ + 2.2], [9.6, wallZ + 2.2], [0, backZ - 1.5]]) {
    const lantern = createLantern(0xffc98a);
    lantern.group.position.set(x, 0, z);
    lantern.group.rotation.y = -Math.atan2(x, z - (wallZ + backZ) / 2);
    group.add(lantern.group);
    lanterns.push(lantern);
  }

  return { group, gate, gateGlow, locks, lanterns };
}

/* ── a key hidden in the village ────────────────────────────
   Deliberately plain: a soot-black iron key with one small catch
   of light, low in the grass. It should be found by looking, not
   by following a beam. */

function createKey() {
  const group = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({
    color: 0x4a4238,
    emissive: 0xffb447,
    emissiveIntensity: 0.26,
    roughness: 0.55,
    metalness: 0.75,
    flatShading: true,
  });

  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.042, 6, 12), iron);
  bow.position.y = 0.2;
  group.add(bow);

  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.42, 0.055), iron);
  shaft.position.y = -0.04;
  group.add(shaft);

  for (const off of [-0.14, -0.24]) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.05), iron);
    tooth.position.set(0.08, off, 0);
    group.add(tooth);
  }

  const halo = glowSprite("255,200,120", 64, 0.28);
  halo.scale.setScalar(0.95);
  group.add(halo);

  return { group, halo };
}

/* ── assemble the village ─────────────────────────────────── */

export function buildVillage(renderer, keySpots = []) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a1d20, 0.011);

  scene.environment = null;
  const sky = createSky({
    top: 0x03080f,
    horizon: 0x1b4a52,
    glow: 0xcfe8ff,
    aurora: 0x2fbfb0,
    auroraAmount: 0.55,
    moonDir: new THREE.Vector3(-0.42, 0.34, -0.84),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x2a4d58, 0x08130f, 0.75));
  const moon = new THREE.DirectionalLight(0xbfd8ff, 0.85);
  moon.position.set(-30, 42, -22);
  scene.add(moon);

  scene.add(createGround());
  scene.add(createGreen());

  const shrine = createShrine(0x9fe3ff);
  shrine.group.position.set(0, 0, -10.5);
  scene.add(shrine.group);

  const well = createWell();
  well.group.position.set(7.6, 0, 3.4);
  scene.add(well.group);

  const arch = createArch();
  arch.group.position.set(0, 0, 33);
  arch.group.rotation.y = Math.PI;
  scene.add(arch.group);

  /* fenced gardens and split rails around the houses */
  scene.add(createGarden(-19.6, 8.4, 0.9, 1));
  scene.add(createGarden(19.4, -8.6, -0.8, 2));
  scene.add(createGarden(4.6, 19.6, 2.4, 3));
  scene.add(createFence(-21.4, 4.6, 0.42, 5.6));
  scene.add(createFence(-15.6, -20.4, -1.24, 5.2));
  scene.add(createFence(13.4, 20.6, 2.3, 5.2));
  scene.add(createFence(21.6, 2.6, -0.36, 4.6));

  const houses = [];
  const houseAccents = [0xffd6a0, 0xa0e8ff, 0xffb8d0, 0xd0c0ff, 0xb0ffd0, 0xffd6a0];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.52;
    const house = createHouse(houseAccents[i], i);
    house.group.position.set(Math.sin(a) * 25, 0, Math.cos(a) * 25);
    house.group.rotation.y = -a + Math.PI;
    scene.add(house.group);
    houses.push({ ...house, x: Math.sin(a) * 25, z: Math.cos(a) * 25 });
  }

  /* ── the stair-houses, and the ground that answers for them ──
     Two houses you can climb. The porch and the steps are real
     geometry and real terrain: heightAt() is what the walker
     stands on, so the stairs go somewhere. */
  const terraces = [];
  const addStairHouse = (x, z, accent, seed) => {
    const rot = Math.atan2(-x, -z);
    const house = createStairHouse(accent, seed);
    house.group.position.set(x, 0, z);
    house.group.rotation.y = rot;
    scene.add(house.group);
    houses.push({ ...house, x, z, blockR: 3.45 });
    terraces.push({ x, z, rot, deck: STAIR_DECK, run: STAIR_RUN });
    return house;
  };
  const stairHouse = addStairHouse(-16, 14.2, 0xa0e8ff, 91);
  addStairHouse(16.5, 8, 0xffb8d0, 92);

  /* ── the Margin Quarter, beyond the arch ─────────────────── */
  const quarter = createMarginQuarter();
  scene.add(quarter.group);

  [[-8.6, 39.4], [8.6, 39.4]].forEach(([x, z], i) => {
    const house = createHouse(0xa0e8ff, 60 + i);
    house.group.position.set(x, 0, z);
    house.group.rotation.y = Math.atan2(-x, -z);
    scene.add(house.group);
    houses.push({ ...house, x, z });
  });

  const heightAt = (x, z) => {
    let height = 0;
    for (const terrace of terraces) {
      const dx = x - terrace.x;
      const dz = z - terrace.z;
      const cos = Math.cos(terrace.rot);
      const sin = Math.sin(terrace.rot);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      const { deck, run } = terrace;
      if (Math.abs(lx) <= deck.w / 2 && Math.abs(lz - deck.z) <= deck.d / 2) {
        height = Math.max(height, deck.y);
      }
      if (Math.abs(lx) <= run.w / 2 && lz >= run.z0 && lz <= run.z1) {
        const p = (lz - run.z0) / (run.z1 - run.z0);
        height = Math.max(height, run.y1 * (1 - p));
      }
    }
    return height;
  };

  /* ── the five hidden keys ───────────────────────────────── */
  const keys = keySpots.map((spot) => {
    const key = createKey();
    const ground = heightAt(spot.x, spot.z);
    key.group.position.set(spot.x, ground + (spot.deck ? 1.2 : 0.4), spot.z);
    scene.add(key.group);
    // A key on a porch wants you up on the porch, not standing under it.
    return { ...key, id: spot.id, baseY: key.group.position.y, minY: spot.deck ? ground - 0.6 : -1 };
  });

  /* ── the market ─────────────────────────────────────────────
     Three carts in an arc on the south side of the green, and the
     two that keep the quarter: the stillroom and the cartographer. */
  const MARKET = [
    { x: 14.6, z: -9.9, accent: 0xffd166, open: true },
    { x: 8.4, z: -16.6, accent: 0x9fe3ff, open: true },
    { x: 0.5, z: -18.6, accent: 0xff9ecb, open: false },
    { x: -4.4, z: 37.6, accent: 0xff9ecb, open: true },
    { x: 4.4, z: 37.6, accent: 0xa9ffd6, open: true },
  ];
  const stalls = [];
  MARKET.forEach((spot, i) => {
    const stall = createStall({ accent: spot.accent, seed: i + 1 });
    stall.group.position.set(spot.x, 0, spot.z);
    stall.group.rotation.y = Math.atan2(-spot.x, -spot.z);
    if (!spot.open) stall.group.scale.setScalar(0.94);
    scene.add(stall.group);
    stalls.push({ ...stall, x: spot.x, z: spot.z, accent: spot.accent });
  });

  const marketProps = { crates: [], barrels: [] };
  for (let i = 0; i < 5; i++) {
    const anchor = MARKET[i % 3];
    const crate = createCrate(i);
    crate.group.position.set(anchor.x + rand(-3.4, 3.4), 0, anchor.z + rand(-2.6, 2.6));
    scene.add(crate.group);
    marketProps.crates.push(crate);
  }
  for (let i = 0; i < 3; i++) {
    const anchor = MARKET[i % 3];
    const barrel = createBarrel(i * 0.8);
    barrel.group.position.set(anchor.x + rand(-3.2, 3.2), 0, anchor.z + rand(-2.4, 2.4));
    scene.add(barrel.group);
    marketProps.barrels.push(barrel);
  }

  const festoons = [];
  const STRANDS = [
    [MARKET[0].x, MARKET[0].z, MARKET[1].x, MARKET[1].z, 0xffd9a0],
    [MARKET[1].x, MARKET[1].z, MARKET[2].x, MARKET[2].z, 0xa9e8ff],
    [MARKET[2].x, MARKET[2].z, -7.0, -12.4, 0xffd9a0],
    [MARKET[0].x, MARKET[0].z, 12.6, -3.2, 0xa9e8ff],
  ];
  STRANDS.forEach(([ax, az, bx, bz, color]) => {
    const festoon = createFestoon(ax, az, bx, bz, { height: 4.7, sag: 1.15, color, count: 10 });
    scene.add(festoon.group);
    festoons.push(festoon);
  });

  const nearStall = (x, z, pad = 4.6) =>
    MARKET.some((spot) => Math.hypot(x - spot.x, z - spot.z) < pad);

  const trees = [];
  for (let i = 0; i < 18; i++) {
    const a = rand(0, TAU);
    const r = rand(17, 44);
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    if (Math.abs(x) < 5 && z > 26) continue;
    if (z > QUARTER.wallZ - 2) continue;
    if (nearStall(x, z, 5.6)) continue;
    if (houses.some((h) => Math.hypot(x - h.x, z - h.z) < (h.blockR ?? h.radius) + 3.2)) continue;
    const tree = createTree(i);
    tree.group.position.set(x, 0, z);
    tree.group.rotation.y = rand(0, TAU);
    scene.add(tree.group);
    trees.push(tree);
  }

  const lanterns = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.16;
    // A post inside an awning would spear the cart: leave those gaps to the stalls.
    const postX = Math.sin(a) * 16.4;
    const postZ = Math.cos(a) * 16.4;
    if (nearStall(postX, postZ, 4.2)) continue;
    if (houses.some((h) => Math.hypot(postX - h.x, postZ - h.z) < (h.blockR ?? h.radius) + 2.4)) continue;
    const lantern = createLantern(i % 2 ? 0xffc98a : 0xa9e8ff);
    lantern.group.position.set(postX, 0, postZ);
    lantern.group.rotation.y = -a;
    scene.add(lantern.group);
    lanterns.push(lantern);
  }

  const warm = new THREE.PointLight(0xffb46a, 26, 34, 2);
  warm.position.set(7.6, 3.2, 3.4);
  scene.add(warm);

  const cold = new THREE.PointLight(0x9fe3ff, 34, 42, 2);
  cold.position.set(0, 5.2, -10.5);
  scene.add(cold);

  const quarterWarm = new THREE.PointLight(0xffb46a, 22, 30, 2);
  quarterWarm.position.set(0, 4.2, 38.4);
  scene.add(quarterWarm);

  return {
    scene,
    sky,
    shrine,
    well,
    arch,
    houses,
    trees,
    lanterns,
    stalls,
    festoons,
    marketProps,
    warm,
    cold,
    renderer,
    terraces,
    heightAt,
    keys,
    quarter,
    quarterWarm,
    marginDoor: stairHouse,
  };
}

export { TAU, glowSprite };