/* =====================================================================
   avatar_model.js — the fighter as a hovering sphere.

   Every player, bot and remote is a lit sphere with a glowing "eye" facing
   the way they aim, floating on a slow bob. The selected model adds its own
   design around that sphere: rings, spikes, fangs, hex bands, halos, shards,
   horns, blades and the five wing sets.

   render3d_fx.js keeps the weapon, the shield and the aura and only asks here
   for the body, so the sphere's hover height comes back as { hb } and the gun
   stays in the figure's hands, exactly as it always did.
   ===================================================================== */
(function (G) {
  'use strict';

  const R = G.Render3D;
  const TAU = Math.PI * 2;
  const hex = (h) => R.hexRGB(h);
  const U = (n) => R.unit[n];
  const mm = (...a) => R.mm(...a);
  const mat = (c, o) => R.mat(c, o);
  const parts = () => (R.q ? R.q.parts : 1);

  function draw(q) {
    const { x, z, ang, r, design, colHex, tt } = q;
    const o = q.o || {};
    const c3 = hex(colHex);
    const hb = r * .95 + 7 + Math.sin(tt * 2.6 + (o.ph || 0)) * 1.4;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const loc = (lx, lz) => [x + ca * lx - sa * lz, z + sa * lx + ca * lz];

    // ---- the ball itself
    const body = mat(c3, { metal: .55, rough: .22, emissive: [c3[0] * .1, c3[1] * .1, c3[2] * .1], rim: .6, rimCol: c3 });
    if (o.flash) body.flash = o.flash;
    const bodyAlpha = o.alpha === undefined ? 1 : o.alpha; if (bodyAlpha < 1) body.alpha = bodyAlpha;
    R.draw(U('sphere'), mm(x, hb, z, ang, r * .96, r * .9, r * .96), body);
    R.glow(x, hb, z, r * 2.6, c3[0] * .8, c3[1] * .8, c3[2] * .8, .55, 0);
    // glowing core + visor facing the aim direction
    const [vx, vz] = loc(r * .72, 0);
    R.draw(U('sphere'), mm(vx, hb + 1, vz, ang, r * .34, r * .26, r * .5),
      mat([.02, .03, .05], { metal: .8, rough: .1, emissive: [.1, .6, 1.2], emisK: 1 }));

    const wt = tt;
    const emit = R.emit;
    switch (design) {
      /* 0 — Pulse ring orbiting the sphere. */
      case 0: {
        const rad = r + 3 + Math.sin(wt * 4);
        R.draw(U('torus'), mm(x, hb, z, 0, rad, rad, rad), mat(c3, { emissive: [c3[0] * 1.2, c3[1] * 1.2, c3[2] * 1.2], shadow: false }));
        break;
      }

      /* 1 — Spiked Shell: a crown of bone spikes round the top of the ball. */
      case 1:
        for (let i = 0; i < 10; i++) {
          const a = i * TAU / 10 + wt * 1.2;
          R.draw(U('cone'), mm(x + Math.cos(a) * (r * .8), hb + 3, z + Math.sin(a) * (r * .8), a, 4.2, 12, 4.2, 0, -(Math.PI / 2 - .3)),
            mat([1, .39, .47], { emissive: [.6, .12, .18], metal: .4, rough: .3 }));
        }
        break;

      /* 2 — Toothy Maw: fangs ring the sphere in a slow turn. */
      case 2:
        for (let i = 0; i < 8; i++) {
          const a = i * TAU / 8 + wt * 1.5;
          R.draw(U('cone'), mm(x + Math.cos(a) * (r * .9), hb, z + Math.sin(a) * (r * .9), a, 3.6, 10, 3.6, 0, -(Math.PI / 2)),
            mat([.12, .07, .15], { metal: .6, rough: .3, emissive: [.3, .05, .1] }));
        }
        R.glow(x, hb, z, r * 3, .5, .05, .2, .35, 0);
        break;

      /* 3 — Hex Armour: three hard-light bands wrapping the ball. */
      case 3:
        for (let i = 0; i < 3; i++) {
          const rd = r + 6 + i * 1.2;
          R.draw(U('hexRing'), mm(x, hb, z, wt * .6 + i * 1.05, rd, rd, rd, i * 1.05 + wt * .4, i * .6),
            mat([.36, .5, .68], { emissive: [.25, .45, .8], metal: .8, rough: .25 }));
        }
        break;

      /* 4 — Cyber Halo: a lit ring turning above the sphere. */
      case 4: {
        const rd = r + 10;
        R.draw(U('torus'), mm(x, hb + 4, z, wt, rd, rd, rd, .35), mat([.6, .8, 1], { emissive: [.6, 1.1, 1.8], shadow: false }));
        R.glow(x, hb + 4, z, rd * 2.4, .4, .7, 1.2, .18, 0);
        break;
      }

      /* 5 — Void Flame: a ring of violet motes drifting off the shell. */
      case 5:
        for (let i = 0; i < 12; i++) {
          const a = i * TAU / 12 + Math.sin(wt * 2) * .2;
          R.glow(x + Math.cos(a) * (r + 3), hb + Math.sin(wt * 4 + i) * 3, z + Math.sin(a) * (r + 3), 11 + Math.sin(wt * 4 + i) * 3, .75, .4, 1.2, .5, 0);
        }
        if (Math.random() < .5 * parts()) emit({ x: x + (Math.random() - .5) * r * 1.6, y: hb, z: z + (Math.random() - .5) * r * 1.6, vx: 0, vy: 30, vz: 0, grav: -20, life: .7, age: 0, s0: 6, s1: 1, col: [.75, .35, 1.4], a: .7, kind: 0, drag: 1 });
        break;

      /* 6 — Crystal Shards: six splinters circling the ball. */
      case 6:
        for (let i = 0; i < 6; i++) {
          const a = i * TAU / 6 + wt;
          R.draw(U('octa'), mm(x + Math.cos(a) * (r + 10), hb + Math.sin(wt * 2 + i) * 3, z + Math.sin(a) * (r + 10), a, 3.2, 8, 3.2),
            mat([.67, .93, 1], { emissive: [.4, .8, 1.2], metal: .5, rough: .1 }));
        }
        break;

      /* 7 — Nano-Arms: green segmented limbs sweeping round the sphere. */
      case 7:
        for (let i = 0; i < 3; i++) {
          const a = wt * 2 + i * 2.09, ex = x + Math.cos(a) * (r + 8), ez = z + Math.sin(a) * (r + 8);
          R.draw(U('cyl'), mm(x + Math.cos(a) * (r * .5 + 4), hb, z + Math.sin(a) * (r * .5 + 4), a, 1.7, 1.7, 1, 0, 0), mat([0, 0, 0], { alpha: 1 }));
          R.draw(U('cyl'), mm(x + Math.cos(a) * r * .5, hb, z + Math.sin(a) * r * .5, a, 1.8, 17, 1.8, 0, -Math.PI / 2),
            mat([.49, 1, .64], { emissive: [.2, .9, .4], metal: .6, rough: .25 }));
          R.glow(ex, hb, ez, 9, .4, 1.4, .6, .8, 0);
        }
        break;

      /* 8 — Plasma Horns: a hot pair sweeping back off the shell. */
      case 8:
        for (const s of [-1, 1]) {
          const [hx, hz] = loc(-2, s * (r + 2));
          R.draw(U('sphere'), mm(hx, hb + 8, hz, ang, 5, 12, 5, 0, s * .45), mat([1, .6, .24], { emissive: [1.2, .5, .1], alpha: 1 }));
          R.glow(hx, hb + 12, hz, 16, 1.4, .6, .15, .5, 0);
        }
        break;

      /* 9 — Tri-Blade Wheel: three long blades spinning round the waist. */
      case 9:
        for (let i = 0; i < 3; i++) {
          const a = wt * 3 + i * TAU / 3;
          R.draw(U('box'), mm(x + Math.cos(a) * (r * .2 + 9), hb, z + Math.sin(a) * (r * .2 + 9), a, 18, 3, 6),
            mat([.9, .93, 1], { metal: .9, rough: .12, emissive: [.1, .1, .15] }));
        }
        break;

      default:                                                        // 10-14: wings
        wings(design, loc, x, z, hb, ang, r, wt, c3);
    }

    return { hb };
  }

  /* --------------------------------------------------------------- wings */
  function wings(design, loc, x, z, hb, ang, r, tt, c3) {
    const flap = Math.sin(tt * (design === 14 ? 26 : 3.2)) * (design === 14 ? .18 : .32);
    const emit = R.emit;
    for (const s of [-1, 1]) {
      const [bx, bz] = loc(-r * .35, s * r * .55);
      if (design === 10) {                                             // angel feathers
        for (let i = 0; i < 5; i++) {
          const a = ang + s * (1.35 + i * .2 + flap), L = 20 + i * 4.5, cx = bx + Math.cos(a) * L * .5, cz = bz + Math.sin(a) * L * .5;
          R.draw(U('sphere'), mm(cx, hb + 2 + i * .6, cz, a, L * .5, 1.6, 4.6 - i * .2),
            mat([1, .98, .92], { emissive: [.35, .32, .25], rough: .4, rim: .5, rimCol: [1, .9, .6] }));
        }
        R.glow(bx, hb + 4, bz, 26, 1.1, 1, .7, .25, 0);
      } else if (design === 11) {                                      // cyber blades
        for (let i = 0; i < 4; i++) {
          const a = ang + s * (1.5 + i * .22 + flap), L = 24 + (i % 2) * 8, cx = bx + Math.cos(a) * L * .5, cz = bz + Math.sin(a) * L * .5;
          R.draw(U('box'), mm(cx, hb + 2, cz, a, L, 1.6, 4), mat([.1, .13, .18], { metal: .9, rough: .2, emissive: [.1, .6, 1.2] }));
          R.glow(bx + Math.cos(a) * L, hb + 2, bz + Math.sin(a) * L, 7, .3, 1, 1.6, .7, 0);
        }
      } else if (design === 12) {                                      // void
        for (let i = 0; i < 4; i++) {
          const a = ang + s * (1.45 + i * .26 + flap), L = 26 - i * 2;
          R.draw(U('cone'), mm(bx, hb + 2, bz, a, 3, L, 3, 0, -Math.PI / 2), mat([.1, .04, .2], { emissive: [.55, .1, .8], metal: .4, rough: .3 }));
        }
        R.glow(bx, hb + 3, bz, 30, .7, .2, 1.1, .3, 0);
        if (Math.random() < .3 * parts()) emit({ x: bx, y: hb - 4, z: bz, vx: 0, vy: -16, vz: 0, grav: 10, life: .9, age: 0, s0: 7, s1: 1, col: [.5, .1, .9], a: .5, kind: 0, drag: .8 });
      } else if (design === 13) {                                      // fire
        for (let i = 0; i < 4; i++) {
          const a = ang + s * (1.35 + i * .24 + flap), L = 24 - i * 2, cx = bx + Math.cos(a) * L * .5, cz = bz + Math.sin(a) * L * .5;
          R.draw(U('sphere'), mm(cx, hb + 3, cz, a, L * .55, 2.2, 4.5), mat([1, .45, .1], { emissive: [1.8, .55, .08], alpha: 1, shadow: false }));
        }
        if (Math.random() < .35 * parts()) emit({ x: bx, y: hb + 4, z: bz, vx: (Math.random() - .5) * 20, vy: 28, vz: (Math.random() - .5) * 20, life: .6, age: 0, s0: 7, s1: 1, col: [1.6, .5, .1], a: .7, kind: 0, drag: 1 });
        R.glow(bx, hb + 4, bz, 32, 1.4, .5, .1, .3, 0);
      } else {                                                         // insect: translucent
        for (let i = 0; i < 2; i++) {
          const a = ang + s * (1.2 + i * .5 + flap), L = 26 - i * 5, cx = bx + Math.cos(a) * L * .5, cz = bz + Math.sin(a) * L * .5;
          R.draw(U('sphere'), mm(cx, hb + 3, cz, a, L * .5, .8, 6.5), mat([.5, .95, 1], { emissive: [.2, .6, .7], alpha: .55, shadow: false, rim: 1, rimCol: [.5, 1, 1] }));
        }
      }
    }
  }

  G.AvatarModel = { draw };
})(window);
