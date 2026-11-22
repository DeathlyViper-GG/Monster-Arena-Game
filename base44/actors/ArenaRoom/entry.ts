// Monster Arena — live match room.
// One room per lobby code. The authoritative match lives here in memory and is
// pushed over the socket, so a running match costs no database reads or writes.
// The simulation is the game's own (bundled alongside this file), so online and
// offline play follow identical rules.
import { Actor } from 'base44:runtime/actors';
import {
  WORLD, now, bakeSnapshot, advance, ensureWorldGenerated, createLobby,
  addPlayer, removePlayer, startGame, rollChestDropsForServer, safeSpawn,
  spawnXpOrbs, pvePointsForType, awardPvEPoint
} from './gameSim.ts';
import { GLYPH_KEYS, makeGlyphState, applyGlyphHit, applyGlyphKill, ensureStarter, onGlyphUnlock } from './glyph.ts';
import { isTeamMode, pickTeam, fillTeamsWithBots } from './teams.ts';
import { PUBLIC_MODES, adoptPublic, publicIdle, publicJoin, publicBotCount } from './bots.ts';
import { DUEL_MAX_PLAYERS, makeDuelState, duelVote } from './duel.ts';

const MAX_PLAYERS = 40; // a public room's seats, bots included
const DUEL_QUEUE_ROOM = 'DUELQ';
const DUEL_QUEUE_WAIT_MS = 10000; // then a bot takes the other side
const DUEL_MODES = ['pve', 'pvp', 'br', 'teams', 'ctf', 'duel'];
const CHARS_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function duelRoomCode(): string {
  let s = 'D';
  for (let i = 0; i < 5; i++) s += CHARS_CODE[(Math.random() * CHARS_CODE.length) | 0];
  return s;
}
const SNAP_MS = 60;          // ~16 snapshots a second

// A shot's weapon name -> the projectile kind every client's renderer knows
// (render3d_fx BULLET_VIS). Without it a flamethrower shot reached other
// players as a plain pistol tracer instead of a fireball.
function bulletKind(name: string): string {
  const n = String(name || '').toLowerCase();
  if (n.includes('flame')) return 'flamethrower';
  if (n.includes('crossbow')) return 'crossbow';
  if (n.includes('marksman')) return 'marksman';
  if (n.includes('burst')) return 'burst';
  if (n.includes('smg')) return 'smg';
  if (n.includes('lmg')) return 'lmg';
  if (n.includes('rifle')) return 'rifle';
  if (n.includes('shotgun')) return 'shotgun';
  return '';
}
const SAVE_MS = 2500;
// Glyph prices, in the same ladder the upgrade screen shows: core/T1 = 5,
// T2 = 10, T3 = 20. The server charges what the client displays, so essence
// never snaps back to a different number after a purchase.
const GLYPH_COST_CORE = 5;
const GLYPH_TIER_COST = [5, 10, 20];
function glyphNodeCost(path, key) {
  const keys = GLYPH_KEYS[path] || [];
  const i = keys.indexOf(key);
  if (i < 0) return GLYPH_TIER_COST[0];
  // Flat key list is branch-major: each branch contributes three tiers.
  return GLYPH_TIER_COST[i % 3] ?? GLYPH_TIER_COST[0];
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const clean = (s, n = 18) => String(s || '').replace(/[<>&]/g, '').slice(0, n).trim();

export default class ArenaRoom extends Actor {
  static options = { hibernate: false };

  lobby = null;
  lastSnap = 0;
  lastSave = 0;
  lastWorldKey = '';

  // A wake (deploy, idle, hibernation) clears instance fields: rebuild the match.
  async handleStart() {
    const saved = await this.storage.get('lobby');
    if (!saved || !saved.id) return;
    this.lobby = saved;
    if (!this.lobby.snapshot) bakeSnapshot(this.lobby);
    // Sockets stay attached across a wake: everyone still connected keeps their
    // seat, so refresh their liveness or the sim would drop them as idle.
    const live = new Set(this.getConnections().map((c) => c.id));
    for (const p of this.lobby.players || []) {
      if (live.has(p.id)) p.lastSeen = now();
    }
    if (this.lobby.hostId && !(this.lobby.players || []).some((p) => p.id === this.lobby.hostId) && this.lobby.players?.length) {
      this.lobby.hostId = this.lobby.players[0].id;
    }
  }

  // ---- public servers -----------------------------------------------------
  // The platform's managed ticker keeps a public room playing around the
  // clock: while the lobby is a public server the room steps itself even with
  // nobody connected, and it sleeps (no compute) the moment that stops. The
  // bots keep fighting, talking and swapping identity, so whoever types the
  // code walks into a match that never stopped.
  tickIntervalMs = 1000;

  shouldTick() {
    if (!this.lobby) return false;
    // A duel queue only needs waking while somebody is actually waiting.
    if (this.lobby.queue) return (this.lobby.waiting || []).length > 0;
    return !!this.lobby.public;
  }

  async handleTick() {
    const lobby = this.lobby;
    if (!lobby) return;
    if (lobby.queue) { this.queueTick(); return; }
    if (!lobby.public) return;
    if (!this.getConnections().length) {
      try { publicIdle(lobby); } catch (e) {}
    }
    advance(lobby);
    this.push(null, false);
    this.maybeSave();
  }

  handleConnect(conn) {
    conn.send({ type: 'ready' });
  }

  async handleMessage(conn, msg) {
    if (typeof msg !== 'object' || msg === null) return;
    const type = String(msg.type || '');

    if (type === 'hello') {
      this.hello(conn, msg);
      return;
    }

    const lobby = this.lobby;
    if (!lobby) return;
    const player = lobby.players.find((p) => p.id === conn.id);
    if (!player) return;

    switch (type) {
      case 'input':
        this.applyInput(lobby, player, conn.id, msg);
        break;
      case 'shoot':
        this.applyShots(lobby, player, conn.id, Array.isArray(msg.shots) ? msg.shots : [msg]);
        break;
      case 'hit':
        this.applyHit(lobby, player, conn.id, msg);
        break;
      case 'chat': {
        const text = clean(msg.text, 140);
        if (text) {
          // Rank level as reported by the sender, so chat can show its badge.
          const rank = Math.max(0, Math.min(5000, Number(msg.rank) || 0));
          lobby.chat = lobby.chat || [];
          lobby.chat.push({ t: now(), id: conn.id, name: player.name, text, rank });
          if (lobby.chat.length > 60) lobby.chat = lobby.chat.slice(-60);
        }
        break;
      }
      case 'setLevel': {
        // Only the host picks the map, and only before the match starts.
        if (lobby.hostId !== conn.id || lobby.started) break;
        const lvl = Number.isInteger(msg.levelId) ? msg.levelId : null;
        if (lvl == null || lobby.levelId === lvl) break;
        lobby.levelId = lvl;
        lobby.mapSeed = Math.floor(Math.random() * 2147483647);
        lobby.world = null;
        ensureWorldGenerated(lobby);
        lobby.chestVer = (lobby.chestVer || 0) + 1;
        break;
      }
      case 'setMode': {
        if (lobby.hostId !== conn.id || lobby.started) break;
        const mode = String(msg.mode || '').toLowerCase();
        if (!DUEL_MODES.includes(mode)) break;
        // Duels are 1v1: a lobby holding anyone else cannot host one.
        if (mode === 'duel' && lobby.players.length > DUEL_MAX_PLAYERS) break;
        // The host's bots choice travels with the mode pick.
        if (typeof msg.bots === 'boolean') lobby.botsEnabled = msg.bots;
        if (mode === lobby.mode) {
          if (lobby.botsEnabled === false) lobby.bots = [];
          break;
        }
        lobby.mode = mode;
        // A duel opens its setup table; every other mode leaves it behind.
        lobby.duel = mode === 'duel' ? makeDuelState() : null;
        if (mode === 'duel') {
          lobby.botsEnabled = false;
          lobby.bots = [];
          lobby.levelId = null;
          lobby.mapSeed = null;
          lobby.started = false;
        }
        lobby.winner = null;
        lobby.zone = null;
        lobby.round = 1;
        lobby.brNext = 0;
        lobby.enemies = [];
        lobby.spawnQueue = [];
        lobby.bullets = [];
        lobby.giants = [];
        lobby.golems = [];
        lobby.ctf = null;
        lobby.bots = [];
        lobby.world = null;
        lobby.worldKey = null;
        if (lobby.levelId != null) {
          ensureWorldGenerated(lobby);
          lobby.chestVer = (lobby.chestVer || 0) + 1;
        }
        let seat = 0;
        for (const p of lobby.players) {
          p.team = null;
          p.hp = p.hpMax ?? 100;
          p.respawnAt = 0;
          p.carrying = false;
          if (isTeamMode(mode)) p.team = seat++ % 2;
        }
        if (isTeamMode(mode)) fillTeamsWithBots(lobby);
        break;
      }
      case 'duelVote': {
        // Both fighters pick rounds and map; the room settles the terms and
        // opens the arena itself, so there is no host start to press.
        if (lobby.mode !== 'duel' || !lobby.duel) break;
        const settled = duelVote(lobby, conn.id, msg);
        if (settled && lobby.duel.phase === 'countdown') {
          lobby.levelId = lobby.duel.levelId;
          lobby.mapSeed = Math.floor(Math.random() * 2147483647);
          lobby.world = null;
          lobby.worldKey = null;
          ensureWorldGenerated(lobby);
          lobby.chestVer = (lobby.chestVer || 0) + 1;
          startGame(lobby);
        }
        break;
      }
      case 'start': {
        if (lobby.hostId !== conn.id || lobby.started) break;
        const lvl = Number.isInteger(msg.levelId) ? msg.levelId : null;
        if (lobby.levelId == null && lvl != null) {
          lobby.levelId = lvl;
          lobby.mapSeed = Math.floor(Math.random() * 2147483647);
        }
        ensureWorldGenerated(lobby);
        lobby.startTime = now();
        startGame(lobby);
        lobby.lastTick = now() - 50; // the first tick runs straight away
        break;
      }
      case 'setRespawn': {
        // The host decides whether a fallen player may come back into this match.
        if (lobby.hostId !== conn.id || lobby.started) break;
        lobby.respawn = !!msg.on;
        break;
      }
      case 'respawn': {
        // "Rise again": only when the host allowed it, and only from the floor.
        if (!lobby.respawn || !lobby.started) break;
        if ((player.hp ?? 1) > 0) break;
        player.hp = player.hpMax ?? 100;
        // Back on the field where it is quiet, with a moment of grace.
        safeSpawn(lobby, player);
        player.vx = 0;
        player.vy = 0;
        player.respawnAt = 0;
        player.carrying = false;
        break;
      }
      case 'setColor':
        if (Number.isInteger(msg.color) && msg.color >= 0 && msg.color < 7) player.color = msg.color;
        break;
      case 'setDesign':
        if (Number.isInteger(msg.design) && msg.design >= 0 && msg.design <= 14) player.design = msg.design;
        break;
      case 'setGuns': {
        const c = (v) => (Number.isInteger(v) && v >= -1 && v <= 4) ? v : null;
        player.guns = player.guns || { pistol: -1, rifle: -1, shotgun: -1 };
        if (msg.guns) {
          if (c(msg.guns.pistol) != null) player.guns.pistol = c(msg.guns.pistol);
          if (c(msg.guns.rifle) != null) player.guns.rifle = c(msg.guns.rifle);
          if (c(msg.guns.shotgun) != null) player.guns.shotgun = c(msg.guns.shotgun);
        }
        if (Number.isInteger(msg.guns?.weapon) && msg.guns.weapon >= 0 && msg.guns.weapon <= 2) player.weapon = msg.guns.weapon;
        break;
      }
      case 'chestOpen': {
        const ch = (lobby.world?.chests || []).find((c) => c.id === msg.chestId);
        if (!ch || ch.opened) break;
        const b = (lobby.world?.buildings || [])[ch.buildingIndex];
        if (!b || !b.inner) break;
        const inside = player.x >= b.inner.x && player.x <= b.inner.x + b.inner.w &&
          player.y >= b.inner.y && player.y <= b.inner.y + b.inner.h;
        if (lobby.wave > 1 && !inside) break;
        if (dist2(player.x, player.y, ch.x, ch.y) > ((ch.r ?? 16) + 16) ** 2) break;
        ch.opened = true;
        if (!ch.rarity) ch.rarity = 'common';
        const drops = rollChestDropsForServer(ch);
        ch.drops = drops;
        lobby.chestVer = (lobby.chestVer || 0) + 1;
        for (const d of drops) {
          if (d.type === 'essence') lobby.pickups.push({ x: d.x, y: d.y, r: 10, type: 'xp', v: d.value || 1, bornAt: now() });
          else lobby.pickups.push({ x: d.x, y: d.y, r: 14, type: d.type });
        }
        lobby.pickupVer = (lobby.pickupVer || 0) + 1;
        break;
      }
      case 'pickup': {
        // A drop was collected: take it off the floor and give this player the
        // same thing the client already showed, so loot works online.
        const px = Number(msg.x), py = Number(msg.y);
        if (!Number.isFinite(px) || !Number.isFinite(py)) break;
        const idx = (lobby.pickups || []).findIndex((pk) => pk && pk.type !== 'bossWarn' && pk.type !== 'bossTarget' && pk.type !== 'bossBoom' && dist2(pk.x, pk.y, px, py) < 70 * 70);
        if (idx < 0) break;
        const pk = lobby.pickups[idx];
        if (pk.type === 'health') player.hp = Math.min(player.hpMax ?? 100, (player.hp ?? 100) + 25);
        else if (pk.type === 'shield') player.shield = Math.min(100, (player.shield ?? 0) + 40);
        else if (pk.type === 'ammo') player.ammo = Math.min(999, (player.ammo ?? 0) + 24);
        else if (pk.type === 'speed') player.speedBoostT = 8;
        else if (pk.type === 'xp') player.essence = (player.essence || 0) + (pk.v || 1);
        lobby.pickups.splice(idx, 1);
        lobby.pickupVer = (lobby.pickupVer || 0) + 1;
        break;
      }
      case 'glyphPath':
        if (GLYPH_KEYS[msg.path] && player.glyphPath !== msg.path) {
          if (player.glyphPath) {
            player.glyphPath = msg.path;
          } else if ((player.essence || 0) >= GLYPH_COST_CORE) {
            player.essence -= GLYPH_COST_CORE;
            player.glyphPath = msg.path;
          }
          // Picking a path grants its starter node (ignite / static / soulTap /
          // drench / stone skin) exactly like the offline picker does.
          ensureStarter(player);
        }
        break;
      case 'glyphUnlock':
        if (GLYPH_KEYS[msg.path] && GLYPH_KEYS[msg.path].includes(msg.key)) {
          if (!player.glyph) player.glyph = makeGlyphState();
          const cost = glyphNodeCost(msg.path, msg.key);
          if (!player.glyph[msg.path][msg.key] && (player.essence || 0) >= cost) {
            player.essence -= cost;
            player.glyph[msg.path][msg.key] = true;
            onGlyphUnlock(player, msg.path, msg.key);
            if (GLYPH_KEYS[msg.path].every((k) => player.glyph[msg.path][k])) {
              player.completedGlyphs = player.completedGlyphs || {};
              player.completedGlyphs[msg.path] = true;
            }
          }
        }
        break;
      case 'utility': {
        // A utility was used. The client renders its own copy; the room is
        // responsible for the damage it deals and for telling everyone else
        // where the effect landed.
        const id = String(msg.id || '').slice(0, 32);
        const ux = Number(msg.x), uy = Number(msg.y);
        if (!Number.isFinite(ux) || !Number.isFinite(uy)) break;
        const rad = Math.max(20, Math.min(320, Number(msg.r) || 120));
        const dur = Math.max(0.2, Math.min(14, Number(msg.dur) || 6));
        // The field itself does the work: the simulation walks every active
        // utility each tick and applies its blast, venom, snare or vortex there
        // (tickUtilityFields), so a cloud ticks, a charge waits out its fuse and
        // a mine waits for a body — exactly as they do offline.
        lobby.utilityFx = Array.isArray(lobby.utilityFx) ? lobby.utilityFx : [];
        lobby.utilityFx.push({ id, x: Math.round(ux), y: Math.round(uy), r: rad, t0: now(), dur, owner: conn.id });
        if (lobby.utilityFx.length > 24) lobby.utilityFx = lobby.utilityFx.slice(-24);
        break;
      }
      case 'meleeFx': {
        // A melee strike (or a raised guard) is drawn by every other client,
        // so the room keeps the recent ones and passes them on in the snapshot.
        const mx = Number(msg.x), my = Number(msg.y);
        if (!Number.isFinite(mx) || !Number.isFinite(my)) break;
        lobby.meleeFx = Array.isArray(lobby.meleeFx) ? lobby.meleeFx : [];
        lobby.meleeFx.push({
          id: String(msg.id || '').slice(0, 32),
          x: Math.round(mx), y: Math.round(my),
          ang: Number(msg.ang) || 0,
          guard: !!msg.guard,
          t0: now(), owner: conn.id
        });
        if (lobby.meleeFx.length > 24) lobby.meleeFx = lobby.meleeFx.slice(-24);
        break;
      }
      case 'leave':
        this.dropPlayer(conn.id);
        break;
      default:
        break;
    }

    if (player) player.lastSeen = now();
    this.step();
  }

  async handleClose(conn) {
    // Leaving the duel queue is just leaving the queue.
    if (this.lobby && this.lobby.queue) {
      this.lobby.waiting = (this.lobby.waiting || []).filter((w) => w.id !== conn.id);
      return;
    }
    this.dropPlayer(conn.id);
    this.step();
  }

  // ---- duel matchmaking queue ---------------------------------------------
  // One shared room seats strangers: two waiting players are handed a room of
  // their own, and anyone still alone after ten seconds gets a bot.
  joinQueue(conn, msg) {
    if (!this.lobby || !this.lobby.queue) {
      this.lobby = {
        id: DUEL_QUEUE_ROOM, queue: true, mode: 'duel', hostId: null,
        waiting: [], players: [], chat: [], created: Date.now()
      };
    }
    const q = this.lobby;
    q.waiting = (q.waiting || []).filter((w) => w.id !== conn.id);
    q.waiting.push({ id: conn.id, name: clean(msg.name) || 'Player', at: Date.now() });
    conn.send({ type: 'queue', waiting: q.waiting.length });
    this.pairQueue();
  }

  queueTick() {
    const q = this.lobby;
    if (!q || !q.queue) return;
    const live = new Set(this.getConnections().map((c) => c.id));
    const t = Date.now();
    const keep = [];
    for (const w of q.waiting || []) {
      if (!live.has(w.id)) continue;
      if (t - w.at >= DUEL_QUEUE_WAIT_MS) {
        this.sendTo(w.id, { type: 'duelFound', room: duelRoomCode(), bot: true });
        continue;
      }
      keep.push(w);
    }
    q.waiting = keep;
    this.pairQueue();
  }

  pairQueue() {
    const q = this.lobby;
    if (!q || !q.queue) return;
    const live = new Set(this.getConnections().map((c) => c.id));
    q.waiting = (q.waiting || []).filter((w) => live.has(w.id));
    while ((q.waiting || []).length >= 2) {
      const a = q.waiting.shift();
      const b = q.waiting.shift();
      const room = duelRoomCode();
      this.sendTo(a.id, { type: 'duelFound', room, bot: false });
      this.sendTo(b.id, { type: 'duelFound', room, bot: false });
    }
  }

  sendTo(id, payload) {
    const conn = this.getConnections().find((c) => c.id === id);
    if (conn) conn.send(payload);
  }

  // ---- room lifecycle -----------------------------------------------------
  hello(conn, msg) {
    // Matchmaking for a random duel: this room only pairs people up, it does
    // not play the match itself.
    if (msg.queue) { this.joinQueue(conn, msg); return; }
    const wanted = String(msg.mode || 'pve');
    const mode = DUEL_MODES.includes(wanted) ? wanted : 'pve';
    // A public server is never missing: joining one by code opens it, even if
    // this is the first player to reach the room since it last woke.
    const pub = PUBLIC_MODES[String(msg.pub || '').toLowerCase()] ? String(msg.pub).toLowerCase() : null;
    if (pub) {
      if (!this.lobby) this.lobby = createLobby(pub, null);
      const pl = this.lobby;
      // A room that is not already a healthy server of this mode is taken over
      // and reset — so the code always lands on the running server, never on a
      // lobby somebody opened here earlier.
      const healthy = pl.public && pl.mode === pub && pl.levelId != null;
      if (!healthy) {
        try { adoptPublic(pl, pub); } catch (e) {}
      }
      // Whatever the server module managed, the room behaves as a public server:
      // no host, bots in it, and a match that starts on the next tick.
      pl.public = true;
      pl.custom = false;
      pl.hostId = null;
      pl.botsEnabled = true;
      pl.respawn = true;
      if (pl.levelId == null) pl.levelId = 1;
      if (pl.mapSeed == null) pl.mapSeed = Math.floor(Math.random() * 2147483647);
      // A free-for-all / battle royale server is a full room of players.
      if (pl.botCount == null) pl.botCount = publicBotCount(pub);
      if (!pl.started) {
        pl.startTime = Date.now() - 1000;
        pl.lastTick = Date.now() - 200;
      }
    }
    // Someone joining by code must not silently create a room: an unknown code
    // is reported back so the client can say the lobby does not exist.
    if (!this.lobby && msg.expectExisting === true) {
      conn.reject(4004, 'no such lobby');
      return;
    }
    if (!this.lobby) {
      this.lobby = createLobby(mode, conn.id);
      this.lobby.hostId = conn.id;
      this.lobby.custom = true;
      this.lobby.startTime = now() + 86400000; // only the host starts it
      // The host decides whether bots fill the match — in every mode.
      if (msg.bots === false) this.lobby.botsEnabled = false;
    }
    const lobby = this.lobby;
    let player = lobby.players.find((p) => p.id === conn.id);
    if (!player) {
      if (lobby.players.length >= MAX_PLAYERS) { conn.reject(4001, 'room full'); return; }
      player = addPlayer(lobby, conn.id, clean(msg.name) || 'Player');
    }
    if (clean(msg.name)) player.name = clean(msg.name);
    // Re-applied on every connect, so a room built with bots cannot keep them
    // once the host has picked "players only".
    if (lobby.hostId === conn.id && !lobby.started && typeof msg.bots === 'boolean') {
      lobby.botsEnabled = msg.bots;
      if (!msg.bots) lobby.bots = [];
    }
    // …and whether a fallen player may rejoin the same match.
    if (lobby.hostId === conn.id && !lobby.started && typeof msg.respawn === 'boolean') {
      lobby.respawn = msg.respawn;
    }
    // ---- duels: two fighters, and only ever two -------------------------
    if (lobby.mode === 'duel') {
      if (lobby.players.length > DUEL_MAX_PLAYERS) {
        // A third body turns the room back into a free-for-all, which is
        // exactly how duels are disabled in a crowded lobby.
        lobby.mode = 'pvp';
        lobby.duel = null;
        lobby.started = false;
      } else {
        if (!lobby.duel) lobby.duel = makeDuelState({ bot: !!msg.duelBot });
        if (msg.duelBot) lobby.duel.bot = true;
        // A matchmade duel against a bot starts straight away: there is nobody
        // on the other side to agree terms with.
        if (lobby.duel.bot && !lobby.started) this.startBotDuel(lobby);
      }
    }
    if (isTeamMode(lobby.mode)) {
      const pref = (msg.team === 0 || msg.team === 1) ? msg.team : null;
      if (player.team !== 0 && player.team !== 1) player.team = pickTeam(lobby, pref);
      fillTeamsWithBots(lobby);
    }
    // A public room belongs to nobody: no host, so no one can change its mode,
    // its map or start it on the others.
    if (!lobby.public && !lobby.hostId) lobby.hostId = conn.id;
    player.lastSeen = now();
    if (lobby.public) {
      try { publicJoin(lobby, player.name); } catch (e) {}
    }
    this.lastWorldKey = ''; // the joining client needs the map
    // The snapshot on hand was baked before this player existed: pushing it
    // as-is told the client it was not in the match, which it reads as death.
    // Bake one that has them in it before the seat is handed over.
    bakeSnapshot(lobby);
    conn.send({
      type: 'welcome',
      you: conn.id,
      isHost: lobby.hostId === conn.id,
      mode: lobby.mode,
      respawn: !!lobby.respawn,
      team: player.team ?? null,
      levelId: lobby.levelId ?? null,
      world: { w: lobby.world?.w || WORLD.w, h: lobby.world?.h || WORLD.h }
    });
    this.push(conn, true);
    this.broadcast(this.rosterMessage());
  }

  rosterMessage() {
    return {
      type: 'roster',
      players: (this.lobby?.players || []).map((p) => ({ id: p.id, name: p.name, team: p.team ?? null })),
      hostId: this.lobby?.hostId ?? null
    };
  }

  // A duel the queue could not fill: a bot takes the far corner and the match
  // begins without a setup table.
  startBotDuel(lobby) {
    if (lobby.levelId == null) lobby.levelId = 1 + ((Math.random() * 5) | 0);
    if (lobby.mapSeed == null) lobby.mapSeed = Math.floor(Math.random() * 2147483647);
    lobby.world = null;
    lobby.worldKey = null;
    lobby.bots = [];
    lobby.botsEnabled = true;
    lobby.botCount = 1;
    lobby.duel.levelId = lobby.levelId;
    lobby.duel.rounds = 3;
    lobby.duel.agreed = true;
    ensureWorldGenerated(lobby);
    startGame(lobby);
  }

  dropPlayer(id) {
    if (!this.lobby) return;
    removePlayer(this.lobby, id);
    if (!this.lobby.public && this.lobby.hostId === id) {
      const next = this.lobby.players[0] || null;
      this.lobby.hostId = next ? next.id : null;
    }
    this.broadcast(this.rosterMessage());
  }

  step() {
    if (!this.lobby) return;
    advance(this.lobby);
    this.push(null, false);
    this.maybeSave();
  }

  maybeSave() {
    const t = Date.now();
    if (t - this.lastSave < SAVE_MS) return;
    this.lastSave = t;
    const { snapshot, ...rest } = this.lobby;
    this.storage.put('lobby', rest);
  }

  // The map is the only large payload: it travels once per client whenever its
  // key changes, everything else rides every snapshot.
  push(conn, force) {
    const lobby = this.lobby;
    if (!lobby) return;
    const t = Date.now();
    if (!force && t - this.lastSnap < SNAP_MS) return;
    this.lastSnap = t;

    const keyNow = `${lobby.worldKey ?? ''}:${lobby.chestVer ?? 0}`;
    const sendWorld = force || keyNow !== this.lastWorldKey;
    if (sendWorld) this.lastWorldKey = keyNow;

    const snap = JSON.parse(JSON.stringify(lobby.snapshot || {}));
    // Kill records ride one broadcast only: every client plays the finisher and
    // posts the kill-feed tab, then the record is gone. A player joining later
    // never receives the deaths of the match so far.
    snap.kills = (!conn && lobby.kills && lobby.kills.length) ? lobby.kills.splice(0) : [];
    snap.type = 'snap';
    snap.world = sendWorld ? lobby.world : null;
    snap.wk = keyNow;
    snap.chat = Array.isArray(lobby.chat) ? lobby.chat : [];
    snap.meta = {
      ...(snap.meta || {}),
      lobbyId: lobby.id,
      started: !!lobby.started,
      hostId: lobby.hostId ?? null,
      isHost: lobby.hostId === conn?.id,
      custom: !!lobby.custom,
      mode: lobby.mode,
      respawn: !!lobby.respawn,
      levelId: lobby.levelId ?? null
    };
    if (conn) conn.send(snap);
    else this.broadcast(snap);
  }

  // ---- input / combat -----------------------------------------------------
  applyInput(lobby, player, peerId, input) {
    if (!input) return;
    // The client also pings with an empty frame so the match keeps stepping
    // while a player stands still — that must not clear their input.
    const hasPos = typeof input.x === 'number' && typeof input.y === 'number';
    if (!hasPos && typeof input.ang !== 'number') return;
    if (typeof input.ang === 'number') player.ang = input.ang;
    // The reported position is deliberately NOT written here. It is applied by
    // the simulation (advance), where every step is checked against the arena's
    // walls; writing it first made that check compare the new spot with itself,
    // so it always passed and players could walk through buildings.
    if (Number.isInteger(input.weapon) && input.weapon >= 0 && input.weapon <= 2) player.weapon = input.weapon;
    // The floor the player is standing on, so shots can be checked vertically.
    if (Number.isFinite(Number(input.z))) player.z = Math.max(0, Math.min(1000, Number(input.z)));
    lobby.inputs = lobby.inputs || {};
    lobby.inputs[peerId] = { ix: input.ix, iy: input.iy, ang: input.ang, x: input.x, y: input.y, weapon: input.weapon, z: input.z };
  }

  applyShots(lobby, player, peerId, shots) {
    if (!shots.length || (player.hp ?? 1) <= 0) return;
    for (const s of shots.slice(0, 12)) {
      const ang = Number(s?.ang), sx = Number(s?.x), sy = Number(s?.y);
      if (!Number.isFinite(ang) || !Number.isFinite(sx) || !Number.isFinite(sy)) continue;
      const speed = Math.min(1400, Number(s?.speed) || 800);
      const dmg = Math.min(80, Number(s?.dmg) || 12);
      // Height of the muzzle and the vertical speed the aim gave it, so a shot
      // fired upward really travels upward (and misses what it passes over).
      const hasZ = Number.isFinite(Number(s?.z));
      const z = hasZ ? Number(s.z) : undefined;
      const vz = Number.isFinite(Number(s?.vz)) ? Number(s.vz) : 0;
      // The weapon the shot came from, so a kill can name it in the kill feed.
      const wname = typeof s?.w === 'string' ? s.w.replace(/[<>&]/g, '').slice(0, 24) : '';
      // The key-holder's revolver drops a player where they stand: its 34 damage
      // alone would never do it, so the round is marked lethal.
      const oneShot = !!s?.one && /revolver/i.test(wname);
      // The projectile's own kind travels with the bullet, so every other client
      // draws the real thing (a flamethrower shot is a rolling fireball).
      const wkind = bulletKind(wname);
      lobby.bullets.push({
        owner: peerId, team: player.team ?? null, ...(wname ? { w: wname } : null), ...(oneShot ? { one: true } : null),
        ...(wkind ? { kind: wkind } : null), x: sx, y: sy,
        vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        ...(hasZ ? { z, vz, z0: z } : null),
        r: 4, dmg, life: 1.2
      });
    }
    player.lastShotAt = now();
  }

  applyHit(lobby, player, peerId, body) {
    if ((player.hp ?? 1) <= 0) return;
    // Duels are fought with blades as much as guns, so the pit is included.
    if ((lobby.mode === 'pvp' || lobby.mode === 'br' || lobby.mode === 'duel' || isTeamMode(lobby.mode)) && body.kind === 'melee') {
      const victim = lobby.players.find((p) => p.id === body.target);
      const friendly = isTeamMode(lobby.mode) && victim && victim.team === player.team;
      // The swing is judged from where the client says it landed as well as
      // from where the room has the two bodies: the room's copy of a running
      // player is a few frames behind, and a blade that plainly connected in
      // front of the attacker's eyes must not be thrown away for it.
      const hx = Number(body.x), hy = Number(body.y);
      const hasHit = Number.isFinite(hx) && Number.isFinite(hy);
      const inReach = (o) => !!o && (
        dist2(player.x, player.y, o.x, o.y) <= 300 * 300 ||
        (hasHit && dist2(hx, hy, o.x, o.y) <= 280 * 280)
      );
      if (victim && peerId !== body.target && !friendly && inReach(victim)) {
        const dmg = clamp(Number(body.dmg) || 0, 0, 60);
        victim._hitBy = { id: peerId, weapon: 'Melee' };
        victim.hp = Math.max(0, (victim.hp ?? 100) - dmg);
        if (victim.hp <= 0 && !victim.respawnAt) victim.respawnAt = now() + 4000;
      }
      // A bot is a body in the room like any other: a swing that reaches one
      // cuts it down. A player's blade lands for everything it says — only a
      // bot's own blow is softened, so duels between regulars last.
      const bot = (lobby.bots || []).find((b) => b && b.id === body.target && (b.hp ?? 0) > 0);
      if (bot && !(isTeamMode(lobby.mode) && bot.team != null && bot.team === player.team) &&
          inReach(bot)) {
        const dmg = clamp(Number(body.dmg) || 0, 0, 60);
        bot.hp = Math.max(0, (bot.hp ?? 100) - dmg);
        bot._shotAt = now();
        if (bot.hp <= 0 && lobby.mode !== 'br') bot.respawnAt = now() + 5000;
      }
      return;
    }
    if (lobby.mode === 'pve' && body.target === 'enemy' && body.kind === 'melee') {
      const hx = Number(body.x), hy = Number(body.y);
      const dmg = clamp(Number(body.dmg) || 0, 0, 80);
      let best = -1, bestD2 = 80 * 80;
      for (let i = 0; i < lobby.enemies.length; i++) {
        const d = dist2(hx, hy, lobby.enemies[i].x, lobby.enemies[i].y);
        if (d < bestD2) { bestD2 = d; best = i; }
      }
      if (best >= 0) {
        const en = lobby.enemies[best];
        applyGlyphHit(lobby, player, en, dmg, 'melee');
        if (en.hp <= 0) {
          applyGlyphKill(lobby, en, peerId);
          awardPvEPoint(lobby, peerId, en.type);
          spawnXpOrbs(lobby, en.x, en.y, Math.max(1, pvePointsForType(en.type)));
          lobby.enemies.splice(best, 1);
        }
      }
    }
  }
}