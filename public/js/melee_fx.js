/* =====================================================================
   melee_fx.js — the swing and the guard.

   Every melee weapon in melee_catalog.js names one `fx` style and one
   `ward`. This file owns both:

     • swing() plays that weapon's own attack effect in the 3D pass —
       a steel arc, a cross-cut, a helix, a storm cage, a collapsing
       star, and so on. The shapes, colours and motion are all distinct,
       so you can tell the weapon by the hit alone.
     • the guard (right mouse, C, or the GUARD button) raises that
       weapon's ward in front of the fighter, eats enemy fire that
       reaches it, and drops the moment the melee is put away.

   Rendering rides Render3D.collect, the same lit 3D pass as the rest of
   the arena's effects.
   ===================================================================== */
(function (G) {
  'use strict';

  const TAU = Math.PI * 2;
  const nowS = () => performance.now() / 1000;

  const swings = [];                        // live attack effects
  const wards = [];                         // guards other players have raised
  const seenFx = new Set();                 // broadcasts already drawn
  const guard = { on: false, t: 0, cd: 0, flash: 0, blocks: 0, id: null, acc: 0 };
  let equipped = false, meleeId = null, raf = 0, last = 0;

  const catalog = () => G.MeleeCatalog || null;
  const player = () => G.__arenaPlayer || null;
  const running = () => !!(G.__pveMatchRunning && G.__pveMatchRunning());
  const busy = () => !!(G._CUTSCENE_ACTIVE || G._HOST_CINEMATIC || G.STAGE_CUTSCENE_ACTIVE || G._GAUNTLET_INTRO);

  function statsOf(id) {
    const C = catalog();
    return C ? C.stats(id) : { dmg: 1, reach: 120, arc: 90, cd: .5, fx: 'steel_arc', ward: 'plank', col: [1.35, 1.4, 1.5] };
  }

  /* ------------------------------------------------------------- helpers */
  // A ribbon arc sweeping through the front of the fighter.
  // ---- intensity ------------------------------------------------------
  // The old values ran past 1.0, which the shader clips to white, and the
  // big glows stacked into one bright sheet over the screen. DIM keeps the
  // strike inside the frame and tone() gives every near-white accent the
  // colour of the weapon instead of blazing white.
  const DIM = 0.6;
  // The composite pass blooms everything brighter than 1.0 (and softly from
  // 0.4), so any colour above that becomes a white halo — the higher the
  // graphics quality, the wider that halo. Nothing in a swing is allowed past
  // this cap: the strike keeps its own colour and the white-out never happens.
  const CAP = .82;
  function cap(c) {
    if (!c) return c;
    const m = Math.max(c[0], c[1], c[2]);
    if (m <= CAP) return c;
    const k = CAP / m;
    return [c[0] * k, c[1] * k, c[2] * k];
  }
  let CUR = [1, 1, 1];
  function tone(c) {
    if (!c) return c;
    if (c[0] > .9 && c[1] > .9 && c[2] > .9) {
      return cap([CUR[0] * .85 + .08, CUR[1] * .85 + .08, CUR[2] * .85 + .08]);
    }
    return cap(c);
  }

  function arcRibbon(R, s, k, rad, half, y, col, w, a) {
    if (!R.rib) return;
    const n = 12;
    const from = s.ang - half, to = s.ang + half;
    const head = from + (to - from) * Math.min(1, k * 1.35);
    const tail = Math.max(from, head - (to - from) * 0.85);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const ang = tail + (head - tail) * (i / n);
      pts.push(s.x + Math.cos(ang) * rad, y + Math.sin(i * 1.7 + k * 4) * 2, s.y + Math.sin(ang) * rad);
    }
    const c = tone(col);
    if (pts.length >= 6) R.rib.line(pts, w * .78, w * .26, c[0], c[1], c[2], a * (1 - k * .85) * DIM);
  }

  function groundRing(R, s, k, maxR, col, a, y) {
    const c = tone(col);
    R.decal(s.x, s.y, maxR * (0.22 + k * 0.72), c[0], c[1], c[2], a * (1 - k) * DIM, 2, .06, 0, true, y === undefined ? 1.6 : y);
  }

  function sparks(R, s, n, col, spd, y0) {
    if (!R.emit) return;
    for (let i = 0; i < n; i++) {
      const a = s.ang + (Math.random() - .5) * 1.5;
      const v = (spd || 240) * (.35 + Math.random());
      R.emit({
        x: s.x + Math.cos(a) * 12, y: (y0 || 16) + Math.random() * 12, z: s.y + Math.sin(a) * 12,
        vx: Math.cos(a) * v, vy: 30 + Math.random() * 130, vz: Math.sin(a) * v,
        life: .32 + Math.random() * .3, age: 0, s0: 4 + Math.random() * 4, s1: 0,
        col: tone(col), a: .65, kind: 0, drag: 2.6
      });
    }
  }

  /* ------------------------------------------------------------ elements
     Every weapon carries an element. It sets the colour of the whole strike
     and lays its own particles over the shape, so a fire blade, a venom
     cleaver and a void fist never read as the same white flash. */
  const ELEM_COL = {
    steel:  [.88, .96, 1.10],
    fire:   [1.30, .48, .14],
    poison: [.34, 1.10, .30],
    frost:  [.38, .96, 1.34],
    shock:  [.50, .96, 1.44],
    void:   [.78, .26, 1.34],
    spirit: [.40, 1.10, .74],
    holy:   [1.32, 1.06, .42],
    earth:  [.96, .64, .36],
    air:    [.74, 1.00, 1.12]
  };
  const ELEM_BURST = { fire: 'fire', poison: 'earth', frost: 'water', shock: 'lightning', void: 'spirit', spirit: 'spirit', holy: 'fire', earth: 'earth', air: 'water', steel: null };

  function puff(R, s, k, o) {
    if (!R.emit) return;
    const a = o.ang === undefined ? s.ang + (Math.random() - .5) * 1.4 : o.ang;
    const d = (o.dist || 24) * (.4 + Math.random() * .9);
    R.emit({
      x: s.x + Math.cos(a) * d, y: (o.y || 16) + Math.random() * (o.spread || 14), z: s.y + Math.sin(a) * d,
      vx: Math.cos(a) * (o.v || 40) + (Math.random() - .5) * (o.jitter || 40),
      vy: o.vy === undefined ? 60 : o.vy,
      vz: Math.sin(a) * (o.v || 40) + (Math.random() - .5) * (o.jitter || 40),
      life: (o.life || .45) * (.7 + Math.random() * .6), age: 0,
      s0: o.s0 || 6, s1: o.s1 === undefined ? 0 : o.s1,
      col: tone(o.col), a: (o.a === undefined ? .9 : o.a) * .8,
      kind: o.kind || 0, drag: o.drag === undefined ? 2.2 : o.drag,
      mesh: o.mesh, grav: o.grav
    });
  }

  const ELEM = {
    steel(R, s, k, col) { sparks(R, s, 6, col, 220); },
    fire(R, s, k, col) {
      for (let i = 0; i < 12; i++) puff(R, s, k, { col, vy: 90 + Math.random() * 130, v: 70, life: .55, s0: 8, s1: 1, drag: 1.1, y: 8 });
      for (let i = 0; i < 4; i++) puff(R, s, k, { col: [.35, .3, .3], vy: 40, v: 26, life: .8, s0: 13, s1: 22, a: .3, drag: .8, kind: 1 });
    },
    poison(R, s, k, col) {
      for (let i = 0; i < 10; i++) puff(R, s, k, { col, vy: 34 + Math.random() * 40, v: 26, jitter: 20, life: .9, s0: 9, s1: 14, a: .55, drag: .7, kind: 1, y: 6 });
    },
    frost(R, s, k, col) {
      for (let i = 0; i < 10; i++) puff(R, s, k, { col, vy: -20 - Math.random() * 50, v: 90, life: .6, s0: 7, s1: 1, drag: 1.4, y: 30, mesh: 'octa', grav: 150 });
    },
    shock(R, s, k, col) {
      rayFan(R, s, k, 5, s.reach * .8, col, .85, 71, 2.2);
      for (let i = 0; i < 7; i++) puff(R, s, k, { col: tone([.68, 1.05, 1.55]), vy: 30, v: 150, jitter: 150, life: .22, s0: 5, drag: 3 });
    },
    void(R, s, k, col) {
      for (let i = 0; i < 10; i++) {
        const a = s.ang + (i / 10) * TAU;
        const r = 110 * (1 - k * .8);
        R.emit({ x: s.x + Math.cos(a) * r, y: 16, z: s.y + Math.sin(a) * r, vx: -Math.cos(a) * 130, vy: 20, vz: -Math.sin(a) * 130, life: .4, age: 0, s0: 6, s1: 1, col, a: .9, kind: 0, drag: .6 });
      }
    },
    spirit(R, s, k, col) {
      for (let i = 0; i < 9; i++) puff(R, s, k, { col, vy: 70 + Math.random() * 60, v: 20, life: .8, s0: 8, s1: 2, a: .7, drag: .5, kind: 1 });
    },
    holy(R, s, k, col) {
      for (let i = 0; i < 8; i++) {
        const a = s.ang + (i / 8 - .5) * 1.2;
        R.bolt(s.x + Math.cos(a) * 16, 12, s.y + Math.sin(a) * 16, s.x + Math.cos(a) * 96, 60, s.y + Math.sin(a) * 96, col, 2.2, .8 * (1 - k), 80 + i, 5);
      }
      for (let i = 0; i < 6; i++) puff(R, s, k, { col, vy: 120, v: 30, life: .6, s0: 7, s1: 1 });
    },
    earth(R, s, k, col) {
      for (let i = 0; i < 8; i++) puff(R, s, k, { col, vy: 150, v: 70, life: .6, s0: 9, s1: 2, mesh: 'rock', grav: 380, drag: .5, y: 4 });
    },
    air(R, s, k, col) {
      for (let i = 0; i < 3; i++) {
        const kk = Math.max(0, Math.min(1, k - i * .12));
        if (kk <= 0 || kk >= 1) continue;
        ringMesh(R, s, kk, 40 + i * 24, col, .5, 18);
      }
      for (let i = 0; i < 6; i++) puff(R, s, k, { col, vy: 20, v: 170, jitter: 60, life: .35, s0: 5, drag: 2 });
    }
  };

  // Bolts fanning out of the strike in the weapon's own colour.
  function rayFan(R, s, k, n, len, col, a, seed, width) {
    for (let i = 0; i < n; i++) {
      const off = n > 1 ? (i / (n - 1) - .5) : 0;
      const ang = s.ang + off * Math.min(Math.PI * 1.5, s.arc * 1.5);
      const r = len * (.35 + .65 * k);
      R.bolt(s.x + Math.cos(ang) * 14, 17, s.y + Math.sin(ang) * 14,
        s.x + Math.cos(ang) * r, 17 + (Math.random() - .5) * 26, s.y + Math.sin(ang) * r,
        tone(col), (width || 3.0) * .72, a * (1 - k) * DIM, (seed || 1) + i * 7, 5);
    }
  }

  function shardBurst(R, s, k, n, col, mesh, size) {
    const d = Math.min(1, k * 1.7);
    for (let i = 0; i < n; i++) {
      const ang = s.ang + (i / n - .5) * 1.9;
      const dist = (40 + (i % 4) * 34) * d;
      const sc = (size || 6) * (1 - k * .55);
      const c = tone(col);
      R.draw(R.unit[mesh || 'octa'], R.mm(s.x + Math.cos(ang) * dist, 18 + (i % 5) * 9 * (1 - k), s.y + Math.sin(ang) * dist,
        ang + i, sc, sc, sc * 1.7),
        R.mat(c, { emissive: [c[0] * .7, c[1] * .7, c[2] * .7], alpha: Math.max(0, (1 - k) * .85), shadow: false }));
    }
  }

  // A ring standing in the air, facing forward.
  function ringMesh(R, s, k, rad, col, a, y, thick) {
    const c = tone(col);
    R.draw(R.unit.torus, R.mm(s.x, y === undefined ? 18 : y, s.y, s.ang, rad * (.4 + k * .8), rad * .05, rad * (.4 + k * .8)),
      R.mat(c, { emissive: c, alpha: a * (1 - k * .8) * DIM, shadow: false, rough: .2 }));
    if (thick) {
      R.draw(R.unit.torusThick, R.mm(s.x, y === undefined ? 18 : y, s.y, -s.ang, rad * (.5 + k * .9), rad * .09, rad * (.5 + k * .9)),
        R.mat(c, { emissive: [c[0] * .7, c[1] * .7, c[2] * .7], alpha: a * .5 * (1 - k) * DIM, shadow: false }));
    }
  }

  // A ball of light just in front of the strike.
  function orb(R, s, k, rad, col, a, dist, y) {
    const d = (dist === undefined ? 34 : dist);
    const x = s.x + Math.cos(s.ang) * d, z = s.y + Math.sin(s.ang) * d;
    const c = tone(col), yy = y === undefined ? 18 : y;
    R.glow(x, yy, z, rad * (1 + k * .85), c[0], c[1], c[2], a * (1 - k) * DIM, 0);
    R.draw(R.unit.sphereLo, R.mm(x, yy, z, 0, rad * .40, rad * .40, rad * .40),
      R.mat(c, { emissive: c, alpha: Math.max(0, (1 - k) * .5), shadow: false }));
  }

  /* -------------------------------------------------------------- styles
     One entry per weapon family. Each reads its colour from the weapon,
     so two blades of different tiers still look like different weapons. */
  const STYLES = {
    /* common */
    impact(R, s, k) {
      orb(R, s, k, 26, s.col, .95, 30);
      groundRing(R, s, k, 46, s.col, .5);
      sparks(R, s, 7, s.col, 210);
    },
    double(R, s, k) {
      const a = Math.min(1, k * 1.6), b = Math.max(0, Math.min(1, (k - .28) * 1.6));
      if (a > 0 && a < 1) orb(R, s, a, 20, s.col, .9, 26);
      if (b > 0 && b < 1) orb(R, s, b, 24, s.col, .9, 42);
      groundRing(R, s, k, 40, s.col, .4);
      sparks(R, s, 6, s.col, 190);
    },
    steel_arc(R, s, k) {
      arcRibbon(R, s, k, s.reach * .78, s.arc * .55, 18, s.col, 7, .85);
      arcRibbon(R, s, k, s.reach * .66, s.arc * .45, 22, [1, 1, 1], 3, .55);
      sparks(R, s, 5, s.col, 200);
    },
    cleave(R, s, k) {
      arcRibbon(R, s, k, s.reach * .8, s.arc * .62, 14, s.col, 13, .8);
      groundRing(R, s, k, 62, s.col, .35);
      sparks(R, s, 9, [1.3, 1.1, .9], 240);
    },
    shockring(R, s, k) {
      groundRing(R, s, k, 84, s.col, .55);
      groundRing(R, s, Math.max(0, k - .18), 60, s.col, .4);
      groundRing(R, s, Math.max(0, k - .36), 40, s.col, .3);
      sparks(R, s, 8, s.col, 150, 6);
    },

    /* rare */
    frost(R, s, k) {
      arcRibbon(R, s, k, s.reach * .8, s.arc * .55, 18, s.col, 8, .9);
      shardBurst(R, s, k, 9, s.col, 'octa', 7);
      groundRing(R, s, k, 70, s.col, .5);
    },
    cross(R, s, k) {
      arcRibbon(R, s, k, s.reach * .7, s.arc * .3, 20, s.col, 8, .9);
      arcRibbon(R, { ang: s.ang + Math.PI * .5, x: s.x, y: s.y }, k, s.reach * .55, s.arc * .3, 26, [1, 1, 1], 5, .7);
      orb(R, s, k, 18, s.col, .8, 44);
    },
    spiral(R, s, k) {
      for (let i = 0; i < 14; i++) {
        const u = i / 14;
        const ang = s.ang + u * 3.4 * (0.4 + k);
        const r = s.reach * (.25 + u * .6);
        R.glow(s.x + Math.cos(ang) * r, 12 + u * 34, s.y + Math.sin(ang) * r,
          16 * (1 - k * .5), s.col[0], s.col[1], s.col[2], .8 * (1 - k) * (1 - u * .3), 0);
      }
      arcRibbon(R, s, k, s.reach * .7, s.arc * .4, 18, s.col, 5, .7);
    },
    shock(R, s, k) {
      rayFan(R, s, k, 5, s.reach * .9, s.col, .8, 3, 2.6);
      orb(R, s, k, 13, s.col, .65, 34);
      sparks(R, s, 6, s.col, 240);
    },
    quake(R, s, k) {
      groundRing(R, s, k, 96, s.col, .6);
      groundRing(R, s, Math.max(0, k - .22), 66, s.col, .45);
      if (R.emit) for (let i = 0; i < 6; i++) {
        const a = s.ang + (i / 6 - .5) * 2.2;
        R.emit({ x: s.x + Math.cos(a) * 34, y: 2, z: s.y + Math.sin(a) * 34, vx: Math.cos(a) * 40, vy: 130 + Math.random() * 90, vz: Math.sin(a) * 40, life: .55, age: 0, s0: 9, s1: 2, col: s.col, a: .9, mesh: 'rock', grav: 320, drag: .6 });
      }
    },

    /* epic */
    void(R, s, k) {
      const d = 34;
      const x = s.x + Math.cos(s.ang) * d, z = s.y + Math.sin(s.ang) * d;
      R.draw(R.unit.sphere, R.mm(x, 18, z, k * 3, 18 + k * 20, 18 + k * 20, 18 + k * 20),
        R.mat([.02, .01, .05], { emissive: [0, 0, 0], alpha: .95, shadow: false }));
      R.draw(R.unit.torus, R.mm(x, 18, z, s.ang + k * 5, 30 + k * 34, 3, 30 + k * 34),
        R.mat(s.col, { emissive: s.col, alpha: .8 * (1 - k), shadow: false }));
      for (let i = 0; i < 8; i++) {
        const a = s.ang + i * (TAU / 8);
        R.glow(x + Math.cos(a) * (34 + k * 20), 18 + Math.sin(a) * 20, z + Math.sin(a) * (34 + k * 20), 12, s.col[0], s.col[1], s.col[2], .7 * (1 - k), 0);
      }
    },
    storm(R, s, k) {
      rayFan(R, s, k, 6, s.reach * 1.05, s.col, .8, 11, 2.8);
      orb(R, s, k, 15, s.col, .7, 32);
      groundRing(R, s, k, 66, s.col, .38);
    },
    sonic(R, s, k) {
      for (let i = 0; i < 3; i++) {
        const kk = Math.max(0, Math.min(1, k - i * .16));
        if (kk <= 0 || kk >= 1) continue;
        ringMesh(R, s, kk, 34 + i * 22, s.col, .7, 18);
      }
      groundRing(R, s, k, 70, s.col, .35);
    },
    ember(R, s, k) {
      arcRibbon(R, s, k, s.reach * .8, s.arc * .55, 16, s.col, 11, .9);
      if (R.emit) for (let i = 0; i < 10; i++) {
        const a = s.ang + (Math.random() - .5) * 1.2;
        R.emit({ x: s.x + Math.cos(a) * 30, y: 12 + Math.random() * 16, z: s.y + Math.sin(a) * 30, vx: Math.cos(a) * 90, vy: 60 + Math.random() * 90, vz: Math.sin(a) * 90, life: .5 + Math.random() * .4, age: 0, s0: 8, s1: 1, col: tone([1.9, .7, .2]), a: .9, kind: 0, drag: 1.4 });
      }
      groundRing(R, s, k, 66, [1.6, .5, .15], .5);
    },
    crystal(R, s, k) {
      shardBurst(R, s, k, 12, s.col, 'octa', 8);
      shardBurst(R, { ang: s.ang, x: s.x, y: s.y }, Math.max(0, k - .15), 6, [1, 1, 1], 'octa', 5);
      groundRing(R, s, k, 72, s.col, .45);
    },

    /* legendary */
    solar(R, s, k) {
      orb(R, s, k, 20, s.col, .78, 32);
      rayFan(R, s, k, 7, s.reach * 1.1, s.col, .7, 5, 2.6);
      R.draw(R.unit.torus, R.mm(s.x, 20, s.y, s.ang + k * 4, 56 + k * 40, 4, 56 + k * 40),
        R.mat(s.col, { emissive: s.col, alpha: .45 * (1 - k), shadow: false }));
      groundRing(R, s, k, 78, s.col, .38);
    },
    gravity(R, s, k) {
      for (let i = 0; i < 3; i++) {
        const rad = 96 - i * 22 - k * 54;
        if (rad <= 4) continue;
        R.draw(R.unit.torus, R.mm(s.x, 18, s.y, s.ang - k * 6, rad, 2.5, rad),
          R.mat(s.col, { emissive: s.col, alpha: .7 * (1 - k), shadow: false }));
      }
      if (R.emit) for (let i = 0; i < 8; i++) {
        const a = s.ang + i * (TAU / 8);
        const r = 90 * (1 - k);
        R.emit({ x: s.x + Math.cos(a) * r, y: 18, z: s.y + Math.sin(a) * r, vx: -Math.cos(a) * 60, vy: 0, vz: -Math.sin(a) * 60, life: .4, age: 0, s0: 7, s1: 1, col: s.col, a: .85, kind: 0 });
      }
      orb(R, s, k, 22, s.col, .8, 26);
    },
    tempest(R, s, k) {
      rayFan(R, s, k, 8, s.reach * 1.2, s.col, .8, 21, 2.6);
      arcRibbon(R, s, k, s.reach * .85, s.arc * .6, 20, s.col, 5, .75);
      groundRing(R, s, k, 84, s.col, .35);
    },
    soul(R, s, k) {
      for (let i = 0; i < 9; i++) {
        const u = i / 9;
        const ang = s.ang + u * TAU * .6 - k * 2;
        const r = 26 + u * 50;
        R.glow(s.x + Math.cos(ang) * r, 10 + u * 60 * (0.6 + k * .6), s.y + Math.sin(ang) * r,
          14, s.col[0], s.col[1], s.col[2], .75 * (1 - k), 0);
      }
      arcRibbon(R, s, k, s.reach * .72, s.arc * .5, 18, s.col, 7, .8);
      groundRing(R, s, k, 64, s.col, .4);
    },
    mirror(R, s, k) {
      arcRibbon(R, s, k, s.reach * .78, s.arc * .45, 18, s.col, 7, .85);
      arcRibbon(R, { ang: -s.ang + Math.PI * .2, x: s.x, y: s.y }, k, s.reach * .7, s.arc * .45, 26, [1, 1, 1], 5, .6);
      shardBurst(R, s, k, 5, s.col, 'octa', 5);
    },

    /* god */
    star(R, s, k) {
      orb(R, s, k, 22, s.col, .75, 30);
      rayFan(R, s, k, 8, s.reach * 1.1, s.col, .75, 31, 2.6);
      groundRing(R, s, k, 82, s.col, .4);
    },
    singularity(R, s, k) {
      const x = s.x + Math.cos(s.ang) * 34, z = s.y + Math.sin(s.ang) * 34;
      const shrink = k < .55 ? (1 - k / .55) : ((k - .55) / .45);
      const size = k < .55 ? (26 * (1 - k / .55) + 2) : (6 + shrink * 38);
      R.draw(R.unit.sphere, R.mm(x, 18, z, k * 6, size, size, size),
        R.mat([.03, .01, .06], { emissive: [0, 0, 0], alpha: .96, shadow: false }));
      R.draw(R.unit.torus, R.mm(x, 18, z, s.ang + k * 8, size * 1.3, 3, size * 1.3),
        R.mat(s.col, { emissive: s.col, alpha: .85 * (1 - k), shadow: false }));
      if (k > .55) groundRing(R, s, k, 92, s.col, .45);
    },
    eclipse(R, s, k) {
      // a black crescent with a bright rim — the light goes out around it
      R.draw(R.unit.torus, R.mm(s.x + Math.cos(s.ang) * 40, 20, s.y + Math.sin(s.ang) * 40, s.ang, 46 + k * 30, 16, 46 + k * 30),
        R.mat([.02, .02, .04], { emissive: [0, 0, 0], alpha: .9, shadow: false }));
      arcRibbon(R, s, k, s.reach * .85, s.arc * .58, 22, s.col, 9, .95);
      arcRibbon(R, s, k, s.reach * .85, s.arc * .58, 16, [1, 1, 1], 4, .7);
      groundRing(R, s, k, 100, s.col, .5);
    },
    divinity(R, s, k) {
      for (let i = 0; i < 3; i++) {
        const kk = Math.max(0, Math.min(1, k - i * .1));
        if (kk <= 0 || kk >= 1) continue;
        R.draw(R.unit.torus, R.mm(s.x, 14 + i * 12, s.y, s.ang + kk * (3 + i), 46 + i * 26 + kk * 40, 2.6, 46 + i * 26 + kk * 40),
          R.mat(s.col, { emissive: s.col, alpha: .8 * (1 - kk), shadow: false }));
      }
      rayFan(R, s, k, 7, s.reach * 1.05, s.col, .72, 51, 2.8);
      groundRing(R, s, k, 84, s.col, .4);
    },
    genesis(R, s, k) {
      orb(R, s, k, 20, s.col, .8, 30);
      for (let i = 0; i < 3; i++) {
        const kk = Math.max(0, Math.min(1, k - i * .14));
        if (kk <= 0 || kk >= 1) continue;
        groundRing(R, s, kk, 60 + i * 34, s.col, .55);
      }
      shardBurst(R, s, k, 10, s.col, 'octa', 6);
    }
  };

  /* -------------------------------------------------------------- swings */
  // A strike, drawn where it happened. `t0` lets a strike that arrived from
  // another player start part way through, so it lines up with their swing.
  function pushSwing(o) {
    if (!o) return;
    const st = statsOf(o.id);
    // the strike is painted in its element's colour, not the metal's
    const col = cap(ELEM_COL[st.elem] || st.col);
    swings.push({
      id: o.id, style: st.fx, elem: st.elem || 'steel', col: col, wcol: st.col,
      x: o.x, y: o.y, ang: o.ang || 0,
      reach: st.reach || 120, arc: (st.arc || 90) * Math.PI / 180,
      t0: o.t0 === undefined ? nowS() : o.t0, dur: .62
    });
    if (swings.length > 10) swings.shift();
  }

  function swing(o) {
    if (!o) return;
    pushSwing(o);
    // Everyone else in the match draws this same strike where it happened.
    if (online() && G.Net && G.Net.sendMeleeFx) {
      try { G.Net.sendMeleeFx(o.x, o.y, o.ang || 0, o.id, false); } catch (e) {}
    }
  }

  // What the weapon does to the thing it hits: an elemental burst on the
  // target, in the same language the game already speaks for glyph procs.
  function hit(x, y, id) {
    const st = statsOf(id);
    const el = st.elem || 'steel';
    const col = cap(ELEM_COL[el] || st.col);
    const ents = G._ents;
    const burst = ELEM_BURST[el];
    if (burst && ents && ents.effects) ents.effects.push({ type: 'elemBurst', kind: burst, x, y, r: 64, life: .45, t: 0 });
    const R = G.Render3D;
    if (!R || !R.emit) return;
    const s = { x, y, ang: Math.random() * TAU, reach: 90 };
    for (let i = 0; i < 9; i++) puff(R, s, 0, { col, vy: 40 + Math.random() * 150, v: 130, jitter: 90, life: .38, s0: 7, s1: 0, drag: 2.4, dist: 8 });
  }

  /* --------------------------------------------------------------- guard
     A guard belongs to the legendary and god weapons only, and no two of
     them are alike. It is a short, cooldown-gated burst of defence: press
     it once, the ward stands for its own few seconds, then it recharges.
     While it stands it also does its own job — burning what it holds
     back, dragging enemies in, handing shots back, healing its holder. */
  const online = () => !!(G.Net && G.Net.state && G.Net.state.lobbyId);

  function spec() {
    const C = catalog();
    const w = C && meleeId ? C.of(meleeId) : null;
    return (w && w.guard) || null;
  }

  function foes() {
    const e = G._ents;
    const list = (e && Array.isArray(e.enemies)) ? e.enemies.slice() : [];
    try { if (G.BOTS_ENABLED && typeof SP_BOTS !== 'undefined' && SP_BOTS) list.push(...SP_BOTS); } catch (_) {}
    return list.filter(o => o && o.hp > 0);
  }
  function near(p, r) { return foes().filter(o => Math.hypot(o.x - p.x, o.y - p.y) <= r); }
  function closest(p, r) {
    return near(p, r).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] || null;
  }
  function bite(o, dmg, elem) {
    if (!o || o.hp <= 0 || online()) return;
    if (o.absorbing && o.type === 'boss') return;
    o.hp -= dmg;
    if (typeof G.DN === 'function') G.DN(o.x, o.y, dmg, 'enemy');
    if (typeof G.botGlyphBurstFx === 'function') G.botGlyphBurstFx(o.x, o.y, elem || 'fire', 50, .3);
  }
  function shove(o, p, dist) {
    if (online()) return;
    const a = Math.atan2(o.y - p.y, o.x - p.x), w = G.__arenaWorld;
    const nx = o.x + Math.cos(a) * dist, ny = o.y + Math.sin(a) * dist;
    if (!(w && w.isBlocked && w.isBlocked(nx, ny, o.r || 16))) { o.x = nx; o.y = ny; }
  }
  function drag(o, p, step) {
    if (online()) return;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d <= 40) return;
    const a = Math.atan2(p.y - o.y, p.x - o.x), w = G.__arenaWorld;
    const mv = Math.min(step, d - 40);
    const nx = o.x + Math.cos(a) * mv, ny = o.y + Math.sin(a) * mv;
    if (!(w && w.isBlocked && w.isBlocked(nx, ny, o.r || 16))) { o.x = nx; o.y = ny; }
  }

  // Ten guards, ten looks.
  const WARDS = {
    legendary_punch1(R, p, col, t, a) {            // Solar Aegis — a burning disc
      const ang = p.angle || 0, x = p.x + Math.cos(ang) * 32, z = p.y + Math.sin(ang) * 32;
      R.draw(R.unit.torus, R.mm(x, 20, z, ang + t * 2.2, 42, 3, 42), R.mat(col, { emissive: col, alpha: a * .85, shadow: false }));
      R.draw(R.unit.sphere, R.mm(x, 20, z, 0, 18, 26, 8), R.mat(col, { emissive: col, alpha: a * .35, shadow: false }));
      for (let i = 0; i < 8; i++) {
        const q = ang + i * (TAU / 8) + t * 1.1;
        R.bolt(x, 20, z, x + Math.cos(q) * 46, 20 + Math.sin(q) * 26, z + Math.sin(q) * 46, col, 2.2, a * .6, i + 5, 4);
      }
    },
    legendary_punch2(R, p, col, t, a) {            // Gravity Well — rings falling inward
      for (let i = 0; i < 3; i++) {
        const ph = (t * .9 + i / 3) % 1, rad = 84 * (1 - ph);
        if (rad < 6) continue;
        R.draw(R.unit.torus, R.mm(p.x, 8 + ph * 34, p.y, p.angle || 0, rad, 2.4, rad),
          R.mat(col, { emissive: col, alpha: a * .7 * (1 - ph), shadow: false }));
      }
      R.decal(p.x, p.y, 60, col[0], col[1], col[2], .18 * a, 2, .08, 0, true, 2);
    },
    legendary_blade3(R, p, col, t, a) {            // Storm Cage — a crackling cage
      const ang = p.angle || 0;
      R.draw(R.unit.hexRing, R.mm(p.x, 20, p.y, ang + t * 1.4, 52, 52, 52), R.mat(col, { emissive: col, alpha: a * .5, shadow: false }));
      for (let i = 0; i < 7; i++) {
        const q = ang + i * (TAU / 7) + t * 2;
        R.bolt(p.x, 18, p.y, p.x + Math.cos(q) * 54, 18 + Math.sin(q) * 40, p.y + Math.sin(q) * 54, col, 2.4, a * .8, i + 11, 5);
      }
    },
    legendary_blade1(R, p, col, t, a) {            // Soul Ward — green wisps drawn in
      for (let i = 0; i < 6; i++) {
        const ph = (t * .8 + i / 6) % 1, q = i * (TAU / 6) + t, rad = 70 * (1 - ph);
        R.glow(p.x + Math.cos(q) * rad, 6 + ph * 54, p.y + Math.sin(q) * rad, 13, col[0], col[1], col[2], .8 * a * (1 - ph * .5), 0);
      }
      R.draw(R.unit.torus, R.mm(p.x, 10, p.y, p.angle || 0, 46, 2.2, 46), R.mat(col, { emissive: col, alpha: a * .6, shadow: false }));
    },
    legendary_blade2(R, p, col, t, a) {            // Mirror Ward — two facing panes
      const ang = p.angle || 0, x = p.x + Math.cos(ang) * 30, z = p.y + Math.sin(ang) * 30;
      for (let i = 0; i < 2; i++) {
        const s = i ? -1 : 1;
        R.draw(R.unit.box, R.mm(x + Math.cos(ang + Math.PI / 2) * s * 16, 20, z + Math.sin(ang + Math.PI / 2) * s * 16,
          ang + s * .5 + Math.sin(t * 3) * .12, 8, 46, 34),
          R.mat(col, { emissive: [col[0] * .7, col[1] * .7, col[2] * .7], alpha: a * .45, shadow: false, rim: 1, rimCol: col }));
      }
    },
    god_punch1(R, p, col, t, a) {                  // Star Bastion — orbiting shards
      for (let i = 0; i < 8; i++) {
        const q = i * (TAU / 8) + t * 1.6, rad = 50 + Math.sin(t * 4 + i) * 6, sc = 7 + Math.sin(t * 5 + i) * 2;
        R.draw(R.unit.octa, R.mm(p.x + Math.cos(q) * rad, 22 + Math.sin(q * 2) * 14, p.y + Math.sin(q) * rad, q, sc, sc * 1.6, sc),
          R.mat(col, { emissive: col, alpha: a * .9, shadow: false }));
      }
      R.decal(p.x, p.y, 66, col[0], col[1], col[2], .2 * a, 2, .08, 0, true, 2);
    },
    god_punch2(R, p, col, t, a) {                  // Event Horizon — a collapsing void
      const ang = p.angle || 0, x = p.x + Math.cos(ang) * 34, z = p.y + Math.sin(ang) * 34;
      R.draw(R.unit.sphere, R.mm(x, 20, z, t * 3, 26, 26, 26), R.mat([.02, .01, .05], { emissive: [0, 0, 0], alpha: .95, shadow: false }));
      for (let i = 0; i < 3; i++) {
        const rad = 62 - i * 16 + Math.sin(t * 3 + i) * 4;
        R.draw(R.unit.torus, R.mm(x, 20, z, ang + t * (1.5 + i), rad, 2.2, rad),
          R.mat(col, { emissive: col, alpha: a * (.85 - i * .2), shadow: false }));
      }
    },
    god_blade3(R, p, col, t, a) {                  // Eclipse Veil — a dark crescent
      const ang = p.angle || 0;
      R.draw(R.unit.torus, R.mm(p.x, 26, p.y, ang + t * .8, 60, 15, 60), R.mat([.02, .02, .04], { emissive: [0, 0, 0], alpha: .9, shadow: false }));
      R.draw(R.unit.torus, R.mm(p.x, 26, p.y, ang + t * .8, 64, 2.6, 64), R.mat(col, { emissive: col, alpha: a * .85, shadow: false }));
      R.decal(p.x, p.y, 78, col[0], col[1], col[2], .16 * a, 2, .08, 0, true, 2);
    },
    god_blade1(R, p, col, t, a) {                  // Divine Seal — rune rings and light
      const ang = p.angle || 0;
      for (let i = 0; i < 3; i++) {
        R.draw(R.unit.torus, R.mm(p.x, 12 + i * 14, p.y, ang + t * (1.2 + i * .6) * (i % 2 ? -1 : 1), 34 + i * 18, 2.2, 34 + i * 18),
          R.mat(col, { emissive: col, alpha: a * (.9 - i * .22), shadow: false }));
      }
      for (let i = 0; i < 4; i++) {
        const q = ang + i * (TAU / 4) + t * .7;
        R.bolt(p.x + Math.cos(q) * 40, 0, p.y + Math.sin(q) * 40, p.x + Math.cos(q) * 40, 84, p.y + Math.sin(q) * 40, col, 2.6, a * .55, 70 + i, 5);
      }
    },
    god_blade2(R, p, col, t, a) {                  // Genesis Bloom — rings opening out
      for (let i = 0; i < 3; i++) {
        const ph = (t * .8 + i / 3) % 1;
        R.draw(R.unit.torus, R.mm(p.x, 10 + ph * 20, p.y, p.angle || 0, 20 + ph * 66, 2.4, 20 + ph * 66),
          R.mat(col, { emissive: col, alpha: a * .7 * (1 - ph), shadow: false }));
      }
      for (let i = 0; i < 6; i++) {
        const q = i * (TAU / 6) + t * 1.3, rad = 40 + Math.sin(t * 4 + i) * 8;
        R.draw(R.unit.octa, R.mm(p.x + Math.cos(q) * rad, 14 + Math.sin(t * 3 + i) * 8, p.y + Math.sin(q) * rad, q, 5, 8, 5),
          R.mat(col, { emissive: col, alpha: a * .8, shadow: false }));
      }
    }
  };

  // ...and ten jobs, one per guard.
  const JOBS = {
    legendary_punch1(p) {                          // sets alight what it holds back
      if (guard.acc < .5) return; guard.acc = 0;
      for (const o of near(p, 140)) {
        if (online()) break;
        o.burnStacks = Math.min(3, (o.burnStacks || 0) + 1);
        o.burnT = Math.max(o.burnT || 0, 2.5);
      }
    },
    legendary_punch2(p, dt) {                      // drags everything closer
      for (const o of near(p, 230)) drag(o, p, 90 * dt);
    },
    legendary_blade3(p) {                          // arcs to the nearest enemy
      if (guard.acc < .5) return; guard.acc = 0;
      const o = closest(p, 220);
      if (o) bite(o, 16, 'lightning');
    },
    legendary_blade1(p, dt) {                      // mends its holder
      p.hp = Math.min(p.hpMax || p.hp, p.hp + 5 * dt);
    },
    legendary_blade2() {                           // shots are handed back on block
    },
    god_punch1(p) {                                // a pulse of star fire
      if (guard.acc < .7) return; guard.acc = 0;
      for (const o of near(p, 170)) { bite(o, 10, 'fire'); shove(o, p, 26); }
    },
    god_punch2(p, dt) {                            // hauls enemies into the void
      for (const o of near(p, 260)) drag(o, p, 180 * dt);
    },
    god_blade3(p) {                                // freezes what stands in the dark
      if (guard.acc < .3) return; guard.acc = 0;
      if (online()) return;
      for (const o of near(p, 210)) o.freezeT = Math.max(o.freezeT || 0, .45);
    },
    god_blade1(p, dt) {                            // heals and shields its holder
      p.hp = Math.min(p.hpMax || p.hp, p.hp + 6 * dt);
      if (!online()) p.shield = Math.min(120, (p.shield || 0) + 10 * dt);
    },
    god_blade2(p) {                                // a bloom that scatters them
      if (guard.acc < .55) return; guard.acc = 0;
      for (const o of near(p, 150)) { bite(o, 12, 'earth'); shove(o, p, 34); }
    }
  };

  function activate() {
    const p = player();
    if (!p) return;
    if (guard.id === 'god_punch1') for (const o of near(p, 190)) { bite(o, 30, 'fire'); shove(o, p, 60); }
    if (guard.id === 'god_blade1') p.hp = Math.min(p.hpMax || p.hp, p.hp + 15);
    if (guard.id === 'god_blade2') for (const o of near(p, 150)) { bite(o, 14, 'earth'); shove(o, p, 40); }
    if (guard.id === 'legendary_blade1') p.hp = Math.min(p.hpMax || p.hp, p.hp + 10);
    const st = statsOf(guard.id), R = G.Render3D;
    const col = ELEM_COL[st.elem] || st.col;
    if (R && R.emit) for (let i = 0; i < 14; i++) {
      puff(R, { x: p.x, y: p.y, ang: Math.random() * TAU }, 0, { col, vy: 60 + Math.random() * 120, v: 150, life: .4, s0: 7, s1: 0, dist: 12 });
    }
  }

  function finish() {
    const p = player();
    if (p && guard.id === 'god_punch2') for (const o of near(p, 160)) { bite(o, 26, 'spirit'); shove(o, p, 70); }
    guard.on = false;
    guard.t = 0;
  }

  function drawGuard(R, t) {
    if (!guard.on || !equipped) return;
    const p = player();
    if (!p || p.hp <= 0) return;
    const fn = WARDS[guard.id];
    if (!fn) return;
    const st = statsOf(guard.id);
    const pulse = .72 + .28 * Math.sin(t * 6);
    const flash = guard.flash > 0 ? guard.flash / .3 : 0;
    const a = Math.min(1, pulse + flash * .8);
    const col = ELEM_COL[st.elem] || st.col;
    const c = cap([col[0] * (1 + flash * .5), col[1] * (1 + flash * .5), col[2] * (1 + flash * .5)]);
    try { fn(R, p, c, t, a); } catch (e) { if (!drawGuard._err) { drawGuard._err = 1; console.warn('[melee ward]', e); } }
  }

  // Enemy fire that reaches the standing ward dies on it.
  function blockShots(dt) {
    const p = player(), ents = G._ents;
    if (!p || !ents || !ents.ebullets) return;
    const list = ents.ebullets;
    const ang = p.angle || 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      if (!b) continue;
      const dx = b.x - p.x, dy = b.y - p.y;
      if (Math.hypot(dx, dy) > 74) continue;
      const diff = Math.abs(((Math.atan2(dy, dx) - ang + Math.PI * 3) % TAU) - Math.PI);
      if (diff > 1.15) continue;
      list.splice(i, 1);
      guard.flash = .3;
      guard.blocks++;
      // Soul Ward mends on every block, Mirror Ward hands the shot back
      if (guard.id === 'legendary_blade1') p.hp = Math.min(p.hpMax || p.hp, p.hp + 4);
      if (guard.id === 'legendary_blade2') { const o = closest(p, 260); if (o) bite(o, 12, 'steel'); }
      const R = G.Render3D;
      if (R && R.emit) {
        const st = statsOf(guard.id);
        const col = ELEM_COL[st.elem] || st.col;
        for (let n = 0; n < 5; n++) {
          R.emit({
            x: b.x, y: 18, z: b.y,
            vx: (Math.random() - .5) * 160, vy: 40 + Math.random() * 120, vz: (Math.random() - .5) * 160,
            life: .28 + Math.random() * .2, age: 0, s0: 6, s1: 0, col: col, a: .8, kind: 0, drag: 2.2
          });
        }
      }
    }
  }

  /* -------------------------------------------------------------- render */
  function draw(R) {
    if (!R || !R.ok) return;
    const t = nowS();
    for (let i = swings.length - 1; i >= 0; i--) {
      const s = swings[i];
      const k = (t - s.t0) / s.dur;
      if (k >= 1) { swings.splice(i, 1); continue; }
      const fn = STYLES[s.style] || STYLES.steel_arc;
      CUR = s.col || CUR;
      try { fn(R, s, Math.max(0, k), t); } catch (e) { if (!draw._err) { draw._err = 1; console.warn('[melee fx]', e); } }
      const el = ELEM[s.elem];
      if (el) { try { el(R, s, Math.max(0, k), s.col); } catch (e) { if (!draw._e3) { draw._e3 = 1; console.warn('[melee elem]', e); } } }
    }
    drawGuard(R, t);
    // other players' raised guards, standing where they raised them
    for (let i = 0; i < wards.length; i++) {
      const w = wards[i], fn = WARDS[w.id];
      if (!fn) continue;
      const st2 = statsOf(w.id);
      const col = cap(ELEM_COL[st2.elem] || st2.col);
      const a = .72 + .28 * Math.sin(t * 6);
      try { fn(R, { x: w.x, y: w.y, angle: w.ang }, col, t, a); }
      catch (e) { if (!draw._e4) { draw._e4 = 1; console.warn('[melee ward remote]', e); } }
    }
  }

  function hook() {
    const R = G.Render3D;
    if (!R || !R.collect || R.collect._meleeHooked) return;
    const orig = R.collect;
    R.collect = function () {
      const r = orig.apply(this, arguments);
      try { draw(R); } catch (e) { if (!draw._e2) { draw._e2 = 1; console.warn('[melee draw]', e); } }
      return r;
    };
    R.collect._meleeHooked = true;
  }

  /* ---------------------------------------------------------------- loop */
  function paintBtn() {
    const btn = document.getElementById('btnGuard');
    if (!btn) return;
    const sp = spec();
    if (!sp) { if (btn.style.display !== 'none') btn.style.display = 'none'; return; }
    if (btn.style.display === 'none') btn.style.display = 'flex';
    let label, dim;
    if (guard.on) { label = sp.name.toUpperCase(); dim = false; }
    else if (guard.cd > 0) { label = 'GUARD ' + guard.cd.toFixed(1); dim = true; }
    else { label = 'GUARD'; dim = false; }
    if (btn.textContent !== label) btn.textContent = label;
    const op = dim ? '.45' : '1';
    if (btn.style.opacity !== op) btn.style.opacity = op;
  }

  function tick() {
    requestAnimationFrame(tick);
    const t = nowS();
    const dt = last ? Math.min(.05, t - last) : .016;
    last = t;
    if (guard.flash > 0) guard.flash = Math.max(0, guard.flash - dt);
    if (guard.cd > 0) guard.cd = Math.max(0, guard.cd - dt);
    // everyone's strikes and wards, whoever swung them
    if (running()) pullRemote(); else if (wards.length) { wards.length = 0; setVeil(false); }
    if (!equipped || !running() || busy() || !spec()) { guard.on = false; guard.t = 0; paintBtn(); return; }
    if (guard.on) {
      guard.t = Math.max(0, guard.t - dt);
      guard.acc += dt;
      blockShots(dt);
      const p = player();
      const job = JOBS[guard.id];
      if (p && job) { try { job(p, dt); } catch (e) { if (!tick._j) { tick._j = 1; console.warn('[guard job]', e); } } }
      if (guard.t <= 0) finish();
    }
    paintBtn();
  }

  /* --------------------------------------------------------------- input */
  function setEquipped(on, id) {
    const changed = !!id && id !== meleeId;
    equipped = !!on;
    meleeId = id || meleeId;
    if (!equipped || changed) { guard.on = false; guard.t = 0; }
    if (changed) guard.cd = 0;
    paintBtn();
  }

  function cancel() { guard.on = false; guard.t = 0; swings.length = 0; wards.length = 0; setVeil(false); }

  /* -------------------------------------------- other players' effects
     A strike or a raised guard is broadcast by whoever made it, so every
     other client draws the same thing in the same place. A guard that puts
     out the light also darkens the view of whoever is standing inside it. */
  const VISION = { god_blade3: 160, god_punch2: 180 };
  let veilEl = null, veilOn = false;

  function setVeil(on) {
    if (on === veilOn) return;
    veilOn = on;
    if (!veilEl) {
      veilEl = document.createElement('div');
      veilEl.id = 'meleeVisionVeil';
      veilEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2;opacity:0;' +
        'transition:opacity .25s linear;background:radial-gradient(circle at 50% 50%,' +
        'rgba(0,0,0,.05) 0%,rgba(3,0,10,.55) 55%,rgba(0,0,0,.9) 100%)';
      document.body.appendChild(veilEl);
    }
    veilEl.style.opacity = on ? '1' : '0';
  }

  function pullRemote() {
    const N = G.Net;
    const snap = N && N.state && N.state.snapshot;
    const fx = snap && Array.isArray(snap.meleeFx) ? snap.meleeFx : null;
    const t = nowS();
    if (fx) {
      for (const f of fx) {
        if (!f || !f.id) continue;
        // Our own swing is drawn the moment it happens; the room echoing it
        // back would play the same strike twice.
        if (f.owner && N.state.peerId && f.owner === N.state.peerId) continue;
        const key = f.id + ':' + Math.round(f.x) + ':' + Math.round(f.y) + ':' + f.t0 + (f.guard ? ':g' : '');
        if (seenFx.has(key)) continue;
        seenFx.add(key);
        const age = Math.max(0, (Date.now() - (f.t0 || 0)) / 1000);
        if (f.guard) {
          const C = catalog();
          const w = C ? C.of(f.id) : null;
          if (w && w.guard) wards.push({ id: f.id, x: f.x, y: f.y, ang: f.ang || 0, t0: t - age, dur: w.guard.dur });
        } else if (age < .6) {
          pushSwing({ id: f.id, x: f.x, y: f.y, ang: f.ang, t0: t - age });
        }
      }
      if (seenFx.size > 400) seenFx.clear();
    }
    for (let i = wards.length - 1; i >= 0; i--) {
      if (t - wards[i].t0 > wards[i].dur) wards.splice(i, 1);
    }
    // Standing inside a ward that puts out the light blinds the player in it.
    const p = player();
    let blind = false;
    if (p && p.hp > 0) {
      for (const w of wards) {
        const r = VISION[w.id];
        if (r && Math.hypot(p.x - w.x, p.y - w.y) <= r) { blind = true; break; }
      }
    }
    setVeil(blind);
  }

  // Press once: the ward stands for its own few seconds, then recharges.
  function guardOn() {
    if (!equipped || !running() || busy()) return false;
    const sp = spec();
    if (!sp || guard.on || guard.cd > 0) return false;
    guard.id = meleeId;
    guard.on = true;
    guard.t = sp.dur;
    guard.cd = sp.dur + sp.cd;
    guard.acc = 0;
    activate();
    // The ward stands for everyone: other players see it raised in front of us.
    const p = player();
    if (p && online() && G.Net && G.Net.sendMeleeFx) {
      try { G.Net.sendMeleeFx(p.x, p.y, p.angle || 0, meleeId, true); } catch (e) {}
    }
    return true;
  }

  function buildGuardBtn() {
    const host = document.getElementById('mobileActions');
    if (!host || document.getElementById('btnGuard')) return;
    const b = document.createElement('button');
    b.id = 'btnGuard';
    b.className = 'mob-btn';
    b.textContent = 'GUARD';
    b.style.display = 'none';
    const on = (e) => { e.preventDefault(); guardOn(); };
    b.addEventListener('touchstart', on, { passive: false });
    b.addEventListener('mousedown', on);
    host.appendChild(b);
    paintBtn();
  }

  G.addEventListener('mousedown', (e) => { if (e && e.button === 2) guardOn(); });
  G.addEventListener('keydown', (e) => {
    if (!e || e.repeat) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if ((e.key || '').toLowerCase() === 'c') guardOn();
  });

  function init() {
    hook();
    buildGuardBtn();
    if (!raf) raf = requestAnimationFrame(tick);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  setTimeout(init, 800);
  setTimeout(buildGuardBtn, 1500);

  G.MeleeFX = {
    swing, hit, setEquipped, cancel, guardOn, draw, styles: STYLES, elements: ELEM,
    isGuarding: () => guard.on,
    guardSpec: () => spec(),
    guardReady: () => !!spec() && guard.cd <= 0 && !guard.on,
    guardCd: () => guard.cd
  };
})(window);
