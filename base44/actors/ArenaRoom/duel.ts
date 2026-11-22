// ============================================================
// Monster Arena — DUELS (private lobby, 1v1).
// Two players agree on a number of rounds and a map before a single shot is
// fired. Where they disagree the rules settle it: rounds become the average of
// the two numbers (to a whole number), and the map is picked at random between
// the two they named. Each round starts from full health and full ammo, and
// whoever takes the most rounds wins the duel.
//
// Self-contained on purpose: a live room can only bundle its own files.
// ============================================================

export const DUEL_MAX_PLAYERS = 2;
export const DUEL_ROUND_CHOICES = [1, 3, 5, 7, 10];
// A duel pit is about a third of the PvE arena's floor.
const DUEL_SCALE = 0.58;
const COUNTDOWN_MS = 3200;
const ROUND_GAP_MS = 3200;
const REMATCH_MS = 9000;

export const duelArena = (w, h) => ({
  w: Math.max(900, Math.round(w * DUEL_SCALE)),
  h: Math.max(700, Math.round(h * DUEL_SCALE))
});

export function makeDuelState(opts = {}) {
  return {
    phase: 'vote',            // vote | countdown | live | roundover | over
    votes: {},                // peerId -> { rounds, levelId }
    rounds: 0,                // agreed number of rounds
    levelId: null,            // agreed map
    round: 0,                 // rounds played so far
    wins: {},                 // peerId (or 'bot') -> rounds won
    winner: null,
    roundWinner: null,
    startsAt: 0,
    roundEndsAt: 0,
    overAt: 0,
    bot: !!opts.bot,
    agreed: false
  };
}

const cleanRounds = (v) => {
  const n = Math.round(Number(v));
  return DUEL_ROUND_CHOICES.includes(n) ? n : null;
};
const cleanLevel = (v) => {
  const n = Math.round(Number(v));
  return n >= 1 && n <= 5 ? n : null;
};

// One player's pick. Both picks are kept so the other side sees them.
export function duelVote(lobby, playerId, msg) {
  const d = lobby.duel;
  if (!d || d.phase !== 'vote' || !playerId) return false;
  const rounds = cleanRounds(msg?.rounds);
  const levelId = cleanLevel(msg?.levelId);
  if (rounds == null && levelId == null) return false;
  const cur = d.votes[playerId] || {};
  d.votes[playerId] = {
    rounds: rounds != null ? rounds : (cur.rounds ?? null),
    levelId: levelId != null ? levelId : (cur.levelId ?? null)
  };
  return settleDuel(lobby);
}

// Both players have spoken: average the rounds, roll the map, start counting.
export function settleDuel(lobby) {
  const d = lobby.duel;
  if (!d || d.phase !== 'vote') return false;
  const ids = (lobby.players || []).map((p) => p.id);
  if (ids.length < 2) return false;
  const picks = ids.map((id) => d.votes[id]).filter(Boolean);
  if (picks.length < 2) return false;

  const roundsPicked = picks.map((v) => v.rounds).filter((n) => n != null);
  let rounds = 3;
  if (roundsPicked.length === 2) {
    rounds = roundsPicked[0] === roundsPicked[1]
      ? roundsPicked[0]
      : Math.round((roundsPicked[0] + roundsPicked[1]) / 2);
  } else if (roundsPicked.length === 1) {
    rounds = roundsPicked[0];
  }

  const mapsPicked = picks.map((v) => v.levelId).filter((n) => n != null);
  let levelId = 1;
  if (mapsPicked.length === 2) {
    levelId = mapsPicked[0] === mapsPicked[1]
      ? mapsPicked[0]
      : mapsPicked[Math.random() < 0.5 ? 0 : 1];
  } else if (mapsPicked.length === 1) {
    levelId = mapsPicked[0];
  }

  d.rounds = rounds;
  d.levelId = levelId;
  d.agreed = true;
  d.phase = 'countdown';
  d.startsAt = Date.now() + COUNTDOWN_MS;
  d.round = 0;
  d.winner = null;
  d.roundWinner = null;
  d.wins = {};
  for (const id of ids) d.wins[id] = 0;
  return true;
}

// A mark that happens to sit inside a house or a block is no place to put a
// fighter: a body standing in geometry fights the walls every step (and the
// room keeps correcting it), so the nearest open ground is used instead.
function snapFree(isFree, x, y) {
  if (typeof isFree !== 'function' || isFree(x, y)) return { x, y };
  for (let r = 24; r <= 420; r += 24) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const nx = Math.round(x + Math.cos(a) * r);
      const ny = Math.round(y + Math.sin(a) * r);
      if (isFree(x, y) || isFree(nx, ny)) return { x: nx, y: ny };
    }
  }
  return { x, y };
}

// Both fighters back to their marks with a full bar, a fresh mag and nothing
// left over from the round that just ended.
export function placeDuelBodies(lobby, isFree) {
  const w = lobby.world?.w || 2000;
  const h = lobby.world?.h || 1400;
  const ids = (lobby.players || []).map((p) => p.id);
  ids.forEach((id, i) => {
    const p = (lobby.players || []).find((q) => q.id === id);
    if (!p) return;
    const left = ids.length < 2 ? true : i === 0;
    const spot = snapFree(isFree, Math.round(w * (left ? 0.16 : 0.84)), Math.round(h / 2));
    p.x = spot.x;
    p.y = spot.y;
    p.z = 0; p.vz = 0; p.vx = 0; p.vy = 0;
    p.ang = left ? 0 : Math.PI;
    p.hp = p.hpMax ?? 100;
    p.shield = 0;
    p.speedBoostT = 0;
    p.burnT = 0;
    p.burnStacks = 0;
    p.respawnAt = 0;
    p._hitBy = null;
    p._deathAt = 0;
    p._lastHit = null;
    p.ammo = 999;
    p.spawnProtectUntil = Date.now() + 900;
  });
  const bot = (lobby.bots || [])[0];
  if (bot) {
    const spot = snapFree(isFree, Math.round(w * 0.84), Math.round(h / 2));
    bot.x = spot.x;
    bot.y = spot.y;
    bot.z = 0; bot.vz = 0;
    bot.hp = bot.hpMax ?? 100;
    bot.respawnAt = 0;
    bot._shotAt = 0;
  }
}

export function startDuelRound(lobby, isFree) {
  const d = lobby.duel;
  if (!d) return;
  d.round = (d.round || 0) + 1;
  d.phase = 'live';
  d.roundWinner = null;
  d.roundEndsAt = 0;
  placeDuelBodies(lobby, isFree);
  lobby.bullets = [];
  lobby.meleeFx = [];
  lobby.utilityFx = [];
  lobby.pickups = [];
  lobby.deathChests = [];
}

function endDuelRound(lobby, winnerId) {
  const d = lobby.duel;
  if (!d || d.phase !== 'live') return;
  d.phase = 'roundover';
  d.roundWinner = winnerId || null;
  if (winnerId) d.wins[winnerId] = (d.wins[winnerId] || 0) + 1;
  d.roundEndsAt = Date.now() + ROUND_GAP_MS;
}

// Called once per simulation tick.
export function duelTick(lobby, isFree) {
  const d = lobby.duel;
  if (!d) return;
  const t = Date.now();

  if (d.phase === 'countdown') {
    if (t >= d.startsAt) startDuelRound(lobby, isFree);
    return;
  }

  if (d.phase === 'live') {
    const alivePlayers = (lobby.players || []).filter((p) => (p.hp ?? 1) > 0);
    const aliveBots = (lobby.bots || []).filter((b) => (b.hp ?? 1) > 0);
    const bodies = alivePlayers.length + (d.bot ? aliveBots.length : 0);
    if (bodies <= 1) {
      let winner = null;
      if (alivePlayers.length === 1) winner = alivePlayers[0].id;
      else if (d.bot && aliveBots.length === 1) winner = 'bot';
      endDuelRound(lobby, winner);
    }
    return;
  }

  if (d.phase === 'roundover' && t >= d.roundEndsAt) {
    if ((d.round || 0) >= (d.rounds || 1)) {
      // Most rounds won takes the duel; an even split is a draw.
      const ids = (lobby.players || []).map((p) => p.id);
      const botWins = d.bot ? (d.wins.bot || 0) : 0;
      let top = botWins;
      for (const id of ids) top = Math.max(top, d.wins[id] || 0);
      const leaders = ids.filter((id) => (d.wins[id] || 0) === top);
      const botTop = d.bot && botWins === top;
      d.winner = leaders.length === 1 && !botTop ? leaders[0]
        : leaders.length === 0 && botTop ? 'bot' : null;
      d.phase = 'over';
      d.overAt = t;
    } else {
      startDuelRound(lobby, isFree);
    }
    return;
  }

  // A finished duel goes back to the table: both players pick again for a rematch.
  if (d.phase === 'over' && t >= (d.overAt || 0) + REMATCH_MS) {
    lobby.duel = makeDuelState({ bot: d.bot });
    lobby.started = false;
  }
}

// The client needs the votes, the agreed terms and the score — nothing else.
export function bakeDuel(lobby) {
  const d = lobby.duel;
  if (!d) return null;
  const t = Date.now();
  return {
    phase: d.phase,
    rounds: d.rounds || 0,
    levelId: d.levelId || null,
    round: d.round || 0,
    winner: d.winner || null,
    roundWinner: d.roundWinner || null,
    bot: !!d.bot,
    agreed: !!d.agreed,
    votes: d.votes || {},
    wins: d.wins || {},
    in: d.phase === 'countdown' ? Math.max(0, Math.ceil((d.startsAt - t) / 1000))
      : d.phase === 'roundover' ? Math.max(0, Math.ceil((d.roundEndsAt - t) / 1000)) : 0
  };
}