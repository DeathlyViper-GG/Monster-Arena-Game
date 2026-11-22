// ============================================================
// Monster Arena — SKY PARKOUR: graphics overhaul (v2)
// A chain of storybook sky-islands over a living ocean:
//   theme()  bright daylight sky, warm sun, soft haze (replaces the night palette)
//   sea()    turquoise ocean: deep body, lagoon shallows, currents, swells, glints,
//            caustics, drifting clouds and far-off islands
//   under()  layered stone cliffs with strata, crystal veins, roots, stalactites,
//            orbiting pebbles
//   draw()   grass lip, trees, flowers, tufts, ruins/pillars, springs and rivers that
//            run to the edge and fall as waterfalls into the sea, wisps, foam rings,
//            pad helices and the goal beacon
// render3d_fx.js calls these from drawParkour; nothing about collision, hazards or
// course layout lives here. Disable with window.PARKOUR_GFX_PLUS = false.
// ============================================================
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7 + 17.3) * 43758.5453; return x - Math.floor(x); };
  const SEA_Y = 12;

  const REALM = {
    1: { grass: [.30, .68, .20], grass2: [.46, .82, .28], stone: [.50, .45, .38], moss: [.24, .50, .18], canopy: [.20, .55, .20], flower: [[1.6, .5, .6], [1.6, 1.4, .4], [.7, .8, 1.7]], water: [.2, .75, .95] },
    2: { grass: [.66, .58, .26], grass2: [.84, .74, .34], stone: [.62, .50, .34], moss: [.46, .46, .20], canopy: [.40, .56, .20], flower: [[1.8, .8, .3], [1.7, 1.5, .5]], water: [.15, .8, .85] },
    3: { grass: [.62, .80, .88], grass2: [.86, .95, 1.0], stone: [.46, .56, .66], moss: [.40, .62, .74], canopy: [.58, .82, .9], flower: [[.8, 1.5, 1.9], [1.7, 1.7, 2.0]], water: [.3, .85, 1.0] },
    4: { grass: [.30, .20, .16], grass2: [.52, .30, .20], stone: [.34, .22, .20], moss: [.30, .18, .14], canopy: [.40, .16, .10], flower: [[2.2, .8, .2], [2.0, .4, .1]], water: [1.2, .55, .2] },
    5: { grass: [.36, .24, .56], grass2: [.56, .38, .82], stone: [.30, .26, .42], moss: [.34, .22, .50], canopy: [.44, .26, .70], flower: [[1.8, .6, 2.0], [.8, 1.6, 2.1]], water: [.55, .4, 1.1] }
  };
  const rl = (p) => REALM[p.theme.id] || REALM[1];

  const SKY = { sunCol: [.9, .8, .64], skyTop: [.10, .38, .92], skyHor: [.66, .84, 1.0], ground: [.08, .28, .12], fog: [.64, .82, .96], fogDen: .00006, exp: .62, bloom: .14, tint: [1.02, 1.01, .98], sat: 1.22, vig: .88 };
  function theme(th) {
    if (window.PARKOUR_GFX_PLUS === false) return th;
    const n = [-.38, .8, -.32], l = Math.hypot(n[0], n[1], n[2]);
    return Object.assign({}, th, SKY, { sun: [n[0] / l, n[1] / l, n[2] / l] });
  }

  function sea(R, F, tt) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    const W = (F.world && F.world.w) || 4000, H = (F.world && F.world.h) || 2800, cxw = W / 2, czw = H / 2, y0 = SEA_Y;
    R.draw(U.box, mm(cxw, y0 - 46, czw, 0, 13000, 46, 13000), mat([.02, .30, .42], { rough: .1, metal: .15, emissive: [.03, .34, .46], emisK: 1, shadow: false }));
    R.draw(U.cyl, mm(cxw, y0 - .6, czw, 0, 3300, .5, 2500), mat([.12, .62, .72], { emissive: [.14, .66, .76], emisK: 1, alpha: .5, shadow: false }));
    R.draw(U.cyl, mm(cxw, y0 - .3, czw, 0, 2300, .5, 1700), mat([.28, .8, .82], { emissive: [.3, .84, .84], emisK: 1, alpha: .32, shadow: false }));
    for (let i = 0; i < 56; i++) {
      const lane = (i % 14) / 14, z = czw + (lane - .5) * 7000 + Math.sin(i * 1.7) * 140, span = 12000;
      const x = cxw - span / 2 + ((tt * (50 + (i % 5) * 14) + i * 971) % span);
      const len = 320 + (i % 6) * 170, rise = Math.sin(tt * 1.1 + i) * 2.4;
      const edge = Math.min(1, Math.sin(((x - (cxw - span / 2)) / span) * Math.PI) * 4);
      R.draw(U.box, mm(x, y0 + 1 + rise, z, 0, len, 1.6, 12 + (i % 4) * 8), mat([.5, .95, 1.1], { rough: .1, emissive: [.45, .95, 1.1], alpha: .13 * edge, shadow: false }));
      if (i % 3 === 0) R.draw(U.box, mm(x, y0 + 3 + rise, z, 0, len * .55, .7, 3.5), mat([1.2, 1.4, 1.5], { emissive: [1.5, 1.7, 1.8], alpha: .5 * edge, shadow: false }));
    }
    for (let i = 0; i < 38; i++) {
      const rad = 400 + (i / 38) * 5200, a = tt * (.03 + (i % 5) * .01) + i * 2.399;
      const px = cxw + Math.cos(a) * rad, pz = czw + Math.sin(a) * rad, len = 260 + (i % 7) * 180;
      R.draw(U.box, mm(px, y0 + 1.4 + Math.sin(tt * .9 + i) * 3, pz, a + 1.5708, len, 2.4, 16 + (i % 4) * 14), mat([.35, .8, .95], { rough: .12, emissive: [.2, .7, .9], alpha: .12, shadow: false }));
    }
    for (let i = 0; i < 120; i++) {
      const bx = hash(i, 1) * 9000 - 2500, bz = hash(i, 2) * 7000 - 2100, k = Math.max(0, Math.sin(tt * (1.4 + hash(i, 3) * 2) + i));
      if (k < .55) continue;
      R.glow(bx, y0 + 4, bz, 20 + hash(i, 4) * 22, 1.8, 1.9, 1.8, (k - .55) * 1.6, 0);
    }
    for (let i = 0; i < 10; i++) { const a = tt * .22 + i * .63; R.glow(cxw + Math.cos(a * 1.3) * (900 + i * 170), y0 + 2, czw + Math.sin(a) * (640 + i * 120), 320 + i * 40, .3, .95, 1.1, .1, 0); }
    for (let i = 0; i < 18; i++) {
      const sp = 14 + (i % 4) * 5, x = cxw - 6500 + ((tt * sp + i * 1150) % 13000), z = czw + (hash(i, 8) - .5) * 9000, y = 380 + hash(i, 9) * 700;
      R.glow(x, y, z, 520 + hash(i, 5) * 420, 1.35, 1.4, 1.5, .18, 0); R.glow(x + 200, y + 40, z + 80, 380, 1.4, 1.45, 1.55, .16, 0);
    }
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + .4, rad = 5600 + hash(i, 11) * 1500, x = cxw + Math.cos(a) * rad, z = czw + Math.sin(a) * rad * .8, y = 120 + hash(i, 12) * 360, s = 420 + hash(i, 13) * 520;
      R.draw(U.rock, mm(x, y, z, a, s, 80 + hash(i, 14) * 70, s * .8), mat([.36, .42, .48], { rough: .95, emissive: [.07, .1, .13], emisK: 1, shadow: false }));
      R.draw(U.cone, mm(x, y - 190, z, 0, s * .6, 190, s * .5, Math.PI), mat([.28, .32, .38], { rough: 1, shadow: false }));
      R.draw(U.cyl, mm(x, y + 70, z, 0, s * .92, 14, s * .74), mat([.34, .66, .28], { emissive: [.06, .14, .05], emisK: 1, shadow: false }));
      R.glow(x, y - 20, z, s * 1.5, 1.2, 1.3, 1.4, .1, 0);
    }
  }

  function island(R, p, DECK, tt, hex, near) {
    const U = R.unit, mm = R.mm, mat = R.mat, L = rl(p);
    const cx = p.x + p.w / 2, cz = p.y + p.h / 2, hw = p.w / 2, hh = p.h / 2, i = p.i, rot = hash(i, 1) * .5;
    const layers = [[24, 1.0], [24, .93], [28, .8], [30, .62]];
    let y = DECK;
    layers.forEach((ly, k) => {
      const th = ly[0], c = L.stone, tone = k % 2 ? .78 : 1;
      R.draw(U.box, mm(cx, y - th / 2, cz, rot * .04 * k, hw * ly[1], th / 2, hh * ly[1]), mat([c[0] * tone, c[1] * tone, c[2] * tone], { rough: .92, metal: .02, shadow: false }));
      if (near) R.draw(U.box, mm(cx, y - th + 1, cz, rot * .04 * k, hw * ly[1] + 1.4, 1.1, hh * ly[1] + 1.4), mat([c[0] * .55, c[1] * .55, c[2] * .55], { rough: 1, shadow: false }));
      y -= th;
    });
    R.draw(U.rock, mm(cx, y - 18, cz, rot, hw * .56, 44, hh * .56), mat([L.stone[0] * .7, L.stone[1] * .7, L.stone[2] * .7], { rough: 1, shadow: false }));
    R.draw(U.cone, mm(cx, y - 110, cz, rot, hw * .3, 84, hh * .3, Math.PI), mat([L.stone[0] * .5, L.stone[1] * .5, L.stone[2] * .5], { rough: 1, shadow: false }));
    if (!near) return;
    for (let k = 0; k < 5; k++) {
      const a = hash(i, 20 + k) * TAU, r = .25 + hash(i, 30 + k) * .4, len = 40 + hash(i, 40 + k) * 90;
      R.draw(U.cone, mm(cx + Math.cos(a) * hw * r, y - 6 - len / 2, cz + Math.sin(a) * hh * r, 0, 9 + hash(i, 50 + k) * 8, len / 2, 9 + hash(i, 60 + k) * 8, Math.PI), mat([L.stone[0] * .55, L.stone[1] * .55, L.stone[2] * .55], { rough: 1, shadow: false }));
    }
    const ac = hex(p.theme.accent);
    for (let k = 0; k < 4; k++) {
      const a = hash(i, 70 + k) * TAU, r = .45 + hash(i, 80 + k) * .4, h = 20 + hash(i, 90 + k) * 34;
      const sx = cx + Math.cos(a) * hw * r, sz = cz + Math.sin(a) * hh * r, f = .7 + .3 * Math.sin(tt * 2 + i + k);
      R.draw(U.cone, mm(sx, DECK - 62 - h * .2, sz, a, 5, h, 5, Math.PI * .85, hash(i, k) * .6), mat(ac, { emissive: [ac[0] * 1.9, ac[1] * 1.9, ac[2] * 1.9], emisK: 1, shadow: false }));
      R.glow(sx, DECK - 70, sz, 62, ac[0] * 1.3, ac[1] * 1.3, ac[2] * 1.3, .42 * f, 0);
    }
    for (let k = 0; k < 6; k++) {
      const side = k % 4, t = hash(i, 100 + k), vx = side < 2 ? p.x + t * p.w : (side === 2 ? p.x : p.x + p.w), vz = side < 2 ? (side === 0 ? p.y : p.y + p.h) : p.y + t * p.h;
      const len = 36 + hash(i, 110 + k) * 70, sw = Math.sin(tt * 1.2 + k + i) * 2.4;
      R.draw(U.cyl, mm(vx + sw, DECK - 10 - len / 2, vz, 0, 1.6, len / 2, 1.6), mat([L.moss[0] * .8, L.moss[1] * .8, L.moss[2] * .8], { rough: .9, shadow: false }));
      for (let q = 0; q < 3; q++) R.draw(U.sphereLo, mm(vx + sw * (1 - q * .2), DECK - 18 - q * len / 3.2, vz, 0, 4.2, 2.4, 4.2), mat(L.moss, { rough: .8, shadow: false }));
    }
    for (let k = 0; k < 4; k++) {
      const a = tt * (.25 + k * .06) + k * 1.6 + i, r = Math.max(hw, hh) * (.85 + k * .1), s = 7 + hash(i, 120 + k) * 9;
      R.draw(U.rock, mm(cx + Math.cos(a) * r, DECK - 80 - k * 26 + Math.sin(tt + k + i) * 7, cz + Math.sin(a) * r, a, s, s * .8, s), mat([L.stone[0] * .8, L.stone[1] * .8, L.stone[2] * .8], { rough: 1, shadow: false }));
    }
  }

  function lip(R, p, DECK) {
    const U = R.unit, mm = R.mm, mat = R.mat, L = rl(p), g = L.grass, g2 = L.grass2;
    [[p.x + p.w / 2, p.y, p.w / 2, 3.2], [p.x + p.w / 2, p.y + p.h, p.w / 2, 3.2], [p.x, p.y + p.h / 2, 3.2, p.h / 2], [p.x + p.w, p.y + p.h / 2, 3.2, p.h / 2]].forEach((q) => {
      R.draw(U.box, mm(q[0], DECK + 2.2, q[1], 0, q[2] + 3, 3, q[3] + 3), mat(g, { rough: .8, emissive: [g[0] * .12, g[1] * .12, g[2] * .12], emisK: 1, shadow: false }));
      R.draw(U.box, mm(q[0], DECK + 5, q[1], 0, q[2] + 1, .8, q[3] + 1), mat(g2, { rough: .7, emissive: [g2[0] * .3, g2[1] * .3, g2[2] * .3], emisK: 1, shadow: false }));
      R.draw(U.box, mm(q[0], DECK - 5, q[1], 0, q[2] + 4.4, 6, q[3] + 4.4), mat(g, { rough: .9, shadow: false }));
    });
  }

  function tree(R, x, z, DECK, s, tt, L, seed) {
    const U = R.unit, mm = R.mm, mat = R.mat, sw = Math.sin(tt * 1.1 + seed) * 1.6 * s, c = L.canopy;
    R.draw(U.cyl, mm(x, DECK + 16 * s, z, 0, 3.4 * s, 16 * s, 3.4 * s), mat([.34, .22, .14], { rough: .9, shadow: false }));
    R.draw(U.sphere, mm(x + sw, DECK + 40 * s, z, 0, 17 * s, 14 * s, 17 * s), mat(c, { rough: .85, emissive: [c[0] * .12, c[1] * .12, c[2] * .12], emisK: 1, shadow: false }));
    R.draw(U.sphere, mm(x + 9 * s + sw, DECK + 32 * s, z + 4 * s, 0, 12 * s, 10 * s, 12 * s), mat([c[0] * 1.1, c[1] * 1.1, c[2] * 1.1], { rough: .85, shadow: false }));
    R.draw(U.sphere, mm(x - 8 * s + sw, DECK + 34 * s, z - 5 * s, 0, 11 * s, 9 * s, 11 * s), mat([c[0] * .9, c[1] * .9, c[2] * .9], { rough: .85, shadow: false }));
  }
  function pillar(R, x, z, DECK, h, ac, tt, seed) {
    const U = R.unit, mm = R.mm, mat = R.mat, ry = hash(seed, 1) * .5;
    R.draw(U.box, mm(x, DECK + h / 2, z, ry, 6, h / 2, 6), mat([.52, .5, .48], { rough: .9, shadow: false }));
    R.draw(U.box, mm(x, DECK + h + 2, z, ry, 8, 2, 8), mat([.6, .58, .54], { rough: .9, shadow: false }));
    R.draw(U.box, mm(x, DECK + h * .6, z, ry, 6.6, 1.2, 6.6), mat(ac, { emissive: [ac[0] * 1.8, ac[1] * 1.8, ac[2] * 1.8], emisK: 1, shadow: false }));
    R.glow(x, DECK + h * .6, z, 42, ac[0] * 1.2, ac[1] * 1.2, ac[2] * 1.2, .3 + .1 * Math.sin(tt * 2 + seed), 0);
  }

  function river(R, p, DECK, tt, near) {
    const L = rl(p), U = R.unit, mm = R.mm, mat = R.mat, w = L.water, i = p.i;
    if (hash(i, 200) < .38 || p.pad || p.goal) return;
    const side = Math.floor(hash(i, 201) * 4), t = .3 + hash(i, 202) * .4, j = (hash(i, 203) - .5) * 60;
    let sx, sz, ex, ez, nx, nz;
    if (side === 0) { ex = p.x + p.w * t; ez = p.y; nx = 0; nz = -1; sx = ex + j; sz = ez + p.h * .46; }
    else if (side === 1) { ex = p.x + p.w * t; ez = p.y + p.h; nx = 0; nz = 1; sx = ex + j; sz = ez - p.h * .46; }
    else if (side === 2) { ex = p.x; ez = p.y + p.h * t; nx = -1; nz = 0; sx = ex + p.w * .46; sz = ez + j; }
    else { ex = p.x + p.w; ez = p.y + p.h * t; nx = 1; nz = 0; sx = ex - p.w * .46; sz = ez + j; }
    const sp = p.spikes, bad = (x, z) => sp && x > sp.x - 24 && x < sp.x + sp.w + 24 && z > sp.y - 24 && z < sp.y + sp.h + 24;
    for (let k = 0; k <= 8; k++) if (bad(sx + (ex - sx) * k / 8, sz + (ez - sz) * k / 8)) return;
    if (p.chest && Math.hypot((sx + ex) / 2 - p.chest.x, (sz + ez) / 2 - p.chest.y) < 50) return;
    const pts = [], N = 7;
    for (let k = 0; k <= N; k++) { const u = k / N; pts.push(sx + (ex - sx) * u + Math.sin(u * 7 + i) * 9 * (1 - u), DECK + 1.9, sz + (ez - sz) * u + Math.cos(u * 6 + i) * 9 * (1 - u)); }
    R.rib.line(pts, 12, 10, w[0] * .6, w[1] * .9, w[2], .72);
    R.rib.line(pts, 6, 5, w[0] * 1.5, w[1] * 1.5, w[2] * 1.3, .5);
    for (let k = 0; k < 7; k++) {
      const u = (tt * .42 + k / 7) % 1, q = u * N, a = Math.floor(q), f = q - a, b = Math.min(N, a + 1);
      R.glow(pts[a * 3] + (pts[b * 3] - pts[a * 3]) * f, DECK + 4, pts[a * 3 + 2] + (pts[b * 3 + 2] - pts[a * 3 + 2]) * f, 10, 1.7, 1.9, 1.9, .75 * Math.sin(u * Math.PI), 0);
    }
    R.decal(sx, sz, 54, w[0] * .9, w[1] * 1.1, w[2] * 1.1, .8, 11, 0, 0, true, DECK + 1.6);
    const ph = (tt * 20) % 32; R.decal(sx, sz, 22 + ph, 1.6, 1.8, 1.8, .6 * (1 - ph / 32), 2, .1, 0, true, DECK + 2.2);
    const fh = DECK - SEA_Y, yaw = Math.atan2(nz, nx);
    R.draw(U.box, mm(ex + nx * 2.5, SEA_Y + fh / 2, ez + nz * 2.5, -yaw + 1.5708, 15, fh / 2, 2.4), mat([w[0] * .9, w[1] * 1.3, w[2] * 1.4], { emissive: [w[0] * .7, w[1], w[2] * 1.1], emisK: 1, alpha: .5, shadow: false }));
    R.draw(U.box, mm(ex + nx * 4.5, SEA_Y + fh / 2, ez + nz * 4.5, -yaw + 1.5708, 9, fh / 2, 1.4), mat([1.4, 1.6, 1.7], { emissive: [1.4, 1.7, 1.8], emisK: 1, alpha: .32, shadow: false }));
    if (near) for (let k = 0; k < 12; k++) {
      const u = (tt * .9 + k / 12) % 1;
      R.glow(ex + nx * 5 + (hash(k, i) - .5) * 15, DECK - u * fh, ez + nz * 5 + (hash(k, i + 4) - .5) * 15, 11, 1.8, 1.9, 1.9, .55, 0);
    }
    R.glow(ex + nx * 8, SEA_Y + 16, ez + nz * 8, 120, 1.5, 1.7, 1.8, .26 + .06 * Math.sin(tt * 3 + i), 0);
    R.decal(ex + nx * 8, ez + nz * 8, 120 + Math.sin(tt * 2 + i) * 12, 1.8, 1.9, 1.9, .55, 11, 0, 0, true, SEA_Y + 1.2);
    for (let k = 0; k < 3; k++) { const f = (tt * .5 + k / 3 + i * .1) % 1; R.decal(ex + nx * 8, ez + nz * 8, 60 + f * 170, 1.6, 1.8, 1.8, (1 - f) * .6, 2, .09, 0, true, SEA_Y + 1.6); }
  }

  function decor(R, p, DECK, tt, hex, near) {
    const U = R.unit, mm = R.mm, mat = R.mat, L = rl(p), i = p.i, ac = hex(p.theme.accent);
    const free = (x, z, pad) => {
      if (p.spikes && x > p.spikes.x - pad && x < p.spikes.x + p.spikes.w + pad && z > p.spikes.y - pad && z < p.spikes.y + p.spikes.h + pad) return false;
      if (p.pad && Math.hypot(x - p.pad.x, z - p.pad.y) < p.pad.r + pad + 20) return false;
      if (p.goal && Math.hypot(x - p.goal.x, z - p.goal.y) < p.goal.r + pad + 20) return false;
      if (p.chest && Math.hypot(x - p.chest.x, z - p.chest.y) < 44 + pad) return false;
      return true;
    };
    lip(R, p, DECK);
    river(R, p, DECK, tt, near);
    const cx = p.x + p.w / 2, cz = p.y + p.h / 2, mx = Math.max(p.w, p.h);
    R.decal(cx, cz, mx * 1.7, .3, .9, 1.0, .35, 11, 0, 0, true, SEA_Y + .8);
    if (!near) return;
    const corners = [[.14, .16], [.86, .18], [.16, .84], [.84, .82]];
    for (let k = 0; k < 4; k++) {
      if (hash(i, 300 + k) < .45) continue;
      const x = p.x + p.w * corners[k][0], z = p.y + p.h * corners[k][1];
      if (free(x, z, 14)) tree(R, x, z, DECK, .7 + hash(i, 310 + k) * .55, tt, L, i + k);
    }
    for (let k = 0; k < 14; k++) {
      const x = p.x + 16 + hash(i, 400 + k) * (p.w - 32), z = p.y + 16 + hash(i, 420 + k) * (p.h - 32);
      if (!free(x, z, 10)) continue;
      if (k < 6) {
        const f = L.flower[k % L.flower.length], sway = Math.sin(tt * 1.8 + k + i) * 1.2;
        R.draw(U.cyl, mm(x, DECK + 4.4, z, 0, .7, 4.4, .7), mat([.2, .5, .16], { shadow: false }));
        R.draw(U.sphereLo, mm(x + sway, DECK + 9.4, z, 0, 3, 2.2, 3), mat(f, { emissive: [f[0] * .9, f[1] * .9, f[2] * .9], emisK: 1, shadow: false }));
      } else {
        const g2 = L.grass2, sw = Math.sin(tt * 2.2 + k + i * 1.3) * .14;
        for (let b = 0; b < 3; b++) R.draw(U.cone, mm(x + (b - 1) * 2.2, DECK + 5, z + (b % 2) * 1.5, b, 1.5, 5.2 + b, 1.5, sw, sw * .6), mat(g2, { rough: .8, shadow: false }));
      }
    }
    if (i % 3 === 0 && !p.pad && !p.goal) {
      const x1 = p.x + p.w * .22, x2 = p.x + p.w * .78, z = p.y + p.h * .5;
      if (free(x1, z, 14) && free(x2, z, 14)) {
        pillar(R, x1, z, DECK, 52, ac, tt, i); pillar(R, x2, z, DECK, 52, ac, tt, i + 7);
        R.draw(U.box, mm((x1 + x2) / 2, DECK + 56, z, 0, (x2 - x1) / 2 + 6, 4, 6), mat([.56, .54, .5], { rough: .9, shadow: false }));
        R.draw(U.box, mm((x1 + x2) / 2, DECK + 52, z, 0, (x2 - x1) / 2 - 4, 1.2, 6.6), mat(ac, { emissive: [ac[0] * 1.6, ac[1] * 1.6, ac[2] * 1.6], emisK: 1, alpha: .75, shadow: false }));
      }
    } else if (!p.pad && !p.goal) {
      const x = p.x + p.w * (.2 + hash(i, 500) * .6), z = p.y + p.h * (hash(i, 501) > .5 ? .18 : .82);
      if (free(x, z, 14)) pillar(R, x, z, DECK, 30 + hash(i, 502) * 22, ac, tt, i);
    }
    for (let k = 0; k < 5; k++) {
      const lf = (tt * .18 + k * .2 + hash(i, 600 + k)) % 1, x = p.x + p.w * hash(i, 610 + k), z = p.y + p.h * hash(i, 620 + k);
      R.glow(x + Math.sin(tt + k) * 10, DECK + 14 + lf * 120, z + Math.cos(tt * .8 + k) * 10, 12, ac[0] * 1.3, ac[1] * 1.3, ac[2] * 1.3, (1 - lf) * .55, 0);
    }
    for (let k = 0; k < 2; k++) { const f = (tt * .3 + k * .5 + i * .13) % 1; R.decal(cx, cz, mx * (1.1 + f * 1.1), 1.6, 1.8, 1.8, (1 - f) * .5, 2, .05, 0, true, SEA_Y + 1.4); }
    [[p.x + 10, p.y + 10], [p.x + p.w - 10, p.y + 10], [p.x + 10, p.y + p.h - 10], [p.x + p.w - 10, p.y + p.h - 10]].forEach((q, k) => {
      if (!free(q[0], q[1], 8)) return;
      R.draw(U.box, mm(q[0], DECK + 9, q[1], .4, 3.4, 9, 3.4), mat([.5, .48, .46], { rough: .9, shadow: false }));
      R.draw(U.cone, mm(q[0], DECK + 22 + Math.sin(tt * 2 + k + i) * 1.5, q[1], tt + k, 4, 7, 4, Math.PI), mat(ac, { emissive: [ac[0] * 2, ac[1] * 2, ac[2] * 2], emisK: 1, shadow: false }));
      R.glow(q[0], DECK + 22, q[1], 46, ac[0], ac[1], ac[2], .35 + .1 * Math.sin(tt * 2 + i + k), 0);
    });
    R.decal(cx, cz, Math.min(p.w, p.h) * .8, ac[0] * 1.2, ac[1] * 1.2, ac[2] * 1.2, .2 + .08 * Math.sin(tt * 2 + i), 9, tt * .3, tt * .15, true, DECK + 1.6);
  }

  function features(R, c, tt) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    for (const p of c.plats) {
      const DECK = p.deck;
      if (p.pad) {
        const pad = p.pad, fl = pad.flash || 0;
        for (let i = 0; i < 16; i++) { const a = i / 16 * TAU * 2 + tt * 3, h2 = ((i / 16) + tt * .4) % 1; R.glow(pad.x + Math.cos(a) * pad.r * (.9 - h2 * .4), DECK + 12 + h2 * 160, pad.y + Math.sin(a) * pad.r * (.9 - h2 * .4), 16, 1.2, 1.9, 2.3, (1 - h2) * .8, 0); }
        if (fl > 0) { R.decal(pad.x, pad.y, pad.r * 2 * (2.2 - fl * 1.2), 1.6, 2.2, 2.6, fl * .9, 2, .08, 0, true, DECK + 6); R.glow(pad.x, DECK + 60, pad.y, 260, 1.4, 2, 2.4, fl * .6, 0); }
      }
      if (p.goal) {
        const go = p.goal, arm = go.armed ? 1 : .35;
        for (let i = 0; i < 34; i++) { const h2 = ((i / 34) + tt * .22) % 1, a = h2 * TAU * 5 + i; R.glow(go.x + Math.cos(a) * go.r * (1 - h2 * .5), DECK + 8 + h2 * 420, go.y + Math.sin(a) * go.r * (1 - h2 * .5), 20 + (1 - h2) * 12, .6, 2, 1.4, (1 - h2 * .8) * .8 * arm, 0); }
        for (let k = 0; k < 3; k++) { const f = (tt * .5 + k / 3) % 1; R.decal(go.x, go.y, go.r * 2 * (1 + f * 3), .6, 2, 1.4, (1 - f) * .6 * arm, 2, .05, 0, true, DECK + 5); }
        for (let i = 0; i < 14; i++) R.streak(go.x, DECK + 40, go.y, i / 14 * TAU + tt * .2, 14, go.r * 3.4, .6, 2, 1.4, .16 * arm);
        for (let k = 0; k < 2; k++) R.draw(U.cyl, mm(go.x + (k ? 70 : -70), DECK + 50, go.y, 0, 5, 50, 5), mat([.9, .8, .5], { emissive: [1.2, 1.0, .5], emisK: 1, shadow: false }));
      }
    }
    const cxw = 2000, czw = 1400;
    for (let i = 0; i < 28; i++) {
      const a = tt * (.02 + (i % 5) * .005) + i * 2.399, rad = 500 + (i / 28) * 2600;
      const px = cxw + Math.cos(a) * rad, pz = czw + Math.sin(a) * rad * .72, py = 360 + ((i * 53) % 640) + Math.sin(tt * .6 + i) * 30;
      const col = [[.6, 1.5, 2], [1.7, 1.3, .6], [.7, 2, 1.4]][i % 3];
      R.draw(U.cone, mm(px, py, pz, tt * .8 + i, 8, 30, 8, tt * .5, 0), mat([col[0] * .5, col[1] * .5, col[2] * .5], { emissive: col, emisK: 1.3, alpha: .8, shadow: false }));
      R.glow(px, py, pz, 54, col[0], col[1], col[2], .24, 0);
    }
  }

  function draw(R, F, tt, c, hex) {
    if (window.PARKOUR_GFX_PLUS === false) return;
    const me = F.me || { x: 2000, y: 1400 };
    for (const p of c.plats) decor(R, p, p.deck, tt, hex, Math.hypot(p.x + p.w / 2 - me.x, p.y + p.h / 2 - me.y) < 1500);
    features(R, c, tt);
  }
  function under(R, p, DECK, tt, hex, F) {
    if (window.PARKOUR_GFX_PLUS === false) return false;
    const me = (F && F.me) || { x: 2000, y: 1400 };
    island(R, p, DECK, tt, hex, Math.hypot(p.x + p.w / 2 - me.x, p.y + p.h / 2 - me.y) < 1500);
    return true;
  }

  window.ParkourGfx = { draw, theme, sea, under };
})();
