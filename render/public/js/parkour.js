// ============================================================
// Monster Arena — SKY PARKOUR
// A procedurally generated course of floating islands high above the void.
// Five themed sections (Meadow → Dunes → Glacial → Cinder → Void) are chained
// together; every section is sealed by an energy gate that only opens once its
// monsters are dead. Jump pads fling you across the wide section breaks, spike
// plates punish sloppy landings, treasure platforms hold a chest, and reaching
// the final beacon pays out RuneStones. Every run rolls a brand-new layout.
//
// Physics comes from the engine's own vertical system: each island registers a
// walkable surface at DECK height, so gravity, jumping and bullets all behave
// exactly as they do everywhere else in the game.
//
// Exposes window.Parkour.
// ============================================================
(function () {
  'use strict';

  const DECK = 520;          // every island top floats this far above the arena floor
  const SECTIONS = 5;
  const PER_SECTION = 5;
  const GAP_X = 118;         // jump gap between islands in a section
  const GAP_Y = 300;         // section break (crossed with a jump pad)
  const ROW_H = 180;
  const TOP_Y = 280;
  const PAD_VZ = 1150;
  const FALL_DMG = 10;
  const SPIKE_DMG = 9;

  const S = {
    active: false, course: null, seed: 0, t: 0, falls: 0, earned: 0, done: false,
    raf: 0, last: 0, hud: null, flashEl: null, flashT: 0, prevHook: undefined,
    spikeCD: 0, chests: 0
  };

  // ---------------------------------------------------------------- helpers
  function mulberry(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const player = () => (window.__dbg && window.__dbg.player) || (window._Gauntlet && window._Gauntlet.api && window._Gauntlet.api.player) || null;
  const enemies = () => (window.__dbg && window.__dbg.ents && window.__dbg.ents.enemies) || [];

  function themes() {
    const L = (window._Gauntlet && window._Gauntlet.LEVELS) || [];
    return [1, 2, 3, 4, 5].map((id) => {
      const th = L.find((l) => l.id === id) || { id, name: 'Realm ' + id, accent: '#9fe3ff' };
      return { id: th.id, name: th.name, accent: th.accent };
    });
  }

  // ------------------------------------------------------------- generation
  const MONSTERS = [
    ['chaser', 'chaser', 'shooter', 'chaser'],
    ['chaser', 'shooter', 'chaser', 'tank'],
    ['shooter', 'tank', 'chaser', 'sniper'],
    ['bomber', 'shooter', 'tank', 'chaser'],
    ['tank', 'sniper', 'chaser', 'bomber', 'tank']
  ];

  function genCourse(seed) {
    const r = mulberry(seed);
    const TH = themes();
    const plats = [];

    for (let s = 0; s < SECTIONS; s++) {
      const widths = [];
      for (let i = 0; i < PER_SECTION; i++) widths.push(150 + Math.round(r() * 55));
      const total = widths.reduce((a, b) => a + b, 0) + GAP_X * (PER_SECTION - 1);
      let cx = Math.round((4000 - total) / 2);
      const y = TOP_Y + s * (ROW_H + GAP_Y);
      const row = [];
      for (let i = 0; i < PER_SECTION; i++) {
        const w = widths[i];
        row.push({ x: cx, y, w, h: ROW_H, sec: s, theme: TH[s], kind: 'combat', spikes: null, pad: null, chest: null, gate: null, goal: null });
        cx += w + GAP_X;
      }
      if (s % 2 === 1) row.reverse();          // path snakes right → left on odd rows
      plats.push(...row);
    }

    const sections = [];
    for (let s = 0; s < SECTIONS; s++) {
      const row = plats.filter((p) => p.sec === s);
      row[1].kind = 'treasure';
      row[1].chest = { x: row[1].x + row[1].w / 2, y: row[1].y + row[1].h / 2, open: false, r: 30, glint: r() * 6 };

      const sp = row[2];
      const sh = 44, sy = Math.round(sp.y + sp.h * (0.42 + r() * 0.16));
      sp.spikes = { x: sp.x + 30, y: sy, w: sp.w - 60, h: sh, phase: r() * 6 };

      const last = row[PER_SECTION - 1];
      if (s < SECTIONS - 1) {
        last.gate = { x: last.x + 24, y: last.y + last.h - 56, w: last.w - 48, h: 46, open: false, sec: s, flash: 0 };
        last.pad = { x: last.x + last.w / 2, y: last.y + last.h - 126, r: 46, flash: 0 };
      } else {
        last.kind = 'goal';
        last.goal = { x: last.x + last.w / 2, y: last.y + last.h / 2, r: 64, armed: false };
      }

      sections.push({
        i: s, theme: TH[s], plats: row, gate: last.gate || null, cleared: false,
        spawned: false, monsters: [], total: 0, alive: 0
      });
    }

    return { seed, plats, sections, safe: plats[0], seedName: '#' + (seed % 9973) };
  }

  function platAt(x, y) {
    const c = S.course; if (!c) return null;
    for (const p of c.plats) if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return p;
    return null;
  }
  function inRect(r, x, y, pad) {
    const m = pad || 0;
    return x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m;
  }

  // ---------------------------------------------------------- engine bridges
  function installW3() {
    const W3 = window.W3; if (!W3 || W3.__pkHooked) return;
    const orig = W3.ensure;
    W3.ensure = function (world, tid) {
      const D = orig.call(W3, world, tid);
      injectSurfaces(D);
      return D;
    };
    W3.__pkHooked = true;
  }

  // Give every island a real walkable top. The engine's own physics then keeps
  // the player, monsters and bullets behaving exactly as they do on the ground.
  function injectSurfaces(D) {
    if (!D || !S.active || !S.course) return;
    if (D._pkSeed === S.course.seed) return;
    if (D._pkOwn) for (const s of D._pkOwn) { const i = D.surfaces.indexOf(s); if (i >= 0) D.surfaces.splice(i, 1); }
    const own = [];
    for (const p of S.course.plats) {
      const surf = { x: p.x, y: p.y, w: p.w, h: p.h, ax: 'x', dir: 1, z0: DECK, z1: DECK, k: 'deck' };
      D.surfaces.push(surf); own.push(surf);
    }
    D._pkOwn = own; D._pkSeed = S.course.seed;
    const IDX = 96, m = new Map();
    for (const it of D.surfaces) {
      if (it.k === 'roof') continue;
      const x0 = Math.floor(it.x / IDX), x1 = Math.floor((it.x + it.w) / IDX);
      const y0 = Math.floor(it.y / IDX), y1 = Math.floor((it.y + it.h) / IDX);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
        const k = cx * 4096 + cy; let a = m.get(k); if (!a) m.set(k, a = []); a.push(it);
      }
    }
    D.iF = m;
  }

  // The arena under the course is stripped bare: the islands float over a void.
  function hookWorldBuild() {
    const prev = window._onWorldBuilt;
    window._onWorldBuilt = function (w, theme) {
      if (prev) prev(w, theme);
      if (!S.active || !S.course) return;
      w.buildings.length = 0; w.walls.length = 0; w.hazards.length = 0; w.chests.length = 0;
      w.solids = w.solids.filter((s) => s.x <= 1 || s.y <= 1 || s.x + s.w >= w.w - 1 || s.y + s.h >= w.h - 1);
      w._parkour = S.course;
    };
    fn.__pk = true;
    window._onWorldBuilt = fn;
  }

  // ------------------------------------------------------------- progression
  function ensureSpawned(si) {
    const c = S.course; if (!c) return;
    const sec = c.sections[si];
    if (!sec || sec.spawned) return;
    sec.spawned = true;
    const dbg = window.__dbg; if (!dbg || !dbg.spawnEnemy) return;
    const list = MONSTERS[si % MONSTERS.length];
    const spots = [];
    for (const p of sec.plats) {
      spots.push({ x: p.x + p.w * 0.28, y: p.y + p.h * 0.34, p });
      spots.push({ x: p.x + p.w * 0.72, y: p.y + p.h * 0.62, p });
    }
    list.forEach((type, i) => {
      const sp = spots[i % spots.length];
      dbg.spawnEnemy(type, sp.x, sp.y);
      const arr = dbg.ents.enemies;
      const e = arr[arr.length - 1];
      if (!e) return;
      e.z = DECK; e.vz = 0;
      e.hp = Math.round(e.hp * (1 + si * 0.4));
      e.maxhp = e.hp;
      e._pkPlat = sp.p;
      e._pkSection = si;
      e.detectR = 1400;
      sec.monsters.push(e);
    });
    sec.total = sec.monsters.length;
    sec.alive = sec.monsters.length;
  }

  function checkSections() {
    const c = S.course; if (!c) return;
    for (const sec of c.sections) {
      if (!sec.spawned || sec.cleared) continue;
      const alive = sec.monsters.filter((e) => e && e.hp > 0 && enemies().indexOf(e) >= 0).length;
      sec.alive = alive;
      if (alive === 0) {
        sec.cleared = true;
        if (sec.gate) { sec.gate.open = true; sec.gate.flash = 1; }
        reward(5, sec.theme.name + ' section cleared');
        flash(sec.theme.name.toUpperCase() + ' CLEARED', sec.theme.accent);
        shake(8);
        if (sec.i === SECTIONS - 1) {
          const gp = c.sections[SECTIONS - 1].plats[PER_SECTION - 1];
          if (gp && gp.goal) gp.goal.armed = true;
        }
        updateHud();
      }
    }
  }

  function reward(n, why) {
    S.earned += n;
    try { if (window.RS && window.RS.add) window.RS.add(n, why || 'Sky parkour'); } catch (_) {}
    updateHud();
  }
  function shake(v) { try { if (window._Gauntlet && _Gauntlet.camShake) _Gauntlet.camShake(v); } catch (_) {} }

  function fall(P) {
    const c = S.course; if (!c) return;
    const home = c.safe || c.plats[0];
    P.x = home.x + home.w / 2;
    P.y = home.y + home.h / 2;
    P.z = DECK; P.vz = 0;
    P.hp = Math.max(0, P.hp - FALL_DMG);
    S.falls++;
    shake(10);
    flash('FELL — ' + FALL_DMG + ' HP', '#ff6a6a');
    updateHud();
  }

  // ------------------------------------------------------------------- tick
  function tick(dt) {
    if (!S.active || S.done) return;
    const P = player(); const c = S.course;
    if (!P || !c) return;
    if (P.hp <= 0) { stop(); return; }

    S.t += dt;
    S.spikeCD = Math.max(0, S.spikeCD - dt);

    const here = platAt(P.x, P.y);
    if (here) {
      ensureSpawned(here.sec);
      if (P.z > DECK - 60) c.safe = here;
    }

    // The island you are standing over always holds you up — the gaps between
    // islands stay real gaps, so hopping from one to the next is the only way on.
    if (here && P.vz <= 0 && P.z < DECK) { P.z = DECK; P.vz = 0; }

    // --- monsters stay on their own island
    const list = enemies();
    for (const sec of c.sections) {
      for (const e of sec.monsters) {
        if (!e || e.hp <= 0 || list.indexOf(e) < 0) continue;
        const p = e._pkPlat; if (!p) continue;
        const pad = 22;
        e.x = clamp(e.x, p.x + pad, p.x + p.w - pad);
        e.y = clamp(e.y, p.y + pad, p.y + p.h - pad);
        if (!(e.z > DECK - 60)) { e.z = DECK; e.vz = 0; }
      }
    }

    // --- closed gates act as walls
    for (const sec of c.sections) {
      const g = sec.gate;
      if (!g || g.open) continue;
      if (inRect(g, P.x, P.y, P.r || 16)) {
        const cy = g.y + g.h / 2, pr = (P.r || 16) + 2;
        if (P.y < cy) P.y = g.y - pr; else P.y = g.y + g.h + pr;
      }
    }

    // --- fall into the void
    if (!here && P.z < DECK - 110) fall(P);

    // --- jump pads
    if (P.z < DECK + 90) {
      for (const p of c.plats) {
        const pad = p.pad;
        if (!pad) continue;
        if (p.gate && !p.gate.open) continue;
        if (Math.hypot(P.x - pad.x, P.y - pad.y) > pad.r + (P.r || 16)) continue;
        if (P._pkPadT && performance.now() - P._pkPadT < 900) continue;
        P.vz = PAD_VZ; P._pkPadT = performance.now();
        pad.flash = 1; shake(7);
        flash('LAUNCH', p.theme.accent);
      }
    }

    // --- spikes
    if (P.z < DECK + 26 && S.spikeCD <= 0) {
      for (const p of c.plats) {
        const sp = p.spikes;
        if (!sp) continue;
        if (inRect(sp, P.x, P.y, (P.r || 16) * 0.6)) {
          P.hp = Math.max(0, P.hp - SPIKE_DMG);
          S.spikeCD = 0.5; shake(6);
          flash('SPIKES', '#ff8a5a');
          break;
        }
      }
    }

    // --- chests
    for (const p of c.plats) {
      const ch = p.chest;
      if (!ch || ch.open) continue;
      if (Math.hypot(P.x - ch.x, P.y - ch.y) > ch.r + (P.r || 16)) continue;
      ch.open = true; S.chests++;
      P.hp = Math.min(P.hpMax || 100, P.hp + 25);
      P.reserve += 20;
      reward(8, 'Parkour chest');
      flash('TREASURE +8', '#ffd166');
    }

    checkSections();

    // --- goal beacon
    const last = c.sections[SECTIONS - 1].plats[PER_SECTION - 1];
    if (last && last.goal && last.goal.armed && !S.done) {
      if (Math.hypot(P.x - last.goal.x, P.y - last.goal.y) < last.goal.r + (P.r || 16)) complete();
    }

    // --- animated trinkets
    for (const p of c.plats) {
      if (p.pad && p.pad.flash > 0) p.pad.flash = Math.max(0, p.pad.flash - dt * 1.6);
      if (p.gate && p.gate.flash > 0) p.gate.flash = Math.max(0, p.gate.flash - dt * 0.8);
    }
    if (S.flashT > 0) { S.flashT -= dt; if (S.flashT <= 0 && S.flashEl) S.flashEl.style.opacity = '0'; }
  }

  function loop() {
    if (!S.active) return;
    const now = performance.now();
    const dt = Math.min(0.06, (now - (S.last || now)) / 1000);
    S.last = now;
    try { tick(dt); } catch (err) { console.warn('[Parkour] tick', err); }
    updateHudThrottled();
    S.raf = requestAnimationFrame(loop);
  }
  let hudT = 0;
  function updateHudThrottled() {
    hudT += 1;
    if (hudT % 6 === 0) updateHud();
  }

  // -------------------------------------------------------------------- HUD
  function buildHud() {
    if (S.hud) { S.hud.style.display = ''; return; }
    const d = document.createElement('div');
    d.id = 'pkHud';
    d.innerHTML =
      '<div class="pkTitle">SKY PARKOUR <span id="pkSeed"></span></div>' +
      '<div class="pkPips" id="pkPips"></div>' +
      '<div class="pkRow"><span id="pkSection">—</span><span id="pkStat">—</span></div>';
    document.body.appendChild(d);
    S.hud = d;

    const f = document.createElement('div');
    f.id = 'pkFlash';
    document.body.appendChild(f);
    S.flashEl = f;

    const o = document.createElement('div');
    o.id = 'pkOverlay';
    o.innerHTML =
      '<div class="pkCard">' +
      '<div class="pkOTitle">COURSE COMPLETE</div>' +
      '<div class="pkOSub" id="pkOSub"></div>' +
      '<div class="pkOGrid" id="pkOGrid"></div>' +
      '<div class="pkOBtns">' +
      '<button id="pkAgain">▶ New course</button>' +
      '<button id="pkLeave" class="ghost">Home</button>' +
      '</div></div>';
    document.body.appendChild(o);
    const again = o.querySelector('#pkAgain');
    if (again) again.addEventListener('click', () => { o.style.display = 'none'; start(); });
    const leave = o.querySelector('#pkLeave');
    if (leave) leave.addEventListener('click', () => { o.style.display = 'none'; goMenu(); });
  }

  function updateHud() {
    const c = S.course;
    if (!S.hud || !c) return;
    const seedEl = document.getElementById('pkSeed');
    if (seedEl) seedEl.textContent = c.seedName;
    const pips = document.getElementById('pkPips');
    if (pips) {
      pips.innerHTML = c.sections.map((s) =>
        '<i class="' + (s.cleared ? 'on' : '') + '" style="--pk:' + s.theme.accent + '"></i>').join('');
    }
    const here = S.course ? platAt((player() || {}).x || 0, (player() || {}).y || 0) : null;
    const sec = c.sections[here ? here.sec : 0] || c.sections[0];
    const secEl = document.getElementById('pkSection');
    if (secEl) secEl.textContent = sec ? sec.theme.name.toUpperCase() : '—';
    const st = document.getElementById('pkStat');
    if (st) {
      if (sec && !sec.cleared) st.textContent = sec.spawned ? (sec.alive + ' left · gate sealed') : 'entering…';
      else st.textContent = '+ ' + S.earned + ' ◈';
    }
  }

  function flash(msg, color) {
    if (!S.flashEl) return;
    S.flashEl.textContent = msg;
    S.flashEl.style.color = color || '#eaf4ff';
    S.flashEl.style.opacity = '1';
    S.flashT = 1.35;
  }

  // ------------------------------------------------------------ completion
  function complete() {
    S.done = true;
    const bonus = Math.max(0, 20 - Math.round(S.t / 12));
    const total = 25 + bonus;
    reward(total, 'Sky parkour completed');
    const o = document.getElementById('pkOverlay');
    if (o) {
      const sub = o.querySelector('#pkOSub');
      if (sub) sub.textContent = 'Five sections crossed — a brand-new course is waiting.';
      const grid = o.querySelector('#pkOGrid');
      if (grid) {
        const rows = [
          ['Course', S.course.seedName],
          ['Time', S.t.toFixed(1) + 's'],
          ['Falls', String(S.falls)],
          ['Chests', String(S.chests)],
          ['Reward', '+' + S.earned + ' ◈']
        ];
        grid.innerHTML = rows.map((r) => '<div><b>' + r[0] + '</b><span>' + r[1] + '</span></div>').join('');
      }
      o.style.display = 'grid';
    }
    if (S.hud) S.hud.style.display = 'none';
    if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
    window.PARKOUR_ACTIVE = false;
  }

  // -------------------------------------------------------------- lifecycle
  function hideOverlays(exceptId) {
    document.querySelectorAll('.overlay').forEach((o) => {
      if (o.id !== exceptId && o.id !== 'overlayBoot') o.style.display = 'none';
    });
  }

  // Put the fighter on the first island — at launch, and once more a frame
  // later, after the engine has finished its own start-up work.
  function placeOnStart() {
    if (!S.active || !S.course) return;
    const P = player(); const p0 = S.course.plats[0];
    if (!P || !p0) return;
    P.x = p0.x + p0.w / 2; P.y = p0.y + p0.h / 2;
    P.z = DECK; P.vz = 0; P._pkPadT = 0;
  }

  function start() {
    const G = window._Gauntlet;
    if (!G || !G.restart) return;
    installW3();
    hookWorldBuild();

    S.active = true; S.done = false; S.t = 0; S.falls = 0; S.earned = 0; S.chests = 0; S.spikeCD = 0;
    S.seed = (Math.random() * 1e9) | 0;
    S.course = genCourse(S.seed);
    window.PARKOUR_ACTIVE = true;

    window.TEAMS_MODE = false; window.CTF_MODE = false; window.PVP_MODE = false; window.BOTS_ENABLED = false;
    try { if (window.Teams) Teams.reset(); } catch (_) {}
    try { if (window.CTF) CTF.reset(); } catch (_) {}
    try { if (window.LevelsMode && LevelsMode.active) LevelsMode.stop(); } catch (_) {}
    try { if (window._endStoryRun) window._endStoryRun(); } catch (_) {}

    window.MENU_CONTEXT = 'single';
    hideOverlays('');
    if (G.setThemeById) G.setThemeById(5);      // the void far below
    try { G.restart(); } catch (err) { console.warn('[Parkour] restart', err); }

    placeOnStart();
    // The engine finishes its own start-up on the next frame; re-assert the
    // spawn so a run never begins on the arena floor below the islands.
    setTimeout(placeOnStart, 80);

    ensureSpawned(0);
    installFloorHook();
    buildHud();
    const ov = document.getElementById('pkOverlay'); if (ov) ov.style.display = 'none';
    updateHud();
    flash('COURSE ' + S.course.seedName + ' — GO', '#9fe3ff');

    S.last = performance.now();
    if (S.raf) cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(loop);
  }

  function stop() {
    S.active = false; S.done = false;
    window.PARKOUR_ACTIVE = false;
    if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
    if (S.hud) S.hud.style.display = 'none';
    const o = document.getElementById('pkOverlay'); if (o) o.style.display = 'none';
    const f = document.getElementById('pkFlash'); if (f) f.style.opacity = '0';
    if (S.course) for (const p of S.course.plats) { p.pad = null; }
    removeFloorHook();
  }

  function goMenu() {
    stop();
    try { if (window._hardStopGame) window._hardStopGame(); } catch (_) {}
    hideOverlays('overlayIntro');
    const intro = document.getElementById('overlayIntro');
    if (intro) intro.style.display = 'grid';
    window.MENU_CONTEXT = 'intro';
  }

  // ------------------------------------------------------------- 2D drawing
  let cloudTile = null;
  function makeCloudTile() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d'), r = mulberry(9182);
    for (let i = 0; i < 54; i++) {
      const x = r() * 512, y = r() * 512, rad = 26 + r() * 96, a = 0.045 + r() * 0.12;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(186,212,255,' + a + ')');
      grd.addColorStop(0.6, 'rgba(150,180,240,' + (a * 0.4) + ')');
      grd.addColorStop(1, 'rgba(120,150,220,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
    return c;
  }

  const PAL = {
    1: { top: '#4a8b52', mid: '#2b5f36', low: '#17361f', rim: '#8dffb0', rock: '#2a2418' },
    2: { top: '#e0c184', mid: '#b8944f', low: '#7d5f30', rim: '#ffd98a', rock: '#3a2c1b' },
    3: { top: '#d9f0ff', mid: '#9fc9e8', low: '#688fb4', rim: '#d6f4ff', rock: '#22303f' },
    4: { top: '#5b2a1c', mid: '#331611', low: '#170a08', rim: '#ff8a5a', rock: '#241312' },
    5: { top: '#33204f', mid: '#1b102f', low: '#0a0616', rim: '#d066ff', rock: '#151024' }
  };

  function makeIslandTex(p) {
    const w = Math.ceil(p.w), h = Math.ceil(p.h);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const r = mulberry((p.x * 31 + p.y * 17 + p.sec * 7919) | 0);
    const th = PAL[p.theme.id] || PAL[1];

    const lg = g.createLinearGradient(0, 0, w * 0.55, h);
    lg.addColorStop(0, th.top); lg.addColorStop(0.55, th.mid); lg.addColorStop(1, th.low);
    g.fillStyle = lg; g.fillRect(0, 0, w, h);

    // biome detail
    if (p.theme.id === 1) {
      for (let i = 0; i < 90; i++) {
        const x = r() * w, y = r() * h, rad = 4 + r() * 26;
        g.fillStyle = 'rgba(20,58,30,' + (0.05 + r() * 0.12) + ')';
        g.beginPath(); g.ellipse(x, y, rad, rad * 0.6, r() * 3, 0, Math.PI * 2); g.fill();
      }
      for (let i = 0; i < 160; i++) {
        const x = r() * w, y = r() * h, len = 5 + r() * 9;
        g.strokeStyle = 'rgba(' + (110 + r() * 70 | 0) + ',' + (190 + r() * 60 | 0) + ',' + (110 + r() * 50 | 0) + ',' + (0.18 + r() * 0.3) + ')';
        g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - len); g.stroke();
      }
      for (let i = 0; i < 18; i++) {
        const x = r() * w, y = r() * h;
        g.fillStyle = ['rgba(255,236,150,.75)', 'rgba(255,170,210,.7)', 'rgba(200,240,255,.7)'][(r() * 3) | 0];
        g.beginPath(); g.arc(x, y, 1.6 + r() * 1.6, 0, Math.PI * 2); g.fill();
      }
    } else if (p.theme.id === 2) {
      for (let i = 0; i < 70; i++) {
        const y0 = r() * h, amp = 4 + r() * 10, x0 = r() * w * 0.3;
        g.strokeStyle = 'rgba(' + (r() < 0.5 ? '255,240,200' : '120,88,44') + ',' + (0.1 + r() * 0.22) + ')';
        g.lineWidth = 1.4 + r() * 2.2;
        g.beginPath();
        for (let x = x0; x < w; x += 12) g.lineTo(x, y0 + Math.sin((x + i * 40) * 0.02) * amp);
        g.stroke();
      }
      for (let i = 0; i < 26; i++) {
        const x = r() * w, y = r() * h, rad = 3 + r() * 8;
        g.fillStyle = 'rgba(90,68,34,' + (0.2 + r() * 0.3) + ')';
        g.beginPath(); g.ellipse(x, y, rad, rad * 0.7, r() * 3, 0, Math.PI * 2); g.fill();
      }
    } else if (p.theme.id === 3) {
      for (let i = 0; i < 26; i++) {
        const x = r() * w, y = r() * h, rad = 20 + r() * 70;
        g.fillStyle = 'rgba(255,255,255,' + (0.05 + r() * 0.12) + ')';
        g.beginPath();
        const n = 5 + ((r() * 3) | 0);
        for (let k = 0; k <= n; k++) {
          const a = (k / n) * Math.PI * 2 + r() * 0.4, rr = rad * (0.6 + r() * 0.5);
          const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
          k === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
        }
        g.closePath(); g.fill();
      }
      for (let i = 0; i < 34; i++) {
        let x = r() * w, y = r() * h;
        g.strokeStyle = 'rgba(255,255,255,' + (0.16 + r() * 0.4) + ')'; g.lineWidth = 1 + r() * 1.6;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 46; y += (r() - 0.5) * 40; g.lineTo(x, y); }
        g.stroke();
      }
    } else if (p.theme.id === 4) {
      for (let i = 0; i < 120; i++) {
        const x = r() * w, y = r() * h, rad = 5 + r() * 30;
        g.fillStyle = 'rgba(0,0,0,' + (0.06 + r() * 0.16) + ')';
        g.beginPath(); g.ellipse(x, y, rad, rad * 0.7, r() * 3, 0, Math.PI * 2); g.fill();
      }
      for (let i = 0; i < 16; i++) {
        let x = r() * w, y = r() * h;
        const col = r() < 0.5 ? '255,120,40' : '255,190,80';
        g.strokeStyle = 'rgba(' + col + ',0.85)'; g.lineWidth = 1.6 + r() * 2.4;
        g.shadowColor = 'rgba(255,120,40,.9)'; g.shadowBlur = 12;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 46; g.lineTo(x, y); }
        g.stroke(); g.shadowBlur = 0;
      }
    } else {
      for (let i = 0; i < 220; i++) {
        const x = r() * w, y = r() * h, a = 0.3 + r() * 0.7;
        g.fillStyle = 'rgba(' + (200 + r() * 55 | 0) + ',' + (200 + r() * 55 | 0) + ',255,' + a + ')';
        g.fillRect(x, y, 1.4 + r() * 1.6, 1.4 + r() * 1.6);
      }
      for (let i = 0; i < 14; i++) {
        let x = r() * w, y = r() * h;
        g.strokeStyle = 'rgba(190,110,255,.6)'; g.lineWidth = 1.4 + r() * 1.8;
        g.shadowColor = 'rgba(190,110,255,.9)'; g.shadowBlur = 10;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 54; g.lineTo(x, y); }
        g.stroke(); g.shadowBlur = 0;
      }
    }

    // top-lit sheen + darkened edges so the plate reads as a solid slab
    const sheen = g.createLinearGradient(0, 0, w * 0.5, h * 0.7);
    sheen.addColorStop(0, 'rgba(255,255,255,.16)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,.02)');
    sheen.addColorStop(1, 'rgba(0,0,0,.28)');
    g.fillStyle = sheen; g.fillRect(0, 0, w, h);
    const edge = g.createLinearGradient(0, 0, 0, h);
    edge.addColorStop(0, 'rgba(0,0,0,.30)');
    edge.addColorStop(0.12, 'rgba(0,0,0,0)');
    edge.addColorStop(0.88, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,.30)');
    g.fillStyle = edge; g.fillRect(0, 0, w, h);

    // treasure platforms get a small ruined shrine baked in
    if (p.kind === 'treasure') {
      const cx = p.chest ? p.chest.x - p.x : w / 2, cy = p.chest ? p.chest.y - p.y : h / 2;
      g.save();
      g.translate(cx, cy);
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.beginPath(); g.ellipse(0, 14, 96, 34, 0, 0, Math.PI * 2); g.fill();
      for (const sx of [-1, 1]) {
        g.fillStyle = 'rgba(225,222,214,.92)';
        g.fillRect(sx * 62 - 11, -46, 22, 62);
        g.fillStyle = 'rgba(160,156,148,.95)';
        g.fillRect(sx * 62 - 14, -54, 28, 10);
        g.fillStyle = 'rgba(120,116,110,.6)';
        g.fillRect(sx * 62 + 4, -44, 6, 58);
      }
      g.fillStyle = 'rgba(205,200,190,.95)';
      g.fillRect(-74, -62, 148, 16);
      g.fillStyle = 'rgba(150,146,138,.85)';
      g.fillRect(-74, -50, 148, 6);
      g.restore();
    }
    return c;
  }

  function ensureTex(p) {
    if (!p._tex) p._tex = makeIslandTex(p);
    return p._tex;
  }

  function drawSky(ctx, W, H, ox, oy) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#060a16');
    g.addColorStop(0.45, '#0a1024');
    g.addColorStop(1, '#05070f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    if (!cloudTile) cloudTile = makeCloudTile();
    const pat = ctx.createPattern(cloudTile, 'repeat');
    if (pat) {
      const px = (ox * 0.35) % 512, py = (oy * 0.35) % 512;
      ctx.save(); ctx.globalAlpha = 0.85; ctx.translate(px, py);
      ctx.fillStyle = pat; ctx.fillRect(-px, -py, W + 512, H + 512); ctx.restore();
      const px2 = (ox * 0.7) % 512, py2 = (oy * 0.7) % 512;
      ctx.save(); ctx.globalAlpha = 0.35; ctx.translate(px2 + 140, py2 + 90);
      ctx.fillStyle = pat; ctx.fillRect(-px2 - 140, -py2 - 90, W + 512, H + 512); ctx.restore();
    }
    const glow = ctx.createRadialGradient(W * 0.5, H * 0.1, 0, W * 0.5, H * 0.1, Math.max(W, H) * 0.9);
    glow.addColorStop(0, 'rgba(120,170,255,.10)');
    glow.addColorStop(1, 'rgba(60,80,160,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  }

  function drawIsland(ctx, p, ox, oy) {
    const x = p.x + ox, y = p.y + oy;
    const th = PAL[p.theme.id] || PAL[1];
    const lift = 26;                                   // how far the underside hangs below

    // casting shadow into the void
    ctx.save();
    ctx.globalAlpha = 0.5;
    const shg = ctx.createRadialGradient(x + p.w / 2, y + p.h / 2 + lift + 18, 8, x + p.w / 2, y + p.h / 2 + lift + 18, Math.max(p.w, p.h) * 0.75);
    shg.addColorStop(0, 'rgba(0,0,0,.55)'); shg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shg; ctx.fillRect(x - p.w * 0.4, y - p.h * 0.4, p.w * 1.8, p.h * 1.9);
    ctx.restore();

    // rocky underside
    const uy = y + lift;
    const ug = ctx.createLinearGradient(0, y + p.h - 10, 0, uy + p.h * 0.5);
    ug.addColorStop(0, th.rock); ug.addColorStop(1, 'rgba(6,6,12,.15)');
    ctx.fillStyle = ug;
    ctx.beginPath();
    const steps = 9;
    ctx.moveTo(x, y + p.h - 14);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, sx = x + p.w * u;
      const jag = Math.sin(u * 9 + p.x * 0.01) * 12 + Math.sin(u * 21) * 6;
      ctx.lineTo(sx, y + p.h + lift * 0.6 + jag);
    }
    ctx.lineTo(x + p.w, y + p.h - 14);
    ctx.closePath(); ctx.fill();

    // top plate
    const tex = ensureTex(p);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
    ctx.drawImage(tex, x, y);
    ctx.restore();

    // glowing rim
    ctx.save();
    ctx.strokeStyle = th.rim; ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
    ctx.shadowColor = th.rim; ctx.shadowBlur = 14;
    ctx.strokeRect(x + 1, y + 1, p.w - 2, p.h - 2);
    ctx.restore();

    // decorations drawn live so they animate
    if (p.spikes) drawSpikes(ctx, p, x, y);
    if (p.pad) drawPad(ctx, p, x, y);
    if (p.chest) drawChest(ctx, p, x, y);
    if (p.gate) drawGate(ctx, p, x, y);
    if (p.goal) drawGoal(ctx, p, x, y);
  }

  function drawSpikes(ctx, p, x, y) {
    const s = p.spikes, t = performance.now() / 1000;
    const sx = s.x + x - p.x, sy = s.y + y - p.y;
    ctx.save();
    const bg = ctx.createLinearGradient(0, sy, 0, sy + s.h);
    bg.addColorStop(0, 'rgba(12,12,18,.85)'); bg.addColorStop(1, 'rgba(24,24,34,.9)');
    ctx.fillStyle = bg; ctx.fillRect(sx, sy, s.w, s.h);
    ctx.strokeStyle = 'rgba(255,120,90,.55)'; ctx.lineWidth = 1.5; ctx.strokeRect(sx, sy, s.w, s.h);

    const n = Math.max(4, Math.floor(s.w / 26));
    const step = s.w / n;
    for (let i = 0; i < n; i++) {
      const cx = sx + step * (i + 0.5);
      const pulse = 0.72 + 0.28 * Math.sin(t * 4 + s.phase + i * 0.6);
      const hgt = s.h * 0.82 * pulse;
      for (const off of [-step * 0.22, step * 0.22]) {
        const bx = cx + off, bw = step * 0.26;
        const grd = ctx.createLinearGradient(bx - bw, sy + s.h, bx + bw, sy + s.h - hgt);
        grd.addColorStop(0, '#4a4f5c'); grd.addColorStop(0.55, '#c9d2e0'); grd.addColorStop(1, '#ffffff');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(bx - bw, sy + s.h - 4);
        ctx.lineTo(bx, sy + s.h - hgt);
        ctx.lineTo(bx + bw, sy + s.h - 4);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawPad(ctx, p, x, y) {
    const pad = p.pad, t = performance.now() / 1000;
    const cx = pad.x + x - p.x, cy = pad.y + y - p.y;
    const pulse = 0.6 + 0.4 * Math.sin(t * 3.4) + (pad.flash || 0) * 0.8;
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, pad.r * 1.25);
    g.addColorStop(0, 'rgba(255,255,255,.95)');
    g.addColorStop(0.35, p.theme.accent);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55 + 0.35 * pulse;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, pad.r * 1.25, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, pad.r * (0.55 + 0.1 * pulse), 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = p.theme.accent; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const rr = pad.r * (0.9 - i * 0.18) * (0.9 + 0.1 * pulse);
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
    }
    // upward chevrons
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 3; i++) {
      const ay = cy - 8 - i * 12 - ((t * 40) % 12);
      ctx.beginPath();
      ctx.moveTo(cx, ay - 8); ctx.lineTo(cx - 9, ay + 3); ctx.lineTo(cx + 9, ay + 3);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawChest(ctx, p, x, y) {
    const ch = p.chest, t = performance.now() / 1000;
    const cx = ch.x + x - p.x, cy = ch.y + y - p.y;
    ctx.save();
    const gl = ctx.createRadialGradient(cx, cy, 2, cx, cy, 52);
    gl.addColorStop(0, ch.open ? 'rgba(255,225,140,.55)' : 'rgba(255,200,90,.28)');
    gl.addColorStop(1, 'rgba(255,190,80,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2); ctx.fill();

    // body
    const w = 46, h = 30;
    const bg = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
    bg.addColorStop(0, '#8a5a2a'); bg.addColorStop(0.5, '#6b421d'); bg.addColorStop(1, '#402514');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h / 2 + 6, w, h - 6, 4); ctx.fill();
    // lid
    ctx.save();
    ctx.translate(cx, cy - h / 2 + 6);
    if (ch.open) ctx.rotate(-0.7);
    const lg = ctx.createLinearGradient(0, -12, 0, 6);
    lg.addColorStop(0, '#a06e33'); lg.addColorStop(1, '#5d3818');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.roundRect(-w / 2, -12, w, 16, 5); ctx.fill();
    ctx.restore();
    // bands + lock
    ctx.fillStyle = '#e8c368';
    ctx.fillRect(cx - w / 2 + 4, cy - 2, 5, h - 4);
    ctx.fillRect(cx + w / 2 - 9, cy - 2, 5, h - 4);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(cx, cy + 2, 3.4, 0, Math.PI * 2); ctx.fill();
    if (!ch.open) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + ch.glint);
      ctx.fillStyle = '#fff6cc';
      ctx.beginPath(); ctx.arc(cx, cy - h / 2 + 4, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawGate(ctx, p, x, y) {
    const g = p.gate, t = performance.now() / 1000;
    const gx = g.x + x - p.x, gy = g.y + y - p.y;
    ctx.save();
    if (g.open) {
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = p.theme.accent; ctx.lineWidth = 2;
      ctx.strokeRect(gx, gy, g.w, g.h);
      ctx.restore(); return;
    }
    const grd = ctx.createLinearGradient(0, gy, 0, gy + g.h);
    grd.addColorStop(0, 'rgba(255,255,255,.16)');
    grd.addColorStop(0.5, p.theme.accent);
    grd.addColorStop(1, 'rgba(255,255,255,.16)');
    ctx.globalAlpha = 0.42 + 0.2 * Math.sin(t * 5) + (g.flash || 0) * 0.4;
    ctx.fillStyle = grd; ctx.fillRect(gx, gy, g.w, g.h);
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.strokeRect(gx, gy, g.w, g.h);
    // scan lines
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = p.theme.accent; ctx.lineWidth = 1.4;
    for (let i = 0; i < 7; i++) {
      const yy = gy + ((t * 34 + i * g.h / 7) % g.h);
      ctx.beginPath(); ctx.moveTo(gx + 4, yy); ctx.lineTo(gx + g.w - 4, yy); ctx.stroke();
    }
    // corner pylons
    ctx.globalAlpha = 1;
    for (const px of [gx - 6, gx + g.w - 6]) {
      const pg = ctx.createLinearGradient(0, gy - 12, 0, gy + g.h + 12);
      pg.addColorStop(0, '#e9f4ff'); pg.addColorStop(1, '#5b6a80');
      ctx.fillStyle = pg; ctx.fillRect(px, gy - 12, 12, g.h + 24);
      ctx.fillStyle = p.theme.accent;
      ctx.beginPath(); ctx.arc(px + 6, gy - 6, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawGoal(ctx, p, x, y) {
    const go = p.goal, t = performance.now() / 1000;
    const cx = go.x + x - p.x, cy = go.y + y - p.y;
    ctx.save();
    const active = go.armed;
    const col = active ? '#9dffcf' : 'rgba(160,180,220,.6)';
    const gl = ctx.createRadialGradient(cx, cy, 4, cx, cy, go.r);
    gl.addColorStop(0, active ? 'rgba(160,255,210,.75)' : 'rgba(120,150,210,.22)');
    gl.addColorStop(1, 'rgba(120,150,210,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, go.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      const rr = go.r * (0.35 + i * 0.22) * (1 + 0.05 * Math.sin(t * 2 + i));
      ctx.beginPath(); ctx.arc(cx, cy, rr, t * (i % 2 ? -1 : 1), t * (i % 2 ? -1 : 1) + Math.PI * 1.4); ctx.stroke();
    }
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawParkourFloor(ctx, W, H, cam) {
    if (!S.active || !S.course) return;
    const ox = -cam.x - cam.sx, oy = -cam.y - cam.sy;
    drawSky(ctx, W, H, ox, oy);
    for (const p of S.course.plats) {
      if (p.x + ox > W + 80 || p.x + p.w + ox < -80 || p.y + oy > H + 120 || p.y + p.h + oy < -80) continue;
      drawIsland(ctx, p, ox, oy);
    }
  }

  function installFloorHook() {
    if (S.prevHook === undefined) S.prevHook = window._gauntletFloorHook;
    window._gauntletFloorHook = drawParkourFloor;
  }
  function removeFloorHook() {
    if (S.prevHook !== undefined) window._gauntletFloorHook = S.prevHook;
    S.prevHook = undefined;
  }

  // --------------------------------------------------------------- UI style
  function injectStyle() {
    if (document.getElementById('pkStyle')) return;
    const st = document.createElement('style');
    st.id = 'pkStyle';
    st.textContent = `
#pkHud{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:7;pointer-events:none;
  display:flex;flex-direction:column;gap:6px;align-items:center;font:600 11px/1.2 ui-sans-serif,system-ui,sans-serif;
  letter-spacing:.12em;text-transform:uppercase;color:#dfeaff;
  background:linear-gradient(180deg,rgba(10,16,30,.82),rgba(6,10,20,.7));border:1px solid rgba(140,190,255,.35);
  border-radius:14px;padding:8px 16px;box-shadow:0 10px 30px rgba(0,0,0,.5),inset 0 0 24px rgba(90,150,255,.12)}
#pkHud .pkTitle{font-size:12px;letter-spacing:.22em;color:#fff;text-shadow:0 0 14px rgba(120,190,255,.8)}
#pkHud #pkSeed{opacity:.55;font-size:10px;letter-spacing:.1em}
#pkHud .pkPips{display:flex;gap:7px}
#pkHud .pkPips i{width:22px;height:4px;border-radius:3px;background:rgba(255,255,255,.16);box-shadow:inset 0 0 6px rgba(0,0,0,.6)}
#pkHud .pkPips i.on{background:var(--pk);box-shadow:0 0 10px var(--pk)}
#pkHud .pkRow{display:flex;gap:10px;font-size:10px;opacity:.85;letter-spacing:.1em}
#pkFlash{position:fixed;left:50%;top:26%;transform:translateX(-50%);z-index:7;pointer-events:none;
  font:800 26px/1.1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;
  text-shadow:0 0 18px rgba(0,0,0,.9),0 0 34px rgba(120,190,255,.5);opacity:0;transition:opacity .35s ease}
#pkOverlay{position:fixed;inset:0;z-index:30;display:none;place-items:center;background:rgba(4,7,14,.82);backdrop-filter:blur(6px)}
#pkOverlay .pkCard{width:min(440px,90vw);border-radius:20px;padding:26px 24px;
  background:linear-gradient(180deg,rgba(16,24,44,.96),rgba(8,12,24,.96));
  border:1px solid rgba(140,190,255,.4);box-shadow:0 24px 70px rgba(0,0,0,.6),inset 0 0 40px rgba(90,150,255,.12);
  font-family:ui-sans-serif,system-ui,sans-serif;color:#e6efff;text-align:center}
#pkOverlay .pkOTitle{font:800 20px/1.2 ui-sans-serif,system-ui,sans-serif;letter-spacing:.18em;color:#fff;text-shadow:0 0 20px rgba(120,200,255,.8)}
#pkOverlay .pkOSub{margin-top:6px;font-size:12px;opacity:.7;letter-spacing:.04em}
#pkOverlay .pkOGrid{margin:18px 0 6px;display:grid;gap:8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
#pkOverlay .pkOGrid div{display:flex;justify-content:space-between;padding:7px 12px;border-radius:10px;background:rgba(255,255,255,.05)}
#pkOverlay .pkOGrid b{opacity:.6;font-weight:600}
#pkOverlay .pkOBtns{display:flex;gap:10px;margin-top:18px}
#pkOverlay button{flex:1;padding:11px 14px;border-radius:12px;border:1px solid rgba(140,200,255,.55);
  background:linear-gradient(180deg,#2e6ea8,#1b4570);color:#fff;font:700 12px/1 ui-sans-serif,system-ui,sans-serif;
  letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
#pkOverlay button.ghost{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.25)}
#pkOverlay button:hover{filter:brightness(1.15)}`;
    document.head.appendChild(st);
  }

  // ---------------------------------------------------------------- wiring
  function bind() {
    injectStyle();
    hookWorldBuild();
    installW3();
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    on('introParkour', (e) => { e.preventDefault(); start(); });
    ['btnIntroSingle', 'btnIntroOffline', 'btnIntroMulti', 'introStory', 'introLevels', 'btnHome', 'homeBtn2', 'victoryHomeBtn']
      .forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => { if (S.active) stop(); }, true);
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

  window.Parkour = {
    get active() { return S.active; },
    get course() { return S.course; },
    get earned() { return S.earned; },
    DECK,
    start, stop, goMenu
  };
})();