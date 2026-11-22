// Shared vocabulary for the 3D level editor: the arena's measurements, how each
// realm is coloured, the palette of things a builder can put down, and the
// scenery a realm fills an empty plain with.
import { WORLD } from "@/lib/customLevels";

export { WORLD };

export const CELL = WORLD.cell;
export const COLS = Math.round(WORLD.w / CELL);
export const ROWS = Math.round(WORLD.h / CELL);
export const BLOCK_LEVELS = 5;

// Block edge lengths a builder can choose. Each one divides the cell, so every
// block snaps to a tidy grid and always lines up with its neighbours.
export const BLOCK_SIZES = [
  { id: 50, label: "Half" },
  { id: 100, label: "Cell" },
  { id: 200, label: "Double" },
];

export const BLOCK_MAX_Z = 500;   // the highest a cube's underside may sit

// Any edge length the builder types is allowed, in quarter-cell steps, so a map
// is not limited to three fixed sizes.
export const BLOCK_SIZE_MIN = 25;
export const BLOCK_SIZE_MAX = 300;

export function clampBlockSize(v) {
  const n = Math.round((Number(v) || CELL) / 25) * 25;
  return Math.max(BLOCK_SIZE_MIN, Math.min(BLOCK_SIZE_MAX, n));
}

// One block is one cube: { x, y, z, s, mat } — its lower corner, the height of
// its underside, its edge length and its material. A cube no longer needs
// anything under it, so a block can sit beside a stack at that stack's height.
// Maps saved by an older editor kept a whole column ({ x, y, l }); their cubes
// are rebuilt here so nothing already built has to be rebuilt by hand.
export function cubesOf(blocks) {
  const out = [];
  (blocks || []).forEach((b) => {
    if (!b) return;
    const s = Number(b.s);
    if (s > 0) {
      out.push({
        x: Number(b.x) || 0,
        y: Number(b.y) || 0,
        z: Math.max(0, Number(b.z) || 0),
        s,
        mat: b.mat || "stone",
      });
      return;
    }
    const n = Math.max(1, Math.min(BLOCK_LEVELS, Number(b.l) || 1));
    for (let k = 0; k < n; k++) {
      out.push({ x: Number(b.x) || 0, y: Number(b.y) || 0, z: k * CELL, s: CELL, mat: b.mat || "stone" });
    }
  });
  return out;
}

// The blocks a builder builds with: each one is drawn by the arena's own
// shader in a colour and a surface pattern (stone brick, planks, plating,
// tiles, rock or glowing rune), so towers read like real materials.
export const BLOCK_MATERIALS = [
  { id: "stone", label: "Stone brick", hex: "#8d95a3", pat: 1 },
  { id: "planks", label: "Oak planks", hex: "#a9793f", pat: 3 },
  { id: "brick", label: "Red brick", hex: "#a4533f", pat: 1 },
  { id: "tiles", label: "Tiles", hex: "#c6cbd6", pat: 6 },
  { id: "moss", label: "Mossy rock", hex: "#5d7f4a", pat: 2 },
  { id: "sand", label: "Sandstone", hex: "#d8c48c", pat: 1 },
  { id: "metal", label: "Iron plate", hex: "#7f8a99", pat: 4 },
  { id: "obsidian", label: "Obsidian", hex: "#2f2745", pat: 2 },
  { id: "ember", label: "Ember block", hex: "#d1502e", pat: 5 },
  { id: "arcane", label: "Arcane block", hex: "#7b4fd6", pat: 5 },
];

export function materialOf(id) {
  return BLOCK_MATERIALS.find((m) => m.id === id) || BLOCK_MATERIALS[0];
}

// A realm's four colours: sky (top/bottom), ground (two checker tones), stone,
// rock, building block and its accent glow. Realm 0 is the bare plain the
// builder starts on — grey, colourless, walls only.
export const REALM_LOOK = {
  0: { sky: ["#0c111c", "#1e2634"], ground: ["#3c414c", "#33373f"], stone: "#8e97a6", rock: "#828b9a", block: "#b9c2d4", accent: "#8fa3bf" },
  1: { sky: ["#08150e", "#3f7d55"], ground: ["#2e4a33", "#27402c"], stone: "#9fb0b8", rock: "#7d8f84", block: "#cfd6c2", accent: "#7dffa3" },
  2: { sky: ["#1c1108", "#a5793a"], ground: ["#6a5230", "#5d4728"], stone: "#c9a978", rock: "#b08f5e", block: "#e2c99c", accent: "#ffd166" },
  3: { sky: ["#07131c", "#4a7f9e"], ground: ["#22384a", "#1d3141"], stone: "#a8cfe0", rock: "#8fb6cc", block: "#cfe6f2", accent: "#9fe3ff" },
  4: { sky: ["#180705", "#8a2a12"], ground: ["#3a1a14", "#33150f"], stone: "#8a5048", rock: "#7a4238", block: "#b06a58", accent: "#ff7a66" },
  5: { sky: ["#0a0516", "#4a1f7a"], ground: ["#241436", "#1e102c"], stone: "#8f7ac0", rock: "#7a63ad", block: "#a48ad0", accent: "#d066ff" },
};

export function lookOf(id) {
  return REALM_LOOK[Number(id)] || REALM_LOOK[0];
}

// The hazards the arena actually simulates, so a placed one behaves in play.
export const HAZARD_KINDS = [
  { id: "sand", label: "Quicksand", color: "#e3c477", blurb: "Drags you in and slows you down." },
  { id: "ice", label: "Frost chasm", color: "#9fe3ff", blurb: "Chilled ground and open chasms." },
  { id: "lava", label: "Lava pit", color: "#ff7a4d", blurb: "Dormant, warns, then erupts." },
  { id: "void", label: "Void rift", color: "#c07bff", blurb: "Phasing ground that bites." },
];

// What can be planted: the arena's own tree, drawn by the arena's own renderer.
export const DECOR_KINDS = [{ id: "tree", label: "Tree" }];

// Enemy types → the artwork the arena already draws them with, so a placed
// monster looks like itself while the builder stands in the arena.
const MONSTER_ART = {
  chaser: "ravener",
  tank: "gorgon-x",
  sniper: "noctilith",
  bomber: "hellforged",
  healer: "bone-warden",
  shooter: "blacksite-operative",
  magmalurk: "elem-fire",
  stormcaller: "elem-storm",
  rimewarden: "elem-rime",
  quakestrider: "elem-quake",
  soulmote: "elem-soul",
};

export function monsterArt(type) {
  const file = MONSTER_ART[type];
  return file ? `/assets/monsters/${file}.png` : "";
}

export function emptyLayout3D() {
  return {
    buildings: [],
    obstacles: [],
    blocks: [],
    trees: [],
    hills: [],
    chests: [],
    generators: [],
    hazards: [],
    monsters: [],
  };
}

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Choosing a realm lays that realm's own ground out in front of the builder: the
// natural scatter the game makes (rock and forest formations with clutter
// between them) but deliberately no houses — the buildings in a level are the
// builder's own, stacked block by block.
export function generateScenery(realmId) {
  const lvl = Math.max(1, Number(realmId) || 1);
  const rng = makeRng(0x51ed + lvl * 7919);
  const rint = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const W = WORLD.w;
  const H = WORLD.h;
  const PATH_GAP = 44;
  const EDGE_GAP = 40;
  const out = emptyLayout3D();

  const overlap = (a, b, pad) =>
    !(a.x + a.w + pad < b.x || b.x + b.w + pad < a.x || a.y + a.h + pad < b.y || b.y + b.h + pad < a.y);
  const clear = (r, pad) =>
    !out.obstacles.some((s) => overlap(r, s, pad)) && !out.buildings.some((b) => overlap(r, b, pad));
  const randomRect = (wMin, wMax, hMin, hMax) => {
    const w = rint(wMin, wMax);
    const h = rint(hMin, hMax);
    return { x: rint(EDGE_GAP, W - EDGE_GAP - w), y: rint(EDGE_GAP, H - EDGE_GAP - h), w, h };
  };

  const count = 14 + Math.floor((lvl - 1) * 3);
  for (let i = 0; i < count; i++) {
    for (let t = 0; t < 120; t++) {
      const r = randomRect(160, 320, 120, 260);
      if (!clear(r, PATH_GAP)) continue;
      out.obstacles.push(r);
      break;
    }
  }

  const clutter = 8 + Math.floor((lvl - 1) * 4);
  for (let i = 0; i < clutter; i++) {
    for (let t = 0; t < 40; t++) {
      const r = randomRect(36, 64, 32, 56);
      if (!clear(r, 30)) continue;
      out.obstacles.push(r);
      break;
    }
  }

  return out;
}