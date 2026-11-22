// Builds the arena's own world object from a builder's layout, so the level
// editor can hand it straight to the game's renderer and walk around inside it.
// The shape mirrors what the game itself passes to Render3D.buildWorld(): the
// same border walls, the same buildings, the same hazards — just authored
// rather than scattered.
import { WORLD } from "@/lib/customLevels";
import { cubesOf } from "@/lib/level3d";

const WALL = 18;   // house wall thickness, as in the arena
const DOOR = 74;   // the doorway cut into a house's south wall

export function buildArenaWorld(layout, realmId) {
  const w = WORLD.w;
  const h = WORLD.h;
  const L = layout || {};

  const borders = [
    { x: 0, y: 0, w, h: 40 },
    { x: 0, y: h - 40, w, h: 40 },
    { x: 0, y: 0, w: 40, h },
    { x: w - 40, y: 0, w: 40, h },
  ];

  const world = {
    w,
    h,
    // bare: no scattered grass, bushes, rock or trees from the realm — in the
    // editor the builder's own blocks, rock, trees and houses are the only
    // things in the arena.
    bare: true,
    // no rolling realm terrain either: the ground is level apart from the hills
    // the builder raises and the pads under what they place.
    flat: true,
    solids: borders.slice(),
    // Blocks flatten the ground under them but are deliberately NOT solids: the
    // renderer must never be able to dress one as rock or forest scenery.
    blockPads: [],
    walls: borders.map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h })),
    buildings: [],
    hazards: [],
    chests: [],
    deathChests: [],
    trees: [],
    hills: [],
    realm: Number(realmId) || 1,
  };

  // obstacles — rock, crate or forest, chosen by the renderer from their size
  (L.obstacles || []).forEach((o) => {
    if (!o || !o.w || !o.h) return;
    const r = { x: o.x, y: o.y, w: o.w, h: o.h };
    world.solids.push(r);
    world.walls.push({ x: r.x, y: r.y, w: r.w, h: r.h });
  });

  // blocks: every cube is its own piece, with its own height above the floor,
  // its own edge length and its own material. The renderer draws exactly that
  // cube, so a block placed beside a stack sits at the stack's height and the
  // space under it stays empty.
  world.blocks = [];
  cubesOf(L.blocks).forEach((c) => {
    const top = c.z + c.s;
    world.blocks.push({ x: c.x, y: c.y, w: c.s, h: c.s, z0: c.z, z1: top, mat: c.mat });
    world.blockPads.push({ x: c.x, y: c.y, w: c.s, h: c.s });
    world.walls.push({ x: c.x, y: c.y, w: c.s, h: c.s, top, block: true });
  });

  // houses — four walls with a doorway in the south side, storeys as authored
  (L.buildings || []).forEach((o) => {
    if (!o || !o.w || !o.h) return;
    const x = o.x;
    const y = o.y;
    const bw = o.w;
    const bh = o.h;
    // the doorway in the south wall, cut in the geometry and in the colliders
    const gap = Math.min(DOOR, Math.max(60, bw * 0.4));
    const gapX = x + (bw - gap) / 2;
    world.buildings.push({
      x, y, w: bw, h: bh, t: WALL,
      floors: Math.max(1, Math.min(3, Number(o.floors) || 2)),
      doors: [{ side: "bottom", x: gapX, y: y + bh - WALL, w: gap, h: WALL }],
      inner: { x: x + WALL, y: y + WALL, w: bw - 2 * WALL, h: bh - 2 * WALL },
      hasChest: false,
      chestId: -1,
    });
    world.walls.push({ x, y, w: bw, h: WALL });
    world.walls.push({ x, y, w: WALL, h: bh });
    world.walls.push({ x: x + bw - WALL, y, w: WALL, h: bh });
    world.walls.push({ x, y: y + bh - WALL, w: gapX - x, h: WALL });
    world.walls.push({ x: gapX + gap, y: y + bh - WALL, w: x + bw - (gapX + gap), h: WALL });
  });

  // loose chests (the house stairs keep clear of them)
  (L.chests || []).forEach((c, i) => {
    if (!c) return;
    world.chests.push({
      id: i, x: c.x, y: c.y, z: 0, r: 16, opened: false, buildingIndex: -1,
      rarity: c.rarity || "rare",
    });
  });

  // hazards — the pits and rifts the arena simulates
  (L.hazards || []).forEach((hd) => {
    if (!hd) return;
    world.hazards.push({ x: hd.x - 90, y: hd.y - 90, w: 180, h: 180, type: hd.kind || "sand" });
  });

  // planted trees — the meadow conifer, trunk blocking
  (L.trees || []).forEach((t) => {
    if (!t) return;
    world.trees.push({ x: t.x, y: t.y });
    world.walls.push({ x: t.x - 14, y: t.y - 14, w: 28, h: 28 });
  });

  // raised hills — these lift the terrain heightmap itself
  (L.hills || []).forEach((q) => {
    if (!q) return;
    world.hills.push({
      x: q.x, y: q.y,
      r: Math.max(80, Math.min(420, Number(q.r) || 200)),
      h: Math.max(20, Math.min(320, Number(q.h) || 150)),
    });
  });

  return world;
}