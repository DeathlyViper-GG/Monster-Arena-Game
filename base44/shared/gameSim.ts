// ============================================================
// Monster Arena — request-driven authoritative simulation
// (replaces the long-lived Express tick loop from signaling_http.js)
// Advanced by real elapsed dt on every request (input/shoot/poll).
// ============================================================

export const WORLD = { w: 4000, h: 2800 };
const DISCONNECT_MS = 12000;
const RESPAWN_MS = 4000;
const WAVE_BASE = 6;
const PLAYER_R = 16;

export const now = () => Date.now();
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};

const CHARS = "abcdefghijkmnpqrstuvwxyz23456789";
export function makeId(n = 6) {
  let s = "";
  for (let i = 0; i < n; i++) s += CHARS[(Math.random() * CHARS.length) | 0];
  return s;
}

function genBuildings(seed) {
  // deterministic-ish simple obstacles
  const out = [];
  let r = seed || 1;
  const rnd = () => {
    r = (r * 1103515245 + 12345) & 0x7fffffff;
    return r / 0x7fffffff;
  };
  const n = 7;
  for (let i = 0; i < n; i++) {
    const w = 180 + rnd() * 260;
    const h = 180 + rnd() * 260;
    const x = 250 + rnd() * (WORLD.w - 500 - w);
    const y = 250 + rnd() * (WORLD.h - 500 - h);
    out.push({ x, y, w, h });
  }
  return out;
}

export function createLobby(mode, hostId) {
  const mapSeed = (Math.random() * 1e9) | 0;
  const worldKey = makeId(6);
  return {
    id: makeId(6),
    mode,
    hostId,
    started: false,
    startTime: now() + 15000,
    levelId: mode === "pvp" ? "arena" : "pve1",
    mapSeed,
    worldKey,
    world: { buildings: genBuildings(mapSeed), chests: [], hazards: [] },
    players: [],
    enemies: [],
    bullets: [],
    pickups: [],
    scores: {},
    inputs: {},
    wave: 0,
    gamePhase: "lobby",
    glyphTimer: 0,
    chestVer: 0,
    pickupVer: 0,
    lastTick: now()
  };
}

export function addPlayer(lobby, peerId, name) {
  // rejoin if already present
  const existing = lobby.players.find((p) => p.id === peerId);
  if (existing) {
    existing.lastSeen = now();
    existing.hp = existing.hp > 0 ? existing.hp : existing.hpMax;
    return existing;
  }
  const n = lobby.players.length;
  const R = 120;
  const a = (n * Math.PI * 2) / 8;
  const p = {
    id: peerId,
    name: name || peerId,
    x: WORLD.w / 2 + Math.cos(a) * R,
    y: WORLD.h / 2 + Math.sin(a) * R,
    ang: 0,
    hp: 100,
    hpMax: 100,
    design: 0,
    color: 0,
    guns: { pistol: -1, rifle: -1, shotgun: -1 },
    weapon: 0,
    essence: 0,
    glyphPath: null,
    glyph: {},
    completedGlyphs: {},
    lastSeen: now(),
    respawnAt: 0
  };
  lobby.players.push(p);
  lobby.scores[peerId] = 0;
  return p;
}

export function removePlayer(lobby, peerId) {
  lobby.players = lobby.players.filter((p) => p.id !== peerId);
  delete lobby.inputs[peerId];
  delete lobby.scores[peerId];
  lobby.bullets = lobby.bullets.filter((b) => b.owner !== peerId);
}

function spawnWave(lobby, wave) {
  lobby.wave = wave;
  lobby.gamePhase = "combat";
  const count = WAVE_BASE + Math.floor(wave * 1.5);
  for (let i = 0; i < count; i++) {
    const edge = (Math.random() * 4) | 0;
    let x, y;
    if (edge === 0) { x = Math.random() * WORLD.w; y = 40; }
    else if (edge === 1) { x = Math.random() * WORLD.w; y = WORLD.h - 40; }
    else if (edge === 2) { x = 40; y = Math.random() * WORLD.h; }
    else { x = WORLD.w - 40; y = Math.random() * WORLD.h; }
    const tank = wave > 2 && Math.random() < 0.25;
    lobby.enemies.push({
      id: makeId(6),
      type: tank ? "tank" : "chaser",
      x, y,
      r: tank ? 22 : 16,
      hp: tank ? 220 : 45,
      maxhp: tank ? 220 : 45,
      speed: tank ? 120 : 210,
      dmg: tank ? 18 : 12,
      vx: 0, vy: 0
    });
  }
}

export function startGame(lobby) {
  if (lobby.gamePhase !== "lobby") return false;
  spawnWave(lobby, 1);
  return true;
}

function nearestAlivePlayer(lobby, x, y) {
  let best = null, bd = Infinity;
  for (const p of lobby.players) {
    if (p.hp <= 0) continue;
    const d = dist2(x, y, p.x, p.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export function advance(lobby) {
  const t = now();
  const dt = Math.min(0.25, (t - (lobby.lastTick || t)) / 1000);
  lobby.lastTick = t;

  // disconnect cleanup
  lobby.players = lobby.players.filter((p) => (t - (p.lastSeen || t)) < DISCONNECT_MS);
  for (const id of Object.keys(lobby.scores)) {
    if (!lobby.players.find((p) => p.id === id)) delete lobby.scores[id];
  }

  if (lobby.gamePhase !== "combat") {
    bakeSnapshot(lobby);
    return;
  }

  // respawns
  for (const p of lobby.players) {
    if (p.hp <= 0 && p.respawnAt && t >= p.respawnAt) {
      p.hp = p.hpMax;
      p.x = WORLD.w / 2;
      p.y = WORLD.h / 2;
      p.respawnAt = 0;
      // death penalty: wipe glyph progress (per game design)
      p.glyphPath = null;
      p.glyph = {};
      p.completedGlyphs = {};
      p.essence = 0;
    }
  }

  // bullets
  const liveBullets = [];
  for (const b of lobby.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (b.x < 0 || b.x > WORLD.w || b.y < 0 || b.y > WORLD.h) continue;
    liveBullets.push(b);
  }
  lobby.bullets = liveBullets;

  // bullet -> enemy hits
  const deadEnemies = new Set();
  for (const b of lobby.bullets) {
    for (const e of lobby.enemies) {
      if (deadEnemies.has(e.id)) continue;
      const rr = (b.r + e.r) * (b.r + e.r);
      if (dist2(b.x, b.y, e.x, e.y) <= rr) {
        e.hp -= b.dmg;
        b.life = 0;
        if (e.hp <= 0) {
          deadEnemies.add(e.id);
          if (lobby.scores[b.owner] != null) lobby.scores[b.owner] += 1;
          // essence drop
          if (Math.random() < 0.4) {
            lobby.pickups.push({
              x: e.x, y: e.y, r: 10, type: "xp", v: 1, bornAt: t
            });
            lobby.pickupVer = (lobby.pickupVer || 0) + 1;
          }
        }
        break;
      }
    }
  }
  lobby.bullets = lobby.bullets.filter((b) => b.life > 0);
  lobby.enemies = lobby.enemies.filter((e) => !deadEnemies.has(e.id));

  // enemy AI + contact damage
  for (const e of lobby.enemies) {
    const tgt = nearestAlivePlayer(lobby, e.x, e.y);
    if (!tgt) continue;
    const dx = tgt.x - e.x, dy = tgt.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    e.x += (dx / len) * e.speed * dt;
    e.y += (dy / len) * e.speed * dt;
    e.x = clamp(e.x, 20, WORLD.w - 20);
    e.y = clamp(e.y, 20, WORLD.h - 20);
    const rr = (e.r + PLAYER_R) * (e.r + PLAYER_R);
    if (dist2(e.x, e.y, tgt.x, tgt.y) <= rr) {
      tgt.hp -= e.dmg * dt;
      if (tgt.hp <= 0 && !tgt.respawnAt) {
        tgt.hp = 0;
        tgt.respawnAt = t + RESPAWN_MS;
      }
    }
  }

  // pickups expire
  lobby.pickups = (lobby.pickups || []).filter((p) => (t - (p.bornAt || t)) < 20000);

  // next wave
  if (lobby.enemies.length === 0 && lobby.players.length > 0) {
    spawnWave(lobby, lobby.wave + 1);
  }

  bakeSnapshot(lobby);
}

export function bakeSnapshot(lobby) {
  lobby.snapshot = {
    t: now(),
    wave: lobby.wave,
    phase: lobby.gamePhase,
    glyphTime: lobby.glyphTimer,
    players: lobby.players.map((p) => ({
      id: p.id, name: p.name, x: p.x, y: p.y, ang: p.ang,
      hp: Math.max(0, Math.round(p.hp)), hpMax: p.hpMax,
      design: p.design, color: p.color, weapon: p.weapon,
      essence: p.essence, dead: p.hp <= 0
    })),
    enemies: lobby.enemies.map((e) => ({
      id: e.id, type: e.type, x: e.x, y: e.y, hp: Math.max(0, Math.round(e.hp)),
      maxhp: e.maxhp, r: e.r
    })),
    bullets: lobby.bullets.map((b) => ({ x: b.x, y: b.y })),
    pickups: lobby.pickups.map((p) => ({ x: p.x, y: p.y, r: p.r, type: p.type })),
    chests: lobby.world.chests || [],
    buildings: lobby.world.buildings || [],
    scores: { ...lobby.scores },
    meta: {
      worldKey: String(lobby.worldKey || ""),
      chestVer: Number(lobby.chestVer || 0),
      started: !!lobby.started
    }
  };
}