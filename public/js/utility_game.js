/* =====================================================================
   utility_game.js — playing the utilities.

   One equipped utility per player, thrown with G (or the mobile UTIL
   button). Everything the utility does is simulated here so it behaves
   the same in PvE, PvP, Teams and CTF:

     • projectiles are lobbed in 3D (height + gravity) and land on the
       floor or against a wall
     • effects are real: enemy shots die inside smoke and inside an Aegis
       dome, flashes stun monsters and white out players caught in them,
       mines, tar, venom and void wells act on whoever walks in — your
       own side included
     • the server is told where each effect landed, so in an online match
       every player sees it and the authoritative damage still lands

   The rendering hooks onto Render3D.collect, so the models are drawn by
   the same lit 3D pass as the rest of the arena.
   ===================================================================== */
(function (G) {
  'use strict';

  const st = {
    id: null, cd: 0, throwT: 0,
    projectiles: [], zones: [], mines: [], lastMatch: false,
    seenRemote: new Set(), remoteZones: [], flashT: 0, hud: ''
  };

  const now = () => performance.now() / 1000;

  const GRAV = 900;                  // the fall rate every thrown utility shares

  // Height of the floor under a point (flat maps and terrain alike).
  function groundAt(x, y) {
    try {
      if (G.W3 && W3.enabled && W3.data && W3.terrain) return W3.terrain(x, y) || 0;
    } catch (_) {}
    return 0;
  }

  // Launch velocity for a throw: one fixed speed, so the angle alone decides
  // how far it carries — flat drops short, a lobbed 45° reaches furthest, and
  // aiming down puts it at your feet. utility_aim.js flies exactly this, so
  // the arc on screen is the arc the utility takes.
  function throwVel(yaw, pitch) {
    const S = 1000;
    const cp = Math.cos(pitch || 0);
    return {
      vx: Math.cos(yaw) * cp * S,
      vy: Math.sin(yaw) * cp * S,
      vz: -Math.sin(pitch || 0) * S
    };
  }

  function catalog() { return (G.Utilities && G.Utilities.BY_ID) || {}; }
  function equippedId() { return G.Utilities ? G.Utilities.equipped() : null; }
  function def() { const id = equippedId(); return id ? catalog()[id] : null; }

  // pve16 publishes the live player, world, weapon table and entity lists on
  // the window; this bridge wraps them in the few operations utilities need.
  function bridge() {
    const p = G.__arenaPlayer, ents = G._ents;
    if (!p || !ents) return null;
    let bots = [];
    try { bots = (typeof SP_BOTS !== 'undefined' && SP_BOTS) ? SP_BOTS : []; } catch (e) { bots = []; }
    const world = G.__arenaWorld || null;
    return {
      player: p, world,
      enemies: ents.enemies || [], bots,
      ebullets: ents.ebullets || [], bullets: ents.bullets || [],
      online: !!(G.Net && G.Net.state && G.Net.state.lobbyId),
      // the same rule the game's own area damage uses: shielded bosses take
      // nothing, everyone else inside the radius takes the hit
      hurtArea: (x, y, r, dmg, opts) => {
        // online, the room owns damage — applying it here as well would hit twice
        if (G.Net && G.Net.state && G.Net.state.lobbyId) return;
        const o = opts || {};
        const hit = (e) => {
          if (!e || e.hp <= 0 || e.absorbing) return;
          const rr = (e.r || 16) + r;
          if ((e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) > rr * rr) return;
          e.hp -= dmg;
          if (o.stun) e.stunT = Math.max(e.stunT || 0, o.stun);
          if (o.burn) { e.burnStacks = Math.min(3, (e.burnStacks || 0) + 1); e.burnT = Math.max(e.burnT || 0, 2.6); }
        };
        for (const e of (ents.enemies || [])) hit(e);
        for (const b of bots) hit(b);
      },
      hurtPlayer: (d) => { p.hp = Math.max(0, p.hp - d); },
      addShield: (n) => { p.shield = Math.min(160, (p.shield || 0) + n); },
      refill: () => {
        const W = G.__arenaWeapons, w = W && W[p.weapon];
        if (w) { p.ammo = w.ammo; p.reserve = w.reserve; }
        else { p.ammo = (p.ammo || 0) + 15; p.reserve = (p.reserve || 0) + 30; }
      },
      teleport: (x, y) => { if (!world || !world.isBlocked(x, y, p.r)) { p.x = x; p.y = y; } }
    };
  }

  // Movement modifiers (tar, snare, the Champion's aura) hold a multiplier for
  // a moment and hand the player back their own speed afterwards.
  let speedHold = null;
  function applySpeed(p, mul, t) {
    if (!speedHold) speedHold = { base: p.spdMul || 1, until: 0 };
    speedHold.until = Math.max(speedHold.until, now() + t);
    p.spdMul = mul < 1 ? Math.min(p.spdMul || 1, mul) : Math.max(p.spdMul || 1, mul);
  }

  /* --------------------------------------------------------------- match */
  function syncMatch() {
    const b = bridge();
    const running = !!(b && G.__pveMatchRunning && G.__pveMatchRunning());
    if (running && !st.lastMatch) {
      const u = def();
      st.id = u ? u.id : null;
      st.cd = 0; st.projectiles.length = 0; st.zones.length = 0; st.mines.length = 0;
      st.seenRemote.clear(); st.remoteZones.length = 0;
    }
    if (!running && st.lastMatch) {
      st.projectiles.length = 0; st.zones.length = 0; st.mines.length = 0; st.remoteZones.length = 0;
      st.seenRemote.clear();
    }
    st.lastMatch = running;
  }

  /* ------------------------------------------------------------ activation */
  function canUse() {
    if (!G.Utilities) return false;
    const u = def();
    if (!u) return false;
    const b = bridge();
    if (!b || !b.player || b.player.hp <= 0) return false;
    if (!(G.__pveMatchRunning && G.__pveMatchRunning())) return false;
    // Every utility is reusable — the only thing that stops a second one is
    // its own reload, which runs from the moment the last one left the hand.
    if (st.cd > 0) return false;
    st.id = u.id;
    return true;
  }

  // An aimed throw: `yaw`/`pitch` is where, and the fixed throw speed turns
  // that angle into distance. utility_aim.js supplies both; a call with
  // neither still works and throws along the fighter's facing.
  function use(yaw, pitch) {
    if (!canUse()) return false;
    const u = def(), b = bridge();
    const p = b.player;
    // reload, not a charge: the time comes from what the utility does, so a
    // long-lived field takes far longer to come back than a quick snare
    st.cd = u.reload;
    st.throwT = 0.42;
    const ang = (yaw == null ? (p.angle || 0) : yaw);
    const pit = pitch || 0;
    const vel = throwVel(ang, pit);
    const fx = Math.cos(ang), fy = Math.sin(ang);

    // Where it comes down: the tracer's own answer, so what you aimed at is
    // where it lands. The Iron Ward rides with you, so it stays in your hands.
    const land = (G.UtilityAim && u.id !== 'iron_ward') ? G.UtilityAim.landing(ang, pit) : null;
    const lx = land ? land.x : p.x + fx * (u.kind === 'drop' ? 22 : 0);
    const ly = land ? land.y : p.y + fy * (u.kind === 'drop' ? 22 : 0);

    if (u.kind === 'throw') {
      st.projectiles.push({
        uid: u.id, x: p.x + fx * (p.r + 6), y: p.y + fy * (p.r + 6),
        z: (p.z || 0) + 34, vx: vel.vx, vy: vel.vy, vz: vel.vz,
        born: now(), spin: 0
      });
    } else if (u.kind === 'fire') {
      // grapple: to the spot the crosshair was over
      st.zones.push({ uid: u.id, kind: 'grapple', x: lx, y: ly, z: 26, t0: now(), dur: 0.45, r: 10, owner: 'me', data: {} });
      st.zones.push({ uid: u.id, kind: 'grappleLine', x: p.x, y: p.y, x2: lx, y2: ly, t0: now(), dur: 0.45, r: 4, owner: 'me', data: {} });
      b.teleport(lx, ly);
    } else {
      spawnZone(u, lx, ly, b);
    }

    // A thrown utility only becomes real when it comes down: the room is told
    // then (see spawnZone), so every other client sees the effect where the
    // throw actually landed instead of the instant the button was pressed.
    if (u.kind !== 'throw') broadcast(u, lx, ly, b);
    return true;
  }

  // Tell the room where an effect landed. It owns the damage and hands the same
  // spot to every other client.
  function broadcast(u, x, y, b) {
    if (!u || !b || !b.online || !G.Net || !G.Net._op) return;
    try {
      G.Net._op('utility', { id: u.id, x, y, kind: u.kind, r: u.radius, dur: u.dur });
    } catch (e) {}
  }

  function spawnZone(u, x, y, b) {
    const z = {
      uid: u.id, kind: u.id, x: x, y: y, z: (b && b.player ? (b.player.z || 0) : 0),
      t0: now(), dur: u.dur || 6, r: u.radius || 100, owner: 'me', data: { tick: 0, done: false }
    };
    st.zones.push(z);
    if (u.id === 'iron_ward' && b) b.addShield(45);
    // Every client is told the moment it lands, at the spot it landed on.
    broadcast(u, x, y, b);
    return z;
  }

  /* --------------------------------------------------------------- update */
  function update(dt) {
    syncMatch();
    if (st.cd > 0) st.cd = Math.max(0, st.cd - dt);
    if (st.throwT > 0) st.throwT = Math.max(0, st.throwT - dt);
    if (st.flashT > 0) st.flashT = Math.max(0, st.flashT - dt);

    const b = bridge();
    if (!b || !b.player) return;
    const p = b.player;
    if (speedHold && now() > speedHold.until) { p.spdMul = speedHold.base; speedHold = null; }

    // ---- projectiles
    for (let i = st.projectiles.length - 1; i >= 0; i--) {
      const pr = st.projectiles[i];
      const nx = pr.x + pr.vx * dt, ny = pr.y + pr.vy * dt;
      pr.vz -= GRAV * dt;
      pr.z += pr.vz * dt;
      pr.spin += dt * 9;
      // a throw that clears the top of a wall keeps going; one that does not
      // stops against it. It lands on whatever floor is under it.
      const blocked = b.world && b.world.isBlocked(nx, ny, 5, pr.z);
      pr.x = nx; pr.y = ny;
      if (pr.z <= groundAt(pr.x, pr.y) || blocked || now() - pr.born > 6) {
        st.projectiles.splice(i, 1);
        const u = catalog()[pr.uid];
        if (u) spawnZone(u, pr.x, pr.y, b);
      }
    }

    // ---- mines
    for (let i = st.mines.length - 1; i >= 0; i--) {
      const m = st.mines[i];
      m.arm -= dt;
      if (m.arm > 0) continue;
      let hit = null;
      for (const e of (b.enemies || [])) {
        if (e.hp > 0 && Math.hypot(e.x - m.x, e.y - m.y) < 90) { hit = e; break; }
      }
      if (!hit) for (const bo of (b.bots || [])) {
        if (bo.hp > 0 && Math.hypot(bo.x - m.x, bo.y - m.y) < 90) { hit = bo; break; }
      }
      if (hit) {
        b.hurtArea(m.x, m.y, 130, 18, { stun: 0.8 });
        // the discharge kicks the player off their feet too
        if (G.UtilityAim) G.UtilityAim.blast(m.x, m.y, 150, 0.75);
        st.zones.push({ uid: 'shock_mine', kind: 'shockBurst', x: m.x, y: m.y, z: 0, t0: now(), dur: 0.6, r: 130, owner: 'me', data: {} });
        st.mines.splice(i, 1);
      } else if (now() - m.t0 > 26) st.mines.splice(i, 1);
    }

    // ---- zones
    for (let i = st.zones.length - 1; i >= 0; i--) {
      const z = st.zones[i];
      const age = now() - z.t0;
      if (age > z.dur) { st.zones.splice(i, 1); continue; }
      tickZone(z, age, dt, b, p);
    }

    // ---- server-broadcast effects (online matches)
    pullRemoteZones();

    // ---- HUD
    const u = def();
    const left = st.cd > 0 ? Math.ceil(st.cd) : 0;
    const label = u ? (left ? u.name + ' · ' + left + 's' : u.name) : 'None';
    if (label !== st.hud) {
      st.hud = label;
      const el = document.getElementById('utilName');
      if (el) el.textContent = label;
      const btn = document.getElementById('btnUtil');
      if (btn) btn.textContent = u ? (left ? 'UTIL ' + left + 's' : 'UTIL') : 'UTIL';
    }
  }

  function inside(z, x, y, pad) { return Math.hypot(x - z.x, y - z.y) <= (z.r + (pad || 0)); }

  // Nearest spot to (x, y) the player actually fits in: the point itself, then
  // rings outward. A rift that lands against a wall still folds you out.
  function clearSpot(b, x, y, r) {
    if (!b.world) return { x, y };
    if (!b.world.isBlocked(x, y, r)) return { x, y };
    for (let rad = 14; rad <= 96; rad += 14) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const nx = x + Math.cos(a) * rad, ny = y + Math.sin(a) * rad;
        if (!b.world.isBlocked(nx, ny, r)) return { x: nx, y: ny };
      }
    }
    return null;
  }

  function tickZone(z, age, dt, b, p) {
    const d = z.data;
    switch (z.kind) {
      case 'smoke_grenade':
        // the cloud eats enemy fire that passes through it
        eatBullets(b, z.x, z.y, z.r, true);
        break;
      case 'flash_charge':
        if (!d.done) {
          d.done = true;
          b.hurtArea(z.x, z.y, z.r, 0, { stun: 1.0 });
          if (inside(z, p.x, p.y, 0)) st.flashT = 0.55;
        }
        break;
      case 'ammo_pack':
        if (!d.done && inside(z, p.x, p.y, 30)) { d.done = true; b.refill(); z.t0 = now() - z.dur; }
        break;
      case 'scrap_snare':
        if (!d.done) {
          d.done = true;
          b.hurtArea(z.x, z.y, z.r, 6, { stun: 1.4 });
        }
        if (inside(z, p.x, p.y, 0)) applySpeed(p, 0.45, 0.4);
        break;
      case 'tar_grenade':
        d.tick += dt;
        if (d.tick > 0.7) { d.tick = 0; b.hurtArea(z.x, z.y, z.r, 0, { stun: 0.35 }); }
        if (inside(z, p.x, p.y, 0)) applySpeed(p, 0.62, 0.4);
        break;
      case 'breach_charge':
        // the zone outlives its fuse (dur 2.0 > 1.6), so the blast lands and
        // its fireball gets its tail before the charge is cleaned up
        if (!d.done && age > 1.6) {
          d.done = true;
          const dist = Math.hypot(p.x - z.x, p.y - z.y);
          b.hurtArea(z.x, z.y, z.r, 62, { stun: 0.4 });
          if (dist < z.r) b.hurtPlayer(Math.round(62 * (1 - dist / z.r)));
          // the blast throws whoever is standing in it: straight up over the
          // charge, away from it when you are off to one side
          if (G.UtilityAim) G.UtilityAim.blast(z.x, z.y, z.r * 1.25, 1);
        }
        break;
      case 'rift_beacon':
        // the tear winds up for 1.3s inside a 1.7s zone, then folds you in —
        // stepping to the nearest clear spot when it landed against cover
        if (!d.done && age > 1.3) {
          d.done = true;
          const spot = clearSpot(b, z.x, z.y, p.r);
          if (spot) b.teleport(spot.x, spot.y);
        }
        break;
      case 'aegis_projector':
        eatBullets(b, z.x, z.y, z.r, false);
        eatBullets(b, z.x, z.y, z.r, true);
        break;
      case 'viper_fang':
        d.tick += dt;
        if (d.tick > 0.5) {
          d.tick = 0;
          b.hurtArea(z.x, z.y, z.r, 4.5, {});
          // the venom reads on screen: a green bloom rolls through the cloud
          if (G.botGlyphBurstFx) G.botGlyphBurstFx(z.x, z.y, 'earth', z.r * 0.55, 0.5);
        }
        if (inside(z, p.x, p.y, 0)) b.hurtPlayer(4.5 * dt);
        break;
      case 'void_anchor':
        pullToward(z, b, p, dt);
        break;
      case 'champion_standard':
        if (inside(z, p.x, p.y, 0)) {
          applySpeed(p, 1.2, 0.25);
          if (p.reloading) p.reloadT = Math.max(0, p.reloadT - dt * 0.4);
        }
        break;
      case 'decoy_beacon':
        eatBullets(b, z.x, z.y, 95, true);
        break;
      case 'shock_mine':
        if (!d.done) {
          d.done = true;
          st.mines.push({ x: z.x, y: z.y, arm: 1.0, t0: now() });
        }
        break;
      default: break;
    }
  }

  function eatBullets(b, x, y, r, enemy) {
    const list = enemy ? b.ebullets : b.bullets;
    if (!list) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const bl = list[i];
      if (Math.hypot(bl.x - x, bl.y - y) < r) list.splice(i, 1);
    }
  }

  function pullToward(z, b, p, dt) {
    const pull = (obj, k) => {
      const dx = z.x - obj.x, dy = z.y - obj.y;
      const d = Math.hypot(dx, dy);
      if (d < 26 || d > z.r) return;
      const step = Math.min(d, 130 * dt * k);
      const nx = obj.x + (dx / d) * step, ny = obj.y + (dy / d) * step;
      if (b.world && b.world.isBlocked(nx, ny, obj.r || 14)) return;
      obj.x = nx; obj.y = ny;
    };
    pull(p, 1);
    for (const e of (b.enemies || [])) if (e.hp > 0) pull(e, 0.8);
    for (const bo of (b.bots || [])) if (bo.hp > 0) pull(bo, 0.8);
  }

  function pullRemoteZones() {
    const b = bridge();
    const snap = G.Net && G.Net.state && G.Net.state.snapshot;
    const fx = snap && Array.isArray(snap.utilityFx) ? snap.utilityFx : null;
    if (!fx || !b) return;
    const t = Date.now();
    for (const f of fx) {
      // Our own throw is already drawn and ticking locally; the room echoing it
      // back would put a second copy of the field on the same ground.
      if (f.owner && G.Net.state.peerId && f.owner === G.Net.state.peerId) continue;
      const key = f.id + ':' + Math.round(f.x) + ':' + Math.round(f.y) + ':' + f.t0;
      if (st.seenRemote.has(key)) continue;
      st.seenRemote.add(key);
      const u = catalog()[f.id];
      if (!u) continue;
      st.remoteZones.push({
        uid: f.id, kind: f.id, x: f.x, y: f.y, z: 0,
        t0: now() - Math.max(0, (t - f.t0) / 1000),
        // the room's own size and lifetime, so a remote field covers exactly the
        // ground the thrower's does
        dur: Number.isFinite(f.dur) ? f.dur : (u.dur || 6),
        r: Number.isFinite(f.r) ? f.r : (u.radius || 100),
        owner: 'remote', data: { tick: 0, done: true }
      });
    }
    for (let i = st.remoteZones.length - 1; i >= 0; i--) {
      const z = st.remoteZones[i];
      if (now() - z.t0 > z.dur) { st.remoteZones.splice(i, 1); continue; }
      // an enemy field still slows you: each client checks its own player
      if (z.kind === 'tar_grenade' && inside(z, b.player.x, b.player.y, 0)) applySpeed(b.player, 0.62, 0.4);
      if (z.kind === 'viper_fang' && inside(z, b.player.x, b.player.y, 0)) b.hurtPlayer(4.5 / 60);
      if (z.kind === 'void_anchor') pullToward(z, b, b.player, 1 / 60);
    }
  }

  /* -------------------------------------------------------------- drawing */
  // Shorthands onto the arena renderer, matching the ones render3d_fx uses.
  const U = () => G.Render3D.unit;
  const mm = (...a) => G.Render3D.mm(...a);
  const mat = (c, o) => G.Render3D.mat(c, o);

  function drawHeld(R, me, tt) {
    const id = equippedId();
    if (!id || !G.UtilityModels || !G.UtilityModels.has(id)) return;
    // first person draws it as a viewmodel instead (held_slot.js)
    if (R && R.isTps && R.cam && R.cam.fp) return;
    // the local player frame carries `angle`, remote frames carry `ang`
    const ang = (me.ang != null ? me.ang : (me.angle || 0));
    const rr = me.r || 16;
    const raise = st.throwT > 0 ? Math.sin((1 - st.throwT / 0.42) * Math.PI) : 0;
    const f = rr * (0.42 + raise * 0.5);
    const side = rr * 0.58;
    const x = me.x + Math.cos(ang) * f - Math.sin(ang) * side;
    const z = me.y + Math.sin(ang) * f + Math.cos(ang) * side;
    const y = 12 + raise * 12 + Math.sin(tt * 2) * 0.8;
    G.UtilityModels.draw(R, id, x, y, z, ang, 1, raise * 1.6, 1);
    G.UtilityModels.groundGlow(R, x, z, 16, [.35, .8, 1.1], .16);
  }

  function drawProjectiles(R, tt) {
    for (const pr of st.projectiles) {
      if (!G.UtilityModels) continue;
      G.UtilityModels.draw(R, pr.uid, pr.x, pr.z + 1, pr.y, 0, 1, pr.spin, 1.25);
      R.glow(pr.x, pr.z, pr.y, 26, .45, .95, 1.3, .5, 0);
      R.decal(pr.x, pr.y, 26, .3, .6, .9, .22, 2, .1, 0, true, .4);
    }
  }

  function drawZone(R, z, tt) {
    const age = now() - z.t0;
    const life = Math.max(0, 1 - age / z.dur);
    const u = catalog()[z.kind] || {};
    switch (z.kind) {
      case 'smoke_grenade': {
        // a rolling volume of smoke: layered alpha billboards, slowly churning
        const N = 26;
        for (let i = 0; i < N; i++) {
          const a = i * 2.399 + z.t0;
          const rad = (0.28 + 0.72 * ((i * 37) % 100) / 100) * z.r;
          const x = z.x + Math.cos(a) * rad;
          const y = z.y + Math.sin(a) * rad;
          const h = 8 + ((i * 13) % 26);
          const s = 46 + ((i * 29) % 40);
          const al = 0.34 * Math.min(1, age * 2) * life;
          R.quads.alpha.push(x, h, y, s, .62, .66, .74, al, a + tt * .1, 3, 0, 0);
        }
        R.decal(z.x, z.y, z.r * .95, .3, .32, .38, .3 * life, 11, 0, 0, false, 1.2);
        break;
      }
      case 'flash_charge': {
        if (age < 0.4) {
          const k = age / 0.4;
          R.draw(U().sphere, mm(z.x, 16, z.y, 0, 30 + k * 200, 30 + k * 200, 30 + k * 200),
            mat([2, 2, 2], { emissive: [2 * (1 - k), 2 * (1 - k), 2 * (1 - k)], alpha: (1 - k) * .9, shadow: false }));
          R.glow(z.x, 30, z.y, 320 * (1 - k) + 60, 2, 2, 2, (1 - k) * .8, 0);
        }
        break;
      }
      case 'ammo_pack': {
        G.UtilityModels.draw(R, 'ammo_pack', z.x, 8 + Math.sin(tt * 2) * 1.2, z.y, tt * .5, 1, 0, 1);
        R.decal(z.x, z.y, 34, 1.4, 1.1, .5, .3 + .15 * Math.sin(tt * 3), 2, .1, 0, true, .6);
        break;
      }
      case 'scrap_snare': {
        const k = Math.min(1, age / .3);
        G.UtilityModels.draw(R, 'scrap_snare', z.x, 6, z.y, tt * .4, 1 + (1 - k) * .6, 0, 1);
        for (let i = 0; i < 10; i++) {
          const a = i / 10 * Math.PI * 2 + tt;
          R.bolt(z.x, 6, z.y, z.x + Math.cos(a) * z.r * .7, 4 + Math.sin(a * 3 + tt) * 4, z.y + Math.sin(a) * z.r * .7,
            [.6, 1.4, 1.8], 2.4, .55 * life, i + 3, 6);
        }
        break;
      }
      case 'tar_grenade': {
        R.decal(z.x, z.y, z.r, .05, .05, .07, .85 * Math.min(1, age * 3), 11, 0, 0, false, .9);
        R.decal(z.x, z.y, z.r * .82, .1, .1, .13, .7 * life, 2, .12, 0, false, .95);
        for (let i = 0; i < 8; i++) {
          const a = i * 1.7 + tt * .2;
          R.glow(z.x + Math.cos(a) * z.r * .5, 6, z.y + Math.sin(a) * z.r * .5, 26, .12, .1, .16, .5, 0);
        }
        break;
      }
      case 'breach_charge': {
        const arm = Math.min(1, age / 1.6);
        G.UtilityModels.draw(R, 'breach_charge', z.x, 9, z.y, z.t0 * .4, 1, 0, 1 + (Math.sin(age * 22) > 0 ? .5 : 0));
        R.glow(z.x, z.y, 12, 60 + arm * 60, 1.6, .5, .1, .35 + arm * .5, 0);
        if (age > 1.6 && age < 2.0) {
          const k = (age - 1.6) / .4;
          R.draw(U().sphere, mm(z.x, 18, z.y, 0, 40 + k * z.r * 2, 40 + k * z.r, 40 + k * z.r * 2),
            mat([1.8, .8, .25], { emissive: [1.8 * (1 - k), .7 * (1 - k), .1], alpha: (1 - k), shadow: false }));
        }
        break;
      }
      case 'rift_beacon': {
        G.UtilityModels.draw(R, 'rift_beacon', z.x, 8, z.y, tt * .7, 1, 0, 1.4);
        const k = Math.min(1, age / 1.3);
        R.draw(U().torus, mm(z.x, 14, z.y, tt, 30 + k * 70, 30 + k * 70, 30 + k * 70),
          mat([.7, .4, 1.5], { emissive: [.6, .25, 1.4], alpha: .7 * (1 - k * .5), shadow: false }));
        R.bolt(z.x, 4, z.y, z.x, 60, z.y, [.8, .5, 1.6], 4, .8, 3, 7);
        break;
      }
      case 'aegis_projector': {
        G.UtilityModels.draw(R, 'aegis_projector', z.x, 6, z.y, tt * .3, 1, 0, 1);
        const pulse = .55 + .18 * Math.sin(tt * 3);
        R.draw(U().sphere, mm(z.x, 10, z.y, 0, z.r * 2, z.r * 1.5, z.r * 2),
          mat([.35, .85, 1.25], { emissive: [.18, .6, 1.0], alpha: pulse * .22, shadow: false, rim: 1, rimCol: [.5, .9, 1.4] }));
        R.decal(z.x, z.y, z.r, .35, .85, 1.25, .3 * life, 2, .1, 0, true, .8);
        break;
      }
      case 'viper_fang': {
        const N = 20;
        for (let i = 0; i < N; i++) {
          const a = i * 2.399 + z.t0;
          const rad = (0.25 + 0.75 * ((i * 41) % 100) / 100) * z.r;
          R.quads.alpha.push(z.x + Math.cos(a) * rad, 6 + ((i * 11) % 18), z.y + Math.sin(a) * rad,
            30 + (i % 5) * 8, .45, 1.35, .55, .3 * Math.min(1, age * 2) * life, a + tt * .2, 3, 0, 0);
        }
        R.decal(z.x, z.y, z.r * .9, .3, 1.1, .45, .3 * life, 2, .1, 0, true, .7);
        break;
      }
      case 'void_anchor': {
        G.UtilityModels.draw(R, 'void_anchor', z.x, 10 + Math.sin(tt * 2) * 2, z.y, tt, 1, 0, 1.4);
        const k = Math.min(1, age / .4);
        R.draw(U().torus, mm(z.x, 4, z.y, -tt * .6, z.r * k, z.r * k, z.r * k),
          mat([.7, .35, 1.5], { emissive: [.55, .2, 1.3], alpha: .55 * life, shadow: false }));
        for (let i = 0; i < 14; i++) {
          const a = i / 14 * Math.PI * 2 - tt * 1.2;
          const rad = z.r * (1 - (age / z.dur));
          R.glow(z.x + Math.cos(a) * rad, 5, z.y + Math.sin(a) * rad, 18, .6, .3, 1.4, .6 * life, 0);
        }
        break;
      }
      case 'champion_standard': {
        G.UtilityModels.draw(R, 'champion_standard', z.x, 12, z.y, 0, 1, Math.sin(tt * .8) * .08, 1);
        const pulse = .5 + .2 * Math.sin(tt * 2);
        R.decal(z.x, z.y, z.r, 1.5, 1.15, .4, .22 * pulse * life, 2, .1, 0, true, .8);
        R.draw(U().cyl, mm(z.x, 2, z.y, 0, z.r * 2, 26, z.r * 2),
          mat([1.4, 1.05, .4], { emissive: [1.1, .8, .25], alpha: .10 * pulse, shadow: false }));
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2 + tt * .4;
          R.glow(z.x + Math.cos(a) * z.r * .85, 20 + Math.sin(tt * 2 + i) * 10, z.y + Math.sin(a) * z.r * .85, 20, 1.5, 1.15, .45, .5 * life, 0);
        }
        break;
      }
      case 'decoy_beacon': {
        G.UtilityModels.draw(R, 'decoy_beacon', z.x, 6, z.y, tt * .6, 1, 0, 1.2);
        for (let i = 0; i < 3; i++) {
          const p = ((tt * .5 + i / 3) % 1);
          R.draw(U().torus, mm(z.x, 10, z.y, 0, p * 180 + 20, p * 180 + 20, p * 180 + 20),
            mat([.8, .45, 1.5], { emissive: [.7, .35, 1.4], alpha: (1 - p) * .5, shadow: false }));
        }
        R.glow(z.x, 24, z.y, 70, .7, .4, 1.4, .45, 0);
        break;
      }
      case 'shock_mine': {
        G.UtilityModels.draw(R, 'shock_mine', z.x, 4, z.y, 0, 1, 0, 1.2);
        R.decal(z.x, z.y, 60, .3, .9, 1.3, .3 + .2 * Math.sin(tt * 6), 2, .1, 0, true, .5);
        break;
      }
      case 'shockBurst': {
        const k = Math.min(1, age / .6);
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2;
          R.bolt(z.x, 4, z.y, z.x + Math.cos(a) * z.r * k, 8, z.y + Math.sin(a) * z.r * k, [.6, 1.4, 2], 3, 1 - k, i + 5, 6);
        }
        R.glow(z.x, 20, z.y, z.r * (1 - k) + 40, .5, 1.2, 1.8, (1 - k) * .7, 0);
        break;
      }
      case 'grappleLine': {
        const k = Math.max(0, 1 - age / z.dur);
        R.rib.line([z.x, 24, z.y, z.x2, 26, z.y2], 2.4, 1.6, .7, .9, 1.3, k);
        break;
      }
      case 'grapple': {
        R.glow(z.x, 26, z.y, 30, .6, .9, 1.3, .7, 0);
        break;
      }
      case 'iron_ward': {
        // the plate rides in front of the owner while the ward holds
        const bp = z.owner === 'me' ? bridge() : null;
        const px = bp && bp.player ? bp.player.x : z.x;
        const py = bp && bp.player ? bp.player.y : z.y;
        const ang = bp && bp.player ? (bp.player.angle || 0) : 0;
        G.UtilityModels.draw(R, 'iron_ward', px + Math.cos(ang) * 24, 15, py + Math.sin(ang) * 24, ang, .85, 0, 1.15);
        R.decal(px, py, 44, .55, .78, 1.1, .18 * life, 2, .1, 0, true, .6);
        break;
      }
      default: break;
    }
    if (u.color && (z.kind === 'smoke_grenade' || z.kind === 'tar_grenade')) {
      // subtle ground tint so the area reads from a distance
      R.decal(z.x, z.y, z.r, .2, .2, .25, .12 * life, 11, 0, 0, false, .3);
    }
  }

  function draw(R, F, tt) {
    if (!R || !R.ok) return;
    if (F && F.me && !F.idle) drawHeld(R, F.me, tt);
    drawProjectiles(R, tt);
    for (const z of st.zones) drawZone(R, z, tt);
    for (const z of st.remoteZones) drawZone(R, z, tt);
    for (const m of st.mines) {
      if (G.UtilityModels) G.UtilityModels.draw(R, 'shock_mine', m.x, 4, m.y, 0, 1, 0, 1.2);
      R.decal(m.x, m.y, 40, .3, .9, 1.3, m.arm > 0 ? .5 : (.2 + .2 * Math.sin(tt * 8)), 2, .1, 0, true, .5);
    }
  }

  /* ------------------------------------------------------------ flash fx */
  function ensureFlashEl() {
    let d = document.getElementById('utilFlash');
    if (!d) {
      d = document.createElement('div');
      d.id = 'utilFlash';
      // z-index 57 keeps this above the whole HUD but below the cinematic band
      // (58+): cutscene_state.js treats any full-screen fixed layer at 58-1000
      // as a cinematic, and a permanent white sheet would be "playing" forever.
      d.style.cssText = 'position:fixed;inset:0;background:#fff;pointer-events:none;z-index:57;opacity:0;transition:opacity .08s linear;';
      document.body.appendChild(d);
    }
    return d;
  }

  /* ------------------------------------------------------------------ loop */
  let last = 0, raf = 0;
  function loop(ts) {
    const t = ts / 1000;
    const dt = last ? Math.min(0.05, t - last) : 0.016;
    last = t;
    try { update(dt); } catch (e) { if (!loop._err) { loop._err = 1; console.warn('[utility]', e); } }
    const f = ensureFlashEl();
    if (f) f.style.opacity = st.flashT > 0 ? String(Math.min(.92, st.flashT * 1.9)) : '0';
    raf = requestAnimationFrame(loop);
  }

  function init() {
    // rendering rides the arena's own 3D pass
    const R = G.Render3D;
    if (R && R.collect && !R.collect._utilityHooked) {
      const orig = R.collect;
      R.collect = function (F, th) {
        const r = orig.apply(this, arguments);
        try { draw(R, F, th || 0); } catch (e) { if (!draw._err) { draw._err = 1; console.warn('[utility draw]', e); } }
        return r;
      };
      R.collect._utilityHooked = true;
    }

    // Aiming and the trigger itself live in utility_aim.js: this module only
    // flies what it is handed.
    if (!raf) raf = requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  setTimeout(init, 800);

  // The trigger asks for a wind-up; a quick tap (or any caller without an aim
  // module) still throws straight away at full strength.
  function aimStart() {
    if (G.UtilityAim) return G.UtilityAim.begin();
    return use();
  }

  G.UtilityGame = {
    use, draw, aimStart,
    aimRelease: () => (G.UtilityAim ? G.UtilityAim.release() : false),
    throwVel, gravity: GRAV,
    get reload() { return st.cd; },
    get ready() { return st.cd <= 0; },
    get throwT() { return st.throwT; },
    get equipped() { return equippedId(); }
  };
})(window);
