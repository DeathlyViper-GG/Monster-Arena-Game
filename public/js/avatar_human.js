/* =====================================================================
   avatar_human.js — the Human Model Pack fighters, drawn in the arena.

   A real humanoid built from the engine's own primitives: pelvis, torso, head,
   two-boned arms and legs. The gait comes from the fighter's measured speed,
   so it walks when it walks, sprints when it dashes, tucks its legs in the air
   and shoulders the gun when it fires. The fifteen skins dress it — bone
   spikes, maws, hex plates, halos, flames, shards, nano arms, horns, blades
   and the five wing sets.

   Draws only when the player owns the pack and has a human selected; the
   hovering shell (avatar_model.js) stays the default body.
   ===================================================================== */
(function (G) {
  'use strict';

  const R = G.Render3D;
  if (!R) return;

  const U = (n) => R.unit[n];
  const mm = (...a) => R.mm(...a);
  const mat = (c, o) => R.mat(c, o);
  const hex = (h) => R.hexRGB(h);
  const DEF = { skin: '#d9a47f', shirt: '#2f6f7a', pants: '#3b4252', boot: '#20232b', hair: '#2a1d16' };

  // Measured speed per fighter, so the legs follow the ground they cover.
  const prev = new Map();
  function speedOf(key, x, z, tt) {
    const p = prev.get(key);
    prev.set(key, { x, z, tt });
    if (!p) return 0;
    const dt = Math.max(1 / 240, tt - p.tt);
    return Math.hypot(x - p.x, z - p.z) / dt;
  }

  function draw(q) {
    const x = q.x, z = q.z, ang = q.ang || 0, r = q.r || 16, tt = q.tt || 0;
    const o = q.o || {}, mot = o.mot || {};
    const sk = (G.HumanPack && G.HumanPack.skinData && G.HumanPack.skinData()) || DEF;
    const P = (k) => hex(sk[k] || DEF[k]);
    const H = (G.AvatarStyle ? G.AvatarStyle.heightFor(r) : r * 4);

    const ca = Math.cos(ang), sa = Math.sin(ang);
    const WX = (lx, lz) => x + ca * lx - sa * lz;
    const WZ = (lx, lz) => z + sa * lx + ca * lz;

    const spd = speedOf(o.key || 'p', x, z, tt);
    const moving = spd > 12;
    const dash = mot.dash || 0, air = mot.air || 0, kick = mot.kick || 0, rel = mot.reload || 0;
    const gun = o.gun !== false && !o.equipMelee;

    /* ---- gait ---------------------------------------------------------- */
    const ph = tt * (moving ? Math.min(11, 4 + spd / 34) : 1.7);
    const sw = Math.sin(ph);
    const amp = moving ? Math.min(.6, .16 + spd / 340) : 0;
    const lean = (dash ? .3 : 0) + (moving ? .06 : 0) - kick * .12;

    /* ---- joints (angles are forward-positive) -------------------------- */
    let thL = amp * sw, thR = -amp * sw;
    let knL = Math.max(0, -sw) * amp * 2.4, knR = Math.max(0, sw) * amp * 2.4;
    if (air > .02) {
      const t = Math.min(1, air);
      thL = .3 + .5 * t; thR = .08 + .28 * t; knL = .6 + .7 * t; knR = .25 + .45 * t;
    }
    let arL, elL, arR, elR;
    if (gun) { arR = .78 + kick * .34; elR = .58; arL = .96 + kick * .18; elL = .84; }
    else { arL = .1 - .45 * amp * sw; arR = .1 + .45 * amp * sw; elL = .35; elR = .35; }
    if (rel > .02) { arR += .4; elR += .55; arL += .45; elL += .5; }

    const hipY = .50 * H, thigh = .235 * H, shin = .21 * H, ankleH = .045 * H;
    const shY = .79 * H, upper = .16 * H, fore = .15 * H, halfSh = .097 * H, halfHip = .052 * H;

    const kxL = Math.sin(thL) * thigh, kyL = hipY - Math.cos(thL) * thigh;
    const shAL = thL - knL;
    const axL = kxL + Math.sin(shAL) * shin, ayL = kyL - Math.cos(shAL) * shin;
    const kxR = Math.sin(thR) * thigh, kyR = hipY - Math.cos(thR) * thigh;
    const shAR = thR - knR;
    const axR = kxR + Math.sin(shAR) * shin, ayR = kyR - Math.cos(shAR) * shin;

    // the lowest foot plants the body (the bob of the walk falls out of it),
    // without letting a wide stride sink the whole figure through the floor
    const dy = Math.max(ankleH - Math.min(ayL, ayR), ankleH - (hipY - thigh - shin) - .015 * H) + air * .18 * H;
    const leanF = Math.sin(lean) * .15 * H;

    /* ---- materials ------------------------------------------------------ */
    const mSkin = mat(P('skin'), { rough: .78, metal: .06 });
    const mShirt = mat(P('shirt'), { rough: .82, metal: .05 });
    const mPants = mat(P('pants'), { rough: .86, metal: .04 });
    const mBoot = mat(P('boot'), { rough: .7, metal: .18 });
    const mHair = mat(P('hair'), { rough: .92, metal: .02 });
    if (o.flash) { [mSkin, mShirt, mPants].forEach((m) => { m.flash = o.flash; }); }

    /* ---- part helpers --------------------------------------------------- */
    const ball = (lx, ly, lz, sx, sy, sz, m) =>
      R.draw(U('sphere'), mm(WX(lx, lz), ly + dy, WZ(lx, lz), ang, sx, sy, sz), m);
    const seg = (lx1, ly1, lx2, ly2, lz, rad, m) => {
      const len = Math.max(.01, Math.hypot(lx2 - lx1, ly2 - ly1));
      const phi = Math.atan2(lx2 - lx1, ly1 - ly2);
      R.draw(U('cyl'), mm(WX(lx1, lz), ly1 + dy, WZ(lx1, lz), ang, rad, len, rad, 0, Math.PI + phi), m);
    };
    const cone = (lx, ly, lz, rad, len, tilt, m) =>
      R.draw(U('cone'), mm(WX(lx, lz), ly + dy, WZ(lx, lz), ang, rad, len, rad, 0, tilt), m);

    /* ---- legs ----------------------------------------------------------- */
    for (const s of [-1, 1]) {
      const kx = s > 0 ? kxR : kxL, ky = s > 0 ? kyR : kyL, ax = s > 0 ? axR : axL, ay = s > 0 ? ayR : ayL;
      const sh = s > 0 ? shAR : shAL;
      const lz = s * halfHip;
      seg(0, hipY, kx, ky, lz, .046 * H, mPants);
      ball(kx, ky, lz, .04 * H, .04 * H, .04 * H, mPants);
      seg(kx, ky, ax, ay, lz, .037 * H, mPants);
      R.draw(U('box'), mm(WX(ax + .042 * H, lz), ay - .014 * H + dy, WZ(ax + .042 * H, lz), ang,
        .118 * H, .038 * H, .06 * H, 0, -sh * .35 + .02), mBoot);
    }

    /* ---- torso, head ---------------------------------------------------- */
    ball(0, hipY, 0, .086 * H, .062 * H, .062 * H, mPants);
    seg(0, hipY + .01 * H, leanF, shY, 0, .079 * H, mShirt);
    ball(leanF * .62, shY - .07 * H, 0, .097 * H, .09 * H, .07 * H, mShirt);
    seg(leanF, shY - .01 * H, leanF + .012 * H, shY + .045 * H, 0, .034 * H, mSkin);
    const headY = shY + .118 * H;
    ball(leanF + .014 * H, headY, 0, .052 * H, .058 * H, .049 * H, mSkin);
    ball(leanF, headY + .024 * H, -.006 * H, .055 * H, .05 * H, .052 * H, mHair);
    R.draw(U('box'), mm(WX(leanF + .056 * H, 0), headY + dy, WZ(leanF + .056 * H, 0), ang,
      .026 * H, .017 * H, .02 * H), mSkin);
    for (const s of [-1, 1]) ball(leanF + .05 * H, headY + .008 * H, s * .021 * H, .0085 * H, .0085 * H, .0085 * H,
      mat([.05, .06, .08], { metal: .85, rough: .2 }));

    /* ---- arms ----------------------------------------------------------- */
    for (const s of [-1, 1]) {
      const ar = s > 0 ? arR : arL, el = s > 0 ? elR : elL;
      const lz = s * halfSh;
      const ex = leanF + Math.sin(ar) * upper, ey = shY - Math.cos(ar) * upper;
      const hx = ex + Math.sin(ar + el) * fore, hy = ey - Math.cos(ar + el) * fore;
      ball(leanF, shY, lz, .05 * H, .052 * H, .05 * H, mShirt);
      seg(leanF, shY, ex, ey, lz, .035 * H, mShirt);
      ball(ex, ey, lz, .033 * H, .033 * H, .033 * H, mSkin);
      seg(ex, ey, hx, hy, lz, .029 * H, mSkin);
      ball(hx, hy, lz, .034 * H, .04 * H, .031 * H, mSkin);
    }

    /* ---- the skin's own design ------------------------------------------ */
    const acc = (c, e) => mat(c, { emissive: e, metal: .55, rough: .3, shadow: false });
    const BONE = mat([.9, .86, .75], { rough: .55, metal: .12 });
    const GOLD = mat([.88, .65, .18], { emissive: [.3, .2, .02], metal: .8, rough: .25 });
    const CYAN = acc([.22, .91, 1], [.3, 1.1, 1.4]);
    const VIOLET = acc([.7, .34, 1], [.5, .18, 1.1]);
    const FIRE = acc([1, .45, .12], [1.5, .5, .08]);
    const ICE = acc([.75, .93, 1], [.3, .7, 1.1]);

    switch (skinIndex()) {
      case 1: {                                                   // Spikes Shell
        for (let i = -2; i <= 2; i++) {
          const k = 2 - Math.abs(i);
          cone(-.058 * H, shY - .02 * H + k * .022 * H, i * .034 * H, .016 * H, (.055 + k * .018) * H, i * .13, BONE);
        }
        for (const s of [-1, 1]) cone(leanF, shY + .02 * H, s * halfSh, .017 * H, .07 * H, s * .95, BONE);
        break;
      }
      case 2: {                                                   // Toothy Maw
        const dark = mat([.2, .03, .07], { rough: .5 });
        R.draw(U('box'), mm(WX(leanF + .048 * H, 0), headY - .016 * H + dy, WZ(leanF + .048 * H, 0), ang,
          .03 * H, .024 * H, .046 * H), dark);
        for (let i = -2; i <= 2; i++) {
          const lz = i * .011 * H;
          cone(leanF + .052 * H, headY - .007 * H, lz, .006 * H, .017 * H, Math.PI, mat([1, 1, 1], { rough: .35 }));
        }
        break;
      }
      case 3: {                                                   // Hex Armour
        for (let k = 0; k < 2; k++) {
          const rr = .072 * H - k * .014 * H;
          R.draw(U('hexRing'), mm(WX(leanF * .7, 0), hipY + (.29 - k * .09) * H + dy, WZ(leanF * .7, 0),
            ang, rr, rr, rr, Math.PI / 2, .3), GOLD);
        }
        for (const s of [-1, 1]) {
          R.draw(U('hexRing'), mm(WX(leanF, s * halfSh), shY + .03 * H + dy, WZ(leanF, s * halfSh),
            ang, .042 * H, .042 * H, .042 * H, Math.PI / 2, 0), GOLD);
        }
        break;
      }
      case 4: {                                                   // Cyber Halo
        for (let k = 0; k < 2; k++) {
          const rr = (.19 - k * .05) * H * .55;
          R.draw(U('torus'), mm(WX(leanF, 0), headY + (.11 + k * .03) * H + dy, WZ(leanF, 0),
            ang, rr, rr, rr, Math.PI / 2 + .12, tt * (k ? -1.6 : 1.1)), CYAN);
        }
        R.draw(U('box'), mm(WX(leanF + .052 * H, 0), headY + .006 * H + dy, WZ(leanF + .052 * H, 0), ang,
          .016 * H, .014 * H, .048 * H), CYAN);
        break;
      }
      case 5: {                                                   // Void Flame
        const tuft = (lx, ly, lz, s) => {
          const k = 1 + .3 * Math.sin(tt * 11 + lx * 4);
          cone(lx, ly, lz, .026 * H * s, .13 * H * s * k, 0, VIOLET);
          cone(lx, ly, lz, .017 * H * s, .2 * H * s * k, 0, acc([.36, .1, .9], [.4, .1, 1.2]));
        };
        tuft(leanF, headY + .03 * H, 0, 1);
        for (const s of [-1, 1]) { tuft(leanF, shY, s * halfSh, .8); }
        break;
      }
      case 6: {                                                   // Crystal Shards
        for (const s of [-1, 1]) {
          cone(leanF, shY + .02 * H, s * halfSh, .02 * H, .13 * H, s * .9, ICE);
          cone(leanF - .04 * H, shY - .04 * H, s * halfSh * .8, .017 * H, .1 * H, s * .5, ICE);
        }
        for (let i = -1; i <= 1; i++) cone(-.06 * H, shY - .02 * H, i * .04 * H, .016 * H, .1 * H, i * .3, ICE);
        cone(leanF, headY + .04 * H, 0, .016 * H, .08 * H, .1, ICE);
        break;
      }
      case 7: {                                                   // Nano Arms
        for (const s of [-1, 1]) {
          const ar = s > 0 ? arR : arL, el = s > 0 ? elR : elL, lz = s * halfSh;
          const ex = leanF + Math.sin(ar) * upper, ey = shY - Math.cos(ar) * upper;
          for (let k = 0; k < 4; k++) {
            const a = tt * 2.4 + k * 1.6 + (s > 0 ? 0 : 2);
            ball(ex + Math.cos(a) * .045 * H, ey - .04 * H + Math.sin(a) * .03 * H, lz + Math.sin(a) * .04 * H,
              .011 * H, .011 * H, .011 * H, acc([1, .48, .1], [1.3, .4, .05]));
          }
          void el;
        }
        break;
      }
      case 8: {                                                   // Plasma Horns
        for (const s of [-1, 1]) {
          cone(leanF, headY + .03 * H, s * .035 * H, .017 * H, .075 * H, s * .55, mat([.16, .05, .07], { rough: .5 }));
          cone(leanF - .01 * H, headY + .085 * H, s * .055 * H, .012 * H, .06 * H, s * .85, acc([1, .31, .85], [1.2, .2, 1]));
        }
        break;
      }
      case 9: {                                                   // Tri-Blade Wheel
        const wy = shY - .06 * H, wl = -.07 * H;
        R.draw(U('torus'), mm(WX(wl, 0), wy + dy, WZ(wl, 0), ang, .12 * H, .12 * H, .12 * H, Math.PI / 2, tt * -3),
          mat([.62, .68, .76], { metal: .85, rough: .25 }));
        for (let k = 0; k < 3; k++) {
          const a = tt * -3 + k * 2.094;
          const lz = Math.sin(a) * .12 * H, ly = wy + Math.cos(a) * .12 * H;
          R.draw(U('box'), mm(WX(wl, lz), ly + dy, WZ(wl, lz), ang, .028 * H, .1 * H, .02 * H, 0, -a), GOLD);
        }
        break;
      }
      case 0: break;                                              // Default: no design
      default: {                                                  // 10-14: wings
        const kind = skinIndex() - 10;
        const fast = kind === 4;
        const flap = Math.sin(tt * (fast ? 24 : 3.2)) * (fast ? .2 : .3);
        for (const s of [-1, 1]) {
          for (let f = 0; f < 4; f++) {
            const spread = .82 + f * .17 + flap;
            const lx = -.05 * H - Math.cos(spread) * (.09 + f * .028) * H;
            const lz = s * (.035 + Math.sin(spread) * (.12 + f * .05)) * H;
            const ly = shY - .04 * H + f * .014 * H;
            const len = (.2 + f * .032) * H, wid = (.026 + f * .011) * H;
            const yaw = ang + s * (1.02 + f * .07);
            if (kind === 0) R.draw(U('sphere'), mm(WX(lx, lz), ly + dy, WZ(lx, lz), yaw, len, wid * .5, wid * 2.2),
              mat([1, .98, .9], { emissive: [.24, .21, .15], rough: .5, rim: .6, rimCol: [1, .9, .6] }));
            else if (kind === 1) R.draw(U('box'), mm(WX(lx, lz), ly + dy, WZ(lx, lz), yaw, len, wid * .7, wid * 2.4),
              mat([.07, .13, .19], { metal: .9, rough: .2, emissive: [.1, .55, 1] }));
            else if (kind === 2) R.draw(U('cone'), mm(WX(lx, lz), ly + dy, WZ(lx, lz), yaw + Math.PI, wid, len, wid, 0, -Math.PI / 2),
              mat([.12, .05, .22], { emissive: [.5, .1, .85], metal: .4, rough: .3 }));
            else if (kind === 3) R.draw(U('sphere'), mm(WX(lx, lz), ly + dy, WZ(lx, lz), yaw, len, wid * .9, wid * 2.4),
              mat([1, .45, .1], { emissive: [1.6, .5, .08], shadow: false }));
            else R.draw(U('sphere'), mm(WX(lx, lz), ly + dy, WZ(lx, lz), yaw, len, wid * .25, wid * 3),
              mat([.5, .95, 1], { emissive: [.2, .6, .7], alpha: .5, shadow: false, rim: 1, rimCol: [.5, 1, 1] }));
          }
          if (kind === 1) R.glow(WX(-.05 * H, s * .16 * H), shY + dy, WZ(-.05 * H, s * .16 * H), .35 * H, .15, .7, 1.2, .18, 0);
          if (kind === 3) R.glow(WX(-.05 * H, s * .14 * H), shY + dy, WZ(-.05 * H, s * .14 * H), .4 * H, 1.2, .4, .1, .16, 0);
        }
        break;
      }
    }

    // the gun sits where the hands are
    const hb = .645 * H + dy;
    return { hb: hb, human: true };
  }

  function skinIndex() {
    const st = G.HumanPack && G.HumanPack.skin;
    const i = st ? st() : -1;
    return i >= 0 ? i : 0;
  }

  G.AvatarHuman = { draw };
})(window);
