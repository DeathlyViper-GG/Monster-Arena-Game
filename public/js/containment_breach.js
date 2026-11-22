// ============================================================
// Monster Arena — CONTAINMENT BREACH
// Something got out of Site-7. Fight through eight sealed rooms of a
// research facility — each its own style, each stocked with a harder set
// of monsters than the one before — until the door of the ANOMALY room
// opens onto the thing that started it.
//
//   1 INTAKE HALL        sterile reception, first escapees
//   2 CHEMICAL LAB       acid pools, bombers and gunners
//   3 CRYO WING          frost wardens and ice-fogged cover
//   4 BIO GREENHOUSE     healers, swarms and spore light
//   5 REACTOR CORE       magma things, vents that erupt on a timer
//   6 SERVER CORE        storm callers, snipers, acid + vents
//   7 SPECIMEN VAULT     everything, all at once, no healing
//   8 ANOMALY            boss — three phases
//
// A room's exit stays sealed until everything inside is dead. Built on the
// same engine hooks as Sky Parkour (world walls, floor/3D hooks, wave
// suppression). Rendering lives in containment_gfx.js. Exposes
// window.Containment.
// ============================================================
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const T = 40;                       // wall thickness
  const DOOR = 170;                   // doorway width

  // ----------------------------------------------------------- layout
  // Row A runs east; the corridor drops to row B, which runs west to the ANOMALY room.
  const RW = 640, RH = 640;
  const ROOMS = [
    { id: 'intake',   name: 'INTAKE HALL',      sub: 'Sterile · first escapees',           x: 100,  y: 250,  w: RW, h: RH, accent: '#8fd0ff' },
    { id: 'chem',     name: 'CHEMICAL LAB',     sub: 'Acid pools · gunners and bombers',   x: 1120, y: 250,  w: RW, h: RH, accent: '#9dff6a' },
    { id: 'cryo',     name: 'CRYO WING',        sub: 'Frost wardens · ice fog',            x: 2140, y: 250,  w: RW, h: RH, accent: '#a8f0ff' },
    { id: 'bio',      name: 'BIO GREENHOUSE',   sub: 'Swarms · healers · spore light',     x: 3160, y: 250,  w: RW, h: RH, accent: '#58ffb0' },
    { id: 'reactor',  name: 'REACTOR CORE',     sub: 'Magma things · erupting vents',      x: 3160, y: 1500, w: RW, h: RH, accent: '#ff8a3a' },
    { id: 'server',   name: 'SERVER CORE',      sub: 'Storm callers · snipers',            x: 2140, y: 1500, w: RW, h: RH, accent: '#b48aff' },
    { id: 'vault',    name: 'SPECIMEN VAULT',   sub: 'Everything that was ever kept',      x: 1120, y: 1500, w: RW, h: RH, accent: '#ff4a5a' },
    { id: 'anomaly',  name: 'ANOMALY',          sub: 'It was never contained',             x: 60,   y: 1350, w: 680, h: 1100, accent: '#ff3df0', boss: true }
  ];
  ROOMS.forEach((r, i) => { r.i = i; r.cx = r.x + r.w / 2; r.cy = r.y + r.h / 2; });

  // Spawn tables: [type, count]. Later rooms are bigger, meaner and ever more varied.
  const SPAWNS = [
    [['chaser', 5], ['shooter', 1]],
    [['chaser', 4], ['shooter', 3], ['bomber', 2]],
    [['rimewarden', 3], ['shooter', 3], ['tank', 1], ['chaser', 3]],
    [['chaser', 8], ['healer', 2], ['bomber', 2], ['soulmote', 2]],
    [['magmalurk', 3], ['tank', 2], ['bomber', 3], ['shooter', 2]],
    [['stormcaller', 3], ['sniper', 3], ['shooter', 3], ['healer', 1], ['chaser', 3]],
    [['quakestrider', 3], ['tank', 3], ['sniper', 2], ['bomber', 3], ['chaser', 6], ['shooter', 3]],
    []
  ];
  // Raised platforms to jump across. Each is a real engine surface (the player, monsters and bullets
  // stand on it), reachable with the stock jump (apex ~157): first steps <= 60, later steps <= 50 up.
  const PLAT = {
    0: [[.16, .66, 110, 70, 44, 'desk'], [.64, .20, 110, 70, 44, 'desk']],
    1: [[.10, .14, 130, 80, 56, 'bench'], [.38, .42, 120, 80, 104, 'bench'], [.68, .16, 130, 80, 56, 'bench'], [.66, .62, 130, 80, 104, 'bench']],
    2: [[.12, .12, 110, 80, 60, 'pod'], [.38, .30, 110, 80, 108, 'pod'], [.66, .12, 110, 80, 60, 'pod'], [.42, .68, 170, 80, 62, 'tank']],
    3: [[.08, .52, 130, 70, 52, 'root'], [.32, .30, 130, 70, 98, 'root'], [.56, .52, 130, 70, 142, 'root'], [.78, .26, 120, 110, 96, 'root']],
    4: [[.20, .12, 150, 70, 80, 'gantry'], [.62, .16, 150, 70, 80, 'gantry'], [.70, .56, 150, 70, 80, 'gantry'], [.20, .62, 150, 70, 80, 'gantry'], [.42, .84, 120, 60, 128, 'gantry']],
    5: [[.06, .42, 90, 130, 92, 'rack'], [.26, .42, 90, 130, 134, 'rack'], [.46, .42, 90, 130, 92, 'rack'], [.66, .42, 90, 130, 134, 'rack'], [.84, .42, 90, 130, 92, 'rack']],
    6: [[.08, .76, 90, 90, 50, 'crate'], [.24, .60, 90, 90, 100, 'crate'], [.42, .44, 170, 90, 150, 'gantry'], [.70, .16, 120, 90, 100, 'crate'], [.78, .56, 90, 90, 56, 'crate']],
    7: [[.14, .14, 120, 120, 60, 'debris'], [.66, .14, 120, 120, 100, 'debris'], [.12, .72, 120, 120, 100, 'debris'], [.68, .72, 120, 120, 60, 'debris']]
  };
  const PLATFORMS = [];
  ROOMS.forEach((r, i) => (PLAT[i] || []).forEach((q) => {
    const ix = r.x + T + 30, iy = r.y + T + 30, iw = r.w - 2 * T - 60, ih = r.h - 2 * T - 60;
    PLATFORMS.push({ room: i, x: Math.round(ix + (iw - q[2]) * q[0] / .9), y: Math.round(iy + (ih - q[3]) * q[1] / .9), w: q[2], h: q[3], z: q[4], kind: q[5], id: PLATFORMS.length });
  }));
  PLATFORMS.forEach((p) => { const r = ROOMS[p.room]; p.x = Math.max(r.x + T + 24, Math.min(r.x + r.w - T - 24 - p.w, p.x)); p.y = Math.max(r.y + T + 24, Math.min(r.y + r.h - T - 24 - p.h, p.y)); });

  const HAZ = {   // acid = standing damage; vent = telegraphed eruption
    1: [{ k: 'acid', fx: .28, fy: .3, r: 84 }, { k: 'acid', fx: .74, fy: .68, r: 96 }],
    4: [{ k: 'vent', fx: .3, fy: .3, r: 78 }, { k: 'vent', fx: .7, fy: .3, r: 78 }, { k: 'vent', fx: .3, fy: .72, r: 78 }, { k: 'vent', fx: .7, fy: .72, r: 78 }],
    5: [{ k: 'acid', fx: .5, fy: .5, r: 70 }, { k: 'vent', fx: .22, fy: .5, r: 70 }, { k: 'vent', fx: .78, fy: .5, r: 70 }],
    6: [{ k: 'vent', fx: .5, fy: .22, r: 74 }, { k: 'vent', fx: .5, fy: .78, r: 74 }, { k: 'acid', fx: .2, fy: .5, r: 80 }, { k: 'acid', fx: .8, fy: .5, r: 80 }]
  };

  // walls[] with doorways, corridors and sealable doors
  function wallSide(out, x, y, len, horiz, gap) {
    // gap = [g0, g1] offsets along the side (or null)
    const seg = (a, b) => { if (b - a < 1) return; out.push(horiz ? { x: x + a, y, w: b - a, h: T } : { x, y: y + a, w: T, h: b - a }); };
    if (!gap) seg(0, len); else { seg(0, gap[0]); seg(gap[1], len); }
  }
  function buildLayout() {
    const walls = [], doors = [], corridors = [];
    const gaps = ROOMS.map(() => ({ L: null, R: null, T: null, B: null }));
    const doorRect = (r, side) => {
      if (side === 'R') return { x: r.x + r.w - T, y: r.cy - DOOR / 2, w: T, h: DOOR };
      if (side === 'L') return { x: r.x, y: r.cy - DOOR / 2, w: T, h: DOOR };
      if (side === 'B') return { x: r.cx - DOOR / 2, y: r.y + r.h - T, w: DOOR, h: T };
      return { x: r.cx - DOOR / 2, y: r.y, w: DOOR, h: T };
    };
    // links 0→1→2→3 east, 3→4 south, 4→5→6→7 west
    const link = (a, b, sa, sb) => {
      const A = ROOMS[a], B = ROOMS[b];
      gaps[a][sa] = sa === 'R' || sa === 'L' ? [A.h / 2 - DOOR / 2, A.h / 2 + DOOR / 2] : [A.w / 2 - DOOR / 2, A.w / 2 + DOOR / 2];
      gaps[b][sb] = sb === 'R' || sb === 'L' ? [B.h / 2 - DOOR / 2, B.h / 2 + DOOR / 2] : [B.w / 2 - DOOR / 2, B.w / 2 + DOOR / 2];
      // anomaly is taller than its neighbour: align its doorway with the neighbour's
      if (B.boss) { const off = A.cy - B.y; gaps[b][sb] = [off - DOOR / 2, off + DOOR / 2]; }
      const dr = doorRect(A, sa); doors.push({ from: a, to: b, rect: dr, open: false });
      if (sa === 'R') { corridors.push({ x: A.x + A.w, y: A.cy - DOOR / 2, w: B.x - (A.x + A.w), h: DOOR }); }
      else if (sa === 'L') { corridors.push({ x: B.x + B.w, y: A.cy - DOOR / 2, w: A.x - (B.x + B.w), h: DOOR }); }
      else { corridors.push({ x: A.cx - DOOR / 2, y: A.y + A.h, w: DOOR, h: B.y - (A.y + A.h) }); }
    };
    link(0, 1, 'R', 'L'); link(1, 2, 'R', 'L'); link(2, 3, 'R', 'L'); link(3, 4, 'B', 'T');
    link(4, 5, 'L', 'R'); link(5, 6, 'L', 'R'); link(6, 7, 'L', 'R');
    ROOMS.forEach((r, i) => {
      wallSide(walls, r.x, r.y, r.w, true, gaps[i].T); wallSide(walls, r.x, r.y + r.h - T, r.w, true, gaps[i].B);
      wallSide(walls, r.x, r.y, r.h, false, gaps[i].L); wallSide(walls, r.x + r.w - T, r.y, r.h, false, gaps[i].R);
    });
    // the doorway into the anomaly room sits at a different height — build its door from the actual gap
    const bd = doors[6], B = ROOMS[7], g = gaps[7].R; bd.rect = { x: B.x + B.w - T, y: B.y + g[0], w: T, h: DOOR };
    corridors[6] = { x: B.x + B.w, y: B.y + g[0], w: ROOMS[6].x - (B.x + B.w), h: DOOR };
    corridors.forEach((c) => {
      if (c.w > c.h) { walls.push({ x: c.x, y: c.y - T, w: c.w, h: T }, { x: c.x, y: c.y + c.h, w: c.w, h: T }); }
      else { walls.push({ x: c.x - T, y: c.y, w: T, h: c.h }, { x: c.x + c.w, y: c.y, w: T, h: c.h }); }
    });
    return { walls, doors, corridors };
  }
  const LAYOUT = buildLayout();

  // -------------------------------------------------------------- state
  const S = { active: false, done: false, t: 0, raf: 0, last: 0, room: 0, rooms: [], deaths: 0, kills: 0, hud: null, flashEl: null, flashT: 0, prevHook: undefined, boss: null, hurtCD: 0, haz: [], hpFlash: 0 };
  const player = () => (window.__dbg && window.__dbg.player) || null;
  const enemies = () => { const d = window.__dbg; return (d && d.ents && d.ents.enemies) || []; };
  const ebullets = () => { const d = window.__dbg; return (d && d.ents && d.ents.ebullets) || []; };
  const shake = (v) => { try { window._Gauntlet && window._Gauntlet.camShake(v); } catch (_) {} };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const inner = (r, m) => ({ x: r.x + T + (m || 0), y: r.y + T + (m || 0), w: r.w - 2 * T - 2 * (m || 0), h: r.h - 2 * T - 2 * (m || 0) });
  const inRect = (r, x, y, pad) => x >= r.x - (pad || 0) && x <= r.x + r.w + (pad || 0) && y >= r.y - (pad || 0) && y <= r.y + r.h + (pad || 0);
  function roomAt(x, y) { for (const r of ROOMS) if (inRect(r, x, y, 0)) return r; return null; }

  // walls currently solid = shell + still-sealed doors
  function solidWalls() {
    const w = LAYOUT.walls.map((q) => ({ x: q.x, y: q.y, w: q.w, h: q.h }));
    LAYOUT.doors.forEach((d) => { if (!d.open) w.push({ x: d.rect.x, y: d.rect.y, w: d.rect.w, h: d.rect.h }); });
    return w;
  }
  function applyWalls() {
    const G = window._Gauntlet; if (!G || !G.world) return;
    const world = G.world;
    world.walls.length = 0; solidWalls().forEach((q) => world.walls.push(q));
    world.buildings.length = 0; world.hazards.length = 0; world.chests.length = 0;
    // outer arena frame so nothing leaves the map
    const W = world.w, H = world.h;
    const frame = [{ x: 0, y: 0, w: W, h: 40 }, { x: 0, y: H - 40, w: W, h: 40 }, { x: 0, y: 0, w: 40, h: H }, { x: W - 40, y: 0, w: 40, h: H }];
    frame.forEach((q) => world.walls.push(q));
    world.solids = frame.map((q) => ({ x: q.x, y: q.y, w: q.w, h: q.h }));      // only the arena frame is engine scenery; the lab is drawn by containment_gfx.js
    try { G.api.nav.rebuild(); } catch (_) {}
  }
  // lab platforms become real engine surfaces, exactly like Sky Parkour's islands
  function syncPlatforms() {
    const D = window.W3 && window.W3.data; if (!D || !D.surfaces) return;
    if (D._cbOwn && D._cbOwn.length === PLATFORMS.length && D.surfaces.indexOf(D._cbOwn[0]) >= 0) return;
    if (D._cbOwn) for (const sf of D._cbOwn) { const i = D.surfaces.indexOf(sf); if (i >= 0) D.surfaces.splice(i, 1); }
    const own = [];
    for (const p of PLATFORMS) { const sf = { x: p.x, y: p.y, w: p.w, h: p.h, ax: 'x', dir: 1, z0: p.z, z1: p.z, k: 'deck' }; D.surfaces.push(sf); own.push(sf); }
    D._cbOwn = own;
    const IDX = 96, m = new Map();
    for (const it of D.surfaces) {
      if (it.k === 'roof') continue;
      const x0 = Math.floor(it.x / IDX), x1 = Math.floor((it.x + it.w) / IDX), y0 = Math.floor(it.y / IDX), y1 = Math.floor((it.y + it.h) / IDX);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const k = cx * 4096 + cy; let a = m.get(k); if (!a) m.set(k, a = []); a.push(it); }
    }
    D.iF = m;
  }
  function dropPlatforms() {
    const D = window.W3 && window.W3.data; if (!D || !D._cbOwn) return;
    for (const sf of D._cbOwn) { const i = D.surfaces.indexOf(sf); if (i >= 0) D.surfaces.splice(i, 1); }
    D._cbOwn = null;
  }

  function hookWorldBuild() {
    const prev = window._onWorldBuilt;
    if (prev && prev.__cb) return;
    const fn = function (w, theme) { if (prev) prev.call(this, w, theme); if (S.active) setTimeout(applyWalls, 0), applyWalls(); };
    fn.__cb = true; window._onWorldBuilt = fn;
  }

  // ------------------------------------------------------------ lockdown siren
  const Alarm = (function () {
    let ctx = null, o = null, g = null, lfo = null, on = false;
    const ensure = () => { if (ctx) return ctx; try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); } catch (_) {} return ctx; };
    return {
      start() {
        if (on) return; const c = ensure(); if (!c) return; if (c.state === 'suspended') c.resume().catch(() => {});
        o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 640; g = c.createGain(); g.gain.value = 0.022;
        lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 0.9; const lg = c.createGain(); lg.gain.value = 150; lfo.connect(lg); lg.connect(o.frequency);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; o.connect(lp); lp.connect(g); g.connect(c.destination); o.start(); lfo.start(); on = true;
      },
      stop() { if (!on) return; try { o.stop(); lfo.stop(); } catch (_) {} on = false; },
      chime() { const c = ensure(); if (!c) return; const t = c.currentTime; [660, 880, 1320].forEach((f, i) => { const x = c.createOscillator(), y = c.createGain(); x.type = 'sine'; x.frequency.value = f; y.gain.setValueAtTime(0, t + i * .12); y.gain.linearRampToValueAtTime(.05, t + i * .12 + .02); y.gain.exponentialRampToValueAtTime(.001, t + i * .12 + .5); x.connect(y); y.connect(c.destination); x.start(t + i * .12); x.stop(t + i * .12 + .55); }); },
    };
  })();

  // ------------------------------------------------------------ monsters
  function spawnRoom(i) {
    const R = ROOMS[i], rs = S.rooms[i]; if (rs.spawned) return;
    const d = window.__dbg; if (!d || !d.spawnEnemy) return;
    const box = inner(R, 70), P = player();
    const hpMul = 1 + i * .38, spMul = 1 + i * .035;
    (SPAWNS[i] || []).forEach(([type, n]) => {
      for (let k = 0; k < n; k++) {
        let x = 0, y = 0, tries = 0;
        do { x = rnd(box.x, box.x + box.w); y = rnd(box.y, box.y + box.h); tries++; } while (tries < 30 && P && Math.hypot(x - P.x, y - P.y) < 300);
        try { d.spawnEnemy(type, x, y); } catch (_) { continue; }
        const e = enemies()[enemies().length - 1]; if (!e) continue;
        e.hp = e.maxhp = Math.round(e.hp * hpMul); e.speed *= spMul;
        e.detectR = 1500; e.alerted = true; e.alertT = 6; e._cbRoom = i; rs.count++;
      }
    });
    rs.spawned = true; rs.alive = rs.count; rs.t0 = S.t; Alarm.start();
    haz(i);
    flash(R.name, R.accent, R.sub); shake(6);
  }
  function aliveIn(i) { return enemies().filter((e) => e && e.hp > 0 && e._cbRoom === i).length; }
  function haz(i) {
    const R = ROOMS[i]; S.haz = (HAZ[i] || []).map((h, k) => ({ k: h.k, x: R.x + R.w * h.fx, y: R.y + R.h * h.fy, r: h.r, ph: k * .9, st: 'idle', t: 0 }));
  }

  // ---------------------------------------------------------- damage
  function hurt(n) {
    const P = player(); if (!P || P.hp <= 0 || (P.dashI || 0) > 0 || S.hurtCD > 0) return false;
    S.hurtCD = .28; let left = n;
    if (P.shield > 0) { const a = Math.min(P.shield, left); P.shield -= a; left -= a; }
    if (left > 0) P.hp -= left;
    S.hpFlash = .35; shake(Math.min(10, 2 + n * .12));
    return true;
  }
  function hazards(dt) {
    const P = player(); if (!P || P.hp <= 0) return;
    S.haz.forEach((h) => {
      const d = Math.hypot(P.x - h.x, P.y - h.y);
      if (h.k === 'acid') { if (d < h.r && (P.z || 0) < 40) { S.acidT = (S.acidT || 0) + dt; if (S.acidT > .35) { S.acidT = 0; hurt(7 + S.room); } } }
      else {
        h.t += dt;
        if (h.st === 'idle' && h.t > 3.6 + h.ph) { h.st = 'warn'; h.t = 0; }
        else if (h.st === 'warn' && h.t > 1.2) { h.st = 'burst'; h.t = 0; shake(5); if (d < h.r * 1.15 && (P.z || 0) < 70) hurt(22 + S.room * 2); }
        else if (h.st === 'burst' && h.t > .5) { h.st = 'idle'; h.t = 0; }
      }
    });
  }

  // ---------------------------------------------------------- the ANOMALY
  const ATT = {
    pulse:    { name: 'Containment Pulse', min: 1, wind: .6, tele: .9, act: 1.3, rec: .6 },
    rift:     { name: 'Rift Lances',       min: 1, wind: .6, tele: 1.1, act: 2.4, rec: .8 },
    summon:   { name: 'Escape Protocol',   min: 1, wind: .8, tele: .6, act: .4,  rec: 1.0 },
    tear:     { name: 'Reality Tear',      min: 2, wind: .5, tele: 1.3, act: .6,  rec: .8 },
    gravity:  { name: 'Gravity Collapse',  min: 2, wind: .6, tele: 1.6, act: .5,  rec: .9 },
    failure:  { name: 'Total Containment Failure', min: 3, wind: .8, tele: 2.4, act: .8, rec: 1.4 }
  };
  function spawnBoss() {
    const d = window.__dbg, R = ROOMS[7]; if (!d) return;
    d.spawnEnemy('tank', R.cx, R.cy - 80);
    const e = enemies()[enemies().length - 1]; if (!e) return;
    e._cb = { cur: null, idle: 1.6, last: null, phase: 1, intro: 3.2, spin: 0, hitFlash: 0, burst: -9 };
    e.hp = e.maxhp = 6500; e.r = 58; e.speed = 0; e.detectR = 3000; e.alerted = true; e._cbRoom = 7; e._boss = true;
    S.boss = e; S.rooms[7].count = 1; S.rooms[7].spawned = true;
    flash('ANOMALY', '#ff3df0', 'Containment has failed'); shake(16); Alarm.start();
  }
  function bossPhase(e) { const f = e.hp / e.maxhp; return f > .66 ? 1 : f > .33 ? 2 : 3; }
  function startAttack(e, key) {
    const A = ATT[key], P = player(), b = e._cb;
    const ph = bossPhase(e), sp = ph === 3 ? .78 : ph === 2 ? .9 : 1;
    const cur = { key, name: A.name, phase: 'windup', t: 0, phases: { windup: A.wind * sp, tele: A.tele * sp, active: A.act, recover: A.rec * sp }, dmg: 20 + ph * 6 };
    const R = ROOMS[7], box = inner(R, 40);
    if (key === 'pulse') { cur.cx = e.x; cur.cy = e.y; cur.r = 0; cur.maxR = 760; cur.band = 40; cur.spd = 520 + ph * 60; cur.hit = false; cur.double = ph >= 3; }
    if (key === 'rift') { cur.n = ph === 1 ? 3 : ph === 2 ? 4 : 5; cur.ang = Math.atan2(P.y - e.y, P.x - e.x); cur.len = 1200; cur.sweep = (Math.random() < .5 ? -1 : 1) * (.55 + ph * .15); cur.w = 34; }
    if (key === 'tear') { cur.zones = []; const n = 4 + ph * 2; for (let i = 0; i < n; i++) cur.zones.push({ x: i === 0 ? P.x : rnd(box.x, box.x + box.w), y: i === 0 ? P.y : rnd(box.y, box.y + box.h), r: 105, hit: false }); }
    if (key === 'gravity') { cur.cx = e.x; cur.cy = e.y; cur.pullR = 900; cur.blastR = 300; cur.hit = false; }
    if (key === 'failure') { cur.zones = []; for (let i = 0; i < 3; i++) cur.zones.push({ x: rnd(box.x + 150, box.x + box.w - 150), y: rnd(box.y + 150, box.y + box.h - 150), r: 150, safe: true }); cur.hit = false; }
    b.cur = cur;
  }
  function pickAttack(e) {
    const ph = bossPhase(e), b = e._cb, pool = Object.keys(ATT).filter((k) => ATT[k].min <= ph && k !== 'failure');
    if (ph === 3 && (!b.lastFail || S.t - b.lastFail > 16)) { b.lastFail = S.t; return 'failure'; }
    const opts = pool.filter((k) => k !== b.last); return opts[(Math.random() * opts.length) | 0];
  }
  function tickBoss(e, dt) {
    const b = e._cb, P = player(); if (!P) return;
    e.stunT = 99; e.vx = 0; e.vy = 0;                     // the stock AI never runs — this body is driven from here
    const ph = bossPhase(e); if (ph !== b.phase) { b.phase = ph; b.burst = S.t; shake(18); flash('PHASE ' + ph, '#ff3df0', ph === 2 ? 'The walls remember what it was' : 'It stops pretending'); }
    b.spin += dt * (1 + ph * .5);
    if (b.intro > 0) { b.intro -= dt; return; }
    const R = ROOMS[7], box = inner(R, e.r + 10);
    // slow drift keeping a hunting distance
    if (!b.cur || b.cur.phase === 'recover') {
      const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1, want = 380, v = (ph === 3 ? 120 : 80);
      const s = d > want ? v : -v * .5; e.x = clamp(e.x + dx / d * s * dt, box.x, box.x + box.w); e.y = clamp(e.y + dy / d * s * dt, box.y, box.y + box.h);
    }
    const c = b.cur;
    if (!c) { b.idle -= dt; if (b.idle <= 0) { const k = pickAttack(e); b.last = k; startAttack(e, k); } return; }
    c.t += dt;
    const lim = c.phases[c.phase];
    if (c.phase === 'tele' && c.key === 'rift') { c.ang = Math.atan2(P.y - e.y, P.x - e.x) * .06 + c.ang * .94; }
    if (c.phase === 'active') activeAttack(e, c, dt, P);
    if (c.t >= lim) {
      c.t = 0;
      if (c.phase === 'windup') c.phase = 'tele';
      else if (c.phase === 'tele') { c.phase = 'active'; if (c.key === 'summon') summon(e); if (c.key === 'pulse') shake(10); if (c.key === 'tear') { shake(12); c.zones.forEach((z) => { if (Math.hypot(P.x - z.x, P.y - z.y) < z.r) hurt(c.dmg); }); } if (c.key === 'gravity') { c.cx = e.x; c.cy = e.y; } }
      else if (c.phase === 'active') {
        if (c.key === 'gravity') { shake(20); if (Math.hypot(P.x - c.cx, P.y - c.cy) < c.blastR) hurt(c.dmg + 14); }
        if (c.key === 'failure') { shake(22); const safe = c.zones.some((z) => Math.hypot(P.x - z.x, P.y - z.y) < z.r); if (!safe) hurt(c.dmg * 2.6); }
        c.phase = 'recover';
      }
      else { b.cur = null; b.idle = ph === 3 ? .35 : ph === 2 ? .7 : 1.1; }
    }
  }
  function summon(e) {
    const d = window.__dbg, R = ROOMS[7]; const n = bossPhase(e) + 2;
    for (let i = 0; i < n; i++) {
      const a = TAU * i / n + Math.random(), x = clamp(e.x + Math.cos(a) * 140, R.x + T + 40, R.x + R.w - T - 40), y = clamp(e.y + Math.sin(a) * 140, R.y + T + 40, R.y + R.h - T - 40);
      try { d.spawnEnemy(i % 3 === 2 ? 'shooter' : 'chaser', x, y); } catch (_) { continue; }
      const m = enemies()[enemies().length - 1]; if (m) { m.hp = m.maxhp = Math.round(m.hp * 3); m.detectR = 1500; m.alerted = true; m._cbRoom = 7; m._minion = true; }
    }
    shake(8);
  }
  function activeAttack(e, c, dt, P) {
    if (c.key === 'pulse') {
      const prev = c.r; c.r += c.spd * dt;
      const d = Math.hypot(P.x - c.cx, P.y - c.cy);
      if (!c.hit && d > prev - c.band && d < c.r + 4 && (P.z || 0) < 40) { c.hit = true; hurt(c.dmg); }
      if (c.double) { const r2 = c.r - 260; if (r2 > 0 && !c.hit2 && d > r2 - c.band && d < r2 + 4 && (P.z || 0) < 40) { c.hit2 = true; hurt(c.dmg); } }
    } else if (c.key === 'rift') {
      const base = c.ang + c.sweep * (c.t / c.phases.active) * 1.6;
      for (let i = 0; i < c.n; i++) {
        const a = base + i * TAU / c.n, dx = P.x - e.x, dy = P.y - e.y, along = dx * Math.cos(a) + dy * Math.sin(a), perp = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
        if (along > 0 && along < c.len && perp < c.w) hurt(c.dmg * .8);
      }
    } else if (c.key === 'gravity') {
      const dx = c.cx - P.x, dy = c.cy - P.y, d = Math.hypot(dx, dy) || 1;
      if (d < c.pullR) { const pull = 520 * (1 - d / c.pullR) + 120; const nx = P.x + dx / d * pull * dt, ny = P.y + dy / d * pull * dt; const w = window._Gauntlet.world; if (!w.isBlocked(nx, ny, 16)) { P.x = nx; P.y = ny; } }
    }
  }

  // ------------------------------------------------------------- loop
  function tick(dt) {
    S.t += dt; S.hurtCD = Math.max(0, S.hurtCD - dt); S.hpFlash = Math.max(0, S.hpFlash - dt);
    const P = player(); if (!P) return;
    if (P.hp <= 0) return;
    const here = roomAt(P.x, P.y);
    if (here) {
      if (here.i !== S.room && here.i > S.room && S.rooms[here.i - 1] && S.rooms[here.i - 1].cleared) S.room = here.i;
      if (here.i === S.room && !S.rooms[here.i].spawned && here.i < 8) {
        const inn = inner(here, 30);
        if (inRect(inn, P.x, P.y, 0)) { if (here.boss) { spawnBoss(); sealBehind(); } else spawnRoom(here.i); }
      }
    }
    S.rooms.forEach((rs, i) => {
      if (!rs.spawned || rs.cleared) return;
      rs.alive = aliveIn(i);
      if (rs.alive === 0 && !(i === 7 && S.boss && S.boss.hp > 0)) {
        rs.cleared = true; shake(8); Alarm.stop(); Alarm.chime();
        if (i === 7) return complete();
        const d = LAYOUT.doors[i]; if (d) { d.open = true; applyWalls(); }
        flash(ROOMS[i].name + ' SECURED', ROOMS[i].accent, 'Exit unsealed'); S.haz = [];
        // a little relief between rooms: top the player up a bit
        if (P.hpMax) P.hp = Math.min(P.hpMax, P.hp + P.hpMax * .25);
      }
    });
    syncPlatforms();
    hazards(dt);
    if (S.boss && S.boss.hp > 0) tickBoss(S.boss, dt);
    else if (S.boss && S.boss.hp <= 0 && S.rooms[7] && !S.rooms[7].cleared) { S.rooms[7].cleared = true; enemies().forEach((e) => { if (e && e._minion) e.hp = 0; }); complete(); }
    if (S.flashT > 0) { S.flashT -= dt; if (S.flashT <= 0 && S.flashEl) S.flashEl.style.opacity = '0'; }
  }
  function sealBehind() { const d = LAYOUT.doors[6]; d.open = false; applyWalls(); }
  function loop() {
    if (!S.active) return;
    const now = performance.now(), dt = Math.min(.06, (now - (S.last || now)) / 1000); S.last = now;
    try { tick(dt); } catch (err) { console.warn('[Containment] tick', err); }
    if ((S.hudT = (S.hudT || 0) + 1) % 5 === 0) hud();
    S.raf = requestAnimationFrame(loop);
  }

  // -------------------------------------------------------------- HUD
  function css() {
    if (document.getElementById('cbStyle')) return;
    const st = document.createElement('style'); st.id = 'cbStyle';
    st.textContent = `
#cbHud{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:7;pointer-events:none;display:flex;flex-direction:column;gap:6px;align-items:center;font:700 11px/1.2 ui-sans-serif,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#e8f2ff;background:linear-gradient(180deg,rgba(8,12,20,.88),rgba(4,6,12,.78));border:1px solid var(--cb,#8fd0ff);border-radius:12px;padding:8px 18px;box-shadow:0 10px 30px rgba(0,0,0,.55),0 0 24px color-mix(in srgb,var(--cb,#8fd0ff) 30%,transparent)}
#cbHud .t{font-size:12px;letter-spacing:.26em;color:#fff;text-shadow:0 0 14px var(--cb)}#cbHud .r{display:flex;gap:12px;opacity:.9}
#cbHud .pips{display:flex;gap:5px}#cbHud .pips i{width:20px;height:4px;border-radius:2px;background:rgba(255,255,255,.15)}#cbHud .pips i.on{background:var(--c);box-shadow:0 0 8px var(--c)}#cbHud .pips i.cur{background:#fff}
#cbBoss{position:fixed;left:50%;top:92px;transform:translateX(-50%);width:min(560px,80vw);z-index:7;pointer-events:none;display:none;text-align:center;font:800 12px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.4em;color:#ff9af6;text-shadow:0 0 14px #ff3df0}
#cbBoss .bar{margin-top:8px;height:12px;border-radius:8px;background:rgba(0,0,0,.65);border:1px solid #ff3df0;overflow:hidden;box-shadow:0 0 18px rgba(255,61,240,.5)}
#cbBoss .bar b{display:block;height:100%;width:100%;background:linear-gradient(90deg,#7a1a9a,#ff3df0,#ffd6fb);transition:width .15s}
#cbBoss small{display:block;margin-top:6px;font-size:10px;letter-spacing:.28em;opacity:.8}
#cbFlash{position:fixed;left:50%;top:24%;transform:translateX(-50%);z-index:7;pointer-events:none;text-align:center;opacity:0;transition:opacity .35s}
#cbFlash b{display:block;font:900 clamp(24px,4.4vw,52px)/1.05 ui-sans-serif,system-ui,sans-serif;letter-spacing:.2em;text-shadow:0 0 22px currentColor,0 3px 12px #000}#cbFlash span{display:block;margin-top:8px;font:600 clamp(11px,1.4vw,15px)/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.34em;text-transform:uppercase;color:#dfe8f5;text-shadow:0 2px 8px #000}
#cbVig{position:fixed;inset:0;z-index:6;pointer-events:none;background:radial-gradient(ellipse at center,transparent 55%,rgba(255,30,60,.55));opacity:0;transition:opacity .15s}
#cbOverlay{position:fixed;inset:0;z-index:30;display:none;place-items:center;background:rgba(3,5,10,.86);backdrop-filter:blur(6px)}
#cbOverlay .c{width:min(460px,90vw);border-radius:18px;padding:26px 24px;text-align:center;background:linear-gradient(180deg,rgba(14,20,34,.97),rgba(6,8,16,.97));border:1px solid #ff3df0;box-shadow:0 24px 70px rgba(0,0,0,.6),0 0 40px rgba(255,61,240,.3);color:#e8f0ff;font-family:ui-sans-serif,system-ui,sans-serif}
#cbOverlay h2{margin:0;font:900 22px/1.2 ui-sans-serif,system-ui,sans-serif;letter-spacing:.22em;color:#fff;text-shadow:0 0 22px #ff3df0}#cbOverlay p{margin:8px 0 0;font-size:12px;opacity:.75;letter-spacing:.05em}
#cbOverlay .g{margin:18px 0 6px;display:grid;gap:8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase}#cbOverlay .g div{display:flex;justify-content:space-between;padding:7px 12px;border-radius:10px;background:rgba(255,255,255,.06)}#cbOverlay .g b{opacity:.6;font-weight:600}
#cbOverlay .b{display:flex;gap:10px;margin-top:18px}#cbOverlay button{flex:1;padding:11px 14px;border-radius:12px;border:1px solid rgba(255,140,250,.6);background:linear-gradient(180deg,#7a2a9a,#4a1a64);color:#fff;font:700 12px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}#cbOverlay button.gh{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.25)}`;
    document.head.appendChild(st);
  }
  function buildHud() {
    css();
    if (!S.hud) {
      const d = document.createElement('div'); d.id = 'cbHud'; d.innerHTML = '<div class="t">CONTAINMENT BREACH</div><div class="pips"></div><div class="r"><span class="rn">—</span><span class="rs">—</span></div>'; document.body.appendChild(d); S.hud = d;
      const f = document.createElement('div'); f.id = 'cbFlash'; f.innerHTML = '<b></b><span></span>'; document.body.appendChild(f); S.flashEl = f;
      const bb = document.createElement('div'); bb.id = 'cbBoss'; bb.innerHTML = 'THE ANOMALY<div class="bar"><b></b></div><small></small>'; document.body.appendChild(bb);
      const v = document.createElement('div'); v.id = 'cbVig'; document.body.appendChild(v);
      const o = document.createElement('div'); o.id = 'cbOverlay'; o.innerHTML = '<div class="c"><h2>CONTAINED</h2><p></p><div class="g"></div><div class="b"><button id="cbAgain">▶ Run it again</button><button id="cbLeave" class="gh">Home</button></div></div>'; document.body.appendChild(o);
      o.querySelector('#cbAgain').onclick = () => { o.style.display = 'none'; start(); };
      o.querySelector('#cbLeave').onclick = () => { o.style.display = 'none'; goMenu(); };
    } else { S.hud.style.display = ''; }
  }
  function hud() {
    if (!S.hud) return; const R = ROOMS[Math.min(S.room, 7)], rs = S.rooms[S.room];
    S.hud.style.setProperty('--cb', R.accent); S.hud.style.setProperty('--c', R.accent);
    S.hud.querySelector('.pips').innerHTML = ROOMS.map((r, i) => '<i style="--c:' + r.accent + '" class="' + (S.rooms[i] && S.rooms[i].cleared ? 'on' : (i === S.room ? 'cur' : '')) + '"></i>').join('');
    S.hud.querySelector('.rn').textContent = (S.room + 1) + '/8 · ' + R.name;
    S.hud.querySelector('.rs').textContent = !rs || !rs.spawned ? 'enter' : rs.cleared ? 'sealed door open' : (rs.alive + ' hostile');
    const bb = document.getElementById('cbBoss'), e = S.boss;
    if (bb) { if (e && e.hp > 0 && S.room === 7) { bb.style.display = 'block'; bb.querySelector('b').style.width = Math.max(0, e.hp / e.maxhp * 100) + '%'; bb.querySelector('small').textContent = 'PHASE ' + bossPhase(e) + (e._cb.cur ? ' · ' + e._cb.cur.name : ''); } else bb.style.display = 'none'; }
    const v = document.getElementById('cbVig'); if (v) v.style.opacity = S.hpFlash > 0 ? String(Math.min(1, S.hpFlash * 3)) : '0';
  }
  function flash(title, color, sub) {
    if (!S.flashEl) return; const b = S.flashEl.querySelector('b'); b.textContent = title; b.style.color = color || '#fff'; S.flashEl.querySelector('span').textContent = sub || '';
    S.flashEl.style.opacity = '1'; S.flashT = 2.1;
  }

  // -------------------------------------------------------- lifecycle
  function complete() {
    if (S.done) return; S.done = true; Alarm.stop(); Alarm.chime();
    const bonus = Math.max(0, 30 - Math.round(S.t / 18)), total = 45 + bonus;
    try { if (window.RS && window.RS.add) window.RS.add(total, 'Containment Breach cleared'); } catch (_) {}
    try { if (window.RankXP && window.RankXP.addQuest) window.RankXP.addQuest(300, 'Containment Breach cleared'); } catch (_) {}
    shake(24); flash('ANOMALY CONTAINED', '#9dffcf', 'Site-7 is quiet');
    setTimeout(() => {
      const o = document.getElementById('cbOverlay'); if (!o) return;
      o.querySelector('p').textContent = 'Eight rooms. One thing that should never have been written down.';
      o.querySelector('.g').innerHTML = [['Time', S.t.toFixed(1) + 's'], ['Rooms secured', '8 / 8'], ['RuneStones', '+' + total + ' ◈']].map((r) => '<div><b>' + r[0] + '</b><span>' + r[1] + '</span></div>').join('');
      o.style.display = 'grid'; if (S.hud) S.hud.style.display = 'none'; const bb = document.getElementById('cbBoss'); if (bb) bb.style.display = 'none';
    }, 2600);
  }
  function hideOverlays() { document.querySelectorAll('.overlay').forEach((o) => { if (o.id !== 'overlayBoot') o.style.display = 'none'; }); }
  function placeOnStart() { const P = player(); if (!P || !S.active) return; const R = ROOMS[0]; P.x = R.cx; P.y = R.cy; P.z = 0; P.vz = 0; }
  function installFloorHook() { if (S.prevHook === undefined) S.prevHook = window._gauntletFloorHook; window._gauntletFloorHook = (ctx, W, H, cam) => { if (window.ContainmentGfx && S.active) window.ContainmentGfx.floor2D(ctx, W, H, cam, S); }; }
  function removeFloorHook() { if (S.prevHook !== undefined) window._gauntletFloorHook = S.prevHook; S.prevHook = undefined; }

  function start() {
    const G = window._Gauntlet; if (!G || !G.restart) return;
    LAYOUT.doors.forEach((d) => { d.open = false; });
    hookWorldBuild();
    S.active = true; S.done = false; S.t = 0; S.room = 0; S.boss = null; S.haz = []; S.hurtCD = 0; S.rooms = ROOMS.map(() => ({ spawned: false, cleared: false, count: 0, alive: 0 }));
    window.CONTAINMENT_ACTIVE = true;
    window.TEAMS_MODE = false; window.CTF_MODE = false; window.PVP_MODE = false; window.BOTS_ENABLED = false;
    try { if (window.Parkour && Parkour.active) Parkour.stop(); } catch (_) {}
    try { if (window.Teams) Teams.reset(); if (window.CTF) CTF.reset(); } catch (_) {}
    try { if (window.LevelsMode && LevelsMode.active) LevelsMode.stop(); } catch (_) {}
    try { if (window._endStoryRun) window._endStoryRun(); } catch (_) {}
    const step = (fn, l) => { try { fn(); } catch (err) { console.warn('[Containment] ' + l, err); } };
    step(() => { window.MENU_CONTEXT = 'single'; hideOverlays(); }, 'overlays');
    step(() => { if (G.setThemeById) G.setThemeById(5); }, 'theme');
    step(() => G.restart(), 'restart');
    step(applyWalls, 'walls'); step(placeOnStart, 'place');
    setTimeout(() => step(() => { applyWalls(); placeOnStart(); }, 'late'), 120);
    step(installFloorHook, 'floor'); step(buildHud, 'hud');
    step(() => { const o = document.getElementById('cbOverlay'); if (o) o.style.display = 'none'; }, 'ov');
    S.last = performance.now(); if (S.raf) cancelAnimationFrame(S.raf); S.raf = requestAnimationFrame(loop);
    step(() => flash('CONTAINMENT BREACH', '#ff6a6a', 'Site-7 · all exits sealed'), 'flash');
    step(hud, 'hud2');
  }
  function stop() {
    S.active = false; window.CONTAINMENT_ACTIVE = false; try { dropPlatforms(); } catch (_) {} Alarm.stop(); if (S.raf) cancelAnimationFrame(S.raf); S.raf = 0;
    ['cbHud', 'cbBoss', 'cbVig'].forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const o = document.getElementById('cbOverlay'); if (o) o.style.display = 'none'; const f = document.getElementById('cbFlash'); if (f) f.style.opacity = '0';
    removeFloorHook();
  }
  function goMenu() {
    stop(); try { if (window._hardStopGame) window._hardStopGame(); } catch (_) {}
    hideOverlays(); const intro = document.getElementById('overlayIntro'); if (intro) intro.style.display = 'grid'; window.MENU_CONTEXT = 'intro';
  }
  function bind() {
    css(); hookWorldBuild();
    const on = (id, fn, cap) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn, cap); };
    on('introContainment', (e) => { e.preventDefault(); start(); });
    ['btnIntroSingle', 'btnIntroOffline', 'btnIntroMulti', 'introStory', 'introLevels', 'introParkour', 'btnHome', 'homeBtn2', 'victoryHomeBtn'].forEach((id) => on(id, () => { if (S.active) stop(); }, true));
    // dying shows the engine's own death screen; Restart there starts a fresh run
    ['btnRestart', 'restartBtn2'].forEach((id) => on(id, () => { if (S.active) { S.deaths++; setTimeout(() => { if (S.active) start(); }, 30); } }, false));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();

  window.Containment = {
    get active() { return S.active; }, get state() { return S; }, ROOMS, LAYOUT, T, DOOR, HAZ, ATT, PLATFORMS, bossPhase,
    start, stop, goMenu
  };
})();
