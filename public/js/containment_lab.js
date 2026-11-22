// ============================================================
// Monster Arena — CONTAINMENT BREACH: the facility itself
// A broken research building, drawn as a place rather than a stage:
//   • solid walls to the ceiling with a dado, pipe runs, cable trays, observation
//     windows, working monitors, warning signs, lockers and burnt-out panels
//   • ceilings with fluorescent panels (some flickering, some dead and sparking),
//     ducting, hanging cables — drawn when the camera is inside (first person);
//     from a top-down camera the walls cut away so you can still see the room
//   • long corridors with strip lights, chevron guidance, vents and caution lamps
//   • blast doors (not force-fields): steel halves with hazard stripes and a lock light
//   • lockdown alarms: rotating beacons, strobing room light, siren (audio in the mode)
//   • per-room science: DNA holograms, specimen tanks, cryo pods, server racks, benches
//     with glassware, a reactor core, containment cells, a wrecked lab around the Anomaly
//   • vines through the ceiling and up the walls, roots, spore light
//   • lab platforms to jump across (crates, benches, pods, gantries, racks, roots)
// containment_gfx.js calls ContainmentLab.draw each frame; the rules live in containment_breach.js.
// ============================================================
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7 + 11.3) * 43758.5453; return x - Math.floor(x); };
  const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const flick = (seed, tt) => (Math.sin(tt * 37 + seed * 13) * Math.sin(tt * 11 + seed * 3) > .72 ? .12 : 1);
  const T = 40;
  const STEEL = [.18, .2, .25], DARK = [.07, .08, .1], PANEL = [.3, .33, .38];

  let R, U, mm, mat, TT, WH, FP, S, CB, accentOf = [], doorAnim = [], me;

  // ---------------------------------------------------------------- primitives
  const box = (x, y, z, hx, hy, hz, col, o, ry, rx, rz) => R.draw(U.box, mm(x, y, z, ry || 0, hx, hy, hz, rx || 0, rz || 0), mat(col, o || { rough: .7, metal: .3 }));
  const gbox = (x, y, z, hx, hy, hz, col, k, a, ry, rx, rz) => R.draw(U.box, mm(x, y, z, ry || 0, hx, hy, hz, rx || 0, rz || 0), mat(col, { emissive: [col[0] * k, col[1] * k, col[2] * k], emisK: 1, alpha: a === undefined ? 1 : a, shadow: false }));
  const cyl = (x, y, z, rx, hy, rz, col, o, rxr, rzr, ry) => R.draw(U.cyl, mm(x, y, z, ry || 0, rx, hy, rz, rxr || 0, rzr || 0), mat(col, o || { rough: .6, metal: .4 }));
  const glass = (x, y, z, rx, hy, rz, col, a) => R.draw(U.cyl, mm(x, y, z, 0, rx, hy, rz), mat(col, { rough: .1, metal: .2, emissive: [col[0] * .5, col[1] * .5, col[2] * .5], emisK: 1, alpha: a === undefined ? .22 : a, shadow: false }));
  const orb = (x, y, z, r, col, k, a) => R.draw(U.sphereLo, mm(x, y, z, 0, r, r, r), mat(col, { emissive: [col[0] * k, col[1] * k, col[2] * k], emisK: 1, alpha: a === undefined ? 1 : a, shadow: false }));
  const glow = (x, y, z, s, col, a) => R.glow(x, y, z, s, col[0], col[1], col[2], a, 0);

  // a local frame on a wall/face: u along the face, v up, off out from the face
  function frame(bx, bz, nx, nz) {
    const ry = Math.atan2(nx, nz), tx = nz, tz = -nx;
    return { ry, pt: (u, v, off) => [bx + tx * u + nx * off, v, bz + tz * u + nz * off], tx, tz, nx, nz };
  }

  // ---------------------------------------------------------------- displays
  function screen(F, u, v, w, h, kind, seed, col) {
    const [x, y, z] = F.pt(u, v, 2.5);
    box(x, y, z, w / 2 + 3, h / 2 + 3, 2, DARK, { rough: .4, metal: .6 }, F.ry);
    const dead = hash(seed, 77) > .86, f = dead ? 0 : flick(seed, TT);
    const c = col || [.2, 1.1, 1.4];
    gbox(...F.pt(u, v, 5), w / 2, h / 2, .8, [c[0] * .12, c[1] * .12, c[2] * .12], dead ? .1 : 2.2, .95, F.ry);
    if (dead) { const [sx, sy, sz] = F.pt(u + (hash(seed, 1) - .5) * w * .5, v + (hash(seed, 2) - .5) * h * .5, 6); if (Math.sin(TT * 9 + seed) > .85) glow(sx, sy, sz, 40, [1.6, 1.5, 1.2], .6); return; }
    const P = (uu, vv) => F.pt(u + uu * w / 2, v + vv * h / 2, 7);
    if (kind === 'graph') {
      const pts = []; for (let i = 0; i <= 14; i++) { const q = i / 14, [x2, y2, z2] = P(q * 1.8 - .9, Math.sin(q * 9 + TT * 2 + seed) * .34 + Math.sin(q * 23 + TT * 5) * .1); pts.push(x2, y2, z2); }
      R.rib.line(pts, 2.4, 2.4, c[0] * 1.6, c[1] * 1.6, c[2] * 1.6, .95 * f);
      for (let i = -2; i <= 2; i++) { const [a, b, d] = P(0, i * .35); gbox(a, b, d, w * .44, .3, .3, c, .8, .35 * f, F.ry); }
    } else if (kind === 'bars') {
      for (let i = 0; i < 7; i++) { const hh = (.25 + .65 * Math.abs(Math.sin(TT * (.8 + i * .3) + seed + i))) * h * .8; const [a, b, d] = F.pt(u + (i - 3) * w * .12, v - h * .4 + hh / 2, 7); gbox(a, b, d, w * .04, hh / 2, .8, i % 3 === 0 ? [1.6, .5, .3] : c, 1.6, .95 * f, F.ry); }
    } else if (kind === 'radar') {
      const a = TT * 2 + seed, [cx, cy, cz] = P(0, 0), [ex, ey, ez] = P(Math.cos(a) * .85, Math.sin(a) * .85);
      R.rib.line([cx, cy, cz, ex, ey, ez], 2, 2, c[0] * 1.8, c[1] * 1.8, c[2] * 1.8, .95 * f);
      for (let i = 0; i < 5; i++) { const aa = hash(seed, i) * TAU, rr = .25 + hash(seed, i + 9) * .55, [bx, by, bz] = P(Math.cos(aa) * rr, Math.sin(aa) * rr); if (Math.cos(aa - a) > .6) glow(bx, by, bz, 22, [1.8, .5, .4], .9); orb(bx, by, bz, 1.6, [1.8, .4, .3], 1.4, .8 * f); }
      for (let i = 1; i <= 3; i++) for (let k = 0; k < 12; k++) { const aa = k / 12 * TAU, [rx, ry2, rz] = P(Math.cos(aa) * i * .28, Math.sin(aa) * i * .28); glow(rx, ry2, rz, 5, c, .28); }
    } else if (kind === 'alert') {
      const on = Math.sin(TT * 7 + seed) > 0, [cx, cy, cz] = P(0, 0), cc = [2.2, .25, .25];
      if (on) { gbox(cx, cy, cz, w * .36, 2.4, .8, cc, 2, .95, F.ry, 0, .78); gbox(cx, cy, cz, w * .36, 2.4, .8, cc, 2, .95, F.ry, 0, -.78); glow(cx, cy, cz, 60, cc, .5); }
    } else if (kind === 'text') {
      for (let i = 0; i < 6; i++) { const wd = (.3 + hash(seed, i + (Math.floor(TT * 2) % 3)) * .6) * w * .8, [a, b, d] = F.pt(u - w * .4 + wd / 2, v + h * .36 - i * h * .13, 7); gbox(a, b, d, wd / 2, 1.1, .6, c, 1.8, .85 * f, F.ry); }
    } else if (kind === 'ecg') {
      const pts = []; for (let i = 0; i <= 22; i++) { const q = i / 22, ph = (q * 3 - TT * .9 + seed) % 1, y2 = ph < .08 ? Math.sin(ph / .08 * Math.PI) * .6 : (ph > .16 && ph < .22 ? -.25 : 0); const [a, b, d] = P(q * 1.8 - .9, y2); pts.push(a, b, d); }
      R.rib.line(pts, 2.2, 2.2, 0.4, 2.2, .7, .95 * f);
    }
    const [gx, gy, gz] = F.pt(u, v, 14); glow(gx, gy, gz, w * 1.1, c, .12 * f);
  }

  function dnaHolo(x, y0, z, col, r, h, seed) {
    const N = 20;
    for (let i = 0; i < N; i++) {
      const a = i * .62 + TT * 1.4 + seed, yy = y0 + i * h / N;
      for (let s2 = 0; s2 < 2; s2++) { const aa = a + s2 * Math.PI; orb(x + Math.cos(aa) * r, yy, z + Math.sin(aa) * r, 2.6, s2 ? [1.8, .5, 1.4] : col, 1.8, .9); }
      if (i % 2 === 0) R.rib.line([x + Math.cos(a) * r, yy, z + Math.sin(a) * r, x + Math.cos(a + Math.PI) * r, yy, z + Math.sin(a + Math.PI) * r], 1.2, 1.2, col[0], col[1], col[2], .55);
    }
    cyl(x, y0 - 4, z, r * 1.6, 4, r * 1.6, STEEL); R.decal(x, z, r * 5, col[0], col[1], col[2], .5, 9, TT * .5, TT * .2, true, y0 - .5); glow(x, y0 + h / 2, z, h * 1.2, col, .16);
  }

  // ---------------------------------------------------------------- vines
  function vine(x, top, z, len, seed, col) {
    const L = col || [.12, .5, .16], segs = 8; let px = x, py = top, pz = z;
    for (let i = 0; i < segs; i++) {
      const q = (i + 1) / segs, nx = x + Math.sin(TT * .9 + seed + i * .7) * 5 * q + Math.sin(seed * 3 + i) * 7 * q, nz = z + Math.cos(TT * .8 + seed + i * .6) * 5 * q, ny = top - len * q;
      R.rib.line([px, py, pz, nx, ny, nz], 3.2 * (1 - q * .6), 2.4 * (1 - q * .6), L[0], L[1], L[2], 1);
      if (i % 2 === 1) { const a = seed * 5 + i; R.draw(U.sphereLo, mm((px + nx) / 2 + Math.cos(a) * 4, (py + ny) / 2, (pz + nz) / 2 + Math.sin(a) * 4, a, 6, 2.2, 3.2, 0, .5), mat([L[0] * 1.2, L[1] * 1.6, L[2] * 1.2], { rough: .7, emissive: [L[0] * .3, L[1] * .9, L[2] * .3], emisK: 1, shadow: false })); }
      px = nx; py = ny; pz = nz;
    }
    orb(px, py, pz, 3, [.5, 2.2, .9], 1.8, .9); glow(px, py, pz, 34, [.4, 1.6, .7], .3 + .12 * Math.sin(TT * 2 + seed));
  }
  function climbVine(F, u, h, seed, col) {
    const L = col || [.12, .5, .16]; let p = F.pt(u, 0, 3);
    for (let i = 0; i < 9; i++) {
      const q = (i + 1) / 9, n = F.pt(u + Math.sin(seed * 2 + i * 1.1) * 14 + Math.sin(TT * .8 + i) * 2, h * q, 4 + Math.sin(i) * 2);
      R.rib.line([p[0], p[1], p[2], n[0], n[1], n[2]], 3, 2.4, L[0], L[1], L[2], 1);
      if (i % 2 === 0) { const side = i % 4 === 0 ? 1 : -1, lf = F.pt(u + side * 12, h * q, 6); R.draw(U.sphereLo, mm(lf[0], lf[1], lf[2], F.ry, 8, 2, 5, 0, side * .5), mat([L[0] * 1.2, L[1] * 1.6, L[2] * 1.2], { rough: .7, emissive: [L[0] * .3, L[1] * .9, L[2] * .3], emisK: 1, shadow: false })); }
      p = n;
    }
    glow(p[0], p[1], p[2], 40, [.4, 1.7, .7], .25);
  }

  // ---------------------------------------------------------------- lab props
  function bench(x, z, ry, seed, accent, broken) {
    const c = Math.cos(ry), s = Math.sin(ry), w = 70, d = 22;
    box(x, 22, z, w, 22, d, PANEL, { rough: .5, metal: .4 }, ry); box(x, 46, z, w + 3, 2.4, d + 3, [.55, .58, .62], { rough: .3, metal: .5 }, ry);
    gbox(x, 3, z, w - 4, 1, d - 4, accent, .8, .6, ry);
    for (let i = 0; i < 4; i++) {
      const lx = (i - 1.5) * 34, px = x + c * lx, pz = z - s * lx, k = hash(seed, i), col = [[.3, 1.7, .5], [1.8, .6, .3], [.4, .9, 2], [1.7, 1.5, .4]][(i + seed) & 3];
      if (k < .4) { cyl(px, 55, pz, 4, 7, 4, [.8, .85, .9], { rough: .1, alpha: .35, shadow: false }); cyl(px, 52, pz, 3.4, 4 + k * 5, 3.4, col, { emissive: col, emisK: 1, alpha: .8, shadow: false }); }
      else if (k < .7) { R.draw(U.sphereLo, mm(px, 56, pz, 0, 6, 6, 6), mat([.8, .85, .9], { rough: .1, alpha: .3, shadow: false })); cyl(px, 63, pz, 1.8, 5, 1.8, [.8, .85, .9], { alpha: .35, shadow: false }); orb(px, 55, pz, 4, col, 1.6, .8); }
      else { box(px, 54, pz, 6, 5, 4, DARK, { metal: .6 }, ry); cyl(px, 63, pz, 1.8, 6, 1.8, STEEL); gbox(px, 52, pz + 3, 3, 3, 1, [.3, 1.2, 1.6], 1.4, .8, ry); }
      if (broken && i === 1) { glow(px, 50, pz, 30, col, .5); R.decal(px, pz, 36, col[0], col[1], col[2], .55, 11, 0, 0, true, 47.5); }
    }
  }
  function tank(x, z, h, r, col, seed, broken) {
    cyl(x, 4, z, r + 3, 4, r + 3, STEEL, { rough: .4, metal: .6 }); cyl(x, h + 8, z, r + 3, 4, r + 3, STEEL, { rough: .4, metal: .6 });
    for (let k = 0; k < 4; k++) { const a = k * 1.57 + .8; cyl(x + Math.cos(a) * (r + 2), h / 2 + 8, z + Math.sin(a) * (r + 2), 1.6, h / 2 + 2, 1.6, STEEL); }
    if (!broken || hash(seed, 3) > .5) glass(x, h / 2 + 8, z, r, h / 2, r, col, .2);
    const lvl = broken ? .45 : .9; cyl(x, h * lvl / 2 + 8, z, r - 1, h * lvl / 2, r - 1, col, { emissive: [col[0] * 1.2, col[1] * 1.2, col[2] * 1.2], emisK: 1, alpha: .45, shadow: false });
    const by = 8 + h * .45 + Math.sin(TT * 1.1 + seed) * 8; orb(x + Math.sin(TT * .6 + seed) * 4, by, z, r * .45, [col[0] * 1.6, col[1] * 1.2, col[2] * 1.6], 1.2, .8); glow(x, by, z, r * 3, col, .22);
    for (let i = 0; i < 4; i++) { const lf = (TT * .4 + i * .25 + seed) % 1; orb(x + Math.sin(i * 2 + seed) * r * .5, 10 + lf * h * lvl, z + Math.cos(i * 2) * r * .5, 1.5, [1.6, 1.8, 2], 1.4, .6); }
    if (broken) { R.decal(x, z, r * 5, col[0], col[1], col[2], .5, 11, 0, 0, true, .8); glow(x + r, 14, z, 40, col, .3); }
  }
  function pod(x, z, ry, seed, lit) {
    box(x, 14, z, 22, 14, 52, [.22, .26, .32], { rough: .4, metal: .6 }, ry);
    R.draw(U.cyl, mm(x, 38, z, ry, 20, 48, 20, Math.PI / 2, 0), mat([.7, .9, 1.1], { rough: .1, emissive: [.2, .5, .7], emisK: 1, alpha: .3, shadow: false }));
    R.draw(U.sphereLo, mm(x, 36, z, ry, 10, 8, 30), mat(lit ? [.1, .12, .16] : [.05, .05, .06], { rough: .6 }));
    glow(x, 36, z, 80, [.5, 1.2, 1.7], lit ? .3 : .08); gbox(x + Math.cos(ry) * 0, 22, z, 2, 2, 52, lit ? [.3, 2, .6] : [2.2, .2, .2], 1.6, .9, ry);
    R.decal(x, z, 90, .8, 1.3, 1.6, .22, 11, 0, 0, true, 1.2);
  }
  function rack(x, z, ry, seed, h) {
    const H = h || 170; box(x, H / 2, z, 26, H / 2, 22, [.07, .07, .1], { rough: .4, metal: .7 }, ry);
    const c = Math.cos(ry), s = Math.sin(ry);
    for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) {
      const on = Math.sin(TT * (3 + (i + j) % 5) + seed * 7 + i * 1.3) > -.2, bad = hash(seed, i + j * 9) > .9, col = bad ? [2.2, .2, .2] : (j ? [.3, 1.8, .6] : [.4, .8, 2.2]);
      gbox(x + c * (j * 14 - 7) + s * 22.5, 14 + i * (H - 24) / 9, z - s * (j * 14 - 7) + c * 22.5, 2, 1.6, .7, col, on ? 2.4 : .2, .95, ry);
    }
  }
  function consoleDesk(x, z, ry, seed, col) {
    const c = Math.cos(ry), s = Math.sin(ry);
    box(x, 22, z, 46, 22, 18, PANEL, { rough: .5, metal: .4 }, ry);
    gbox(x, 48, z, 42, 1.4, 14, [.05, .06, .08], .3, 1, ry, -.5);
    for (let i = 0; i < 6; i++) { const on = Math.sin(TT * (2 + i * .7) + seed) > 0; gbox(x + c * (i - 2.5) * 12 - s * -8, 47, z - s * (i - 2.5) * 12 - c * -8, 2, 1.6, 2, i % 2 ? [.3, 1.8, .6] : (on ? [2.2, .5, .3] : [.5, .2, .2]), 2, .95, ry); }
    glow(x, 54, z, 70, col || [.4, 1.2, 1.8], .15);
  }
  function drum(x, z, seed, leak) {
    const col = [[1.6, 1.4, .2], [1.8, .4, .3], [.3, 1.6, .5]][seed % 3];
    cyl(x, 17, z, 11, 17, 11, [col[0] * .35, col[1] * .35, col[2] * .35], { rough: .6, metal: .3 }); R.draw(U.torus, mm(x, 17, z, 0, 11.4, 11.4, 11.4, Math.PI / 2, 0), mat(DARK)); gbox(x, 17, z, 11.8, 2.4, 11.8, [2, 1.9, .3], 1, 1);
    if (leak) { R.decal(x + 14, z + 10, 46, col[0], col[1], col[2], .6, 11, 0, 0, true, .9); glow(x + 14, 8, z + 10, 30, col, .28); }
  }
  function crate(x, z, w, h, d, ry, seed) {
    box(x, h / 2, z, w / 2, h / 2, d / 2, [.28, .24, .19], { rough: .9, metal: .1 }, ry);
    for (const sy of [-1, 1]) box(x, h / 2, z, w / 2 + .8, 1.6, d / 2 + .8, DARK, { metal: .6 }, ry, 0, 0);
    box(x, h / 2, z, 1.6, h / 2 + .8, d / 2 + .8, DARK, { metal: .6 }, ry);
  }
  function lamp(x, y, z, col, a, seed) {
    const f = flick(seed, TT);
    gbox(x, y, z, 26, 1.6, 7, [col[0], col[1], col[2]], 3 * f, .98); glow(x, y - 8, z, 120, col, a * f);
  }

  // ---------------------------------------------------------------- alarms
  function beacon(x, y, z, seed, on, col) {
    box(x, y + 2, z, 6, 2, 6, DARK);
    const c = col || [2.4, .25, .2];
    orb(x, y - 3, z, 6, c, on ? 3 : .35, .95);
    if (!on) return;
    const a = TT * 5 + seed;
    R.rib.line([x, y - 3, z, x + Math.cos(a) * 280, y - 40, z + Math.sin(a) * 280], 16, 3, c[0], c[1] * .5, c[2] * .5, .22);
    R.rib.line([x, y - 3, z, x - Math.cos(a) * 280, y - 40, z - Math.sin(a) * 280], 16, 3, c[0], c[1] * .5, c[2] * .5, .22);
    glow(x, y - 4, z, 110, c, .45 * (.55 + .45 * Math.sin(TT * 10 + seed)));
  }

  // ---------------------------------------------------------------- environment
  const inside = (x, z) => {
    for (const r of CB.ROOMS) if (x > r.x + T && x < r.x + r.w - T && z > r.y + T && z < r.y + r.h - T) return true;
    for (const c of CB.LAYOUT.corridors) if (x > c.x && x < c.x + c.w && z > c.y && z < c.y + c.h) return true;
    return false;
  };
  const nearestRoom = (x, z) => { let b = CB.ROOMS[0], bd = 1e12; CB.ROOMS.forEach((r) => { const d = (r.cx - x) ** 2 + (r.cy - z) ** 2; if (d < bd) { bd = d; b = r; } }); return b; };
  const lockdown = (i) => { const rs = S.rooms[i]; return !!(rs && rs.spawned && !rs.cleared); };

  function drawWall(w, wi) {
    const cx = w.x + w.w / 2, cz = w.y + w.h / 2, horiz = w.w >= w.h, len = horiz ? w.w : w.h;
    if (Math.hypot(cx - me.x, cz - me.y) > 2600) return;
    const room = nearestRoom(cx, cz), ac = accentOf[room.i], lk = lockdown(room.i);
    // the wall itself — solid from floor to ceiling, so nothing can be seen through it
    box(cx, WH / 2 + 4, cz, w.w / 2, WH / 2 + 4, w.h / 2, [.12, .13, .17], { rough: .6, metal: .35 });
    // normal into the playable side
    let nx = 0, nz = 0; const th = horiz ? w.h : w.w;
    const cands = horiz ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
    for (const q of cands) if (inside(cx + q[0] * (th / 2 + 24), cz + q[1] * (th / 2 + 24))) { nx = q[0]; nz = q[1]; break; }
    // top trim (accent, pulsing red in lockdown)
    const tr = lk ? [2.4, .25, .2] : ac, tk = lk ? 1.4 + .8 * Math.sin(TT * 6) : 1.4;
    box(cx, WH + 6, cz, w.w / 2 + 1, 2, w.h / 2 + 1, tr, { emissive: [tr[0] * tk, tr[1] * tk, tr[2] * tk], emisK: 1, shadow: false });
    if (!nx && !nz) return;
    if (Math.hypot(cx - me.x, cz - me.y) > 1300) return;
    const F = frame(cx + nx * (th / 2), cz + nz * (th / 2), nx, nz);
    // dado (darker lower band) + hazard stripe skirting
    const dc = F.pt(0, 25, 1.5); box(dc[0], 25, dc[2], horiz ? len / 2 : 1.6, 25, horiz ? 1.6 : len / 2, [.07, .08, .1], { rough: .5, metal: .6 });
    const nS = Math.floor(len / 24);
    for (let k = 0; k < nS; k += 2) { const p = F.pt(-len / 2 + (k + .5) * len / nS, 4, 2.6); box(p[0], 4, p[2], horiz ? len / nS / 2 : 1.4, 2.4, horiz ? 1.4 : len / nS / 2, [.9, .75, .08], { rough: .6 }); }
    const segs = Math.max(1, Math.floor(len / 150)), sl = len / segs;
    for (let k = 0; k < segs; k++) {
      const u = -len / 2 + (k + .5) * sl, seed = wi * 31 + k, r = hash(wi, k + 5), isCorr = Math.hypot(room.cx - cx, room.cy - cz) > 520 || !(cx > room.x && cx < room.x + room.w && cz > room.y && cz < room.y + room.h);
      const bioish = room.id === 'bio' || room.id === 'vault' || room.id === 'anomaly';
      const near = Math.hypot(cx + F.tx * u - me.x, cz + F.tz * u - me.y) < 900;
      if (!near) continue;
      if (r < .22) screen(F, u, 120, 76, 46, ['graph', 'bars', 'radar', 'text', 'ecg'][(seed * 7) % 5], seed, isCorr ? [1.6, .8, .3] : [ac[0] * 1.4, ac[1] * 1.4, ac[2] * 1.4]);
      else if (r < .36) {                                                              // pipe run with a valve wheel and a weeping joint
        for (const v of [46, 200]) { const a2 = F.pt(0, v, 8); R.draw(U.cyl, mm(a2[0], a2[1], a2[2], 0, 4.5, sl * .52, 4.5, horiz ? 0 : Math.PI / 2, horiz ? Math.PI / 2 : 0), mat([.3, .32, .36], { rough: .4, metal: .8 })); }
        const vv = F.pt(u, 120, 10); R.draw(U.torus, mm(vv[0], vv[1], vv[2], F.ry, 9, 9, 9, 0, 0), mat([1.6, .3, .2], { rough: .5, emissive: [.6, .1, .08], emisK: 1, shadow: false }));
        const lk2 = F.pt(u + 30, 190, 12); if (Math.sin(TT * 3 + seed) > -.3) { glow(lk2[0], lk2[1], lk2[2], 26, [1.4, 1.4, 1.5], .3); for (let q = 0; q < 3; q++) { const lf = (TT * .8 + q * .33) % 1; glow(lk2[0] + F.nx * lf * 10, lk2[1] + lf * 24, lk2[2] + F.nz * lf * 10, 14 + lf * 20, [1.3, 1.3, 1.4], (1 - lf) * .22); } }
      } else if (r < .5) {                                                              // observation window onto the dark lab
        const p = F.pt(u, 130, 3); box(p[0], p[1], p[2], 58, 36, 3, DARK, { rough: .4, metal: .7 }, F.ry); gbox(...F.pt(u, 130, 5), 52, 31, .6, [.3, .6, .9], .9 + .3 * flick(seed, TT), .85, F.ry);
        for (let q = 0; q < 3; q++) { const s2 = F.pt(u - 30 + q * 30, 112 + (q % 2) * 6, 6.4); box(s2[0], s2[1], s2[2], 4, 22 - q * 3, .6, [.02, .02, .03], {}, F.ry); }
      } else if (r < .6) {                                                              // hazard sign + red lamp
        const p = F.pt(u, 130, 3); for (let q = 0; q < 6; q++) box(...F.pt(u - 36 + q * 14.4, 130, 3.4), 7.2, 20, .6, q % 2 ? [.05, .05, .05] : [.95, .8, .1], { rough: .6 }, F.ry);
        gbox(...F.pt(u, 130, 4), 12, 12, .5, [2, .3, .2], 1.6 * flick(seed, TT), 1, F.ry); glow(...F.pt(u, 130, 20), 60, [2, .3, .2], .24 * flick(seed, TT));
      } else if (r < .68) {                                                             // cable bundle + junction box (sparking)
        const p = F.pt(u, 90, 8); box(p[0], p[1], p[2], 18, 24, 6, [.12, .12, .14], { metal: .6 }, F.ry);
        for (let q = 0; q < 4; q++) { const a = F.pt(u - 15 + q * 10, 200, 6), b = F.pt(u - 15 + q * 10 + Math.sin(seed + q) * 8, 114, 8); R.rib.line([a[0], a[1], a[2], b[0], b[1], b[2]], 2.4, 2.4, .05, .05, .06, 1); }
        if (Math.sin(TT * 5 + seed * 3) > .9) { const s2 = F.pt(u, 108, 12); glow(s2[0], s2[1], s2[2], 54, [1.8, 1.7, 1.4], .7); for (let q = 0; q < 4; q++) { const lf = (TT * 3 + q * .25) % 1; glow(s2[0] + F.tx * (q - 1.5) * 8, s2[1] - lf * 40, s2[2], 5, [2, 1.7, 1], (1 - lf) * .8); } }
      } else if (r < .76) {                                                             // locker
        const p = F.pt(u, 76, 12); box(p[0], p[1], p[2], 28, 76, 10, [.2, .24, .3], { rough: .5, metal: .5 }, F.ry); box(...F.pt(u, 76, 22.5), .8, 70, .5, DARK, {}, F.ry);
        gbox(...F.pt(u + 18, 100, 23), 1.6, 1.6, .5, hash(seed, 2) > .5 ? [.3, 2, .6] : [2.2, .3, .2], 2, 1, F.ry);
      } else if (r < .86 && bioish) climbVine(F, u, 150 + hash(seed, 3) * 80, seed);
      else if (r < .93) {                                                               // emergency lamp
        const p = F.pt(u, 190, 6); box(p[0], p[1], p[2], 6, 5, 4, DARK, {}, F.ry); gbox(...F.pt(u, 190, 10), 5, 3.4, 2, [2.2, .3, .2], lk ? 3 * (.5 + .5 * Math.sin(TT * 9 + seed)) : .3, 1, F.ry); if (lk) glow(...F.pt(u, 186, 18), 120, [2.2, .3, .2], .35 * (.5 + .5 * Math.sin(TT * 9 + seed)));
      }
    }
  }

  function drawDoor(d, i) {
    const rc = d.rect, cx = rc.x + rc.w / 2, cz = rc.y + rc.h / 2;
    if (Math.hypot(cx - me.x, cz - me.y) > 1700) return;
    const horiz = rc.w > rc.h, st = doorAnim[i] || (doorAnim[i] = { o: d.open ? 1 : 0, t: TT });
    const dt = Math.min(.1, TT - st.t); st.t = TT; st.o += ((d.open ? 1 : 0) - st.o) * Math.min(1, dt * 3.2);
    const half = (horiz ? rc.w : rc.h) / 2, slide = st.o * (half - 6);
    const col = d.open ? [.3, 1.8, .8] : [2.3, .25, .2], pulse = d.open ? 1 : .6 + .4 * Math.sin(TT * 7 + i);
    // frame
    const fw = horiz ? rc.w + 14 : T + 6, fh = horiz ? T + 6 : rc.h + 14;
    box(cx, WH / 2 + 4, cz, horiz ? fw / 2 : (T + 8) / 2, WH / 2 + 4, horiz ? (T + 8) / 2 : fh / 2, [.1, .11, .14], { metal: .6 });       // header wall above the door
    box(cx, 100, cz, horiz ? rc.w / 2 + 8 : T / 2 + 3, 104, horiz ? T / 2 + 3 : rc.h / 2 + 8, [.15, .16, .2], { metal: .7 });
    for (const sgn of [-1, 1]) {
      const off = sgn * (half / 2 + slide), hx = horiz ? half / 2 : T / 2 - 4, hz = horiz ? T / 2 - 4 : half / 2;
      const px = cx + (horiz ? off : 0), pz = cz + (horiz ? 0 : off);
      box(px, 96, pz, hx, 96, hz, [.2, .22, .27], { rough: .45, metal: .75 });
      const n = 6; for (let k = 0; k < n; k++) { const f = (k + .5) / n, ax = horiz ? px - hx + f * hx * 2 : px, az = horiz ? pz : pz - hz + f * hz * 2; box(ax, 34, az, horiz ? hx / n * .9 : T / 2 - 3.4, 8, horiz ? T / 2 - 3.4 : hz / n * .9, k % 2 ? [.05, .05, .05] : [.95, .78, .1], { rough: .6 }); }
      box(px, 190, pz, hx, 6, hz, [.95, .78, .1], { rough: .6 });
    }
    gbox(cx, 205, cz, horiz ? 28 : 3, 3, horiz ? 3 : 28, col, 2.4 * pulse, .98);
    if (!d.open) {
      R.light(cx, cz, 170, 360, 2.2, .3, .25, .5 * pulse); glow(cx, 150, cz, 180, [2.2, .3, .25], .25 * pulse);
      box(cx, 150, cz + (horiz ? 0 : 0), horiz ? 4 : 22, 6, horiz ? 22 : 4, DARK, {}, 0);
    } else { glow(cx, 100, cz, 150, [.3, 1.6, .8], .2); }
    beacon(cx - (horiz ? 40 : 0), 232, cz - (horiz ? 0 : 40), i * 3, !d.open);
  }

  function ceilingRect(x, z, w, d, sideOpen, seed, ac, lk, i, isCorr) {
    if (!FP) return;
    const cx = x + w / 2, cz = z + d / 2;
    box(cx, WH + 5, cz, w / 2, 5, d / 2, [.09, .1, .13], { rough: .7, metal: .4 });
    const nx = Math.max(1, Math.floor(w / (isCorr ? 150 : 150))), nz = Math.max(1, Math.floor(d / (isCorr ? 150 : 150)));
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      const px = x + (a + .5) * w / nx, pz = z + (b + .5) * d / nz, sd = seed * 11 + a * 7 + b, broken = hash(sd, 3) > .78;
      if (isCorr && (a + b) % 2) continue;
      if (broken) {                                                          // dead tile hanging open, sparking
        box(px, WH + 1, pz, 24, 1.4, 24, [.03, .03, .04], {}, 0, .22, .1);
        if (Math.sin(TT * 4 + sd) > .82) { glow(px, WH - 6, pz, 90, [1.9, 1.7, 1.3], .8); for (let q = 0; q < 5; q++) { const lf = (TT * 2.5 + q * .2 + sd) % 1; glow(px + Math.sin(q * 3 + sd) * 14, WH - lf * 160, pz + Math.cos(q * 2) * 14, 4.5, [2, 1.7, 1], (1 - lf) * .9); } }
        const cabl = (px + pz) % 3; R.rib.line([px, WH, pz, px + 4, WH - 30 - cabl * 6, pz + 3, px + 9, WH - 52 - cabl * 8, pz - 4], 2.4, 1.6, .03, .03, .04, 1);
      } else {
        const f = flick(sd, TT) * (lk ? (.55 + .45 * Math.sin(TT * 6 + sd)) : 1), c = lk ? [2.2, .35, .25] : (isCorr ? [1.6, 1.7, 1.8] : [1.8, 1.9, 2]);
        gbox(px, WH - 1, pz, 28, 1.6, 6, c, 3 * f, .98); box(px, WH - 1, pz, 30, 1, 8, DARK, {});
        glow(px, WH - 16, pz, 150, c, .15 * f);
      }
    }
    // ducts and cable trays along the edges
    box(cx, WH - 14, z + 16, w / 2 - 6, 8, 9, [.16, .17, .2], { rough: .5, metal: .6 }); box(cx, WH - 12, z + d - 16, w / 2 - 6, 5, 12, [.12, .13, .16], { rough: .5, metal: .6 });
  }

  function drawCorridor(c, i) {
    const cx = c.x + c.w / 2, cz = c.y + c.h / 2, horiz = c.w > c.h;
    if (Math.hypot(cx - me.x, cz - me.y) > 2000) return;
    const lk = lockdown(i) || lockdown(i + 1), ac = accentOf[i];
    box(cx, -4, cz, c.w / 2, 4, c.h / 2, [.13, .14, .18], { rough: .45, metal: .4 });
    box(cx, .7, cz, horiz ? c.w / 2 : 6, .6, horiz ? 6 : c.h / 2, [.05, .05, .06], {}); gbox(cx, 1.2, cz, horiz ? c.w / 2 : .8, .4, horiz ? .8 : c.h / 2, ac, 1.2, .7);
    ceilingRect(c.x, c.y, c.w, c.h, null, i + 40, ac, lk, i, true);
    // chevron guidance lights pointing toward the next room, running in sequence
    const len = horiz ? c.w : c.h, n = Math.floor(len / 46), dir = (CB.LAYOUT.doors[i].to > CB.LAYOUT.doors[i].from ? 1 : 1);
    for (let k = 0; k < n; k++) {
      const u = (k + .5) / n, ph = (TT * 2 - u * 3) % 1, a = Math.max(0, 1 - ph * 2.2) * (lk ? 1.4 : 1);
      const x = horiz ? c.x + (c.x < CB.ROOMS[i].x ? 0 : 0) + u * len : cx, z = horiz ? cz : c.y + u * len;
      glow(x, 3, z + (horiz ? -26 : 0), 22, lk ? [2.2, .5, .2] : ac, .12 + a * .4); glow(x, 3, z + (horiz ? 26 : 0), 22, lk ? [2.2, .5, .2] : ac, .12 + a * .4);
    }
    // vents, floor grates and debris
    for (let k = 0; k < Math.floor(len / 140); k++) { const u = (k + .5) / Math.floor(len / 140), x = horiz ? c.x + u * len : cx, z = horiz ? cz : c.y + u * len; if (hash(i * 9, k) > .5) { box(x, 1.4, z, 24, .6, 24, [.03, .03, .04], {}); for (let q = -1; q <= 1; q++) gbox(x + q * 7, 1.9, z, 2, .3, 22, [.5, .2, .1], .5 + .5 * Math.sin(TT + k), .8); } if (hash(i * 5, k) > .75) { box(x + 14, 3, z - 10, 14, 1.2, 9, [.7, .68, .6], {}, k, .1, .05); box(x - 20, 8, z + 16, 8, 8, 7, [.25, .22, .18], {}, k * 2); } }
    // wall-mounted display down the length of the corridor, plus a vine through a broken ceiling tile in some
    if (hash(i, 77) > .4 && FP) vine(horiz ? c.x + len * (.35 + hash(i, 2) * .3) : cx, WH, horiz ? cz : c.y + len * (.35 + hash(i, 2) * .3), 120 + hash(i, 9) * 70, i + 11);
    if (lk) for (let k = 0; k < 3; k++) beacon(horiz ? c.x + (k + .5) * len / 3 : cx, WH - 8, horiz ? cz : c.y + (k + .5) * len / 3, i + k, true, [2.4, .8, .2]);
    R.light(cx, cz, 120, 320, lk ? 2.2 : ac[0] * 1.2, lk ? .35 : ac[1] * 1.2, lk ? .25 : ac[2] * 1.2, lk ? .6 * (.5 + .5 * Math.sin(TT * 6)) : .5);
  }

  // ---------------------------------------------------------------- rooms
  function drawRoom(r) {
    const i = r.i, rs = S.rooms[i], lk = lockdown(i), ac = accentOf[i], base = ({ intake: [.5, .55, .62], chem: [.17, .24, .13], cryo: [.3, .45, .58], bio: [.1, .26, .17], reactor: [.26, .12, .07], server: [.12, .09, .22], vault: [.2, .06, .08], anomaly: [.08, .02, .12] })[r.id];
    const I = { x: r.x + T, z: r.y + T, w: r.w - 2 * T, h: r.h - 2 * T }, P = (fx, fz) => [I.x + fx * I.w, I.z + fz * I.h];
    // floor: slab, tiles, hazard-striped margin, stains
    box(r.cx, -6, r.cy, r.w / 2, 6, r.h / 2, base, { rough: r.id === 'intake' || r.id === 'cryo' ? .3 : .6, metal: .05, emissive: [base[0] * .35, base[1] * .35, base[2] * .35], emisK: 1 });
    for (let k = 1; k < 8; k++) { gbox(I.x + I.w * k / 8, .7, r.cy, .7, .4, I.h / 2, ac, .45, .4); gbox(r.cx, .7, I.z + I.h * k / 8, I.w / 2, .4, .7, ac, .45, .4); }
    for (let k = 0; k < Math.floor(I.w / 40); k++) { const col = k % 2 ? [.05, .05, .05] : [.9, .75, .08]; box(I.x + 20 + k * 40, .9, I.z + 5, 20, .3, 4, col, {}); box(I.x + 20 + k * 40, .9, I.z + I.h - 5, 20, .3, 4, col, {}); }
    for (let k = 0; k < 5; k++) R.decal(I.x + hash(i, k) * I.w, I.z + hash(i, k + 9) * I.h, 50 + hash(i, k + 3) * 90, .05, .05, .06, .45, 11, 0, 0, false, 1.1);
    ceilingRect(r.x + T, r.y + T, r.w - 2 * T, r.h - 2 * T, null, i, ac, lk, i, false);
    // room light + lockdown strobe
    const pulse = lk ? (.5 + .5 * Math.sin(TT * 6)) : 0;
    R.light(r.cx, r.cy, 170, Math.max(r.w, r.h) * 1.15, lk ? 1.6 + pulse * 1.2 : ac[0] * 1.2, lk ? .3 : ac[1] * 1.2, lk ? .25 : ac[2] * 1.2, lk ? .8 : .55);
    if (lk) { for (const [fx, fz] of [[.04, .04], [.96, .04], [.04, .96], [.96, .96]]) { const p = P(fx, fz); beacon(p[0], WH - 10, p[1], i + fx * 5 + fz, true); } }
    (ROOMPROPS[r.id] || (() => {}))(r, I, P, ac, lk);
    // stray papers & a toppled chair for a place that was left in a hurry
    for (let k = 0; k < 6; k++) { const p = P(.08 + hash(i, 40 + k) * .84, .08 + hash(i, 50 + k) * .84); box(p[0], 1.5, p[1], 7, .4, 5, [.8, .78, .7], {}, k * 1.3); }
  }

  // each room's own science and wreckage
  const ROOMPROPS = {
    intake(r, I, P, ac) {
      let p = P(.5, .06); box(p[0], 22, p[1] + 14, 130, 22, 20, PANEL, { rough: .4, metal: .5 }); gbox(p[0], 47, p[1] + 14, 132, 1.6, 22, ac, 1.4, .9);
      dnaHolo(p[0], 56, p[1] + 14, [.5, 1.4, 2.2], 14, 70, 1);
      for (let k = 0; k < 3; k++) for (let m = 0; m < 2; m++) { const q = P(.2 + k * .3, .03); screen(frame(q[0], I.z + 4, 0, 1), 0, 150 + m * 52, 70, 44, ['graph', 'bars', 'ecg', 'radar', 'text'][(k + m * 2) % 5], 100 + k + m * 3, [.4, 1.2, 1.8]); }
      for (let k = 0; k < 3; k++) { const q = P(.18 + k * .32, .86); R.draw(U.box, mm(q[0], 14, q[1], k * .3, 40, 14, 13), mat([.2, .22, .3], { rough: .6 })); box(q[0], 31, q[1] - 8, 40, 3, 4, [.1, .1, .14], {}, k * .3); }
      for (const sgn of [-1, 1]) { const q = P(.5 + sgn * .16, .5); box(q[0], 60, q[1], 3, 60, 3, STEEL); } { const q = P(.5, .5); gbox(q[0], 100, q[1], 80, 1.2, 1, [.3, 1.9, .9], 1.6, .55); }   // ID-scanner arch
      drum(...P(.9, .1), 0, true);
    },
    chem(r, I, P, ac, lk) {
      bench(...P(.2, .5), 0, 1, [.3, 1.8, .5], false); bench(...P(.5, .78), 0, 2, [.3, 1.8, .5], true); bench(...P(.84, .46), 1.57, 3, [.3, 1.8, .5], false);
      tank(...P(.9, .88), 70, 18, [.3, 1.6, .5], 4, true); tank(...P(.1, .9), 80, 14, [.9, 1.7, .3], 5, false); drum(...P(.12, .14), 1, true); drum(...P(.2, .1), 2, false);
      for (let k = 0; k < 6; k++) for (let m = 0; m < 4; m++) { const q = P(.1 + k * .15, .02); const c = [[1.8, .3, .3], [.4, 1.7, .5], [.3, .6, 2.2], [1.8, 1.6, .3], [1.5, .5, 1.8], [.9, .9, .9]][(k * 3 + m * 5) % 6]; gbox(q[0], 80 + m * 18, I.z + 5, 12, 7, .8, c, 1.1, .85); }                       // the periodic table wall
      const hf = P(.62, .1); box(hf[0], 70, hf[1], 40, 70, 18, [.25, .28, .32], { metal: .5 }); glass(hf[0], 78, hf[1] + 12, 36, 38, 2, [.6, .9, 1.2], .2); glow(hf[0], 60, hf[1], 90, [.4, 1.4, .6], .2);
      { const dp = P(.5, .5); dnaHolo(dp[0], 60, dp[1], [.4, 1.7, .6], 12, 60, 3); }
    },
    cryo(r, I, P, ac) {
      for (let k = 0; k < 4; k++) { pod(...P(.08, .2 + k * .2), 0, k, k !== 2); pod(...P(.92, .2 + k * .2), 0, k + 9, k !== 1); }
      for (let k = 0; k < 3; k++) tank(...P(.3 + k * .2, .93), 64, 16, [.5, 1.3, 1.9], 20 + k, k === 1);
      consoleDesk(...P(.5, .5), 0, 5, [.4, 1.4, 2]); screen(frame(...P(.5, .06), 0, 1), 0, 130, 120, 60, 'ecg', 31, [.4, 2, .7]); screen(frame(...P(.5, .06), 0, 1), 110, 130, 90, 60, 'graph', 32, [.4, 1.4, 2.2]);
      for (let k = 0; k < 9; k++) { const q = P(.15 + hash(5, k) * .7, .15 + hash(6, k) * .7), h2 = 20 + hash(7, k) * 40; R.draw(U.cone, mm(q[0], h2 / 2, q[1], hash(8, k) * 3, 5 + hash(9, k) * 6, h2 / 2, 5 + hash(9, k) * 6), mat([.6, 1.1, 1.5], { rough: .1, emissive: [.2, .5, .8], emisK: 1, alpha: .75, shadow: false })); }
    },
    bio(r, I, P, ac) {
      for (let k = 0; k < 3; k++) { tank(...P(.15 + k * .3, .14), 90, 20, [.3, 1.9, .8], 40 + k, k === 1); }
      for (let k = 0; k < 3; k++) { const q = P(.2 + k * .28, .86); box(q[0], 10, q[1], 44, 10, 18, [.2, .14, .1], { rough: .9 }); for (let m = 0; m < 5; m++) { orb(q[0] + (m - 2) * 16, 24 + hash(k, m) * 12, q[1], 6, [.4, 2, .9], 1.6, .85); glow(q[0] + (m - 2) * 16, 26, q[1], 30, [.4, 1.7, .8], .22); } }
      for (let k = 0; k < 9; k++) { const q = P(.1 + hash(11, k) * .8, .1 + hash(12, k) * .8); if (FP) vine(q[0], WH, q[1], 110 + hash(13, k) * 110, k * 7 + 3); else orb(q[0], 20, q[1], 5, [.4, 2, .9], 1.5, .8); }
      for (let k = 0; k < 10; k++) { const q = P(.08 + hash(21, k) * .84, .08 + hash(22, k) * .84); R.decal(q[0], q[1], 60 + hash(23, k) * 70, .1, .5, .15, .5, 11, 0, 0, false, 1); R.draw(U.cone, mm(q[0], 7, q[1], k, 3, 9, 3), mat([.1, .55, .2], { rough: .8, emissive: [.04, .3, .1], emisK: 1, shadow: false })); }
      { const dp = P(.5, .5); dnaHolo(dp[0], 40, dp[1], [.4, 2, .9], 14, 80, 5); }
    },
    reactor(r, I, P, ac, lk) {
      const c = P(.5, .5), f = .75 + .25 * Math.sin(TT * 3);
      cyl(c[0], 6, c[1], 64, 6, 64, [.18, .1, .08], { rough: .4, metal: .7 }); cyl(c[0], 100, c[1], 40, 100, 40, [.16, .09, .08], { rough: .4, metal: .8 });
      R.draw(U.cyl, mm(c[0], 104, c[1], 0, 28, 94, 28), mat([1.6, .6, .2], { emissive: [2.4, .9, .25], emisK: 1, alpha: .55 * f, shadow: false }));
      for (let k = 0; k < 4; k++) R.decal(c[0], c[1], 150 + k * 60, 1.9, .8, .25, .4, 9, TT * (k + 1) * .3, TT * (k % 2 ? -.4 : .5), true, 30 + k * 50);
      R.glow(c[0], 100, c[1], 380, 1.6, .7, .2, .35 * f, 0); R.light(c[0], c[1], 90, 700, 1.8, .8, .25, .9);
      for (let k = 0; k < 24; k++) { const a = k / 24 * TAU + TT * .3, lf = (TT * .5 + k * .13) % 1; glow(c[0] + Math.cos(a) * 60 * (1 + lf), 20 + lf * 200, c[1] + Math.sin(a) * 60 * (1 + lf), 12, [2, .9, .3], (1 - lf) * .8); }
      for (let k = 0; k < 4; k++) { const a = k * 1.57 + .78, q = [c[0] + Math.cos(a) * 130, c[1] + Math.sin(a) * 130]; cyl(q[0], WH / 2, q[1], 5, WH / 2, 5, [.3, .32, .36], { metal: .8 }); }                                   // coolant lines into the ceiling
      for (let k = 0; k < 4; k++) consoleDesk(...P(.15 + k * .23, .94), 0, 60 + k, [2, .8, .3]);
      screen(frame(...P(.5, .04), 0, 1), 0, 140, 140, 70, 'graph', 61, [2, .9, .3]); screen(frame(...P(.5, .04), 0, 1), 120, 140, 80, 70, 'alert', 62, [2.2, .3, .25]);
    },
    server(r, I, P, ac) {
      for (let row = 0; row < 2; row++) for (let k = 0; k < 6; k++) { const q = P(.1 + k * .16, row ? .18 : .84); if (k !== 1 && k !== 3) rack(q[0], q[1], 0, row * 9 + k, 170); }
      const w = frame(...P(.5, .03), 0, 1); for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) screen(w, (a - 1) * 150, 110 + b * 70, 140, 64, ['graph', 'bars', 'radar', 'text', 'ecg', 'graph'][a + b * 3], 70 + a * 5 + b, [.6, .5, 2.2]);
      for (let k = 0; k < 3; k++) { const z = I.z + I.h * (.38 + k * .12) + Math.sin(TT * 1.2 + k * 2) * 40; R.draw(U.box, mm(r.cx, 40, z, 0, I.w / 2 - 40, 1.4, 1.6), mat([2, .3, .5], { emissive: [2.6, .3, .6], alpha: .5, shadow: false })); }
      for (let k = 0; k < 8; k++) { const q = P(.1 + k * .1, .5); box(q[0], 3, q[1], 4, 2, 140, [.05, .05, .06], {}); gbox(q[0], 5.5, q[1] + Math.sin(TT * 2 + k) * 90, 3, 1, 5, [.6, .6, 2.4], 2, .9); }
    },
    vault(r, I, P, ac, lk) {
      for (let k = 0; k < 5; k++) { const q = P(.1 + k * .2, .1); box(q[0], 60, q[1], 30, 60, 22, [.1, .08, .09], { rough: .5, metal: .5 }); const lit = Math.sin(TT * 1.7 + k * 2) > .1; gbox(q[0], 62, q[1] + 23, 22, 40, .8, [2, .15, .25], lit ? 1.4 : .25, .5); glow(q[0], 60, q[1] + 30, 110, [2, .2, .25], lit ? .3 : .06); for (let b = 0; b < 5; b++) box(q[0] + (b - 2) * 9, 60, q[1] + 24, .9, 56, .6, [.4, .36, .38], { metal: .8 }); if (k % 2) { R.draw(U.cone, mm(q[0] - 20, 28, q[1] + 36, 0, 24, 28, 3, 1.1, .2), mat([.9, .9, 1], { rough: .1, alpha: .3, shadow: false })); R.decal(q[0] - 14, q[1] + 40, 46, 1, .8, .9, .3, 11, 0, 0, true, 1.2); } }
      for (let k = 0; k < 4; k++) { const q = P(.15 + k * .25, .93); crate(q[0], q[1], 44, 30 + (k % 2) * 16, 34, k * .3, k); }
      for (let k = 0; k < 5; k++) { const q = P(.1 + hash(31, k) * .8, .3 + hash(32, k) * .5); R.decal(q[0], q[1], 60 + hash(33, k) * 70, .55, .02, .04, .6, 11, 0, 0, false, 1.1); }
      for (let k = 0; k < 4; k++) { const q = P(.2 + k * .2, .5), pts = []; for (let m = 0; m < 6; m++) pts.push(q[0] + Math.sin(TT * .8 + k + m) * 3, WH - m * 24, q[1]); R.rib.line(pts, 2.4, 2.4, .3, .28, .3, 1); }                            // dangling chains
      if (FP) for (let k = 0; k < 4; k++) { const q = P(.2 + k * .2, .6); vine(q[0], WH, q[1], 100 + hash(41, k) * 70, k + 70, [.2, .4, .15]); }
    },
    anomaly(r, I, P, ac, lk) {
      const c = [r.cx, r.cy]; const t = TT;
      R.draw(U.sphere, mm(c[0], 120 + Math.sin(t * 1.2) * 10, c[1], t * .3, 46, 46, 46), mat([.02, 0, .04], { emissive: [1.2, .2, 1.4], emisK: 1, shadow: false }));
      for (let k = 0; k < 3; k++) R.decal(c[0], c[1], 260 + k * 120, 1.6, .3, 1.8, .4 - k * .08, 9, t * (k + 1) * .3, t * (k % 2 ? -.3 : .4), true, 3 + k);
      R.glow(c[0], 120, c[1], 460, 1.4, .2, 1.6, .26, 0); R.light(c[0], c[1], 140, 900, 1.4, .25, 1.6, .9);
      for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + t * .1; for (let m = 0; m < 3; m++) R.decal(c[0] + Math.cos(a) * (100 + m * 70), c[1] + Math.sin(a) * (100 + m * 70), 30 + m * 14, 1.8, .2, 1.8, .6, 10, 0, a, true, 1.6); }
      for (let k = 0; k < 10; k++) { const a = hash(5, k) * TAU, rr = 130 + hash(6, k) * 220, y = 40 + hash(7, k) * 160 + Math.sin(t + k) * 12; R.draw(U.box, mm(c[0] + Math.cos(a + t * .08) * rr, y, c[1] + Math.sin(a + t * .08) * rr, t * .4 + k, 10 + hash(8, k) * 14, 3, 8 + hash(9, k) * 10, t * .3, k), mat([.2, .2, .26], { rough: .6, metal: .4 })); }
      for (let k = 0; k < 3; k++) { const q = P(.2 + k * .3, .07), tilt = (k - 1) * .3; box(q[0], 30, q[1], 46, 26, 18, PANEL, { rough: .5 }, tilt, 0, tilt * .5); glow(q[0], 50, q[1], 80, [1.6, .3, 1.8], .3 * flick(k + 4, TT)); }
      if (FP) for (let k = 0; k < 7; k++) { const a = k * TAU / 7; const pts = []; for (let m = 0; m <= 7; m++) pts.push(c[0] + Math.cos(a) * (60 + m * 20) + Math.sin(t * 2 + m) * 8, WH - m * 28, c[1] + Math.sin(a) * (60 + m * 20)); R.rib.line(pts, 12, 2, 1.4, .2, 1.6, .7); }
    },
  };

  // ---------------------------------------------------------------- platforms
  function drawPlatform(p) {
    if (Math.hypot(p.x + p.w / 2 - me.x, p.y + p.h / 2 - me.y) > 1500) return;
    const cx = p.x + p.w / 2, cz = p.y + p.h / 2, hw = p.w / 2, hh = p.h / 2, z = p.z, ac = accentOf[p.room], pul = .6 + .4 * Math.sin(TT * 3 + p.id);
    R.decal(cx, cz, Math.max(p.w, p.h) * 1.5, 0, 0, 0, .5, 11, 0, 0, false, 1.2);
    const edge = (col) => { for (const [ex, ez, w2, h2] of [[cx, p.y, hw, 1.4], [cx, p.y + p.h, hw, 1.4], [p.x, cz, 1.4, hh], [p.x + p.w, cz, 1.4, hh]]) gbox(ex, z - 3, ez, w2 + 1, 1.2, h2 + 1, col, 1.8 * pul, .95); };
    const stripes = () => { for (let k = 0; k < Math.floor(p.w / 14); k++) if (k % 2) box(p.x + 7 + k * 14, z + .3, p.y + 3, 7, .4, 2.6, [.05, .05, .05], {}); else box(p.x + 7 + k * 14, z + .3, p.y + 3, 7, .4, 2.6, [.95, .78, .1], {}); };
    switch (p.kind) {
      case 'desk': case 'bench': {
        box(cx, (z - 6) / 2, cz, hw - 4, (z - 6) / 2, hh - 4, PANEL, { rough: .5, metal: .4 }); box(cx, z - 3, cz, hw, 3, hh, [.55, .58, .62], { rough: .3, metal: .5 }); edge(ac); stripes();
        if (p.kind === 'bench') { for (let k = 0; k < 3; k++) { const col = [[.3, 1.7, .5], [1.8, .6, .3], [.4, .9, 2]][k]; cyl(p.x + 22 + k * 38, z + 8, cz, 4, 8, 4, col, { emissive: col, emisK: 1, alpha: .75, shadow: false }); glow(p.x + 22 + k * 38, z + 8, cz, 30, col, .25); } }
        else { box(cx, z + 14, p.y + 12, 18, 12, 2, DARK, { metal: .6 }); gbox(cx, z + 14, p.y + 14, 16, 10, .6, ac, 1.6, .9); }
        break; }
      case 'pod': {
        box(cx, (z - 22) / 2, cz, hw - 10, (z - 22) / 2, hh - 10, STEEL, { rough: .4, metal: .6 }); R.draw(U.cyl, mm(cx, z - 12, cz, 0, hh * .8, hw - 4, hh * .8, 0, Math.PI / 2), mat([.5, .9, 1.2], { rough: .1, emissive: [.2, .5, .8], emisK: 1, alpha: .4, shadow: false }));
        box(cx, z - 2, cz, hw, 2.4, hh, [.5, .55, .62], { rough: .3, metal: .5 }); edge([.4, 1.4, 2]); glow(cx, z + 14, cz, 90, [.5, 1.2, 1.8], .22); stripes(); break; }
      case 'tank': {
        R.draw(U.cyl, mm(cx, z - 26, cz, 0, 24, hw - 6, 24, 0, Math.PI / 2), mat([.35, .5, .6], { rough: .25, metal: .7 })); box(cx, z - 4, cz, hw, 4, hh, [.5, .55, .62], { rough: .3, metal: .5 }); for (let k = 0; k < 3; k++) box(p.x + 18 + k * (p.w - 36) / 2, (z - 8) / 2, cz, 3, (z - 8) / 2, hh - 6, STEEL); edge([.4, 1.4, 2]); stripes(); break; }
      case 'root': {
        const g = [.1, .4, .14]; box(cx, z - 5, cz, hw, 5, hh, [.2, .14, .1], { rough: .9 }); box(cx, z - .5, cz, hw + 2, 1.6, hh + 2, g, { rough: .85, emissive: [.04, .22, .08], emisK: 1 });
        for (let k = 0; k < 5; k++) { const a = hash(p.id, k) * TAU; cyl(cx + Math.cos(a) * hw * .5, (z - 8) / 2, cz + Math.sin(a) * hh * .5, 4 + hash(p.id, k + 4) * 5, (z - 8) / 2, 4 + hash(p.id, k + 4) * 5, [.2, .14, .1], { rough: .9 }, 0, .12 * Math.sin(a), 0); }
        for (let k = 0; k < 6; k++) { const q = [p.x + hash(p.id, k + 20) * p.w, p.y + hash(p.id, k + 30) * p.h]; orb(q[0], z + 4, q[1], 3.4, [.4, 2.2, .9], 1.8, .9); glow(q[0], z + 8, q[1], 36, [.4, 1.7, .8], .28); R.draw(U.cone, mm(q[0], z + 6, q[1], k, 3, 6, 3), mat([.1, .55, .2], { rough: .8, emissive: [.04, .3, .1], emisK: 1, shadow: false })); }
        edge([.4, 1.8, .8]); break; }
      case 'gantry': {
        box(cx, z - 3, cz, hw, 3, hh, [.2, .22, .27], { rough: .5, metal: .7 }); for (let k = 0; k < Math.floor(p.w / 12); k++) box(p.x + 6 + k * 12, z - .3, cz, .8, .3, hh - 2, DARK, {});
        for (const [lx, lz] of [[p.x + 5, p.y + 5], [p.x + p.w - 5, p.y + 5], [p.x + 5, p.y + p.h - 5], [p.x + p.w - 5, p.y + p.h - 5]]) { box(lx, (z - 6) / 2, lz, 2.6, (z - 6) / 2, 2.6, [.14, .15, .19], { metal: .7 }); box(lx, z + 14, lz, 1.4, 14, 1.4, [.95, .78, .1], { rough: .6 }); }
        for (const sz of [p.y + 1, p.y + p.h - 1]) box(cx, z + 24, sz, hw, 1, .8, [.95, .78, .1], { rough: .6 });
        edge(ac); stripes(); break; }
      case 'rack': {
        box(cx, z / 2, cz, hw - 2, z / 2, hh - 2, [.07, .07, .1], { rough: .4, metal: .7 }); box(cx, z + 1, cz, hw, 2, hh, [.18, .2, .25], { rough: .4, metal: .6 });
        for (let i = 0; i < Math.floor(z / 14); i++) { const on = Math.sin(TT * (3 + i % 5) + p.id * 3 + i) > -.2; gbox(p.x + 12, 10 + i * 14, p.y - .6, 3, 1.6, .5, on ? [.4, .9, 2.3] : [.3, .2, .6], on ? 2.4 : .3, .95); gbox(p.x + p.w - 12, 10 + i * 14, p.y - .6, 3, 1.6, .5, i % 4 ? [.3, 1.8, .6] : [2.2, .2, .2], 2, .95); }
        edge([.6, .5, 2.2]); stripes(); break; }
      case 'crate': {
        box(cx, (z - 2) / 2, cz, hw, (z - 2) / 2, hh, [.28, .24, .19], { rough: .9, metal: .1 }); box(cx, z - 1, cz, hw + 1, 1.4, hh + 1, DARK, { metal: .6 }); for (let k = 0; k < 3; k++) box(cx, (z - 2) / 2, p.y + hh * (.4 + k * .6), hw + .8, 1.6, 1.2, DARK, { metal: .6 }); box(cx, z + 2, cz, 8, 1.2, 4, [.9, .88, .8], {}, p.id); edge(ac); break; }
      case 'debris': {
        const tilt = Math.sin(TT * .5 + p.id) * .02; box(cx, z - 8, cz, hw, 8, hh, [.3, .3, .36], { rough: .7, metal: .3 }, p.id * .4, tilt, tilt); box(cx, z - .8, cz, hw - 2, 1, hh - 2, [.12, .12, .16], {}, p.id * .4, tilt, tilt);
        for (let k = 0; k < 5; k++) cyl(p.x + hash(p.id, k) * p.w, z - 22 - hash(p.id, k + 3) * 20, p.y + hash(p.id, k + 5) * p.h, 1.6, 16, 1.6, [.5, .3, .2], { rough: .7, metal: .6 });                                   // exposed rebar
        for (let k = 0; k < 9; k++) { const q = [cx + (hash(p.id, k + 8) - .5) * p.w, cz + (hash(p.id, k + 10) - .5) * p.h], lf = (TT * .5 + k * .11) % 1; glow(q[0], z - 14 - lf * 40, q[1], 18, [1.8, .3, 1.8], (1 - lf) * .6); }
        R.glow(cx, z - 18, cz, p.w * 1.4, 1.6, .25, 1.8, .3, 0); edge([1.8, .3, 1.8]); stripes(); break; }
      default: box(cx, z / 2, cz, hw, z / 2, hh, PANEL); edge(ac);
    }
  }

  // ---------------------------------------------------------------- frame
  function draw(rr, F, tt, state, cb) {
    R = rr; U = R.unit; mm = R.mm; mat = R.mat; TT = tt; S = state; CB = cb; me = F.me || { x: 500, y: 650 };
    FP = !!(R.isTps && R.cam && R.cam.fp); WH = FP ? 260 : 110;
    if (!accentOf.length) CB.ROOMS.forEach((r) => accentOf.push(hexRGB(r.accent)));
    // the building's dark shell: nothing beyond the walls but void
    box(2000, -40, 1400, 9000, 20, 9000, [.012, .012, .02], { rough: 1, shadow: false });
    CB.ROOMS.forEach((r) => { if (Math.hypot(r.cx - me.x, r.cy - me.y) < 1900) drawRoom(r); });
    CB.LAYOUT.corridors.forEach(drawCorridor);
    CB.LAYOUT.walls.forEach(drawWall);
    CB.LAYOUT.doors.forEach(drawDoor);
    CB.PLATFORMS.forEach(drawPlatform);
  }

  window.ContainmentLab = { draw };
})();
