/* =====================================================================
   melee_anim.js — the swing of every melee weapon.

   One pose function, read by all three places the weapon is drawn:
     • the first-person viewmodel   (render3d_fx.js  vmUpdate)
     • the world sprite in the arena (render3d_fx.js  drawMelee)
     • the 2D canvas fallback        (melee_sprites.js draw)

   A swing is a real motion, not a nudge: the hand winds the weapon back,
   drives it through a wide arc and recovers, and trail() hands the
   renderers the last few poses so the blade smears behind itself.

   A pose is written in the viewmodel's own units: px/py/pz move the
   weapon in the hand, rx/ry/rz/yaw turn it, `swing` is the full angle for
   the world sprite, `sc` scales it and `push` slides it forward along the
   fighter's facing.
   ===================================================================== */
(function (G) {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  // out and back, peaking past halfway so the wind-up and the follow-through
  // both get room instead of the whole travel squeezing into the first frames
  const bell = p => Math.sin(Math.pow(clamp(p, 0, 1), 1.3) * Math.PI);
  const tri = p => 1 - Math.abs(2 * Math.pow(clamp(p, 0, 1), 1.25) - 1);
  // a real strike: draw the weapon back, drive it through, then let the weight
  // of it carry the arm past the impact before recovering
  const snap = p => {
    p = clamp(p, 0, 1);
    if (p < .34) return -.40 * ease(p / .34);                    // wind back
    if (p < .64) return -.40 + 1.40 * ease((p - .34) / .30);     // drive through
    return 1 - .78 * ease((p - .64) / .36);                      // follow through
  };
  // same shape for the heavy blows, which raise the weapon higher first
  const wind = p => {
    p = clamp(p, 0, 1);
    if (p < .34) return -.55 * ease(p / .34);
    if (p < .68) return -.55 + 1.55 * ease((p - .34) / .34);
    return 1 - .72 * ease((p - .68) / .32);
  };

  // A swing travels a long way in the hand, and turns further than it moves.
  const POS = 1.9, ROT = 1.2;

  const Z = () => ({ px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, yaw: 0, swing: 0, sc: 1, push: 0 });

  /* ------------------------------------------------------------ motions
     p = 0..1 through the swing, s = side (+1/-1), a = strength. */
  const MOTIONS = {
    // straight punch: the fist fires forward and snaps back
    jab(p, s, a) {
      const k = snap(p), o = Z();
      o.pz = -11 * k * a; o.py = .6 * k; o.rx = -.18 * k; o.push = 7 * k * a;
      return o;
    },
    // two strikes in the space of one
    double(p, s, a) {
      const k = Math.abs(Math.sin(p * Math.PI * 2)) * (1 - p * .3), o = Z();
      o.pz = -10 * k * a; o.px = -s * 1.6 * k; o.ry = s * .3 * k; o.push = 6 * k * a;
      return o;
    },
    // hook: comes in from the side and wraps across the body
    hook(p, s, a) {
      const k = tri(p), o = Z();
      o.px = s * (5 - 16 * k) * a; o.pz = -8 * k * a; o.rz = s * (.5 - 1.4 * k); o.ry = s * .4 * k;
      o.yaw = s * .5 * k; o.swing = s * (.9 - 1.8 * k); o.push = 6 * k * a;
      return o;
    },
    // uppercut: rises through the target
    upper(p, s, a) {
      const k = snap(p), o = Z();
      o.py = -2 + 9 * k * a; o.pz = -7 * k * a; o.rx = .5 - 1.1 * k; o.px = s * 2 * k;
      o.swing = s * (.8 - 1.6 * k); o.push = 4 * k * a;
      return o;
    },
    // overhead chop: raised, then driven down
    over(p, s, a) {
      const w = wind(p), k = Math.max(0, w), o = Z();
      o.py = (w < 0 ? 4 * -w : -5 * k * a); o.pz = -6 * k * a; o.rx = -1.1 + 1.5 * k;
      o.swing = s * (.9 - 1.8 * k); o.push = 5 * k * a;
      return o;
    },
    // heavy slam: the whole body drops behind it
    slam(p, s, a) {
      const w = wind(p), k = Math.max(0, w), o = Z();
      o.py = (w < 0 ? 5 * -w : -5 * k * a); o.pz = -5 * k * a; o.rx = -.8 + 1.2 * k;
      o.sc = 1 + .06 * Math.sin(p * Math.PI * 6) * k; o.swing = s * (.7 - 1.4 * k); o.push = 4 * k * a;
      return o;
    },
    // straight thrust: no arc at all, just reach
    thrust(p, s, a) {
      const k = snap(p), o = Z();
      o.pz = -16 * k * a; o.px = -s * 1.5 * k; o.rx = .08 * k; o.push = 12 * k * a;
      return o;
    },
    // wide horizontal arc, all the way across the front
    sweep(p, s, a) {
      const k = bell(p), o = Z();
      o.swing = s * (1.0 - 2.0 * k); o.rz = s * (.55 - 1.1 * k); o.px = s * (4 - 9 * k) * a;
      o.pz = -5 * k * a; o.yaw = s * .6 * k; o.push = 6 * k * a;
      return o;
    },
    // full turn through the swing
    spin(p, s, a) {
      const k = bell(p), o = Z();
      o.ry = s * k * TAU; o.rz = s * (.6 - 1.2 * k); o.pz = -4 * k * a;
      o.yaw = s * k * 1.2; o.swing = s * (1.0 - TAU * k); o.push = 6 * k * a;
      return o;
    },
    // two crossing diagonal cuts
    cross(p, s, a) {
      const k = Math.sin(p * Math.PI * 2), m = Math.abs(k), o = Z();
      o.rz = s * .8 * Math.sin(p * TAU * 2); o.rx = -.5 * m; o.px = s * 4 * k * a;
      o.swing = s * (1.0 - 2.0 * m); o.push = 5 * m * a;
      return o;
    },
    // the swing curls, dragging a helix through the air
    spiral(p, s, a) {
      const k = bell(p), o = Z();
      o.ry = s * k * TAU * 1.2; o.rz = s * (.4 - 1.6 * k); o.pz = -6 * k * a;
      o.yaw = s * k * 1.6; o.swing = s * (1.1 - 2.6 * k); o.push = 7 * k * a;
      return o;
    },
    // the floor takes the blow: wind-up, drive down, shake
    quake(p, s, a) {
      const w = wind(p), k = Math.max(0, w), o = Z();
      o.py = (w < 0 ? 4 * -w : -5 * k * a); o.pz = -6 * k * a; o.rx = -.9 + 1.3 * k;
      o.px = s * Math.sin(p * Math.PI * 9) * 2 * k; o.sc = 1 + .08 * k * Math.sin(p * 40);
      o.swing = s * (.6 - 1.2 * k); o.push = 5 * k * a;
      return o;
    },
    // open palm: a shove, not a punch
    palm(p, s, a) {
      const k = snap(p), o = Z();
      o.pz = -12 * k * a; o.py = 1.5 * k; o.rx = -.35 * k; o.sc = 1 + .05 * k;
      o.swing = s * .5 * k; o.push = 8 * k * a;
      return o;
    },
    // draws the target in, then lets it go
    pull(p, s, a) {
      const k = Math.sin(p * Math.PI), o = Z();
      o.pz = (p < .45 ? 6 * (p / .45) : -14 * ((p - .45) / .55)) * a;
      o.px = s * 2 * k; o.rx = .25 * k; o.sc = 1 - .12 * k;
      o.push = (p < .45 ? -5 : 10) * k * a;
      return o;
    },
    // a short flick of the wrist
    flick(p, s, a) {
      const k = snap(p), o = Z();
      o.rz = s * (.8 - 1.6 * k); o.px = s * 3 * k * a; o.pz = -4 * k * a;
      o.yaw = s * .7 * k; o.swing = s * (1.0 - 2.0 * k); o.push = 4 * k * a;
      return o;
    },
    // three quick strikes
    flurry(p, s, a) {
      const q = Math.sin(p * Math.PI * 3), k = Math.abs(q) * (1 - p * .25), o = Z();
      o.px = s * 7 * q * a; o.pz = -8 * k * a; o.rz = s * .5 * q;
      o.swing = s * (1.0 - 2.0 * k); o.push = 6 * k * a;
      return o;
    },
    // a circle drawn in the air, then pushed out
    orb(p, s, a) {
      const ang = p * TAU, k = bell(p), o = Z();
      o.px = Math.cos(ang) * 5 * a; o.py = Math.sin(ang) * 4 * a + 2 * k; o.pz = -6 * k * a;
      o.ry = s * .5 * k; o.sc = 1 + .1 * k; o.yaw = s * .8 * k; o.swing = s * .9 * k; o.push = 6 * k * a;
      return o;
    },
    // charged: the strike crackles
    storm(p, s, a) {
      const k = bell(p), j = Math.sin(p * 70) * k, o = Z();
      o.px = s * (6 * k + j * 2) * a; o.pz = -9 * k * a; o.rz = s * (.5 - 1.3 * k + j * .15);
      o.py = j * .8; o.yaw = s * .6 * k; o.swing = s * (1.0 - 2.0 * k); o.push = 7 * k * a;
      return o;
    },
    // the cut appears twice, mirrored
    mirror(p, s, a) {
      const k = Math.sin(p * TAU), m = Math.abs(k), o = Z();
      o.rz = s * .9 * k; o.px = s * 5 * m * a; o.pz = -6 * m * a;
      o.swing = s * (1.0 - 2.0 * m); o.push = 5 * m * a;
      return o;
    },
    // everything goes off at once
    burst(p, s, a) {
      const k = snap(p), o = Z();
      o.pz = -13 * k * a; o.px = s * 3 * k; o.py = 1.5 * k; o.sc = 1 + .14 * k; o.rx = -.3 * k;
      o.yaw = s * .5 * k; o.swing = s * (1.1 - 2.2 * k); o.push = 9 * k * a;
      return o;
    }
  };

  /* ----------------------------------------------------------- profiles
     id === the weapon's key in melee_catalog.js. m: motion, s: side,
     a: strength, d: seconds the swing takes. A swing needs to be seen:
     the heavy weapons take their time, the fists are quick. */
  const PROFILES = {
    common_punch1: { m: 'jab',    s: 1,  a: 1.00, d: .50 },
    common_punch2: { m: 'double', s: 1,  a: 1.00, d: .56 },
    common_blade1: { m: 'flick',  s: 1,  a: 1.10, d: .60 },
    common_blade2: { m: 'sweep',  s: 1,  a: 1.10, d: .68 },
    common_kick:   { m: 'slam',   s: 1,  a: 1.00, d: .66 },

    rare_blade1:   { m: 'sweep',  s: 1,  a: 1.20, d: .66 },
    rare_blade2:   { m: 'cross',  s: 1,  a: 1.10, d: .68 },
    rare_blade3:   { m: 'spiral', s: 1,  a: 1.10, d: .72 },
    rare_punch1:   { m: 'burst',  s: 1,  a: .95,  d: .52 },
    rare_punch2:   { m: 'quake',  s: 1,  a: 1.00, d: .70 },

    epic_punch1:   { m: 'pull',   s: 1,  a: 1.10, d: .72 },
    epic_punch2:   { m: 'storm',  s: 1,  a: 1.00, d: .58 },
    epic_punch3:   { m: 'palm',   s: 1,  a: 1.20, d: .62 },
    epic_blade1:   { m: 'hook',   s: 1,  a: 1.15, d: .62 },
    epic_blade2:   { m: 'flick',  s: -1, a: 1.25, d: .60 },

    legendary_punch1: { m: 'upper',  s: 1,  a: 1.25, d: .62 },
    legendary_punch2: { m: 'pull',   s: -1, a: 1.25, d: .74 },
    legendary_blade1: { m: 'hook',   s: -1, a: 1.20, d: .66 },
    legendary_blade2: { m: 'mirror', s: 1,  a: 1.15, d: .70 },
    legendary_blade3: { m: 'storm',  s: 1,  a: 1.20, d: .60 },

    god_punch1: { m: 'burst',  s: 1,  a: 1.30, d: .64 },
    god_punch2: { m: 'orb',    s: 1,  a: 1.25, d: .76 },
    god_blade1: { m: 'spiral', s: 1,  a: 1.30, d: .70 },
    god_blade2: { m: 'mirror', s: -1, a: 1.30, d: .72 },
    god_blade3: { m: 'spin',   s: 1,  a: 1.25, d: .74 }
  };

  const FALLBACK = { punch: { m: 'jab', s: 1, a: 1, d: .52 }, kick: { m: 'slam', s: 1, a: 1, d: .66 }, blade: { m: 'sweep', s: 1, a: 1, d: .64 } };

  function profileOf(name, kind) {
    return PROFILES[name] || FALLBACK[kind] || FALLBACK.punch;
  }

  // The pose of a swing at `t` (0..1). `side` flips the swing after each
  // blade cut, so a repeated combo alternates instead of repeating.
  function pose(name, kind, t, side) {
    const pr = profileOf(name, kind);
    const fn = MOTIONS[pr.m] || MOTIONS.jab;
    const o = fn(clamp(t, 0, 1), pr.s * (side < 0 ? -1 : 1), pr.a);
    o.px *= POS; o.py *= POS; o.pz *= POS;
    o.rx *= ROT; o.ry *= ROT; o.rz *= ROT; o.yaw *= ROT;
    return o;
  }

  // The poses the blade passed through a moment ago: the renderers draw them
  // fading out behind it, so a swing smears instead of jumping.
  function trail(name, kind, t, side, n) {
    const out = [];
    const count = n || 3;
    for (let i = 1; i <= count; i++) {
      const back = clamp(t - i * 0.11, 0, 1);
      const o = pose(name, kind, back, side);
      o.a = 0.42 * (1 - (i - 1) / count);
      out.push(o);
    }
    return out;
  }

  // How long this weapon's swing takes (melee_sprites.create reads it).
  function dur(name, kind) { return profileOf(name, kind).d; }

  G.MeleeAnim = { pose, trail, dur, PROFILES, MOTIONS };
})(window);
