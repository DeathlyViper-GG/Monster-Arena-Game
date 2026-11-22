// ============================================================
// Monster Arena — AGE OF THE SENTINEL: attack vocabulary
// ------------------------------------------------------------------
// The four Sentinel wardens must never look like each other. Every
// boss in this campaign telegraphs with a shape of its own:
//
//   SEALWRIGHT ..... a stamped disc of red wax and gold, cut with
//                    radial slots and a monogram — law, physically
//                    pressed into the floor. Never a ring.
//   CHOIR OF ASH ... a charred patch ringed by tongues of flame that
//                    splay outward and lick up on the beat.
//   HOURGLASS STAG . a frost fern: veins of ice forking outward from
//                    the centre, with shards standing at the tips.
//   GILDED BAILIFF . a rectangular docket of four gold bars, two
//                    coins and a line of dashes — an invoice, not a
//                    seal.
//
// Every function is safe to call with a null renderer.
// ============================================================
(function () {
  'use strict';

  const TAU = Math.PI * 2;

  const GOLD = [1.62, 1.16, 0.5];
  const GOLD_HOT = [2.5, 2.0, 1.15];
  const WAX = [0.55, 0.09, 0.07];
  // Scarlet, never gold. These values feed the additive pass, so a high green
  // and blue channel clips the Choir's fire to the same warm white as the
  // Sealwright's ivory law — keep green and blue low and the flames stay red.
  const EMBER = [2.15, 0.22, 0.06];
  const EMBER_HOT = [2.45, 0.80, 0.26];
  const ICE = [0.7, 0.95, 1.3];
  const ICE_HOT = [1.35, 1.6, 1.9];

  const ok = (R) => !!(R && R.ok);

  // =========================================================================
  //  SEALWRIGHT — the stamped wax seal
  // =========================================================================
  function stamp(R, x, z, r, a, tt, seed) {
    if (!ok(R) || !(a > 0.02) || r < 3) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const rot = (seed || 0) * 1.7 + Math.sin(tt * 0.6) * 0.08;
    const live = a > 0.55;

    // the wax itself, pressed flat
    R.draw(U.cyl, mm(x, 3, z, rot, r * 1.05, 6, r * 1.05),
      mat(WAX, { rough: 0.75, metal: 0.08, emissive: [0.4, 0.07, 0.05], emisK: 1.5, alpha: 0.9 * a, shadow: false }));
    // slots cut around the rim (not a ring: radial bars)
    for (let i = 0; i < 8; i++) {
      const an = rot + (i / 8) * TAU;
      R.draw(U.box, mm(x + Math.cos(an) * r * 0.72, 6.2, z + Math.sin(an) * r * 0.72, an, r * 0.34, 3.4, r * 0.13),
        mat([1, 1, 1], { emissive: GOLD, emisK: 1.9, alpha: 0.8 * a, shadow: false }));
    }
    // the monogram: two crossed bars and a lit core
    R.draw(U.box, mm(x, 7.6, z, rot, r * 0.98, 4, r * 0.17),
      mat([1, 1, 1], { emissive: GOLD, emisK: 2.2, alpha: a, shadow: false }));
    R.draw(U.box, mm(x, 7.6, z, rot + 1.5708, r * 0.98, 4, r * 0.17),
      mat([1, 1, 1], { emissive: GOLD, emisK: 2.2, alpha: a, shadow: false }));
    R.draw(U.sphereLo, mm(x, 9, z, 0, r * 0.17, r * 0.17, r * 0.17),
      mat([1, 1, 1], { emissive: live ? GOLD_HOT : GOLD, emisK: 2.6, alpha: a, shadow: false }));
    R.glow(x, 9, z, r * 1.7, 1.5, 0.95, 0.45, 0.32 * a, 0);
  }

  // =========================================================================
  //  CHOIR OF ASH — the burning mark with a rim of flame tongues
  // =========================================================================
  function burn(R, x, z, r, a, tt, fired) {
    if (!ok(R) || r < 3) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const heat = fired ? 1 : Math.max(0.35, a);

    // scorched ground under the mark
    R.decal(x, z, r * 1.7, 0.05, 0.035, 0.035, 0.7, 0, 0, tt * 0.2, true, 1.2);
    // tongues of flame splayed around the edge — the mark's signature
    const n = 10;
    for (let i = 0; i < n; i++) {
      const an = (i / n) * TAU + tt * 0.45;
      const h = r * (0.65 + 0.45 * Math.abs(Math.sin(i * 2.1 + tt * 4)));
      R.draw(U.cone, mm(x + Math.cos(an) * r * 0.9, h * 0.5, z + Math.sin(an) * r * 0.9, an, r * 0.15, h, r * 0.15),
        mat([1, 1, 1], { emissive: fired ? EMBER_HOT : EMBER, emisK: fired ? 2.5 : 1.7, alpha: (fired ? 0.95 : 0.42 + 0.45 * heat) * (fired ? 1 : 1), shadow: false }));
    }
    // a low licking column at the centre of the patch
    R.draw(U.cone, mm(x, r * 0.2, z, 0, r * 0.26, r * 0.9, r * 0.26),
      mat([1, 1, 1], { emissive: fired ? EMBER_HOT : EMBER, emisK: fired ? 2.4 : 1.4, alpha: fired ? 0.7 : 0.25 + 0.3 * heat, shadow: false }));
    R.glow(x, 8, z, r * (fired ? 2.2 : 1.4), 2.0, fired ? 1.2 : 0.8, 0.4, (fired ? 0.8 : 0.28) * (fired ? 1 : heat), 0);
    if (fired) R.light(x, z, 40, 220, 1.9, 0.9, 0.4, 0.8);
  }

  // =========================================================================
  //  HOURGLASS STAG — the frost fern
  // =========================================================================
  function frost(R, x, z, radius, a, tt, seed) {
    if (!ok(R) || !(a > 0.02) || radius < 3) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const spin = (seed || 0) * 0.5 + Math.sin(tt * 0.5) * 0.07;
    const arms = 5;
    const vein = (px, pz, an, len, thick, alpha) => {
      R.draw(U.box, mm(px + Math.cos(an) * len * 0.5, 2.4, pz + Math.sin(an) * len * 0.5, an, len, 2.6, thick),
        mat([1, 1, 1], { emissive: ICE, emisK: 1.6, alpha, shadow: false }));
    };

    for (let i = 0; i < arms; i++) {
      const an = (i / arms) * TAU + spin;
      vein(x, z, an, radius, Math.max(2.6, radius * 0.07), 0.85 * a);
      // two forks off the middle of the vein, the way frost actually grows
      const mx = x + Math.cos(an) * radius * 0.5, mz = z + Math.sin(an) * radius * 0.5;
      for (const s of [-1, 1]) {
        vein(mx, mz, an + s * 0.72, radius * 0.42, Math.max(2, radius * 0.05), 0.65 * a);
      }
      // a shard standing at the tip
      R.draw(U.cone, mm(x + Math.cos(an) * radius, radius * 0.14, z + Math.sin(an) * radius, an, radius * 0.1, radius * 0.3, radius * 0.1),
        mat([1, 1, 1], { emissive: ICE_HOT, emisK: 2.0, alpha: 0.85 * a, shadow: false }));
    }
    R.draw(U.sphereLo, mm(x, 4, z, 0, radius * 0.13, radius * 0.13, radius * 0.13),
      mat([1, 1, 1], { emissive: ICE_HOT, emisK: 2.3, alpha: a, shadow: false }));
    R.glow(x, 6, z, radius * 1.5, 0.62, 0.88, 1.25, 0.3 * a, 0);
  }

  // =========================================================================
  //  GILDED BAILIFF — the docket
  // =========================================================================
  function ledger(R, x, z, r, a, tt, seed) {
    if (!ok(R) || !(a > 0.02) || r < 3) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const b = r * 0.95;
    const bar = (px, pz, ry, len, th) => R.draw(U.box, mm(px, 4.4, pz, ry, len, 6, th),
      mat([1, 1, 1], { emissive: GOLD, emisK: 2.0, alpha: a, shadow: false }));

    // four gold bars: a page of law laid flat, never a circle
    for (const s of [-1, 1]) {
      bar(x, z + s * b, 0, b * 1.95, Math.max(3, r * 0.1));
      bar(x + s * b, z, 1.5708, b * 1.95, Math.max(3, r * 0.1));
    }
    // two struck coins in the left column
    for (const s of [-1, 1]) {
      R.draw(U.cyl, mm(x - b * 0.5, 5.6, z + s * b * 0.5, tt * 0.4 * s, b * 0.2, 4.2, b * 0.2),
        mat([1, 1, 1], { emissive: GOLD_HOT, emisK: 2.3, alpha: a, shadow: false }));
    }
    // a line of script running to the right
    for (let i = 0; i < 5; i++) {
      R.draw(U.box, mm(x + b * 0.05 + i * b * 0.24, 5.4, z - b * 0.05 + (i % 2) * b * 0.16, 0, b * 0.16, 4.4, b * 0.05),
        mat([1, 1, 1], { emissive: GOLD, emisK: 1.9, alpha: 0.9 * a, shadow: false }));
    }
    R.glow(x, 8, z, r * 1.8, 1.5, 1.05, 0.5, 0.3 * a, 0);
  }

  // =========================================================================
  //  2D fallbacks (used when WebGL is unavailable)
  // =========================================================================
  function frost2(ctx, x, y, r, a, t, seed) {
    if (!ctx || !(a > 0.02) || r < 3) return;
    const spin = (seed || 0) * 0.5 + Math.sin(t * 0.5) * 0.07;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(1, a);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(200,240,255,0.9)';
    for (let i = 0; i < 5; i++) {
      const an = (i / 5) * TAU + spin;
      const ex = x + Math.cos(an) * r, ey = y + Math.sin(an) * r;
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.lineWidth = Math.max(1.4, r * 0.05);
      for (const s of [-1, 1]) {
        const fa = an + s * 0.72;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(an) * r * 0.5, y + Math.sin(an) * r * 0.5);
        ctx.lineTo(x + Math.cos(an) * r * 0.5 + Math.cos(fa) * r * 0.42, y + Math.sin(an) * r * 0.5 + Math.sin(fa) * r * 0.42);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function burn2(ctx, x, y, r, a, t, fired) {
    if (!ctx || r < 3) return;
    const heat = fired ? 1 : Math.max(0.35, a);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = 'rgba(30,18,12,0.7)';
    ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 10; i++) {
      const an = (i / 10) * TAU + t * 0.45;
      const h = r * (0.65 + 0.45 * Math.abs(Math.sin(i * 2.1 + t * 4)));
      const px = x + Math.cos(an) * r * 0.9, py = y + Math.sin(an) * r * 0.9;
      ctx.fillStyle = fired ? 'rgba(255,238,205,0.95)' : 'rgba(255,150,80,' + (0.4 + 0.45 * heat) + ')';
      ctx.beginPath();
      ctx.moveTo(px, py - h * 0.6);
      ctx.quadraticCurveTo(px + r * 0.16, py, px, py + h * 0.4);
      ctx.quadraticCurveTo(px - r * 0.16, py, px, py - h * 0.6);
      ctx.fill();
    }
    ctx.restore();
  }

  // =========================================================================
  //  LANES — the four wardens never share one
  // -------------------------------------------------------------------------
  //  edict ......... SEALWRIGHT: two crisp ivory rails with ruled rungs. Straight,
  //                  hard-edged, no gradient — law laid down as a corridor.
  //  throat ........ CHOIR: a ragged smear of soot with tongues of flame that
  //                  splay wider the further they run. Nothing straight in it.
  // =========================================================================
  const IVORY = [1.55, 1.45, 1.22];
  const IVORY_HOT = [2.55, 2.5, 2.35];

  function edict(R, x1, z1, x2, z2, w, a, prog, live, tt) {
    if (!ok(R) || !(a > 0.02)) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz);
    if (L < 8) return;
    const rot = Math.atan2(dz, dx);
    const nx = Math.cos(rot + Math.PI / 2), nz = Math.sin(rot + Math.PI / 2);
    const cx = x1 + dx * 0.5, cz = z1 + dz * 0.5;
    const half = w * 0.5;

    // the two rails: constant width the whole way, so it reads as ruled paper
    for (const s of [-1, 1]) {
      R.draw(U.box, mm(cx + nx * s * half, 3.4, cz + nz * s * half, rot, L, 3.4, Math.max(3, w * 0.08)),
        mat([1, 1, 1], { emissive: live ? IVORY_HOT : IVORY, emisK: live ? 2.4 : 1.7, alpha: 0.9 * a, shadow: false }));
    }
    // rungs, every stretch of the corridor
    const n = Math.max(2, Math.round(L / 88));
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      R.draw(U.box, mm(x1 + dx * u, 3.2, z1 + dz * u, rot + Math.PI / 2, w, 2.6, Math.max(2, w * 0.045)),
        mat([1, 1, 1], { emissive: IVORY, emisK: 1.5, alpha: 0.5 * a, shadow: false }));
    }
    if (!live) return;

    // the filled page and its hard leading slab: a wall of law, square-shouldered
    R.draw(U.box, mm(cx, 2.6, cz, rot, L, 1.8, w * 0.78),
      mat([1, 1, 1], { emissive: IVORY, emisK: 1.5, alpha: 0.26, shadow: false }));
    R.draw(U.box, mm(x2, 44, z2, rot, 16, 88, w * 1.02),
      mat([1, 1, 1], { emissive: IVORY_HOT, emisK: 2.8, alpha: 0.95, shadow: false }));
    R.draw(U.box, mm(x2, 30, z2, rot, 9, 56, w * 0.6),
      mat([1, 1, 1], { emissive: IVORY_HOT, emisK: 3.2, alpha: 1, shadow: false }));
    R.glow(x2, 40, z2, w * 1.9, 1.85, 1.75, 1.5, 0.5, 0);
    // a seal struck at the far end of the page
    stamp(R, x2, z2, w * 0.85, 0.8, tt, 3);
  }

  function throat(R, x1, z1, x2, z2, w, a, prog, live, tt) {
    if (!ok(R) || !(a > 0.02)) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz);
    if (L < 8) return;
    const rot = Math.atan2(dz, dx);
    const nx = Math.cos(rot + Math.PI / 2), nz = Math.sin(rot + Math.PI / 2);

    // the ground: uneven blobs of soot and ember, never a clean stripe
    const n = Math.max(4, Math.round(L / 66));
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const wob = Math.sin(i * 2.7 + tt * 3) * w * 0.24;
      const px = x1 + dx * u + nx * wob, pz = z1 + dz * u + nz * wob;
      const rr = w * (0.46 + 0.34 * Math.abs(Math.sin(i * 1.9 + tt * 2)));
      R.decal(px, pz, rr * 2.2, 0.07, 0.05, 0.045, 0.6, 0, 0, rot + tt * 0.2, true, 1.1);
      R.decal(px, pz, rr * 1.3, EMBER[0], EMBER[1], EMBER[2], 0.10 + 0.22 * a, 0, 0, 0, true, 1.5);
    }

    // tongues of flame down both edges, splaying wider as the verse runs on
    const m = Math.max(6, Math.round(L / 52));
    for (let i = 0; i < m; i++) {
      const u = i / (m - 1);
      const spread = w * (0.34 + 0.62 * u);
      const h = w * (0.45 + 0.8 * Math.abs(Math.sin(i * 2.3 + tt * 4))) * (live ? 1 : 0.4 + 0.5 * a);
      for (const s of [-1, 1]) {
        R.draw(U.cone, mm(x1 + dx * u + nx * s * spread, h * 0.45, z1 + dz * u + nz * s * spread, rot + s * 0.55, w * 0.13, h, w * 0.13),
          mat([1, 1, 1], { emissive: live ? EMBER_HOT : EMBER, emisK: live ? 2.5 : 1.6, alpha: live ? 0.9 : 0.35 + 0.4 * a, shadow: false }));
      }
    }
    if (!live) return;

    // the body of the fire: stacked flames, no slab anywhere in it
    for (let i = 0; i < m; i++) {
      const u = i / (m - 1);
      const h = 48 + 78 * Math.abs(Math.sin(i * 1.4 + tt * 7));
      R.draw(U.cone, mm(x1 + dx * u, h * 0.45, z1 + dz * u, 0, w * (0.3 + 0.16 * Math.sin(i + tt * 5)), h, w * (0.3 + 0.16 * Math.sin(i + tt * 5))),
        mat([1, 1, 1], { emissive: EMBER, emisK: 2.0, alpha: 0.5, shadow: false }));
      R.draw(U.cone, mm(x1 + dx * u, h * 0.3, z1 + dz * u, 0, w * 0.14, h * 0.55, w * 0.14),
        mat([1, 1, 1], { emissive: EMBER_HOT, emisK: 2.8, alpha: 0.7, shadow: false }));
    }
    R.glow(x2, 40, z2, w * 3.0, 1.95, 0.9, 0.35, 0.85, 0);
    R.light(x2, z2, 50, 300, 1.9, 0.8, 0.35, 0.85);
    for (let i = 0; i < 4; i++) {
      const u = Math.random();
      R.emit({
        x: x1 + dx * u, y: 20 + Math.random() * 80, z: z1 + dz * u,
        vx: (Math.random() - 0.5) * 90, vy: 70 + Math.random() * 140, vz: (Math.random() - 0.5) * 90,
        life: 0.5 + Math.random() * 0.5, age: 0, s0: 9, s1: 1,
        col: Math.random() < 0.5 ? EMBER : EMBER_HOT, a: 0.9, kind: 0, drag: 0.45
      });
    }
  }

  // =========================================================================
  //  WAVES — an expanding square of law vs a ragged front of fire
  // =========================================================================
  function frame(R, x, z, r, a, tt, thick) {
    if (!ok(R) || !(a > 0.02) || r < 4) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const th = Math.max(3, thick || 7);
    const rot = (tt || 0) * 0.12;
    for (let i = 0; i < 4; i++) {
      const an = rot + i * Math.PI / 2;
      R.draw(U.box, mm(x + Math.cos(an) * r, 9, z + Math.sin(an) * r, an + Math.PI / 2, r * 2, 12, th),
        mat([1, 1, 1], { emissive: IVORY_HOT, emisK: 2.6, alpha: a, shadow: false }));
    }
    // studs on the corners, so it reads as a stamped border, not a ring
    for (let i = 0; i < 4; i++) {
      const an = rot + Math.PI / 4 + i * Math.PI / 2;
      R.draw(U.box, mm(x + Math.cos(an) * r * 1.32, 11, z + Math.sin(an) * r * 1.32, an, th * 2.4, 14, th * 2.4),
        mat([1, 1, 1], { emissive: GOLD, emisK: 2.2, alpha: a * 0.9, shadow: false }));
    }
  }

  function fireFront(R, x, z, r, a, tt) {
    if (!ok(R) || !(a > 0.02) || r < 4) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const n = Math.max(8, Math.min(60, Math.round(r * 0.26)));
    for (let i = 0; i < n; i++) {
      const an = (i / n) * TAU + (tt || 0) * 0.25;
      const rr = r * (0.84 + 0.26 * Math.abs(Math.sin(i * 3.1 + (tt || 0) * 5)));
      const h = 14 + 34 * Math.abs(Math.sin(i * 1.7 + (tt || 0) * 6));
      R.draw(U.cone, mm(x + Math.cos(an) * rr, h * 0.4, z + Math.sin(an) * rr, an, 11, h, 11),
        mat([1, 1, 1], { emissive: EMBER_HOT, emisK: 2.3, alpha: 0.5 * a, shadow: false }));
    }
    R.decal(x, z, r * 2.1, 0.10, 0.06, 0.045, 0.28 * a, 0, 0, 0, true, 1.0);
  }

  function edict2(ctx, x1, y1, x2, y2, w, a, prog, live) {
    if (!ctx || !(a > 0.02)) return;
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    if (L < 6) return;
    const nx = -dy / L, ny = dx / L, half = w * 0.5;
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = live ? 'rgba(255,255,250,' + (0.95 * a) + ')' : 'rgba(238,232,214,' + (0.8 * a) + ')';
    ctx.lineWidth = Math.max(2, w * 0.09);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x1 + nx * s * half, y1 + ny * s * half);
      ctx.lineTo(x2 + nx * s * half, y2 + ny * s * half);
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(1.5, w * 0.045);
    const n = Math.max(2, Math.round(L / 88));
    for (let i = 0; i <= n; i++) {
      const u = i / n, px = x1 + dx * u, py = y1 + dy * u;
      ctx.beginPath();
      ctx.moveTo(px - nx * half, py - ny * half);
      ctx.lineTo(px + nx * half, py + ny * half);
      ctx.stroke();
    }
    ctx.restore();
    if (live) {
      ctx.save();
      ctx.translate(x2, y2);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.fillStyle = 'rgba(255,255,250,.95)';
      ctx.fillRect(-8, -w * 0.52, 16, w * 1.04);
      ctx.restore();
    }
  }

  function throat2(ctx, x1, y1, x2, y2, w, a, prog, live, t) {
    if (!ctx || !(a > 0.02)) return;
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    if (L < 6) return;
    const nx = -dy / L, ny = dx / L;
    ctx.save();
    const m = Math.max(6, Math.round(L / 52));
    for (let i = 0; i < m; i++) {
      const u = i / (m - 1);
      const spread = w * (0.34 + 0.62 * u);
      const h = w * (0.5 + 0.85 * Math.abs(Math.sin(i * 2.3 + t * 4))) * (live ? 1 : 0.4 + 0.5 * a);
      for (const s of [-1, 1]) {
        const px = x1 + dx * u + nx * s * spread, py = y1 + dy * u + ny * s * spread;
        ctx.fillStyle = live ? 'rgba(255,214,150,.92)' : 'rgba(255,132,60,' + (0.35 + 0.45 * a) + ')';
        ctx.beginPath();
        ctx.moveTo(px, py - h * 0.55);
        ctx.quadraticCurveTo(px + w * 0.14, py, px, py + h * 0.35);
        ctx.quadraticCurveTo(px - w * 0.14, py, px, py - h * 0.55);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function frame2(ctx, x, y, r, a, rot) {
    if (!ctx || !(a > 0.02) || r < 4) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.strokeStyle = 'rgba(255,255,250,' + a + ')';
    ctx.lineWidth = Math.max(3, r * 0.05);
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(201,154,61,' + (a * 0.95) + ')';
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) ctx.fillRect(sx * r * 1.32 - 5, sy * r * 1.32 - 5, 10, 10);
    ctx.restore();
  }

  function fireFront2(ctx, x, y, r, a, t) {
    if (!ctx || !(a > 0.02) || r < 4) return;
    const n = Math.max(8, Math.min(60, Math.round(r * 0.26)));
    for (let i = 0; i < n; i++) {
      const an = (i / n) * TAU + (t || 0) * 0.25;
      const rr = r * (0.84 + 0.26 * Math.abs(Math.sin(i * 3.1 + (t || 0) * 5)));
      const h = 12 + 26 * Math.abs(Math.sin(i * 1.7 + (t || 0) * 6));
      const px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr;
      ctx.fillStyle = 'rgba(255,190,120,' + (0.5 * a) + ')';
      ctx.beginPath(); ctx.arc(px, py, h * 0.3, 0, TAU); ctx.fill();
    }
  }

  window.SentinelFX = {
    stamp, burn, frost, ledger, frost2, burn2,
    edict, throat, frame, fireFront, edict2, throat2, frame2, fireFront2
  };
})();
