// ============================================================
// Monster Arena — SKY PARKOUR
// A climb of floating islands through five realms above a rolling sea of
// electric blue liquid. Every island carries a miniature of its realm's arena,
// so the course reads as a chain of tiny maps strung through the sky.
//
//   • the course snakes up in lanes, never stacking one slab over another
//   • the bottom lane is wide with short hops; it tightens as you climb
//   • jump pads carry you across the section breaks into the next lane
//   • spike beds stand in the open and are lethal — hop over them
//   • falling into the surge restarts you on the first island
//   • the final beacon pays out RuneStones
//
// Exposes window.Parkour.
// ============================================================
(function () {
  'use strict';

  // Every cleared course raises the LEVEL (saved on this device). Each level adds an
  // island to every lane, opens the jumps wider, narrows the slabs, mines more of them
  // and stocks them with tougher, more numerous monsters. Layout, realm order and
  // hazards are re-rolled from a fresh random seed every run.
  const SECTIONS = 5, BASE_PER = 5, MAX_PER = 8, MAX_LEVEL = 12;
  const LEVEL_KEY = 'arena_parkour_level';
  const loadLevel = () => { try { return clamp(parseInt(localStorage.getItem(LEVEL_KEY) || '0', 10) || 0, 0, MAX_LEVEL); } catch (_) { return 0; } };
  const saveLevel = (v) => { try { localStorage.setItem(LEVEL_KEY, String(clamp(v, 0, MAX_LEVEL))); } catch (_) {} };
  const perFor = (lv) => Math.min(MAX_PER, BASE_PER + Math.ceil(lv * 0.75));
  // A running jump covers ~236 units (240 speed, 640 launch, 1300 gravity). The
  // gaps climb towards that ceiling and the lanes sit wider apart than any jump
  // can reach, so the course can only be walked in order — one island at a time,
  // never over the top of one.
  const GAP0 = 152;       // edge-to-edge gap of the first jump
  const GAPSTEP = 12;     // every lane higher up opens the gaps further
  const LANE = 580;       // lane spacing — the crossing between lanes is the big one
  const SHIFT = 150;      // odd lanes are offset sideways, so no island sits over another
  const DECK0 = 320;      // height of the first island above the surge
  const RISE = 24;        // climb per island
  const PAD_TIME = 1.15;  // seconds a pad takes to carry you into the next lane
  const PAD_ARC = 300;    // height of the arc it throws you on
  const FALL_DROP = 110;  // this far BELOW the lowest deck you are in the surge
  const FALL_T = 3.0;     // …and off the course this long does it too (safety net)
  const PAD_GRACE = 4.5;  // a pad launch buys more air than that

  const S = {
    active: false, course: null, seed: 0, t: 0, deaths: 0, earned: 0, done: false,
    raf: 0, last: 0, hud: null, flashEl: null, flashT: 0, prevHook: undefined,
    chests: 0, airT: 0
  };
  // The arena seals its player object, so the course's own flags live here
  // instead: which deck the body stood on, when a pad fired, whether a jump
  // is in the air, and the pad arc that is currently carrying it.
  const BODY = { deck: 0, padT: 0, air: false, fly: null };

  // ------------------------------------------------------------- utilities
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
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  const player = () => (window.__dbg && window.__dbg.player) || null;
  const enemyList = () => { const d = window.__dbg; return (d && d.ents && d.ents.enemies) || []; };
  function worldSize() {
    const w = window._Gauntlet && window._Gauntlet.api && window._Gauntlet.api.world;
    return { w: (w && w.w) || 4000, h: (w && w.h) || 2800 };
  }
  function inRect(r, x, y, pad) {
    const m = pad || 0;
    return x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m;
  }
  function themes() {
    const L = (window._Gauntlet && window._Gauntlet.LEVELS) || [];
    return [1, 2, 3, 4, 5].map((id) => {
      const th = L.find((l) => l.id === id) || { id, name: 'Realm ' + id, accent: '#9fe3ff' };
      return { id: th.id, name: th.name, accent: th.accent };
    });
  }

  // Palette per realm — the island slab, its miniature map and its rim glow.
  const PAL = {
    1: { base: '#24361f', base2: '#131d10', grid: 'rgba(150,255,170,.16)', rock: '#2b3a1e', rock2: '#10180c', rim: '#7dffa3', roof: '#4d7a3c', wall: '#7d8f6e', hazard: 'rgba(110,200,120,.30)' },
    2: { base: '#3d2f1a', base2: '#221809', grid: 'rgba(255,209,102,.16)', rock: '#4a381d', rock2: '#1a1208', rim: '#ffd166', roof: '#8a6a34', wall: '#c9b183', hazard: 'rgba(230,190,100,.45)' },
    3: { base: '#1d2f42', base2: '#0b1622', grid: 'rgba(159,227,255,.18)', rock: '#243c52', rock2: '#091320', rim: '#9fe3ff', roof: '#4f7fa6', wall: '#c8e2f2', hazard: 'rgba(150,230,255,.38)' },
    4: { base: '#3a1d16', base2: '#180a07', grid: 'rgba(255,138,90,.18)', rock: '#43201a', rock2: '#140705', rim: '#ff8a5a', roof: '#7a3323', wall: '#a0685a', hazard: 'rgba(255,120,50,.55)' },
    5: { base: '#241a38', base2: '#0d0818', grid: 'rgba(208,102,255,.20)', rock: '#2b2044', rock2: '#0a0614', rim: '#d066ff', roof: '#4a3670', wall: '#a99bd0', hazard: 'rgba(190,110,255,.45)' }
  };

  // ------------------------------------------------------------ generation
  const MONSTERS = [
    ['chaser', 'chaser', 'shooter', 'chaser'],
    ['chaser', 'shooter', 'chaser', 'tank'],
    ['shooter', 'tank', 'chaser', 'sniper'],
    ['bomber', 'shooter', 'tank', 'chaser'],
    ['tank', 'sniper', 'chaser', 'bomber']
  ];

  // A serpentine climb. The course marches along one lane, turns, and marches
  // back along the next, so every island owns its own patch of the map and no
  // slab is ever stacked over another. The first lane is wide with short hops;
  // each lane higher up shrinks the slabs and opens the gaps.
  function genCourse(seed, level) {
    level = level || 0;
    const PER = perFor(level), COUNT = SECTIONS * PER;
    const r = mulberry(seed);
    // The five realms are shuffled each run, so no two courses climb through them in the same order.
    const TH = themes().slice();
    for (let i = TH.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = TH[i]; TH[i] = TH[j]; TH[j] = t; }
    const W = worldSize();
    const cx = W.w / 2, cy = W.h / 2;
    const plats = [];

    const rows = Math.ceil(COUNT / PER);
    const yTop = cy - ((rows - 1) * LANE) / 2;

    // The footprint of every island, before anything is placed.
    const size = [];
    for (let i = 0; i < COUNT; i++) {
      const sec = Math.floor(i / PER);
      size.push({
        w: Math.max(150, 268 - sec * 16 - level * 9 + Math.round(r() * 34)),
        h: Math.max(140, 232 - sec * 14 - level * 8 + Math.round(r() * 26)),
        gap: Math.min(208, GAP0 + Math.min(level * 6, 40) + sec * GAPSTEP + Math.round(r() * (16 + level * 3))),
        jit: Math.round((r() - 0.5) * (80 + level * 14))
      });
    }
    // A lane has to fit inside the arena — squeeze the slabs if it would not.
    let widest = 0;
    for (let s = 0; s < rows; s++) {
      let total = 0;
      for (let k = 0; k < PER; k++) { const it = size[s * PER + k]; total += it.w + (k < PER - 1 ? it.gap : 0); }
      widest = Math.max(widest, total);
    }
    let fit = widest > W.w - 640 ? (W.w - 640) / widest : 1;
    // Gaps are what make a jump hard, so they are never squeezed: only the slabs shrink to fit a lane.
    const gapOf = (it) => it.gap;

    for (let s = 0; s < rows; s++) {
      const laneY = yTop + s * LANE;
      // Every other lane is walked the other way, so the path snakes upwards.
      const order = [];
      for (let k = 0; k < PER; k++) order.push(k);
      if (s % 2 === 1) order.reverse();

      // Slot x positions, left to right.
      const xs = [];
      let total = 0;
      for (let k = 0; k < PER; k++) {
        const it = size[s * PER + k];
        total += Math.round(it.w * fit) + (k < PER - 1 ? gapOf(it) : 0);
      }
      let cur = cx - total / 2;
      for (let k = 0; k < PER; k++) {
        const it = size[s * PER + k];
        xs.push(cur);
        cur += Math.round(it.w * fit) + gapOf(it);
      }

      for (let pos = 0; pos < PER; pos++) {
        const k = order[pos], it = size[s * PER + k], i = s * PER + pos;
        const w = Math.round(it.w * fit), h = Math.round(it.h * fit);
        // Each island sits off its lane centre by its own jitter, so the course
        // wanders instead of marching in a straight line — but never far enough
        // to bring the next lane within jumping distance.
        const px = xs[k] + (s % 2 === 1 ? SHIFT : 0);
        const py = laneY - h / 2 + Math.round(it.jit * fit);
        plats[i] = {
          i, x: px, y: py, w, h,
          deck: DECK0 + i * RISE + Math.sin(i * 1.9) * 16,
          sec: s, theme: TH[s],
          rad: Math.hypot(px + w / 2 - cx, py + h / 2 - cy),
          th: Math.atan2(py + h / 2 - cy, px + w / 2 - cx),
          kind: 'combat', spikes: null, pad: null, chest: null, gate: null, goal: null,
          plate: null, dir: 0, monsters: []
        };
      }
    }

    // Facing of every island = the direction the path arrives from.
    for (let i = 1; i < plats.length; i++) {
      const a = plats[i - 1], b = plats[i];
      b.dir = Math.atan2((b.y + b.h / 2) - (a.y + a.h / 2), (b.x + b.w / 2) - (a.x + a.w / 2));
    }
    plats[0].dir = plats[1].dir;

    // A spike bed lies across the path, standing in the open: always up, always
    // lethal. A hop carries you over it — that is the whole hazard.
    function laySpikes(p) {
      const cxp = p.x + p.w / 2, cyp = p.y + p.h / 2;
      const ex = Math.cos(p.dir), ey = Math.sin(p.dir);
      const horiz = Math.abs(ex) >= Math.abs(ey);
      const band = clamp(Math.round((horiz ? p.w : p.h) * 0.24), 58, 88);
      const phase = (p.i * 1.7) % 6.283;
      p.spikes = horiz
        ? { x: cxp - band / 2, y: p.y + p.h * 0.12, w: band, h: p.h * 0.76, armed: true, rise: 1, phase }
        : { x: p.x + p.w * 0.12, y: cyp - band / 2, w: p.w * 0.76, h: band, armed: true, rise: 1, phase };
    }

    const sections = [];
    for (let s = 0; s < SECTIONS; s++) {
      const row = plats.slice(s * PER, s * PER + PER);

      // two of its islands are mined: the plate you step on, then the spikes
      laySpikes(row[1]);
      laySpikes(row[2]);
      if (level >= 1 && PER > 4) laySpikes(row[3]);
      if (level >= 3 && PER > 5 && r() < 0.8) laySpikes(row[PER - 2]);
      if (level >= 5 && r() < 0.7) laySpikes(row[0].i === 0 ? row[1] : row[0]);

      // every section hides one treasure island, past the spikes
      const tr = row[1];
      tr.kind = 'treasure';
      tr.chest = {
        x: tr.x + tr.w / 2 + Math.cos(tr.dir) * tr.w * 0.3,
        y: tr.y + tr.h / 2 + Math.sin(tr.dir) * tr.h * 0.3,
        open: false, r: 26
      };

      const last = row[PER - 1];
      if (s < SECTIONS - 1) {
        // The launch pad sits at the far end of the section's last island and
        // carries the body to the next lane: the crossing between lanes is by
        // far the widest void on the course, far wider than any jump.
        const nxt = plats[s * PER + PER] || null;
        const ang = nxt
          ? Math.atan2((nxt.y + nxt.h / 2) - (last.y + last.h / 2), (nxt.x + nxt.w / 2) - (last.x + last.w / 2))
          : last.dir;
        last.pad = {
          x: last.x + last.w / 2 + Math.cos(ang) * last.w * 0.26,
          y: last.y + last.h / 2 + Math.sin(ang) * last.h * 0.26,
          r: 48, flash: 0, to: nxt ? nxt.i : -1
        };
      } else {
        last.kind = 'goal';
        last.goal = { x: last.x + last.w / 2, y: last.y + last.h / 2, r: 54, armed: true };
      }

      sections.push({
        i: s, theme: TH[s], plats: row, cleared: false,
        spawned: false, monsters: [], alive: 0
      });
    }

    return { seed, level, per: PER, plats, sections, safe: plats[0], seedName: '#' + (seed % 9973) };
  }

  function platAt(x, y) {
    const c = S.course; if (!c) return null;
    for (const p of c.plats) if (inRect(p, x, y, 0)) return p;
    return null;
  }

  // --------------------------------------------------------- engine bridges
  function installW3() {
    const W3 = window.W3; if (!W3 || W3.__pkHooked) return;
    const orig = W3.ensure;
    W3.ensure = function (world, tid) {
      const D = orig.call(W3, world, tid);
      injectSurfaces(D);
      return D;
    };
    // The course owns the player's height outright. The engine's own step looks
    // for the nearest surface it can find — the arena floor far below, or a
    // neighbouring slab — and snaps the body onto it, which is what dragged a
    // jump straight back down. While the course runs, its vertical work for the
    // player is replaced by the islands themselves.
    const step = W3.stepPlayer;
    W3.stepPlayer = function (p, dt) {
      if (!S.active || !S.course || p !== player()) return step.apply(this, arguments);
      if (BODY.fly) return;                       // the pad arc drives height
      const d = Math.min(dt, 0.05);
      const here = platAt(p.x, p.y);
      const floor = here ? here.deck : null;
      p.vz = (p.vz || 0) - 1300 * d;
      p.z = (p.z || 0) + p.vz * d;
      if (p.vz > 1) BODY.air = true;
      if (floor != null && p.vz <= 0 && p.z <= floor) { p.z = floor; p.vz = 0; BODY.air = false; }
      else if (floor != null && !BODY.air && p.z < floor) { p.z = floor; p.vz = 0; }
    };
    W3.__pkHooked = true;
  }

  // Each island becomes a real surface at its own height, so the engine's own
  // physics keeps the player, monsters and bullets honest.
  function injectSurfaces(D) {
    if (!D || !S.active || !S.course) return;
    if (D._pkSeed === S.course.seed && D._pkOwn && D._pkOwn.length === S.course.plats.length) return;
    if (D._pkOwn) for (const s of D._pkOwn) { const i = D.surfaces.indexOf(s); if (i >= 0) D.surfaces.splice(i, 1); }
    const own = [];
    for (const p of S.course.plats) {
      const surf = { x: p.x, y: p.y, w: p.w, h: p.h, ax: 'x', dir: 1, z0: p.deck, z1: p.deck, k: 'deck' };
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

  // The decks stay physical for the whole run: if the engine ever rebuilds its
  // collision data without them, a body drops straight through the island it is
  // standing on — so the surfaces are put back before that can happen.
  function syncDecks() {
    const D = window.W3 && window.W3.data;
    if (!D || !S.course) return;
    if (D._pkSeed === S.course.seed && D._pkOwn && D._pkOwn.length === S.course.plats.length) return;
    injectSurfaces(D);
  }

  // The arena underneath is stripped bare: only the islands remain.
  function hookWorldBuild() {
    const prev = window._onWorldBuilt;
    if (prev && prev.__pk) return;
    const fn = function (w, theme) {
      if (prev) prev.call(this, w, theme);
      if (!S.active || !S.course) return;
      w.buildings.length = 0; w.walls.length = 0; w.hazards.length = 0; w.chests.length = 0;
      w.solids = w.solids.filter((s) => s.x <= 1 || s.y <= 1 || s.x + s.w >= w.w - 1 || s.y + s.h >= w.h - 1);
      w._parkour = S.course;
      // A rebuilt world is a fresh run: dying rebuilds it and wipes the arena's
      // monster list, so every island stocks its monsters again. A section that
      // was emptied that way could otherwise stand there cleared for free.
      S.course.sections.forEach((sec) => {
        sec.spawned = false; sec.cleared = false; sec.alive = 0;
        sec.monsters = [];
        (sec.plats || []).forEach((p) => { p.monsters = []; });
      });
    };
    fn.__pk = true;
    window._onWorldBuilt = fn;
  }

  // ---------------------------------------------------------------- monsters
  function spawnSection(sec) {
    if (!sec || sec.cleared) return 0;
    const dbg = window.__dbg;
    if (!dbg || !dbg.spawnEnemy) return 0;
    // A finished section stays finished; a section that still holds living
    // monsters needs nothing more. One that was stocked and now stands empty —
    // a death wiped the arena's list — is stocked afresh, so the monsters turn
    // up however many times the run is restarted.
    if (sec.spawned && aliveIn(sec) > 0) return 0;
    if (sec.spawned) {
      sec.monsters = [];
      sec.plats.forEach((p) => { p.monsters = []; });
    }
    const types = MONSTERS[sec.i % MONSTERS.length];
    sec.plats.forEach((p, k) => {
      // The island you land on is left clear: the fight starts after the jump.
      if (p.i === 0) return;
      const lv = (S.course && S.course.level) || 0;
      const n = Math.min(7, (p.goal ? 4 : 3) + Math.floor(lv / 2));
      const dir = p.dir || 0;
      const side = dir + Math.PI / 2;
      for (let j = 0; j < n; j++) {
        const type = types[(k + j) % types.length];
        // …and they wait at the FAR end, so you have to cross the slab to them
        const ahead = .34 + (j % 2) * .07;
        const across = (j - (n - 1) / 2) * .26;
        // Every one of them stands INSIDE the slab: a body spawned past its edge
        // drops into the sky before anything can catch it.
        const sx = clamp(p.x + p.w / 2 + Math.cos(dir) * p.w * ahead + Math.cos(side) * p.h * across, p.x + 30, p.x + p.w - 30);
        const sy = clamp(p.y + p.h / 2 + Math.sin(dir) * p.h * ahead + Math.sin(side) * p.h * across, p.y + 30, p.y + p.h - 30);
        try { dbg.spawnEnemy(type, sx, sy); } catch (_) { continue; }
        const arr = enemyList(); const e = arr[arr.length - 1];
        if (!e) continue;
        e.z = p.deck; e.vz = 0;
        e.hp = Math.round(e.hp * (1 + sec.i * 0.7) * (1 + lv * 0.22)); e.maxhp = e.hp;
        if (lv >= 2) e.speed *= 1 + Math.min(.3, lv * .03);
        // They wake when you set foot on their island — never before. A wide
        // detection radius had the whole course firing at you mid-jump.
        e._pkDetect = 460;
        e.detectR = 0; e.alerted = false; e.alertT = 0;
        e._pkPlat = p;
        p.monsters.push(e); sec.monsters.push(e);
      }
    });
    // Nothing was created (the engine refused) — leave the section unspawned so
    // a later attempt can still stock it.
    if (!sec.monsters.length) return 0;
    sec.spawned = true;
    sec.alive = sec.monsters.length;
    updateHud();
    return sec.monsters.length;
  }

  // Counted straight off every monster's own island reference, so a cleared
  // section is never missed and a stale list can never strand one alive.
  function aliveIn(sec) {
    return enemyList().filter((e) => e && e.hp > 0 && e._pkPlat && e._pkPlat.sec === sec.i).length;
  }

  function checkSections() {
    const c = S.course; if (!c) return;
    for (const sec of c.sections) {
      if (!sec.spawned) continue;
      sec.alive = aliveIn(sec);
      if (sec.alive > 0 || sec.cleared) continue;
      sec.cleared = true;
      flash(sec.theme.name.toUpperCase() + ' CLEARED', sec.theme.accent);
      shake(8);
      updateHud();
    }
  }

  function shake(v) { try { if (window._Gauntlet && window._Gauntlet.camShake) window._Gauntlet.camShake(v); } catch (_) {} }

  // ------------------------------------------------------------- respawning
  function respawn(msg) {
    const c = S.course; if (!c) return;
    const p0 = c.plats[0];
    const P = player();
    S.deaths++;
    S.airT = 0;
    if (P) {
      P.x = p0.x + p0.w / 2; P.y = p0.y + p0.h / 2;
      P.z = p0.deck; P.vz = 0;
      BODY.deck = p0.deck; BODY.padT = 0; BODY.fly = null; BODY.air = false;
      P.hp = P.hpMax || 100;
    }
    shake(12);
    flash(msg || 'BACK TO THE START', '#7fe4ff');
    updateHud();
  }

  // ---------------------------------------------------------------- hazards
  // Jump pads and spike beds, read straight off the body: its own position for
  // the pad's footprint, its own height over the deck for the bed. Nothing here
  // asks the engine what the ground is, because on the course the island IS the
  // ground and the engine's idea of it lives far below in the arena.
  const SPIKE_CLEAR = 40;      // this much air over the bed clears the drawn needles
  const PAD_GRAB = 44;         // a pad answers feet at — or landing on — its own surface
  const PAD_GRIP = 0.5;        // the rim is where your feet are, not a wide halo

  function hazards(dt, P, c, here) {
    // --- jump pads: walking onto one launches the body on an arc into the next
    //     lane, driven frame by frame from here so it fires every single time.
    //     Touch is what arms it: inside the rim, on the pad's own surface, and
    //     never on the way up — so a hop over a pad still passes clean over it,
    //     while landing on one (or walking on) always launches.
    if (!BODY.fly) {
      for (const p of c.plats) {
        const pad = p.pad;
        if (!pad) continue;
        if ((P.vz || 0) > 1) continue;
        const under = (here && typeof here.deck === 'number') ? here.deck : p.deck;
        if ((P.z || 0) - under > PAD_GRAB) continue;
        if (Math.hypot(P.x - pad.x, P.y - pad.y) > pad.r + (P.r || 16) * PAD_GRIP) continue;
        const to = c.plats[pad.to];
        if (!to) continue;
        BODY.padT = performance.now();
        BODY.fly = {
          t: 0, dur: PAD_TIME,
          x0: P.x, y0: P.y, z0: Math.max(P.z || p.deck, p.deck),
          x1: to.x + to.w / 2,
          y1: to.y + to.h / 2,
          z1: to.deck
        };
        BODY.air = true;
        pad.flash = 1;
        shake(9);
        flash('LAUNCH', p.theme.accent);
        break;
      }
    }
    if (BODY.fly) {
      const f = BODY.fly;
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const ease = k * k * (3 - 2 * k);            // eases out of the pad, settles on the far side
      P.x = f.x0 + (f.x1 - f.x0) * ease;
      P.y = f.y0 + (f.y1 - f.y0) * ease;
      P.z = f.z0 + (f.z1 - f.z0) * ease + Math.sin(k * Math.PI) * PAD_ARC;
      P.vz = 1;                                    // keeps the engine's airborne branch off the floor
      S.airT = 0;
      if (k >= 1) {
        BODY.fly = null; P.z = f.z1; P.vz = 0; BODY.air = false;
        BODY.deck = f.z1;
      }
    }

    // --- spike beds: every bed on the course is tested, not just the island
    //     the body's centre happens to be over, so a body straddling an edge is
    //     still caught. The bed bites anything standing in it; a hop or a pad
    //     arc passing over the top is clear, because height is what decides.
    for (const p of c.plats) {
      const bed = p.spikes;
      if (!bed || bed.armed === false) continue;
      if (BODY.fly) continue;
      if ((P.z || 0) > p.deck + SPIKE_CLEAR) continue;
      // A little tighter than the drawn bed, so the rim never snags you.
      if (!inRect(bed, P.x, P.y, -(P.r || 16) * 0.35)) continue;
      respawn('IMPALED — BACK TO THE START');
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------- tick
  function tick(dt) {
    if (!S.active || S.done) return;
    const c = S.course, P = player();
    if (!c || !P) return;
    if (P.hp <= 0) { respawn('DOWN — BACK TO THE START'); return; }

    S.t += dt;

    // The arena's own wave spawner is silenced for the whole run: it knows
    // nothing about the islands, so every wave it released dropped monsters
    // into the void underneath the course.
    try { const st = window.__dbg && window.__dbg.state; if (st) st.nextWaveT = 999; } catch (_) {}

    // Where the body stands right now. The height bookkeeping below works off
    // this, and it is looked up again after a pad launch, because the arc moves
    // the body: the island you left is not the one you finish the frame on.
    let here = platAt(P.x, P.y);
    // …and the islands' collision data is kept in place even if the engine
    // rebuilds it.
    try { syncDecks(); } catch (_) {}

    // --- height. The course owns it outright, and it does so in one place
    //     only: the player's own physics step (see installW3). There is no
    //     second writer here, so nothing can land the body mid-arc any more —
    //     a jump keeps its rise until it genuinely comes back down to a slab.

    // --- pads and beds are settled FIRST, on the body's own position and its
    //     own height above the deck. Everything else in the frame (monsters,
    //     chests, the beacon) comes after them, so a hitch anywhere below can
    //     never leave a player standing in a spike bed or on a live pad.
    if (hazards(dt, P, c, here)) return;

    // The pad arc moves the body, so where it stands is looked up again — and
    // the island it lands on stocks its monsters.
    here = platAt(P.x, P.y);
    if (here) {
      BODY.deck = here.deck;
      spawnSection(c.sections[here.sec]);
    }

    // --- into the electric surge. A jump between two islands rides at deck
    //     height, so height is what decides it: only a body that has dropped
    //     well BELOW the lowest deck is falling. Time off the course is a
    //     backstop for anything stranger, and it is set long enough that no
    //     jump, however long, can ever end a run in mid-air.
    if (here) S.airT = 0;
    else {
      S.airT += dt;
      const padAir = BODY.padT && performance.now() - BODY.padT < 3600;
      const sunk = typeof P.z === 'number' && P.z < DECK0 - FALL_DROP;
      if (sunk || S.airT > (padAir ? PAD_GRACE : FALL_T)) {
        respawn('INTO THE SURGE — BACK TO THE START'); return;
      }
    }

    // --- every monster in the world is walked from the engine's own list, so
    //     nothing is ever missed by a stale bookkeeping array: each one is held
    //     on its slab and only engages once you are standing on that same slab.
    //     Away from it they hold their post and drop their aim entirely, so
    //     nothing shoots you out of the air mid-jump.
    const all = enemyList();
    for (let i = all.length - 1; i >= 0; i--) {
      const e = all[i];
      const p = e && e._pkPlat;
      // Anything without a slab is a stray the arena dropped into the sky —
      // killed off rather than left to fall through the course.
      if (!p) { e.hp = 0; continue; }
      const pad = 26;
      e.x = clamp(e.x, p.x + pad, p.x + p.w - pad);
      e.y = clamp(e.y, p.y + pad, p.y + p.h - pad);
      e.z = p.deck; e.vz = 0;
      if (here === p) {
        e.detectR = e._pkDetect || 460;
        e.alertT = Math.max(e.alertT || 0, 2.5);
        e.alerted = true;
      } else {
        e.alerted = false; e.alertT = 0; e.detectR = 0;
      }
    }

    // --- treasure
    for (const p of c.plats) {
      const ch = p.chest;
      if (!ch || ch.open) continue;
      if (Math.hypot(P.x - ch.x, P.y - ch.y) > ch.r + (P.r || 16)) continue;
      ch.open = true; S.chests++;
      P.hp = Math.min(P.hpMax || 100, P.hp + 25);
      if (typeof P.reserve === 'number') P.reserve += 20;
      flash('TREASURE — PATCHED UP', '#ffd166');
    }

    checkSections();

    // --- the end of the climb: setting foot on the last island, or reaching its
    //     beacon, wins the run — whichever comes first.
    if (!S.done) {
      const top = c.plats[c.plats.length - 1];
      const g = top.goal;
      if (here === top || (g && Math.hypot(P.x - g.x, P.y - g.y) < g.r + 30)) {
        try { complete(); } catch (err) { console.warn('[Parkour] complete', err); flash('COURSE CLEARED', '#9dffcf'); }
      }
    }

    for (const p of c.plats) {
      if (p.pad && p.pad.flash > 0) p.pad.flash = Math.max(0, p.pad.flash - dt * 1.6);
    }
    if (S.flashT > 0) { S.flashT -= dt; if (S.flashT <= 0 && S.flashEl) S.flashEl.style.opacity = '0'; }
  }

  function loop() {
    if (!S.active) return;
    const now = performance.now();
    const dt = Math.min(0.06, (now - (S.last || now)) / 1000);
    S.last = now;
    try { tick(dt); } catch (err) { console.warn('[Parkour] tick', err); }
    hudT++;
    if (hudT % 6 === 0) updateHud();
    S.raf = requestAnimationFrame(loop);
  }
  let hudT = 0;

  // -------------------------------------------------------------------- HUD
  // Built on demand and re-checked, so the finish screen always exists when the
  // run is won — never silently missing.
  function ensureVictoryOverlay() {
    let o = document.getElementById('pkOverlay');
    if (o) return o;
    o = document.createElement('div');
    o.id = 'pkOverlay';
    o.innerHTML =
      '<div class="pkCard">' +
      '<div class="pkOTitle" id="pkOTitle">VICTORY</div>' +
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
    return o;
  }

  function buildHud() {
    if (!S.hud) {
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
    } else {
      S.hud.style.display = '';
    }
    ensureVictoryOverlay();
  }

  function updateHud() {
    const c = S.course;
    if (!S.hud || !c) return;
    const seedEl = document.getElementById('pkSeed');
    if (seedEl) seedEl.textContent = c.seedName + ' · LV ' + ((c.level || 0) + 1) + ' · ' + c.plats.length + ' islands';
    const pips = document.getElementById('pkPips');
    if (pips) {
      pips.innerHTML = c.sections.map((s) =>
        '<i class="' + (s.cleared ? 'on' : '') + '" style="--pk:' + s.theme.accent + '"></i>').join('');
    }
    const P = player() || {};
    const here = platAt(P.x || 0, P.y || 0);
    const sec = c.sections[here ? here.sec : 0] || c.sections[0];
    const secEl = document.getElementById('pkSection');
    if (secEl) secEl.textContent = sec ? sec.theme.name.toUpperCase() : '—';
    const st = document.getElementById('pkStat');
    if (st) {
      if (sec && !sec.cleared) st.textContent = sec.spawned ? (sec.alive + ' left') : 'entering…';
      else if (here && here.pad) st.textContent = 'take the pad';
      else st.textContent = 'climb to the beacon';
    }
  }

  function flash(msg, color) {
    if (!S.flashEl) return;
    S.flashEl.textContent = msg;
    S.flashEl.style.color = color || '#eaf4ff';
    S.flashEl.style.opacity = '1';
    S.flashT = 1.45;
  }

  // ------------------------------------------------------------- completion
  function complete() {
    S.done = true;
    const bonus = Math.max(0, 24 - Math.round(S.t / 14));
    const lvl = S.level || 0, total = 30 + bonus + lvl * 6;
    saveLevel(lvl + 1);
    // The run's whole payment lands here and nowhere else.
    S.earned = total;
    try { if (window.RS && window.RS.add) window.RS.add(total, 'Sky parkour completed'); } catch (_) {}
    try { if (window.RankXP && window.RankXP.addQuest) window.RankXP.addQuest(220, 'Sky parkour cleared'); } catch (_) {}

    const o = ensureVictoryOverlay();
    const t = o.querySelector('#pkOTitle');
    if (t) t.textContent = 'VICTORY';
    const sub = o.querySelector('#pkOSub');
    if (sub) sub.textContent = 'Five realms crossed — the surge is beneath you.';
    const grid = o.querySelector('#pkOGrid');
    if (grid) {
      const rows = [
        ['Course', S.course.seedName + ' · level ' + (lvl + 1)],
        ['Next course', perFor(lvl + 1) * SECTIONS + ' islands · harder'],
        ['Time', S.t.toFixed(1) + 's'],
        ['Restarts', String(S.deaths)],
        ['Chests', String(S.chests)],
        ['RuneStones', '+' + total + ' ◈']
      ];
      grid.innerHTML = rows.map((r) => '<div><b>' + r[0] + '</b><span>' + r[1] + '</span></div>').join('');
    }
    o.style.display = 'grid';
    if (S.hud) S.hud.style.display = 'none';
    if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
    flash('COURSE CLEARED', '#9dffcf');
  }

  // -------------------------------------------------------------- lifecycle
  function hideOverlays(exceptId) {
    document.querySelectorAll('.overlay').forEach((o) => {
      if (o.id !== exceptId && o.id !== 'overlayBoot') o.style.display = 'none';
    });
  }

  // Put the fighter on the first island — at launch, and again a frame later,
  // after the engine has finished its own start-up work.
  function placeOnStart() {
    if (!S.active || !S.course) return;
    const P = player(), p0 = S.course.plats[0];
    if (!P || !p0) return;
    P.x = p0.x + p0.w / 2; P.y = p0.y + p0.h / 2;
    P.z = p0.deck; P.vz = 0; BODY.padT = 0; BODY.deck = p0.deck;
    BODY.fly = null; BODY.air = false;
  }

  function start() {
    const G = window._Gauntlet;
    if (!G || !G.restart) return;
    installW3();
    hookWorldBuild();

    S.active = true; S.done = false; S.t = 0; S.deaths = 0; S.earned = 0;
    S.chests = 0; S.airT = 0;
    S.seed = (Math.random() * 1e9) | 0;
    S.level = loadLevel();
    S.course = genCourse(S.seed, S.level);
    window.PARKOUR_ACTIVE = true;
    // Drop the last course's floor patches so a new course builds fresh ones.
    try { if (window.Render3D && Render3D.clearGroundPatches) Render3D.clearGroundPatches(); } catch (_) {}

    window.TEAMS_MODE = false; window.CTF_MODE = false; window.PVP_MODE = false; window.BOTS_ENABLED = false;
    try { if (window.Teams) Teams.reset(); } catch (_) {}
    try { if (window.CTF) CTF.reset(); } catch (_) {}
    try { if (window.LevelsMode && LevelsMode.active) LevelsMode.stop(); } catch (_) {}
    try { if (window._endStoryRun) window._endStoryRun(); } catch (_) {}

    // One failing stage must never take the rest of the run down with it: the
    // simulation loop starts first, then every step is fired on its own.
    S.last = performance.now();
    if (S.raf) cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(loop);

    const step = (fn, label) => { try { fn(); } catch (err) { console.warn('[Parkour] ' + label, err); } };

    step(() => { window.MENU_CONTEXT = 'single'; hideOverlays(''); }, 'overlays');
    // The arena's own neon floor must not show through the course: the ground
    // plane is skipped while PARKOUR_ACTIVE, leaving only the electric sea.
    step(() => { if (G.setThemeById) G.setThemeById(1); }, 'theme');
    step(() => G.restart(), 'restart');

    step(placeOnStart, 'place');
    setTimeout(() => step(placeOnStart, 'place-late'), 90);

    step(() => spawnSection(S.course.sections[0]), 'spawn');
    step(installFloorHook, 'floor');
    step(buildHud, 'hud');
    step(() => { const ov = document.getElementById('pkOverlay'); if (ov) ov.style.display = 'none'; }, 'overlay');
    step(updateHud, 'hud-update');
    step(() => flash('COURSE ' + S.course.seedName + ' — GO', '#9fe3ff'), 'flash');
  }

  function stop() {
    S.active = false; S.done = false;
    window.PARKOUR_ACTIVE = false;
    if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
    if (S.hud) S.hud.style.display = 'none';
    const o = document.getElementById('pkOverlay'); if (o) o.style.display = 'none';
    const f = document.getElementById('pkFlash'); if (f) f.style.opacity = '0';
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
  // Each island's plate: the realm's arena, shrunk to fit the slab.
  function paintPlate(p) {
    if (p.plate) return p.plate;
    const w = Math.round(p.w), h = Math.round(p.h);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    const th = PAL[p.theme.id] || PAL[1];
    const r = mulberry((p.i * 7919 + p.theme.id * 131) | 0);

    const base = g.createLinearGradient(0, 0, w * 0.7, h);
    base.addColorStop(0, th.base); base.addColorStop(1, th.base2);
    g.fillStyle = base; g.fillRect(0, 0, w, h);

    // ---- the miniature map, inset so the slab edge still reads
    const m = 12, mw = w - m * 2, mh = h - m * 2;
    g.save();
    g.beginPath(); if (g.roundRect) g.roundRect(m, m, mw, mh, 9); else g.rect(m, m, mw, mh); g.clip();

    const field = g.createLinearGradient(m, m, m + mw, m + mh);
    field.addColorStop(0, 'rgba(255,255,255,.07)');
    field.addColorStop(1, 'rgba(0,0,0,.24)');
    g.fillStyle = field; g.fillRect(m, m, mw, mh);

    g.strokeStyle = th.grid; g.lineWidth = 1;
    for (let x = m; x < m + mw; x += 18) { g.beginPath(); g.moveTo(x, m); g.lineTo(x, m + mh); g.stroke(); }
    for (let y = m; y < m + mh; y += 18) { g.beginPath(); g.moveTo(m, y); g.lineTo(m + mw, y); g.stroke(); }

    // hazard patch — the realm's own mechanic, shrunk
    const hz = { w: 30 + r() * 34, h: 18 + r() * 22 };
    const hx = m + 8 + r() * (mw - hz.w - 16), hy = m + 8 + r() * (mh - hz.h - 16);
    g.fillStyle = th.hazard;
    g.beginPath(); g.ellipse(hx + hz.w / 2, hy + hz.h / 2, hz.w / 2, hz.h / 2, r() * 3, 0, Math.PI * 2); g.fill();

    // buildings
    const nb = 3 + ((r() * 3) | 0);
    for (let i = 0; i < nb; i++) {
      const bw = 16 + r() * 26, bh = 13 + r() * 20;
      const bx = m + 6 + r() * (mw - bw - 12), by = m + 6 + r() * (mh - bh - 12);
      g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(bx + 3, by + 3, bw, bh);
      g.fillStyle = th.roof; g.fillRect(bx, by, bw, bh);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(bx, by, bw, Math.max(3, bh * 0.28));
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.4; g.strokeRect(bx, by, bw, bh);
    }

    // a couple of walls
    for (let i = 0; i < 2; i++) {
      const ww = 22 + r() * 46, wh = 4;
      const wx = m + 6 + r() * (mw - ww - 12), wy = m + 8 + r() * (mh - 16);
      g.fillStyle = th.wall; g.globalAlpha = 0.85; g.fillRect(wx, wy, ww, wh); g.globalAlpha = 1;
    }

    // treasure marker
    if (p.kind === 'treasure') {
      const cx = mw / 2, cy = mh / 2;
      g.fillStyle = 'rgba(255,214,120,.95)';
      g.fillRect(m + cx - 5, m + cy - 5, 10, 10);
      g.strokeStyle = 'rgba(255,240,190,.9)'; g.lineWidth = 1.5;
      g.strokeRect(m + cx - 7, m + cy - 7, 14, 14);
    }

    g.restore();

    // plate shading + rim
    const sheen = g.createLinearGradient(0, 0, w * 0.5, h * 0.7);
    sheen.addColorStop(0, 'rgba(255,255,255,.14)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,.02)');
    sheen.addColorStop(1, 'rgba(0,0,0,.3)');
    g.fillStyle = sheen; g.fillRect(0, 0, w, h);
    g.strokeStyle = th.rim; g.lineWidth = 2; g.globalAlpha = 0.75;
    g.strokeRect(1, 1, w - 2, h - 2);
    g.globalAlpha = 1;

    p.plate = cv;
    return cv;
  }

  // Rolling electric liquid: banded waves, crest glow, stray arcs.
  function bolt(g, x, y, len, dir, rnd) {
    g.beginPath(); g.moveTo(x, y);
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      g.lineTo(x + Math.cos(dir) * len * t + (rnd() - 0.5) * 26, y + Math.sin(dir) * len * t + (rnd() - 0.5) * 22);
    }
    g.stroke();
  }

  function drawLiquid(g, W, H, ox, oy, t) {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#04101c');
    bg.addColorStop(0.55, '#062238');
    bg.addColorStop(1, '#031322');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);

    // rolling bands
    const cols = ['110,230,255', '56,160,240', '150,245,255', '40,120,210'];
    for (let i = 0; i < 9; i++) {
      const sp = 0.22 + (i % 3) * 0.13;
      const y0 = (((-oy * sp + i * 97 - t * (16 + i * 6)) % (H + 320)) + H + 320) % (H + 320) - 160;
      const amp = 12 + (i % 4) * 8;
      const ph = ox * sp * 0.9 + t * (0.5 + (i % 3) * 0.22);
      g.beginPath();
      for (let x = -60; x <= W + 60; x += 38) {
        const y = y0 + Math.sin(x * 0.0062 + ph) * amp + Math.sin(x * 0.0145 - ph * 1.35) * amp * 0.45;
        if (x === -60) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokeStyle = 'rgba(' + cols[i % 4] + ',' + (0.09 + (i % 4) * 0.045).toFixed(3) + ')';
      g.lineWidth = 8 + (i % 5) * 8;
      g.lineCap = 'round';
      g.stroke();
    }

    // crest glow
    const glow = g.createRadialGradient(W * 0.5, H * 0.55, 0, W * 0.5, H * 0.55, Math.max(W, H) * 0.8);
    glow.addColorStop(0, 'rgba(70,190,255,.14)');
    glow.addColorStop(1, 'rgba(20,60,140,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);

    // electric arcs, re-rolled a few times a second
    const q = Math.floor(t * 3.5);
    g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const rnd = mulberry((q * 977 + i * 613) | 0);
      const sx = rnd() * W, sy = H * (0.12 + rnd() * 0.88);
      g.save();
      g.strokeStyle = 'rgba(190,245,255,.85)';
      g.shadowColor = 'rgba(120,220,255,.95)';
      g.shadowBlur = 16;
      g.lineWidth = 1.6 + rnd() * 1.6;
      bolt(g, sx, sy, 60 + rnd() * 170, (rnd() - 0.5) * 2, rnd);
      g.restore();
    }
  }

  function drawIsland(g, p, ox, oy) {
    const x = p.x + ox, y = p.y + oy;
    const th = PAL[p.theme.id] || PAL[1];
    const lift = 16 + Math.max(0, p.deck - DECK0) * 0.14;   // higher islands hang deeper

    // shadow cast into the surge
    g.save();
    g.globalAlpha = 0.45;
    const sh = g.createRadialGradient(x + p.w / 2, y + p.h / 2 + lift + 20, 6, x + p.w / 2, y + p.h / 2 + lift + 20, Math.max(p.w, p.h) * 0.8);
    sh.addColorStop(0, 'rgba(0,0,0,.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.fillRect(x - p.w * 0.45, y - p.h * 0.45, p.w * 1.9, p.h * 2);
    g.restore();

    // rocky underside
    const ug = g.createLinearGradient(0, y + p.h - 12, 0, y + p.h + lift);
    ug.addColorStop(0, th.rock); ug.addColorStop(1, th.rock2);
    g.fillStyle = ug;
    g.beginPath();
    g.moveTo(x, y + p.h - 12);
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const jag = Math.sin(u * 9 + p.i) * 10 + Math.sin(u * 23) * 5;
      g.lineTo(x + p.w * u, y + p.h + lift * 0.55 + jag);
    }
    g.lineTo(x + p.w, y + p.h - 12);
    g.closePath(); g.fill();

    // the plate itself
    g.save();
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 14; g.shadowOffsetY = 7;
    g.drawImage(paintPlate(p), x, y);
    g.restore();

    // rim light
    g.save();
    g.strokeStyle = th.rim; g.globalAlpha = 0.45; g.lineWidth = 2;
    g.shadowColor = th.rim; g.shadowBlur = 12;
    g.strokeRect(x + 1, y + 1, p.w - 2, p.h - 2);
    g.restore();

    if (p.spikes) drawSpikeBed(g, p, x, y);
    if (p.pad) drawPad(g, p, x, y);
    if (p.chest) drawChest(g, p, x, y);
    if (p.gate && !p.gate.open) drawGate(g, p, x, y);
    if (p.goal) drawGoal(g, p, x, y);
  }

  // A spike bed stays shut and out of sight until its pressure plate is stepped
  // on: only the recessed slot shows, so you can see where not to stand. Then
  // the blades rise and the band turns lethal.
  function drawSpikeBed(g, p, x, y) {
    const s = p.spikes, t = performance.now() / 1000;
    const sx = s.x + x - p.x, sy = s.y + y - p.y;
    g.save();

    g.fillStyle = 'rgba(6,8,14,.85)';
    g.fillRect(sx, sy, s.w, s.h);
    g.strokeStyle = s.armed ? 'rgba(255,120,90,.8)' : 'rgba(160,180,210,.3)';
    g.lineWidth = 1.5;
    g.strokeRect(sx, sy, s.w, s.h);

    if (s.rise <= 0.001) {
      // shut: faint warning chevrons across the slot
      g.globalAlpha = 0.18 + 0.08 * Math.sin(t * 2);
      g.strokeStyle = '#9fb4d0'; g.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const yy = sy + s.h * (0.28 + i * 0.22);
        g.beginPath(); g.moveTo(sx + 5, yy + 6); g.lineTo(sx + s.w / 2, yy); g.lineTo(sx + s.w - 5, yy + 6); g.stroke();
      }
      g.restore();
      return;
    }

    // armed: the blades rise out of the slot
    const rise = s.rise;
    const cols = Math.max(3, Math.round(s.w / 22));
    const rows = Math.max(2, Math.round(s.h / 22));
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const bx = sx + (ix + 0.5) * (s.w / cols);
        const by = sy + (iy + 0.55) * (s.h / rows);
        const sz = Math.min(s.w / cols, s.h / rows) * 0.6 * rise;
        if (sz < 1) continue;
        const shine = 0.75 + 0.25 * Math.sin(t * 5 + ix * 0.7 + iy * 1.3);
        const grd = g.createLinearGradient(bx - sz, by + sz * 0.6, bx + sz, by - sz);
        grd.addColorStop(0, '#4a4f5c'); grd.addColorStop(0.55, '#c9d2e0'); grd.addColorStop(1, '#ffffff');
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(bx - sz, by + sz * 0.55);
        g.lineTo(bx + sz, by + sz * 0.55);
        g.lineTo(bx, by - sz * shine);
        g.closePath(); g.fill();
      }
    }
    if (rise < 1) {
      g.globalAlpha = (1 - rise) * 0.45;
      g.fillStyle = '#ffd9b0';
      g.fillRect(sx, sy, s.w, s.h);
      g.globalAlpha = 1;
    }
    g.restore();
  }

  function drawPad(g, p, x, y) {
    const pad = p.pad, t = performance.now() / 1000;
    const cx = pad.x + x - p.x, cy = pad.y + y - p.y;
    const flash = pad.flash || 0;
    g.save();

    // housing
    g.fillStyle = '#1b2230';
    g.beginPath(); g.arc(cx, cy, pad.r * 1.06, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(160,200,255,.5)'; g.lineWidth = 2; g.stroke();

    // launch plate
    const grd = g.createRadialGradient(cx, cy - 4, 2, cx, cy, pad.r);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.35, p.theme.accent);
    grd.addColorStop(1, 'rgba(20,40,70,.9)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(cx, cy, pad.r * 0.82, 0, Math.PI * 2); g.fill();

    // segmented ring
    const spin = t * 1.6;
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc(cx, cy, pad.r * 0.72, spin + i * 1.047, spin + i * 1.047 + 0.62);
      g.stroke();
    }

    // ripple rings thrown off the plate
    g.strokeStyle = p.theme.accent;
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.9 + i / 3) % 1);
      g.globalAlpha = (1 - k) * 0.6;
      g.lineWidth = 2.5;
      g.beginPath(); g.arc(cx, cy, pad.r * (0.5 + k * 1.15), 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;

    // chevrons climbing out of the pad
    g.fillStyle = 'rgba(255,255,255,.92)';
    for (let i = 0; i < 3; i++) {
      const ay = cy - 6 - i * 11 - ((t * 46) % 11);
      g.beginPath();
      g.moveTo(cx, ay - 8); g.lineTo(cx - 8, ay + 3); g.lineTo(cx + 8, ay + 3);
      g.closePath(); g.fill();
    }

    if (flash > 0) {
      g.globalAlpha = flash * 0.7;
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(cx, cy, pad.r * 1.4, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    g.restore();
  }

  function drawChest(g, p, x, y) {
    const ch = p.chest, t = performance.now() / 1000;
    const cx = ch.x + x - p.x, cy = ch.y + y - p.y;
    g.save();
    const gl = g.createRadialGradient(cx, cy, 2, cx, cy, 46);
    gl.addColorStop(0, ch.open ? 'rgba(255,225,140,.5)' : 'rgba(255,200,90,.28)');
    gl.addColorStop(1, 'rgba(255,190,80,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(cx, cy, 46, 0, Math.PI * 2); g.fill();

    const w = 40, h = 26;
    const bg = g.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
    bg.addColorStop(0, '#8a5a2a'); bg.addColorStop(0.5, '#6b421d'); bg.addColorStop(1, '#402514');
    g.fillStyle = bg;
    g.beginPath(); if (g.roundRect) g.roundRect(cx - w / 2, cy - h / 2 + 6, w, h - 6, 4); else g.rect(cx - w / 2, cy - h / 2 + 6, w, h - 6); g.fill();

    g.save();
    g.translate(cx, cy - h / 2 + 6);
    if (ch.open) g.rotate(-0.7);
    const lg = g.createLinearGradient(0, -12, 0, 6);
    lg.addColorStop(0, '#a06e33'); lg.addColorStop(1, '#5d3818');
    g.fillStyle = lg;
    g.beginPath(); if (g.roundRect) g.roundRect(-w / 2, -12, w, 16, 5); else g.rect(-w / 2, -12, w, 16); g.fill();
    g.restore();

    g.fillStyle = '#e8c368';
    g.fillRect(cx - w / 2 + 4, cy - 2, 4, h - 4);
    g.fillRect(cx + w / 2 - 8, cy - 2, 4, h - 4);
    g.fillStyle = '#ffe9a8';
    g.beginPath(); g.arc(cx, cy + 2, 3, 0, Math.PI * 2); g.fill();
    if (!ch.open) {
      g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3);
      g.fillStyle = '#fff6cc';
      g.beginPath(); g.arc(cx, cy - h / 2 + 2, 1.7, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  // The gate is drawn across the path: a wall of light you cannot walk through
  // until the section's monsters are dead.
  function drawGate(g, p, x, y) {
    const gate = p.gate, t = performance.now() / 1000;
    const cx = p.x + p.w / 2 + x - p.x, cy = p.y + p.h / 2 + y - p.y;
    g.save();
    g.translate(cx, cy);
    g.rotate(p.dir);
    const bw = 14, bh = p.h * 0.62;
    const grd = g.createLinearGradient(bw, 0, -bw, 0);
    grd.addColorStop(0, 'rgba(255,255,255,.1)');
    grd.addColorStop(0.5, p.theme.accent);
    grd.addColorStop(1, 'rgba(255,255,255,.1)');
    g.globalAlpha = 0.45 + 0.2 * Math.sin(t * 5) + (gate.flash || 0) * 0.4;
    g.fillStyle = grd;
    g.fillRect(-bw, -bh / 2, bw * 2, bh);
    g.globalAlpha = 0.9;
    g.strokeStyle = '#ffffff'; g.lineWidth = 2;
    g.strokeRect(-bw, -bh / 2, bw * 2, bh);
    g.globalAlpha = 0.55;
    g.strokeStyle = p.theme.accent; g.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const yy = -bh / 2 + ((t * 30 + i * bh / 6) % bh);
      g.beginPath(); g.moveTo(-bw + 2, yy); g.lineTo(bw - 2, yy); g.stroke();
    }
    g.restore();
  }

  function drawGoal(g, p, x, y) {
    const go = p.goal, t = performance.now() / 1000;
    const cx = go.x + x - p.x, cy = go.y + y - p.y;
    g.save();
    // a pillar of light, so the finish is visible from the far side of the sky
    const beam = g.createLinearGradient(cx, cy - 340, cx, cy);
    beam.addColorStop(0, 'rgba(157,255,207,0)');
    beam.addColorStop(1, 'rgba(157,255,207,.34)');
    g.fillStyle = beam;
    g.fillRect(cx - 30, cy - 340, 60, 340);

    const gl = g.createRadialGradient(cx, cy, 4, cx, cy, go.r);
    gl.addColorStop(0, 'rgba(170,255,215,.7)');
    gl.addColorStop(1, 'rgba(120,150,210,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(cx, cy, go.r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#9dffcf'; g.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      const rr = go.r * (0.35 + i * 0.22) * (1 + 0.05 * Math.sin(t * 2 + i));
      g.beginPath(); g.arc(cx, cy, rr, t * (i % 2 ? -1 : 1), t * (i % 2 ? -1 : 1) + Math.PI * 1.4); g.stroke();
    }
    g.fillStyle = '#e9fff4';
    g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function drawParkourFloor(ctx, W, H, cam) {
    if (!S.active || !S.course) return;
    const ox = -cam.x - cam.sx, oy = -cam.y - cam.sy;
    drawLiquid(ctx, W, H, ox, oy, performance.now() / 1000);
    for (const p of S.course.plats) {
      if (p.x + ox > W + 90 || p.x + p.w + ox < -90 || p.y + oy > H + 160 || p.y + p.h + oy < -90) continue;
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

  // --------------------------------------------------- dash is off in the sky
  // The course is crossed by jumping: the slide (and the blink variant) would
  // skip whole islands, so both are muted while PARKOUR_ACTIVE.
  function muteDash() {
    const SL = window.Slide;
    if (SL && SL.start && !SL.__pkMuted) {
      const orig = SL.start;
      SL.start = function () {
        if (window.PARKOUR_ACTIVE) return false;
        return orig.apply(this, arguments);
      };
      SL.__pkMuted = true;
    }
    if (window.__pkKeys) return;
    window.__pkKeys = true;
    // Shift (dash + blink strike) never reaches the engine on the course.
    window.addEventListener('keydown', (e) => {
      if (!window.PARKOUR_ACTIVE) return;
      if ((e.key || '').toLowerCase() !== 'shift') return;
      e.stopImmediatePropagation();
    }, true);
    ['pointerdown', 'touchstart', 'mousedown'].forEach((ev) => {
      const b = document.getElementById('btnDash');
      if (!b) return;
      b.addEventListener(ev, (e) => {
        if (!window.PARKOUR_ACTIVE) return;
        e.stopImmediatePropagation();
        e.preventDefault();
      }, true);
    });
  }

  // ------------------------------------------------------- the course's jump
  // Not the arena's jump: the engine only launches when it agrees you are on
  // the ground, and its ground is the old arena floor far below the islands.
  // On the course the slab under you IS the ground, so the launch is ours.
  const JUMP_V = 640;

  function pkJump() {
    const P = player();
    if (!S.active || S.done || !P || BODY.fly || P.hp <= 0) return false;
    if (BODY.air) return false;                  // already off the slab: no double jump
    if ((P.vz || 0) > 1) {                       // the arena's hop got there first — that arc is the jump
      BODY.air = true;
      return true;
    }
    const here = platAt(P.x, P.y);
    if (!here) return false;
    P.z = here.deck; P.vz = JUMP_V; BODY.air = true;
    return true;
  }

  function hookJump() {
    if (window.__pkJumpHooked) return;
    window.__pkJumpHooked = true;
    window.addEventListener('keydown', (e) => {
      if (!S.active) return;
      const k = (e.key || '').toLowerCase();
      if (k !== ' ' && k !== 'c') return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      pkJump();
    }, true);
    // On the button the arena's own hop is registered before the course's, so
    // listening on the document in the capture phase is what stops it getting
    // there first and leaving a launch the course then reads as "standing".
    ['pointerdown', 'touchstart', 'mousedown'].forEach((ev) => {
      document.addEventListener(ev, (e) => {
        if (!S.active) return;
        const b = e.target && e.target.closest ? e.target.closest('#btnJump') : null;
        if (!b) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        pkJump();
      }, true);
    });
  }

  // ---------------------------------------------------------------- wiring
  function bind() {
    injectStyle();
    hookWorldBuild();
    installW3();
    muteDash();
    hookJump();
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    on('introParkour', (e) => { e.preventDefault(); start(); });
    ['btnIntroSingle', 'btnIntroOffline', 'btnIntroMulti', 'introStory', 'introLevels', 'btnHome', 'homeBtn2', 'victoryHomeBtn']
      .forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => { if (S.active) stop(); }, true);
      });
    // The engine's own Restart rebuilds the arena and drops the player at its
    // centre; on the course that means the first island, again.
    ['btnRestart', 'restartBtn2'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => { if (S.active) setTimeout(placeOnStart, 60); }, false);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

  window.Parkour = {
    get active() { return S.active; },
    get course() { return S.course; },
    get earned() { return S.earned; },
    DECK: DECK0,
    start, stop, goMenu
  };
})();
