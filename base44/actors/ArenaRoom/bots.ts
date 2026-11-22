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
  // A public server fields a fuller squad than a private lobby's three fillers.
  const n = Math.max(1, Math.min(28, lobby.botCount || 3));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    lobby.bots.push({
      id: 'bot_' + i,
      name: 'Bot_' + (100 + i),
      x: c.x + Math.cos(a) * (90 + i * 18),
      y: c.y + Math.sin(a) * (90 + i * 18),
      ang: 0, hp: 100, hpMax: 100, r: 14, skill: 0.5 + Math.random() * 0.45,
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
    // A sharper bot finishes what is nearly dead instead of spreading damage.
    if (e.maxhp) score += (bot.skill ?? 0.72) * 240 * ((e.hp ?? 1) / e.maxhp);
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

  // Lead the target: the best bots read where a body is going, not where it is.
  const skill = bot.skill ?? 0.72;
  const lead = 0.06 + skill * 0.12;
  const tx = target.x + (target._vx || 0) * lead;
  const ty = target.y + (target._vy || 0) * lead;
  const spread = (0.05 - skill * 0.03) + Math.min(0.04, d / 16000);
  const ang = Math.atan2(ty - bot.y, tx - bot.x) + (Math.random() - 0.5) * spread * 2;
  lobby.bullets.push({
    owner: 'B:' + bot.id, kind: 'bot', team: null,
    x: bot.x + Math.cos(ang) * 22, y: bot.y + Math.sin(ang) * 22,
    vx: Math.cos(ang) * SHOT_SPEED, vy: Math.sin(ang) * SHOT_SPEED,
    r: 4, dmg: DMG * (0.85 + skill * 0.35), life: 1.15
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
  // Where each monster was a tick ago, so the bots can lead their shots.
  for (const e of lobby.enemies || []) {
    if (e._px !== undefined && dt > 0) {
      e._vx = (e.x - e._px) / dt;
      e._vy = (e.y - e._py) / dt;
    }
    e._px = e.x;
    e._py = e.y;
  }
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
    // z rides along so a hop is visible to everyone: the renderer offsets the
    // body by it, exactly like a player's jump.
    .map(b => ({ id: b.id, name: b.name, x: b.x, y: b.y, ang: b.ang, hp: b.hp, team: b.team ?? null, z: Math.round(b.z ?? 0) }));
}

/* ---------------- free-for-all bots (the public PvP server) ----------------
   A private PvP lobby's bots had nothing to do: their AI hunts monsters, and
   PvP has none. On the public server they fight the room — they pick a body,
   hold a lane, lead their shots, and come back a few seconds after dying. */

const PVP_RESPAWN_MS = 5000;
const BOT_GRAVITY = 1800;
const BOT_JUMP_V = 470;
// Two regulars duelling should take a while, the way two people would: a bot's
// shot is worth less against another bot. A player's shot lands for everything
// it says, so the room stays full instead of emptying itself in ten seconds.
const BOT_DUEL_DMG = 0.15;

// Bots stand on the ground like anyone else: a hop is real airtime, and a
// short dash is a real burst of speed. Both are on cooldowns, so they read as
// decisions rather than twitching.
function tickBotBody(bot, dt) {
  bot.jumpCD = Math.max(0, (bot.jumpCD || 0) - dt);
  bot.dashCD = Math.max(0, (bot.dashCD || 0) - dt);
  bot.dashT = Math.max(0, (bot.dashT || 0) - dt);
  if ((bot.z ?? 0) > 0 || (bot.vz ?? 0) > 0) {
    bot.vz = (bot.vz ?? 0) - BOT_GRAVITY * dt;
    bot.z = (bot.z ?? 0) + bot.vz * dt;
    if (bot.z <= 0) { bot.z = 0; bot.vz = 0; }
  }
}

// Being shot at is what makes a player hop out of the line or dash across it.
function botEvasive(bot, dt, incoming) {
  if (!incoming) return;
  if ((bot.jumpCD || 0) <= 0 && (bot.z ?? 0) <= 0 && Math.random() < 0.4) {
    bot.vz = BOT_JUMP_V;
    bot.jumpCD = 1.5 + Math.random() * 2.2;
    return;
  }
  if ((bot.dashCD || 0) <= 0 && (bot.z ?? 0) <= 0 && Math.random() < 0.35) {
    bot.dashT = 0.18;
    bot.dashCD = 2.4 + Math.random() * 2.2;
    bot.dashDir = Math.random() < 0.5 ? 1 : -1;
  }
}

const botSpeed = (bot, base) => ((bot.dashT || 0) > 0 ? base * 2.4 : base);

function segHitsCircle(x0, y0, x1, y1, cx, cy, r) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const dx = x0 + (x1 - x0) * t - cx;
    const dy = y0 + (y1 - y0) * t - cy;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

// Geometry the room will not let a body stand in: a wall or a hazard.
function spotBlocked(lobby, x, y, r) {
  const hit = (o) => {
    const cx = Math.max(o.x, Math.min(x, o.x + o.w));
    const cy = Math.max(o.y, Math.min(y, o.y + o.h));
    return (x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r;
  };
  for (const s of (lobby.world?.walls || [])) if (hit(s)) return true;
  for (const h of (lobby.world?.hazards || [])) if (hit(h)) return true;
  return false;
}

// A returning bot drops in somewhere quiet across the map, never in the same
// spot as the last one. Ringed around the middle they all came back into one
// pile, and the whole room ended up fighting in a single clump.
function respawnBot(lobby, bot) {
  const w = lobby.world?.w || 8000, h = lobby.world?.h || 5600;
  let best = null, bestGap = -1;
  for (let i = 0; i < 40; i++) {
    const x = 300 + Math.random() * (w - 600), y = 300 + Math.random() * (h - 600);
    if (spotBlocked(lobby, x, y, 26)) continue;
    let gap = Infinity;
    for (const o of lobby.bots || []) if (o !== bot && (o.hp ?? 1) > 0) gap = Math.min(gap, Math.hypot(o.x - x, o.y - y));
    for (const p of lobby.players || []) if ((p.hp ?? 1) > 0) gap = Math.min(gap, Math.hypot(p.x - x, p.y - y));
    if (gap > bestGap) { bestGap = gap; best = { x, y }; }
    if (gap > 1400) break;
  }
  const c = arenaCentre(lobby);
  bot.x = best ? Math.round(best.x) : c.x;
  bot.y = best ? Math.round(best.y) : c.y;
  bot.hp = bot.hpMax ?? 100;
  bot.respawnAt = 0;
  bot.burst = 0;
  bot.shootCD = 0.4 + Math.random() * 0.6;
  bot._wasAlive = true;
}

// Who a free-for-all bot goes after: any living body in the room, players and
// other bots alike, so the room fights itself instead of the whole squad
// turning on the one human. Distance decides, with noise and a nudge toward
// whoever is already hurt, so the pack spreads out like people do.
function pvpTarget(lobby, bot, t, crowd) {
  const teamMode = lobby.mode === 'teams' || lobby.mode === 'ctf';
  let best = null, bestScore = Infinity;
  const consider = (o, isBot) => {
    if (!o || (o.hp ?? 1) <= 0) return;
    if (!isBot && (o.spawnProtectUntil ?? 0) > t) return;
    if (teamMode && bot.team != null && o.team === bot.team) return;
    const d = Math.hypot(o.x - bot.x, o.y - bot.y);
    if (d > 1900) return;
    let score = d * (0.85 + Math.random() * 0.4);
    if ((o.hp ?? 100) < 45) score -= 240;
    // A body half the room is already chasing is a poor target: the penalty
    // breaks the fight into several skirmishes instead of one pile-up.
    score += ((crowd && crowd.get(o)) || 0) * 320;
    if (score < bestScore) { bestScore = score; best = o; }
  };
  for (const p of lobby.players) consider(p, false);
  for (const o of lobby.bots || []) if (o !== bot) consider(o, true);
  return best;
}

export function updatePvpBots(lobby, dt, move) {
  if (lobby.mode !== 'pvp' && lobby.mode !== 'br' && lobby.mode !== 'duel') return;
  const bots = lobby.bots || [];
  if (!bots.length) return;
  const t = Date.now();
  const zone = lobby.zone;
  // How many bots are already on each body (last tick's choices), so a crowd
  // can be avoided without counting it once per bot per target.
  const crowd = new Map();
  for (const b of bots) if ((b.hp ?? 1) > 0 && b._target) crowd.set(b._target, (crowd.get(b._target) || 0) + 1);
  for (const bot of bots) {
    tickBotBody(bot, dt);
    if ((bot.hp ?? 0) <= 0) {
      // A Battle Royale death is final: nobody comes back until the round does.
      // A duel bot never comes back mid-round: the round ends with the body.
      if (lobby.mode !== 'br' && lobby.mode !== 'duel' && bot.respawnAt && t >= bot.respawnAt) respawnBot(lobby, bot);
      continue;
    }
    bot.shootCD = (bot.shootCD || 0) - dt;
    bot.strafeT = (bot.strafeT || 0) - dt;
    const incoming = (bot._shotAt ?? 0) > t - 450;

    // The storm outranks any body: get inside the ring first.
    if (zone && Math.hypot(bot.x - zone.cx, bot.y - zone.cy) > zone.r * 0.86) {
      bot.ang = steerToGoal(lobby, bot, zone.cx, zone.cy, botSpeed(bot, BOT_SPEED), dt, move);
      botEvasive(bot, dt, incoming);
      continue;
    }

    const tgt = pvpTarget(lobby, bot, t, crowd);
    bot._target = tgt;
    if (!tgt) {
      const c = arenaCentre(lobby);
      if (Math.hypot(c.x - bot.x, c.y - bot.y) > 120) {
        bot.ang = steerToGoal(lobby, bot, c.x, c.y, BOT_SPEED * 0.8, dt, move);
      }
      continue;
    }

    const dist = Math.hypot(tgt.x - bot.x, tgt.y - bot.y);
    const los = clearShot(lobby, bot.x, bot.y, tgt.x, tgt.y);
    bot.ang = Math.atan2(tgt.y - bot.y, tgt.x - bot.x);
    const speed = botSpeed(bot, BOT_SPEED);
    botEvasive(bot, dt, incoming && dist < 950);

    if (!los || dist > 420) {
      bot.ang = steerToGoal(lobby, bot, tgt.x, tgt.y, speed, dt, move);
    } else if (dist < 130) {
      // Too close: back off while still facing them, like a player kiting.
      steerMove(lobby, bot, bot.ang + Math.PI, speed * 0.75, dt, move);
    } else {
      if (bot.strafeT <= 0) { bot.strafeT = 0.7 + Math.random() * 0.8; bot.strafeDir = (bot.strafeDir || 1) * -1; }
      const side = (bot.dashT || 0) > 0 ? (bot.dashDir || 1) : (bot.strafeDir || 1);
      steerMove(lobby, bot, bot.ang + (Math.PI / 2) * side, speed * 0.8, dt, move);
    }

    // On the ground with a lane: shoot. Mid-hop they keep moving instead.
    const skill = bot.skill ?? 0.72;
    if (los && dist < FIRE_RANGE && bot.shootCD <= 0 && (bot.z ?? 0) < 40) {
      const lead = 0.08 + skill * 0.14;
      const tx = tgt.x + (tgt.vx || 0) * lead;
      const ty = tgt.y + (tgt.vy || 0) * lead;
      const spread = 0.06 - skill * 0.035;
      const ang = Math.atan2(ty - bot.y, tx - bot.x) + (Math.random() - 0.5) * spread * 2;
      lobby.bullets.push({
        owner: 'B:' + bot.id, kind: 'bot', team: bot.team ?? null,
        x: bot.x + Math.cos(ang) * 22, y: bot.y + Math.sin(ang) * 22,
        vx: Math.cos(ang) * SHOT_SPEED, vy: Math.sin(ang) * SHOT_SPEED,
        r: 4, dmg: DMG * (0.85 + skill * 0.3), life: 1.15
      });
      bot.burst = (bot.burst || 0) + 1;
      bot.shootCD = 0.18 + (1 - skill) * 0.22;
      if (bot.burst >= 4) { bot.burst = 0; bot.shootCD = 0.4 + Math.random() * 0.5; }
    }
  }
}

// Player shots land on the bots in a free-for-all, and a bot that runs out of
// health waits a few seconds before stepping back in.
export function resolvePvpBotBullets(lobby) {
  if (lobby.mode !== 'pvp' && lobby.mode !== 'br' && lobby.mode !== 'duel') return;
  const bots = lobby.bots || [];
  if (!bots.length) return;
  const teamMode = lobby.mode === 'teams' || lobby.mode === 'ctf';
  for (let i = lobby.bullets.length - 1; i >= 0; i--) {
    const b = lobby.bullets[i];
    if (typeof b.owner !== 'string') continue;
    if (b.owner.startsWith('E:') || b.owner.startsWith('T:')) continue;
    const x0 = b._x0 ?? b.x, y0 = b._y0 ?? b.y;
    for (const bot of bots) {
      if ((bot.hp ?? 0) <= 0) continue;
      if (b.owner === 'B:' + bot.id) continue;
      if (teamMode && b.team != null && b.team === bot.team) continue;
      const rr = (b.r ?? 4) + (bot.r ?? 14);
      if (segHitsCircle(x0, y0, b.x, b.y, bot.x, bot.y, rr)) {
        const fromBot = b.owner.startsWith('B:');
        bot.hp = Math.max(0, (bot.hp ?? 100) - (b.dmg ?? 10) * (fromBot ? BOT_DUEL_DMG : 1));
        // A bot that just took a hit knows it is being shot at, and reacts.
        bot._shotAt = Date.now();
        if (bot.hp <= 0 && lobby.mode !== 'br' && lobby.mode !== 'duel') bot.respawnAt = Date.now() + PVP_RESPAWN_MS;
        lobby.bullets.splice(i, 1);
        break;
      }
    }
  }
}

/* ============================================================
   THE PUBLIC SERVERS
   Four rooms stay open around the clock (one per mode) and keep themselves
   playing. The bots there are meant to pass for people: each carries a name
   from the same pools real players pick from, a rank, and a personality that
   decides how it talks. They chat in the lobby, swing melee weapons, throw
   utilities, and now and then swap identity — someone "leaves" and somebody
   new "joins" with a different name and mood.
   ============================================================ */

const ROTATE_MS = 4 * 60 * 1000;
export const PUBLIC_MODES = { pve: true, pvp: true, br: true, teams: true, ctf: true };

const HANDLE_A = ['void', 'ashen', 'nyx', 'kx', 'zeph', 'mira', 'luna', 'silent', 'frost', 'ember',
  'sable', 'rune', 'hex', 'echo', 'nova', 'onyx', 'lucid', 'yuki', 'sora', 'kairo', 'vyn', 'juno',
  'moth', 'sage', 'wisp', 'gloom', 'blitz', 'shade', 'haze', 'astra', 'koda', 'rin', 'jett', 'neon',
  'pixel', 'cyber', 'mako', 'aria', 'zen', 'oryn'];
const HANDLE_B = ['', 'x', 'z', 'gg', 'irl', 'core', 'main', 'exe', 'tv', 'ttv', '01', '07', '09',
  '13', '21', '99', 'xd', 'uwu', 'qt', 'zz'];
const HANDLES = ['notyourkitten', 'itsjustkai', 'brokensword', 'lowskill', 'washed', 'clipped',
  'sadge', 'cooked', 'aimdiff', 'touchgrass', 'noshot', 'midlane', 'cracked', 'delulu', 'npc',
  'skillissue', 'tryhard', 'carried', 'onehp', 'ggwp', 'notmaya', 'realvyn', 'justkai'];
const CAMEL = ['SilentStorm', 'VoidKitten', 'AshenFox', 'GlassWing', 'IronBloom', 'NightOwl',
  'PaleSun', 'ColdSnap', 'GreyMatter', 'BlueHour', 'LastLight', 'SlowBurn', 'QuietRiot', 'PaperMoon'];

const pick = (a) => a[(Math.random() * a.length) | 0];

function makeName() {
  const r = Math.random();
  if (r < 0.3) return pick(HANDLES);
  if (r < 0.55) return pick(CAMEL);
  if (r < 0.85) return pick(HANDLE_A) + pick(HANDLE_B);
  return pick(HANDLE_A) + pick(HANDLE_A);
}

// Most of the room sits in the middle of the ladder; the odd one is grinding.
function makeRank() {
  return 3 + ((Math.random() * Math.random() * 45) | 0);
}

const PERSONAS = {
  chill: {
    lines: ['gg', 'take ur time', 'np', 'all good', 'we got this', 'no rush', 'chill wave'],
    join: ['hey all', 'yo', 'sup', 'just got here'],
    leave: ['cya', 'later all', 'gtg, gg'],
    wave: ['next wave, stay close', 'i got the left side', 'ease into it'],
    boss: ['boss up, spread out', 'watch the telegraphs', 'slow and steady'],
    death: ['oof', 'my bad', 'got greedy'],
  },
  sweaty: {
    lines: ['push mid', 'rotate left', 'behind you', 'watch the flank', 'group up', 'holding the lane'],
    join: ['in', 'ready', 'queueing'],
    leave: ['out', 'ggs', 'one more then im done'],
    wave: ['mid control this wave', 'i take high ground', 'stack the lane'],
    boss: ['burn it fast', 'save cooldowns for the boss', 'clear adds first'],
    death: ['tp back', 'traded', 'they got me'],
  },
  meme: {
    lines: ['it is so over', 'cooked', 'ratio', 'skill issue', 'this is fine', 'we ball', 'no shot'],
    join: ['we are so back', 'reporting for duty'],
    leave: ['i am out, stay silly', 'gg no re'],
    wave: ['here we go again', 'waves are personal now'],
    boss: ['big lad incoming', 'he looks mad'],
    death: ['rip bozo (me)', 'i was lagging i swear'],
  },
  coach: {
    lines: ['watch the red zone', 'roll behind it', 'save your guard', 'reload before the wave'],
    join: ['gl hf', 'anyone new? ask away'],
    leave: ['gg, good run'],
    wave: ['keep the middle clear', 'stay off the lava'],
    boss: ['bait the slam, then punish', 'spread so the splash misses'],
    death: ['that was on me', 'note the timing on that one'],
  },
  hype: {
    lines: ['LETS GO', 'clip that', 'we are so back', 'W', 'huge', 'clean'],
    join: ['LETS GOOO', 'new blood, welcome'],
    leave: ['ggs everyone'],
    wave: ['next wave is ours', 'big one, big plays'],
    boss: ['LIGHT IT UP', 'take it down'],
    death: ['nooo', 'so close'],
  },
  quiet: {
    lines: ['k', 'gg', 'ok', 'nice', 'same'],
    join: ['yo'],
    leave: ['gg'],
    wave: ['ok'],
    boss: ['boss'],
    death: ['mb'],
  },
};
const PERSONA_KEYS = Object.keys(PERSONAS);

export function makeIdentity() {
  const persona = pick(PERSONA_KEYS);
  return {
    name: makeName().slice(0, 18),
    rank: makeRank(),
    persona,
    // A wide spread on purpose: a room where everyone aims the same is a room
    // with no shape to it. The sharp end leads shots and rarely misses.
    skill: 0.48 + Math.random() * 0.5
  };
}

const personaLine = (bot, key) => {
  const p = PERSONAS[bot.persona] || PERSONAS.chill;
  return pick(p[key] || p.lines);
};

function say(lobby, bot, text) {
  if (!text) return;
  lobby.chat = Array.isArray(lobby.chat) ? lobby.chat : [];
  lobby.chat.push({
    t: Date.now(), id: 'B:' + bot.id,
    name: (bot.name || 'Player').slice(0, 18),
    text: String(text).slice(0, 140),
    rank: bot.rank || 1
  });
  if (lobby.chat.length > 60) lobby.chat = lobby.chat.slice(-60);
}

// How many bodies a public server of each mode keeps on the field. The
// free-for-all carries the biggest roster: a bloody arena needs people in it.
export function publicBotCount(mode) {
  return mode === 'pve' ? 6 : mode === 'pvp' ? 28 : mode === 'br' ? 20 : 5;
}

export function ensurePublicLobby(lobby) {
  lobby.public = true;
  lobby.custom = false;
  lobby.hostId = null;
  lobby.botsEnabled = true;
  lobby.respawn = true;
  lobby.botCount = publicBotCount(lobby.mode);
  if (lobby.levelId == null) lobby.levelId = 1;
  if (lobby.mapSeed == null) lobby.mapSeed = Math.floor(Math.random() * 2147483647);
  // The match starts on the very next tick and never waits for a host.
  lobby.startTime = Date.now() - 1000;
  lobby.lastTick = Date.now() - 200;
  lobby.pubNextRotate = Date.now() + ROTATE_MS;
  lobby.pubChatAt = Date.now() + 5000;
  return lobby;
}

// A room that was opened before it became a public server (or by a stray
// private join) is reset and taken over, so the code always lands on the
// running server rather than on somebody's old lobby.
export function adoptPublic(lobby, mode) {
  lobby.mode = mode;
  lobby.winner = null;
  lobby.enemies = [];
  lobby.spawnQueue = [];
  lobby.bullets = [];
  lobby.giants = [];
  lobby.golems = [];
  lobby.ctf = null;
  lobby.bots = [];
  lobby.players = [];
  lobby.inputs = {};
  lobby.scores = {};
  lobby.chat = [];
  lobby.meleeFx = [];
  lobby.utilityFx = [];
  lobby.pickups = [];
  lobby.world = null;
  lobby.worldKey = null;
  lobby.levelId = 1;
  lobby.mapSeed = Math.floor(Math.random() * 2147483647);
  lobby.started = false;
  return ensurePublicLobby(lobby);
}

// A bot that has just been created gets its person; existing ones keep theirs.
export function assignIdentities(lobby) {
  for (const b of lobby.bots || []) {
    if (b.persona && b.name && b.rank) continue;
    const id = makeIdentity();
    b.name = id.name;
    b.rank = id.rank;
    b.persona = id.persona;
    b.skill = id.skill;
    if (!Number.isInteger(b.design)) b.design = (Math.random() * 15) | 0;
    if (!Number.isInteger(b.color)) b.color = (Math.random() * 7) | 0;
    if (!Number.isInteger(b.weapon)) b.weapon = (Math.random() * 3) | 0;
    b.nextChat = Date.now() + 4000 + Math.random() * 15000;
    b.meleeCD = Math.random() * 3;
    b.utilCD = 6 + Math.random() * 10;
  }
}

// Half the room turns over: someone signs off, somebody new signs on.
function rotateRoom(lobby, t) {
  const bots = (lobby.bots || []).filter((b) => (b.hp ?? 1) > 0 && b.name);
  if (!bots.length) return;
  const n = Math.max(1, Math.round(bots.length / 2));
  const done = new Set();
  for (let i = 0; i < n; i++) {
    const bot = pick(bots);
    if (!bot || done.has(bot.id)) continue;
    done.add(bot.id);
    say(lobby, bot, personaLine(bot, 'leave'));
    const id = makeIdentity();
    bot.name = id.name;
    bot.rank = id.rank;
    bot.persona = id.persona;
    bot.skill = id.skill;
    bot.nextChat = t + 3000 + Math.random() * 9000;
    say(lobby, bot, personaLine(bot, 'join'));
  }
}

function chatKey(lobby) {
  if ((lobby.enemies || []).some((e) => e && e.type === 'boss')) return 'boss';
  return Math.random() < 0.4 ? 'wave' : 'lines';
}

function chatTick(lobby, t) {
  const bots = (lobby.bots || []).filter((b) => (b.hp ?? 1) > 0 && b.name);
  if (!bots.length) return;
  let said = 0;
  for (const b of bots) {
    if (said >= 1) break;
    if (t < (b.nextChat || 0)) continue;
    b.nextChat = t + 7000 + Math.random() * 16000;
    say(lobby, b, personaLine(b, chatKey(lobby)));
    said++;
  }
  // A quiet room still murmurs, so a lone player is never standing in silence.
  if (!said && t >= (lobby.pubChatAt || 0)) {
    lobby.pubChatAt = t + 11000 + Math.random() * 9000;
    const b = pick(bots);
    say(lobby, b, personaLine(b, chatKey(lobby)));
  }
}

function watchDeaths(lobby, t) {
  for (const b of lobby.bots || []) {
    const alive = (b.hp ?? 1) > 0;
    if (b._wasAlive === undefined) { b._wasAlive = alive; continue; }
    if (b._wasAlive && !alive) {
      say(lobby, b, personaLine(b, 'death'));
      b._diedAt = t;
    }
    b._wasAlive = alive;
  }
}

const MELEE_HIGH = ['legendary_blade1', 'god_blade1', 'epic_blade2'];
const MELEE_MID = ['rare_blade1', 'epic_blade1', 'rare_punch2'];
const MELEE_LOW = ['common_blade1', 'common_punch1', 'common_punch2'];
const UTILS = ['breach_charge', 'viper_fang', 'shock_mine', 'tar_grenade'];

function nearestEnemy(lobby, bot, maxD) {
  let best = null, bestD = maxD;
  for (const e of lobby.enemies || []) {
    if ((e.hp ?? 0) <= 0) continue;
    const d = Math.hypot(e.x - bot.x, e.y - bot.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function nearestPlayer(lobby, bot, maxD) {
  let best = null, bestD = maxD;
  const t = Date.now();
  const teamMode = lobby.mode === 'teams' || lobby.mode === 'ctf';
  for (const p of lobby.players || []) {
    if ((p.hp ?? 1) <= 0) continue;
    if (teamMode && bot.team != null && p.team === bot.team) continue;
    // A body that has just spawned is left alone until its grace runs out.
    if ((p.spawnProtectUntil ?? 0) > t) continue;
    const d = Math.hypot(p.x - bot.x, p.y - bot.y);
    if (d < bestD) { bestD = d; best = p; }
  }
  // …and other bots are bodies in the room too, so melee and utilities land
  // on them exactly as they land on a human.
  for (const o of lobby.bots || []) {
    if (o === bot || (o.hp ?? 1) <= 0) continue;
    if (teamMode && bot.team != null && o.team === bot.team) continue;
    const d = Math.hypot(o.x - bot.x, o.y - bot.y);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

function pushFx(list, entry, cap) {
  list.push(entry);
  if (list.length > cap) list.splice(0, list.length - cap);
}

function strike(lobby, bot, tgt, api, pve) {
  const weapon = bot.skill > 0.85 ? pick(MELEE_HIGH) : bot.skill > 0.72 ? pick(MELEE_MID) : pick(MELEE_LOW);
  const ang = Math.atan2(tgt.y - bot.y, tgt.x - bot.x);
  const dmg = 16 + bot.skill * 22;
  if (pve) {
    tgt.hp = Math.max(0, (tgt.hp ?? 1) - dmg);
  } else if ((lobby.bots || []).indexOf(tgt) >= 0) {
    // A bot is a body in the room like any other: another bot can cut it down.
    tgt.hp = Math.max(0, (tgt.hp ?? 100) - dmg * BOT_DUEL_DMG);
    tgt._shotAt = Date.now();
    if (tgt.hp <= 0 && lobby.mode !== 'br') tgt.respawnAt = Date.now() + PVP_RESPAWN_MS;
  } else if (api && api.damagePlayer) {
    api.damagePlayer(lobby, tgt.id, dmg, { id: 'B:' + bot.id, weapon: 'Melee' });
  } else {
    tgt.hp = Math.max(0, (tgt.hp ?? 100) - dmg);
    tgt._hitBy = { id: 'B:' + bot.id, weapon: 'Melee' };
  }
  lobby.meleeFx = Array.isArray(lobby.meleeFx) ? lobby.meleeFx : [];
  pushFx(lobby.meleeFx, {
    id: weapon, x: Math.round(tgt.x), y: Math.round(tgt.y),
    ang, guard: false, t0: Date.now(), owner: 'B:' + bot.id
  }, 24);
  bot.meleeCD = 1.1 + Math.random() * 1.2;
  if (Math.random() < 0.16) say(lobby, bot, pick(['got him', 'too close', 'bonk', 'melee diff']));
}

function throwUtil(lobby, bot, api, pve) {
  const pool = pve
    ? (lobby.enemies || []).filter((e) => (e.hp ?? 0) > 0)
    : [
        ...(lobby.players || []).filter((p) => (p.hp ?? 1) > 0 && (p.spawnProtectUntil ?? 0) <= Date.now() && !(bot.team != null && p.team === bot.team)),
        ...(lobby.bots || []).filter((b) => b !== bot && (b.hp ?? 1) > 0 && !(bot.team != null && b.team === bot.team))
      ];
  if (pool.length < 2) return false;
  // Aim where the crowd is, not where the nearest body happens to stand.
  let best = null, bestN = 0;
  for (const a of pool) {
    let n = 0;
    for (const b2 of pool) if (b2 !== a && Math.hypot(b2.x - a.x, b2.y - a.y) < 180) n++;
    if (n > bestN) { bestN = n; best = a; }
  }
  if (!best || bestN < 1) return false;
  const id = pick(UTILS);
  const rad = 150, dmg = 34;
  // A poor player throws where the crowd was a moment ago; a good one puts it
  // under their feet.
  const err = (1 - (bot.skill ?? 0.7)) * 130;
  const cx = best.x + (Math.random() - 0.5) * err;
  const cy = best.y + (Math.random() - 0.5) * err;
  for (const o of pool) {
    if (Math.hypot(o.x - cx, o.y - cy) > rad) continue;
    if (pve) {
      o.hp = Math.max(0, (o.hp ?? 1) - dmg);
    } else if ((lobby.bots || []).indexOf(o) >= 0) {
      o.hp = Math.max(0, (o.hp ?? 100) - dmg * BOT_DUEL_DMG);
      o._shotAt = Date.now();
      if (o.hp <= 0 && lobby.mode !== 'br') o.respawnAt = Date.now() + PVP_RESPAWN_MS;
    } else if (api && api.damagePlayer) {
      api.damagePlayer(lobby, o.id, dmg, { id: 'B:' + bot.id, weapon: id.replace(/_/g, ' ') });
    }
  }
  lobby.utilityFx = Array.isArray(lobby.utilityFx) ? lobby.utilityFx : [];
  pushFx(lobby.utilityFx, {
    id, x: Math.round(cx), y: Math.round(cy), r: rad,
    t0: Date.now(), dur: 5, owner: 'B:' + bot.id
  }, 24);
  bot.utilCD = 14 + Math.random() * 12;
  if (Math.random() < 0.2) say(lobby, bot, pick(['nade out', 'utility up', 'watch the blast']));
  return true;
}

function botAbilities(lobby, dt, api) {
  const pve = lobby.mode === 'pve';
  for (const bot of lobby.bots || []) {
    if ((bot.hp ?? 1) <= 0) continue;
    bot.meleeCD = Math.max(0, (bot.meleeCD || 0) - dt);
    bot.utilCD = Math.max(0, (bot.utilCD || 0) - dt);
    if (bot.meleeCD <= 0) {
      const close = pve ? nearestEnemy(lobby, bot, 105) : nearestPlayer(lobby, bot, 105);
      if (close) strike(lobby, bot, close, api, pve);
    }
    if (bot.utilCD <= 0) throwUtil(lobby, bot, api, pve);
  }
}

// A public room keeps its full roster: rooms opened before the count was
// raised are topped up the next time they tick.
export function topUpPublicBots(lobby) {
  if (!lobby.public) return;
  if (lobby.mode === 'teams' || lobby.mode === 'ctf') return;
  // A room opened before a roster change fills itself up to the new size.
  lobby.botCount = Math.max(lobby.botCount || 0, publicBotCount(lobby.mode));
  const want = Math.max(1, Math.min(28, lobby.botCount));
  lobby.bots = lobby.bots || [];
  if (lobby.bots.length >= want) return;
  // Fresh arrivals land in open ground across the map, never in a pile at the
  // middle — the same reason the room scatters its roster when it starts.
  const w = lobby.world?.w || 8000, h = lobby.world?.h || 5600;
  for (let i = lobby.bots.length; i < want; i++) {
    let bx = 0, by = 0, free = false;
    for (let k = 0; k < 40 && !free; k++) {
      bx = 300 + Math.random() * (w - 600); by = 300 + Math.random() * (h - 600);
      free = !spotBlocked(lobby, bx, by, 26);
      if (free) for (const o of lobby.bots) if (Math.hypot(o.x - bx, o.y - by) < 420) { free = false; break; }
    }
    if (!free) { const c = arenaCentre(lobby); bx = c.x; by = c.y; }
    lobby.bots.push({
      id: 'bot_' + i, name: 'Bot_' + (100 + i),
      x: bx, y: by,
      ang: 0, hp: 100, hpMax: 100, r: 14, skill: 0.5 + Math.random() * 0.45,
      role: ROLES[i % ROLES.length], shootCD: 0.25 + i * 0.2, burst: 0,
      pause: 0, strafeDir: i % 2 ? -1 : 1, strafeT: 0.8 + i * 0.35,
      sideSign: i % 2 ? -1 : 1, _sideSign: i % 2 ? -1 : 1,
      cover: null, coverT: 0, coverHold: 0
    });
  }
  assignIdentities(lobby);
}

// Runs every simulation step for a public room.
export function publicTick(lobby, dt, api) {
  if (!lobby || !lobby.public) return;
  topUpPublicBots(lobby);
  const t = Date.now();
  assignIdentities(lobby);
  watchDeaths(lobby, t);
  if (t >= (lobby.pubNextRotate || 0)) {
    rotateRoom(lobby, t);
    lobby.pubNextRotate = t + ROTATE_MS;
  }
  chatTick(lobby, t);
  botAbilities(lobby, dt, api);
}

// Runs while nobody is connected: the server stays live, the room keeps
// talking, and the next match is already warm for whoever walks in.
export function publicIdle(lobby) {
  const t = Date.now();
  if (!lobby.started) {
    lobby.startTime = t;
    lobby.lastTick = t - 200;
  }
  assignIdentities(lobby);
  if (t >= (lobby.pubNextRotate || 0)) {
    rotateRoom(lobby, t);
    lobby.pubNextRotate = t + ROTATE_MS;
  }
  chatTick(lobby, t);
}

// Somebody walked in — one of the regulars says hello.
export function publicJoin(lobby, name) {
  const bots = (lobby.bots || []).filter((b) => (b.hp ?? 1) > 0 && b.name);
  if (!bots.length) {
    lobby.pubChatAt = Date.now();
    return;
  }
  if (!name) return;
  const who = String(name).slice(0, 18);
  const b = pick(bots);
  say(lobby, b, pick(['welcome ' + who, 'yo ' + who, who + ' in the building',
    'hey ' + who + ', we are mid match', 'o/ ' + who]));
}