// ============================================================
// Monster Arena — online PvE squad bots.
// They path around geometry instead of grinding into it, hold a firing lane,
// strafe, take cover behind walls (or inside a house) when they are being
// pressed, flank wide instead of piling onto the same monster, and push
// forward the moment the arena is clear.
// ============================================================
import { coverSpot, clearShot, findPath, steerToGoal } from './nav.ts';
import { steerMove } from './steer.ts';

const ROLES = ['gunner', 'flanker', 'rusher'];
const BOT_SPEED = 200;
const FIRE_RANGE = 680;
const DMG = 11;
const SHOT_SPEED = 720;

function arenaCentre(lobby) {
  const w = lobby.world || {};
  return { x: (w.w || 4000) / 2, y: (w.h || 2800) / 2 };
}

export function initBots(lobby) {
  if (!lobby.bots) lobby.bots = [];
  if (lobby.bots.length) return;
  const c = arenaCentre(lobby);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    lobby.bots.push({
      id: 'bot_' + i,
      name: 'Bot_' + (100 + i),
      x: c.x + Math.cos(a) * 90,
      y: c.y + Math.sin(a) * 90,
      ang: 0, hp: 100, hpMax: 100, r: 14,
      role: ROLES[i % ROLES.length],
      shootCD: 0.25 + i * 0.2,
      burst: 0,
      pause: 0,
      strafeDir: i % 2 ? -1 : 1,
      strafeT: 0.8 + i * 0.35,
      sideSign: i % 2 ? -1 : 1,
      _sideSign: i % 2 ? -1 : 1,
      cover: null,
      coverT: 0,
      coverHold: 0
    });
  }
}

// Nearest monster, with a penalty for ones the rest of the squad is already on
// so the bots spread across the wave instead of stacking on one body.
function chooseTarget(lobby, bot) {
  let best = null, bestScore = Infinity;
  for (const e of lobby.enemies) {
    if ((e.hp ?? 0) <= 0) continue;
    const d = Math.hypot(e.x - bot.x, e.y - bot.y);
    if (d > 1500) continue;
    let crowd = 0;
    for (const o of lobby.bots) {
      if (o === bot || (o.hp ?? 0) <= 0) continue;
      if (o._target && o._target.id === e.id) crowd += 1.4;
      else if (!o._target && Math.hypot(o.x - e.x, o.y - e.y) < d) crowd += 0.7;
    }
    let score = d + crowd * 380;
    if (bot.role === 'rusher') score -= Math.min(240, d * 0.25);
    if (e.type === 'boss') score -= 260;
    if (score < bestScore) { bestScore = score; best = e; }
  }
  return best;
}

// How badly this bot is being pressed: close monsters with a firing line on it.
function pressureOn(lobby, bot) {
  let n = 0;
  for (const e of lobby.enemies) {
    if ((e.hp ?? 0) <= 0) continue;
    const d = Math.hypot(e.x - bot.x, e.y - bot.y);
    if (d > 560) continue;
    if (!clearShot(lobby, e.x, e.y, bot.x, bot.y)) continue;
    n += (e.type === 'boss' ? 2 : 1);
  }
  return n;
}

function nearestHouse(lobby, bot, maxD) {
  let best = null, bestD = maxD;
  for (const b of (lobby.world?.buildings || [])) {
    if (!b.inner) continue;
    const cx = b.inner.x + b.inner.w / 2, cy = b.inner.y + b.inner.h / 2;
    const d = Math.hypot(cx - bot.x, cy - bot.y);
    if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
  }
  return best;
}

function fire(lobby, bot, target, dt) {
  bot.shootCD -= dt;
  if (bot.pause > 0) { bot.pause -= dt; return; }
  if (bot.shootCD > 0) return;
  const d = Math.hypot(target.x - bot.x, target.y - bot.y);
  if (d > FIRE_RANGE || !clearShot(lobby, bot.x, bot.y, target.x, target.y)) return;

  const spread = 0.035 + Math.min(0.05, d / 12000);
  const ang = Math.atan2(target.y - bot.y, target.x - bot.x) + (Math.random() - 0.5) * spread * 2;
  lobby.bullets.push({
    owner: 'B:' + bot.id, kind: 'bot', team: null,
    x: bot.x + Math.cos(ang) * 22, y: bot.y + Math.sin(ang) * 22,
    vx: Math.cos(ang) * SHOT_SPEED, vy: Math.sin(ang) * SHOT_SPEED,
    r: 4, dmg: DMG, life: 1.15
  });
  bot.burst = (bot.burst || 0) + 1;
  // Short bursts with a breather between them — reads as trigger discipline
  // instead of a wall of noise from every bot at once.
  const burstLen = bot.role === 'rusher' ? 4 : 3;
  bot.shootCD = bot.role === 'rusher' ? 0.16 : 0.2;
  if (bot.burst >= burstLen) {
    bot.burst = 0;
    bot.pause = 0.35 + Math.random() * 0.5;
    bot.shootCD = 0;
  }
}

function keepApart(lobby, bot, ang, dt, move) {
  let px = 0, py = 0;
  for (const o of lobby.bots) {
    if (o === bot || (o.hp ?? 0) <= 0) continue;
    const dx = bot.x - o.x, dy = bot.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d > 0 && d < 90) { px += (dx / d) * (1 - d / 90); py += (dy / d) * (1 - d / 90); }
  }
  if (!px && !py) return;
  const m = Math.hypot(px, py) || 1;
  move(lobby, bot, (px / m) * BOT_SPEED * 0.45 * dt, (py / m) * BOT_SPEED * 0.45 * dt);
  if (!ang) bot.ang = Math.atan2(py, px);
}

export function updateBots(lobby, dt, move) {
  if (!lobby.bots || !lobby.bots.length) return;
  for (const bot of lobby.bots) {
    if ((bot.hp ?? 0) <= 0) continue;
    bot.coverT = Math.max(0, (bot.coverT || 0) - dt);
    bot.coverHold = Math.max(0, (bot.coverHold || 0) - dt);

    const target = chooseTarget(lobby, bot);
    bot._target = target;

    if (!target) {
      // Arena clear: press toward the middle (where the next wave lands) but
      // never walk into the same corner the whole squad is standing in.
      bot.cover = null;
      const c = arenaCentre(lobby);
      const wobble = (bot.role === 'flanker' ? 320 : bot.role === 'rusher' ? -160 : 0);
      const gx = c.x + wobble * bot.sideSign, gy = c.y + wobble * 0.6;
      if (Math.hypot(gx - bot.x, gy - bot.y) > 90) {
        bot.ang = steerToGoal(lobby, bot, gx, gy, BOT_SPEED * 0.85, dt, move);
      }
      continue;
    }

    const dist = Math.hypot(target.x - bot.x, target.y - bot.y);
    const los = clearShot(lobby, bot.x, bot.y, target.x, target.y);

    // ---- Cover: pressed by several shooters (or a boss) → break the line.
    if (!bot.cover && los && pressureOn(lobby, bot) >= 2 && bot.coverT <= 0 && bot.role !== 'rusher') {
      const spot = coverSpot(lobby, bot, target.x, target.y)
        || nearestHouse(lobby, bot, 420);
      if (spot) {
        // Only commit if there is a way in (a doorway for a house).
        if (findPath(lobby, bot.x, bot.y, spot.x, spot.y)) {
          bot.cover = spot;
          bot.coverHold = 3.2;
        } else {
          bot.coverT = 2.5; // nothing reachable — just fight
        }
      }
    }

    if (bot.cover) {
      const dCover = Math.hypot(bot.cover.x - bot.x, bot.cover.y - bot.y);
      if (dCover > 30) {
        bot.ang = steerToGoal(lobby, bot, bot.cover.x, bot.cover.y, BOT_SPEED, dt, move);
      } else {
        // In cover: hold still and only step out to shoot when the lane opens.
        bot.ang = Math.atan2(target.y - bot.y, target.x - bot.x);
        bot.coverHold -= dt;
      }
      // Peek: once settled, keep shooting the moment there is a clear lane.
      if (los) fire(lobby, bot, target, dt);
      if (bot.coverHold <= 0 || (bot._stuckN || 0) > 2) {
        bot.cover = null;
        bot.coverT = 4;
        bot._stuckN = 0;
      }
      continue;
    }

    // ---- Engage.
    if (!los || (bot.role === 'flanker' && dist > 240)) {
      // No firing line: swing wide to a flank rather than pushing the wall.
      const side = bot.sideSign;
      const fx = target.x - Math.sin(Math.atan2(target.y - bot.y, target.x - bot.x)) * 240 * side;
      const fy = target.y + Math.cos(Math.atan2(target.y - bot.y, target.x - bot.x)) * 240 * side;
      bot.ang = steerToGoal(lobby, bot, fx, fy, BOT_SPEED, dt, move);
      keepApart(lobby, bot, bot.ang, dt, move);
      continue;
    }

    const ideal = bot.role === 'rusher' ? 170 : bot.role === 'flanker' ? 250 : 330;
    bot.ang = Math.atan2(target.y - bot.y, target.x - bot.x);

    if (dist > ideal + 90) {
      bot.ang = steerToGoal(lobby, bot, target.x, target.y, BOT_SPEED, dt, move);
    } else if (dist < ideal - 70) {
      // Back off while keeping the aim, so it isn't a free target up close.
      const away = bot.ang + Math.PI;
      steerMove(lobby, bot, away, BOT_SPEED * 0.8, dt, move);
    } else {
      // Strafe: circle the monster without closing, flipping side now and then.
      bot.strafeT -= dt;
      if (bot.strafeT <= 0) { bot.strafeT = 0.9 + Math.random() * 0.9; bot.strafeDir *= -1; }
      const sAng = bot.ang + (Math.PI / 2) * bot.strafeDir;
      steerMove(lobby, bot, sAng, BOT_SPEED * 0.75, dt, move);
    }

    keepApart(lobby, bot, bot.ang, dt, move);
    fire(lobby, bot, target, dt);
  }
}

export function bakeBotsSnapshot(lobby) {
  // Fallen bots leave the snapshot at once: the client erupts a team-coloured
  // burst where they dropped instead of showing a body for a few seconds.
  return (lobby.bots || [])
    .filter(b => (b.hp ?? 1) > 0)
    .map(b => ({ id: b.id, name: b.name, x: b.x, y: b.y, ang: b.ang, hp: b.hp, team: b.team ?? null }));
}