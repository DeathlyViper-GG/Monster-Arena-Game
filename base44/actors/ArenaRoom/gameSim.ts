// ============================================================
// Monster Arena — full authoritative simulation (live-room copy).
// Identical rules to the game_server function; a live room can only bundle its
// own files, so the match sim travels with the room it runs in.
// ============================================================
import {
  GLYPH_KEYS, makeGlyphState, tickEnemyGlyphStatus, glyphMoveMul,
  applyGlyphHit, applyGlyphKill, thornmailReflect,
  tickGlyphAutomata, glyphArmor, ensureStarter
} from "./glyph.ts";
import { initBots, updateBots, bakeBotsSnapshot, updatePvpBots, resolvePvpBotBullets, publicTick, assignIdentities } from "./bots.ts";
import {
  isTeamMode, initTeamMatch, tickTeamMatch, resolveTeamBullets,
  bakeTeamSnapshot, fillTeamsWithBots
} from "./teams.ts";
import { steerMove } from "./steer.ts";
import { duelArena, duelTick, placeDuelBodies, bakeDuel } from "./duel.ts";

export const WORLD = { w: 4000, h: 2800 };
const TICK_MS = 50;
const LOBBY_INTERVAL = 10000;
const DISCONNECT_TIMEOUT = 12000;
const RESPAWN_MS = 4000;
const PLAYER_R = 16;
const BORDER_TOUCH = 6; // how close a player's centre may stand to the arena ring
// A body stepping back into a live match is untouchable for a moment: long
// enough to move and get their bearings, short enough that it cannot be used
// as a shield.
const SPAWN_PROTECT_MS = 2600;

const PLAYER_SPEED = 240;
const SPEED_BOOST_MUL = 1.35;   // a speed orb's burst (matches the offline pickup)
const SPD_SHOOTER = 480, SPD_SNIPER = 760, SPD_BOMB = 260;
const LIFE_SHOOTER = 1.6, LIFE_SNIPER = 2.0, LIFE_BOMB = 0.9;
const DMG_SHOOTER = 8, DMG_SNIPER = 14, DMG_BOMB = 24, SPLASH_BOMB = 140;
const HEAL_AURA_R = 260, HEAL_PER_SEC = 10;
const BOSS3_FIRE_INTERVAL = 2.0, BOSS3_WARN_TIME = 0.5, BOSS3_BLAST_R = 96, BOSS3_BOMB_SPEED = 420, BOSS3_MAX_TRAVEL = 320;
const CONTACT_LAG_MS = 120;

const PVE_POINTS = { ravener: 1, tank: 3, shooter: 4, sniper: 3, bomber: 5, healer: 2, boss: 15 };
export const pvePointsForType = (type) => PVE_POINTS[(type === 'chaser' || type === 'swarm') ? 'ravener' : type] || 0;
const LOOT_TYPES = ['health', 'ammo', 'speed', 'shield'];
// The versus rooms: free-for-all (no storm), battle royale (storm) and the
// two-fighter duel pit.
const isFfa = (mode) => mode === 'pvp' || mode === 'br' || mode === 'duel';

export const now = () => Date.now();
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const CHARS = "abcdefghijkmnpqrstuvwxyz23456789";
export function makeId(n = 6) {
  let s = "";
  for (let i = 0; i < n; i++) s += CHARS[(Math.random() * CHARS.length) | 0];
  return s;
}
const clampInt = (v, a, b) => Math.max(a, Math.min(b, v | 0));

// ---------------- collision ----------------
function circleRectCollide(x, y, r, o) {
  const cx = clamp(x, o.x, o.x + o.w);
  const cy = clamp(y, o.y, o.y + o.h);
  const dx = x - cx, dy = y - cy;
  return (dx * dx + dy * dy) < (r * r);
}
function enemyBlocked(lobby, x, y, r) {
  for (const w of (lobby.world?.walls || [])) if (circleRectCollide(x, y, r, w)) return true;
  return false;
}
function playerBlocked(lobby, x, y, r) {
  // The outer ring takes a much tighter clearance than indoor walls, so a player
  // can stand against the visible arena edge instead of being held a body-width
  // short of it (keep in sync with the client's isBlocked soft radius).
  const W = lobby.world?.w || WORLD.w, H = lobby.world?.h || WORLD.h;
  for (const w of (lobby.world?.walls || [])) {
    const isRing = (w.x <= 1) || (w.y <= 1) || (w.x + w.w >= W - 1) || (w.y + w.h >= H - 1);
    if (circleRectCollide(x, y, isRing ? Math.min(r, BORDER_TOUCH) : r, w)) return true;
  }
  return false;
}
// Where a player steps back into the arena. Landing on the middle ring dropped
// a returning body right in among the bots, so the spot is chosen instead: a
// spread of candidates is scored by how far the closest living thing stands and
// the emptiest one wins. A short grace period covers the arrival itself, in
// case a shot was already in the air.
// A spawn point must never sit on a hazard: lava erupts under a body that has
// only just arrived and takes it out before it can take a step.
export function safeSpawn(lobby, player) {
  const w = lobby.world?.w || WORLD.w;
  const h = lobby.world?.h || WORLD.h;
  const team = (player.team === 0 || player.team === 1) ? player.team : null;
  const threats = [];
  for (const e of lobby.enemies || []) if ((e.hp ?? 1) > 0) threats.push(e);
  for (const b of lobby.bots || []) if ((b.hp ?? 1) > 0) threats.push(b);
  for (const q of lobby.players || []) if (q !== player && (q.hp ?? 1) > 0) threats.push(q);
  const insetX = Math.max(320, Math.round(w * 0.09));
  const insetY = Math.max(260, Math.round(h * 0.09));
  const cands = [];
  if (team != null) {
    // A team comes back on its own side, along three lanes.
    const x = team === 0 ? insetX : w - insetX;
    for (let i = -1; i <= 1; i++) cands.push({ x, y: Math.round(h / 2 + i * h * 0.18) });
  } else {
    // Free-for-all: every direction, near the middle and further out.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      for (const rad of [0.16, 0.3, 0.42]) {
        cands.push({ x: Math.round(w / 2 + Math.cos(a) * w * rad), y: Math.round(h / 2 + Math.sin(a) * h * rad) });
      }
    }
  }
  let best = null, bestGap = -1, firstFree = null;
  for (const c of cands) {
    const x = clamp(c.x, insetX, w - insetX);
    const y = clamp(c.y, insetY, h - insetY);
    if (playerBlocked(lobby, x, y, PLAYER_R)) continue;
    if (hazardAt(lobby, x, y, PLAYER_R + 14)) continue;
    if (!firstFree) firstFree = { x, y };
    let gap = Infinity;
    for (const q of threats) gap = Math.min(gap, Math.hypot(q.x - x, q.y - y));
    if (gap > bestGap) { bestGap = gap; best = { x, y }; }
  }
  const centre = { x: Math.round(w / 2), y: Math.round(h / 2) };
  const spot = best || firstFree || (hazardAt(lobby, centre.x, centre.y, PLAYER_R + 14) ? { x: insetX, y: insetY } : centre);
  player.x = spot.x;
  player.y = spot.y;
  player.z = 0;
  player.spawnProtectUntil = now() + SPAWN_PROTECT_MS;
  return spot;
}

// Walks the whole step instead of just its endpoint, so a fast move can't skip
// across a wall between two checks.
function pathBlocked(lobby, x0, y0, x1, y1, r) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (playerBlocked(lobby, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r)) return true;
  }
  return false;
}
function movePlayerWithCollide(lobby, p, dx, dy) {
  const W = lobby.world?.w || WORLD.w, H = lobby.world?.h || WORLD.h;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  const sx = dx / steps, sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    let nx = p.x + sx;
    if (!playerBlocked(lobby, nx, p.y, 16)) p.x = nx;
    let ny = p.y + sy;
    if (!playerBlocked(lobby, p.x, ny, 16)) p.y = ny;
    p.x = clamp(p.x, 30, W - 30);
    p.y = clamp(p.y, 30, H - 30);
  }
}
export function moveEnemyWithCollide(lobby, e, dx, dy) {
  const W = lobby.world?.w || WORLD.w, H = lobby.world?.h || WORLD.h;
  const dist = Math.hypot(dx, dy);
  const MAX_STEP = 4;
  const steps = Math.max(1, Math.ceil(dist / MAX_STEP));
  const sx = dx / steps, sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    let nx = e.x + sx;
    if (!enemyBlocked(lobby, nx, e.y, e.r)) e.x = nx;
    let ny = e.y + sy;
    if (!enemyBlocked(lobby, e.x, ny, e.r)) e.y = ny;
    e.x = clamp(e.x, e.r, W - e.r);
    e.y = clamp(e.y, e.r, H - e.r);
  }
}
function bulletHitsWall(lobby, x, y, r) {
  for (const w of (lobby.world?.walls || [])) if (circleRectCollide(x, y, r, w)) return true;
  return false;
}
function bulletSegmentHitsWall(lobby, x0, y0, x1, y1, r) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (bulletHitsWall(lobby, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r)) return true;
  }
  return false;
}
function segmentHitsCircle(x0, y0, x1, y1, cx, cy, r) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const dx = x0 + (x1 - x0) * t - cx, dy = y0 + (y1 - y0) * t - cy;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

// ---------------- RNG (deterministic map gen) ----------------
let _rngSeed = 1 >>> 0;
function srand(seed) { _rngSeed = (seed >>> 0); }
function srandom() { _rngSeed = ((_rngSeed * 1664525) + 1013904223) >>> 0; return _rngSeed / 0x100000000; }
const rand = (a, b) => srandom() * (b - a) + a;
const rint = (a, b) => Math.floor(rand(a, b + 1));
function rectOverlap(a, b, pad = 0) {
  return !(a.x + a.w + pad < b.x || b.x + b.w + pad < a.x || a.y + a.h + pad < b.y || b.y + b.h + pad < a.y);
}

// ---------------- level / chest specs ----------------
const LEVEL_SPECS = {
  1: { hazards: { kind: 'none', count: 0 } },
  2: { hazards: { kind: 'sand', count: 10 } },
  3: { hazards: { kind: 'ice', count: 12 } },
  4: { hazards: { kind: 'lava', count: 14 } },
  5: { hazards: { kind: 'void', count: 16 } }
};
const CHEST_RARITY_WEIGHTS = {
  1: [72, 24, 4, 0], 2: [56, 30, 11, 3], 3: [40, 32, 20, 8], 4: [26, 32, 28, 14], 5: [16, 28, 34, 22]
};
const CHEST_RARITY_KEYS = ['common', 'rare', 'epic', 'legendary'];
function rollChestRarity(levelId, waveBonus = 0) {
  const base = CHEST_RARITY_WEIGHTS[levelId] || CHEST_RARITY_WEIGHTS[1];
  const w = base.slice();
  if (waveBonus > 0) { const shift = Math.min(waveBonus * 1.5, w[0] * 0.6); w[0] -= shift; w[2] += shift * 0.5; w[3] += shift * 0.5; }
  let r = rand(0, w[0] + w[1] + w[2] + w[3]);
  for (let i = 0; i < 4; i++) { if (r < w[i]) return CHEST_RARITY_KEYS[i]; r -= w[i]; }
  return 'common';
}
const CHEST_LOOT_TABLE = {
  common: { n: [2, 3], essence: [3, 6], bonusChance: 0.00 },
  rare: { n: [3, 4], essence: [6, 10], bonusChance: 0.20 },
  epic: { n: [3, 5], essence: [10, 16], bonusChance: 0.45 },
  legendary: { n: [4, 6], essence: [18, 28], bonusChance: 0.75 }
};
export function rollChestDropsForServer(ch) {
  const cfg = CHEST_LOOT_TABLE[ch.rarity] || CHEST_LOOT_TABLE.common;
  const types = ['health', 'speed', 'shield', 'ammo'];
  const out = [];
  const n = rint(cfg.n[0], cfg.n[1]);
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), d = rand(18, 36);
    out.push({ x: ch.x + Math.cos(a) * d, y: ch.y + Math.sin(a) * d, type: types[rint(0, types.length - 1)] });
  }
  const ea = rand(0, Math.PI * 2), ed = rand(10, 20);
  out.push({ x: ch.x + Math.cos(ea) * ed, y: ch.y + Math.sin(ea) * ed, type: 'essence', value: rint(cfg.essence[0], cfg.essence[1]) });
  if (rand(0, 1) < cfg.bonusChance) {
    const a2 = rand(0, Math.PI * 2), d2 = rand(20, 40);
    out.push({ x: ch.x + Math.cos(a2) * d2, y: ch.y + Math.sin(a2) * d2, type: types[rint(0, types.length - 1)] });
  }
  return out;
}
function makeDoors(x, y, w, h, t) {
  const sides = ['top', 'bottom', 'left', 'right'];
  const doorCount = rint(1, 3);
  const doors = [];
  for (let i = 0; i < doorCount; i++) {
    const side = sides[rint(0, 3)];
    const len = rint(54, 70);
    if (side === 'top' || side === 'bottom') {
      const px = rint(x + t + 20, x + w - t - 20 - len);
      const py = (side === 'top') ? y : y + h - t;
      doors.push({ side, x: px, y: py, w: len, h: t });
    } else {
      const py = rint(y + t + 20, y + h - t - 20 - len);
      const px = (side === 'left') ? x : x + w - t;
      doors.push({ side, x: px, y: py, w: t, h: len });
    }
  }
  return doors;
}
function rebuildWalls(solids, buildings) {
  const walls = [];
  for (const s of solids) walls.push({ x: s.x, y: s.y, w: s.w, h: s.h });
  for (const b of buildings) {
    const { x, y, w, h, t, doors } = b;
    const split = (a, len, holes) => {
      let segs = [[a, len]];
      for (const ho of holes) {
        const hx = ho.start, hw = ho.len, newSegs = [];
        for (const [sa, sl] of segs) {
          const sb = sa + sl, hb = hx + hw;
          if (hb <= sa || sb <= hx) { newSegs.push([sa, sl]); continue; }
          if (hx > sa) newSegs.push([sa, Math.max(0, hx - sa)]);
          if (hb < sb) newSegs.push([hb, Math.max(0, sb - hb)]);
        }
        segs = newSegs.filter(s => s[1] > 0);
      }
      return segs;
    };
    const holesTop = doors.filter(d => d.side === 'top').map(d => ({ start: d.x, len: d.w }));
    const holesBot = doors.filter(d => d.side === 'bottom').map(d => ({ start: d.x, len: d.w }));
    const holesLeft = doors.filter(d => d.side === 'left').map(d => ({ start: d.y, len: d.h }));
    const holesRight = doors.filter(d => d.side === 'right').map(d => ({ start: d.y, len: d.h }));
    for (const [sx, sl] of split(x, w, holesTop)) walls.push({ x: sx, y: y, w: sl, h: t });
    for (const [sx, sl] of split(x, w, holesBot)) walls.push({ x: sx, y: y + h - t, w: sl, h: t });
    for (const [sy, sl] of split(y, h, holesLeft)) walls.push({ x: x, y: sy, w: t, h: sl });
    for (const [sy, sl] of split(y, h, holesRight)) walls.push({ x: x + w - t, y: sy, w: t, h: sl });
  }
  return walls;
}
function buildChestsForWorld(buildings, hazards, levelId) {
  const chests = [];
  const B = buildings.length;
  const frac = Math.min(0.75, 8 / 15 + ((levelId || 1) - 1) * 0.03);
  const desired = Math.max(0, Math.min(B, Math.round(B * frac)));
  if (desired === 0) return chests;
  const idx = [];
  for (let i = 0; i < B; i++) idx.push(i);
  for (let i = idx.length - 1; i > 0; i--) { const j = rint(0, i); const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp; }
  const pad = 28;
  let chestId = 0;
  for (let k = 0; k < idx.length && chests.length < desired; k++) {
    const b = buildings[idx[k]];
    if (!b || !b.inner) continue;
    let placed = false;
    for (let tries = 0; tries < 50 && !placed; tries++) {
      const cx = rand(b.inner.x + pad, b.inner.x + b.inner.w - pad);
      const cy = rand(b.inner.y + pad, b.inner.y + b.inner.h - pad);
      let bad = false;
      for (const h of hazards) {
        if (cx > h.x - 20 && cx < h.x + h.w + 20 && cy > h.y - 20 && cy < h.y + h.h + 20) { bad = true; break; }
      }
      if (bad) continue;
      chests.push({ id: chestId++, x: cx, y: cy, r: 16, opened: false, buildingIndex: idx[k], drops: null, rarity: rollChestRarity(levelId) });
      placed = true;
    }
  }
  return chests;
}
function buildWorld(levelId, mapSeed, W = WORLD.w, H = WORLD.h) {
  srand(mapSeed);
  const w = W, h = H;
  const spec = LEVEL_SPECS[levelId] || LEVEL_SPECS[1];
  const solids = [], buildings = [], hazards = [];
  const PATH_GAP = 44, EDGE_GAP = 40, MAX_TRIES = 120;
  // Obstacle density follows the arena area, so the doubled PvP / Teams arena
  // is exactly as crowded as the single-player one rather than half empty.
  const areaMul = Math.max(1, (w * h) / (WORLD.w * WORLD.h));
  const COUNT = Math.round((18 + Math.floor((levelId - 1) * 4)) * areaMul);
  solids.push({ x: 0, y: 0, w: w, h: 40 });
  solids.push({ x: 0, y: h - 40, w: w, h: 40 });
  solids.push({ x: 0, y: 0, w: 40, h: h });
  solids.push({ x: w - 40, y: 0, w: 40, h: h });
  const avoidOverlap = (rect, pad) => {
    for (const s of solids) if (rectOverlap(rect, s, pad)) return false;
    for (const b of buildings) if (rectOverlap(rect, { x: b.x, y: b.y, w: b.w, h: b.h }, pad)) return false;
    return true;
  };
  const randomRect = (wMin, wMax, hMin, hMax) => ({
    x: rint(EDGE_GAP, w - EDGE_GAP - rint(wMin, wMax)),
    y: rint(EDGE_GAP, h - EDGE_GAP - rint(hMin, hMax)),
    w: rint(wMin, wMax), h: rint(hMin, hMax)
  });
  for (let i = 0; i < COUNT; i++) {
    const wantBuilding = (rand(0, 1) < 0.6);
    let placed = false;
    for (let t = 0; t < MAX_TRIES && !placed; t++) {
      const r = randomRect(wantBuilding ? 180 : 160, 320, wantBuilding ? 140 : 120, 260);
      if (!avoidOverlap(r, PATH_GAP)) continue;
      if (wantBuilding) {
        const tWall = 18;
        buildings.push({ x: r.x, y: r.y, w: r.w, h: r.h, t: tWall, doors: makeDoors(r.x, r.y, r.w, r.h, tWall), inner: { x: r.x + tWall, y: r.y + tWall, w: r.w - 2 * tWall, h: r.h - 2 * tWall } });
      } else solids.push({ x: r.x, y: r.y, w: r.w, h: r.h });
      placed = true;
    }
  }
  const CLUTTER_GAP = 30, CLUTTER_COUNT = Math.round((8 + Math.floor((levelId - 1) * 4)) * areaMul);
  for (let i = 0; i < CLUTTER_COUNT; i++) {
    for (let t = 0; t < 40; t++) {
      const r = randomRect(36, 64, 32, 56);
      if (!avoidOverlap(r, CLUTTER_GAP)) continue;
      solids.push({ x: r.x, y: r.y, w: r.w, h: r.h });
      break;
    }
  }
  const walls = rebuildWalls(solids, buildings);
  const kind = spec.hazards.kind, hc = spec.hazards.count || 0;
  if (kind !== 'none') {
    let tries = 0;
    while (hazards.length < hc && tries < hc * 40) {
      tries++;
      const hw = rint(140, 260), hh = rint(120, 220);
      const hx = rint(160, w - 160 - hw), hy = rint(160, h - 160 - hh);
      const rect = { x: hx, y: hy, w: hw, h: hh, type: kind };
      const cx = hx + hw / 2, cy = hy + hh / 2;
      if ((cx - w / 2) ** 2 + (cy - h / 2) ** 2 < 600 * 600) continue;
      let bad = false;
      for (const ww of walls) if (rectOverlap(rect, ww, 30)) { bad = true; break; }
      if (bad) continue;
      hazards.push(rect);
    }
  }
  const chests = buildChestsForWorld(buildings, hazards, levelId);
  return { walls, hazards, solids, buildings, chests };
}
// Practice PvP / Teams / CTF arenas double both dimensions in the offline
// modes to fit a full bot roster; online matches use the very same size.
function arenaSize(mode) {
  // A duel pit is a third of the PvE arena's floor: two fighters, nowhere to hide.
  if (mode === 'duel') return duelArena(WORLD.w, WORLD.h);
  const big = mode === 'pvp' || mode === 'br' || mode === 'teams' || mode === 'ctf';
  return { w: big ? WORLD.w * 2 : WORLD.w, h: big ? WORLD.h * 2 : WORLD.h };
}
export function ensureWorldGenerated(lobby) {
  if (lobby.world) return;
  const size = arenaSize(lobby.mode);
  const { walls, hazards, solids, buildings, chests } = buildWorld(lobby.levelId, lobby.mapSeed, size.w, size.h);
  lobby.world = { w: size.w, h: size.h, walls, hazards, solids, buildings, chests };
  lobby.worldKey = `${lobby.levelId}:${lobby.mapSeed}:${size.w}x${size.h}`;
  lobby.chestVer = 0;
}

// ---------------- lobby / players ----------------
export function createLobby(mode, hostId) {
  const created = now();
  const startTime = created + LOBBY_INTERVAL;
  return {
    id: makeId(6), mode, hostId: hostId || null, created, startTime, started: false,
    gamePhase: 'combat', glyphTimer: 0, wave: 1,
    players: [], scores: {}, inputs: {}, bullets: [], enemies: [], spawnQueue: [],
    lastTick: created, levelId: null, mapSeed: null,
    pickups: [], pickupVer: 0, chestVer: 0,
    world: null, worldKey: null, bots: [], snapshot: null,
    giants: [], golems: [], ctf: null, winner: null, chat: [],
    botsEnabled: true, round: 1, zone: null, brNext: 0
  };
}
export function addPlayer(lobby, peerId, name) {
  const existing = lobby.players.find(p => p.id === peerId);
  if (existing) {
    existing.lastSeen = now();
    if (existing.hp <= 0) existing.hp = existing.hpMax ?? 100;
    return existing;
  }
  // The arena of *this* lobby — the big modes play on a doubled map, so the
  // fixed default bounds would drop players off-centre.
  const size = lobby.world || arenaSize(lobby.mode);
  const p = {
    id: peerId, name: name || peerId,
    x: size.w / 2, y: size.h / 2,
    ang: 0, hp: 100, hpMax: 100, design: 0, color: 0,
    guns: { pistol: -1, rifle: -1, shotgun: -1 }, weapon: 0,
    essence: 0, glyphPath: null, glyph: makeGlyphState(), completedGlyphs: {},
    vx: 0, vy: 0, vang: 0, lastSeen: now(), lastShotAt: 0, respawnAt: 0,
    team: null, carrying: false
  };
  lobby.players.push(p);
  lobby.scores[peerId] = 0;
  // Walking into a match in progress drops you where nothing is standing, with
  // a moment of grace — never into the middle of a firefight.
  if (lobby.world) safeSpawn(lobby, p);
  else p.spawnProtectUntil = now() + SPAWN_PROTECT_MS;
  return p;
}
export function removePlayer(lobby, peerId) {
  lobby.players = lobby.players.filter(p => p.id !== peerId);
  delete lobby.inputs[peerId];
  delete lobby.scores[peerId];
  lobby.bullets = lobby.bullets.filter(b => b.owner !== peerId);
}

// ---------------- enemies ----------------
function aiTierForWave(w) { if (w < 4) return 0; if (w < 8) return 1; if (w < 12) return 2; return 3; }
function enemyCountForWave(w) { return clampInt(6 + Math.floor(w * 2.2), 6, 30); }
function weightedPick(weights) {
  let total = 0;
  for (const k in weights) total += Math.max(0, weights[k] || 0);
  if (total <= 0) return 'chaser';
  let r = Math.random() * total;
  for (const k in weights) { r -= Math.max(0, weights[k] || 0); if (r <= 0) return k; }
  return Object.keys(weights)[0] || 'chaser';
}
function weightsForWave(w) {
  const weights = { chaser: 10, tank: 0, shooter: 0, bomber: 0, sniper: 0, healer: 0 };
  if (w >= 2) weights.tank = 2;
  if (w >= 3) weights.tank = 3;
  if (w >= 4) weights.shooter = 2;
  if (w >= 6) weights.shooter = 3;
  if (w >= 6) weights.bomber = 1;
  if (w >= 8) weights.bomber = 2;
  if (w >= 8) weights.sniper = 1;
  if (w >= 10) weights.sniper = 2;
  if (w >= 10) weights.healer = 1;
  if (w >= 14) weights.healer = 2;
  if (w >= 10) weights.chaser = 9;
  if (w >= 14) weights.chaser = 8;
  if (w >= 18) weights.chaser = 7;
  return weights;
}
const pickType = (wave) => weightedPick(weightsForWave(wave));
function spawnEnemy(type, x, y, bossVariant = 0) {
  const v = Math.max(1, bossVariant | 0);
  const e = { id: makeId(8), type, x, y, r: 16, hp: 50, maxhp: 50, speed: 160, vx: 0, vy: 0, fireCD: 0, bombCD: 0, strafeDir: (Math.random() < 0.5 ? -1 : 1), underFireT: 0, bossVariant: v };
  if (type === 'chaser') { e.hp = e.maxhp = 45; e.speed = 210; e.r = 16; }
  else if (type === 'tank') { e.hp = e.maxhp = 220; e.speed = 120; e.r = 22; }
  else if (type === 'shooter') { e.hp = e.maxhp = 70; e.speed = 150; e.r = 15; }
  else if (type === 'sniper') { e.hp = e.maxhp = 60; e.speed = 140; e.r = 16; }
  else if (type === 'bomber') { e.hp = e.maxhp = 55; e.speed = 175; e.r = 18; }
  else if (type === 'healer') { e.hp = e.maxhp = 120; e.speed = 135; e.r = 16; }
  else if (type === 'boss') {
    e.r = 34; e.hp = e.maxhp = 900 + v * 250;
    if (v === 1) { e.speed = 150; e.fireCD = 0; e.bombCD = Infinity; }
    else if (v === 2) { e.speed = PLAYER_SPEED * 2; e.fireCD = Infinity; e.bombCD = Infinity; }
    else { e.speed = 110; e.fireCD = Infinity; e.bombCD = 0; }
  }
  return e;
}
function spawnBlocked(lobby, x, y, r) {
  if (enemyBlocked(lobby, x, y, r)) return true;
  for (const h of (lobby.world?.hazards || [])) if (circleRectCollide(x, y, r, h)) return true;
  return false;
}
function randSpawnPointAwayFromPlayers(lobby, minDist = 520, r = 20) {
  for (let tries = 0; tries < 160; tries++) {
    const x = 120 + Math.random() * (WORLD.w - 240), y = 120 + Math.random() * (WORLD.h - 240);
    let ok = true;
    for (const p of lobby.players) if (dist2(x, y, p.x, p.y) < minDist * minDist) { ok = false; break; }
    if (!ok) continue;
    if (spawnBlocked(lobby, x, y, r)) continue;
    return { x, y };
  }
  for (let tries = 0; tries < 400; tries++) {
    const x = 120 + Math.random() * (WORLD.w - 240), y = 120 + Math.random() * (WORLD.h - 240);
    if (!spawnBlocked(lobby, x, y, r)) return { x, y };
  }
  return { x: WORLD.w - 180, y: WORLD.h / 2 };
}
function desiredChestCount(buildings, levelId) {
  const B = (buildings || []).length;
  return Math.max(0, Math.min(B, Math.round(B * Math.min(0.75, 8 / 15 + ((levelId || 1) - 1) * 0.03))));
}
function randomPointInInnerAvoidHazards(inner, hazards) {
  const pad = 28;
  for (let tries = 0; tries < 60; tries++) {
    const x = rand(inner.x + pad, inner.x + inner.w - pad);
    const y = rand(inner.y + pad, inner.y + inner.h - pad);
    let bad = false;
    for (const h of (hazards || [])) if (x > h.x - 20 && x < h.x + h.w + 20 && y > h.y - 20 && y < h.y + h.h + 20) { bad = true; break; }
    if (!bad) return { x, y };
  }
  return null;
}
function topUpChestsForWave(lobby) {
  if (!lobby.world) return;
  const buildings = lobby.world.buildings || [], hazards = lobby.world.hazards || [];
  lobby.world.chests = lobby.world.chests || [];
  const chests = lobby.world.chests;
  const desired = desiredChestCount(buildings, lobby.levelId);
  if (desired <= 0) return;
  const activeBuildings = new Set();
  for (const c of chests) if (c && c.opened === false) activeBuildings.add(c.buildingIndex);
  let need = desired - activeBuildings.size;
  if (need <= 0) return;
  const candidates = [];
  for (let i = 0; i < buildings.length; i++) { const b = buildings[i]; if (b && b.inner && !activeBuildings.has(i)) candidates.push(i); }
  for (let i = candidates.length - 1; i > 0; i--) { const j = rint(0, i); const tmp = candidates[i]; candidates[i] = candidates[j]; candidates[j] = tmp; }
  const reusable = chests.filter(c => c && c.opened === true);
  let nextId = chests.reduce((m, c) => Math.max(m, (c && typeof c.id === 'number') ? c.id : -1), -1) + 1;
  for (let k = 0; k < candidates.length && need > 0; k++) {
    const b = buildings[candidates[k]];
    const pos = randomPointInInnerAvoidHazards(b.inner, hazards);
    if (!pos) continue;
    let chest = reusable.pop();
    if (!chest) { chest = { id: nextId++ }; chests.push(chest); }
    chest.x = pos.x; chest.y = pos.y; chest.r = 16; chest.opened = false;
    chest.buildingIndex = candidates[k]; chest.drops = null;
    chest.rarity = rollChestRarity(lobby.levelId, lobby.wave || 0);
    need--;
  }
}
function startWave(lobby, n) {
  lobby.wave = n;
  if (!lobby.world?.chests || lobby.world.chests.length === 0) { topUpChestsForWave(lobby); lobby.chestVer++; }
  lobby.wave = n;
  if (lobby.world) {
    lobby.world.chests = lobby.world.chests || [];
    for (const c of lobby.world.chests) { if (!c) continue; c.opened = true; c.drops = null; }
  }
  topUpChestsForWave(lobby);
  lobby.chestVer = (lobby.chestVer || 0) + 1;
  lobby.spawnQueue = [];
  lobby.nextWaveT = 2.0;
  lobby.enemies = lobby.enemies.filter(e => e.type !== 'boss');
  lobby.bullets = lobby.bullets.filter(b => !(typeof b.owner === 'string' && b.owner.startsWith('E:')));
  let bossVariant = 0;
  if (n === 5) bossVariant = 1;
  if (n === 10) bossVariant = 2;
  if (n === 15) bossVariant = 3;
  if (bossVariant > 0) {
    const p = randSpawnPointAwayFromPlayers(lobby, 720, 34);
    lobby.spawnQueue.push({ t: 1.0, type: 'boss', x: p.x, y: p.y, bossVariant });
  }
  const count = enemyCountForWave(n);
  for (let i = 0; i < count; i++) {
    const type = pickType(n);
    const r = (type === 'tank') ? 22 : (type === 'boss') ? 34 : 20;
    const p = randSpawnPointAwayFromPlayers(lobby, 520, r);
    lobby.spawnQueue.push({ t: 0.5 + Math.random() * 8.0, type, x: p.x, y: p.y, wave: n });
  }
  lobby.spawnQueue.sort((a, b) => a.t - b.t);
}
// A free-for-all room's bots arrive spread across the whole arena. Dropped in
// a ring around the middle they started the match already in each other's
// faces and emptied the room in the opening seconds.
function scatterBots(lobby, minGap) {
  const w = lobby.world?.w || WORLD.w, h = lobby.world?.h || WORLD.h;
  const taken = [];
  for (const b of lobby.bots || []) {
    let spot = null;
    for (let i = 0; i < 240 && !spot; i++) {
      const x = 220 + Math.random() * (w - 440);
      const y = 220 + Math.random() * (h - 440);
      if (playerBlocked(lobby, x, y, 22)) continue;
      if (hazardAt(lobby, x, y, 34)) continue;
      let ok = true;
      for (const t of taken) if (Math.hypot(t.x - x, t.y - y) < minGap) { ok = false; break; }
      if (ok) spot = { x: Math.round(x), y: Math.round(y) };
    }
    if (!spot) spot = { x: Math.round(w / 2), y: Math.round(h / 2) };
    b.x = spot.x; b.y = spot.y; b.z = 0; b.vz = 0;
    taken.push(spot);
  }
}

export function startGame(lobby) {
  if (lobby.started) return false;
  if (!lobby.world) ensureWorldGenerated(lobby);
  // A duel is its own thing: two bodies, the small pit, no monsters.
  if (lobby.mode === 'duel') {
    if (lobby.duel && lobby.duel.bot) {
      lobby.botsEnabled = true;
      lobby.botCount = 1;
      initBots(lobby);
      // The opponent is a person, not a target dummy: one of the arena's own
      // names, a mood, a ladder rank of their own — and a shot that bites.
      assignIdentities(lobby);
      const rival = lobby.bots[0];
      if (rival) {
        rival.skill = 0.84 + Math.random() * 0.14;
        rival.hpMax = rival.hp = 140;
        rival.duelPoints = 40 + Math.floor(Math.random() * 300);
        rival.nextChat = Date.now() + 2500;
      }
    } else {
      lobby.botsEnabled = false;
      lobby.bots = [];
    }
    lobby.started = true;
    if (lobby.duel && lobby.duel.phase === 'vote') {
      lobby.duel.phase = 'countdown';
      lobby.duel.startsAt = now() + 3200;
    }
    placeDuelBodies(lobby, (x, y) => !playerBlocked(lobby, x, y, PLAYER_R) && !hazardAt(lobby, x, y, PLAYER_R + 12));
    return true;
  }
  if (lobby.botsEnabled !== false) initBots(lobby);
  // The versus rooms open with the roster scattered, so the match is a match
  // and not a knife fight in a phone box.
  if (isFfa(lobby.mode)) scatterBots(lobby, lobby.mode === 'br' ? 620 : 520);
  lobby.started = true;
  if (lobby.mode === 'pve') startWave(lobby, 1);
  if (lobby.mode === 'br') ensureZone(lobby);
  return true;
}

// ---------------- Battle Royale storm ----------------
// The free-for-all room has no border: the arena is the arena. The battle
// royale room is the one with the storm — a ring that closes in stages, hurts
// whoever is caught outside it, and starts over when a round is won.
const BR_PHASES = [
  { wait: 24, shrink: 18, scale: 0.62, dps: 2 },
  { wait: 18, shrink: 16, scale: 0.58, dps: 4 },
  { wait: 15, shrink: 13, scale: 0.55, dps: 7 },
  { wait: 12, shrink: 12, scale: 0.50, dps: 10 },
  { wait: 10, shrink: 10, scale: 0.46, dps: 14 },
  { wait: 8, shrink: 9, scale: 0.42, dps: 18 },
  { wait: 8, shrink: 8, scale: 0.40, dps: 24 },
  { wait: 6, shrink: 8, scale: 0.38, dps: 30 }
];
const BR_RESET_MS = 7000;

export function ensureZone(lobby) {
  if (lobby.mode !== 'br') { lobby.zone = null; return null; }
  if (lobby.zone) return lobby.zone;
  const w = lobby.world?.w || WORLD.w, h = lobby.world?.h || WORLD.h;
  const cx = w / 2, cy = h / 2;
  const r = Math.hypot(w, h) / 2 + 60;
  lobby.zone = {
    cx, cy, r, fromX: cx, fromY: cy, fromR: r, toX: cx, toY: cy, toR: r,
    phase: 0, t: 0, mode: 'wait', nextPicked: false, dps: BR_PHASES[0].dps,
    alive: 0, round: lobby.round || 1
  };
  return lobby.zone;
}

function tickZone(lobby, dt) {
  const z = lobby.zone;
  if (!z) return;
  const cfg = BR_PHASES[Math.min(z.phase, BR_PHASES.length - 1)];
  z.t += dt;
  if (z.mode === 'wait') {
    if (!z.nextPicked) {
      // The next circle is picked while it is still calm, so it can be shown
      // as a dashed preview — the same telegraph a player learns to read.
      const newR = Math.max(180, z.r * cfg.scale);
      const maxOff = Math.max(0, z.r - newR);
      const a = Math.random() * Math.PI * 2;
      const off = Math.random() * maxOff * 0.8;
      const w = lobby.world?.w || WORLD.w, h = lobby.world?.h || WORLD.h;
      z.toX = clamp(z.cx + Math.cos(a) * off, newR + 60, w - newR - 60);
      z.toY = clamp(z.cy + Math.sin(a) * off, newR + 60, h - newR - 60);
      z.toR = newR;
      z.nextPicked = true;
    }
    if (z.t >= cfg.wait) {
      z.fromX = z.cx; z.fromY = z.cy; z.fromR = z.r;
      z.mode = 'shrink'; z.t = 0; z.dps = cfg.dps;
    }
  } else {
    const p = Math.min(1, z.t / cfg.shrink);
    z.cx = z.fromX + (z.toX - z.fromX) * p;
    z.cy = z.fromY + (z.toY - z.fromY) * p;
    z.r = z.fromR + (z.toR - z.fromR) * p;
    if (p >= 1) {
      z.mode = 'wait'; z.t = 0; z.nextPicked = false;
      z.phase = Math.min(z.phase + 1, BR_PHASES.length - 1);
    }
  }
  // The storm takes whoever is outside it — bodies and bots alike. On the last
  // circle there is nowhere left to stand: the whole arena is storm, so a round
  // always resolves instead of stalling on two survivors.
  const finalStorm = z.phase >= BR_PHASES.length - 1;
  const outside = (x, y) => finalStorm || dist2(x, y, z.cx, z.cy) > z.r * z.r;
  const dps = z.dps || BR_PHASES[0].dps;
  for (const p of lobby.players) {
    if ((p.hp ?? 0) <= 0) continue;
    if (outside(p.x, p.y)) applyPlayerDamage(lobby, p.id, dps * dt, { id: null, hazard: 'The Storm' });
  }
  for (const b of lobby.bots || []) {
    if ((b.hp ?? 0) <= 0) continue;
    if (outside(b.x, b.y)) b.hp = Math.max(0, b.hp - dps * dt);
  }
}

function brAlive(lobby) {
  let n = 0;
  for (const p of lobby.players) if ((p.hp ?? 1) > 0) n++;
  for (const b of lobby.bots || []) if ((b.hp ?? 1) > 0) n++;
  return n;
}

function brFreeSpot(lobby, taken) {
  const w = lobby.world?.w || WORLD.w, h = lobby.world?.h || WORLD.h;
  for (let i = 0; i < 400; i++) {
    const x = 160 + Math.random() * (w - 320);
    const y = 160 + Math.random() * (h - 320);
    if (playerBlocked(lobby, x, y, PLAYER_R)) continue;
    if (hazardAt(lobby, x, y, PLAYER_R + 14)) continue;
    let ok = true;
    for (const t of taken) if (Math.hypot(t.x - x, t.y - y) < 300) { ok = false; break; }
    if (ok) return { x, y };
  }
  return { x: w / 2, y: h / 2 };
}

// One body left standing ends the round. Everyone is then thrown back into the
// arena at a fresh spot, the storm resets, and the next round begins.
function startBrRound(lobby) {
  const taken = [];
  for (const p of lobby.players) {
    const s = brFreeSpot(lobby, taken); taken.push(s);
    p.x = s.x; p.y = s.y; p.z = 0; p.vz = 0; p.vx = 0; p.vy = 0;
    p.hp = p.hpMax ?? 100; p.respawnAt = 0; p.burnT = 0; p.burnStacks = 0;
    p.shield = 0; p.speedBoostT = 0; p._hitBy = null; p._deathAt = 0;
    p.spawnProtectUntil = now() + SPAWN_PROTECT_MS;
  }
  for (const b of lobby.bots || []) {
    const s = brFreeSpot(lobby, taken); taken.push(s);
    b.x = s.x; b.y = s.y; b.z = 0; b.vz = 0;
    b.hp = b.hpMax ?? 100; b.respawnAt = 0; b._shotAt = 0; b.team = null;
  }
  lobby.bullets = [];
  lobby.pickups = [];
  lobby.brNext = 0;
  lobby.winner = null;
  lobby.round = (lobby.round || 1) + 1;
  lobby.zone = null;
  ensureZone(lobby);
  lobby.kills = lobby.kills || [];
  lobby.kills.push({ k: 'The Storm', w: 'Round ' + lobby.round, v: 'New round', x: 0, y: 0, t: now() });
}

// ---------------- hazards ----------------
function hazardAt(lobby, x, y, r) {
  for (const h of (lobby.world?.hazards || [])) if (circleRectCollide(x, y, r, h)) return h;
  return null;
}
function applySandToEnemy(lobby, e, hz, dt) {
  const cx = hz.x + hz.w / 2, cy = hz.y + hz.h / 2;
  const dx = cx - e.x, dy = cy - e.y;
  const dist = Math.hypot(dx, dy) + 1e-6;
  const rx = dx / dist, ry = dy / dist, tx = -ry, ty = rx;
  const maxR = Math.hypot(hz.w, hz.h) * 0.6;
  const closeness = Math.max(0, Math.min(1, 1 - dist / maxR));
  const swirl = 120 + 240 * closeness, pull = 30 + 180 * closeness;
  moveEnemyWithCollide(lobby, e, (tx * swirl + rx * pull) * dt, (ty * swirl + ry * pull) * dt);
}
function applyIceToEnemy(lobby, e, hz, dt) {
  const t = now() / 1000;
  const seed = (hz.x * 0.013 + hz.y * 0.017);
  const dir = (seed * Math.PI * 2) + Math.sin(t * 0.6 + seed) * 0.9;
  const breath = 0.85 + 0.15 * Math.sin(t * 1.1 + seed * 2.3);
  const slideSpeed = 180 * breath;
  moveEnemyWithCollide(lobby, e, Math.cos(dir) * slideSpeed * dt, Math.sin(dir) * slideSpeed * dt);
}
function applyVoidToEnemy(lobby, e, hz) {
  e.voidCD = Math.max(0, (e.voidCD || 0));
  if (e.voidCD > 0) return { killed: false };
  if (Math.random() < 0.5) {
    const holes = (lobby.world?.hazards || []).filter(h => h.type === 'void' && h !== hz);
    if (holes.length) {
      const tgt = holes[(Math.random() * holes.length) | 0];
      const cx = tgt.x + tgt.w / 2, cy = tgt.y + tgt.h / 2;
      const a = Math.random() * Math.PI * 2, r = Math.min(tgt.w, tgt.h) * 0.22;
      e.x = clamp(cx + Math.cos(a) * r, e.r, WORLD.w - e.r);
      e.y = clamp(cy + Math.sin(a) * r, e.r, WORLD.h - e.r);
      e.voidCD = 0.6;
      return { killed: false };
    }
  }
  e.hp = 0;
  return { killed: true };
}
function applyEnemyHazards(lobby, e, dt) {
  e.voidCD = Math.max(0, (e.voidCD || 0) - dt);
  const hz = hazardAt(lobby, e.x, e.y, (e.r || 16) * 0.9);
  if (!hz) return false;
  if (hz.type === 'sand') { applySandToEnemy(lobby, e, hz, dt); return false; }
  if (hz.type === 'ice') { applyIceToEnemy(lobby, e, hz, dt); return false; }
  if (hz.type === 'lava') {
    const phase = hz.phase;
    if (phase === 'warn') return false;
    if (phase === 'eruption') { e.hp = 0; return true; }
    if (phase === 'burn') { e.hp -= 20 * dt; return false; }
    return false;
  }
  if (hz.type === 'void') return applyVoidToEnemy(lobby, e, hz).killed;
  e.hp = 0;
  return true;
}
function touchDps(type, bossVariant = 0) {
  if (type === 'tank') return 42;
  if (type === 'chaser') return 9;
  if (type === 'boss') return bossVariant === 2 ? 16 : 30;
  if (type === 'bomber') return 12;
  if (type === 'sniper') return 8;
  if (type === 'shooter') return 10;
  if (type === 'healer') return 6;
  return 10;
}

// ---------------- loot / xp ----------------
function spawnEnemyLoot(lobby, x, y, count) {
  if (!count) return;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 24;
    lobby.pickups.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, r: 14, type: LOOT_TYPES[(Math.random() * LOOT_TYPES.length) | 0] });
  }
  lobby.pickupVer++;
}
export function spawnXpOrbs(lobby, x, y, count = 1) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 24;
    lobby.pickups.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: 10, type: 'xp', v: 1, bornAt: now() });
  }
  lobby.pickupVer++;
}
function lootCountByEnemy(type) {
  if (type === 'chaser' || type === 'ravener' || type === 'swarm') return 1;
  if (type === 'tank' || type === 'shooter' || type === 'sniper') return 3;
  if (type === 'healer') return 4;
  if (type === 'bomber') return 5;
  if (type === 'boss') return 10;
  return 0;
}
export function awardPvEPoint(lobby, killerId, enemyType) {
  if (!lobby || lobby.mode !== 'pve') return;
  const pts = pvePointsForType(enemyType);
  if (!pts || !killerId || !lobby.scores.hasOwnProperty(killerId)) return;
  lobby.scores[killerId] = (lobby.scores[killerId] || 0) + pts;
}

// ---------------- interpolation history ----------------
function recordEnemyHist(e, tNow) {
  e._hist = e._hist || [];
  e._hist.push({ t: tNow, x: e.x, y: e.y });
  if (e._hist.length > 10) e._hist.shift();
}
function enemyPosAtTime(e, tTarget) {
  const h = e._hist;
  if (!h || h.length === 0) return { x: e.x, y: e.y };
  if (tTarget <= h[0].t) return { x: h[0].x, y: h[0].y };
  if (tTarget >= h[h.length - 1].t) return { x: h[h.length - 1].x, y: h[h.length - 1].y };
  for (let i = h.length - 2; i >= 0; i--) {
    const a = h[i], b = h[i + 1];
    if (a.t <= tTarget && tTarget <= b.t) {
      const u = (tTarget - a.t) / Math.max(1, b.t - a.t);
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }
  }
  return { x: h[0].x, y: h[0].y };
}

// ---------------- player damage ----------------
function clampHp(p) { p.hp = Math.max(0, Math.min(p.hpMax ?? 100, p.hp ?? 100)); }
function applyPlayerDamage(lobby, playerId, dmg, src) {
  const p = lobby.players.find(pl => pl.id === playerId);
  if (!p) return;
  // Still inside the spawn grace: nothing lands on a body that just arrived.
  if ((p.hp ?? 0) > 0 && (p.spawnProtectUntil ?? 0) > now()) return;
  if (src && dmg > 0) p._hitBy = { id: src.id ?? null, weapon: src.weapon || '', hazard: src.hazard || null };
  // Earth glyph passives (stone skin, rooted stance) soften the hit first.
  dmg = dmg * glyphArmor(p);
  // Shield orbs from chests soak damage first, exactly like the offline shield.
  let left = dmg;
  if ((p.shield ?? 0) > 0 && left > 0) {
    const used = Math.min(p.shield, left * 0.8);
    p.shield = Math.max(0, p.shield - used);
    left -= used;
  }
  // What just landed on this player, so the shooter's client can float the
  // number over the target it actually hit instead of guessing.
  if (src && left > 0) p._lastHit = { by: src.id ?? null, dmg: Math.round(left), t: now() };
  // A revolver round is lethal whatever the shield or stone skin soaked: the
  // key-holder's piece drops a player where they stand.
  if (src && src.oneShot) left = Math.max(left, p.hp ?? 100);
  p.hp = (p.hp ?? 100) - left;
  clampHp(p);
}

// ---------------- kills: finisher + kill feed ----------------
// Friendly names for whatever dealt the last blow, so a death can be announced
// as "killer → weapon → victim" without the client guessing.
const ENEMY_KILL_NAME = {
  chaser: 'Ravener', swarm: 'Ravener', tank: 'Bulwark', shooter: 'Marksman',
  sniper: 'Sniper', bomber: 'Bomber', healer: 'Mender', boss: 'Boss',
  hearth_warden: 'Hearth Warden', pharaoh_glass: 'Pharaoh', rime_oracle: 'Rime Oracle',
  magma_titan: 'Magma Titan', void: 'Void', hollow: 'The Hollow',
};

function killSource(lobby, src) {
  const id = src && src.id ? String(src.id) : '';
  if (!id) return { k: 'The Arena', w: src && src.hazard ? String(src.hazard) : 'Hazard' };
  if (id.startsWith('E:')) {
    const e = (lobby.enemies || []).find((x) => 'E:' + x.id === id);
    return { k: e ? (ENEMY_KILL_NAME[e.type] || 'Monster') : 'Monster', w: src.weapon || 'Attack' };
  }
  if (id.startsWith('B:')) {
    const b = (lobby.bots || []).find((x) => 'B:' + x.id === id || x.id === src.id);
    return { k: (b && b.name) || 'Bot', w: src.weapon || 'Pistol' };
  }
  const p = (lobby.players || []).find((x) => x.id === id);
  return { k: (p && p.name) || 'Player', w: src.weapon || 'Weapon' };
}

// One record per death, delivered once and then spliced out of the snapshot.
function scanPlayerDeaths(lobby, t) {
  for (const p of lobby.players) {
    if ((p.hp ?? 1) > 0) { p._deathAt = 0; continue; }
    if (p._deathAt) continue;
    p._deathAt = t || now();
    const src = killSource(lobby, p._hitBy);
    lobby.kills = lobby.kills || [];
    lobby.kills.push({ k: src.k, w: src.w, v: p.name || 'Player', x: Math.round(p.x), y: Math.round(p.y), t: Date.now() });
    if (lobby.kills.length > 8) lobby.kills = lobby.kills.slice(-8);
    // Player-versus-player kills are a score: only a human shooter scores.
    const killer = p._hitBy && p._hitBy.id ? String(p._hitBy.id) : '';
    if (killer && !killer.startsWith('E:') && !killer.startsWith('B:') && killer !== p.id && isFfa(lobby.mode)) {
      lobby.pvpKills = lobby.pvpKills || {};
      lobby.pvpKills[killer] = (lobby.pvpKills[killer] || 0) + 1;
    }
    p._hitBy = null;
  }
}
function handlePvPPlayerBulletHits(lobby, b, i) {
  if (!isFfa(lobby.mode)) return false;
  if (typeof b.owner !== 'string') return false;
  const x0 = b._x0 ?? b.x, y0 = b._y0 ?? b.y;
  // A shot passes at the height it was fired at: someone standing a storey
  // above (or below) is out of its path, even at the same map position.
  const bz = typeof b.z === 'number' ? b.z : 0;
  for (const p of lobby.players) {
    if (p.id === b.owner) continue;
    if (Math.abs(bz - (p.z ?? 0)) > 60) continue;
    const rr = (b.r ?? 4) + 16;
    if (segmentHitsCircle(x0, y0, b.x, b.y, p.x, p.y, rr)) {
      applyPlayerDamage(lobby, p.id, b.dmg ?? 10, { id: b.owner, weapon: b.w || 'Weapon', oneShot: !!b.one });
      // A flame hit sets them alight: the burn keeps burning after the cloud moves on.
      if (b.kind === 'flamethrower' && (p.hp ?? 0) > 0) {
        p.burnT = Math.max(p.burnT ?? 0, 3.2);
        p.burnStacks = Math.min(3, (p.burnStacks ?? 0) + 1);
      }
      lobby.bullets.splice(i, 1);
      return true;
    }
  }
  return false;
}
function explodeEnemyBomb(lobby, b) {
  const splash = (b.splashR ?? SPLASH_BOMB), maxDmg = (b.dmg ?? DMG_BOMB);
  for (const p of lobby.players) {
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    const edge = splash + 16;
    if (d <= edge) { const t = 1 - (d / edge); applyPlayerDamage(lobby, p.id, maxDmg * (0.25 + 0.75 * t), { id: b.owner, weapon: 'Bomb' }); }
  }
}

// ---------------- enemy AI ----------------
function enemyAI(lobby, e, dt) {
  if ((e._stunT ?? 0) > 0) return;
  let tgt = null, best = Infinity;
  for (const p of lobby.players) { const d = dist2(e.x, e.y, p.x, p.y); if (d < best) { best = d; tgt = p; } }
  if (!tgt) return;
  const dx = tgt.x - e.x, dy = tgt.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const baseAng = Math.atan2(dy, dx);
  e.fireCD = Math.max(0, (e.fireCD ?? 0) - dt);
  e.bombCD = Math.max(0, (e.bombCD ?? 0) - dt);
  const wave = lobby.wave || (e.spawnWave || 1);
  const tier = aiTierForWave(wave);
  const nowT = now();
  const playerShooting = (tgt.lastShotAt && (nowT - tgt.lastShotAt) < 260);
  if (playerShooting && dist < 900) e.underFireT = 0.7;
  e.underFireT = Math.max(0, (e.underFireT ?? 0) - dt);
  const underFire = (e.underFireT ?? 0) > 0;
  let healer = null;
  if (e.type !== 'healer') healer = lobby.enemies.find(x => x.type === 'healer');
  let moveAng = baseAng, moveMul = 1;

  if (e.type === 'boss') {
    const v = e.bossVariant || 1;
    if (v === 1) {
      if ((e.fireCD ?? 0) <= 0) {
        const a = baseAng + (Math.random() * 2 - 1) * 0.10;
        lobby.bullets.push({ owner: `E:${e.id}`, kind: 'enemy', x: e.x + Math.cos(a) * (e.r + 10), y: e.y + Math.sin(a) * (e.r + 10), vx: Math.cos(a) * 1050, vy: Math.sin(a) * 1050, r: 4, dmg: 2, life: 1.1 });
        e.fireCD = 0.33;
      }
    } else if (v === 3) {
      e.bombCD = (e.bombCD ?? 0) - dt;
      if (e.bombCD <= 0) {
        let tx = tgt.x + (Math.random() * 2 - 1) * 120, ty = tgt.y + (Math.random() * 2 - 1) * 120;
        { const ddx = tx - e.x, ddy = ty - e.y, d = Math.hypot(ddx, ddy) || 1; if (d > BOSS3_MAX_TRAVEL) { const s = BOSS3_MAX_TRAVEL / d; tx = e.x + ddx * s; ty = e.y + ddy * s; } }
        const a = angleTo(e.x, e.y, tx, ty);
        lobby.bullets.push({ owner: `E:${e.id}`, kind: 'enemyBomb', x: e.x + Math.cos(a) * (e.r + 12), y: e.y + Math.sin(a) * (e.r + 12), vx: Math.cos(a) * BOSS3_BOMB_SPEED, vy: Math.sin(a) * BOSS3_BOMB_SPEED, r: 9, life: 2.0, targetX: tx, targetY: ty, warnT: BOSS3_WARN_TIME, splashR: BOSS3_BLAST_R, dmg: 48 });
        e.bombCD = BOSS3_FIRE_INTERVAL;
      }
    }
  }

  if (e.type === 'healer') {
    const cx = WORLD.w / 2, cy = WORLD.h / 2;
    const dc = Math.hypot(cx - e.x, cy - e.y);
    const a = angleTo(e.x, e.y, cx, cy);
    if (dc > 120) { moveAng = a; moveMul = 1; } else moveMul = 0.2;
    for (const ally of lobby.enemies) {
      if (ally === e) continue;
      if (dist2(e.x, e.y, ally.x, ally.y) <= HEAL_AURA_R * HEAL_AURA_R) ally.hp = Math.min(ally.maxhp, ally.hp + HEAL_PER_SEC * dt);
    }
  } else if (e.type === 'bomber') {
    const minRange = 220, maxRange = 420;
    if (dist < minRange) { moveAng = baseAng + Math.PI; moveMul = 0.9; }
    else if (dist > maxRange) { moveAng = baseAng; moveMul = 1.0; }
    else moveMul = 0.55;
    if (e.bombCD <= 0 && dist >= minRange && dist <= maxRange) {
      const a = baseAng + (Math.random() * 2 - 1) * 0.10;
      lobby.bullets.push({ owner: `E:${e.id}`, kind: 'enemyBomb', x: e.x + Math.cos(a) * (e.r + 8), y: e.y + Math.sin(a) * (e.r + 8), vx: Math.cos(a) * SPD_BOMB, vy: Math.sin(a) * SPD_BOMB, r: 6, dmg: DMG_BOMB, life: LIFE_BOMB, splashR: SPLASH_BOMB });
      e.bombCD = 1.15;
    }
  } else if (e.type === 'shooter') {
    const keepMin = 220, keepMax = 650;
    if (dist < keepMin) moveAng = baseAng + Math.PI;
    else if (dist > keepMax) moveAng = baseAng;
    else moveAng = (tier >= 1) ? baseAng + (e.strafeDir || 1) * Math.PI / 2 : baseAng;
    if (e.fireCD <= 0 && dist < 760) {
      const a = baseAng + (Math.random() * 2 - 1) * 0.12;
      lobby.bullets.push({ owner: `E:${e.id}`, kind: 'enemy', x: e.x + Math.cos(a) * (e.r + 6), y: e.y + Math.sin(a) * (e.r + 6), vx: Math.cos(a) * SPD_SHOOTER, vy: Math.sin(a) * SPD_SHOOTER, r: 4, dmg: DMG_SHOOTER, life: LIFE_SHOOTER });
      e.fireCD = (tier >= 2) ? 0.32 : 0.38;
    }
  } else if (e.type === 'sniper') {
    const keepMin = 620, keepMax = 1200;
    if (dist < keepMin) { moveAng = baseAng + Math.PI; moveMul = 0.8; }
    else if (dist > keepMax) { moveAng = baseAng; moveMul = 1.0; }
    else moveMul = underFire ? 1.0 : 0.25;
    if (underFire) moveAng = baseAng + (e.strafeDir || 1) * Math.PI / 2;
    if (e.fireCD <= 0 && dist < 1400) {
      let aAim = baseAng;
      if (!underFire && tier >= 2) {
        const leadT = Math.min(0.55, dist / SPD_SNIPER);
        aAim = angleTo(e.x, e.y, tgt.x + (tgt.vx || 0) * leadT * 0.9, tgt.y + (tgt.vy || 0) * leadT * 0.9);
      }
      aAim += (Math.random() * 2 - 1) * (underFire ? 0.06 : 0.03);
      lobby.bullets.push({ owner: `E:${e.id}`, kind: 'enemy', x: e.x + Math.cos(aAim) * (e.r + 8), y: e.y + Math.sin(aAim) * (e.r + 8), vx: Math.cos(aAim) * SPD_SNIPER, vy: Math.sin(aAim) * SPD_SNIPER, r: 4, dmg: DMG_SNIPER, life: LIFE_SNIPER });
      e.fireCD = underFire ? 1.35 : 1.8;
    }
  } else if (e.type === 'chaser') {
    let aAim = baseAng;
    if (!underFire && tier >= 2) {
      const leadT = Math.min(0.55, dist / SPD_SNIPER);
      aAim = angleTo(e.x, e.y, tgt.x + (tgt.vx || 0) * leadT * 0.9, tgt.y + (tgt.vy || 0) * leadT * 0.9);
    }
    if (healer && !playerShooting && e.hp < e.maxhp * 0.7) moveAng = angleTo(e.x, e.y, healer.x, healer.y);
    else {
      moveAng = baseAng;
      const commander = lobby.enemies.find(x => x.type === 'shooter' || x.type === 'sniper' || x.type === 'boss');
      if (commander && dist2(commander.x, commander.y, tgt.x, tgt.y) < 1200 * 1200) {
        const flankA = baseAng + Math.PI / 2;
        moveAng = angleTo(e.x, e.y, tgt.x + Math.cos(flankA) * 180, tgt.y + Math.sin(flankA) * 180);
      }
    }
  } else if (e.type === 'tank') {
    moveAng = baseAng;
  }

  const sp = (e.speed ?? 160) * moveMul * glyphMoveMul(e);
  // Steer around walls instead of grinding into them.
  steerMove(lobby, e, moveAng, sp, dt, moveEnemyWithCollide);
}

// ---------------- main step (one fixed 50ms tick) ----------------
// ---------------- utility fields ----------------
// A thrown utility is a patch of ground with a life of its own. The room keeps
// it for as long as the catalogue says, and applies what it does — the blast,
// the venom, the snare, the vortex — tick by tick. The client only draws it, so
// a live match behaves exactly like the offline game.
const UTIL_RULES: Record<string, any> = {
  scrap_snare:   { dmg: 6,   once: true, stun: 1.4 },
  breach_charge: { dmg: 62,  once: true, fuse: 1.6, stun: 0.4 },
  tar_grenade:   { dmg: 0,   every: 0.7, stun: 0.35 },
  viper_fang:    { dmg: 4.5, every: 0.5 },
  shock_mine:    { dmg: 40,  once: true, arm: 1.0, trip: 48 },
  void_anchor:   { pull: 150 }
};

function utilBlast(lobby, f, rule, ownerTeam) {
  const r = Number(f.r) || 120;
  const dmg = Number(rule.dmg) || 0;
  if (lobby.mode === 'pve') {
    for (const en of lobby.enemies || []) {
      if (!en || en.hp <= 0 || en.absorbing) continue;
      if (dist2(f.x, f.y, en.x, en.y) > (r + (en.r || 16)) ** 2) continue;
      en.hp = Math.max(0, en.hp - dmg);
      if (rule.stun) en.stunT = Math.max(en.stunT || 0, rule.stun);
      // The kill sweep credits whoever wounded it last, so a utility kill pays
      // the player who threw it exactly like a bullet would — a field that only
      // stuns (tar, snare) must not steal the credit for someone else's kill.
      if (dmg > 0) en._lastHitBy = f.owner;
    }
    return;
  }
  for (const p of lobby.players) {
    if (!p || p.id === f.owner || (p.hp ?? 1) <= 0) continue;
    if (isTeamMode(lobby.mode) && ownerTeam != null && p.team === ownerTeam) continue;
    if (dist2(f.x, f.y, p.x, p.y) > (r + 16) ** 2) continue;
    applyPlayerDamage(lobby, p.id, dmg, { id: f.owner, weapon: 'utility' });
  }
  for (const b of lobby.bots || []) {
    if (!b || (b.hp ?? 0) <= 0) continue;
    if (isTeamMode(lobby.mode) && ownerTeam != null && b.team === ownerTeam) continue;
    if (dist2(f.x, f.y, b.x, b.y) > (r + (b.r || 16)) ** 2) continue;
    b.hp = Math.max(0, (b.hp ?? 100) - dmg);
    b._shotAt = now();
  }
}

function tickUtilityFields(lobby, dt) {
  const fx = lobby.utilityFx;
  if (!Array.isArray(fx) || !fx.length) return;
  const t = now();
  const ownerTeam = (id) => {
    const p = lobby.players.find((x) => x.id === id);
    return p ? p.team : null;
  };
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    if (!f) { fx.splice(i, 1); continue; }
    const age = (t - (f.t0 || t)) / 1000;
    const life = Number(f.dur) || 6;
    if (age > life + 0.25) { fx.splice(i, 1); continue; }
    const rule = UTIL_RULES[f.id];
    if (!rule) continue;
    const r = Number(f.r) || 120;

    // The vortex drags whatever is standing in it toward its heart.
    if (rule.pull) {
      const pull = (o) => {
        if (!o || (o.hp ?? 1) <= 0) return;
        const dx = f.x - o.x, dy = f.y - o.y;
        const d = Math.hypot(dx, dy);
        if (d < 26 || d > r) return;
        const step = Math.min(d, rule.pull * dt);
        const nx = o.x + (dx / d) * step, ny = o.y + (dy / d) * step;
        if (playerBlocked(lobby, nx, ny, o.r || 16)) return;
        o.x = nx; o.y = ny;
      };
      if (lobby.mode === 'pve') { for (const en of lobby.enemies || []) pull(en); }
      else {
        for (const p of lobby.players) if (p.id !== f.owner) pull(p);
        for (const b of lobby.bots || []) pull(b);
      }
    }

    f._t = (f._t || 0) + dt;
    if (rule.once) {
      if (f._done) continue;
      if (rule.arm && age < rule.arm) continue;
      if (rule.fuse && age < rule.fuse) continue;
      if (rule.trip) {
        // A mine waits for a body to walk over it; at the end of its life it
        // goes off where it lies.
        let near = false;
        const bodies = lobby.mode === 'pve'
          ? (lobby.enemies || [])
          : [...lobby.players, ...(lobby.bots || [])];
        for (const o of bodies) {
          if (!o || (o.hp ?? 1) <= 0 || o.id === f.owner) continue;
          if (dist2(f.x, f.y, o.x, o.y) <= (rule.trip + (o.r || 16)) ** 2) { near = true; break; }
        }
        if (!near && age < life - 0.2) continue;
      }
      f._done = true;
      utilBlast(lobby, f, rule, ownerTeam(f.owner));
    } else if (rule.every && f._t >= rule.every) {
      f._t = 0;
      utilBlast(lobby, f, rule, ownerTeam(f.owner));
    }
  }
}

function stepOnce(lobby, dt) {
  const t = now();

  // disconnect cleanup
  lobby.players = lobby.players.filter(p => (t - (p.lastSeen || t)) < DISCONNECT_TIMEOUT);
  for (const id of Object.keys(lobby.scores)) if (!lobby.players.find(p => p.id === id)) delete lobby.scores[id];

  // Free-for-all bots fight the room; team bots are driven by teams.ts.
  if (isFfa(lobby.mode)) updatePvpBots(lobby, dt, moveEnemyWithCollide);
  else if (!isTeamMode(lobby.mode)) updateBots(lobby, dt, moveEnemyWithCollide);
  // Public servers: the bots talk, swing melee and throw utilities. A failure
  // in that layer must never take the room's match down with it.
  if (lobby.public && typeof publicTick === 'function') {
    try { publicTick(lobby, dt, { damagePlayer: applyPlayerDamage }); }
    catch (e) { lobby.public = false; }
  }
  // Duels run their own clock: the countdown, the round, the rematch table.
  if (lobby.mode === 'duel') {
    duelTick(lobby, (x, y) => !playerBlocked(lobby, x, y, PLAYER_R) && !hazardAt(lobby, x, y, PLAYER_R + 12));
  }
  lobby.lastTick = t;

  // every glyph node the players enchanted keeps acting between shots
  // (wisps, golem, quake, ball lightning, shades, sanctuary)
  tickGlyphAutomata(lobby, dt);

  // every utility field on the ground keeps doing its work
  tickUtilityFields(lobby, dt);

  // glyph phase timer
  if (lobby.gamePhase === 'glyph') {
    lobby.glyphTimer -= dt;
    if (lobby.glyphTimer <= 0) {
      lobby.gamePhase = 'combat';
      // Sanctuary washes over the arena at the start of every wave.
      for (const p of lobby.players) {
        if (p.glyph && p.glyph.water && p.glyph.water.sanctuary) p._sanctuaryT = 20;
      }
      startWave(lobby, (lobby.wave || 1) + 1);
    }
  }

  // clear last tick's telegraphs
  lobby.pickups = (lobby.pickups || []).filter(p => p.type !== 'bossWarn' && p.type !== 'bossTarget' && p.type !== 'bossBoom');

  // lava phase update
  if (lobby.world?.hazards) {
    for (const hz of lobby.world.hazards) {
      if (hz.type !== 'lava') continue;
      hz.phase = hz.phase ?? 'warn';
      hz.lavaT = (hz.lavaT ?? 0) + dt;
      if (hz.phase === 'warn' && hz.lavaT > 1.2) { hz.phase = 'eruption'; hz.lavaT = 0; lobby.chestVer++; }
      else if (hz.phase === 'eruption' && hz.lavaT > 0.4) { hz.phase = 'burn'; hz.lavaT = 0; lobby.chestVer++; }
      else if (hz.phase === 'burn' && hz.lavaT > 6.0) { hz.phase = 'cool'; hz.lavaT = 0; lobby.chestVer++; }
      else if (hz.phase === 'cool' && hz.lavaT > 3.5) { hz.phase = 'warn'; hz.lavaT = 0; lobby.chestVer++; }
    }
  }

  // auto-start when countdown elapses (and world is ready)
  if (!lobby.started && t >= lobby.startTime) {
    if (lobby.levelId == null || lobby.mapSeed == null) return;
    if (!lobby.world) ensureWorldGenerated(lobby);
    if (isTeamMode(lobby.mode)) initTeamMatch(lobby);
    else if (lobby.botsEnabled !== false) initBots(lobby);
    if (isFfa(lobby.mode)) scatterBots(lobby, lobby.mode === 'br' ? 620 : 520);
    lobby.started = true;
    if (lobby.mode === 'pve') startWave(lobby, 1);
  }

  if (!lobby.started) return;

  // players: apply inputs + lava + velocities
  for (const p of lobby.players) {
    // Nobody moves, shoots or dashes at the duel setup table, or between rounds.
    if (lobby.mode === 'duel' && lobby.duel && lobby.duel.phase !== 'live') {
      p.vx = 0; p.vy = 0;
      continue;
    }
    const inp = lobby.inputs[p.id];
    if (!inp) continue;
    // A respawning player is frozen: their input is ignored so the body cannot
    // drift or spin while the respawn screen is up.
    if ((p.hp ?? 1) <= 0) { p.vx = 0; p.vy = 0; continue; }
    // Flamethrower fire keeps eating at a player after the flame has passed:
    // the same burn the monsters suffer, on a human body.
    if ((p.burnT ?? 0) > 0 && (p.spawnProtectUntil ?? 0) <= now()) {
      p.burnT = Math.max(0, p.burnT - dt);
      p.hp = (p.hp ?? 0) - (2 + 1.2 * (p.burnStacks ?? 1)) * dt;
      clampHp(p);
      // The fire goes out when it has run its course — or when it finished them.
      if (p.burnT <= 0 || p.hp <= 0) { p.burnT = 0; p.burnStacks = 0; }
    }
    const prevX = p.x, prevY = p.y, prevAng = p.ang ?? 0;
    p.ang = inp.ang;
    // Height the client reports (a jump, a ledge, flight): keep it so every
    // client sees the same body and shots aimed below it pass underneath.
    if (typeof inp.z === 'number' && isFinite(inp.z)) p.z = inp.z;
    // Speed orbs from chests: a short, honest burst instead of a number nobody reads.
    if (p.speedBoostT > 0) p.speedBoostT = Math.max(0, p.speedBoostT - dt);
    // The client reports where it thinks it is: check that step against the
    // arena so nobody can walk through a building or a block. A player who is
    // somehow already inside geometry may still move, so they can never be
    // trapped there.
    // The room takes the client's word for where it stands, as long as that
    // spot is not inside a wall. Demanding a clear straight line from the old
    // spot to the new one rejected perfectly good steps (a client slides along
    // walls and cuts corners), and every rejection yanked the player back —
    // the rubber-banding — while also leaving the room's copy of the body too
    // far from whatever it swung at for a melee hit to land.
    const free = (x1, y1) =>
      playerBlocked(lobby, prevX, prevY, PLAYER_R - 2) ||
      !playerBlocked(lobby, x1, y1, PLAYER_R - 2);
    // A body in the air clears walls the ground does not: the client already
    // decided what its jump passes over, so the room follows it up there
    // instead of refusing the step and dragging the player back down.
    const airborneNow = (Number(inp.z) || 0) > 45;
    if (typeof inp.x === 'number' && typeof inp.y === 'number') {
      if (airborneNow || free(inp.x, inp.y)) { p.x = inp.x; p.y = inp.y; }
    } else {
      const m = Math.hypot(inp.ix, inp.iy) || 1;
      const boost = p.speedBoostT > 0 ? SPEED_BOOST_MUL : 1;
      const sx = (inp.ix / m) * PLAYER_SPEED * boost * dt, sy = (inp.iy / m) * PLAYER_SPEED * boost * dt;
      if (free(p.x + sx, p.y + sy)) { p.x += sx; p.y += sy; }
    }
    // The arena edge ring is 40 thick: hold players against its inner face so
    // they never end up parked inside the border barrier (which read in-game as
    // an invisible wall just inside the visible one on the big team maps).
    const BORDER = 40;
    p.x = clamp(p.x, BORDER + BORDER_TOUCH, (lobby.world?.w || WORLD.w) - BORDER - BORDER_TOUCH);
    p.y = clamp(p.y, BORDER + BORDER_TOUCH, (lobby.world?.h || WORLD.h) - BORDER - BORDER_TOUCH);
    const dtSafe = Math.max(1e-6, dt);
    p.vx = (p.x - prevX) / dtSafe;
    p.vy = (p.y - prevY) / dtSafe;
    const da = ((p.ang - prevAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    p.vang = da / dtSafe;
    // A body that has just spawned is untouched by the ground it stands on,
    // exactly like it is untouched by bullets.
    const grounded = (p.spawnProtectUntil ?? 0) > now();
    if (lobby.world?.hazards && !grounded) {
      for (const hz of lobby.world.hazards) {
        if (hz.type !== 'lava' || !circleRectCollide(p.x, p.y, 16, hz)) continue;
        if ((p.z ?? 0) > 80) continue;   // clear of the ground: the lava passes under
        if (hz.phase === 'warn') continue;
        if (hz.phase === 'eruption') { p.hp = 0; break; }
        if (hz.phase === 'burn') { p.hp -= 20 * dt; clampHp(p); }
      }
    }
  }

  // PvE: spawn queue + enemy AI
  if (lobby.mode === 'pve') {
    lobby.spawnQueue = lobby.spawnQueue.filter(s => {
      s.t -= dt;
      if (s.t <= 0) {
        const en = spawnEnemy(s.type, s.x, s.y, s.bossVariant || 0);
        en.spawnWave = s.wave || lobby.wave;
        en.tier = aiTierForWave(en.spawnWave);
        if (en.type === 'chaser') en.role = (en.tier >= 2 && Math.random() < 0.35) ? 'blocker' : 'runner';
        lobby.enemies.push(en);
        return false;
      }
      return true;
    });
    for (let i = lobby.enemies.length - 1; i >= 0; i--) {
      const e = lobby.enemies[i];
      tickEnemyGlyphStatus(lobby, e, dt);
      enemyAI(lobby, e, dt);
      const killedByHazard = applyEnemyHazards(lobby, e, dt);
      if (killedByHazard || e.hp <= 0) {
        applyGlyphKill(lobby, e, e._lastHitBy);
        if (e._lastHitBy) awardPvEPoint(lobby, e._lastHitBy, e.type);
        spawnEnemyLoot(lobby, e.x, e.y, lootCountByEnemy(e.type));
        spawnXpOrbs(lobby, e.x, e.y, Math.max(1, pvePointsForType(e.type)));
        lobby.enemies.splice(i, 1);
      }
    }
    const tNow = now();
    for (const e of lobby.enemies) recordEnemyHist(e, tNow);
    // contact damage (interpolated)
    const tTarget = now() - CONTACT_LAG_MS;
    for (const e of lobby.enemies) {
      const bossV = (e.type === 'boss') ? (e.bossVariant ?? 1) : 0;
      const dps = touchDps(e.type, bossV);
      const ep = enemyPosAtTime(e, tTarget);
      for (const p of lobby.players) {
        const rr = (e.r ?? 16) + 16 - 6;
        if (dist2(ep.x, ep.y, p.x, p.y) <= rr * rr) {
          const contactDmg = dps * dt * 1.4;
          applyPlayerDamage(lobby, p.id, contactDmg, { id: 'E:' + e.id, weapon: 'Claws' });
          thornmailReflect(lobby, p, e, contactDmg);
        }
      }
    }
    // respawns (death penalty: wipe glyph progress)
    for (const p of lobby.players) {
      if (p.hp <= 0 && p.respawnAt && t >= p.respawnAt) {
        p.hp = p.hpMax ?? 100; p.respawnAt = 0;
        safeSpawn(lobby, p);
        // Co-op keeps what you earned; only the versus modes wipe the tree.
        if (isTeamMode(lobby.mode) || lobby.mode === 'pvp') {
          p.glyphPath = null; p.glyph = makeGlyphState(); p.completedGlyphs = {}; p.essence = 0;
        } else ensureStarter(p);
      }
      if (p.hp <= 0 && !p.respawnAt) p.respawnAt = t + RESPAWN_MS;
    }
    // next wave / glyph phase
    if (lobby.spawnQueue.length === 0 && lobby.enemies.length === 0 && lobby.gamePhase === 'combat') {
      lobby.gamePhase = 'glyph';
      lobby.glyphTimer = 15;
    }
  }

  // PvP / Battle Royale / Teams / CTF: no PvE monsters, the other bodies are
  // the opposition.
  if (isFfa(lobby.mode) || isTeamMode(lobby.mode)) { lobby.enemies.length = 0; lobby.spawnQueue.length = 0; }

  // Battle Royale: the storm closes, and the last body standing wins the round.
  if (lobby.mode === 'br') {
    ensureZone(lobby);
    tickZone(lobby, dt);
    const alive = brAlive(lobby);
    if (lobby.zone) lobby.zone.alive = alive;
    if (alive <= 1 && !lobby.brNext) {
      const survivor = lobby.players.find((p) => (p.hp ?? 0) > 0);
      lobby.winner = survivor ? survivor.name : 'The Storm';
      lobby.brNext = t + BR_RESET_MS;
      lobby.kills = lobby.kills || [];
      lobby.kills.push({
        k: survivor ? survivor.name : 'The Storm', w: 'Won the round',
        v: 'Round ' + (lobby.round || 1), x: Math.round(survivor?.x ?? 0), y: Math.round(survivor?.y ?? 0), t
      });
    }
    if (lobby.brNext && t >= lobby.brNext) startBrRound(lobby);
  }
  if (isTeamMode(lobby.mode)) {
    const aliveBefore = new Set(lobby.bots.filter(b => (b.hp ?? 0) > 0).map(b => b.id));
    tickTeamMatch(lobby, dt, moveEnemyWithCollide);
    // A fallen bot drops its loot where it died, like the PvE monsters do.
    for (const b of lobby.bots) {
      if (aliveBefore.has(b.id) && (b.hp ?? 0) <= 0) spawnEnemyLoot(lobby, b.x, b.y, 2);
    }
  }

  // bullets
  for (let i = lobby.bullets.length - 1; i >= 0; i--) {
    const b = lobby.bullets[i];
    const x0 = b.x, y0 = b.y;
    const x1 = b.x + b.vx * dt, y1 = b.y + b.vy * dt;
    // Height: a shot fired upward (or downward) climbs away from the gun it
    // left, so once it is well off its own firing line it sails over heads and
    // over walls instead of hitting things it visually passes above.
    if (typeof b.vz === 'number' && b.vz) {
      b.z = (b.z ?? 0) + b.vz * dt;
      if (b.z < 0) { b.z = 0; b.vz = 0; }
    }
    const airborne = typeof b.z0 === 'number' && Math.abs((b.z ?? 0) - b.z0) > 90;
    // A shot only sails over heads while it is still up there. One fired from
    // the sky comes back down to fighting height on its way to the target, and
    // that is where it must be able to hit.
    const overHeads = airborne && (b.z ?? 0) > 90;
    const hitWall = airborne ? false : bulletSegmentHitsWall(lobby, x0, y0, x1, y1, b.r ?? 4);
    if (!hitWall) { b.x = x1; b.y = y1; b._x0 = x0; b._y0 = y0; }
    b.life -= dt;

    if (b.kind === 'enemyBomb' && b.targetX != null) {
      lobby.pickups.push({ x: b.targetX, y: b.targetY, r: 10, type: 'bossTarget' });
      if (hitWall) { b.targetX = b.x; b.targetY = b.y; b.vx = 0; b.vy = 0; }
      const dx = b.targetX - b.x, dy = b.targetY - b.y;
      if (dx * dx + dy * dy <= 20 * 20 || (b.vx === 0 && b.vy === 0)) {
        b.vx = 0; b.vy = 0;
        b.warnT = (typeof b.warnT === 'number') ? b.warnT : BOSS3_WARN_TIME;
        b.warnT -= dt;
        lobby.pickups.push({ x: b.targetX, y: b.targetY, r: b.splashR, type: 'bossWarn' });
        if (b.warnT <= 0) {
          b.x = b.targetX; b.y = b.targetY;
          lobby.pickups = (lobby.pickups || []).filter(p => p.type !== 'bossBoom');
          lobby.pickups.push({ x: b.x, y: b.y, r: b.splashR ?? BOSS3_BLAST_R, type: 'bossBoom', t0: now(), life: 0.35 });
          lobby.pickupVer++;
          explodeEnemyBomb(lobby, b);
          lobby.bullets.splice(i, 1);
        }
        continue;
      }
    }
    if (hitWall && b.kind !== 'enemyBomb') { lobby.bullets.splice(i, 1); continue; }
    if (b.life <= 0) { lobby.bullets.splice(i, 1); continue; }

    // enemy bullets hit players
    const isEnemy = (typeof b.owner === 'string' && b.owner.startsWith('E:')) || b.kind === 'enemy';
    if (isEnemy && !overHeads) {
      for (const p of lobby.players) {
        const rr = (b.r ?? 4) + 16;
        if (segmentHitsCircle(x0, y0, b.x, b.y, p.x, p.y, rr)) {
          applyPlayerDamage(lobby, p.id, b.dmg ?? DMG_SHOOTER, { id: b.owner, weapon: 'Attack' });
          lobby.bullets.splice(i, 1);
          break;
        }
      }
    }
    // A bot's shot lands on people in the versus rooms. Without this the bots
    // (and the duel's opponent) fired into the void, so a fight against one
    // could never be lost — which is exactly how a duel bot felt harmless.
    if (!overHeads && (isFfa(lobby.mode) || isTeamMode(lobby.mode)) &&
        typeof b.owner === 'string' && b.owner.startsWith('B:')) {
      const fromBot = (lobby.bots || []).find((x) => 'B:' + x.id === b.owner);
      let took = false;
      for (const p of lobby.players) {
        if ((p.hp ?? 0) <= 0) continue;
        if ((p.spawnProtectUntil ?? 0) > now()) continue;
        if (isTeamMode(lobby.mode) && fromBot && fromBot.team != null && p.team === fromBot.team) continue;
        const rr = (b.r ?? 4) + 16;
        if (!segmentHitsCircle(x0, y0, b.x, b.y, p.x, p.y, rr)) continue;
        applyPlayerDamage(lobby, p.id, b.dmg ?? 10, { id: b.owner, weapon: (fromBot && fromBot.name) || 'Pistol' });
        lobby.bullets.splice(i, 1);
        took = true;
        break;
      }
      if (took) continue;
    }
    if (isFfa(lobby.mode) && !overHeads && i < lobby.bullets.length && handlePvPPlayerBulletHits(lobby, lobby.bullets[i], i)) continue;
  }
  if (isFfa(lobby.mode)) resolvePvpBotBullets(lobby);
  if (isTeamMode(lobby.mode)) resolveTeamBullets(lobby);

  // bullet -> enemies (PvE): player shots, plus the squad bots' covering fire
  if (lobby.mode === 'pve') {
    for (let i = lobby.bullets.length - 1; i >= 0; i--) {
      const b = lobby.bullets[i];
      const shooter = lobby.players.find(p => p.id === b.owner) || null;
      const botShot = !shooter && typeof b.owner === 'string' && b.owner.startsWith('B:');
      if (!shooter && !botShot) continue;
      // A shot aimed over the monsters stays a shot over the monsters.
      if (typeof b.z0 === 'number' && Math.abs((b.z ?? 0) - b.z0) > 90 && (b.z ?? 0) > 90) continue;
      let hitIndex = -1;
      for (let j = 0; j < lobby.enemies.length; j++) {
        const e = lobby.enemies[j];
        if (segmentHitsCircle(b._x0 ?? b.x, b._y0 ?? b.y, b.x, b.y, e.x, e.y, b.r + e.r)) { hitIndex = j; break; }
      }
      if (hitIndex >= 0) {
        const en = lobby.enemies[hitIndex];
        applyGlyphHit(lobby, shooter, en, b.dmg, 'bullet');
        if (en.hp <= 0) {
          // A bot's shot that finishes the monster still credits whatever player
          // last wounded it (the assist), but no player id means no points.
          applyGlyphKill(lobby, en, shooter ? shooter.id : null);
          if (shooter) awardPvEPoint(lobby, shooter.id, en.type);
          spawnXpOrbs(lobby, en.x, en.y, Math.max(1, pvePointsForType(en.type)));
          lobby.enemies.splice(hitIndex, 1);
        }
        lobby.bullets.splice(i, 1);
      }
    }
    for (let j = lobby.enemies.length - 1; j >= 0; j--) {
      const en = lobby.enemies[j];
      if (en.hp <= 0) {
        applyGlyphKill(lobby, en, en._lastHitBy);
        if (en._lastHitBy) awardPvEPoint(lobby, en._lastHitBy, en.type);
        spawnXpOrbs(lobby, en.x, en.y, Math.max(1, pvePointsForType(en.type)));
        lobby.enemies.splice(j, 1);
      }
    }
  }

  // pickups collect + expire
  if (lobby.pickups && lobby.pickups.length) {
    for (let i = lobby.pickups.length - 1; i >= 0; i--) {
      const pk = lobby.pickups[i];
      if (pk.type === 'bossWarn' || pk.type === 'bossTarget' || pk.type === 'bossBoom') continue;
      if (pk.bornAt && (t - pk.bornAt) > 20000) { lobby.pickups.splice(i, 1); lobby.pickupVer++; continue; }
      for (const p of lobby.players) {
        const rr = (pk.r ?? 14) + 16;
        if (dist2(p.x, p.y, pk.x, pk.y) <= rr * rr) {
          if (pk.type === 'health') p.hp = Math.min(100, (p.hp ?? 100) + 25);
          else if (pk.type === 'ammo') p.ammo = Math.min((p.maxAmmo ?? 999), (p.ammo ?? 0) + 30);
          else if (pk.type === 'speed') p.speedBoostT = 8.0;
          else if (pk.type === 'shield') p.shield = Math.min(100, (p.shield ?? 0) + 40);
          else if (pk.type === 'xp') p.essence = (p.essence || 0) + (pk.v || 1);
          lobby.pickups.splice(i, 1);
          lobby.pickupVer++;
          break;
        }
      }
    }
  }

  // Every death this tick becomes one finisher / kill-feed record.
  scanPlayerDeaths(lobby, t);
}

// ---------------- public advance (called per message / frame) ----------------
export function advance(lobby) {
  const t = now();
  if (!lobby.lastTick) lobby.lastTick = t;
  const elapsedMs = t - lobby.lastTick;
  // Nothing due yet: no tick, no snapshot.
  if (elapsedMs < TICK_MS) return { steps: 0, baked: false };
  const elapsed = Math.min(1.0, elapsedMs / 1000);
  const steps = Math.min(20, Math.max(1, Math.round(elapsed / (TICK_MS / 1000))));
  for (let i = 0; i < steps; i++) stepOnce(lobby, TICK_MS / 1000);
  lobby.lastTick = t;
  bakeSnapshot(lobby);
  return { steps, baked: true };
}

// ---------------- snapshot ----------------
export function bakeSnapshot(lobby) {
  const t = now();
  lobby.snapshot = {
    t,
    mode: lobby.mode,
    wave: lobby.wave,
    bots: bakeBotsSnapshot(lobby).map((b) => {
      const src = (lobby.bots || []).find((x) => x.id === b.id);
      // Whole pixels: the payload is sent 16 times a second and carrying the
      // full float precision of 60 bots is weight nobody can see.
      return { ...b, x: Math.round(b.x), y: Math.round(b.y), z: Math.round(src?.z ?? 0), design: src?.design ?? 0, color: src?.color ?? 0, weapon: src?.weapon ?? 0, team: src?.team ?? null, hp: Math.max(0, src?.hp ?? b.hp), rank: src?.rank ?? null, dp: src?.duelPoints ?? null, _ctfCarrying: !!src?.carrying };
    }),
    ...bakeTeamSnapshot(lobby),
    // Death caches are delivered once and then owned by the client, exactly
    // like the offline world.deathChests list.
    deathChests: (lobby.deathChests && lobby.deathChests.length) ? lobby.deathChests.splice(0) : [],
    chat: (lobby.chat || []).slice(-40),
    // Utilities every player should see: the room keeps the most recent ones
    // and each client drops them once their own lifetime has run out.
    utilityFx: (lobby.utilityFx || []).slice(-20),
    // Melee strikes and guards every other player should see, kept the same way.
    meleeFx: (lobby.meleeFx || []).slice(-16),
    phase: lobby.gamePhase,
    glyphTime: lobby.gamePhase === 'glyph' ? lobby.glyphTimer : 0,
    players: lobby.players.map(p => ({
      id: p.id, name: p.name, x: p.x, y: p.y, ang: p.ang,
      z: Math.round(p.z ?? 0),
      hp: Math.max(0, Math.round(p.hp)), hpMax: p.hpMax ?? 100,
      shield: Math.round(p.shield ?? 0), speedBoostT: Math.round((p.speedBoostT ?? 0) * 10) / 10,
      design: p.design, color: p.color, weapon: p.weapon, guns: p.guns,
      essence: p.essence, glyphPath: p.glyphPath, glyph: p.glyph,
      vx: p.vx || 0, vy: p.vy || 0, dead: p.hp <= 0,
      team: p.team ?? null, carrying: !!p.carrying,
      burn: Math.round((p.burnT ?? 0) * 10) / 10,
      hit: p._lastHit || null
    })),
    pvpKills: { ...(lobby.pvpKills || {}) },
    enemies: lobby.mode === 'pve' ? lobby.enemies.map(e => ({
      id: e.id, type: e.type, x: e.x, y: e.y, r: e.r,
      hp: Math.max(0, Math.round(e.hp)), maxhp: e.maxhp,
      bossVariant: e.bossVariant, spawnWave: e.spawnWave, tier: e.tier, role: e.role
    })) : [],
    bullets: lobby.bullets.map(b => {
      // A stable id (plus velocity) lets the client follow each bullet between
      // snapshots instead of guessing, which is what made them flicker away.
      if (!b.id) b.id = 'b' + (lobby._bN = (lobby._bN || 0) + 1);
      // Only shots actually fired with a height carry one, so every older
      // bullet (and every monster shot) keeps its usual look.
      return {
        id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy,
        owner: b.owner, kind: b.kind, r: b.r,
        targetX: b.targetX, targetY: b.targetY, splashR: b.splashR, warnT: b.warnT,
        ...(typeof b.z === 'number' ? { z: b.z, vz: b.vz || 0 } : {})
      };
    }),
    pickups: lobby.pickups.map(p => ({ x: p.x, y: p.y, r: p.r, type: p.type, v: p.v, t0: p.t0, life: p.life })),
    scores: { ...lobby.scores },
    // The storm only exists in the Battle Royale room; the FFA room sends null
    // so no border is ever drawn there.
    zone: (lobby.mode === 'br' && lobby.zone) ? {
      cx: Math.round(lobby.zone.cx), cy: Math.round(lobby.zone.cy), r: Math.round(lobby.zone.r),
      toX: Math.round(lobby.zone.toX), toY: Math.round(lobby.zone.toY), toR: Math.round(lobby.zone.toR),
      mode: lobby.zone.mode, phase: lobby.zone.phase, nextPicked: !!lobby.zone.nextPicked,
      t: Math.round(lobby.zone.t * 10) / 10,
      wait: BR_PHASES[Math.min(lobby.zone.phase, BR_PHASES.length - 1)].wait,
      shrink: BR_PHASES[Math.min(lobby.zone.phase, BR_PHASES.length - 1)].shrink,
      dps: lobby.zone.dps, alive: lobby.zone.alive, round: lobby.round || 1
    } : null,
    brWinner: lobby.mode === 'br' ? (lobby.winner ?? null) : null,
    roundIn: lobby.brNext ? Math.max(0, Math.ceil((lobby.brNext - Date.now()) / 1000)) : 0,
    world: null,
    meta: {
      lobbyId: lobby.id, mode: lobby.mode, joinDeadline: lobby.startTime,
      levelId: lobby.levelId, mapSeed: lobby.mapSeed,
      pickupVer: lobby.pickupVer ?? 0, chestVer: lobby.chestVer ?? 0,
      worldKey: lobby.worldKey ?? null,
      // The duel table, score and countdown travel with every snapshot so both
      // fighters read exactly the same terms.
      duel: bakeDuel(lobby)
    }
  };
  return lobby.snapshot;
}

export { GLYPH_KEYS };