/* =====================================================================
   melee_viewmodel.js — the hands that swing the weapon in first person.

   The gun viewmodel's hand grips a pistol frame, which reads wrong on a
   blade, a fist or a heel. This file gives melee its own rig: a fist
   wrapped round the haft with the forearm behind it (a second hand on the
   long two-handers), a bare fist for the punch weapons, and no hands at
   all for a kick.

   The hand is not a rigid prop: through the swing the fingers tighten,
   the thumb clamps down, the grip slides a little up the haft and the
   wrist rolls around it, then everything eases back to the resting hold.
   A punch opens, closes on the impact and relaxes again.

   The whole rig rides the same pose the weapon is drawn with
   (render3d_fx stores it on R.vm.pose), so hand, wrist and forearm sweep
   through the arc with the blade.
   ===================================================================== */
(function (G) {
  'use strict';

  const R = G.Render3D;
  if (!R || typeof R.vmUpdate !== 'function') return;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const pool = [];
  for (let i = 0; i < 64; i++) pool.push(new Float32Array(16));
  let pi = 0;
  const next = () => pool[pi++ % pool.length];
  const _P = new Float32Array(16), _Q = new Float32Array(16);
  const _H = new Float32Array(16), _HH = new Float32Array(16), _T = new Float32Array(16);

  // point / ellipsoid / capsule helpers, all placed in a given frame
  const tpIn = (F, x, y, z) => [
    F[0] * x + F[4] * y + F[8] * z + F[12],
    F[1] * x + F[5] * y + F[9] * z + F[13],
    F[2] * x + F[6] * y + F[10] * z + F[14]
  ];

  function makeRig(L, vInv) {
    const M = G.GL3D.M, U = R.unit;
    const ellIn = (F, x, y, z, sx, sy, sz, mt) => {
      M.trs(_P, x, y, z, 0, sx, sy, sz); M.mul(_Q, F, _P);
      L.push(U.sphere, M.mul(next(), vInv, _Q), mt);
    };
    const segIn = (F, a0, b0, r, mt) => {
      const a = tpIn(F, a0[0], a0[1], a0[2]), b = tpIn(F, b0[0], b0[1], b0[2]);
      let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const Ln = Math.hypot(dx, dy, dz) || 1; dx /= Ln; dy /= Ln; dz /= Ln;
      let qx = 0, qy = 0, qz = 0; if (Math.abs(dy) < .9) qy = 1; else qx = 1;
      let xx = qy * dz - qz * dy, xy = qz * dx - qx * dz, xz = qx * dy - qy * dx;
      const xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
      const zx = xy * dz - xz * dy, zy = xz * dx - xx * dz, zz = xx * dy - xy * dx;
      _P[0] = xx * r; _P[1] = xy * r; _P[2] = xz * r; _P[3] = 0;
      _P[4] = dx * Ln; _P[5] = dy * Ln; _P[6] = dz * Ln; _P[7] = 0;
      _P[8] = zx * r; _P[9] = zy * r; _P[10] = zz * r; _P[11] = 0;
      _P[12] = a[0]; _P[13] = a[1]; _P[14] = a[2]; _P[15] = 1;
      L.push(U.cyl, M.mul(next(), vInv, _P), mt);
    };
    return { ellIn, segIn };
  }

  function buildHands(L, vInv, p, kind, c3, k, roll) {
    const M = G.GL3D.M;
    const { ellIn, segIn } = makeRig(L, vInv);

    // the weapon's own frame: same composition render3d_fx uses
    M.trs(_H, 0, 0, 0, p.ry, 1, 1, 1, p.rx, p.rz);
    M.trs(_T, 0, 0, 0, -p.yaw, 1, 1, 1);
    M.mul(_H, _H, _T);
    _H[12] = p.px; _H[13] = p.py; _H[14] = p.pz;

    const skin = R.mat(c3, { metal: .45, rough: .3, emissive: [c3[0] * .12, c3[1] * .12, c3[2] * .12], rim: .5, rimCol: c3, shadow: false });
    const cuff = R.mat([.1, .11, .15], { metal: .8, rough: .3, emissive: [.01, .03, .06], shadow: false });

    // A hand closing round the haft. `curl` 0 = open, 1 = clamped; `wr`
    // rolls the whole hand about the haft the way a wrist turns through a
    // swing, without moving the weapon itself.
    const grip = (y, side, curl, wr) => {
      M.trs(_P, 0, 0, 0, 0, 1, 1, 1, 0, wr);
      M.mul(_HH, _H, _P);
      const g = 1 + .07 * curl;
      ellIn(_HH, side * .34, y, .78, 1.10 * g, 1.35 * g, 1.05 * g, skin);   // back of the hand
      ellIn(_HH, side * .12, y + .62, .42, .96, .62, .90, skin);            // knuckles
      for (let i = 0; i < 3; i++) {
        const yy = y + .55 - i * .95, rr = .50 - i * .02;
        const a1 = [side * .95, yy, .55];
        const a2 = [lerp(side * .30, side * .22, curl), yy - lerp(.42, .05, curl), lerp(-1.05, -.80, curl)];
        const a3 = [lerp(side * .10, -side * .34, curl), yy - lerp(.55, .12, curl), lerp(-1.35, -.38, curl)];
        segIn(_HH, a1, a2, rr, skin);
        segIn(_HH, a2, a3, rr - .04, skin);
      }
      // thumb: lies along the haft when open, clamps across it when tight
      const th = [
        lerp(side * .30, -side * .32, curl),
        y + lerp(1.85, 1.38, curl),
        lerp(.30, -.28, curl)
      ];
      segIn(_HH, [side * .55, y + 1.05, .35], th, .50, skin);
      ellIn(_HH, th[0], th[1], th[2], .44, .44, .44, skin);
      ellIn(_HH, side * .40, y - 1.05, 1.05, 1.00, 1.05, .95, skin);        // wrist
    };

    if (kind === 'kick') return;                                // a boot needs no hands

    if (kind === 'punch') {
      // the fist tightens on the way in and lets go on the way out
      const open = 1 - k;
      ellIn(_H, 0, 0, .35, 1.30, 1.30, 1.20, skin);
      for (let i = 0; i < 4; i++) {
        ellIn(_H, -.95 + i * .63, .95 - .10 * k, .10 + .34 * k, .34, .38, .34, skin);
      }
      ellIn(_H, 0, -.35 + .10 * k, 1.15, 1.05, 1.00, 1.00, skin);
      segIn(_H, [.15, -.55, .55], [1.35, 1.05 - .35 * k, -.45], .52, skin);   // thumb across
      segIn(_H, [.20, -1.30, 1.30], [4.40, -8.60, 11.60], 1.35, skin);
      segIn(_H, [.55, -2.35, 2.10], [1.10, -3.60, 4.40], 1.62, cuff);
      void open;
      return;
    }

    // blade: fist on the haft (the sprite's handle sits below its pivot),
    // plus a supporting hand up the haft on the long two-handers
    const slide = -.70 * k;                       // the grip rides up as it drives
    const curl = .45 + .55 * k;
    grip(1.60 + slide, 1, curl, roll);
    segIn(_H, [.35, .10 + slide, 1.45], [4.30, -8.70, 11.50], 1.34, skin);
    segIn(_H, [.62, -1.10 + slide, 2.10], [1.15, -3.65, 4.45], 1.60, cuff);
    if (p.twoHand) {
      // the support hand lags a beat behind the lead hand
      grip(-1.80 + slide * .6, 1, .35 + .55 * Math.max(0, k - .12) / .88, roll * .6);
      segIn(_H, [.10, -2.90 + slide * .6, 1.55], [-5.20, -9.40, 9.60], 1.28, skin);
      segIn(_H, [-.30, -3.60 + slide * .6, 2.30], [-1.30, -6.40, 4.60], 1.52, cuff);
    }
  }

  function drawMelee(R2, F) {
    const v = R2.vm;
    if (!v || !v.on || !v.pose) return;
    const me = F && F.me;
    if (!me || !me.melee) return;
    const kind = me.melee.kind || 'blade';
    const c3 = R2.hexRGB ? R2.hexRGB(me.color || '#aef') : [.72, .88, 1];
    // strike envelope: nothing at rest, peak just past the middle of the swing
    const t = me.melee.state === 'using' ? clamp(me.melee.t || 0, 0, 1) : 0;
    const k = Math.sin(Math.pow(t, 1.2) * Math.PI);
    const roll = clamp((v.pose.rz || 0) * .5 + (k - .2) * .18, -.55, .55);
    const vInv = G.GL3D.M.inv(next(), R2.view);
    try { buildHands(R2.vmList, vInv, v.pose, kind, c3, k, roll); }
    catch (e) { if (!drawMelee._err) { drawMelee._err = 1; console.warn('[melee viewmodel]', e); } }
  }

  const orig = R.vmUpdate;
  R.vmUpdate = function (F, dt, tt) {
    const r = orig.apply(this, arguments);
    drawMelee(R, F);
    return r;
  };

  G.MeleeView = { ready: true, draw: drawMelee };
})(window);
