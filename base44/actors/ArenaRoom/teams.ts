// Live-room copy of the Teams / Capture the Flag layer (see game_server/teams.ts).

import { steerMove } from "./steer.ts";
import { clearShot, steerToGoal } from "./nav.ts";

// Offline Teams / CTF field 59 bots + the player = 60 bodies, split across the
// two sides. The online lobby matches that: 30 per side, humans first.
export const TEAM_SIZE = 30;              // humans + bots per side (offline parity)
export const CTF_SCORE_TARGET = 5;

const GIANT_HP = 9000;
const GOLEM_COUNT = 8;
const GOLEM_ACTIVATE = 320;              // bullet damage needed to wake a golem
const GOLEM_DETONATE = 900;              // damage a golem does to an enemy titan
const BOT_SPEED = 165;
const BOT_SHOOT_CD = 0.75;
const BOT_DMG = 9;
const RESPAWN_MS = 4000;
const PICKUP_R = 34;
const CAPTURE_R = 80;
const DROP_RETURN_MS = 26000;

const now = () => Date.now();
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

function segmentHitsCircle(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist2(x0, y0, cx, cy) <= r * r;
  let t = ((cx - x0) * dx + (cy - y0) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist2(x0 + dx * t, y0 + dy * t, cx, cy) <= r * r;
}

export const isTeamMode = (mode) => mode === 'teams' || mode === 'ctf';

// Pick a side for a joining player. A stated preference wins while that side
// still has room (so friends can choose to play together), otherwise the
// emptier side keeps the lobby balanced.
export function pickTeam(lobby, pref) {
  const count = (t) => lobby.players.filter((p) => p.team === t).length;
  const c0 = count(0), c1 = count(1);
  if ((pref === 0 || pref === 1) && count(pref) < TEAM_SIZE) return pref;
  return c0 <= c1 ? 0 : 1;
}

function worldSize(lobby) {
  return (lobby.world && lobby.world.w) ? lobby.world : { w: 4000, h: 2800 };
}

// Titans and bases sit a fixed share of the way in from the walls (measured
// against the 4000-wide arena), so on the doubled team maps they stay inside
// the field instead of hugging the outer edges.
function edgeInset(w, base) {
  return Math.max(base, Math.round(w * (base / 4000)));
}

function spawnAnchor(lobby, team) {
  const w = worldSize(lobby);
  // Objectives only exist once the match has started — before that (a lobby
  // being set up) the anchors fall through to the plain side-of-arena spots.
  if (lobby.mode === 'ctf' && lobby.ctf && lobby.ctf.bases && lobby.ctf.bases[team]) {
    return { x: lobby.ctf.bases[team].x, y: lobby.ctf.bases[team].y };
  }
  if (Array.isArray(lobby.giants) && lobby.giants.length > 1 && lobby.giants[team]) {
    return { x: lobby.giants[team].x, y: lobby.giants[team].y };
  }
  const inset = edgeInset(w.w, 380);
  return { x: team === 0 ? inset : w.w - inset, y: w.h / 2 };
}

// Keep spawns out of buildings so bots/golems never appear inside walls.
function freeSpot(lobby, cx, cy, spread, r) {
  const buildings = (lobby.world && lobby.world.buildings) || [];
  const blocked = (x, y) => buildings.some((b) => b.inner &&
    x > b.inner.x - r && x < b.inner.x + b.inner.w + r &&
    y > b.inner.y - r && y < b.inner.y + b.inner.h + r);
  for (let i = 0; i < 24; i++) {
    const x = cx + (Math.random() - 0.5) * spread;
    const y = cy + (Math.random() - 0.5) * spread;
    if (!blocked(x, y)) return { x, y };
  }
  return { x: cx, y: cy };
}

function makeBot(lobby, team, index) {
  const anchor = spawnAnchor(lobby, team);
  const spot = freeSpot(lobby, anchor.x, anchor.y, 620, 20);
  const roles = lobby.mode === 'ctf' ? ['runner', 'guard', 'raider'] : ['attacker', 'defender', 'golemancer'];
  return {
    id: `bot_${team}_${index}`,
    name: `${team === 0 ? 'Blue' : 'Red'} Bot ${index + 1}`,
    team, role: roles[index % roles.length],
    x: spot.x, y: spot.y, ang: 0,
    hp: 100, hpMax: 100, r: 16,
    // Every bot looks different: body design, colour and weapon vary per slot.
    design: (index + team) % 4, color: (index * 3 + team) % 8, weapon: (index * 2 + team) % 3,
    shootCD: Math.random() * BOT_SHOOT_CD,
    respawnAt: 0, carrying: false
  };
}

// Backfill both sides so the arena always fields TEAM_SIZE per team.
export function fillTeamsWithBots(lobby) {
  // "Players only" lobbies never field filler bots.
  if (lobby.botsEnabled === false) { lobby.bots = []; return; }
  lobby.bots = (lobby.bots || []).filter((b) => b.team === 0 || b.team === 1);
  for (const team of [0, 1]) {
    const humans = lobby.players.filter((p) => p.team === team).length;
    const have = lobby.bots.filter((b) => b.team === team).length;
    const need = Math.max(0, TEAM_SIZE - humans - have);
    for (let i = 0; i < need; i++) lobby.bots.push(makeBot(lobby, team, have + i));
  }
}

// Create the mode's objectives. Called once when the lobby starts.
export function initTeamMatch(lobby) {
  const w = worldSize(lobby);
  const cy = w.h / 2;
  lobby.winner = null;
  const gInset = edgeInset(w.w, 380);
  lobby.giants = [
    { team: 0, x: gInset, y: cy, r: 92, hp: GIANT_HP, maxhp: GIANT_HP, name: 'BLUE TITAN' },
    { team: 1, x: w.w - gInset, y: cy, r: 92, hp: GIANT_HP, maxhp: GIANT_HP, name: 'RED TITAN' }
  ];
  lobby.golems = [];
  for (let i = 0; i < GOLEM_COUNT; i++) {
    const spot = freeSpot(lobby, 700 + Math.random() * Math.max(200, w.w - 1400), cy, 760, 30);
    lobby.golems.push({
      id: 'G' + i, x: spot.x, y: spot.y, r: 26, wobble: Math.random() * 6.28,
      activated: false, team: 0, dmg: [0, 0], threshold: GOLEM_ACTIVATE, dead: false
    });
  }
  const bInset = edgeInset(w.w, 420);
  lobby.ctf = lobby.mode === 'ctf' ? {
    bases: [{ team: 0, x: bInset, y: cy, r: 80 }, { team: 1, x: w.w - bInset, y: cy, r: 80 }],
    flags: [
      { team: 0, x: bInset, y: cy, state: 'home', carrier: null, droppedAt: 0, bob: 0 },
      { team: 1, x: w.w - bInset, y: cy, state: 'home', carrier: null, droppedAt: 0, bob: 3 }
    ],
    scores: [0, 0]
  } : null;
  fillTeamsWithBots(lobby);
  // Bots are seeded while the lobby is filling up, before this arena exists —
  // so re-anchor every side to the real map, or they start outside it.
  for (const b of lobby.bots) {
    if (b.team !== 0 && b.team !== 1) continue;
    const anchor = spawnAnchor(lobby, b.team);
    const spot = freeSpot(lobby, anchor.x, anchor.y, 620, 20);
    b.x = spot.x; b.y = spot.y;
    b.hp = b.hpMax ?? 100;
    b.respawnAt = 0;
    b.carrying = false;
  }
  // Humans start on their own side too, next to their titan / base.
  for (const p of lobby.players) {
    const team = (p.team === 0 || p.team === 1) ? p.team : pickTeam(lobby, null);
    p.team = team;
    const anchor = spawnAnchor(lobby, team);
    const spot = freeSpot(lobby, anchor.x, anchor.y, 420, 18);
    p.x = spot.x; p.y = spot.y;
  }
}

// ---------------------------------------------------------------- units
function unitById(lobby, id) {
  return lobby.players.find((p) => p.id === id) || lobby.bots.find((b) => b.id === id) || null;
}

function nearestEnemy(lobby, unit) {
  const myTeam = unit.team;
  let best = null, bestD2 = Infinity;
  const consider = (o) => {
    if (!o || o.team === myTeam || (o.hp ?? 0) <= 0) return;
    const d = dist2(unit.x, unit.y, o.x, o.y);
    if (d < bestD2) { bestD2 = d; best = o; }
  };
  for (const p of lobby.players) consider(p);
  for (const b of lobby.bots) if (b !== unit) consider(b);
  return best ? { unit: best, d2: bestD2 } : null;
}

function shootAt(lobby, bot, ang) {
  const SPEED = 720;
  lobby.bullets.push({
    owner: 'T:' + bot.id, team: bot.team,
    x: bot.x, y: bot.y,
    vx: Math.cos(ang) * SPEED, vy: Math.sin(ang) * SPEED,
    r: 4, dmg: BOT_DMG, life: 1.2
  });
}

// One role per bot: every fifth holds the line at home, every third swings wide
// on the wings, the rest press the objective. Decided once, from spawn order.
function initRole(lobby, bot) {
  if (bot.role) return;
  const n = (lobby._roleN = (lobby._roleN || 0) + 1);
  bot.role = n % 5 === 0 ? 'defender' : n % 3 === 0 ? 'flanker' : 'rusher';
  bot.sideSign = n % 2 ? 1 : -1;
  bot._sideSign = bot.sideSign;
  bot.strafeDir = n % 2 ? 1 : -1;
  bot.strafeT = 0;
  bot.burst = 0;
  bot._navCap = 1200;
}

function homePoint(lobby, bot) {
  if (lobby.mode === 'ctf' && lobby.ctf?.bases?.[bot.team]) {
    const b = lobby.ctf.bases[bot.team];
    return { x: b.x, y: b.y };
  }
  const giant = (lobby.giants || [])[bot.team];
  return giant ? { x: giant.x, y: giant.y } : null;
}

function pushPoint(lobby, bot) {
  if (lobby.mode === 'ctf' && lobby.ctf) {
    if (bot.carrying) return homePoint(lobby, bot);
    const flag = lobby.ctf.flags[1 - bot.team];
    return flag ? { x: flag.x, y: flag.y } : null;
  }
  const giant = (lobby.giants || [])[1 - bot.team];
  return giant ? { x: giant.x, y: giant.y } : null;
}

// Nearest enemy of theirs to a point of ours — how a raider at the base is seen.
function enemyNear(lobby, bot, point, range) {
  let best = null, bestD2 = range * range;
  const consider = (o) => {
    if (!o || o.team === bot.team || (o.hp ?? 0) <= 0) return;
    const d = dist2(point.x, point.y, o.x, o.y);
    if (d < bestD2) { bestD2 = d; best = o; }
  };
  for (const p of lobby.players) consider(p);
  for (const b of lobby.bots) if (b !== bot) consider(b);
  return best;
}

function shootBurst(lobby, bot, ang, dt) {
  bot.pause = Math.max(0, (bot.pause || 0) - dt);
  bot.shootCD -= dt;
  if (bot.pause > 0 || bot.shootCD > 0) return;
  shootAt(lobby, bot, ang);
  bot.burst = (bot.burst || 0) + 1;
  bot.shootCD = 0.18;
  if (bot.burst >= 4) { bot.burst = 0; bot.pause = 0.3 + Math.random() * 0.45; bot.shootCD = 0; }
}

// Hold a lane on one target: close the gap, back off when it is too close, and
// strafe in between so the squad is not a static wall of guns.
function engage(lobby, bot, foe, dt, move, ideal) {
  const ang = Math.atan2(foe.y - bot.y, foe.x - bot.x);
  bot.ang = ang;
  const dist = Math.hypot(foe.x - bot.x, foe.y - bot.y);

  // No clear lane → swing around the obstacle instead of firing into it.
  if (!clearShot(lobby, bot.x, bot.y, foe.x, foe.y)) {
    const side = bot.sideSign || 1;
    bot.ang = steerToGoal(lobby, bot, foe.x - Math.sin(ang) * 260 * side, foe.y + Math.cos(ang) * 260 * side, BOT_SPEED, dt, move);
    return;
  }
  if (dist > ideal + 90) bot.ang = steerToGoal(lobby, bot, foe.x, foe.y, BOT_SPEED, dt, move);
  else if (dist < ideal - 80) steerMove(lobby, bot, ang + Math.PI, BOT_SPEED * 0.85, dt, move);
  else {
    bot.strafeT -= dt;
    if (bot.strafeT <= 0) { bot.strafeT = 0.9 + Math.random() * 0.8; bot.strafeDir = -(bot.strafeDir || 1); }
    steerMove(lobby, bot, ang + (Math.PI / 2) * (bot.strafeDir || 1), BOT_SPEED * 0.8, dt, move);
  }
  shootBurst(lobby, bot, ang, dt);
}

function botThink(lobby, bot, dt, move) {
  initRole(lobby, bot);
  const enemyTeam = 1 - bot.team;

  const home = homePoint(lobby, bot);
  const push = pushPoint(lobby, bot);

  // 1) Nobody camps our titan / base: an intruder there pulls the defenders,
  //    and anyone already near home, straight back to it.
  const intruder = home ? enemyNear(lobby, bot, home, 700) : null;
  const nearHome = home ? dist2(bot.x, bot.y, home.x, home.y) < 1500 * 1500 : false;
  if (intruder && (bot.role === 'defender' || nearHome)) {
    engage(lobby, bot, intruder, dt, move, 240);
    return;
  }

  // 2) Anything in front of it gets fought on the move.
  const threat = nearestEnemy(lobby, bot);
  const fightR2 = bot.role === 'rusher' ? 640 * 640 : 520 * 520;
  if (threat && threat.d2 < fightR2) {
    engage(lobby, bot, threat.unit, dt, move, bot.role === 'rusher' ? 150 : 250);
    return;
  }

  // 3) Push the objective — flankers swing wide off the straight line.
  if (!push) return;
  let gx = push.x, gy = push.y;
  if (bot.role === 'flanker') {
    const dx = push.x - bot.x, dy = push.y - bot.y;
    const d = Math.hypot(dx, dy) || 1;
    gx += (-dy / d) * 320 * (bot.sideSign || 1);
    gy += (dx / d) * 320 * (bot.sideSign || 1);
  }
  bot.ang = steerToGoal(lobby, bot, gx, gy, BOT_SPEED, dt, move);

  // Shell the enemy titan as soon as it is in range.
  const enemyGiant = lobby.mode === 'teams' ? (lobby.giants || [])[enemyTeam] : null;
  if (enemyGiant && dist2(bot.x, bot.y, enemyGiant.x, enemyGiant.y) < 680 * 680) {
    const ga = Math.atan2(enemyGiant.y - bot.y, enemyGiant.x - bot.x);
    bot.ang = ga;
    shootBurst(lobby, bot, ga, dt);
  }
}

// ---------------------------------------------------------------- death cache
// A fallen bot leaves a Death Cache behind, exactly like the offline modes:
// the client picks these up (one-shot) and stores them in world.deathChests.
function spawnDeathChest(lobby, bot) {
  const solids = (lobby.world && lobby.world.solids) || [];
  const blocked = (x, y) => solids.some((s) =>
    x > s.x - 20 && x < s.x + s.w + 20 && y > s.y - 20 && y < s.y + s.h + 20);
  let x = bot.x, y = bot.y;
  if (blocked(x, y)) {
    let found = false;
    for (let ring = 1; ring <= 6 && !found; ring++) {
      for (let k = 0; k < 10 && !found; k++) {
        const a = (k / 10) * Math.PI * 2;
        const nx = bot.x + Math.cos(a) * ring * 24;
        const ny = bot.y + Math.sin(a) * ring * 24;
        if (!blocked(nx, ny)) { x = nx; y = ny; found = true; }
      }
    }
  }
  lobby.deathChests = lobby.deathChests || [];
  lobby.deathChests.push({
    id: 'd' + (lobby._deathN = (lobby._deathN || 0) + 1),
    x, y, z: 0, floor: 0, r: 20, opened: false,
    buildingIndex: -1, rarity: 'death', from: bot.name || 'Bot', t: 0
  });
}

// ---------------------------------------------------------------- flags
function dropFlag(lobby, unit) {
  if (!unit || !unit.carrying) return;
  unit.carrying = false;
  const flag = lobby.ctf.flags[1 - unit.team];
  flag.state = 'dropped';
  flag.carrier = null;
  flag.droppedAt = now();
  flag.x = unit.x;
  flag.y = unit.y;
}

function ctfTick(lobby) {
  const ctf = lobby.ctf;
  const t = now();

  for (const flag of ctf.flags) {
    if (flag.state === 'carried') {
      const carrier = unitById(lobby, flag.carrier);
      if (carrier) { flag.x = carrier.x; flag.y = carrier.y; }
    }
    if (flag.state === 'dropped' && t - (flag.droppedAt || 0) > DROP_RETURN_MS) {
      flag.state = 'home';
      flag.carrier = null;
      flag.x = ctf.bases[flag.team].x;
      flag.y = ctf.bases[flag.team].y;
    }
  }

  const units = [...lobby.players, ...lobby.bots].filter((u) => (u.hp ?? 0) > 0);
  for (const unit of units) {
    const myTeam = unit.team;
    if (myTeam !== 0 && myTeam !== 1) continue;
    const ownFlag = ctf.flags[myTeam];
    const enemyFlag = ctf.flags[1 - myTeam];
    const base = ctf.bases[myTeam];

    if (unit.carrying) {
      if (dist2(unit.x, unit.y, base.x, base.y) <= CAPTURE_R * CAPTURE_R && ownFlag.state === 'home') {
        ctf.scores[myTeam] += 1;
        unit.carrying = false;
        for (const f of ctf.flags) {
          f.state = 'home'; f.carrier = null;
          f.x = ctf.bases[f.team].x; f.y = ctf.bases[f.team].y;
        }
        return;
      }
      continue;
    }

    // grab the enemy flag when standing on it
    if ((enemyFlag.state === 'home' || enemyFlag.state === 'dropped') &&
        dist2(unit.x, unit.y, enemyFlag.x, enemyFlag.y) <= PICKUP_R * PICKUP_R) {
      enemyFlag.state = 'carried';
      enemyFlag.carrier = unit.id;
      unit.carrying = true;
      continue;
    }
    // touching your own dropped flag sends it home
    if (ownFlag.state === 'dropped' && dist2(unit.x, unit.y, ownFlag.x, ownFlag.y) <= PICKUP_R * PICKUP_R) {
      ownFlag.state = 'home';
      ownFlag.carrier = null;
      ownFlag.x = base.x; ownFlag.y = base.y;
    }
  }
}

function teamsTick(lobby, dt, move) {
  for (const golem of lobby.golems) {
    if (!golem.activated || golem.dead) continue;
    const giant = lobby.giants[1 - golem.team];
    const d = Math.hypot(giant.x - golem.x, giant.y - golem.y) || 1;
    if (d <= golem.r + giant.r) {
      giant.hp -= GOLEM_DETONATE;
      golem.dead = true;
      continue;
    }
    move(lobby, golem, ((giant.x - golem.x) / d) * 120 * dt, ((giant.y - golem.y) / d) * 120 * dt);
    golem.wobble += dt;
  }
  lobby.golems = lobby.golems.filter((g) => !g.dead);
}

// ---------------------------------------------------------------- bullets
// Resolves player/bot bullets against the enemy titan, golems and the other
// team. Runs after the generic bullet pass so wall hits are already stripped.
export function resolveTeamBullets(lobby) {
  if (!lobby.bullets || !lobby.bullets.length) return;
  for (let i = lobby.bullets.length - 1; i >= 0; i--) {
    const b = lobby.bullets[i];
    const team = (b.team === 0 || b.team === 1) ? b.team : null;
    if (team == null) continue;
    const x0 = b._x0 ?? b.x, y0 = b._y0 ?? b.y;
    let consumed = false;

    for (const giant of lobby.giants || []) {
      if (giant.team === team || giant.hp <= 0) continue;
      if (segmentHitsCircle(x0, y0, b.x, b.y, giant.x, giant.y, giant.r + (b.r ?? 4))) {
        giant.hp -= (b.dmg ?? 10);
        consumed = true;
        break;
      }
    }

    if (!consumed && lobby.mode === 'teams') {
      for (const golem of lobby.golems) {
        if (golem.activated) continue;
        if (segmentHitsCircle(x0, y0, b.x, b.y, golem.x, golem.y, golem.r + (b.r ?? 4))) {
          golem.dmg[team] += (b.dmg ?? 10);
          if (golem.dmg[team] >= golem.threshold) { golem.activated = true; golem.team = team; }
          consumed = true;
          break;
        }
      }
    }

    if (!consumed) {
      for (const p of lobby.players) {
        if (p.team === team || (p.hp ?? 0) <= 0) continue;
        if ((p.spawnProtectUntil ?? 0) > now()) continue;
        if (segmentHitsCircle(x0, y0, b.x, b.y, p.x, p.y, (b.r ?? 4) + 16)) {
          p._hitBy = { id: b.owner ?? null, weapon: b.w || 'Weapon' };
          // Flame sets them alight; the burn ticks on in the main player loop.
          if (b.kind === 'flamethrower' && (p.hp ?? 0) > 0) {
            p.burnT = Math.max(p.burnT ?? 0, 3.2);
            p.burnStacks = Math.min(3, (p.burnStacks ?? 0) + 1);
          }
          // A revolver round takes the whole health bar in one hit.
          p.hp = Math.max(0, (p.hp ?? 100) - (b.one ? (p.hp ?? 100) : (b.dmg ?? 10)));
          if (p.hp <= 0) { p.respawnAt = now() + RESPAWN_MS; dropFlag(lobby, p); }
          consumed = true;
          break;
        }
      }
    }

    if (!consumed) {
      for (const bot of lobby.bots) {
        if (bot.team === team || (bot.hp ?? 0) <= 0) continue;
        if (segmentHitsCircle(x0, y0, b.x, b.y, bot.x, bot.y, (b.r ?? 4) + 16)) {
          bot.hp -= (b.one ? bot.hp : (b.dmg ?? 10));
          if (bot.hp <= 0) {
            bot.respawnAt = now() + RESPAWN_MS;
            dropFlag(lobby, bot);
            spawnDeathChest(lobby, bot);
          }
          consumed = true;
          break;
        }
      }
    }

    if (consumed) lobby.bullets.splice(i, 1);
  }
}

// ---------------------------------------------------------------- tick
export function tickTeamMatch(lobby, dt, move) {
  if (!lobby.giants || !lobby.giants.length) initTeamMatch(lobby);
  const t = now();

  for (const p of lobby.players) {
    if (p.team !== 0 && p.team !== 1) p.team = pickTeam(lobby, null);
    if ((p.hp ?? 0) > 0) continue;
    if (!p.respawnAt) { p.respawnAt = t + RESPAWN_MS; dropFlag(lobby, p); }
    else if (t >= p.respawnAt) {
      const spot = freeSpot(lobby, spawnAnchor(lobby, p.team).x, spawnAnchor(lobby, p.team).y, 260, 18);
      p.x = spot.x; p.y = spot.y; p.hp = p.hpMax ?? 100; p.respawnAt = 0;
      p.vx = 0; p.vy = 0;
    }
  }

  for (const bot of lobby.bots) {
    if (bot.team !== 0 && bot.team !== 1) continue;
    if ((bot.hp ?? 0) <= 0) {
      if (!bot.respawnAt) { bot.respawnAt = t + RESPAWN_MS; dropFlag(lobby, bot); }
      else if (t >= bot.respawnAt) {
        const anchor = spawnAnchor(lobby, bot.team);
        const spot = freeSpot(lobby, anchor.x, anchor.y, 620, 20);
        bot.x = spot.x; bot.y = spot.y; bot.hp = bot.hpMax ?? 100; bot.respawnAt = 0; bot.carrying = false;
      }
      continue;
    }
    botThink(lobby, bot, dt, move);
  }

  if (lobby.mode === 'teams') teamsTick(lobby, dt, move);
  else if (lobby.mode === 'ctf') ctfTick(lobby);

  if (lobby.winner == null) {
    if (lobby.mode === 'teams') {
      const dead = lobby.giants.find((g) => g.hp <= 0);
      if (dead) lobby.winner = 1 - dead.team;
    } else if (lobby.mode === 'ctf') {
      if (lobby.ctf.scores[0] >= CTF_SCORE_TARGET) lobby.winner = 0;
      else if (lobby.ctf.scores[1] >= CTF_SCORE_TARGET) lobby.winner = 1;
    }
  }
}

// ---------------------------------------------------------------- snapshot
// Shapes match Teams.snapshot() / CTF.snapshot() in the offline modes so the
// existing 2D and 3D renderers draw the objectives with no changes.
export function bakeTeamSnapshot(lobby) {
  const out = {};
  // Each mode only ships its own objectives: a CTF lobby never carries titans
  // and golems (and vice versa), so the clients cannot draw the other mode.
  if (lobby.mode === 'teams' && lobby.giants && lobby.giants.length) {
    out.teams = {
      giants: lobby.giants.map((g) => ({
        team: g.team, x: g.x, y: g.y, r: g.r,
        hp: Math.max(0, Math.round(g.hp)), maxhp: g.maxhp, name: g.name
      })),
      golems: (lobby.golems || []).map((go) => ({
        x: go.x, y: go.y, r: go.r, wobble: go.wobble,
        activated: go.activated, team: go.team,
        dmg: go.dmg, threshold: go.threshold, dPhase: 'idle'
      })),
      fireballs: [],
      effects: [],
      over: lobby.winner != null,
      winner: lobby.winner,
      playerTeam: 0
    };
  }
  if (lobby.mode === 'ctf' && lobby.ctf) {
    out.ctf = {
      bases: lobby.ctf.bases.map((b) => ({ team: b.team, x: b.x, y: b.y, r: b.r })),
      flags: lobby.ctf.flags.map((f) => ({ team: f.team, x: f.x, y: f.y, state: f.state, bob: f.bob })),
      scores: lobby.ctf.scores,
      over: lobby.winner != null,
      winner: lobby.winner,
      playerTeam: 0,
      playerCarrying: false
    };
  }
  return out;
}