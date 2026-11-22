// network_http.js — Monster Arena networking.
//
// Every live match runs in a realtime ROOM: one actor instance per lobby code,
// server-authoritative and pushed at ~16Hz. The game frame has no SDK, so the
// page that hosts it holds the room and relays messages both ways.
//
// The room is the ONLY transport. Nothing here calls a backend function, so
// multiplayer keeps working while the workspace's integration credits are
// spent. A room that drops is reopened with the same seat id, so a brief
// network blip does not end the match.
(() => {
  function appearance() {
    try {
      const s = JSON.parse(localStorage.getItem("arenaSettings") || "{}");
      return {
        design: Number.isInteger(s.design) ? s.design : 0,
        color: Number.isInteger(s.color) ? s.color : 0
      };
    } catch {
      return { design: 0, color: 0 };
    }
  }

  // ---- realtime room transport ------------------------------------------
  const room = { code: null, connId: null, live: false, hello: null, waiting: null, timer: null, tries: 0 };

  // ---- snapshot interpolation -------------------------------------------
  // The room pushes ~16 snapshots a second, so the newest one is already a
  // little stale and the trip adds more. Every fighter is therefore drawn a
  // fixed delay in the past — blended between the last two snapshots — and
  // every bullet is stepped back along its own flight path by that same
  // delay. A shot then leaves the muzzle of the body the player can actually
  // see, instead of appearing out of empty air somewhere ahead of it.
  const INTERP_MS = 110;
  const hist = [];
  let _viewAt = 0;

  const angLerp = (a, b, f) => {
    if (typeof a !== "number" || typeof b !== "number") return b;
    const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + d * f;
  };

  function blend(prev, curr, f, over) {
    if (!Array.isArray(curr)) return curr;
    if (!Array.isArray(prev) || !prev.length) return curr;
    const A = new Map();
    for (const o of prev) if (o && o.id != null) A.set(o.id, o);
    return curr.map((c) => {
      const p = c && A.get(c.id);
      if (!p) return c;
      const dx = c.x - p.x, dy = c.y - p.y;
      // A respawn or a teleport is a jump, not movement: never blend across it.
      if (Math.hypot(dx, dy) > 420) return c;
      const k = f + (over || 0);
      return {
        ...c,
        x: p.x + dx * k,
        y: p.y + dy * k,
        ...(typeof c.ang === "number" ? { ang: angLerp(p.ang, c.ang, f) } : null)
      };
    });
  }

  function rewindBullets(list, dt) {
    if (!Array.isArray(list)) return list;
    return list.map((b) => {
      if (!b) return b;
      return {
        ...b,
        x: b.x + (b.vx || 0) * dt,
        y: b.y + (b.vy || 0) * dt,
        ...(typeof b.z === "number" ? { z: b.z + (b.vz || 0) * dt } : null)
      };
    });
  }

  function buildView() {
    const raw = Net.state.raw;
    if (!raw || !hist.length) return;
    const target = performance.now() - INTERP_MS;
    // The pair of snapshots the render time falls between.
    let i = hist.length - 1;
    while (i > 0 && hist[i].at > target) i--;
    const a = hist[i];
    const b = hist[i + 1] || null;
    const curr = b ? b.snap : a.snap;
    const prev = b ? a.snap : null;
    const span = Math.max(1, (b ? b.at : a.at) - a.at);
    const f = b ? Math.max(0, Math.min(1, (target - a.at) / span)) : 1;
    // Late (a stalled room): carry the last motion on instead of freezing.
    const over = b ? Math.max(0, Math.min(0.6, (target - b.at) / span)) : 0;

    const view = { ...curr };
    if (prev) {
      view.players = blend(prev.players, curr.players, f, over);
      view.enemies = blend(prev.enemies, curr.enemies, f, over);
      view.bots = blend(prev.bots, curr.bots, f, over);
    }
    // Bullets fly in a straight line at a constant speed, so their position at
    // the render time is exact: step each one back by the delay.
    view.bullets = rewindBullets(curr.bullets, (target - (b ? b.at : a.at)) / 1000);
    Net.state.snapshot = view;
  }

  function pushHist(snap) {
    hist.push({ at: performance.now(), snap });
    if (hist.length > 12) hist.shift();
  }

  // Rebuilt faster than the room pushes, so movement reads as motion.
  (function viewLoop() {
    requestAnimationFrame(viewLoop);
    const t = performance.now();
    if (t - _viewAt < 30) return;
    _viewAt = t;
    try { buildView(); } catch (_) {}
  })();

  const toShell = (payload) => {
    if (window.parent === window) return false;
    window.parent.postMessage(payload, "*");
    return true;
  };

  function onRoomMessage(msg) {
    if (!msg || typeof msg !== "object") return;
    room.lastMsg = Date.now();
    if (msg.type === "ready") {
      // Socket is up: introduce ourselves and wait for the seat.
      if (room.hello) toShell({ type: "net:send", data: room.hello });
      return;
    }
    if (msg.type === "welcome") {
      room.live = true;
      room.tries = 0;
      room.lastMsg = Date.now();
      clearTimeout(room.timer);
      startHeartbeat();
      startWatchdog();
      const st = Net.state;
      st.peerId = msg.you;
      st.myId = msg.you;
      st.lobbyId = room.code;
      st.team = (msg.team === 0 || msg.team === 1) ? msg.team : null;
      st.isHost = !!msg.isHost;
      st.meta = {
        lobbyId: room.code,
        mode: msg.mode,
        isHost: !!msg.isHost,
        respawn: !!msg.respawn,
        team: st.team,
        levelId: msg.levelId ?? null
      };
      const waiting = room.waiting;
      room.waiting = null;
      window.dispatchEvent(new CustomEvent("net:meta", { detail: st.meta }));
      if (waiting) waiting(msg);
      return;
    }
    if (msg.type === "roster") {
      Net.state.roster = Array.isArray(msg.players) ? msg.players : [];
      window.dispatchEvent(new CustomEvent("net:roster", { detail: msg }));
      return;
    }
    // The duel queue paired us: whoever is waiting for a match takes the room.
    if (msg.type === "duelFound") {
      window.dispatchEvent(new CustomEvent("duel:found", { detail: msg }));
      return;
    }
    if (msg.type === "queue") {
      window.dispatchEvent(new CustomEvent("duel:queued", { detail: msg }));
      return;
    }
    if (msg.type === "snap") {
      const snap = msg;
      if (snap.wk) Net.state.worldKey = snap.wk;
      // The map rides only the snapshot where its key changed, which can land
      // before the match has started. Keep that copy so the arena is built from
      // the server's map whenever the player is finally dropped in.
      if (snap.world) Net.state.world = snap.world;
      Net.state.raw = snap;
      pushHist(snap);
      buildView();
      window.dispatchEvent(new CustomEvent("net:snapshot", { detail: snap }));
      if (snap.meta) {
        const merged = { ...(Net.state.meta || {}), ...snap.meta };
        if (JSON.stringify(Net.state.meta || {}) !== JSON.stringify(merged)) {
          Net.state.meta = merged;
          window.dispatchEvent(new CustomEvent("net:meta", { detail: merged }));
        }
      }
    }
  }

  window.addEventListener("message", (e) => {
    const d = e.data || {};
    if (d.type === "net:msg") onRoomMessage(d.data);
    else if (d.type === "net:closed") onRoomClosed();
  });

  function onRoomClosed() {
    // Refused (or never seated): hand the failure back to whoever is joining.
    if (room.waiting) {
      const w = room.waiting;
      room.waiting = null;
      clearTimeout(room.timer);
      w(null);
      return;
    }
    if (!room.live) return;
    // The socket dropped mid-lobby. Claim the same seat again instead of
    // ending the match — the room still holds this player's spot.
    room.live = false;
    if (Net._hb) { clearInterval(Net._hb); Net._hb = null; }
    if (!room.code || !room.hello) return;
    if (room.tries >= 8) {
      window.dispatchEvent(new CustomEvent("net:offline", {}));
      return;
    }
    const wait = Math.min(4000, 500 * ++room.tries);
    setTimeout(() => {
      if (room.code && !room.live && !room.waiting) attempt(room.code, room.hello);
    }, wait);
  }

  const mintCode = () => {
    const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 6; i++) s += A[(Math.random() * A.length) | 0];
    return s;
  };

  // One connect attempt: resolves with the welcome, or null if the room did
  // not seat us in time.
  function attempt(code, hello) {
    return new Promise((resolve) => {
      if (window.parent === window) { resolve(null); return; }
      room.code = String(code).toUpperCase();
      room.hello = hello;
      room.live = false;
      room.waiting = resolve;
      clearTimeout(room.timer);
      room.timer = setTimeout(() => {
        if (!room.waiting) return;
        room.waiting = null;
        toShell({ type: "net:close" });
        resolve(null);
      }, 5000);
      toShell({ type: "net:connect", roomId: room.code, connId: room.connId });
    });
  }

  // Opens the room and returns its welcome, or null when it is unavailable.
  async function openRoom(code, hello) {
    if (window.parent === window) return null;
    let connId = sessionStorage.getItem("arenaConnId");
    if (!connId) {
      connId = (crypto.randomUUID && crypto.randomUUID()) ||
        "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem("arenaConnId", connId);
    }
    room.connId = connId;
    room.tries = 0;
    // A room that is hibernating can take a moment to answer: ask again rather
    // than falling over on the first slow reply.
    for (let i = 0; i < 3; i++) {
      const welcome = await attempt(code, hello);
      if (welcome) return welcome;
      await new Promise((r) => setTimeout(r, 600 + i * 900));
    }
    return null;
  }

  // The room only steps when something arrives, so a steady light ping keeps
  // the match running even while a player stands still. It carries the last
  // known input so movement stays smooth.
  function startHeartbeat() {
    if (Net._hb) return;
    Net._hb = setInterval(() => {
      if (!room.live) {
        clearInterval(Net._hb);
        Net._hb = null;
        return;
      }
      const data = Net._lastInput ? { type: "input", ...Net._lastInput } : { type: "input" };
      toShell({ type: "net:send", data });
    }, 100);
  }

  // A room that has gone quiet is as good as gone: the socket can be open while
  // nothing arrives. When that happens the seat is claimed again.
  function startWatchdog() {
    if (Net._wd) return;
    Net._wd = setInterval(() => {
      if (!room.live) {
        clearInterval(Net._wd);
        Net._wd = null;
        return;
      }
      if (Date.now() - (room.lastMsg || 0) < 8000) return;
      toShell({ type: "net:close" });
      onRoomClosed();
    }, 3000);
  }

  function closeRoom() {
    clearTimeout(room.timer);
    if (Net._hb) { clearInterval(Net._hb); Net._hb = null; }
    if (Net._wd) { clearInterval(Net._wd); Net._wd = null; }
    room.waiting = null;
    room.live = false;
    room.hello = null;
    room.tries = 0;
    if (room.code) toShell({ type: "net:close" });
    room.code = null;
  }

  const Net = {
    state: { lobbyId: null, peerId: null, myId: null, snapshot: null, raw: null, meta: null },

    setSignalUrl(_) { /* same-origin; ignored */ },
    setNickname(nick) { try { localStorage.setItem("arenaNick", nick); } catch {} },

    async connect({ mode = "pve", nickname = null } = {}) {
      return this.join(mode, nickname);
    },

    async join(mode = "pve", nickname = null, team = null, opts = {}) {
      // A new lobby brings its own map: nothing from the last match may survive
      // into it, or the player would walk around the previous arena.
      this.state.world = null;
      this.state.worldKey = "";
      this.state.raw = null;
      this.state.snapshot = null;
      hist.length = 0;
      const nick = nickname || localStorage.getItem("arenaNick") || "Player";
      const urlLobby = new URLSearchParams(location.search).get("lobby");
      const given = (opts.lobbyId || urlLobby || "").trim().toUpperCase();
      const code = given || mintCode();
      const teamPref = (team === 0 || team === 1) ? team : undefined;

      const welcome = await openRoom(code, {
        type: "hello", mode, name: nick, team: teamPref,
        bots: opts.bots !== false,
        // The host's respawn choice (on unless they turned it off), re-applied
        // whenever they open a lobby.
        respawn: localStorage.getItem("arenaMpRespawn") !== "0",
        // A public server tells the room which mode it is, so the room can
        // open itself if this is the first player to reach it.
        ...(opts.public ? { pub: mode } : null),
        // A matchmade duel room is minted a moment ago: the first one in opens it.
        ...(opts.duelBot ? { duelBot: true } : null),
        expectExisting: !!given && !opts.fresh
      });
      if (!welcome) throw new Error("Couldn't reach the match server. Please try again.");

      const a = appearance();
      this.setColor(a.color);
      this.setDesign(a.design);
      // hello is kept: an automatic reconnect re-sends it to reclaim the seat.
      return {
        lobbyId: room.code, peerId: welcome.you, mode: welcome.mode,
        name: nick, startTime: Date.now() + 86400000,
        isHost: !!welcome.isHost, team: welcome.team ?? null
      };
    },

    // Every menu action rides the room.
    _op(type, body) {
      if (!this.state.lobbyId) return null;
      toShell({ type: "net:send", data: { type, ...body } });
      return { ok: true };
    },

    async setLevel(levelId) {
      if (!this.state.lobbyId) throw new Error("Not joined");
      return this._op("setLevel", { levelId });
    },

    async setMode(mode, bots) {
      if (!this.state.lobbyId || !this.state.peerId) return { ok: false };
      // The host's bots choice travels with the mode change.
      const body = { mode, ...(typeof bots === "boolean" ? { bots } : null) };
      this.state.meta = { ...(this.state.meta || {}), mode };
      return this._op("setMode", body);
    },

    // Host only: may a fallen player rejoin this match?
    async setRespawn(on) {
      if (!this.state.lobbyId || !this.state.peerId) return { ok: false };
      return this._op("setRespawn", { on: !!on });
    },

    // "Rise again" — ask the lobby to put this player back on the field.
    async respawn() {
      if (!this.state.lobbyId || !this.state.peerId) return { ok: false };
      return this._op("respawn", {});
    },

    async start(levelId) {
      if (!this.state.lobbyId || !this.state.peerId) return { ok: false };
      return this._op("start", { levelId });
    },

    async openChest(chestId) {
      if (!this.state.lobbyId) return { ok: false };
      return this._op("chestOpen", { chestId });
    },

    // A drop was walked over: the room takes it off the floor and gives the
    // body the same thing the client already showed.
    takePickup(x, y) {
      if (!this.state.lobbyId || !this.state.peerId) return;
      this._op("pickup", { x, y });
    },

    async setGuns(guns) {
      if (!this.state.lobbyId || !this.state.peerId) return;
      this._op("setGuns", { guns });
    },
    async setDesign(design) {
      if (!this.state.lobbyId || !this.state.peerId) return;
      this._op("setDesign", { design });
    },
    async setColor(color) {
      if (!this.state.lobbyId || !this.state.peerId) return;
      this._op("setColor", { color });
    },

    async leave() {
      if (!this.state.lobbyId || !this.state.peerId) return;
      this.state.lobbyId = null;
      this.state.peerId = null;
      this.state.snapshot = null;
      this.state.raw = null;
      hist.length = 0;
      this.state.world = null;
      this.state.worldKey = "";
      toShell({ type: "net:send", data: { type: "leave" } });
      closeRoom();
    },

    async setWorld() {
      if (!this.state.lobbyId) throw new Error("Not joined");
      // The room owns the map: it generates and hands out the world itself.
    },

    // Movement: absolute position + aim, at most ~33 a second.
    // z is the floor the player is standing on: the server needs it so a shot
    // fired on the ground floor cannot reach someone upstairs.
    sendInput(ix, iy, ang, x, y, weapon, z) {
      if (!this.state.lobbyId || !this.state.peerId) return;
      this._lastInput = { ix, iy, ang, x, y, weapon, z };
      const t = performance.now();
      if (t - (this._inAt || 0) < 30) return;
      this._inAt = t;
      toShell({ type: "net:send", data: { type: "input", ix, iy, ang, x, y, weapon, z } });
    },

    // z / vz carry the shot's height and how fast it climbs, so aiming up in
    // 3D sends the bullet up instead of along a fixed height.
    sendShoot(x, y, ang, speed, dmg, z, vz, weapon, oneShot) {
      if (!this.state.lobbyId || !this.state.peerId) return;
      this._shots = this._shots || [];
      const shot = { x, y, ang, speed, dmg };
      // The weapon travels with the shot so the server can name it in a kill.
      if (weapon) shot.w = String(weapon).slice(0, 24);
      // The key-holder's revolver drops a player outright; the server cannot
      // work that out from 34 damage alone, so the shot says so.
      if (oneShot) shot.one = 1;
      if (z !== undefined) { shot.z = z; shot.vz = vz || 0; }
      this._shots.push(shot);
      if (this._shotFlush) return;
      this._shotFlush = true;
      // Every pellet of one trigger pull travels in a single message.
      queueMicrotask(() => {
        this._shotFlush = false;
        const shots = this._shots || [];
        this._shots = [];
        if (!shots.length || !this.state.lobbyId || !this.state.peerId) return;
        toShell({ type: "net:send", data: { type: "shoot", shots } });
      });
    },

    async setGlyphPath(path) {
      if (!this.state.lobbyId || !this.state.peerId) return;
      return this._op("glyphPath", { path });
    },
    async unlockGlyph(path, key) {
      if (!this.state.lobbyId || !this.state.peerId) return;
      return this._op("glyphUnlock", { path, key });
    },

    sendChat(text) {
      if (!this.state.lobbyId || !this.state.peerId) return;
      const body = String(text || "").slice(0, 140);
      if (!body.trim()) return;
      // The rank level rides along so every chat line can show the sender's badge.
      const rank = (window.RankXP && RankXP.level) ? RankXP.level() : 0;
      this._op("chat", { text: body, rank });
    },

    sendHit(target, x, y, dmg, kind = "") {
      this._op("hit", { target, x, y, dmg, kind });
    },

    // A melee strike (or a raised guard) everyone else should see where it
    // happened: the room passes it on with the snapshot.
    sendMeleeFx(x, y, ang, id, guard) {
      if (!this.state.lobbyId) return;
      this._op("meleeFx", { x, y, ang, id, guard: !!guard });
    },

    // Duel terms: the rounds and the map this fighter wants. The room settles
    // it with the other player's pick and starts the match itself.
    duelVote(rounds, levelId) {
      if (!this.state.lobbyId || !this.state.peerId) return;
      this._op("duelVote", {
        ...(Number.isFinite(rounds) ? { rounds } : null),
        ...(Number.isFinite(levelId) ? { levelId } : null)
      });
    },

    // Random duels: a shared queue room seats two strangers (or a bot after
    // ten seconds) and hands back the room both of them walk into.
    async findDuel(nickname) {
      this.state.world = null;
      this.state.worldKey = "";
      this.state.raw = null;
      this.state.snapshot = null;
      this.state.lobbyId = null;
      this.state.peerId = null;
      hist.length = 0;
      if (window.parent === window) throw new Error("Matchmaking needs the game page.");
      let connId = sessionStorage.getItem("arenaConnId");
      if (!connId) {
        connId = (crypto.randomUUID && crypto.randomUUID()) ||
          "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem("arenaConnId", connId);
      }
      const nick = nickname || localStorage.getItem("arenaNick") || "Player";
      room.connId = connId;
      room.code = "DUELQ";
      room.hello = { type: "hello", queue: true, name: nick };
      room.live = false;
      room.tries = 0;
      return new Promise((resolve) => {
        let done = false;
        const finish = (value) => {
          if (done) return;
          done = true;
          window.removeEventListener("duel:found", onFound);
          clearTimeout(timer);
          resolve(value);
        };
        const onFound = (e) => finish(e.detail || null);
        window.addEventListener("duel:found", onFound);
        const timer = setTimeout(() => finish(null), 30000);
        toShell({ type: "net:connect", roomId: "DUELQ", connId });
      });
    },

    cancelDuel() {
      toShell({ type: "net:close" });
      room.hello = null;
      room.code = null;
      room.live = false;
    }
  };

  window.Net = Net;
})();
