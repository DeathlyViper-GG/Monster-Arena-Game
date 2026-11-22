import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import {
  WORLD, now, clamp, dist2, makeId, GLYPH_KEYS,
  createLobby, addPlayer, removePlayer, startGame, advance, bakeSnapshot,
  ensureWorldGenerated, rollChestDropsForServer,
  spawnXpOrbs, pvePointsForType, awardPvEPoint
} from "./gameSim.ts";
import { makeGlyphState, applyGlyphHit, applyGlyphKill, ensureStarter } from "./glyph.ts";
import { isTeamMode, pickTeam, fillTeamsWithBots } from "./teams.ts";

// Monster Arena — anonymous-friendly authoritative multiplayer server.
// Full simulation ported from the original signaling_http.js (see gameSim.ts).
// Lobbies persist in the Lobby entity's `state` field; the sim advances in
// fixed 50ms steps on every request.

const LOBBY_RE = /^[a-z0-9]{4,10}$/i;
const PEER_RE = /^[a-z0-9_-]{4,48}$/i;
const validLobby = (s) => typeof s === "string" && LOBBY_RE.test(s);
const validPeer = (s) => typeof s === "string" && PEER_RE.test(s);
const sanitizeName = (s) => String(s || "").replace(/[<>&]/g, "").slice(0, 18).trim();
// Glyph prices, matching the upgrade screen: core/T1 = 5, T2 = 10, T3 = 20.
const GLYPH_COST_CORE = 5;
const GLYPH_TIER_COST = [5, 10, 20];
const glyphNodeCost = (path, key) => {
  const keys = GLYPH_KEYS[path] || [];
  const i = keys.indexOf(key);
  return i < 0 ? GLYPH_TIER_COST[0] : (GLYPH_TIER_COST[i % 3] ?? GLYPH_TIER_COST[0]);
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch { /* anonymous ok */ }

    const body = await req.json().catch(() => ({}));
    const op = String(body.op || "");

    const peerId = user ? user.id : (validPeer(body.peerId) ? body.peerId : makeId(8));
    const name = sanitizeName(user?.full_name || body.name || body.nickname) || ("Player" + peerId.slice(0, 4));

    const db = base44.asServiceRole.entities.Lobby;

    // ---- global chat: one channel every player in the game shares ----
    // Anonymous players have no entity access, so it lives on a dedicated
    // lobby row ("GLOBAL") that matchmaking never picks up (custom + started).
    if (op === "globalchat") {
      const { items } = await db.filter({ lobbyId: "GLOBAL" }, { limit: 1 });
      const rec = items[0] || null;
      const state = rec && rec.state && typeof rec.state === "object" ? rec.state : {};
      let chat = Array.isArray(state.globalChat) ? state.globalChat : [];
      const text = String(body.text || "").replace(/[<>]/g, "").slice(0, 200).trim();
      // Rank level as reported by the sender, so every chat line can show its badge.
      const rank = Math.max(0, Math.min(5000, Number(body.rank) || 0));
      const last = chat[chat.length - 1];
      // One message per person per second, and a capped history.
      if (text && !(last && last.id === peerId && now() - last.t < 1000)) {
        chat = chat.concat([{ t: now(), id: peerId, name, text, rank }]).slice(-120);
        if (rec?.id) await db.update(rec.id, { state: { ...state, globalChat: chat } });
        else
          await db.create({
            lobbyId: "GLOBAL",
            mode: "pve",
            hostId: "system",
            state: { globalChat: chat, custom: true, started: true, startTime: 0, players: [], bots: [] }
          });
      }
      return Response.json({ ok: true, chat });
    }

    // Diagnostics: shows whether this instance is holding lobbies in memory.
    if (op === "diag") {
      globalThis.__DIAG_HITS = (globalThis.__DIAG_HITS || 0) + 1;
      return Response.json({ cached: ROW_IDS.size, hits: globalThis.__DIAG_HITS, at: now() });
    }

    // ---- join / create ----
    if (op === "join") {
      const rawMode = String(body.mode || "").toLowerCase();
      const mode = rawMode === "pvp" ? "pvp" : rawMode === "teams" ? "teams" : rawMode === "ctf" ? "ctf" : "pve";
      let lobby;
      if (validLobby(body.lobbyId)) {
        const { items } = await db.filter({ lobbyId: body.lobbyId }, { limit: 1 });
        if (items.length === 0) return Response.json({ ok: false, error: "Lobby not found" }, { status: 404 });
        // Through the cache: joining must land on the live copy of the lobby,
        // not a stored version the running instance will overwrite.
        lobby = await loadLobby(db, body.lobbyId);
        if (!lobby) return Response.json({ ok: false, error: "Lobby not found" }, { status: 404 });
      } else if (body.create === true) {
        // Host flow: a brand new lobby reachable only by its code. It never
        // auto-starts — the host presses Start.
        lobby = createLobby(mode, peerId);
        lobby.hostId = peerId;
        lobby.custom = true;
        lobby.startTime = now() + 86400000;
        const rec = await db.create({ lobbyId: lobby.id, mode, hostId: peerId, state: lobby });
        if (rec?.id) ROW_IDS.set(String(lobby.id), rec.id);
      } else {
        // matchmaking: reuse a recent open lobby of the same mode, else create
        const { items } = await db.filter({ mode }, { sort: "-created_date", limit: 20 });
        const found = items.find((r) => r.state && !r.state.started && !r.state.custom && now() < (r.state.startTime || 0));
        if (found) {
          lobby = await loadLobby(db, found.lobbyId);
        }
        if (!lobby) {
          lobby = createLobby(mode, peerId);
          const rec = await db.create({ lobbyId: lobby.id, mode, hostId: peerId, state: lobby });
          if (rec?.id) ROW_IDS.set(String(lobby.id), rec.id);
        }
      }
      // The host's choice: players only, or bots filling the empty slots.
      // Honoured in every mode, and re-applied when the host reconnects, so a
      // lobby that was built with bots cannot keep them after a "players only"
      // pick.
      if (body.bots === false && lobby.hostId === peerId && !lobby.started) lobby.botsEnabled = false;
      const joined = addPlayer(lobby, peerId, name);
      if (!lobby.hostId) lobby.hostId = peerId;
      // Teams / CTF: seat the player on the side they asked for (same side as
      // a friend = team up, opposite sides = fight each other), then top the
      // roster up with bots so both sides are always full.
      if (isTeamMode(lobby.mode)) {
        const pref = (body.team === 0 || body.team === 1) ? body.team : null;
        if (lobby.started) {
          joined.team = pref != null && lobby.players.filter((p) => p.team === pref).length < 10 ? pref : pickTeam(lobby, pref);
        } else {
          joined.team = pickTeam(lobby, pref);
        }
        fillTeamsWithBots(lobby);
      }
      bakeSnapshot(lobby);
      await saveLobby(db, lobby);
      return Response.json({
        lobbyId: lobby.id, peerId, mode, name,
        startTime: lobby.startTime,
        world: { w: lobby.world?.w || WORLD.w, h: lobby.world?.h || WORLD.h },
        levelId: lobby.levelId, mapSeed: lobby.mapSeed,
        worldKey: lobby.worldKey, isHost: lobby.hostId === peerId,
        team: joined.team ?? null
      });
    }

    if (!validLobby(body.lobbyId)) return Response.json({ ok: false, error: "Bad lobby id" }, { status: 400 });
    const lobby = await loadLobby(db, body.lobbyId);
    if (!lobby) return Response.json({ ok: false, error: "Lobby not found" }, { status: 404 });
    const player = lobby.players.find((p) => p.id === peerId);

    switch (op) {
      case "poll": {
        if (player) player.lastSeen = now();
        // Movement and this frame's shots ride the poll, so one request does
        // everything the player did instead of three separate ones.
        applyInput(player, lobby, peerId, body.input);
        applyShots(lobby, player, peerId, body.shots);
        const ticked = advance(lobby).steps > 0;
        // Only write the lobby when the world actually moved on.
        if (ticked) await saveLobby(db, lobby);
        const since = Number(body.since || 0);
        const clientWK = String(body.worldKey ?? "");
        const keyNow = `${lobby.worldKey ?? ""}:${lobby.chestVer ?? 0}`;
        if (lobby.snapshot.t > since) {
          const snap = JSON.parse(JSON.stringify(lobby.snapshot));
          snap.world = (since === 0 || clientWK !== keyNow) ? lobby.world : null;
          // The key the map is at, so the client can tell us it already has it.
          snap.wk = keyNow;
          snap.chat = Array.isArray(lobby.chat) ? lobby.chat : [];
          // lobby identity for the code-based menu (who hosts, has it started)
          snap.meta = {
            ...(snap.meta || {}),
            lobbyId: lobby.id,
            started: !!lobby.started,
            hostId: lobby.hostId ?? null,
            isHost: lobby.hostId === peerId,
            custom: !!lobby.custom
          };
          return Response.json(snap);
        }
        return Response.json({ t: lobby.snapshot.t, noChange: true });
      }

      case "input": {
        if (!player) return Response.json({ ok: false, error: "Not in lobby" }, { status: 403 });
        applyInput(player, lobby, peerId, body);
        player.lastSeen = now();
        advance(lobby);
        await saveLobby(db, lobby);
        return Response.json(lobby.snapshot);
      }

      case "shoot": {
        if (!player) return Response.json({ ok: false, error: "Not in lobby" }, { status: 403 });
        // A downed player cannot fire: the respawn screen holds them until the
        // lobby revives them.
        if ((player.hp ?? 1) <= 0) return Response.json({ ok: true, snapshot: lobby.snapshot });
        applyShots(lobby, player, peerId, Array.isArray(body.shots) ? body.shots : [body]);
        player.lastShotAt = now();
        player.lastSeen = now();
        advance(lobby);
        await saveLobby(db, lobby);
        return Response.json({ ok: true, snapshot: lobby.snapshot });
      }

      case "hit": {
        if (!player) return Response.json({ ok: false, error: "Not in lobby" }, { status: 403 });
        if ((player.hp ?? 1) <= 0) return Response.json({ ok: true, snapshot: lobby.snapshot });
        if ((lobby.mode === "pvp" || isTeamMode(lobby.mode)) && body.kind === "melee") {
          const victim = lobby.players.find((p) => p.id === body.target);
          const friendly = isTeamMode(lobby.mode) && victim && victim.team === player.team;
          if (victim && peerId !== body.target && !friendly) {
            const RANGE = 120;
            if (dist2(player.x, player.y, victim.x, victim.y) <= (RANGE + 16) * (RANGE + 16)) {
              let dd = Math.max(0, Math.min(60, Number(body.dmg) || 0));
              victim.hp = (victim.hp ?? 100) - dd;
              if (victim.hp < 0) victim.hp = 0;
              if (victim.hp <= 0 && !victim.respawnAt) victim.respawnAt = now() + 4000;
            }
          }
        } else if (lobby.mode === "pve" && body.target === "enemy" && body.kind === "melee") {
          const hx = Number(body.x), hy = Number(body.y);
          let dd = Math.max(0, Math.min(80, Number(body.dmg) || 0));
          let best = -1, bestD2 = 80 * 80;
          for (let i = 0; i < lobby.enemies.length; i++) {
            const d2 = dist2(hx, hy, lobby.enemies[i].x, lobby.enemies[i].y);
            if (d2 < bestD2) { bestD2 = d2; best = i; }
          }
          if (best >= 0) {
            const en = lobby.enemies[best];
            applyGlyphHit(lobby, player, en, dd, "melee");
            if (en.hp <= 0) {
              applyGlyphKill(lobby, en, peerId);
              awardPvEPoint(lobby, peerId, en.type);
              spawnXpOrbs(lobby, en.x, en.y, Math.max(1, pvePointsForType(en.type)));
              lobby.enemies.splice(best, 1);
            }
          }
        }
        player.lastSeen = now();
        advance(lobby);
        await saveLobby(db, lobby);
        return Response.json({ ok: true, snapshot: lobby.snapshot });
      }

      case "setMode": {
        // Only the host chooses the mode, and only before the match starts —
        // this is what makes the lobby actually play Teams / CTF.
        if (lobby.hostId && lobby.hostId !== peerId) return Response.json({ ok: false, error: "Only the host can change the mode" }, { status: 403 });
        if (lobby.started) return Response.json({ ok: false, error: "Already started" }, { status: 409 });
        const wantMode = String(body.mode || "").toLowerCase();
        if (!["pve", "pvp", "teams", "ctf"].includes(wantMode)) return Response.json({ ok: false, error: "Bad mode" }, { status: 400 });
        // The host's bots choice travels with the mode pick.
        if (typeof body.bots === "boolean") lobby.botsEnabled = body.bots;
        if (wantMode === lobby.mode && lobby.botsEnabled === false) lobby.bots = [];
        if (wantMode !== lobby.mode) {
          lobby.mode = wantMode;
          // Wipe the previous mode's state so the new one starts clean.
          lobby.winner = null;
          lobby.enemies = [];
          lobby.spawnQueue = [];
          lobby.bullets = [];
          lobby.giants = null;
          lobby.golems = [];
          lobby.ctf = null;
          lobby.bots = [];
          // The arena doubles for PvP / Teams / CTF, so the map is rebuilt for
          // the newly chosen mode instead of keeping the old size.
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
            if (isTeamMode(wantMode)) p.team = seat++ % 2;
          }
          if (isTeamMode(wantMode)) fillTeamsWithBots(lobby);
          if (lobby.snapshot) {
            lobby.snapshot.mode = wantMode;
            delete lobby.snapshot.teams;
            delete lobby.snapshot.ctf;
            if (lobby.snapshot.meta) lobby.snapshot.meta.mode = wantMode;
          }
        }
        break;
      }

      case "start": {
        if (lobby.hostId !== peerId) return Response.json({ ok: false, error: "Only host can start" }, { status: 403 });
        if (lobby.started) return Response.json({ ok: true, snapshot: lobby.snapshot });
        // The host launches the map they picked (or a default one) for everyone.
        const startLvl = Number.isInteger(body.levelId) ? body.levelId : null;
        if (lobby.levelId == null && startLvl != null) {
          lobby.levelId = startLvl;
          lobby.mapSeed = Math.floor(Math.random() * 2147483647);
        }
        ensureWorldGenerated(lobby);
        lobby.startTime = now();
        startGame(lobby);
        lobby.lastTick = now() - 50; // the first tick runs straight away
        advance(lobby);
        await saveLobby(db, lobby);
        return Response.json({ ok: true, snapshot: lobby.snapshot });
      }

      case "setColor":
        if (player && Number.isInteger(body.color) && body.color >= 0 && body.color < 7) player.color = body.color;
        break;
      case "setGuns": {
        if (!player) break;
        const c = (v) => (Number.isInteger(v) && v >= -1 && v <= 4) ? v : null;
        player.guns = player.guns || { pistol: -1, rifle: -1, shotgun: -1 };
        if (c(body.guns?.pistol) != null) player.guns.pistol = c(body.guns.pistol);
        if (c(body.guns?.rifle) != null) player.guns.rifle = c(body.guns.rifle);
        if (c(body.guns?.shotgun) != null) player.guns.shotgun = c(body.guns.shotgun);
        if (Number.isInteger(body.guns?.weapon) && body.guns.weapon >= 0 && body.guns.weapon <= 2) player.weapon = body.guns.weapon;
        break;
      }
      case "setDesign":
        if (player && Number.isInteger(body.design) && body.design >= 0 && body.design <= 14) player.design = body.design;
        break;
      case "setLevel": {
        // Only the host picks the map — everyone drops into the host's choice.
        if (lobby.hostId !== peerId) break;
        if (lobby.started) return Response.json({ ok: false, error: "Already started" }, { status: 409 });
        const lvl = Number.isInteger(body.levelId) ? body.levelId : null;
        if (lobby.levelId == null && lvl != null) {
          lobby.levelId = lvl;
          lobby.mapSeed = Math.floor(Math.random() * 2147483647);
          ensureWorldGenerated(lobby);
        } else if (lobby.levelId !== lvl && lvl != null) {
          lobby.levelId = lvl;
          lobby.mapSeed = Math.floor(Math.random() * 2147483647);
          lobby.world = null;
          ensureWorldGenerated(lobby);
          lobby.chestVer = (lobby.chestVer || 0) + 1;
        }
        break;
      }
      case "glyphPath":
        if (player && GLYPH_KEYS[body.path]) {
          if (!player.glyphPath || player.glyphPath !== body.path) {
            if ((player.essence || 0) < GLYPH_COST_CORE) return Response.json({ ok: false, error: "not enough essence" });
            player.essence -= GLYPH_COST_CORE;
          }
          player.glyphPath = body.path;
          // Picking a path grants its starter node (ignite / static / soulTap /
          // drench / stone skin) exactly like the offline picker does.
          ensureStarter(player);
        }
        break;
      case "glyphUnlock":
        if (player && GLYPH_KEYS[body.path] && GLYPH_KEYS[body.path].includes(body.key)) {
          if (!player.glyph) player.glyph = makeGlyphState();
          if (player.glyph[body.path][body.key]) return Response.json({ ok: true, essence: player.essence });
          const cost = glyphNodeCost(body.path, body.key);
          if ((player.essence || 0) < cost) return Response.json({ ok: false, error: "not enough essence" });
          player.essence -= cost;
          player.glyph[body.path][body.key] = true;
          if (body.path === "earth" && body.key === "bulwark") {
            player.hpMax = Math.min(220, (player.hpMax ?? 100) + 25);
            player.hp = Math.min(player.hpMax, (player.hp ?? 100) + 25);
          }
          if (GLYPH_KEYS[body.path].every((k) => player.glyph[body.path][k])) {
            player.completedGlyphs = player.completedGlyphs || {};
            player.completedGlyphs[body.path] = true;
          }
        }
        break;
      case "chestOpen": {
        if (!player) return Response.json({ ok: false, error: "Not in lobby" }, { status: 403 });
        const ch = (lobby.world?.chests || []).find((c) => c.id === body.chestId);
        if (!ch || ch.opened) return Response.json({ ok: false });
        const b = (lobby.world?.buildings || [])[ch.buildingIndex];
        if (!b || !b.inner) return Response.json({ ok: false });
        const inside = player.x >= b.inner.x && player.x <= b.inner.x + b.inner.w && player.y >= b.inner.y && player.y <= b.inner.y + b.inner.h;
        if (lobby.wave > 1 && !inside) return Response.json({ ok: false });
        if (dist2(player.x, player.y, ch.x, ch.y) > ((ch.r ?? 16) + 16) ** 2) return Response.json({ ok: false });
        ch.opened = true;
        if (!ch.rarity) ch.rarity = "common";
        const drops = rollChestDropsForServer(ch);
        ch.drops = drops;
        lobby.chestVer = (lobby.chestVer || 0) + 1;
        for (const d of drops) {
          if (d.type === "essence") lobby.pickups.push({ x: d.x, y: d.y, r: 10, type: "xp", v: d.value || 1, bornAt: now() });
          else lobby.pickups.push({ x: d.x, y: d.y, r: 14, type: d.type });
        }
        lobby.pickupVer = (lobby.pickupVer || 0) + 1;
        break;
      }
      case "chat": {
        // Lobby / in-match chat. Anonymous players have no entity access, so
        // messages ride the authoritative lobby state the poll already returns.
        const text = String(body.text || "").replace(/[<>]/g, "").slice(0, 140).trim();
        if (text) {
          const rank = Math.max(0, Math.min(5000, Number(body.rank) || 0));
          if (!Array.isArray(lobby.chat)) lobby.chat = [];
          lobby.chat.push({ t: now(), id: peerId, name: player?.name || name, text, rank });
          if (lobby.chat.length > 60) lobby.chat = lobby.chat.slice(-60);
        }
        break;
      }
      case "utility": {
        // Damage-dealing utilities are resolved here; the effect itself is
        // broadcast so every client draws it where it landed.
        const id = String(body.id || "").slice(0, 32);
        const ux = Number(body.x), uy = Number(body.y);
        if (!Number.isFinite(ux) || !Number.isFinite(uy)) break;
        const rad = Math.max(20, Math.min(320, Number(body.r) || 120));
        const dur = Math.max(0.2, Math.min(14, Number(body.dur) || 6));
        const dmg = id === "breach_charge" ? 62 : id === "viper_fang" ? 18 : id === "shock_mine" ? 18 : 0;
        if (dmg > 0) {
          if (lobby.mode === "pve") {
            for (const en of lobby.enemies || []) {
              if (!en || en.hp <= 0) continue;
              if (dist2(ux, uy, en.x, en.y) > (rad + (en.r || 16)) ** 2) continue;
              en.hp = Math.max(0, en.hp - dmg);
            }
          } else {
            for (const other of lobby.players) {
              if (other.id === peerId || (other.hp ?? 1) <= 0) continue;
              if (isTeamMode(lobby.mode) && other.team === player.team) continue;
              if (dist2(ux, uy, other.x, other.y) > (rad + 16) ** 2) continue;
              other.hp = Math.max(0, (other.hp ?? 100) - dmg);
              other._hitBy = { id: peerId, weapon: id.replace(/_/g, " ") };
              if (other.hp <= 0 && !other.respawnAt) other.respawnAt = now() + 4000;
            }
          }
        }
        lobby.utilityFx = Array.isArray(lobby.utilityFx) ? lobby.utilityFx : [];
        lobby.utilityFx.push({ id, x: Math.round(ux), y: Math.round(uy), r: rad, t0: now(), dur, owner: peerId });
        if (lobby.utilityFx.length > 24) lobby.utilityFx = lobby.utilityFx.slice(-24);
        break;
      }
      case "meleeFx": {
        // Melee strikes and guards are drawn by every other client, so the
        // lobby keeps the recent ones and hands them out with the snapshot.
        const mx = Number(body.x), my = Number(body.y);
        if (!Number.isFinite(mx) || !Number.isFinite(my)) break;
        lobby.meleeFx = Array.isArray(lobby.meleeFx) ? lobby.meleeFx : [];
        lobby.meleeFx.push({
          id: String(body.id || "").slice(0, 32),
          x: Math.round(mx), y: Math.round(my),
          ang: Number(body.ang) || 0,
          guard: !!body.guard,
          t0: now(), owner: peerId
        });
        if (lobby.meleeFx.length > 24) lobby.meleeFx = lobby.meleeFx.slice(-24);
        break;
      }
      case "leave":
        removePlayer(lobby, peerId);
        // The creator left: hand the lobby to the next player so it can still start.
        if (lobby.hostId === peerId) {
          const next = (lobby.players || [])[0] || null;
          lobby.hostId = next ? next.id : null;
        }
        break;
      case "setWorld":
        break; // world is server-generated
      default:
        return Response.json({ ok: false, error: "Unknown op: " + op }, { status: 400 });
    }

    if (player) player.lastSeen = now();
    advance(lobby);
    await saveLobby(db, lobby);
    // `mode` rides along so the client can settle its mode flags from the
    // authoritative lobby rather than its own last menu choice.
    return Response.json({ ok: true, mode: lobby.mode, snapshot: lobby.snapshot });
  } catch (error) {
    const msg = String(error?.message || error);
    // The entity limits are a per-caller budget, and a busy match can brush up
    // against them during a cold start. Answer with a soft "nothing new" so
    // the player's session survives instead of the client seeing a 500, and
    // let it try again in a moment.
    if (/rate limit|traffic volume/i.test(msg)) {
      return Response.json({ t: 0, noChange: true, throttled: true });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}

// Applies a client input frame (angle, position, weapon) to its player.
// Client-authoritative position, clamped to the arena — unchanged behaviour,
// just shared by the poll and the legacy `input` op.
function applyInput(player, lobby, peerId, input) {
  if (!player || !input) return;
  if (typeof input.ang === "number") player.ang = input.ang;
  // The reported position is NOT written here: the simulation applies it in
  // advance(), where the whole step is checked against the arena's walls.
  // Writing it first made that check compare the new spot with itself, so it
  // always passed and players could walk through buildings.
  if (Number.isInteger(input.weapon) && input.weapon >= 0 && input.weapon <= 2) player.weapon = input.weapon;
  lobby.inputs[peerId] = { ix: input.ix, iy: input.iy, ang: input.ang, x: input.x, y: input.y, weapon: input.weapon };
}

// Every pellet of one trigger pull arrives together, so a shotgun costs no more
// requests than a pistol shot.
// A shot's weapon name -> the projectile kind every client's renderer knows
// (render3d_fx BULLET_VIS).
function bulletKind(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("flame")) return "flamethrower";
  if (n.includes("crossbow")) return "crossbow";
  if (n.includes("marksman")) return "marksman";
  if (n.includes("burst")) return "burst";
  if (n.includes("smg")) return "smg";
  if (n.includes("lmg")) return "lmg";
  if (n.includes("rifle")) return "rifle";
  if (n.includes("shotgun")) return "shotgun";
  return "";
}

function applyShots(lobby, player, peerId, shots) {
  if (!player || !Array.isArray(shots) || !shots.length) return;
  if ((player.hp ?? 1) <= 0) return;
  for (const s of shots.slice(0, 12)) {
    const ang = Number(s?.ang);
    const sx = Number(s?.x), sy = Number(s?.y);
    if (!Number.isFinite(ang) || !Number.isFinite(sx) || !Number.isFinite(sy)) continue;
    const speed = Math.min(1400, Number(s?.speed) || 800);
    const dmg = Math.min(80, Number(s?.dmg) || 12);
    // The key-holder's revolver round is lethal on players, not 34 damage.
    const oneShot = !!s?.one;
    // The weapon the shot came from decides how it looks: a flamethrower round
    // must reach other clients as a fireball, not a pistol tracer.
    const wname = typeof s?.w === "string" ? s.w.replace(/[<>&]/g, "").slice(0, 24) : "";
    const wkind = bulletKind(wname);
    lobby.bullets.push({
      owner: peerId, team: player.team ?? null, ...(oneShot ? { one: true } : null),
      ...(wkind ? { kind: wkind } : null), x: sx, y: sy,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      r: 4, dmg, life: 1.2
    });
  }
}

// The lobby row in the database is the single source of truth. Requests are
// load-balanced across server instances, so holding the match in memory made
// two instances overwrite each other with diverging copies — players saw the
// map flip back and forth and bots/bullets that never moved. Only the row id is
// remembered here (harmless, per instance) to avoid a lookup after a create.
const ROW_IDS = new Map();

async function loadLobby(db, lobbyId) {
  const key = String(lobbyId);
  const { items } = await db.filter({ lobbyId: key }, { limit: 1 });
  if (!items.length) return null;
  ROW_IDS.set(key, items[0].id);
  const state = items[0].state;
  // A saved state carries no snapshot (it is rebuilt per request).
  if (!state.snapshot) bakeSnapshot(state);
  return state;
}

async function saveLobby(db, lobby) {
  const key = String(lobby.id);
  let rowId = ROW_IDS.get(key) || null;
  if (!rowId) {
    const { items } = await db.filter({ lobbyId: key }, { limit: 1, fields: ["id"] });
    if (!items.length) return;
    rowId = items[0].id;
    ROW_IDS.set(key, rowId);
  }
  // The snapshot is rebuilt on every request, so it never needs storing.
  const { snapshot, ...persisted } = lobby;
  await db.update(rowId, { state: { ...persisted, snapshot: null }, mode: lobby.mode });
}