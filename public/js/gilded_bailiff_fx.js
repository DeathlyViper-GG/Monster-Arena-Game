// ============================================================
// Monster Arena — THE GILDED BAILIFF: attack effects (3D)
// ------------------------------------------------------------------
// Every sentence the Bailiff serves is written here, in molten gold,
// on the floor of the square:
//
//   Brand of Entry ....... a seal chases you down, then STAMPS: a
//                          serrated wax rim, a shockwave and columns of
//                          fire standing in the brand it left behind
//   Cinder Writ .......... a sentence of small seals ignites from the far
//                          end back to the Bailiff's hand
//   Bailiff's Procession . three censers on chains walk a lane, dragging
//                          burning wakes and smoke
//   Writ-Reversal ........ two seals answer each other across a molten
//                          lance of script
//   Obsidian Docket ...... black glass plates rise, crack down their
//                          spines and fire gold lances down the lanes
//   Scales of Sentence ... two pans are weighed; the heavier one pours
//                          its fire out across the floor
//   Final Decree ......... walls of fire sweep outward in rings, each
//                          with one clause missing
//   The Golden Verdict ... a wall of script crosses the square while four
//                          numbered seals are stamped in order
//
// Everything is drawn from the renderer's quad vocabulary (glow, ring,
// dashed ring, shard, column beam, cross flare) plus emissive meshes.
// ============================================================
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrap = (a) => ((a % TAU) + TAU) % TAU;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---- the writ's palette (HDR — these go straight into the additive pass)
  const GOLD = [2.35, 1.5, 0.6];     // molten ink
  const HOT = [3.1, 2.4, 1.55];      // white-hot gold
  const EMBER = [2.6, 0.92, 0.26];   // stamped ember
  const DEEP = [1.25, 0.5, 0.12];    // cooling gold
  const PALE = [1.7, 1.4, 1.05];     // parchment light

  const qp = (R) => (R.q && R.q.parts) || 1;
  const qn = (R, n) => Math.max(3, Math.round(n * (qp(R) < 0.7 ? 0.6 : 1)));

  // ============================================================
  // QUAD PRIMITIVES
  // ============================================================
  // flat on the floor (additive)
  function deal(R, x, z, size, col, a, kind, param, rot, y) {
    R.decal(x, z, size, col[0], col[1], col[2], a, kind || 0, param || 0, rot || 0, true, y === undefined ? 1.5 : y);
  }
  // flat on the floor (blended — scorch, smoke)
  function dark(R, x, z, size, a, kind, param, rot, y) {
    R.decal(x, z, size, 0.05, 0.038, 0.032, a, kind || 11, param || 0, rot || 0, false, y === undefined ? 1.2 : y);
  }
  // billboard facing the eye (0 glow, 1 hot disc, 3 smoke, 4 column, 5 flare)
  function bill(R, x, y, z, size, col, a, kind, param, rot) {
    R.quads.add.push(x, y, z, size, col[0], col[1], col[2], a, rot || 0, kind || 0, param || 0, 0);
  }
  // a streak lying along an angle (the renderer's oriented beam)
  function streak(R, x, z, ang, thick, halfLen, col, a, y) {
    const size = Math.max(4, thick);
    R.streak(x, y === undefined ? 12 : y, z, ang, size, halfLen / size, col[0], col[1], col[2], a);
  }

  // ============================================================
  // THE LAW'S SHAPES
  // ============================================================

  /** A stamped seal: molten pool, wax rim, engraved rings, dashed
   *  circle and serrated teeth. `heat` scales the inner glow. */
  function seal(R, x, z, r, a, spin, heat) {
    if (!(a > 0.01) || r < 4) return;
    const s = r * 1.16;
    deal(R, x, z, s * 1.5, GOLD, 0.16 * a * (heat === undefined ? 1 : heat), 11, 0, 0, 1.2);
    deal(R, x, z, s, GOLD, 0.5 * a, 2, 0.05, spin, 1.5);
    deal(R, x, z, s * 0.7, HOT, 0.3 * a, 2, 0.03, -spin * 1.4, 1.6);
    // a docket of gold bars rather than a dashed circle — the Bailiff's own
    // shape, from sentinel_fx_kit.js, so it never reads as the other wardens'.
    if (window.SentinelFX) window.SentinelFX.ledger(R, x, z, s * 0.62, a, spin, 0);
    else deal(R, x, z, s * 0.88, EMBER, 0.34 * a, 9, spin * 2.2, spin * 0.4, 1.5);
    deal(R, x, z, s * 0.34, HOT, 0.26 * a * (heat === undefined ? 1 : heat), 11, 0, 0, 1.7);
    const n = qn(R, 10);
    for (let i = 0; i < n; i++) {
      const ang = spin * 0.6 + (i / n) * TAU;
      deal(R, x + Math.cos(ang) * s, z + Math.sin(ang) * s, r * 0.2, GOLD, 0.42 * a, 8, 0, ang + Math.PI / 2, 1.6);
    }
  }

  /** Letters of fire orbiting a circle — the writ actually being written. */
  function scriptRing(R, x, z, rad, a, spin, col) {
    const n = qn(R, 14);
    for (let i = 0; i < n; i++) {
      const ang = spin + (i / n) * TAU;
      const d = rad * (0.9 + 0.1 * Math.sin(i * 2.3 + spin));
      deal(R, x + Math.cos(ang) * d, z + Math.sin(ang) * d, Math.max(5, rad * 0.19),
        col || GOLD, 0.5 * a, 8, 0, ang + Math.PI / 2, 1.6);
    }
  }

  /** Cross-shaped impact flare with a white-hot core. */
  function flare(R, x, y, z, size, a, col) {
    const c = col || HOT;
    bill(R, x, y, z, size, c, a, 5, 0, 0);
    bill(R, x, y, z, size * 0.42, HOT, a * 1.15, 1, 0, 0);
    R.glow(x, y, z, size * 1.2, c[0] * 0.8, c[1] * 0.7, c[2] * 0.6, a * 0.7, 0);
  }

  /** Flat shockwave ring on the floor. */
  function wave(R, x, z, rad, a, col, w) {
    if (!(a > 0.01)) return;
    deal(R, x, z, rad * 1.16, col || GOLD, a, 2, w || 0.05, 0, 1.85);
  }

  /** A column of fire: a soft cone body plus three stacked beams. */
  function pillar(R, x, z, w, h, a, col) {
    const c = col || GOLD;
    if (!(a > 0.01) || h < 4) return;
    R.draw(R.unit.cone, R.mm(x, h * 0.5, z, 0, w * 1.2, h, w * 1.2),
      R.mat([1, 1, 1], {
        emissive: [c[0] * 0.5, c[1] * 0.34, c[2] * 0.2], emisK: 1.9, alpha: 0.28 * clamp(a, 0, 1),
        rough: 0.9, metal: 0, shadow: false
      }));
    bill(R, x, h * 0.52, z, h * 0.55, c, 0.26 * a, 4, 0, 0);
    bill(R, x, h * 0.48, z, h * 0.4, HOT, 0.46 * a, 4, 0, 0);
    bill(R, x, h * 0.3, z, h * 0.2, HOT, 0.7 * a, 4, 0, 0);
    R.glow(x, h * 0.12, z, w * 2.8, c[0], c[1], c[2], 0.45 * a, 0);
  }

  /** Sparks thrown up from a point. */
  function sparks(R, x, y, z, n, spread, up, col, a) {
    const k = Math.round(n * Math.min(1, qp(R)));
    for (let i = 0; i < k; i++) {
      const ang = Math.random() * TAU, sp = rnd(0.25, 1) * spread;
      R.emit({
        x: x + Math.cos(ang) * rnd(0, 12), y: y, z: z + Math.sin(ang) * rnd(0, 12),
        vx: Math.cos(ang) * sp, vy: up * rnd(0.5, 1.5), vz: Math.sin(ang) * sp,
        life: rnd(0.45, 1.2), age: 0, s0: rnd(5, 10), s1: 1,
        col: Math.random() < 0.25 ? HOT : (col || (Math.random() < 0.5 ? GOLD : EMBER)),
        a: (a || 0.9) * rnd(0.6, 1),
        kind: Math.random() < 0.18 ? 1 : 0, drag: 0.55, grav: 30, bounce: 0.28
      });
    }
  }

  /** A molten lance between two points on the floor. */
  function lance(R, ax, az, bx, bz, w, a, heavy) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 8 || a <= 0.01) return;
    const ang = Math.atan2(dz, dx);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const h = Math.max(10, w * 0.45);

    // the floor it burns as it goes, and the writing carried along it
    for (let i = 0; i <= 5; i++) {
      const f = i / 5;
      dark(R, ax + dx * f, az + dz * f, w * 1.9, 0.45 * a, 3, 0, ang, 1.15);
      deal(R, ax + dx * f, az + dz * f, Math.max(6, w * 0.45), HOT, 0.5 * a, 8, 0, ang + Math.PI / 2, 5);
    }
    streak(R, mx, mz, ang, w * 1.15, len * 0.5, DEEP, 0.6 * a, 4);
    streak(R, mx, mz, ang, w * 0.55, len * 0.5, HOT, 0.75 * a, 6);

    R.draw(R.unit.box, R.mm(mx, h, mz, ang, len, w * 0.85, w * 1.25),
      R.mat([1, 1, 1], { emissive: GOLD, emisK: 1.7, alpha: 0.3 * a, rough: 0.3, metal: 0.2, shadow: false }));
    R.draw(R.unit.box, R.mm(mx, h, mz, ang, len, w * 0.34, w * 0.5),
      R.mat([1, 1, 1], { emissive: HOT, emisK: 2.8, alpha: 0.92 * a, rough: 0.2, metal: 0.1, shadow: false }));

    if (heavy) {
      flare(R, ax, h + 6, az, w * 2.1, 0.9 * a);
      flare(R, bx, h + 6, bz, w * 2.4, a);
      R.light(mx, mz, h + 24, len * 0.55 + 160, GOLD[0], GOLD[1] * 0.85, GOLD[2] * 0.5, 0.95 * a);
      sparks(R, mx, h, mz, 8, 220, 200);
    }
    for (let i = 0; i < Math.round(3 * qp(R)); i++) {
      const f = Math.random();
      R.emit({
        x: ax + dx * f, y: h + rnd(0, 10), z: az + dz * f,
        vx: rnd(-40, 40), vy: rnd(60, 170), vz: rnd(-40, 40),
        life: rnd(0.4, 0.9), age: 0, s0: rnd(4, 9), s1: 1,
        col: Math.random() < 0.4 ? HOT : EMBER, a: 0.9, kind: 0, drag: 0.5, grav: 20
      });
    }
  }

  /** A moving/standing wall of fire along a line. */
  function fireWall(R, x, z, ang, halfLen, h, a, tt, segs) {
    const n = qn(R, segs || 18);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let i = 0; i < n; i++) {
      const f = (i / (n - 1) - 0.5) * 2 * halfLen;
      const wx = x + ca * f, wz = z + sa * f;
      const hh = h * (0.7 + 0.45 * Math.sin(tt * 9 + i * 1.9));
      bill(R, wx, hh * 0.62, wz, hh * 0.62, i % 3 ? GOLD : HOT, 0.42 * a, 4, 0, 0);
      bill(R, wx, hh * 0.34, wz, hh * 0.34, HOT, 0.55 * a, 4, 0, 0);
    }
    streak(R, x, z, ang, 26, halfLen, HOT, 0.55 * a, 10);
  }

  /** A wall of fire following an arc — the decree's clause. */
  function fireArc(R, cx, cz, rad, a0, a1, h, a, tt) {
    const span = a1 - a0;
    const n = Math.max(4, Math.min(34, Math.round(Math.abs(span) / 0.15)));
    for (let i = 0; i < n; i++) {
      const ang = a0 + span * (i / (n - 1));
      const x = cx + Math.cos(ang) * rad, z = cz + Math.sin(ang) * rad;
      const hh = h * (0.7 + 0.45 * Math.sin(tt * 8 + i * 1.7));
      bill(R, x, hh * 0.6, z, hh * 0.6, i % 2 ? GOLD : EMBER, 0.4 * a, 4, 0, 0);
      bill(R, x, hh * 0.32, z, hh * 0.32, HOT, 0.5 * a, 4, 0, 0);
    }
  }

  /** A censer on its chain, burning. */
  function censer(R, x, z, r, tt, a, idx) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    const bob = Math.sin(tt * 3.1 + idx * 2) * 5;
    const y = 40 + bob;
    const swing = Math.sin(tt * 1.7 + idx) * 0.12;

    R.draw(U.cyl, mm(x, y + 34, z, 0, 3, 58, 3),
      mat([1.2, 1.0, 0.72], { emissive: [0.55, 0.34, 0.1], emisK: 1.2, rough: 0.32, metal: 0.85, shadow: false }));
    R.draw(U.sphereLo, mm(x, y, z, swing, r * 0.48, r * 0.42, r * 0.48),
      mat([1.55, 1.16, 0.5], { emissive: [0.6, 0.28, 0.05], emisK: 1.4, rough: 0.26, metal: 0.9 }));
    R.draw(U.torus, mm(x, y - r * 0.3, z, tt * 0.9, r * 0.42, r * 0.42, r * 0.42, 0.16),
      mat([1.9, 1.35, 0.6], { emissive: HOT, emisK: 1.7, shadow: false }));
    R.draw(U.cone, mm(x, y + r * 0.5, z, 0, r * 0.36, r * 0.36, r * 0.36),
      mat([1.65, 1.22, 0.5], { emissive: [0.75, 0.4, 0.09], emisK: 1.6, rough: 0.28, metal: 0.9 }));

    // the fire it is carrying
    bill(R, x, y + r * 1.05, z, r * 0.9, EMBER, 0.5 * a, 4, 0, 0);
    bill(R, x, y + r * 0.8, z, r * 0.5, HOT, 0.7 * a, 4, 0, 0);
    bill(R, x, y + r * 0.9, z, r * 1.1, GOLD, 0.4 * a, 3, 0, 0);
    R.glow(x, y, z, r * 2.6, EMBER[0], EMBER[1], EMBER[2], 0.55 * a, 0);
    R.light(x, z, y + 18, 230, EMBER[0], EMBER[1] * 0.85, EMBER[2] * 0.5, 0.8 * a);

    for (let i = 0; i < Math.round(2 * qp(R)); i++) {
      R.emit({
        x: x + rnd(-8, 8), y: y + r * 0.9, z: z + rnd(-8, 8),
        vx: rnd(-25, 25), vy: rnd(70, 150), vz: rnd(-25, 25),
        life: rnd(0.6, 1.3), age: 0, s0: rnd(5, 11), s1: 1,
        col: Math.random() < 0.4 ? HOT : EMBER, a: 0.85, kind: 0, drag: 0.6, grav: 12
      });
    }
  }

  // ============================================================
  // THE EIGHT SENTENCES
  // ============================================================

  // 1 — Brand of Entry ///////////////////////////////////////////
  function brand(R, e, c, tt, on, prog) {
    const m = c.mark;
    if (!m) return;
    const age = on ? c.t - c.lockAt : -1;
    const locked = age >= 0;
    const rr = m.r;

    if (!locked) {
      // the seal hunts: chasing rings, ink falling into it
      const k = 0.45 + 0.55 * prog;
      seal(R, m.x, m.y, rr * (0.65 + 0.35 * k), 0.9, tt * 1.7, 1.15);
      scriptRing(R, m.x, m.y, rr * 0.78, 0.7, -tt * 1.5, EMBER);
      bill(R, m.x, rr * (2.6 - prog * 1.4), m.y, rr * 0.7, GOLD, 0.34 + 0.3 * prog, 4, 0, 0);
      for (let i = 0; i < Math.round(2 * qp(R)); i++) {
        const ang = Math.random() * TAU, d = Math.random() * rr * 0.8;
        R.emit({
          x: m.x + Math.cos(ang) * d, y: rr * (1.4 + Math.random()), z: m.y + Math.sin(ang) * d,
          vx: 0, vy: -110, vz: 0, life: 0.6, age: 0, s0: 7, s1: 2,
          col: Math.random() < 0.5 ? GOLD : EMBER, a: 0.8, kind: 0, drag: 0
        });
      }
      return;
    }

    const fade = clamp(1 - (age - c.linger) / 0.45, 0, 1);
    const a = fade;

    // the stamp itself
    if (age < 0.45) {
      const k = 1 - age / 0.45;
      flare(R, m.x, 22, m.y, rr * (1.7 + 3.4 * age), 0.95 * k);
      wave(R, m.x, m.y, rr * (1.0 + 6.0 * age), 0.9 * k, GOLD, 0.045);
      wave(R, m.x, m.y, rr * (0.6 + 3.6 * age), 0.75 * k, HOT, 0.028);
      sparks(R, m.x, 12, m.y, 12, 300, 220, null, 0.95);
      R.light(m.x, m.y, 44, 400, GOLD[0], GOLD[1] * 0.85, GOLD[2] * 0.55, 1.0 * k);
      R.cameraKick = Math.max(R.cameraKick || 0, 0.26 * k);
    }

    // the brand left in the floor
    seal(R, m.x, m.y, rr, a, tt * 0.85, 1);
    scriptRing(R, m.x, m.y, rr * 0.74, 0.85 * a, tt * 1.6, HOT);
    dark(R, m.x, m.y, rr * 1.15, 0.3 * a, 3, 0, tt * 0.12, 2.2);

    const n = qn(R, 5);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + tt * 0.45;
      const d = rr * 0.6;
      const h = rr * (1.15 + 0.5 * Math.sin(tt * 6.2 + i * 1.7)) * a;
      pillar(R, m.x + Math.cos(ang) * d, m.y + Math.sin(ang) * d, rr * 0.2, h, a * (0.65 + 0.35 * Math.sin(tt * 5 + i)), GOLD);
    }

    for (let i = 0; i < Math.round(4 * qp(R)); i++) {
      const ang = Math.random() * TAU, d = rr * (0.7 + Math.random() * 0.45);
      R.emit({
        x: m.x + Math.cos(ang) * d, y: 6, z: m.y + Math.sin(ang) * d,
        vx: Math.cos(ang) * 26, vy: 95 + Math.random() * 130, vz: Math.sin(ang) * 26,
        life: rnd(0.7, 1.5), age: 0, s0: rnd(6, 12), s1: 1.5,
        col: Math.random() < 0.3 ? HOT : (Math.random() < 0.5 ? GOLD : EMBER),
        a: 0.85 * a, kind: Math.random() < 0.16 ? 3 : 0, drag: 0.5, grav: 14
      });
    }

    R.glow(m.x, 22, m.y, rr * 2.3, GOLD[0], GOLD[1], GOLD[2], 0.45 * a, 0);
    R.light(m.x, m.y, 30, 330, GOLD[0] * 0.9, GOLD[1] * 0.62, GOLD[2] * 0.34, 0.8 * a);
  }

  // 2 — Cinder Writ //////////////////////////////////////////////
  function cinder(R, e, c, tt, on, prog) {
    if (!c.zones) {
      // the sentence being ruled down the player's path
      const ang = c.ang;
      for (let i = 1; i <= 7; i++) {
        const d = 120 + i * 120;
        const x = e.x + Math.cos(ang) * d, y = e.y + Math.sin(ang) * d;
        const f = i / 7;
        seal(R, x, y, 48 * (0.5 + 0.5 * prog), (0.2 + 0.45 * prog) * (0.5 + f * 0.5), tt * 1.2 + i, 0.5);
      }
      return;
    }

    let prev = null;
    for (let i = 0; i < c.zones.length; i++) {
      const z = c.zones[i];
      const local = on ? c.t - z.at : -1;
      const lit = local >= 0 && local <= z.dur;

      if (lit) {
        const k = clamp(local / z.dur, 0, 1);
        flare(R, z.x, 18, z.y, z.r * (1.6 + 1.2 * k), 0.8 * (1 - k * 0.6));
        pillar(R, z.x, z.y, z.r * 0.26, z.r * (1.9 + 1.4 * k), 0.95, EMBER);
        wave(R, z.x, z.y, z.r * (1.0 + 2.6 * k), 0.8 * (1 - k), GOLD, 0.05);
        sparks(R, z.x, 10, z.y, 4, 170, 160);
        R.light(z.x, z.y, 26, 250, EMBER[0], EMBER[1] * 0.8, EMBER[2] * 0.5, 0.8);
      } else if (local < 0) {
        seal(R, z.x, z.y, z.r * (0.55 + 0.45 * (on ? 1 : prog)), on ? 0.7 : 0.3 + 0.4 * prog, tt * 1.4 + i, 0.6);
      }

      // the burnt page it leaves: script scored into the floor
      if (local > z.dur) {
        dark(R, z.x, z.y, z.r * 0.95, 0.55, 3, 0, tt * 0.15 + i, 1.5);
        scriptRing(R, z.x, z.y, z.r * 0.6, 0.3, -tt * 0.6 + i, DEEP);
      }

      // a thread of fire joining the seals of the sentence
      if (prev && (lit || local > z.dur)) {
        lance(R, prev.x, prev.y, z.x, z.y, 16, lit ? 0.5 : 0.16, false);
      }
      prev = z;
    }
  }

  // 3 — Bailiff's Procession ////////////////////////////////////
  function procession(R, e, c, tt, on, prog) {
    const ang = c.ang;
    const dx = Math.cos(ang), dz = Math.sin(ang);

    if (!c.walkers) {
      // the lane being ruled through the square
      streak(R, e.x + dx * 200, e.y + dz * 200, ang, 74, 1100, GOLD, 0.1 + 0.18 * prog, 4);
      for (let i = -2; i <= 6; i++) {
        const x = e.x + dx * i * 200, z = e.y + dz * i * 200;
        deal(R, x, z, 34, GOLD, 0.18 + 0.3 * prog, 8, 0, ang + Math.PI / 2, 1.5);
      }
      return;
    }

    for (let i = 0; i < c.walkers.length; i++) {
      const w = c.walkers[i];
      const a = on ? 1 : 0.4 + 0.5 * prog;

      // the wake it drags
      dark(R, w.x, w.y, w.r * 1.1, 0.55 * a, 3, 0, ang, 1.4);
      streak(R, w.x - dx * 90, w.y - dz * 90, ang, w.r * 1.1, 190, DEEP, 0.5 * a, 5);
      streak(R, w.x - dx * 70, w.y - dz * 70, ang, w.r * 0.5, 150, GOLD, 0.55 * a, 8);
      seal(R, w.x, w.y, w.r, 0.75 * a, tt * 0.7 + i, 1);

      if (on) {
        censer(R, w.x, w.y, w.r * 0.8, tt, a, i);
        // smoke column leaning off the censer
        const smoke = qn(R, 3);
        for (let s = 0; s < smoke; s++) {
          bill(R, w.x + rnd(-20, 20) - dx * rnd(0, 60), 70 + s * 46 + (tt * 30 + s * 40) % 60,
            w.y + rnd(-20, 20) - dz * rnd(0, 60), 60 + s * 18, [0.16, 0.11, 0.08], 0.24 * a, 3, 0, 0);
        }
        R.cameraKick = Math.max(R.cameraKick || 0, 0.02);
      } else {
        // before it is carried out: only the censer's glow waiting on the lane
        R.glow(w.x, 34, w.y, w.r * 1.8, GOLD[0], GOLD[1], GOLD[2], 0.3 * a, 0);
      }
    }
  }

  // 4 — Writ-Reversal //////////////////////////////////////////
  function reversal(R, e, c, tt, on, prog) {
    if (!c.a || !c.b) {
      // the two seals being chosen: this side of the writ, then the other
      const pl = env0.player || { x: e.x + 100, y: e.y };
      const ang = Math.atan2(pl.y - e.y, pl.x - e.x);
      seal(R, e.x + Math.cos(ang) * 60, e.y + Math.sin(ang) * 60, 60, 0.4 * prog, tt, 0.7);
      seal(R, e.x + Math.cos(ang) * 520, e.y + Math.sin(ang) * 520, 60, 0.4 * prog, -tt, 0.7);
      return;
    }

    const litA = on && c.t >= c.fireA && c.t < c.fireA + 0.5;
    const litB = on && c.t >= c.fireBeam && c.t < c.fireBeam + 0.9;

    // the answer, drawn between the two marks
    if (on && c.t >= c.fireA) {
      const k = clamp((c.t - c.fireA) / 0.7, 0, 1);
      lance(R, c.a.x, c.a.y, c.b.x, c.b.y, c.beamW * (0.4 + 0.6 * k), (litB ? 1 : 0.55 + 0.4 * k), litB);
      const p = clamp((c.t - c.fireA) / 0.45, 0, 1);
      const hx = c.a.x + (c.b.x - c.a.x) * p, hz = c.a.y + (c.b.y - c.a.y) * p;
      flare(R, hx, 22, hz, c.beamW * 2.2, 0.85);
      sparks(R, hx, 16, hz, 5, 200, 170);
    }

    if (litB) {
      const k = clamp((c.t - c.fireBeam) / 0.9, 0, 1);
      wave(R, c.b.x, c.b.y, c.b.r * (1 + 3.2 * k), 0.85 * (1 - k), HOT, 0.04);
      R.cameraKick = Math.max(R.cameraKick || 0, 0.16);
    }

    seal(R, c.b.x, c.b.y, c.b.r, litB ? 1 : 0.4 + 0.45 * prog, -tt * 1.2, 1.2);
    seal(R, c.a.x, c.a.y, c.a.r, litA ? 1 : 0.4 + 0.45 * prog, tt * 1.2, 1.2);
    if (litA) {
      flare(R, c.a.x, 20, c.a.y, c.a.r * 2.2, 0.9);
      pillar(R, c.a.x, c.a.y, c.a.r * 0.24, c.a.r * 2.4, 0.8, EMBER);
      sparks(R, c.a.x, 12, c.a.y, 10, 240, 190);
      R.light(c.a.x, c.a.y, 30, 300, EMBER[0], EMBER[1] * 0.8, EMBER[2] * 0.5, 0.85);
    }
  }

  // 5 — Obsidian Docket ///////////////////////////////////////
  function docket(R, e, c, tt, on, prog) {
    if (!c.plates) {
      // the docket being written around the player: sealed ground, no plates yet
      const n = 6;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU + 0.4;
        const d = 240;
        const x = e.x + Math.cos(ang) * d, y = e.y + Math.sin(ang) * d;
        seal(R, x, y, 60 * (0.6 + 0.4 * prog), 0.35 + 0.45 * prog, tt * 1.1 + i, 0.5);
        deal(R, x + Math.cos(ang + Math.PI) * 150, y + Math.sin(ang + Math.PI) * 150,
          150, GOLD, 0.1 + 0.2 * prog, 8, 0, ang + Math.PI / 2, 1.5);
      }
      return;
    }

    const U = R.unit, mm = R.mm, mat = R.mat;
    for (const p of c.plates) {
      const risen = on && c.t > p.up;
      const local = on ? c.t - p.fire : -1;
      const lit = local >= 0 && local <= p.dur;
      const charge = on ? clamp((c.t - p.up) / Math.max(0.01, p.fire - p.up), 0, 1) : 0;
      const h = risen ? p.r * 1.55 : p.r * 0.5;
      const yaw = p.ang + Math.PI / 2;

      // the plate: black glass with a molten spine
      R.draw(U.box, mm(p.x, h * 0.5, p.y, yaw, p.r * 0.92, h, p.r * 0.32),
        mat([0.055, 0.045, 0.055], {
          rough: 0.12, metal: 0.92, rim: 2.0, rimCol: GOLD,
          emissive: [0.05, 0.032, 0.012], emisK: 1.2
        }));
      R.draw(U.box, mm(p.x, h * 0.5, p.y, yaw, p.r * 0.14, h * 0.9, p.r * 0.4),
        mat([1, 1, 1], { emissive: lit ? HOT : GOLD, emisK: lit ? 3 : 1.5 + charge * 1.3, alpha: 0.9, shadow: false }));
      // crown of shards along the top edge
      for (let k = -1; k <= 1; k++) {
        R.draw(U.octa, mm(p.x + Math.cos(yaw) * k * p.r * 0.3, h + 8, p.y + Math.sin(yaw) * k * p.r * 0.3,
          yaw, p.r * 0.09, p.r * 0.26, p.r * 0.09),
          mat([1.6, 1.15, 0.5], { emissive: [0.7, 0.36, 0.08], emisK: 1.5, rough: 0.2, metal: 0.6, shadow: false }));
      }
      // dust shaken loose as it rises
      if (risen && !lit) {
        for (let k = 0; k < Math.round(1.5 * qp(R)); k++) {
          R.emit({
            x: p.x + rnd(-p.r * 0.4, p.r * 0.4), y: 6, z: p.y + rnd(-p.r * 0.3, p.r * 0.3),
            vx: rnd(-30, 30), vy: rnd(20, 70), vz: rnd(-30, 30),
            life: rnd(0.5, 1), age: 0, s0: rnd(4, 8), s1: 1,
            col: Math.random() < 0.4 ? DEEP : [0.2, 0.15, 0.1], a: 0.6, kind: 0, drag: 0.5, grav: 20
          });
        }
      }

      if (lit) {
        const k = clamp(local / p.dur, 0, 1);
        // the face cracks open and the sentence is fired down the lane
        lance(R, p.x, p.y, p.x + Math.cos(p.ang) * p.len, p.y + Math.sin(p.ang) * p.len, p.w, 1, true);
        flare(R, p.x, h * 0.8, p.y, p.r * 3.2, 1.0);
        wave(R, p.x, p.y, p.r * (1 + 3 * k), 0.8 * (1 - k), GOLD, 0.05);
        for (let s = 0; s < 3; s++) {
          const ang2 = p.ang + rnd(-0.5, 0.5);
          bill(R, p.x + Math.cos(ang2) * p.r * 0.7, h * 0.8 + rnd(0, 40), p.y + Math.sin(ang2) * p.r * 0.7,
            34, HOT, 0.8, 5, 0, 0);
        }
        dark(R, p.x, p.y, p.r * 1.4, 0.5, 11, 0, p.ang, 1.4);
      } else if (risen) {
        // charging: the spine brightens, cracks crawl across the glass
        R.glow(p.x, h * 0.7, p.y, p.r * 3.2, GOLD[0], GOLD[1], GOLD[2], 0.2 + 0.35 * charge, 0);
        for (let s = 0; s < 3; s++) {
          const a2 = rnd(0, TAU), d2 = rnd(0, p.r * 0.5);
          bill(R, p.x + Math.cos(p.ang) * p.r * 0.34 + Math.cos(a2) * d2, rnd(h * 0.25, h * 0.9),
            p.y + Math.sin(p.ang) * p.r * 0.34 + Math.sin(a2) * d2, 10 + 10 * charge, HOT, 0.5 * charge, 5, 0, 0);
        }
        // the lane it will fire down, ruled in advance
        streak(R, p.x + Math.cos(p.ang) * p.len * 0.5, p.y + Math.sin(p.ang) * p.len * 0.5,
          p.ang, 30, p.len * 0.5, GOLD, 0.12 + 0.28 * charge, 4);
        for (let i = 1; i <= 5; i++) {
          const d3 = p.len * i / 5;
          deal(R, p.x + Math.cos(p.ang) * d3, p.y + Math.sin(p.ang) * d3, p.w * 0.24,
            GOLD, 0.12 + 0.3 * charge, 8, 0, p.ang + Math.PI / 2, 1.5);
        }
      } else {
        seal(R, p.x, p.y, p.r * 0.9, 0.3 + 0.4 * prog, tt * 1.3, 0.6);
      }
    }
  }

  // 6 — Scales of Sentence ////////////////////////////////////
  function scales(R, e, c, tt, on, prog) {
    // the beam of the scales, always overhead
    const y0 = 150;

    if (!c.sides) {
      seal(R, e.x, e.y, 90, 0.4 + 0.4 * prog, tt * 0.9, 0.8);
      scriptRing(R, e.x, e.y, 130, 0.35 * prog, -tt, GOLD);
      return;
    }

    for (let i = 0; i < c.sides.length; i++) {
      const s = c.sides[i];
      const beat = on && c.beats ? c.beats.find((b) => b.side === i && c.t >= b.at && c.t <= b.at + b.dur) : null;
      const warn = on && c.beats ? c.beats.some((b) => b.side === i && c.t >= b.at - 0.55 && c.t < b.at) : false;
      const a = on ? 1 : 0.4 + 0.5 * prog;

      // the pan hung from the beam
      const tilt = (i === 0 ? 1 : -1) * (beat ? 0.12 : -0.05);
      R.draw(R.unit.cyl, R.mm(s.x, 40, s.y, 0, c.r * 0.95, 14, c.r * 0.95),
        R.mat([1.5, 1.12, 0.5], { emissive: [0.5, 0.26, 0.06], emisK: 1.4, rough: 0.24, metal: 0.92 }));
      R.draw(R.unit.torus, R.mm(s.x, 48, s.y, tilt, c.r * 0.9, c.r * 0.9, c.r * 0.9, 0.07),
        R.mat([1.9, 1.4, 0.62], { emissive: beat ? HOT : GOLD, emisK: beat ? 2.4 : 1.2, shadow: false }));
      bill(R, s.x, y0 * 0.55, s.y, 40, GOLD, 0.14 * a, 4, 0, 0);

      // the sentence written where the pan will land
      seal(R, s.x, s.y, c.r * (0.9 + 0.1 * prog), a, tt * 0.6 + i * 2, beat ? 1.3 : 0.8);

      if (warn) {
        wave(R, s.x, s.y, c.r * (1.2 + 0.2 * Math.sin(tt * 22)), 0.55 + 0.3 * Math.sin(tt * 18), EMBER, 0.035);
        R.glow(s.x, 40, s.y, c.r * 2.2, EMBER[0], EMBER[1], EMBER[2], 0.5, 0);
      }

      if (beat) {
        const k = clamp((c.t - beat.at) / beat.dur, 0, 1);
        // the pan tips and pours
        flare(R, s.x, 46, s.y, c.r * 3.4, 1.0 * (1 - k * 0.5));
        pillar(R, s.x, s.y, c.r * 0.3, c.r * (2.6 - k * 0.8), 0.9, EMBER);
        wave(R, s.x, s.y, c.r * (1 + 3.4 * k), 0.9 * (1 - k), GOLD, 0.045);
        wave(R, s.x, s.y, c.r * (0.7 + 2.2 * k), 0.7 * (1 - k), HOT, 0.03);
        sparks(R, s.x, 30, s.y, 14, 330, 190, null, 1);
        R.light(s.x, s.y, 60, 380, EMBER[0], EMBER[1] * 0.85, EMBER[2] * 0.5, 1.0);
        R.cameraKick = Math.max(R.cameraKick || 0, 0.18 * (1 - k));
        // molten metal running out across the floor
        for (let j = 0; j < Math.round(3 * qp(R)); j++) {
          const a2 = Math.random() * TAU, d2 = rnd(0, c.r);
          R.emit({
            x: s.x + Math.cos(a2) * d2, y: 10, z: s.y + Math.sin(a2) * d2,
            vx: Math.cos(a2) * rnd(60, 190), vy: rnd(60, 170), vz: Math.sin(a2) * rnd(60, 190),
            life: rnd(0.5, 1.1), age: 0, s0: rnd(6, 13), s1: 1,
            col: Math.random() < 0.4 ? HOT : EMBER, a: 0.9, kind: 0, drag: 0.45, grav: 40
          });
        }
      }
    }
  }

  // 7 — Final Decree /////////////////////////////////////////
  function decree(R, e, c, tt, on, prog) {
    if (!c.rings) {
      // the decree being written at the bench
      const k = 0.5 + 0.5 * prog;
      seal(R, e.x, e.y, 70 + 40 * k, 0.6 * k, tt * 1.4, 1.2);
      scriptRing(R, e.x, e.y, 130 * k, 0.7 * k, -tt * 1.7, HOT);
      R.glow(e.x, 40, e.y, 220 * k, GOLD[0], GOLD[1], GOLD[2], 0.35 * k, 0);
      return;
    }

    for (const r of c.rings) {
      const local = on ? c.t - r.born : -1;
      if (local < 0) {
        // this clause has not been read yet — it glows at the Bailiff's feet
        seal(R, c.cx, c.cy, 60 + 50 * prog, 0.45 * prog, tt * 0.8, 0.9);
        R.glow(c.cx, 24, c.cy, 180, GOLD[0], GOLD[1], GOLD[2], 0.3 * prog, 0);
        continue;
      }
      const rad = local * r.sp;
      if (rad > r.max) continue;
      const fade = clamp(1 - rad / r.max, 0, 1);
      const a0 = r.gap + r.half;
      const a1 = r.gap - r.half + TAU;

      // the scorch of every word already read
      dark(R, c.cx, c.cy, rad * 1.1, 0.34 * fade, 2, 0.06, 0, 1.15);
      // the clause itself, standing up as a wall of fire
      fireArc(R, c.cx, c.cy, rad, a0, a1, 105, fade, tt);
      // its line on the floor
      deal(R, c.cx, c.cy, rad * 1.16, GOLD, 0.45 * fade, 2, 0.045, 0, 1.8);
      deal(R, c.cx, c.cy, rad * 1.02, HOT, 0.3 * fade, 2, 0.02, 0, 1.9);
      scriptRing(R, c.cx, c.cy, rad * 0.97, 0.55 * fade, r.spin * 3 + tt * 0.4, HOT);

      // the open clause — the only place the ring is not
      const gx = c.cx + Math.cos(r.gap + Math.PI) * rad;
      const gz = c.cy + Math.sin(r.gap + Math.PI) * rad;
      R.glow(gx, 26, gz, 150, HOT[0], HOT[1], HOT[2], 0.5 * fade, 0);
      R.light(gx, gz, 30, 260, HOT[0] * 0.8, HOT[1] * 0.7, HOT[2] * 0.6, 0.8 * fade);

      for (let i = 0; i < Math.round(2 * qp(R)); i++) {
        const ang = a0 + (a1 - a0) * Math.random();
        R.emit({
          x: c.cx + Math.cos(ang) * rad, y: 8, z: c.cy + Math.sin(ang) * rad,
          vx: Math.cos(ang) * 40, vy: rnd(70, 160), vz: Math.sin(ang) * 40,
          life: rnd(0.5, 1.1), age: 0, s0: rnd(5, 11), s1: 1,
          col: Math.random() < 0.3 ? HOT : EMBER, a: 0.8 * fade, kind: 0, drag: 0.5, grav: 18
        });
      }
    }
  }

  // 8 — The Golden Verdict ///////////////////////////////////
  function verdict(R, e, c, tt, on, prog) {
    // the four numbered seals first — they exist from the moment it is read
    if (!c.marks) {
      const n = 4;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU;
        const x = e.x + Math.cos(ang) * 260, y = e.y + Math.sin(ang) * 260;
        seal(R, x, y, 80 * (0.55 + 0.45 * prog), 0.25 + 0.4 * prog, tt * 1.1 + i, 0.6);
      }
      seal(R, e.x, e.y, 140 * prog, 0.5 * prog, -tt * 1.3, 1);
      return;
    }

    const s = c.sweep;
    if (s) {
      const localS = on ? c.t - s.born : -1;
      const live = localS >= 0 && localS <= s.dur;
      const pos = localS >= 0 ? s.from + s.spd * localS : s.from;
      const ox = c.ox || e.x, oz = c.oy || e.y;
      const nx = Math.cos(s.dir + Math.PI / 2), nz = Math.sin(s.dir + Math.PI / 2);
      const cx = ox + nx * pos, cz = oz + nz * pos;

      // the ground it has already been read across
      if (pos > s.from) {
        const bx = ox + nx * (pos - 80), bz = oz + nz * (pos - 80);
        dark(R, bx, bz, s.half * 1.15, 0.28, 2, 0.05, s.dir + Math.PI / 2, 1.15);
        streak(R, bx, bz, s.dir, 60, s.half, DEEP, 0.4, 4);
      }

      // the wall of script crossing the square
      fireWall(R, cx, cz, s.dir, s.half, live ? 120 : 46, live ? 1 : 0.28 + 0.25 * prog, tt, 20);
      streak(R, cx, cz, s.dir, s.w * 0.7, s.half * 1.02, HOT, live ? 0.8 : 0.2, 9);
      bill(R, cx + Math.cos(s.dir) * s.half, live ? 70 : 28, cz + Math.sin(s.dir) * s.half, 40, HOT, live ? 0.8 : 0.25, 5, 0, 0);
      bill(R, cx - Math.cos(s.dir) * s.half, live ? 70 : 28, cz - Math.sin(s.dir) * s.half, 40, HOT, live ? 0.8 : 0.25, 5, 0, 0);

      if (live) {
        R.light(cx, cz, 40, s.half + 320, HOT[0] * 0.7, HOT[1] * 0.6, HOT[2] * 0.45, 0.9);
        R.cameraKick = Math.max(R.cameraKick || 0, 0.1);
        for (let i = 0; i < Math.round(3 * qp(R)); i++) {
          const f = rnd(-s.half, s.half);
          R.emit({
            x: cx + Math.cos(s.dir) * f, y: rnd(6, 40), z: cz + Math.sin(s.dir) * f,
            vx: nx * 120 + rnd(-40, 40), vy: rnd(80, 190), vz: nz * 120 + rnd(-40, 40),
            life: rnd(0.5, 1.1), age: 0, s0: rnd(5, 11), s1: 1,
            col: Math.random() < 0.35 ? HOT : EMBER, a: 0.85, kind: 0, drag: 0.5, grav: 24
          });
        }
      }
    }

    for (const m of c.marks) {
      const local = on ? c.t - m.at : -1;
      const lit = local >= 0 && local <= m.dur;
      const spent = local > m.dur;

      if (lit) {
        const k = clamp(local / m.dur, 0, 1);
        flare(R, m.x, 24, m.y, m.r * (2.0 + 2.4 * k), 1.0 * (1 - k * 0.55));
        pillar(R, m.x, m.y, m.r * 0.26, m.r * (2.2 + 1.6 * k), 0.95, GOLD);
        wave(R, m.x, m.y, m.r * (1 + 4 * k), 0.9 * (1 - k), HOT, 0.04);
        sparks(R, m.x, 14, m.y, 12, 300, 210, null, 1);
        R.light(m.x, m.y, 34, 340, GOLD[0], GOLD[1] * 0.9, GOLD[2] * 0.55, 1);
        R.cameraKick = Math.max(R.cameraKick || 0, 0.16 * (1 - k));
      }

      seal(R, m.x, m.y, m.r, spent ? 0.55 : (lit ? 1.2 : 0.35 + 0.45 * prog), tt * 1.2 + m.ord, lit ? 1.5 : 0.9);
      if (spent) dark(R, m.x, m.y, m.r, 0.5, 3, 0, tt * 0.2, 1.5);

      // the number it was written with: one pip per clause, in a row above the seal
      for (let k = 0; k < m.ord; k++) {
        const off = (k - (m.ord - 1) / 2) * m.r * 0.42;
        bill(R, m.x + off, 96, m.y, 15, lit ? HOT : GOLD, lit ? 1 : 0.55 + 0.4 * prog, 1, 0, 0);
      }
    }
  }

  // ============================================================
  // DISPATCH
  // ============================================================
  let env0 = { player: { x: 0, y: 0 } };
  const TABLE = {
    brandOfEntry: brand,
    cinderWrit: cinder,
    bailiffsProcession: procession,
    writReversal: reversal,
    obsidianDocket: docket,
    scalesOfSentence: scales,
    finalDecree: decree,
    goldenVerdict: verdict
  };

  /** Called every frame the Bailiff is serving a sentence. */
  function telegraph(R, e, c, tt, env) {
    if (!R || !R.ok || !c) return;
    if (env) env0 = env;
    const on = c.phase === 'active';

    if (c.phase === 'windup') {
      const k = clamp(c.t / c.phases.windup, 0, 1);
      const rr = e.r || 40;
      R.glow(e.x, rr * 1.3, e.y, rr * (3 + 2.4 * k), GOLD[0], GOLD[1], GOLD[2], 0.22 * k, 0);
      seal(R, e.x, e.y, rr * (1.3 + 0.5 * k), 0.3 + 0.45 * k, tt * 0.9, 0.8);
      scriptRing(R, e.x, e.y, rr * 1.9, 0.5 * k, -tt * 1.3, GOLD);
      // the ink gathering back into the writ
      for (let i = 0; i < Math.round(3 * qp(R)); i++) {
        const ang = Math.random() * TAU, d = rr * (3 + Math.random() * 3.5);
        R.emit({
          x: e.x + Math.cos(ang) * d, y: rr * (0.3 + Math.random() * 1.2), z: e.y + Math.sin(ang) * d,
          vx: -Math.cos(ang) * 150, vy: 14, vz: -Math.sin(ang) * 150,
          life: 0.6, age: 0, s0: 7, s1: 1,
          col: Math.random() < 0.5 ? GOLD : EMBER, a: 0.85, kind: 0, drag: 0.15
        });
      }
      return;
    }

    const prog = clamp(c.t / c.phases.tele, 0, 1);
    const fn = TABLE[c.key];
    if (fn) fn(R, e, c, tt, on, prog);
  }

  /** The Bailiff's own standing writ: seals under the bench, and as the
   *  hours of the trial pass, rays and drifting gold around it. */
  function ambience(R, e, tt, stage) {
    if (!R || !R.ok) return;
    const rr = e.r || 40;
    const x = e.x, z = e.y;
    seal(R, x, z, rr * (1.35 + stage * 0.12), 0.5 + 0.1 * Math.sin(tt * 1.6), tt * 0.35, 1);
    scriptRing(R, x, z, rr * (1.7 + stage * 0.14), 0.45, -tt * 0.5, stage >= 3 ? HOT : GOLD);

    if (stage >= 3) {
      // the writ's authority stands in shafts of light
      const n = stage >= 4 ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const ang = tt * 0.22 + (i / n) * TAU;
        const d = rr * 1.5;
        bill(R, x + Math.cos(ang) * d, 90, z + Math.sin(ang) * d, 130, stage >= 4 ? HOT : GOLD,
          0.1 + 0.05 * Math.sin(tt * 2 + i), 4, 0, 0);
      }
    }
    // gold flecks drifting up off the robe
    for (let i = 0; i < Math.round((1 + stage) * 0.7 * qp(R)); i++) {
      const ang = Math.random() * TAU, d = rr * (0.5 + Math.random());
      R.emit({
        x: x + Math.cos(ang) * d, y: rr * (0.1 + Math.random() * 1.4), z: z + Math.sin(ang) * d,
        vx: (Math.random() - 0.5) * 14, vy: 28 + Math.random() * 40, vz: (Math.random() - 0.5) * 14,
        life: rnd(1, 1.9), age: 0, s0: rnd(4, 8), s1: 1,
        col: Math.random() < 0.55 ? GOLD : EMBER, a: 0.75, kind: 0, drag: 0.75
      });
    }
  }

  window.GildedBailiffFX = { telegraph, ambience };
})();
