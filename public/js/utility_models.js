/* =====================================================================
   utility_models.js — the 3D utility models, in one place.

   Every utility is described once as a list of primitives in the model's
   own frame (+x forward, +y up, +z to the right of the grip). That single
   description feeds three consumers:
     • the in-match renderer, drawn with the arena's GL3D primitives
       (held in the player's off hand, and tumbling through the air)
     • the Customize screen's rotating preview (real three.js, lit)
     • the small 3D thumbnails in the collection grid

   Models are authored in world pixels (a player is r≈16), so a canister
   is ~10px tall and a standard is ~26px — the same scale the guns use.
   ===================================================================== */
(function (G) {
  'use strict';

  /* ------------------------------------------------------------ palette */
  const MAT = {
    metal:  { col: [.52, .58, .70], metal: .85, rough: .26 },
    dark:   { col: [.15, .17, .23], metal: .45, rough: .55 },
    steel:  { col: [.80, .85, .92], metal: .95, rough: .18 },
    gold:   { col: [1.32, 1.00, .34], metal: .90, rough: .28 },
    cloth:  { col: [.58, .22, .30], metal: .04, rough: .95 },
    bone:   { col: [.88, .87, .78], metal: .10, rough: .70 },
    accent: { col: [.34, .95, 1.45], emissive: [.22, .78, 1.30] },
    ember:  { col: [1.70, .62, .18], emissive: [1.35, .40, .06] },
    viper:  { col: [.40, 1.35, .55], emissive: [.14, .92, .30] },
    violet: { col: [.66, .34, 1.40], emissive: [.48, .20, 1.15] },
    glass:  { col: [.55, .86, 1.05], metal: .18, rough: .10, emissive: [.24, .52, .82] },
    tar:    { col: [.09, .09, .12], metal: .25, rough: .85 }
  };

  // type → GL3D unit mesh key
  const MESH = { box: 'box', cyl: 'cyl', sph: 'sphere', sphLo: 'sphereLo', cone: 'cone', tor: 'torus', torT: 'torusThick', oct: 'octa' };
  const HALF = Math.PI / 2;

  /* ------------------------------------------------------------- models
     p: position, s: size (radius/height/radius for round parts),
     m: material, r: [pitch, yaw, roll] in radians. */
  const MODELS = {
    // --- COMMON ---------------------------------------------------------
    smoke_grenade: [
      { t: 'cyl', p: [0, 0, 0], s: [3.5, 8.6, 3.5], m: 'dark' },
      { t: 'cyl', p: [0, 4.5, 0], s: [3.8, 1.3, 3.8], m: 'metal' },
      { t: 'cyl', p: [0, 5.5, 0], s: [2.1, 1.8, 2.1], m: 'steel' },
      { t: 'tor', p: [0, 6.4, 0], s: [2.5, 1, 2.5], m: 'accent' },
      { t: 'cyl', p: [0, 0.4, 0], s: [3.7, 1.2, 3.7], m: 'accent' },
      { t: 'box', p: [0, -3.2, 0], s: [5.2, 1.1, 5.2], m: 'metal' },
      { t: 'box', p: [2.6, 1.4, 0], s: [.7, 3.2, .7], m: 'steel' }
    ],
    flash_charge: [
      { t: 'sph', p: [0, 0, 0], s: [4.1, 4.1, 4.1], m: 'steel' },
      { t: 'box', p: [0, 0, 3.4], s: [5.4, 3.0, .7], m: 'metal', r: [0, 0, 0] },
      { t: 'box', p: [0, 0, -3.4], s: [5.4, 3.0, .7], m: 'metal' },
      { t: 'box', p: [3.4, 0, 0], s: [.7, 3.0, 5.4], m: 'metal' },
      { t: 'box', p: [-3.4, 0, 0], s: [.7, 3.0, 5.4], m: 'metal' },
      { t: 'sph', p: [0, 0, 0], s: [2.5, 2.5, 2.5], m: 'accent' },
      { t: 'cyl', p: [0, -4.2, 0], s: [1.6, 1.6, 1.6], m: 'dark' }
    ],
    ammo_pack: [
      { t: 'box', p: [0, 0, 0], s: [13, 7, 9], m: 'dark' },
      { t: 'box', p: [0, 3.6, 0], s: [13.6, 1.3, 9.6], m: 'metal' },
      { t: 'box', p: [0, 4.7, 0], s: [11, .9, 1.4], m: 'steel' },
      { t: 'box', p: [0, 0, 0], s: [1.3, 7.4, 9.4], m: 'accent' },
      { t: 'cyl', p: [4.2, -4.0, 2.4], s: [1.05, 2.8, 1.05], m: 'gold' },
      { t: 'cyl', p: [4.2, -4.0, 0], s: [1.05, 2.8, 1.05], m: 'gold' },
      { t: 'cyl', p: [4.2, -4.0, -2.4], s: [1.05, 2.8, 1.05], m: 'gold' },
      { t: 'box', p: [-3.4, -4.0, 0], s: [4.6, 2.6, 6.4], m: 'metal' }
    ],
    scrap_snare: [
      { t: 'tor', p: [0, 0, 0], s: [4.8, 1, 4.8], m: 'metal' },
      { t: 'tor', p: [0, .9, 0], s: [3.5, 1, 3.5], m: 'steel' },
      { t: 'cone', p: [4.4, 1.6, 0], s: [1.0, 3.6, 1.0], m: 'steel', r: [0, 0, -.6] },
      { t: 'cone', p: [-4.4, 1.6, 0], s: [1.0, 3.6, 1.0], m: 'steel', r: [0, 0, .6] },
      { t: 'cone', p: [0, 1.6, 4.4], s: [1.0, 3.6, 1.0], m: 'steel', r: [.6, 0, 0] },
      { t: 'cone', p: [0, 1.6, -4.4], s: [1.0, 3.6, 1.0], m: 'steel', r: [-.6, 0, 0] },
      { t: 'box', p: [0, -1.4, 0], s: [4.6, 1.6, 4.6], m: 'dark' },
      { t: 'sph', p: [0, .2, 0], s: [1.5, 1.5, 1.5], m: 'accent' }
    ],
    iron_ward: [
      { t: 'box', p: [0, 0, 0], s: [13, 17, 1.7], m: 'metal' },
      { t: 'box', p: [0, 7.6, 0], s: [13.6, 2.6, 2.6], m: 'steel' },
      { t: 'box', p: [0, -7.6, 0], s: [9.4, 2.0, 2.4], m: 'steel' },
      { t: 'box', p: [0, 0, 1.3], s: [4.4, 4.4, 1.4], m: 'gold' },
      { t: 'box', p: [0, 0, 2.1], s: [1.8, 1.8, .7], m: 'accent' },
      { t: 'box', p: [5.0, 0, .9], s: [1.1, 12, 1.2], m: 'steel' },
      { t: 'box', p: [-5.0, 0, .9], s: [1.1, 12, 1.2], m: 'steel' },
      { t: 'sph', p: [4.4, 5.4, 1.2], s: [.9, .9, .9], m: 'gold' },
      { t: 'sph', p: [-4.4, 5.4, 1.2], s: [.9, .9, .9], m: 'gold' },
      { t: 'box', p: [0, -9.2, 0], s: [1.6, 3.4, 1.6], m: 'dark' }
    ],

    // --- ULTRA ----------------------------------------------------------
    shock_mine: [
      { t: 'cyl', p: [0, 0, 0], s: [7, 2.4, 7], m: 'dark' },
      { t: 'cyl', p: [0, 1.4, 0], s: [5.6, 1.0, 5.6], m: 'accent' },
      { t: 'tor', p: [0, 1.1, 0], s: [6.6, 1, 6.6], m: 'steel' },
      { t: 'sph', p: [0, 2.2, 0], s: [2.1, 2.1, 2.1], m: 'accent' },
      { t: 'box', p: [5.4, 2.0, 0], s: [.9, 3.2, .9], m: 'steel', r: [0, 0, -.5] },
      { t: 'box', p: [-2.7, 2.0, 4.7], s: [.9, 3.2, .9], m: 'steel', r: [.5, 0, 0] },
      { t: 'box', p: [-2.7, 2.0, -4.7], s: [.9, 3.2, .9], m: 'steel', r: [-.5, 0, 0] }
    ],
    decoy_beacon: [
      { t: 'box', p: [0, -2.4, 0], s: [2.8, 1.6, 2.8], m: 'dark' },
      { t: 'box', p: [2.6, -4.6, 0], s: [.9, 6.4, .9], m: 'metal', r: [0, 0, .42] },
      { t: 'box', p: [-2.6, -4.6, 0], s: [.9, 6.4, .9], m: 'metal', r: [0, 0, -.42] },
      { t: 'box', p: [0, -4.6, 2.6], s: [.9, 6.4, .9], m: 'metal', r: [.42, 0, 0] },
      { t: 'cyl', p: [0, 1.4, 0], s: [2.5, 3.4, 2.5], m: 'metal' },
      { t: 'sph', p: [0, 3.9, 0], s: [2.4, 2.4, 2.4], m: 'accent' },
      { t: 'cyl', p: [0, 6.6, 0], s: [.34, 4.4, .34], m: 'steel' },
      { t: 'tor', p: [0, 8.6, 0], s: [1.7, 1, 1.7], m: 'violet' },
      { t: 'sph', p: [0, 8.6, 0], s: [.7, .7, .7], m: 'violet' }
    ],
    grapple_dart: [
      { t: 'cyl', p: [0, 0, 0], s: [1.45, 8.6, 1.45], m: 'steel', r: [0, 0, -HALF] },
      { t: 'cone', p: [5.6, 0, 0], s: [1.5, 3.2, 1.5], m: 'gold', r: [0, 0, -HALF] },
      { t: 'box', p: [3.4, 2.4, 0], s: [3.0, .7, .7], m: 'steel', r: [0, 0, .7] },
      { t: 'box', p: [3.4, -2.4, 0], s: [3.0, .7, .7], m: 'steel', r: [0, 0, -.7] },
      { t: 'box', p: [3.4, 0, 2.4], s: [3.0, .7, .7], m: 'steel', r: [.7, 0, 0] },
      { t: 'box', p: [3.4, 0, -2.4], s: [3.0, .7, .7], m: 'steel', r: [-.7, 0, 0] },
      { t: 'cyl', p: [-4.6, 0, 0], s: [2.4, 2.0, 2.4], m: 'dark', r: [0, 0, -HALF] },
      { t: 'tor', p: [-4.6, 0, 0], s: [2.6, 1, 2.6], m: 'metal', r: [0, HALF, 0] },
      { t: 'cyl', p: [-8.4, 0, 0], s: [.28, 6.4, .28], m: 'accent', r: [0, 0, -HALF] }
    ],
    tar_grenade: [
      { t: 'cyl', p: [0, 0, 0], s: [4.3, 7.6, 4.3], m: 'dark' },
      { t: 'cyl', p: [0, 3.7, 0], s: [4.7, 1.5, 4.7], m: 'metal' },
      { t: 'cyl', p: [0, 4.9, 0], s: [2.3, 2.0, 2.3], m: 'gold' },
      { t: 'tor', p: [0, 5.8, 0], s: [2.2, 1, 2.2], m: 'ember' },
      { t: 'sph', p: [3.0, -4.2, 0], s: [1.9, 2.6, 1.9], m: 'tar' },
      { t: 'sph', p: [-2.4, -4.4, 2.2], s: [1.7, 2.4, 1.7], m: 'tar' },
      { t: 'sph', p: [-2.0, -4.0, -2.6], s: [1.6, 2.2, 1.6], m: 'tar' },
      { t: 'cyl', p: [0, -4.6, 0], s: [3.2, 1.2, 3.2], m: 'tar' }
    ],

    // --- MONSTER --------------------------------------------------------
    breach_charge: [
      { t: 'box', p: [0, 0, 0], s: [11, 8, 8], m: 'dark' },
      { t: 'box', p: [1.6, 0, 0], s: [1.5, 8.6, 8.6], m: 'ember' },
      { t: 'box', p: [-2.6, 0, 0], s: [1.5, 8.6, 8.6], m: 'ember' },
      { t: 'box', p: [-5.4, 0, 0], s: [.9, 8.2, 8.2], m: 'metal' },
      { t: 'box', p: [0, 4.7, 0], s: [4.4, 2.0, 4.4], m: 'metal' },
      { t: 'sph', p: [0, 6.2, 0], s: [1.1, 1.1, 1.1], m: 'ember' },
      { t: 'box', p: [0, -4.6, 3.2], s: [2.0, 3.0, 1.0], m: 'steel' },
      { t: 'box', p: [0, -4.6, -3.2], s: [2.0, 3.0, 1.0], m: 'steel' }
    ],
    rift_beacon: [
      { t: 'cyl', p: [0, -4.2, 0], s: [5.0, 1.6, 5.0], m: 'metal' },
      { t: 'tor', p: [0, -3.3, 0], s: [4.4, 1, 4.4], m: 'violet' },
      { t: 'oct', p: [0, 1.6, 0], s: [4.4, 8.4, 4.4], m: 'violet' },
      { t: 'oct', p: [3.4, -1.0, 0], s: [1.6, 2.6, 1.6], m: 'accent' },
      { t: 'oct', p: [-3.2, -1.4, 1.8], s: [1.3, 2.2, 1.3], m: 'accent' },
      { t: 'cyl', p: [0, 6.6, 0], s: [.4, 4.0, .4], m: 'glass' },
      { t: 'box', p: [0, -5.2, 0], s: [7.2, 1.0, 7.2], m: 'dark' }
    ],
    aegis_projector: [
      { t: 'cyl', p: [0, -3.8, 0], s: [5.4, 1.8, 5.4], m: 'dark' },
      { t: 'tor', p: [0, -2.7, 0], s: [5.2, 1, 5.2], m: 'metal' },
      { t: 'box', p: [3.8, 0, 0], s: [1.1, 6.4, 1.1], m: 'steel', r: [0, 0, -.22] },
      { t: 'box', p: [-1.9, 0, 3.3], s: [1.1, 6.4, 1.1], m: 'steel', r: [.22, 0, 0] },
      { t: 'box', p: [-1.9, 0, -3.3], s: [1.1, 6.4, 1.1], m: 'steel', r: [-.22, 0, 0] },
      { t: 'cyl', p: [0, .6, 0], s: [1.3, 4.6, 1.3], m: 'accent' },
      { t: 'sph', p: [0, 3.4, 0], s: [4.2, 3.6, 4.2], m: 'glass' },
      { t: 'tor', p: [0, 2.2, 0], s: [4.6, 1, 4.6], m: 'accent' }
    ],

    // --- VIPER ----------------------------------------------------------
    viper_fang: [
      { t: 'cyl', p: [0, -1.4, 0], s: [2.5, 6.6, 2.5], m: 'glass' },
      { t: 'cyl', p: [0, 2.4, 0], s: [2.7, 1.0, 2.7], m: 'gold' },
      { t: 'cone', p: [.9, 5.4, 0], s: [1.7, 7.4, 1.7], m: 'bone', r: [0, 0, -.30] },
      { t: 'cone', p: [-.9, 5.4, 0], s: [1.7, 7.4, 1.7], m: 'bone', r: [0, 0, .30] },
      { t: 'tor', p: [0, -4.6, 0], s: [2.6, 1, 2.6], m: 'viper' },
      { t: 'sph', p: [0, -1.4, 0], s: [1.7, 2.4, 1.7], m: 'viper' },
      { t: 'box', p: [2.6, -5.0, 0], s: [.9, 3.4, .9], m: 'viper', r: [0, 0, .35] },
      { t: 'box', p: [-2.6, -5.0, 0], s: [.9, 3.4, .9], m: 'viper', r: [0, 0, -.35] }
    ],
    void_anchor: [
      { t: 'tor', p: [0, 4.4, 0], s: [4.6, 1, 4.6], m: 'metal', r: [HALF, 0, 0] },
      { t: 'box', p: [0, -.6, 0], s: [2.4, 11, 2.4], m: 'dark' },
      { t: 'box', p: [0, -3.6, 0], s: [11, 1.8, 2.4], m: 'metal' },
      { t: 'cone', p: [4.2, -6.4, 0], s: [1.7, 4.4, 1.7], m: 'steel', r: [0, 0, -.55] },
      { t: 'cone', p: [-4.2, -6.4, 0], s: [1.7, 4.4, 1.7], m: 'steel', r: [0, 0, .55] },
      { t: 'sph', p: [0, 1.4, 0], s: [2.6, 2.6, 2.6], m: 'violet' },
      { t: 'tor', p: [0, 1.4, 0], s: [3.4, 1, 3.4], m: 'violet' },
      { t: 'box', p: [0, 7.4, 0], s: [1.4, 2.4, 1.4], m: 'steel' }
    ],
    champion_standard: [
      { t: 'cyl', p: [0, 0, 0], s: [.95, 26, .95], m: 'gold' },
      { t: 'cyl', p: [0, -12.6, 0], s: [3.0, 1.4, 3.0], m: 'dark' },
      { t: 'box', p: [0, -11.4, 0], s: [6.0, 1.4, 6.0], m: 'metal' },
      { t: 'box', p: [5.6, 7.4, 0], s: [11.6, 9.0, .7], m: 'cloth' },
      { t: 'box', p: [5.6, 12.2, 0], s: [12.2, 1.1, 1.0], m: 'gold' },
      { t: 'box', p: [5.6, 2.6, 0], s: [12.2, .9, 1.0], m: 'gold' },
      { t: 'sph', p: [0, 13.6, 0], s: [1.9, 1.9, 1.9], m: 'gold' },
      { t: 'box', p: [5.6, 7.4, .6], s: [4.2, 4.2, .5], m: 'gold' },
      { t: 'sph', p: [5.6, 7.4, .9], s: [1.3, 1.3, .6], m: 'ember' }
    ]
  };

  /* -------------------------------------------------------- GL3D drawing */
  function partMaterial(R, part, boost) {
    const base = MAT[part.m] || MAT.metal;
    const o = { metal: base.metal == null ? .6 : base.metal, rough: base.rough == null ? .4 : base.rough, shadow: true };
    if (base.emissive) {
      const k = boost == null ? 1 : boost;
      o.emissive = [base.emissive[0] * k, base.emissive[1] * k, base.emissive[2] * k];
      o.shadow = false;
    }
    return R.mat(base.col, o);
  }

  // Draws one utility model into the arena's 3D pass.
  // ox/oy/oz: world position of the model's origin, ang: facing, scale: 1 = px.
  function draw(R, id, ox, oy, oz, ang, scale, spin, boost) {
    const parts = MODELS[id];
    if (!parts || !R || !R.ok) return;
    const U = R.unit;
    const c = Math.cos(ang), s = Math.sin(ang);
    const k = scale == null ? 1 : scale;
    for (let i = 0; i < parts.length; i++) {
      const pt = parts[i];
      const p = pt.p, sz = pt.s, r = pt.r || [0, 0, 0];
      const lx = p[0] * k, ly = p[1] * k, lz = p[2] * k;
      const wx = ox + c * lx - s * lz;
      const wz = oz + s * lx + c * lz;
      const wy = oy + ly;
      const mesh = U[MESH[pt.t] || 'box'];
      let sx = sz[0] * k, sy = sz[1] * k, sz2 = sz[2] * k;
      // the ring primitive is authored at radius 1 with a thin tube; scale the
      // tube up so rings read as solid metal rather than wire
      if (pt.t === 'tor') { sx = sy = sz2 = sz[0] * k; }
      R.draw(mesh, R.mm(wx, wy, wz, ang + r[1] + (spin || 0), sx, sy, sz2, r[0], r[2]), partMaterial(R, pt, boost));
    }
  }

  // A ring of soft light under a thrown/deployed object — keeps it grounded.
  function groundGlow(R, x, z, radius, col, alpha) {
    if (!R || !R.ok) return;
    R.decal(x, z, radius, col[0], col[1], col[2], alpha == null ? .35 : alpha, 2, .12, 0, true, 1.4);
  }

  /* --------------------------------------------- first-person viewmodel
     The same parts, composed in camera space and pushed into the arena's
     viewmodel list (R.vmList) — the pass that draws the held gun with its
     own projection and a fresh depth buffer, so it never clips into a wall.
     pose: { x, y, z (camera space, -z forward), yaw, pitch, roll, scale } */
  const _vmRoot = new Float32Array(16), _vmLoc = new Float32Array(16), _vmFin = new Float32Array(16);
  const _vmPool = []; for (let i = 0; i < 24; i++) _vmPool.push(new Float32Array(16));
  let _vmI = 0;

  function drawView(R, id, vInv, pose) {
    const parts = MODELS[id];
    const M = G.GL3D && G.GL3D.M;
    if (!parts || !M || !R || !R.vmList || !vInv) return;
    const L = R.vmList; _vmI = 0;
    const k = pose.scale == null ? 1 : pose.scale;
    M.trs(_vmRoot, pose.x || 0, pose.y || 0, pose.z || 0, pose.yaw || 0, k, k, k, pose.pitch || 0, pose.roll || 0);
    for (let i = 0; i < parts.length; i++) {
      const pt = parts[i], p = pt.p, s = pt.s, r = pt.r || [0, 0, 0];
      const mesh = R.unit[MESH[pt.t] || 'box'];
      if (!mesh) continue;
      let sx = s[0], sy = s[1], sz = s[2];
      // the ring primitive is authored at radius 1 with a thin tube
      if (pt.t === 'tor') { sx = sy = sz = s[0]; }
      M.trs(_vmLoc, p[0], p[1], p[2], r[1], sx, sy, sz, r[0], r[2]);
      M.mul(_vmFin, _vmRoot, _vmLoc);
      const out = _vmPool[_vmI++ % _vmPool.length];
      M.mul(out, vInv, _vmFin);
      L.push(mesh, out, partMaterial(R, pt, pose.boost));
    }
    // and the hand that actually holds it
    handView(R, vInv, _vmRoot, k);
  }

  /* ------------------------------------------------- the holding hand
     An object floating in front of the camera reads as a menu icon, not as
     something in your hand. This draws the hand that grips it — palm behind
     the grip, three fingers curling round the near face, a thumb over the
     top and a forearm dropping out of frame — authored in the model's own
     frame, so it inherits the pose, the breathing and the throw swing. */
  const _hH = new Float32Array(16), _hP = new Float32Array(16);
  const _hPool = []; for (let i = 0; i < 48; i++) _hPool.push(new Float32Array(16));
  let _hI = 0;

  // the hand wears the fighter's own colour, exactly like the gun's hands do
  function skinTone() {
    const raw = String((G.__arenaPlayer && G.__arenaPlayer.color) || '#aef');
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
    if (!m) return [.68, .86, 1.0];
    const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
    const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function handView(R, vInv, root, k) {
    const M = G.GL3D && G.GL3D.M;
    if (!M || !R || !R.vmList) return;
    const L = R.vmList;
    const c3 = skinTone();
    const skin = R.mat(c3, { metal: .45, rough: .3, emissive: [c3[0] * .12, c3[1] * .12, c3[2] * .12], rim: .5, rimCol: c3, shadow: false });
    const cuff = R.mat([.1, .11, .15], { metal: .8, rough: .3, emissive: [.01, .03, .06], shadow: false });
    const take = () => _hPool[_hI++ % _hPool.length];
    M.mul(_hH, vInv, root);                              // model space -> viewmodel space
    const tp = (x, y, z) => [
      _hH[0] * x + _hH[4] * y + _hH[8] * z + _hH[12],
      _hH[1] * x + _hH[5] * y + _hH[9] * z + _hH[13],
      _hH[2] * x + _hH[6] * y + _hH[10] * z + _hH[14]
    ];
    const ell = (x, y, z, sx, sy, sz, mt) => {
      M.trs(_hP, x, y, z, 0, sx, sy, sz);
      const o = take(); M.mul(o, _hH, _hP);
      L.push(R.unit.sphere, o, mt);
    };
    // a limb: a cylinder from a to b, built straight in viewmodel space
    const seg = (a0, b0, r, mt) => {
      const a = tp(a0[0], a0[1], a0[2]), b = tp(b0[0], b0[1], b0[2]);
      let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const len = Math.hypot(dx, dy, dz) || 1; dx /= len; dy /= len; dz /= len;
      let qx = 0, qy = 0, qz = 0;
      if (Math.abs(dy) < .9) qy = 1; else qx = 1;
      let xx = qy * dz - qz * dy, xy = qz * dx - qx * dz, xz = qx * dy - qy * dx;
      const xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
      const zx = xy * dz - xz * dy, zy = xz * dx - xx * dz, zz = xx * dy - xy * dx;
      const m = take(), rad = r * k;
      m[0] = xx * rad; m[1] = xy * rad; m[2] = xz * rad; m[3] = 0;
      m[4] = dx * len; m[5] = dy * len; m[6] = dz * len; m[7] = 0;
      m[8] = zx * rad; m[9] = zy * rad; m[10] = zz * rad; m[11] = 0;
      m[12] = a[0]; m[13] = a[1]; m[14] = a[2]; m[15] = 1;
      L.push(R.unit.cyl, m, mt);
    };

    // The model's -x faces the camera, so the palm sits behind the grip and
    // only the wrapped fingers, thumb and forearm come round to the near side.
    ell(-4.6, -1.4, 0.2, 2.3, 2.8, 2.7, skin);             // back of the hand
    ell(-4.3, -4.2, 0.7, 2.0, 2.0, 2.0, skin);             // heel of the palm
    for (let i = 0; i < 3; i++) {
      const y = 1.9 - i * 2.3;
      seg([0.9, y, 3.0], [-1.5, y, 2.5], 1.2, skin);        // knuckle, round the right
      seg([-1.5, y, 2.5], [-2.4, y, 0.4], 1.15, skin);      // middle joint, across the front
      seg([-2.4, y, 0.4], [-2.2, y, -1.6], 1.05, skin);     // tip, curling in
      ell(-2.2, y, -1.6, 1.05, 1.05, 1.05, skin);
    }
    seg([-3.4, 1.8, -1.4], [-2.0, 3.4, -2.8], 1.3, skin);   // thumb, out of the web
    seg([-2.0, 3.4, -2.8], [-0.6, 3.1, -3.3], 1.15, skin);  // ...over the top
    ell(-0.6, 3.1, -3.3, 1.1, 1.1, 1.1, skin);
    seg([-4.4, -3.4, 0.7], [-9.0, -9.0, 2.6], 2.8, skin);   // forearm
    seg([-4.8, -4.6, 1.1], [-9.6, -9.8, 3.1], 3.2, cuff);   // sleeve
  }

  /* --------------------------------------------------- three.js preview */
  let _renderer = null, _scene = null, _camera = null, _group = null, _curId = null, _dpr = 1;

  function threeMats() {
    const T = G.THREE;
    const cache = {};
    return function get(name) {
      if (cache[name]) return cache[name];
      const base = MAT[name] || MAT.metal;
      const col = new T.Color(base.col[0] * .55, base.col[1] * .55, base.col[2] * .55);
      const m = new T.MeshStandardMaterial({
        color: col,
        metalness: base.metal == null ? .6 : base.metal,
        roughness: base.rough == null ? .4 : base.rough
      });
      if (base.emissive) {
        m.emissive = new T.Color(base.emissive[0] * .6, base.emissive[1] * .6, base.emissive[2] * .6);
        m.emissiveIntensity = 1.1;
      }
      cache[name] = m;
      return m;
    };
  }

  function buildGroup(id) {
    const T = G.THREE;
    const parts = MODELS[id];
    const g = new T.Group();
    if (!parts) return g;
    const getMat = threeMats();
    for (const pt of parts) {
      const s = pt.s, r = pt.r || [0, 0, 0];
      let geo;
      switch (pt.t) {
        case 'cyl': geo = new T.CylinderGeometry(s[0], s[0], s[1], 26, 1); break;
        case 'cone': geo = new T.CylinderGeometry(0.02, s[0], s[1], 22, 1); break;
        case 'sph': geo = new T.SphereGeometry(s[0], 26, 18); break;
        case 'sphLo': geo = new T.SphereGeometry(s[0], 12, 8); break;
        case 'tor': geo = new T.TorusGeometry(s[0], Math.max(.35, s[0] * .16), 12, 34); break;
        case 'oct': geo = new T.OctahedronGeometry(s[0], 0); break;
        default: geo = new T.BoxGeometry(s[0], s[1], s[2], 1, 1, 1);
      }
      const mesh = new T.Mesh(geo, getMat(pt.m));
      // model frame is +x forward / +y up / +z right; three.js has y up too, so
      // the only change is turning the forward axis to face the camera
      mesh.position.set(pt.p[0], pt.p[1], pt.p[2]);
      mesh.rotation.set(r[0], r[1], r[2]);
      if (pt.t === 'oct') mesh.scale.set(s[0] / Math.max(.001, s[0]), s[1] / Math.max(.001, s[0]), s[2] / Math.max(.001, s[0]));
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
    }
    // Every model is fitted to the same visual height, so a grenade and a
    // banner both fill the stage without ever clipping the frame.
    let ext = 4;
    for (const pt of parts) {
      const s = pt.s;
      ext = Math.max(ext,
        Math.abs(pt.p[0]) + (s[0] || 1) / 2,
        Math.abs(pt.p[1]) + (s[1] || s[0] || 1) / 2,
        Math.abs(pt.p[2]) + (s[2] || s[0] || 1) / 2);
    }
    g.scale.setScalar(20 / ext);
    // face the model's nose toward -z (toward the camera) so its silhouette reads
    g.rotation.y = -Math.PI * .5;
    return g;
  }

  // One render target for every preview: the model is always drawn at 256px
  // and blitted to whatever size the caller wants, so the WebGL drawing buffer
  // is never reallocated while the shop is open.
  const PREVIEW_PX = 256;

  function ensureThree() {
    const T = G.THREE;
    if (!T) return false;
    if (!_renderer) {
      _renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      _renderer.setPixelRatio(1);
      _renderer.shadowMap.enabled = true;
      _renderer.shadowMap.type = T.PCFSoftShadowMap;
      _renderer.outputEncoding = T.sRGBEncoding;
      _scene = new T.Scene();
      _camera = new T.PerspectiveCamera(34, 1, 1, 600);
      _camera.position.set(0, 12, 78);
      _camera.lookAt(0, 0, 0);

      const hemi = new T.HemisphereLight(0x9fd8ff, 0x120a24, 0.85);
      _scene.add(hemi);
      const key = new T.DirectionalLight(0xffffff, 1.5);
      key.position.set(38, 62, 44);
      key.castShadow = true;
      key.shadow.mapSize.width = 512; key.shadow.mapSize.height = 512;
      key.shadow.camera.left = -70; key.shadow.camera.right = 70;
      key.shadow.camera.top = 70; key.shadow.camera.bottom = -70;
      _scene.add(key);
      const rim = new T.DirectionalLight(0x8f6bff, 1.1);
      rim.position.set(-46, 22, -40);
      _scene.add(rim);
      const fill = new T.DirectionalLight(0x4de6ff, 0.55);
      fill.position.set(-10, -30, 50);
      _scene.add(fill);

      // soft contact shadow card
      const shadowMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34 });
      const shadow = new T.Mesh(new T.CircleGeometry(26, 32), shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -23;
      _scene.add(shadow);
    }
    if (_renderer.domElement.width !== PREVIEW_PX) {
      _renderer.setSize(PREVIEW_PX, PREVIEW_PX, false);
      _camera.aspect = 1;
      _camera.updateProjectionMatrix();
    }
    return true;
  }

  // Renders a utility into a 2D canvas (real 3D, lit and shadowed).
  function paint(ctx, id, angle, size) {
    if (!ctx) return false;
    if (!ensureThree()) return false;
    if (_curId !== id) {
      if (_group) _scene.remove(_group);
      _group = buildGroup(id);
      _scene.add(_group);
      _curId = id;
    }
    _group.rotation.y = -Math.PI * .5 + (angle || 0);
    _group.position.y = Math.sin((angle || 0) * .9) * 1.6;
    _renderer.render(_scene, _camera);
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(_renderer.domElement, 0, 0, PREVIEW_PX, PREVIEW_PX, 0, 0, size, size);
    return true;
  }

  G.UtilityModels = { MODELS, MAT, draw, drawView, groundGlow, paint, has: (id) => !!MODELS[id] };
})(window);
