/* Crysto — the arms you carry.
   You wake with your fists. Every beat of the vigil pays in a gun: Maera hands
   over the Wayfarer, each sanctum's guardian drops the next, and the Keep's own
   knight carries the last.

   Nothing here is invented: the bare fists are the arena's own common punch
   sprite (assets/melee/common/common_punch1.png) swung with the arena's own
   punch animation, the guns are the arena's own models held by the same wrapped
   two-handed grip the pit draws, and every shot is the arena's bullet — same
   colour, same size, same speed, same streak-and-glow — flown as a real
   projectile instead of a line drawn to the target. */
(function () {
  const C = (window.Crysto = window.Crysto || {});
  const KEY = 'crysto_arms_v1';

  const FIST = { rarity: 'common', name: 'common_punch1' };

  // Straight out of render3d_fx.js: the pit's bullet look, per weapon kind.
  const BULLET_VIS = {
    pistol: { col: [1.3, 1.6, 2.2], rad: 3.0, len: 14, glow: 4.0 },
    smg: { col: [1.3, 1.6, 2.3], rad: 2.4, len: 14, glow: 3.5 },
    rifle: { col: [1.2, 1.6, 2.4], rad: 2.6, len: 24, glow: 4.0 },
    burst: { col: [1.3, 1.7, 2.4], rad: 2.6, len: 18, glow: 4.0 },
    marksman: { col: [1.7, 1.4, 1.0], rad: 2.0, len: 36, glow: 6.0 },
    lmg: { col: [1.5, 1.4, 0.7], rad: 3.0, len: 20, glow: 4.5 },
    crossbow: { col: [1.4, 1.1, 0.8], rad: 3.6, len: 28, glow: 5.0 },
    shotgun: { col: [1.6, 1.2, 0.6], rad: 2.6, len: 10, glow: 5.0 }
  };

  // Straight out of render3d_fx.js: the pit's aim-down-sights profile per gun.
  // zoom = view magnification, time = seconds to raise, spread = bullet-spread
  // multiplier, move = move-speed multiplier, sens = mouse sensitivity
  // multiplier, y/z = where the gun sits on screen, yaw = barrel angle,
  // scope = vignette overlay.
  const ADS = {
    pistol: { zoom: 1.25, time: 0.12, spread: 0.45, move: 0.85, sens: 0.85, y: -3.3, z: -17.0, yaw: 0.15, scope: 0 },
    rifle: { zoom: 1.80, time: 0.20, spread: 0.22, move: 0.65, sens: 0.60, y: -3.5, z: -18.5, yaw: 0.15, scope: 1 },
    shotgun: { zoom: 1.15, time: 0.28, spread: 0.60, move: 0.75, sens: 0.80, y: -3.7, z: -18.5, yaw: 0.15, scope: 0 },
    smg: { zoom: 1.20, time: 0.10, spread: 0.50, move: 0.85, sens: 0.85, y: -3.3, z: -17.6, yaw: 0.15, scope: 0 },
    burst: { zoom: 1.50, time: 0.18, spread: 0.30, move: 0.70, sens: 0.65, y: -3.5, z: -18.6, yaw: 0.15, scope: 0 },
    marksman: { zoom: 2.40, time: 0.28, spread: 0.12, move: 0.50, sens: 0.40, y: -3.6, z: -19.0, yaw: 0.15, scope: 1 },
    crossbow: { zoom: 1.70, time: 0.24, spread: 0.15, move: 0.60, sens: 0.50, y: -3.6, z: -18.6, yaw: 0.15, scope: 1 },
    lmg: { zoom: 1.10, time: 0.30, spread: 0.70, move: 0.60, sens: 0.90, y: -3.6, z: -18.8, yaw: 0.15, scope: 0 },
    flamethrower: { zoom: 1.00, time: 0.20, spread: 1.0, move: 1.0, sens: 1.0, y: -3.5, z: -18.6, yaw: 0.15, scope: 0 }
  };

  // The pit's per-weapon reticle (render3d_fx.js, CROSS): its shape, its gap
  // and how far it breathes open as you move and fire.
  const CROSS = {
    pistol: { type: 'tick', gap: 6, len: 7, thick: 2, dot: 2, col: '#ffffff', dyn: 7 },
    rifle: { type: 'tick', gap: 4, len: 8, thick: 2, dot: 1.5, col: '#9fe3ff', dyn: 4 },
    shotgun: { type: 'ring', r: 12, thick: 2, dot: 0, col: '#ffd27a', dyn: 7 },
    smg: { type: 'tick', gap: 8, len: 6, thick: 2, dot: 2, col: '#cfe9ff', dyn: 10 },
    burst: { type: 'tick', gap: 5, len: 7, thick: 2, dot: 1.5, col: '#9fe3ff', dyn: 6 },
    marksman: { type: 'tick', gap: 0, len: 10, thick: 1, dot: 1.5, col: '#ff5a3a', dyn: 2 },
    crossbow: { type: 'tick', gap: 3, len: 9, thick: 1.5, dot: 0, col: '#7dffa3', dyn: 3 },
    lmg: { type: 'tick', gap: 10, len: 7, thick: 3, dot: 2, col: '#ffd27a', dyn: 12 },
    flamethrower: { type: 'ring', r: 16, thick: 2, dot: 0, col: '#ff8a3a', dyn: 8 }
  };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (a) => a * a * (3 - 2 * a);

  const ARMS = {
    fists: {
      name: 'Bare Knuckles', kind: 'melee', rarity: 'Common',
      // the arena's common punch art, and nothing else
      sprite: 'assets/melee/common/common_punch1.png',
      dmg: 62, cd: 0.38, reach: 320, trim: 0x6a5240,
      blurb: 'A flat, honest thud that lands exactly where you aim it.'
    },
    pistol: {
      name: 'Wayfarer Pistol', kind: 'gun', rarity: 'Common',
      model: 'smg', sprite: 'assets/guns/pistols/pistol1.png',
      dmg: 42, cd: 0.32, mag: 12, reserve: 144, range: 3000, spread: 0.010, pellets: 1,
      speed: 1100, colour: 0xffe6a8, trim: 0x9c7c4a,
      blurb: "Maera's own sidearm. It has never once been cleaned."
    },
    rifle: {
      name: 'Vale Rifle', kind: 'gun', rarity: 'Rare',
      model: 'marksman', sprite: 'assets/guns/rifles/rifle2.png',
      dmg: 58, cd: 0.58, mag: 8, reserve: 96, range: 4200, spread: 0.004, pellets: 1,
      speed: 1400, colour: 0x9fe3ff, trim: 0x5f8fa8,
      blurb: 'Long, patient and loud. The vale built it to reach the far hedge.'
    },
    scatter: {
      name: 'Shard Scatter', kind: 'gun', rarity: 'Rare',
      model: 'burst', sprite: 'assets/guns/shotguns/shotgun1.png',
      dmg: 30, cd: 0.78, mag: 6, reserve: 72, range: 1700, spread: 0.085, pellets: 6,
      speed: 900, colour: 0xc9f0ff, trim: 0x7f9aa8,
      blurb: 'A fistful of river ice, thrown hard.'
    },
    storm: {
      name: 'Stormlance', kind: 'gun', rarity: 'Epic',
      model: 'lmg', sprite: 'assets/guns/rifles/rifle4.png',
      dmg: 92, cd: 0.52, mag: 6, reserve: 60, range: 5000, spread: 0.0, pellets: 1,
      speed: 1500, colour: 0xbfe9ff, trim: 0x6a5ac0,
      blurb: 'The knight carried it under the keep. It has not cooled since.'
    },
    dawn: {
      name: 'Sunstone Repeater', kind: 'gun', rarity: 'Legendary',
      model: 'crossbow', sprite: 'assets/guns/rifles/rifle5.png',
      dmg: 70, cd: 0.20, mag: 24, reserve: 288, range: 3400, spread: 0.018, pellets: 1,
      speed: 1400, colour: 0xffcf7a, trim: 0xd0a050,
      blurb: 'Woken with the Sunstone: a small, patient sunrise in the hand.'
    }
  };

  const state = { owned: ['fists'], equipped: 'fists', mag: {}, reserve: {} };

  let world = null;
  let viewCam = null, viewScene = null, vm = null, armRig = null;
  let fistModel = null, gunModel = null, muzzle = null, flash = null;
  const models = {};

  // The pose of the whole first-person rig, driven exactly like the pit's.
  const RIG = { bob: 0, amt: 0, sy: 0, sp: 0, kick: 0, dash: 0, swap: 0, rel: 0, tt: 0, ads: 0 };
  let aiming = false;
  let cd = 0, reloadT = 0;
  let swingT = 0, swingDur = 0.5;
  const bullets = [];
  const sparks = [];
  const swings = [];      // live strike ribbons
  const _l = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  let glowTex = null;

  // The pit's melee rig (render3d_fx.js, HIP_MELEE): the same length, the same
  // resting pose, the same barrel-of-the-eye offset a gun is held at.
  const HIP_MELEE = { len: 23, x: 6.2, y: -7.4, z: -20.0, yaw: 0.20 };

  /* ---- state ---------------------------------------------------------- */
  function def(id) { return ARMS[id] || ARMS.fists; }
  function arm() { return def(state.equipped); }

  // The sight profile of whatever is in hand: fists have none.
  function profile() {
    const d = arm();
    return d.kind === 'gun' ? (ADS[d.model] || ADS.pistol) : null;
  }

  // Right mouse, exactly as the pit reads it: hold to bring the sights up.
  function aim(on) { aiming = !!on; }

  const eased = () => sm(RIG.ads);
  const mul = (v) => (profile() ? lerp(1, v, eased()) : 1);

  // What the aim is doing to the view, the walk and the shot.
  const zoom = () => { const p = profile(); return p ? 1 + (p.zoom - 1) * eased() : 1; };
  const spreadMul = () => { const p = profile(); return p ? mul(p.spread) : 1; };
  const moveMul = () => { const p = profile(); return p ? mul(p.move) : 1; };
  const sensMul = () => { const p = profile(); return p ? mul(p.sens) : 1; };

  // The reticle's own reading of the frame: which shape, how wide it breathes,
  // and how far it fades as the sights come up.
  function reticle() {
    const d = arm();
    const kind = d.kind === 'gun' ? (d.model || 'pistol') : 'pistol';
    const cfg = CROSS[kind] || CROSS.pistol;
    const aE = eased();
    const move = clamp(RIG.amt, 0, 1);
    const fire = RIG.kick > 0.15 ? clamp(RIG.kick / 1.2, 0, 1) : 0;
    const dyn = (cfg.dyn || 0) * Math.max(move * 0.7, fire * 0.8) * (1 - aE);
    return {
      kind: kind, cfg: cfg,
      gap: (cfg.gap || 0) + dyn,
      r: (cfg.r || 10) + dyn * 0.5,
      alpha: 1 - aE * (cfg.scope ? 1 : 0.85),
      // a scoped gun blacks the edges out once the sights are most of the way up
      scope: profile() && profile().scope ? sm(clamp((RIG.ads - 0.4) / 0.6, 0, 1)) : 0
    };
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && Array.isArray(raw.owned)) {
        state.owned = raw.owned.filter((id) => ARMS[id]);
        if (!state.owned.length) state.owned = ['fists'];
        if (!state.owned.includes('fists')) state.owned.unshift('fists');
        state.equipped = ARMS[raw.equipped] ? raw.equipped : 'fists';
        state.mag = raw.mag || {};
        state.reserve = raw.reserve || {};
      }
    } catch (_) {}
    state.owned.forEach((id) => {
      const d = ARMS[id];
      if (d.kind !== 'gun') return;
      if (state.mag[id] == null) state.mag[id] = d.mag;
      if (state.reserve[id] == null) state.reserve[id] = d.reserve;
    });
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        owned: state.owned, equipped: state.equipped, mag: state.mag, reserve: state.reserve
      }));
    } catch (_) {}
  }

  function snapshot() {
    return { owned: state.owned.slice(), equipped: state.equipped, mag: Object.assign({}, state.mag), reserve: Object.assign({}, state.reserve) };
  }

  function restore(snap) {
    if (!snap || !Array.isArray(snap.owned)) return;
    state.owned = snap.owned.filter((id) => ARMS[id]);
    if (!state.owned.length) state.owned = ['fists'];
    if (!state.owned.includes('fists')) state.owned.unshift('fists');
    state.equipped = ARMS[snap.equipped] ? snap.equipped : 'fists';
    state.mag = snap.mag || state.mag;
    state.reserve = snap.reserve || state.reserve;
    dressArm();
  }

  /* ---- the first-person view ------------------------------------------ */
  function litMat(color, rough, metal) {
    return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.6 : rough, metalness: metal || 0 });
  }

  function softDot() {
    if (glowTex) return glowTex;
    const s = 64, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.28, 'rgba(255,255,255,0.72)');
    g.addColorStop(0.62, 'rgba(255,255,255,0.20)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    glowTex = new THREE.CanvasTexture(cv);
    return glowTex;
  }

  // The tracer's own gradient: hot at the front, gone at the tail, and soft at
  // its long edges — the arena's bullets are light, not little plastic bars.
  let streakTex = null;
  function softStreak() {
    if (streakTex) return streakTex;
    const w = 32, h = 128, cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    const gy = x.createLinearGradient(0, h, 0, 0);
    gy.addColorStop(0, 'rgba(255,255,255,0)');
    gy.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    gy.addColorStop(0.88, 'rgba(255,255,255,1)');
    gy.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gy;
    x.fillRect(0, 0, w, h);
    const gx = x.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(0,0,0,1)');
    gx.addColorStop(0.5, 'rgba(0,0,0,0)');
    gx.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out';
    x.fillStyle = gx;
    x.fillRect(0, 0, w, h);
    streakTex = new THREE.CanvasTexture(cv);
    return streakTex;
  }

  /* ---- the bare fist: the arena's own punch sprite, laid the way the pit
     lays it. render3d_fx.js never hangs a flat card in front of the eye: it
     inflates the art into a volume and turns that volume so the art's long
     axis runs AWAY from you (local X -> forward), its height across the view
     and the painted face down. A fist therefore reaches out in front of you,
     seen from above, instead of lying across the screen as a wide bar. */
  const FIST_LEN = 23;            // HIP_MELEE.len — the pit's melee rig length
  const FIST_DEPTH = 0.25;        // opt.depth the pit gives a blunt melee sprite
  const FIST_SLICES = 6;
  const GRIP_X = 0.30, GRIP_Y = 0.62;   // GRIPD: the pivot the pit grips at
  // The pit draws its viewmodel through a 62° camera; the arm camera here is
  // narrower, so the rig is scaled to land on screen at the same size.
  const FIT = Math.tan(62 * Math.PI / 360) / Math.tan(52 * Math.PI / 360);

  function buildFistRig() {
    const root = new THREE.Group();
    root.scale.setScalar(FIT);
    const outer = new THREE.Group();
    outer.rotation.order = 'YZX';
    const body = new THREE.Group();
    body.matrixAutoUpdate = false;
    outer.add(body);
    root.add(outer);

    // The card, built in the frame inflateSprite builds: width = image X,
    // normal = the extrusion, height = image Y.
    const card = new THREE.PlaneGeometry(1, 1);
    card.rotateX(-Math.PI / 2);

    let aspect = 4.9, s = FIST_LEN / aspect;
    const slices = [];
    for (let i = 0; i < FIST_SLICES; i++) {
      const m = new THREE.Mesh(card, new THREE.MeshBasicMaterial({
        transparent: true, alphaTest: 0.3, depthWrite: false, side: THREE.DoubleSide
      }));
      m.userData.t = FIST_SLICES > 1 ? i / (FIST_SLICES - 1) : 0;
      slices.push(m);
      body.add(m);
    }

    // The art's own proportions set the rig: 23 units along the arm, and the
    // painted thickness across it. Outer slices sit a hair narrower and darker
    // so the volume has an edge instead of reading as one flat sheet.
    function dress(im) {
      aspect = im && im.width && im.height ? im.width / im.height : 4.9;
      s = FIST_LEN / aspect;
      slices.forEach((m) => {
        const t = m.userData.t, off = Math.abs(t - 0.5) * 2;
        m.scale.set(aspect, 1, 1 - 0.12 * off);
        m.position.y = t * FIST_DEPTH;
        m.material.color.setScalar(1 - 0.22 * off);
      });
      place(0.20);
    }

    // The pit's own basis (render3d_fx.js -> vmModel), grip pivot at the origin.
    function place(yaw) {
      const sy = Math.sin(yaw), cy = Math.cos(yaw), sn = s * 0.55;
      const m = body.matrix;
      m.makeBasis(
        new THREE.Vector3(-sy * s, 0, -cy * s),
        new THREE.Vector3(-cy * sn, 0, sy * sn),
        new THREE.Vector3(0, -s, 0)
      );
      const e = m.elements;
      const gx = (GRIP_X - 0.5) * aspect, gz = GRIP_Y - 0.5;
      m.setPosition(
        -(e[0] * gx + e[8] * gz),
        -(e[1] * gx + e[9] * gz),
        -(e[2] * gx + e[10] * gz)
      );
      body.matrixWorldNeedsUpdate = true;
    }

    const tex = new THREE.TextureLoader().load(ARMS.fists.sprite, (t) => dress(t.image));
    if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    slices.forEach((m) => { m.material.map = tex; });
    dress(null);

    return {
      group: root,
      pose(px, py, pz, yaw, rx, ry, rz) {
        outer.position.set(px, py, pz);
        outer.rotation.set(rx, ry, rz);
        place(yaw);
      }
    };
  }

  /* ---- the pit's own rig: its guns, its hands, its pose ----------------- */
  // The fighter's shell colour tints the hands, exactly as the arena tints them.
  function skinColour() {
    try {
      // the arena keeps the fighter's shell colour in its own settings blob
      const all = JSON.parse(localStorage.getItem('arenaSettings') || '{}');
      const i = parseInt(all.color, 10) || 0;
      const c = window.AvatarStyle && AvatarStyle.COLORS ? AvatarStyle.COLORS[i] : null;
      return (c && c.c) || '#aef';
    } catch (_) { return '#aef'; }
  }

  function buildGun(d) {
    if (!C.arms) return null;
    return C.arms.build(d.model || 'smg', skinColour());
  }

  function dressArm() {
    if (!armRig) return;
    const d = arm();
    const isGun = d.kind === 'gun';
    if (fistModel) fistModel.group.visible = !isGun;
    Object.keys(models).forEach((k) => { if (models[k]) models[k].group.visible = false; });
    if (isGun) {
      if (!models[state.equipped]) {
        const rig = buildGun(d);
        if (rig && armRig) { models[state.equipped] = rig; armRig.add(rig.group); }
      }
      gunModel = models[state.equipped] || null;
      muzzle = gunModel ? gunModel.muzzle : null;
      if (gunModel) gunModel.group.visible = true;
      if (!flash) {
        flash = new THREE.Sprite(new THREE.SpriteMaterial({
          map: softDot(), color: 0xfff0c8, transparent: true,
          blending: THREE.AdditiveBlending, depthWrite: false
        }));
        flash.scale.setScalar(3);
      }
      // the flash rides the barrel's own tip, so it follows every pose
      if (muzzle && flash.parent !== muzzle) { muzzle.add(flash); flash.position.set(0, 0, 0); }
      if (flash) flash.visible = false;
    } else {
      muzzle = null;
      if (flash) flash.visible = false;
    }
    if (C.hud && C.hud.setArms) C.hud.setArms(d.name, ammoText(), d.sprite);
  }

  function init(scene, aspect) {
    world = scene;
    load();
    viewScene = new THREE.Scene();
    viewCam = new THREE.PerspectiveCamera(52, aspect || 1.6, 1, 400);
    const key = new THREE.DirectionalLight(0xfff2dc, 1.4);
    key.position.set(0.6, 1, 0.8);
    viewScene.add(key);
    viewScene.add(new THREE.DirectionalLight(0x9fc4e8, 0.65).translateX(-1).translateY(-0.4));
    viewScene.add(new THREE.HemisphereLight(0xdff0ff, 0x4a4234, 0.85));
    viewScene.add(new THREE.AmbientLight(0x8fa8c0, 0.65));

    // the pit's rig lives in the arm camera's own space: no offset of its own
    armRig = new THREE.Group();
    viewScene.add(armRig);

    fistModel = buildFistRig();
    armRig.add(fistModel.group);
    dressArm();
  }

  function resize(aspect) {
    if (viewCam) { viewCam.aspect = aspect; viewCam.updateProjectionMatrix(); }
  }

  /* ---- firing ---------------------------------------------------------- */
  function ammoText() {
    const d = arm();
    if (d.kind !== 'gun') return '';
    const mag = state.mag[state.equipped] == null ? d.mag : state.mag[state.equipped];
    const res = state.reserve[state.equipped] || 0;
    return mag + ' / ' + res;
  }

  // The rig is drawn in the arm camera's space, so the barrel tip has to be
  // carried into the world before a bullet is born at it.
  function muzzleWorld() {
    const v = new THREE.Vector3();
    if (muzzle) muzzle.getWorldPosition(v);
    else v.set(0, -5.6, -17.5);
    if (C.camera) v.applyMatrix4(C.camera.matrixWorld);
    return v;
  }

  /* ---- the shot, flown the way the pit flies it ------------------------ */
  function bulletColour(kind) {
    const v = BULLET_VIS[kind] || BULLET_VIS.pistol;
    // the pit's colours are written past 1.0 for its bloom pass; bring them
    // back inside range so the same hue survives without one
    return new THREE.Color(
      Math.min(1, v.col[0] / 2.1),
      Math.min(1, v.col[1] / 2.1),
      Math.min(1, v.col[2] / 2.1)
    );
  }

  /* ---- the tracer, flown exactly as the pit flies it -------------------
     render3d_fx.js -> drawBullets paints a shot as two camera-facing quads and
     nothing else: a streak laid along the shot (soft across its width, fading
     toward both ends) and a round glow at the head. The same falloff, the same
     sizes and the same additive add, so a bullet in the vale is the bullet of
     the pit. */
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const QUAD_VS = [
    'varying vec2 vUv;',
    'void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
  ].join('\n');
  const streakMats = {}, glowMats = {};

  function quadMat(streak, col) {
    const fs = streak
      ? [
        'varying vec2 vUv; uniform vec3 uCol;',
        'void main() {',
        '  vec2 c = vUv * 2.0 - 1.0;',
        '  float a = exp(-c.y * c.y * 10.0) * smoothstep(1.0, 0.3, abs(c.x));',
        '  vec3 tint = mix(vec3(1.3), vec3(1.0), abs(c.x));',
        '  gl_FragColor = vec4(uCol * tint * a * 0.62, 1.0);',
        '}'
      ].join('\n')
      : [
        'varying vec2 vUv; uniform vec3 uCol;',
        'void main() {',
        '  vec2 c = vUv * 2.0 - 1.0; float r = length(c);',
        '  float a = exp(-r * r * 3.2) * step(r, 1.0) * smoothstep(1.0, 0.7, r);',
        '  gl_FragColor = vec4(uCol * a * 0.62, 1.0);',
        '}'
      ].join('\n');
    return new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color(col[0], col[1], col[2]) } },
      vertexShader: QUAD_VS, fragmentShader: fs, transparent: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      depthWrite: false, side: THREE.DoubleSide
    });
  }

  function quadMatFor(streak, key) {
    const cache = streak ? streakMats : glowMats;
    if (!cache[key]) cache[key] = quadMat(streak, (BULLET_VIS[key] || BULLET_VIS.pistol).col);
    return cache[key];
  }

  const _bp = new THREE.Vector3(), _ax = new THREE.Vector3(), _side = new THREE.Vector3();
  const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _t3 = new THREE.Vector3(), _eye = new THREE.Vector3();

  function spawnBullet(from, dir, d, hit, end) {
    if (!world) return;
    const key = d.model;
    const streak = new THREE.Mesh(quadGeo, quadMatFor(true, key));
    const halo = new THREE.Mesh(quadGeo, quadMatFor(false, key));
    [streak, halo].forEach((m) => {
      m.matrixAutoUpdate = false;
      m.frustumCulled = false;
      world.add(m);
    });

    const dist = Math.max(80, from.distanceTo(end));
    const speed = d.speed || 1100;
    bullets.push({
      streak: streak, halo: halo, vis: BULLET_VIS[key] || BULLET_VIS.pistol,
      dir: dir.clone().normalize(), from: from.clone(),
      travelled: 0, dist: dist, speed: speed, enemy: hit ? hit.enemy : null,
      dmg: d.dmg, life: dist / speed + 0.4
    });
  }

  function spark(x, y, z, col) {
    if (!world) return;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDot(), color: col, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    s.position.set(x, y, z);
    s.scale.setScalar(10);
    world.add(s);
    sparks.push({ s: s, t: 0.22, max: 0.22, grow: 62 });
  }

  /* ---- the strike itself: the arena's own swing effect ------------------
     melee_fx.js paints a punch with two ribbons swept through the front of
     the fighter — the weapon's colour wide, a white core inside it — and a
     fistful of sparks thrown off the knuckles. The same two ribbons here,
     carried into the vale in three dimensions. */
  function ribbon(inner, outer, half, colour, opacity) {
    const segs = 18, pos = new Float32Array((segs + 1) * 6), idx = [];
    for (let i = 0; i <= segs; i++) {
      const a = -half + (i / segs) * half * 2, s = Math.sin(a), c = Math.cos(a);
      // painted in the plane the eye looks through, so the crescent stands up
      // in front of the face instead of lying flat under it
      pos[i * 6] = s * outer; pos[i * 6 + 1] = c * outer; pos[i * 6 + 2] = 0;
      pos[i * 6 + 3] = s * inner; pos[i * 6 + 4] = c * inner; pos[i * 6 + 5] = 0;
      if (i < segs) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: colour, transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide
    }));
  }

  function sparkBurst(x, y, z, colour, n, spd, dx, dz) {
    for (let i = 0; i < n; i++) {
      const spread = (Math.random() - 0.5) * 1.5, ca = Math.cos(spread), sa = Math.sin(spread);
      const ux = dx * ca - dz * sa, uz = dx * sa + dz * ca;
      const v = spd * (0.35 + Math.random());
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: softDot(), color: colour, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      s.position.set(x + ux * 12, y + Math.random() * 12, z + uz * 12);
      const size = 4 + Math.random() * 4;
      s.scale.setScalar(size);
      world.add(s);
      sparks.push({
        s: s, t: 0.42, max: 0.42, size: size,
        vx: ux * v, vy: 30 + Math.random() * 130, vz: uz * v
      });
    }
  }

  // A punch, drawn where it lands: the pit's steel arc, its white core and the
  // sparks off the knuckles.
  function swingFx() {
    if (!world || !C.camera) return;
    const p = C.player();
    const hue = 0xdff0ff;
    const fwd = C.camera.getWorldDirection(new THREE.Vector3());
    // The arc is painted across the eye, not laid flat on the ground: in first
    // person a horizontal ring is seen edge-on and reads as a stray line.
    const grp = new THREE.Group();
    grp.position.copy(C.camera.position).addScaledVector(fwd, 190);
    grp.quaternion.copy(C.camera.quaternion);
    grp.rotateZ(-0.55);
    const wide = ribbon(62, 92, 0.80, hue, 0.85);
    const core = ribbon(70, 84, 0.66, 0xffffff, 0.55);
    grp.add(wide);
    grp.add(core);
    world.add(grp);
    swings.push({ g: grp, t: 0.34, max: 0.34, parts: [wide, core] });
    sparkBurst(p.x + fwd.x * 90, p.y + 110, p.z + fwd.z * 90, hue, 6, 220, fwd.x, fwd.z);
  }

  // The nearest thing standing along the shot, exactly as the arena reads a hit.
  function pick(origin, dir, range) {
    const list = (C.quest && C.quest.state && C.quest.state.enemies) || [];
    let best = null, bestT = Infinity, point = null;
    const v = new THREE.Vector3();
    list.forEach((e) => {
      if (e.dead) return;
      v.set(e.pos.x - origin.x, (e.y + e.height * 0.52) - origin.y, e.pos.z - origin.z);
      const t = v.dot(dir);
      if (t < 60 || t > range) return;
      const px = v.x - dir.x * t, py = v.y - dir.y * t, pz = v.z - dir.z * t;
      const off = Math.sqrt(px * px + py * py + pz * pz);
      const r = Math.max(46, e.height * 0.38);
      if (off > r) return;
      if (t < bestT) { bestT = t; best = e; point = { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t }; }
    });
    return { enemy: best, point: point, dist: bestT };
  }

  function trigger() {
    const d = arm();
    if (cd > 0 || reloadT > 0) return false;
    if (!C.camera) return false;

    if (d.kind === 'melee') {
      cd = d.cd;
      swingDur = (window.MeleeAnim && MeleeAnim.dur) ? MeleeAnim.dur(FIST.name, 'punch') : 0.5;
      swingT = swingDur;
      const facing = new THREE.Vector3();
      C.camera.getWorldDirection(facing);
      const p = C.player();
      if (C.quest && C.quest.attack) C.quest.attack(p, { x: facing.x, z: facing.z }, d.dmg);
      swingFx();
      return true;
    }

    const mag = state.mag[state.equipped] == null ? d.mag : state.mag[state.equipped];
    if (mag <= 0) { reload(); return false; }
    state.mag[state.equipped] = mag - 1;
    cd = d.cd;
    RIG.kick = Math.min(1.5, RIG.kick + (d.model === 'burst' ? 1.0 : d.model === 'marksman' ? 0.34 : 0.6));

    const origin = C.camera.getWorldPosition(new THREE.Vector3());
    const base = C.camera.getWorldDirection(new THREE.Vector3());
    const from = muzzleWorld();

    for (let i = 0; i < d.pellets; i++) {
      const dir = base.clone();
      if (d.spread) {
        // the sights tighten the cone, exactly as the pit's ADS spread does
        const sp = d.spread * spreadMul();
        dir.x += (Math.random() - 0.5) * sp * 2;
        dir.y += (Math.random() - 0.5) * sp * 2;
        dir.z += (Math.random() - 0.5) * sp * 2;
        dir.normalize();
      }
      const hit = pick(origin, dir, d.range);
      // What the crosshair is actually on: the thing the shot has to reach.
      const aim = hit.enemy
        ? new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z)
        : origin.clone().addScaledVector(dir, Math.min(d.range, 1600));
      // The shot leaves the barrel toward that point, never parallel to the
      // view: the pit draws its tracer from the gun to the aim point, and a
      // tracer that runs straight past the crosshair is the one thing that
      // read wrong in the vale.
      const shot = aim.clone().sub(from);
      if (shot.lengthSq() < 4) shot.copy(dir); else shot.normalize();
      spawnBullet(from, shot, d, hit, aim);
    }

    if (flash && muzzle) {
      flash.visible = true;
      flash.material.color.setHex(0xfff0c8);
      flash.scale.setScalar(d.model === 'burst' ? 3.4 : 2.4);
      setTimeout(() => { if (flash) flash.visible = false; }, 55);
    }
    if (C.hud && C.hud.setArms) C.hud.setArms(d.name, ammoText(), d.sprite);
    save();
    return true;
  }

  function reload() {
    const d = arm();
    if (d.kind !== 'gun' || reloadT > 0) return;
    const mag = state.mag[state.equipped] || 0;
    const res = state.reserve[state.equipped] || 0;
    if (mag >= d.mag || res <= 0) return;
    reloadT = 0.9;
  }

  function finishReload() {
    const d = arm();
    const mag = state.mag[state.equipped] || 0;
    const res = state.reserve[state.equipped] || 0;
    const take = Math.min(d.mag - mag, res);
    state.mag[state.equipped] = mag + take;
    state.reserve[state.equipped] = res - take;
    if (C.hud && C.hud.setArms) C.hud.setArms(d.name, ammoText(), d.sprite);
    save();
  }

  function equip(id) {
    if (!ARMS[id] || !state.owned.includes(id)) return;
    if (state.equipped !== id) { RIG.swap = 1; RIG.ads = 0; }
    state.equipped = id;
    dressArm();
    save();
  }

  function give(id) {
    const d = ARMS[id];
    if (!d) return false;
    if (state.owned.includes(id)) {
      if (d.kind === 'gun') {
        state.reserve[id] = (state.reserve[id] || 0) + d.reserve;
        if (C.hud && C.hud.setArms) C.hud.setArms(arm().name, ammoText(), arm().sprite);
      }
      return false;
    }
    state.owned.push(id);
    if (d.kind === 'gun') {
      state.mag[id] = d.mag;
      state.reserve[id] = d.reserve;
    }
    state.equipped = id;
    RIG.swap = 1;
    dressArm();
    save();
    if (C.hud) C.hud.banner('Found: ' + d.name, d.rarity + ' · ' + d.blurb);
    if (C.save) C.save.auto();
    return true;
  }

  // Rounds found in the world — off a monster, or bought from a villager. They
  // go into the arm in hand, or into the first gun owned if the hands are bare.
  function addAmmo(n) {
    const amount = Math.max(0, Math.round(n || 0));
    if (!amount) return false;
    let id = state.equipped;
    if (!ARMS[id] || ARMS[id].kind !== 'gun') {
      id = state.owned.find((k) => ARMS[k] && ARMS[k].kind === 'gun');
    }
    if (!id) return false;
    state.reserve[id] = (state.reserve[id] || 0) + amount;
    if (C.hud && C.hud.setArms) C.hud.setArms(arm().name, ammoText(), arm().sprite);
    save();
    return true;
  }

  function hasGun() {
    return state.owned.some((k) => ARMS[k] && ARMS[k].kind === 'gun');
  }

  // A restart puts the arms back where they were found: bare knuckles, nothing
  // earned, nothing remembered.
  function reset() {
    state.owned = ['fists'];
    state.equipped = 'fists';
    state.mag = {};
    state.reserve = {};
    try { localStorage.removeItem(KEY); } catch (_) {}
    dressArm();
  }

  function cycle() {
    if (state.owned.length < 2) return;
    const i = state.owned.indexOf(state.equipped);
    equip(state.owned[(i + 1) % state.owned.length]);
  }

  /* ---- what the camera is doing, so the arms answer it ----------------- */
  // Called as the view turns: the weapon lags a beat behind the eye.
  function look(dyaw, dpitch) {
    RIG.sy = Math.max(-0.14, Math.min(0.14, RIG.sy - dyaw * 0.5));
    RIG.sp = Math.max(-0.10, Math.min(0.10, RIG.sp + dpitch * 0.4));
  }

  // Called the moment a slide starts: the arms are thrown forward and drop.
  function dash() {
    RIG.dash = Math.min(1.4, RIG.dash + 1);
  }

  function swingPose(t) {
    if (window.MeleeAnim && MeleeAnim.pose) {
      const q = MeleeAnim.pose(FIST.name, 'punch', t, 1);
      if (q) return q;
    }
    // the same jab, if the animation module is not on the page
    const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    const p = Math.max(0, Math.min(1, t));
    const k = p < 0.34 ? -0.40 * ease(p / 0.34)
      : p < 0.64 ? -0.40 + 1.40 * ease((p - 0.34) / 0.30)
        : 1 - 0.78 * ease((p - 0.64) / 0.36);
    return { px: 0, py: 0.6 * k, pz: -11 * k, rx: -0.18 * k, ry: 0, rz: 0, yaw: 0, sc: 1, push: 0 };
  }

  /* ---- one frame ------------------------------------------------------- */
  function update(dt, moving) {
    RIG.tt += dt;
    if (cd > 0) cd -= dt;
    if (reloadT > 0) {
      reloadT -= dt;
      if (reloadT <= 0) { reloadT = 0; finishReload(); }
    }
    if (swingT > 0) swingT = Math.max(0, swingT - dt);

    // movement feeds the bob, exactly as the pit does: speed up, bob up
    RIG.amt += ((moving ? 1 : 0) - RIG.amt) * (1 - Math.exp(-dt * 10));
    RIG.bob += dt * (RIG.amt > 0.03 ? 6 + RIG.amt * 5 : 0);
    RIG.sy *= Math.exp(-dt * 8);
    RIG.sp *= Math.exp(-dt * 8);
    RIG.kick *= Math.exp(-dt * 10);
    RIG.dash *= Math.exp(-dt * 6);
    RIG.swap = Math.max(0, RIG.swap - dt * 3.4);

    // ---- aim down sights, on the pit's own timing ----------------------
    const pr = profile();
    const want = !!(aiming && pr && reloadT <= 0 && !(C.dashing && C.dashing()));
    const stepA = dt / (pr ? pr.time : 0.15);
    RIG.ads = clamp(RIG.ads + (want ? stepA : -stepA * 1.5), 0, 1);
    const aE = eased();
    const sw = 1 - 0.6 * aE, bs = 1 - 0.85 * aE;

    const amt = RIG.amt;
    const swapE = RIG.swap * RIG.swap;
    const rel = reloadT > 0 ? Math.sin((1 - reloadT / 0.9) * Math.PI) : 0;
    RIG.rel = rel;

    const d = arm();
    const melee = d.kind !== 'gun';
    // One composition for both hands, straight out of render3d_fx.js
    // (vmUpdate): the hip pose eased toward the sight pose, with bob,
    // look-sway, recoil, swap, reload dip and the slide riding on top.
    const hip = melee ? HIP_MELEE
      : ((C.arms && C.arms.HIP[d.model]) || { len: 13, x: 6.8, y: -5.8, z: -17.8, yaw: 0.25 });
    const prof = pr || ADS.pistol, len = hip.len;
    let px = lerp(hip.x, 0.7 * len * Math.sin(prof.yaw), aE)
      + Math.sin(RIG.bob) * 0.5 * amt * bs + RIG.sy * 8 * sw
      + Math.sin(RIG.tt * 0.8) * 0.05 * bs - rel * 1.5;
    let py = lerp(hip.y, prof.y, aE)
      + Math.sin(RIG.bob * 2) * 0.45 * amt * bs
      + Math.sin(RIG.tt * 1.7) * 0.1 * (1 - amt * 0.7) * bs
      + RIG.sp * 6 * sw - swapE * 9 - rel * 5.5;
    let pz = lerp(hip.z, prof.z, aE) + RIG.kick * 1.7 * (1 - 0.45 * aE) + RIG.dash * 1.4;
    let yaw = lerp(hip.yaw, prof.yaw, aE);
    let rx = RIG.kick * 0.075 * (1 - 0.45 * aE) + RIG.sp * 1.2 * sw
      - rel * 0.45 - swapE * 0.5 - RIG.dash * 0.22
      + Math.sin(RIG.bob * 2) * 0.012 * amt * bs;
    let ry = RIG.sy * sw;
    let rz = Math.sin(RIG.bob) * 0.02 * amt * bs
      + rel * (0.55 + 0.05 * Math.sin(RIG.tt * 18)) + swapE * 0.25 - RIG.sy * 0.4 * sw;

    if (melee) {
      // the pit adds the swing's own offsets straight onto the pose
      const t = swingT > 0 ? 1 - swingT / swingDur : 0;
      const q = t > 0 ? swingPose(t) : null;
      if (q) {
        px += q.px || 0; py += q.py || 0; pz += q.pz || 0;
        rx += q.rx || 0; ry += q.ry || 0; rz += q.rz || 0;
      }
      if (fistModel) fistModel.pose(px, py, pz, yaw, rx, ry, rz);
    } else if (gunModel) {
      gunModel.pose(px, py, pz, yaw, rx, ry, rz, rel);
    }

    /* ---- the bullets in the air ---- */
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.travelled += b.speed * dt;
      const at = Math.min(b.travelled, b.dist);
      _bp.copy(b.from).addScaledVector(b.dir, at);
      // The pit's own two quads, laid in the world: the streak runs along the
      // shot with its flat turned to the eye (side = cross(ax, eye - P)), the
      // glow faces the eye square.
      if (C.camera) {
        const v = b.vis, sz = v.rad * 1.1 + 1.2;
        const ang = Math.atan2(b.dir.z, b.dir.x);
        _ax.set(Math.cos(ang), 0, Math.sin(ang));
        _side.crossVectors(_ax, _eye.copy(C.camera.position).sub(_bp));
        if (_side.lengthSq() < 1e-6) _side.set(0, 1, 0); else _side.normalize();
        b.streak.matrix.makeBasis(
          _t1.copy(_ax).multiplyScalar(sz * v.len),
          _t2.copy(_side).multiplyScalar(sz),
          _t3.crossVectors(_ax, _side)
        );
        b.streak.matrix.setPosition(_bp);
        b.streak.matrixWorldNeedsUpdate = true;

        const e = C.camera.matrixWorld.elements, gs = v.rad * v.glow;
        b.halo.matrix.makeBasis(
          _t1.set(e[0], e[1], e[2]).multiplyScalar(gs),
          _t2.set(e[4], e[5], e[6]).multiplyScalar(gs),
          _t3.set(e[8], e[9], e[10])
        );
        b.halo.matrix.setPosition(_bp);
        b.halo.matrixWorldNeedsUpdate = true;
      }
      b.life -= dt;
      if (b.travelled >= b.dist || b.life <= 0) {
        spark(_bp.x, _bp.y, _bp.z, b.halo.material.uniforms.uCol.value);
        if (b.enemy && C.monsters) {
          if (C.monsters.hit(b.enemy, b.dmg)) C.quest.kill(b.enemy);
        }
        world.remove(b.streak);
        world.remove(b.halo);
        bullets.splice(i, 1);
      }
    }

    /* ---- the strike ribbon, swept and fading ---- */
    for (let i = swings.length - 1; i >= 0; i--) {
      const w = swings[i];
      w.t -= dt;
      const u = 1 - Math.max(0, w.t) / w.max;
      w.g.scale.setScalar(1 + u * 0.16);
      w.parts[0].material.opacity = (1 - u) * 0.85;
      w.parts[1].material.opacity = (1 - u) * 0.55;
      if (w.t <= 0) {
        world.remove(w.g);
        w.parts.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
        swings.splice(i, 1);
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.t -= dt;
      const u = 1 - Math.max(0, s.t) / s.max;
      if (s.vx !== undefined) {
        // a spark flies, then falls
        s.s.position.x += s.vx * dt;
        s.s.position.y += s.vy * dt;
        s.s.position.z += s.vz * dt;
        s.vy -= 520 * dt;
        s.vx *= Math.exp(-dt * 2.6);
        s.vz *= Math.exp(-dt * 2.6);
        s.s.scale.setScalar(s.size * (1 - u * 0.7));
      } else {
        s.s.scale.setScalar(10 + u * s.grow);
      }
      s.s.material.opacity = Math.max(0, 1 - u);
      if (s.t <= 0) {
        world.remove(s.s);
        s.s.material.dispose();
        sparks.splice(i, 1);
      }
    }
  }

  function render(renderer) {
    if (!viewScene || !viewCam) return;
    renderer.clearDepth();
    renderer.render(viewScene, viewCam);
  }

  function dispose() {
    bullets.forEach((b) => {
      if (b.streak.parent) b.streak.parent.remove(b.streak);
      if (b.halo.parent) b.halo.parent.remove(b.halo);
    });
    bullets.length = 0;
    quadGeo.dispose();
    Object.keys(streakMats).forEach((k) => { streakMats[k].dispose(); delete streakMats[k]; });
    Object.keys(glowMats).forEach((k) => { glowMats[k].dispose(); delete glowMats[k]; });
    sparks.forEach((s) => { if (s.s.parent) s.s.parent.remove(s.s); s.s.material.dispose(); });
    sparks.length = 0;
    swings.forEach((w) => {
      if (w.g.parent) w.g.parent.remove(w.g);
      w.parts.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
    });
    swings.length = 0;
    if (viewScene) {
      viewScene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material.map && o.material.map !== glowTex) o.material.map.dispose();
      });
    }
    if (glowTex) { glowTex.dispose(); glowTex = null; }
    viewScene = null;
    viewCam = null;
    vm = null;
    armRig = null;
    aiming = false;
    RIG.ads = 0;
    fistModel = null;
    gunModel = null;
    muzzle = null;
    flash = null;
    Object.keys(models).forEach((k) => { delete models[k]; });
  }

  C.weapons = {
    ARMS: ARMS, state: state, init: init, resize: resize, render: render, dispose: dispose,
    update: update, trigger: trigger, reload: reload, cycle: cycle, equip: equip, give: give,
    reset: reset, addAmmo: addAmmo, hasGun: hasGun,
    look: look, dash: dash,
    // the pit's own aim system, table and all
    ADS: ADS, CROSS: CROSS, aim: aim, zoom: zoom, reticle: reticle,
    spreadMul: spreadMul, moveMul: moveMul, sensMul: sensMul,
    get aiming() { return aiming; },
    ammoText: ammoText, snapshot: snapshot, restore: restore, save: save, load: load,
    spriteFor(id) { const d = def(id || state.equipped); return d.sprite || ''; },
    get equipped() { return state.equipped; },
    get arm() { return arm(); }
  };
})();
