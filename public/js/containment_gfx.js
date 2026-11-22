// ============================================================
// Monster Arena — CONTAINMENT BREACH: rendering
// 3D (WebGL) drawing of the facility — eight distinct room styles, glowing
// wall trim, sealed/unsealed door fields, acid pools and erupting vents —
// plus the ANOMALY boss body and all of its attack telegraphs. Also a plain
// 2D floor hook so the mode still plays if WebGL is unavailable.
// containment_breach.js owns the rules; this file only draws them.
// ============================================================
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (n) => { const x = Math.sin(n * 91.345 + 17.1) * 43758.5453; return x - Math.floor(x); };
  const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

  const FLOOR = { intake: [.5, .55, .62], chem: [.17, .24, .13], cryo: [.3, .45, .58], bio: [.1, .26, .17], reactor: [.26, .12, .07], server: [.12, .09, .22], vault: [.2, .06, .08], anomaly: [.08, .02, .12] };
  const WALL_H = 230, T = 40;

  function C() { return window.Containment; }

  function box(R, x, y, z, hx, hy, hz, col, o) { R.draw(R.unit.box, R.mm(x, y, z, o && o.ry || 0, hx, hy, hz), R.mat(col, o || {})); }
  function glowBox(R, x, y, z, hx, hy, hz, col, k, a, ry) { R.draw(R.unit.box, R.mm(x, y, z, ry || 0, hx, hy, hz), R.mat(col, { emissive: [col[0] * k, col[1] * k, col[2] * k], emisK: 1, alpha: a === undefined ? 1 : a, shadow: false })); }

  // --------------------------------------------------------------- props
  const PROPS = {
    intake(R, r, tt, ac) {
      glowBox(R, r.cx, 24, r.cy, 120, 24, 30, [.7, .75, .85], .2);                                   // reception desk
      glowBox(R, r.cx, 50, r.cy - 28, 110, 2, 3, ac, 2);
      for (let i = 0; i < 4; i++) { const x = r.x + 140 + i * 170; box(R, x, 14, r.y + r.h - 110, 55, 14, 20, [.3, .34, .42], { rough: .4 }); }            // benches
      for (let i = 0; i < 3; i++) glowBox(R, r.x + 200 + i * 200, WALL_H + 10, r.cy, 70, 2, 16, [.8, .95, 1.1], 2.2);                                          // ceiling panels
      R.glow(r.cx, 100, r.cy, 520, .5, .8, 1.2, .1, 0);
    },
    chem(R, r, tt, ac) {
      for (let i = 0; i < 4; i++) { const x = r.x + 110 + (i % 2) * 580, z = r.y + 110 + ((i / 2) | 0) * 480; R.draw(R.unit.cyl, R.mm(x, 60, z, 0, 36, 60, 36), R.mat([.25, .4, .22], { rough: .3, metal: .5, emissive: [.1, .5, .12], emisK: .7 })); R.glow(x, 70, z, 120, .3, 1.4, .3, .22, 0); }
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + tt * .1; R.glow(r.cx + Math.cos(a) * 280, 40 + Math.sin(tt * 1.5 + i) * 18, r.cy + Math.sin(a) * 200, 28, .4, 1.6, .3, .35, 0); }          // fumes
      for (let i = 0; i < 5; i++) { const lf = (tt * .2 + i * .2) % 1; R.glow(r.x + 120 + i * 140, 20 + lf * 160, r.cy + Math.sin(i) * 120, 34, .5, 1.4, .3, (1 - lf) * .3, 3); }
    },
    cryo(R, r, tt, ac) {
      for (let i = 0; i < 9; i++) { const x = r.x + 90 + rnd(i * 3) * (r.w - 180), z = r.y + 90 + rnd(i * 7) * (r.h - 180), h = 50 + rnd(i) * 90; R.draw(R.unit.cone, R.mm(x, h / 2, z, rnd(i) * 3, 16 + rnd(i) * 14, h / 2, 16 + rnd(i) * 14), R.mat([.5, .85, 1.1], { rough: .1, metal: .2, emissive: [.2, .6, .9], emisK: .8, alpha: .82, shadow: false })); R.glow(x, h * .6, z, 80, .5, 1.2, 1.8, .18, 0); }
      for (let i = 0; i < 6; i++) R.glow(r.x + 100 + ((i * 160 + tt * 22) % (r.w - 200)), 22, r.cy + Math.sin(tt * .4 + i) * 220, 240, .5, .95, 1.2, .1, 3);           // ice fog
      R.decal(r.cx, r.cy, 300, .6, 1.2, 1.6, .2, 9, 0, tt * .1, true, 3);
    },
    bio(R, r, tt, ac) {
      for (let i = 0; i < 12; i++) {
        const x = r.x + 80 + rnd(i * 5) * (r.w - 160), z = r.y + 80 + rnd(i * 11) * (r.h - 160), h = 60 + rnd(i) * 100;
        R.draw(R.unit.cone, R.mm(x, h / 2, z, rnd(i) * 3, 8, h / 2, 8, Math.sin(tt * .8 + i) * .12), R.mat([.1, .35, .14], { rough: .7, emissive: [.04, .2, .08], emisK: .6 }));
        const pod = .6 + .4 * Math.sin(tt * 2 + i); R.draw(R.unit.sphereLo, R.mm(x, h + 8, z, 0, 14, 14, 14), R.mat([.3, 1.6, .9], { emissive: [.3, 1.7, .9], emisK: 1, alpha: .85, shadow: false })); R.glow(x, h + 8, z, 90, .3, 1.5, .8, .3 * pod, 0);
      }
      for (let i = 0; i < 40; i++) { const lf = (tt * .12 + i * .037) % 1; R.glow(r.x + 60 + rnd(i * 2) * (r.w - 120) + Math.sin(tt + i) * 20, 10 + lf * 200, r.y + 60 + rnd(i * 9) * (r.h - 120), 10, .5, 1.8, .9, (1 - lf) * .5, 0); }
    },
    reactor(R, r, tt, ac) {
      R.draw(R.unit.cyl, R.mm(r.cx, 70, r.cy, 0, 70, 70, 70), R.mat([.2, .1, .08], { rough: .4, metal: .7 }));
      const f = .75 + .25 * Math.sin(tt * 3);
      R.draw(R.unit.cyl, R.mm(r.cx, 100, r.cy, 0, 46, 100, 46), R.mat([1.4, .6, .2], { emissive: [2, .8, .2], emisK: 1, alpha: .55 * f, shadow: false }));
      for (let i = 0; i < 3; i++) R.decal(r.cx, r.cy, 200 + i * 90, 1.9, .8, .25, .4, 9, tt * (i + 1) * .3, tt * (i % 2 ? -.4 : .5), true, 20 + i * 40);
      R.glow(r.cx, 100, r.cy, 520, 1.6, .7, .2, .35 * f, 0); R.light(r.cx, r.cy, 90, 900, 1.8, .8, .25, .9);
      for (let i = 0; i < 24; i++) { const a = i / 24 * TAU + tt * .3, lf = (tt * .5 + i * .13) % 1; R.glow(r.cx + Math.cos(a) * 80 * (1 + lf), 20 + lf * 200, r.cy + Math.sin(a) * 80 * (1 + lf), 14, 2, .9, .3, (1 - lf) * .8, 0); }
    },
    server(R, r, tt, ac) {
      for (let k = 0; k < 2; k++) for (let i = 0; i < 6; i++) {
        const x = r.x + 100 + i * 120, z = r.y + (k ? r.h - 110 : 110);
        box(R, x, 60, z, 36, 60, 22, [.1, .09, .16], { rough: .4, metal: .6 });
        for (let l = 0; l < 6; l++) { const on = Math.sin(tt * (3 + l) + i * 3 + k * 7) > .1; glowBox(R, x, 16 + l * 18, z + (k ? -22 : 22), 24, 2, 1, on ? [.7, 1.4, 2] : [.5, .2, 1.4], on ? 2.4 : 1.6); }
      }
      for (let i = 0; i < 3; i++) { const q = r.y + 220 + i * 130 + Math.sin(tt * 1.2 + i * 2) * 60; R.draw(R.unit.box, R.mm(r.cx, 40, q, 0, r.w / 2 - 70, 1.4, 1.6), R.mat([2, .3, .5], { emissive: [2.6, .3, .6], alpha: .5, shadow: false })); }          // laser grid sweep
      R.glow(r.cx, 80, r.cy, 520, .5, .3, 1.2, .12, 0);
    },
    vault(R, r, tt, ac) {
      for (let i = 0; i < 6; i++) {
        const x = r.x + 110 + (i % 3) * 290, z = r.y + 110 + ((i / 3) | 0) * 480, lit = Math.sin(tt * 1.7 + i * 2) > .2;
        R.draw(R.unit.cyl, R.mm(x, 56, z, 0, 40, 56, 40), R.mat([.16, .07, .09], { rough: .3, metal: .5, alpha: .85 }));
        R.draw(R.unit.cyl, R.mm(x, 52, z, 0, 28, 44, 28), R.mat([1.6, .2, .3], { emissive: [lit ? 2 : .5, .1, .2], emisK: 1, alpha: .55, shadow: false }));
        R.glow(x, 60, z, 130, 1.8, .15, .25, lit ? .35 : .08, 0);
        for (let b = 0; b < 4; b++) box(R, x + Math.cos(b * 1.57) * 40, 56, z + Math.sin(b * 1.57) * 40, 2, 56, 2, [.35, .3, .32], { metal: .8 });
      }
      for (let i = 0; i < 6; i++) R.decal(r.x + 120 + rnd(i) * (r.w - 240), r.y + 120 + rnd(i + 4) * (r.h - 240), 120 + rnd(i * 3) * 120, 1.4, .1, .15, .22, 10, 0, i, true, 3);
    },
    anomaly(R, r, tt, ac) {
      R.decal(r.cx, r.cy, 700, 1.4, .3, 1.6, .22, 10, 0, tt * .15, true, 2.5);
      R.decal(r.cx, r.cy, 520, 1.8, .4, 1.9, .3, 9, tt * .4, -tt * .2, true, 3);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + tt * .1; R.glow(r.cx + Math.cos(a) * 340, 20, r.cy + Math.sin(a) * 340, 120, 1.4, .2, 1.6, .22, 0); glowBox(R, r.cx + Math.cos(a) * 340, 70, r.cy + Math.sin(a) * 340, 6, 70, 6, [1.2, .2, 1.4], 1.8, .6, a); }
    }
  };

  function drawRoom(R, r, rs, tt, S) {
    const base = FLOOR[r.id] || [.3, .3, .3], ac = hexRGB(r.accent);
    R.draw(R.unit.box, R.mm(r.cx, -6, r.cy, 0, r.w / 2, 6, r.h / 2), R.mat(base, { rough: r.id === 'intake' || r.id === 'cryo' ? .3 : .6, metal: .05, emissive: [base[0] * .6, base[1] * .6, base[2] * .6], emisK: 1 }));
    for (let i = 1; i < 8; i++) glowBox(R, r.x + r.w * i / 8, .6, r.cy, 1.1, .5, r.h / 2 - T, ac, .9, .5);
    for (let i = 1; i < 7; i++) glowBox(R, r.cx, .6, r.y + r.h * i / 7, r.w / 2 - T, .5, 1.1, ac, .9, .5);
    R.decal(r.cx, r.cy, Math.min(r.w, r.h) * .75, ac[0] * 1.3, ac[1] * 1.3, ac[2] * 1.3, .18 + .06 * Math.sin(tt * 2), 9, tt * .2, tt * .08, true, 1.6);
    if (rs && rs.spawned && !rs.cleared) R.light(r.cx, r.cy, 150, Math.max(r.w, r.h) * 1.3, ac[0], ac[1], ac[2], .55);
    else R.light(r.cx, r.cy, 150, Math.max(r.w, r.h) * 1.2, ac[0], ac[1], ac[2], .4);
    (PROPS[r.id] || (() => {}))(R, r, tt, ac);
  }

  function drawHazards(R, S, tt) {
    S.haz.forEach((h) => {
      if (h.k === 'acid') {
        R.decal(h.x, h.y, h.r * 2.2, .2, 1.2, .15, .55, 11, 0, 0, true, 1.8); R.decal(h.x, h.y, h.r * 2, .35, 1.7, .25, .5, 10, 0, tt * .3, true, 2);
        R.glow(h.x, 14, h.y, h.r * 2.4, .3, 1.5, .3, .2, 0);
        for (let i = 0; i < 4; i++) { const lf = (tt * .6 + i * .25) % 1, a = i * 1.7; R.glow(h.x + Math.cos(a) * h.r * .6, 6 + lf * 40, h.y + Math.sin(a) * h.r * .6, 14, .5, 1.8, .4, (1 - lf) * .7, 0); }
      } else if (h.st === 'warn') {
        const u = h.t / 1.2, p = .5 + .5 * Math.sin(tt * 22);
        R.decal(h.x, h.y, h.r * 2.3, 2.2, .6, .2, .35 + .35 * p, 7, 0, 0, true, 2.6); R.decal(h.x, h.y, h.r * 2.3 * (1 - u * .6), 2.4, 1.2, .4, .7, 2, .08, 0, true, 3);
      } else if (h.st === 'burst') {
        const u = h.t / .5;
        R.draw(R.unit.cyl, R.mm(h.x, 120, h.y, 0, h.r * (1 - u * .3), 120, h.r * (1 - u * .3)), R.mat([2, 1, .3], { emissive: [2.6, 1.2, .3], emisK: 1, alpha: .6 * (1 - u * .5), shadow: false }));
        R.glow(h.x, 90, h.y, h.r * 4, 2.4, 1, .3, .6 * (1 - u), 0); R.decal(h.x, h.y, h.r * 2.6 * (1 + u), 2.4, 1.2, .4, .6 * (1 - u), 2, .1, 0, true, 3);
      } else { R.decal(h.x, h.y, h.r * 1.6, .4, .3, .3, .5, 2, .1, 0, true, 2.5); R.glow(h.x, 6, h.y, h.r * 1.8, 1.2, .5, .2, .1 + .05 * Math.sin(tt * 3 + h.ph), 0); }
    });
  }

  function nearestAccent(x, y) {
    const rooms = C().ROOMS; let best = rooms[0], bd = 1e12;
    rooms.forEach((r) => { const d = (r.cx - x) ** 2 + (r.cy - y) ** 2; if (d < bd) { bd = d; best = r; } }); return hexRGB(best.accent);
  }

  function draw(R, F, tt) {
    const CB = C(), S = CB.state; if (!S.active) return;
    R._zOv = 0;
    if (window.ContainmentLab) window.ContainmentLab.draw(R, F, tt, S, CB);
    drawHazards(R, S, tt);
    R._zOv = null;
  }

  // ------------------------------------------------------- the ANOMALY
  function drawBoss(R, e, tt) {
    const b = e._cb, S = C().state; if (!b) return;
    const x = e.x, z = e.y, hpf = clamp(e.hp / e.maxhp, 0, 1), ph = C().bossPhase(e);
    const col = ph === 1 ? [1.5, .3, 1.7] : ph === 2 ? [1.8, .25, 1.0] : [2.0, .2, .5], hot = [2.4, 1.4, 2.4];
    R._zOv = 0;
    const pulse = .8 + .2 * Math.sin(tt * (2 + ph)), hover = 70 + Math.sin(tt * 1.4) * 10;
    const appear = clamp(1 - Math.max(0, b.intro) / 3.2, 0, 1);
    // the core: a roiling sphere of un-written light with counter-rotating rings
    R.draw(R.unit.sphere, R.mm(x, hover, z, tt * .3, 44 * appear * pulse, 44 * appear * pulse, 44 * appear * pulse), R.mat([.05, .0, .08], { rough: .2, metal: .8, emissive: [col[0] * .9, col[1] * .9, col[2] * .9], emisK: 1.3, rim: 1, rimCol: hot }));
    R.draw(R.unit.sphere, R.mm(x, hover, z, 0, 58 * appear, 58 * appear, 58 * appear), R.mat(col, { emissive: col, emisK: 1, alpha: .16, shadow: false }));
    for (let i = 0; i < 4; i++) R.draw(R.unit.torus, R.mm(x, hover, z, tt * (.6 + i * .3) * (i % 2 ? -1 : 1), (80 + i * 22) * appear, (80 + i * 22) * appear, (80 + i * 22) * appear, Math.PI / 2 * (i % 2) + Math.sin(tt * .5 + i) * .6, i * .7), R.mat(col, { emissive: [col[0] * 1.5, col[1] * 1.5, col[2] * 1.5], emisK: 1, alpha: .85, shadow: false }));
    for (let i = 0; i < 7; i++) { const a = b.spin * .7 + i * TAU / 7, rr = 120 + 14 * Math.sin(tt * 2 + i); R.draw(R.unit.cone, R.mm(x + Math.cos(a) * rr, hover + Math.sin(tt * 1.7 + i) * 24, z + Math.sin(a) * rr, -a, 9, 36, 9, 0, Math.PI / 2), R.mat([.1, 0, .14], { emissive: hot, emisK: .9, shadow: false })); }
    // un-written tendrils reaching for the floor
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + tt * .2, pts = []; for (let k = 0; k <= 8; k++) { const u = k / 8; pts.push(x + Math.cos(a) * (60 + u * 150) + Math.sin(tt * 3 + k + i) * 10, hover * (1 - u) + 4, z + Math.sin(a) * (60 + u * 150) + Math.cos(tt * 3 + k + i) * 10); } R.rib.line(pts, 14, 3, col[0], col[1], col[2], .6 * appear); }
    R.glow(x, hover, z, 230 * appear, col[0], col[1], col[2], .2 * pulse, 0); R.glow(x, hover, z, 90, hot[0], hot[1], hot[2], .3, 0); R.light(x, z, hover, 800, col[0], col[1], col[2], .7);
    R.decal(x, z, 280, col[0], col[1], col[2], .3, 9, tt, tt * .4, true, 2.5);
    // phase-change shock
    const bt = tt - (b.burst > -1 ? 0 : 0); if (S.t - b.burst < 1.6 && b.burst > 0) { const k = (S.t - b.burst) / 1.6; R.decal(x, z, 200 + k * 1700, hot[0], hot[1], hot[2], (1 - k) * .8, 2, .05, 0, true, 3.5); R.glow(x, 80, z, 600 * (1 - k * .4), col[0], col[1], col[2], (1 - k) * .5, 0); }
    const c = b.cur; if (c) attackFx(R, e, c, tt, col, hot, hover);
    R._zOv = null;
  }

  function attackFx(R, e, c, tt, col, hot, hover) {
    const x = e.x, z = e.y, ph = c.phase, u = clamp(c.t / Math.max(.05, c.phases[ph]), 0, 1), pp = .5 + .5 * Math.sin(tt * 18);
    if (ph === 'windup') { for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + tt * 3, d = 320 * (1 - u) + 30; R.glow(x + Math.cos(a) * d, hover, z + Math.sin(a) * d, 20 + u * 20, hot[0], hot[1], hot[2], .35 + u * .5, 0); } R.glow(x, hover, z, 140 + u * 160, col[0], col[1], col[2], .15 + u * .25, 0); }
    if (c.key === 'pulse') {
      if (ph === 'tele') { R.decal(x, z, c.maxR * 2, hot[0], hot[1], hot[2], .1 + .12 * pp, 7, 0, 0, true, 2.8); R.decal(x, z, c.maxR * 2 * u, hot[0], hot[1], hot[2], .8, 9, tt, 0, true, 3); R.decal(x, z, c.maxR * 2, col[0], col[1], col[2], .45, 9, 0, tt * .3, true, 3.1); }
      if (ph === 'active') { for (let k = 0; k < 3; k++) R.decal(c.cx, c.cy, Math.max(20, (c.r - k * 24) * 2), hot[0], hot[1], hot[2], .75 - k * .22, 2, .035 + k * .02, 0, true, 3.4); R.glow(c.cx, 20, c.cy, c.r * .8, col[0], col[1], col[2], .12, 0); if (c.double && c.r > 260) R.decal(c.cx, c.cy, (c.r - 260) * 2, hot[0], hot[1], hot[2], .6, 2, .04, 0, true, 3.5); }
    } else if (c.key === 'rift') {
      const base = ph === 'active' ? c.ang + c.sweep * (c.t / c.phases.active) * 1.6 : c.ang;
      for (let i = 0; i < c.n; i++) {
        const a = base + i * TAU / c.n, ex = x + Math.cos(a) * c.len, ez = z + Math.sin(a) * c.len;
        if (ph === 'windup') continue;
        if (ph === 'tele') { R.rib.line([x, 8, z, ex, 8, ez], 8, 8, hot[0], hot[1], hot[2], .25 + .35 * pp); for (let k = 1; k < 10; k++) R.glow(x + Math.cos(a) * k * c.len / 10, 8, z + Math.sin(a) * k * c.len / 10, 22, hot[0], hot[1], hot[2], .3 * pp, 0); }
        else if (ph === 'active') { R.rib.line([x, hover * .8, z, ex, 22, ez], 30, 26, col[0], col[1], col[2], .6); R.rib.line([x, hover * .8, z, ex, 22, ez], 9, 8, 2.0, 1.7, 2.0, .9); for (let k = 1; k < 12; k++) R.glow(x + Math.cos(a) * k * c.len / 12, 26, z + Math.sin(a) * k * c.len / 12, 44, col[0], col[1], col[2], .14, 0); }
      }
    } else if (c.key === 'tear' && c.zones) {
      c.zones.forEach((q, i) => {
        if (ph === 'tele') { R.decal(q.x, q.y, q.r * 2.1, hot[0], hot[1], hot[2], .25 + .3 * pp, 7, 0, 0, true, 2.8); R.decal(q.x, q.y, q.r * 2.3, col[0], col[1], col[2], .6, 9, tt * 2 + i, tt, true, 3); for (let k = 0; k < 4; k++) R.glow(q.x + Math.cos(k * 1.57 + tt) * q.r * .6, 20 + u * 90, q.y + Math.sin(k * 1.57 + tt) * q.r * .6, 18, hot[0], hot[1], hot[2], .5, 0); }
        else if (ph === 'active') { const k = u; R.draw(R.unit.cyl, R.mm(q.x, 150, q.y, 0, q.r * (.9 - k * .3), 150, q.r * (.9 - k * .3)), R.mat(col, { emissive: [col[0] * 1.6, col[1] * 1.6, col[2] * 1.6], emisK: 1, alpha: .55 * (1 - k * .6), shadow: false })); R.glow(q.x, 90, q.y, q.r * 3.5, hot[0], hot[1], hot[2], .5 * (1 - k), 0); R.decal(q.x, q.y, q.r * 2.6 * (1 + k), hot[0], hot[1], hot[2], .6 * (1 - k), 2, .08, 0, true, 3.4); }
      });
    } else if (c.key === 'gravity') {
      if (ph === 'tele' || ph === 'active') { R.decal(c.cx || x, c.cy || z, c.pullR * 2, col[0], col[1], col[2], .4, 10, 0, -tt * (ph === 'active' ? 3 : 1), true, 2.6); R.decal(c.cx || x, c.cy || z, c.blastR * 2, hot[0], .3, .4, ph === 'tele' ? .15 + .3 * u : .6, 7, 0, 0, true, 3); for (let i = 0; i < 20; i++) { const a = i / 20 * TAU + tt * 2, d = (c.pullR * (1 - ((tt * .7 + i * .13) % 1))); R.glow((c.cx || x) + Math.cos(a) * d, 12, (c.cy || z) + Math.sin(a) * d, 16, hot[0], hot[1], hot[2], .5, 0); } }
    } else if (c.key === 'failure') {
      const R7 = C().ROOMS[7];
      if (ph === 'tele' || ph === 'active') {
        R.decal(R7.cx, R7.cy, 1300, 2.2, .1, .25, ph === 'tele' ? .22 + .2 * u * pp : .55, 12, .0, 0, true, 3.6);
        R.draw(R.unit.box, R.mm(R7.cx, 3, R7.cy, 0, R7.w / 2 - T, 3, R7.h / 2 - T), R.mat([2, .1, .2], { emissive: [2.2, .1, .2], emisK: 1, alpha: (ph === 'tele' ? .08 + .3 * u * u : .6) * (.6 + .4 * pp), shadow: false }));
        c.zones.forEach((q) => { R.decal(q.x, q.y, q.r * 2, .3, 2, 1, .7, 7, 0, 0, true, 4); R.decal(q.x, q.y, q.r * 2.2, .5, 2.4, 1.2, .8, 9, tt, 0, true, 4.2); R.glow(q.x, 30, q.y, q.r * 2.4, .3, 2, 1, .35, 0); R.draw(R.unit.cyl, R.mm(q.x, 90, q.y, 0, q.r * .95, 90, q.r * .95), R.mat([.4, 1.8, 1], { emissive: [.4, 2, 1.1], emisK: 1, alpha: .12, shadow: false })); });
      }
    }
  }

  // ------------------------------------------------------ 2D fallback
  function floor2D(ctx, W, H, cam, S) {
    const CB = C(), ox = -cam.x - cam.sx, oy = -cam.y - cam.sy;
    ctx.fillStyle = '#04050a'; ctx.fillRect(0, 0, W, H);
    CB.ROOMS.forEach((r) => { const f = FLOOR[r.id], ac = r.accent; ctx.fillStyle = 'rgb(' + f.map((v) => Math.round(v * 255)).join(',') + ')'; ctx.fillRect(r.x + ox, r.y + oy, r.w, r.h); ctx.strokeStyle = ac; ctx.globalAlpha = .12; ctx.lineWidth = 1; for (let x = r.x; x < r.x + r.w; x += 100) { ctx.beginPath(); ctx.moveTo(x + ox, r.y + oy); ctx.lineTo(x + ox, r.y + r.h + oy); ctx.stroke(); } ctx.globalAlpha = 1; });
    ctx.fillStyle = '#16181f'; CB.LAYOUT.corridors.forEach((c) => ctx.fillRect(c.x + ox, c.y + oy, c.w, c.h));
    ctx.fillStyle = '#2a2e3c'; CB.LAYOUT.walls.forEach((w) => ctx.fillRect(w.x + ox, w.y + oy, w.w, w.h));
    CB.LAYOUT.doors.forEach((d) => { ctx.fillStyle = d.open ? 'rgba(80,255,170,.35)' : 'rgba(255,50,80,.7)'; ctx.fillRect(d.rect.x + ox, d.rect.y + oy, d.rect.w, d.rect.h); });
    S.haz.forEach((h) => { ctx.fillStyle = h.k === 'acid' ? 'rgba(90,255,60,.45)' : (h.st === 'burst' ? 'rgba(255,170,60,.8)' : h.st === 'warn' ? 'rgba(255,80,40,.5)' : 'rgba(255,140,60,.2)'); ctx.beginPath(); ctx.arc(h.x + ox, h.y + oy, h.r, 0, TAU); ctx.fill(); });
  }

  window.ContainmentGfx = { draw, drawBoss, floor2D };
})();
