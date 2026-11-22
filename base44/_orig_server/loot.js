// =============================================================================
// LOOT / XP / SCORE HELPERS (server side)
// Extracted from signaling_http.js so that file stays within size limits.
// Pure lobby-state helpers: no express, no globals beyond Date.
// =============================================================================

const now = () => Date.now();

export const PVE_POINTS = {
  ravener: 1,
  tank: 3,
  shooter: 4,
  sniper: 3,
  bomber: 5,
  healer: 2,
  boss: 15
};

// ✅ must match client interpolation buffer (~2 ticks)
export const INTERP_DELAY = 0.1;
// Match client snapshot interpolation delay (see getInterpolatedSnapshot(delayMs=120))
export const CONTACT_LAG_MS = 120;

export function pvePointsForType(type) {
  const key = (type === 'chaser' || type === 'swarm') ? 'ravener' : type;
  return PVE_POINTS[key] || 0;
}

export function recordEnemyHist(e, tNow) {
  e._hist = e._hist || [];
  e._hist.push({ t: tNow, x: e.x, y: e.y });
  // keep last ~10 samples (10*50ms = 500ms history)
  if (e._hist.length > 10) e._hist.shift();
}

export const LOOT_TYPES = ['health', 'ammo', 'speed', 'shield'];

export function spawnEnemyLoot(lobby, x, y, count) {
  if (!count) return;

  const R_MIN = 18;
  const R_MAX = 42;

  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = R_MIN + Math.random() * (R_MAX - R_MIN);

    lobby.pickups.push({
      x: x + Math.cos(a) * r,
      y: y + Math.sin(a) * r,
      r: 14,
      type: LOOT_TYPES[(Math.random() * LOOT_TYPES.length) | 0]
    });
  }

  lobby.pickupVer++;
}

// ============================
// XP ORBS (WHITE ORBS)
// ============================
export function spawnXpOrbs(lobby, x, y, count = 1) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 18 + Math.random() * 24;

    lobby.pickups.push({
      x: x + Math.cos(a) * d,
      y: y + Math.sin(a) * d,
      r: 10,
      type: 'xp',
      v: 1,                // ✅ XP value
      bornAt: now()        // ✅ grace period so it exists visually
    });
  }

  lobby.pickupVer++;
}

export function lootCountByEnemy(type) {
  switch (type) {
    case 'chaser':
    case 'ravener':
    case 'swarm':
      return 1;

    case 'tank':
    case 'shooter':
    case 'sniper':
      return 3;

    case 'healer':
      return 4;

    case 'bomber':
      return 5;

    case 'boss':
      return 10;

    default:
      return 0;
  }
}

export function enemyPosAtTime(e, tTarget) {
  const h = e._hist;
  if (!h || h.length === 0) return { x: e.x, y: e.y };

  // if target before oldest / after newest
  if (tTarget <= h[0].t) return { x: h[0].x, y: h[0].y };
  if (tTarget >= h[h.length - 1].t) return { x: h[h.length - 1].x, y: h[h.length - 1].y };

  // find segment [i, i+1] around tTarget
  for (let i = h.length - 2; i >= 0; i--) {
    const a = h[i], b = h[i + 1];
    if (a.t <= tTarget && tTarget <= b.t) {
      const span = Math.max(1, b.t - a.t);
      const u = (tTarget - a.t) / span;
      return {
        x: a.x + (b.x - a.x) * u,
        y: a.y + (b.y - a.y) * u
      };
    }
  }
  // fallback (shouldn’t hit)
  return { x: h[0].x, y: h[0].y };
}

export function awardPvEPoint(lobby, killerId, enemyType) {
  if (!lobby || lobby.mode !== 'pve') return;
  if (!lobby.scores) lobby.scores = new Map();
  if (!killerId || !lobby.players.has(killerId)) return;

  const pts = pvePointsForType(enemyType);
  if (!pts) return;

  lobby.scores.set(killerId, (lobby.scores.get(killerId) || 0) + pts);
}