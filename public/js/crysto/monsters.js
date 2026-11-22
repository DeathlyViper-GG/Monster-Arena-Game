/* Crysto — the things that live in it.
   Every monster here wears the arena's own sprite art (the same PNGs the arena
   draws in 3D) as a camera-facing billboard, and fights with the attack that
   belongs to it: a magma lob that pools fire on the ground, forked storm bolts,
   a slow surge of rime water, a quake ring of stone and a wisp that follows you
   until it burns out. Exposes window.Crysto.monsters. */
(function () {
  const C = (window.Crysto = window.Crysto || {});
  const BASE = 'assets/monsters/';
  const LOADER = new THREE.TextureLoader();
  const TEX = {};
  const ASPECT = {};
  let SHADOW = null;

  // The sheets are painted lying on their side: read as they are, a monster
  // stands on the wall of the screen instead of its own feet. The standee is
  // turned a quarter turn clockwise, so the art stands up the way it was drawn.
  const SPRITE_ROLL = -Math.PI / 2;

  // hp / speed / contact damage / how far it will fire / cooldown between shots
  const KINDS = {
    ravener:       { sprite: 'ravener.png',        hp: 90,  speed: 240, dmg: 10, range: 0,   cd: 0,   el: null,     scale: 1.00, name: 'Ravener' },
    hellforged:    { sprite: 'hellforged.png',     hp: 150, speed: 150, dmg: 14, range: 640, cd: 2.6, el: 'fire',   scale: 1.10, name: 'Hellforged' },
    'gorgon-x':    { sprite: 'gorgon-x.png',       hp: 120, speed: 175, dmg: 13, range: 700, cd: 2.1, el: 'bolt',   scale: 1.05, name: 'Gorgon' },
    noctilith:     { sprite: 'noctilith.png',      hp: 140, speed: 145, dmg: 15, range: 680, cd: 2.8, el: 'shadow', scale: 1.10, name: 'Noctilith' },
    'bone-warden': { sprite: 'bone-warden.png',    hp: 240, speed: 125, dmg: 20, range: 520, cd: 3.2, el: 'shadow', scale: 1.18, name: 'Bone Warden' },
    'elem-fire':   { sprite: 'elem-fire.png',      hp: 140, speed: 170, dmg: 16, range: 620, cd: 2.3, el: 'fire',   scale: 1.08, name: 'Magma Lurker' },
    'elem-storm':  { sprite: 'elem-storm.png',     hp: 140, speed: 160, dmg: 12, range: 720, cd: 2.1, el: 'storm',  scale: 1.08, name: 'Storm Caller' },
    'elem-rime':   { sprite: 'elem-rime.png',      hp: 140, speed: 115, dmg: 12, range: 820, cd: 2.6, el: 'rime',   scale: 1.10, name: 'Rime Warden' },
    'elem-quake':  { sprite: 'elem-quake.png',     hp: 140, speed: 100, dmg: 18, range: 420, cd: 3.4, el: 'quake',  scale: 1.08, name: 'Quake Strider' },
    'elem-soul':   { sprite: 'elem-soul.png',      hp: 140, speed: 150, dmg: 13, range: 620, cd: 3.2, el: 'soul',   scale: 1.08, name: 'Soul Mote' },
    'void-seraph': { sprite: 'void-seraph.png',    hp: 520, speed: 165, dmg: 26, range: 760, cd: 2.4, el: 'shadow', scale: 1.9,  name: 'Hollow Knight' }
  };

  function tex(file) {
    if (!TEX[file]) {
      const t = LOADER.load(BASE + file, (tx) => {
        const im = tx.image;
        if (im && im.height) ASPECT[file] = im.width / im.height;
      });
      if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
      t.anisotropy = 4;
      TEX[file] = t;
    }
    return TEX[file];
  }

  function shadowTex() {
    if (SHADOW) return SHADOW;
    const s = 64, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    SHADOW = new THREE.CanvasTexture(cv);
    return SHADOW;
  }

  let GLOW = null;
  function glowTex() {
    if (GLOW) return GLOW;
    const s = 64, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    GLOW = new THREE.CanvasTexture(cv);
    return GLOW;
  }

  function glow(colour, size, opacity) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: colour, transparent: true, opacity: opacity == null ? 0.6 : opacity,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    sp.scale.setScalar(size);
    return sp;
  }

  // The trail behind a cast: the arena's own soft-edged tracer, laid along the
  // line of flight and turned to the eye. A flat bar with hard edges reads as a
  // plastic strip, so the gradient does the work instead.
  let WAKE_TEX = null;
  function wakeTex() {
    if (WAKE_TEX) return WAKE_TEX;
    // the streak runs along the plane's length (its local +Y), so the gradient
    // fades down its length and is softened across its width
    const w = 32, h = 128, cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    const gy = x.createLinearGradient(0, h, 0, 0);
    gy.addColorStop(0, 'rgba(255,255,255,0)');
    gy.addColorStop(0.45, 'rgba(255,255,255,0.6)');
    gy.addColorStop(0.9, 'rgba(255,255,255,1)');
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
    WAKE_TEX = new THREE.CanvasTexture(cv);
    return WAKE_TEX;
  }

  function wake(colour, r) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: wakeTex(), color: colour, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      })
    );
    m.scale.set(r * 3.2, r * 15, 1);
    return m;
  }

  // The arena builds every elemental cast out of real shapes rather than a dot:
  // a molten boulder with a flame wake, a forked bolt, a wobbling globe of
  // water, a tumbling rock and a wisp with a curling tail. So does this.
  function shotVisual(kind, r, colour) {
    const g = new THREE.Group();
    let core = null, trail = null, orbit = null;

    if (kind === 'fire') {
      // the arena's molten boulder: an obsidian shell with magma burning through
      // the cracks, wrapped in its own heat
      core = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 1.15, 0), new THREE.MeshStandardMaterial({
        color: 0x24120a, emissive: 0xff5a12, emissiveIntensity: 1.15,
        roughness: 0.95, metalness: 0.05, flatShading: true
      }));
      g.add(core);
      g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.74, 0), new THREE.MeshBasicMaterial({ color: 0xffc070 })));
      g.add(glow(0xff8a2a, r * 7, 0.55));
      g.add(glow(0xffe6bc, r * 2.4, 0.85));
      trail = wake(0xff7a22, r); g.add(trail);
    } else if (kind === 'storm' || kind === 'bolt') {
      // a live charge dragging a forked bolt behind it — never a clean ball
      core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      g.add(core);
      g.add(glow(0x9fd8ff, r * 7.5, 0.7));
      orbit = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const s = glow(0xd6efff, r * (1.9 - i * 0.3), 0.8 - i * 0.12);
        s.position.set((Math.random() - 0.5) * r * 1.6, (Math.random() - 0.5) * r * 1.6, -(i + 1) * r * 2.2);
        orbit.add(s);
      }
      g.add(orbit);
    } else if (kind === 'rime') {
      // the arena's water: a heavy rolling globe, a bright core, two spinning crests
      core = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshStandardMaterial({
        color: 0x2f7fbf, emissive: 0x1d63a8, emissiveIntensity: 0.8,
        roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.74
      }));
      g.add(core);
      g.add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xdcf6ff })));
      orbit = new THREE.Group();
      for (let k = 0; k < 2; k++) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(r * 1.15, r * 0.12, 6, 20), new THREE.MeshBasicMaterial({
          color: 0x9fdcff, transparent: true, opacity: 0.55,
          blending: THREE.AdditiveBlending, depthWrite: false
        }));
        t.rotation.set(Math.PI / 2 + (k ? 0.55 : -0.55), 0, k * 1.1);
        orbit.add(t);
      }
      g.add(orbit);
      g.add(glow(0x5fb8ff, r * 5, 0.5));
    } else if (kind === 'soul') {
      // the arena's spirit: a hollow violet core, a torn tail and an iron mask
      core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.85, 12, 10), new THREE.MeshStandardMaterial({
        color: 0x6a3fbf, emissive: 0x8a3cff, emissiveIntensity: 1.3,
        transparent: true, opacity: 0.74, roughness: 0.3
      }));
      g.add(core);
      g.add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.38, 8, 6), new THREE.MeshBasicMaterial({ color: 0xf2e4ff })));
      g.add(glow(0xb87bff, r * 6, 0.6));
      orbit = new THREE.Group();
      const mask = new THREE.Mesh(new THREE.BoxGeometry(r * 0.9, r * 1.1, r * 0.34), new THREE.MeshStandardMaterial({
        color: 0x5a5668, metalness: 0.8, roughness: 0.45, emissive: 0x223355, emissiveIntensity: 0.9
      }));
      mask.position.set(r * 2.1, 0, 0);
      orbit.add(mask);
      g.add(orbit);
    } else {
      // the arena's earth: a tumbling slab of living rock trailing grit
      core = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 1.2, 0), new THREE.MeshStandardMaterial({
        color: 0x6b5b42, emissive: 0x2a2210, emissiveIntensity: 0.45,
        roughness: 0.95, flatShading: true
      }));
      g.add(core);
      const chip = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.7, 0),
        new THREE.MeshStandardMaterial({ color: 0x51452f, roughness: 0.95, flatShading: true }));
      chip.position.set(r * 0.5, r * 0.35, 0);
      g.add(chip);
      g.add(glow(0xd8c48a, r * 3.4, 0.32));
    }
    return { group: g, core: core, wake: trail, orbit: orbit };
  }

  // The village is not a hunting ground. Anything that would wake inside the
  // vale's own walls is put down beyond them instead, so no monster is ever
  // standing among the houses when the walker comes back through the gate.
  const VILLAGE_R = 2100;
  function offVillage(x, z) {
    const v = (C.places && C.places.village) || { x: 0, z: 0 };
    const dx = x - v.x, dz = z - v.z;
    const d = Math.hypot(dx, dz);
    if (d >= VILLAGE_R) return { x: x, z: z };
    const a = d > 1 ? Math.atan2(dz, dx) : Math.random() * Math.PI * 2;
    return { x: v.x + Math.cos(a) * VILLAGE_R, z: v.z + Math.sin(a) * VILLAGE_R };
  }

  function make(kind, x, z, home, opts) {
    opts = opts || {};
    const def = KINDS[kind] || KINDS.ravener;
    const spot = offVillage(x, z);
    x = spot.x;
    z = spot.z;
    if (home && typeof home.x === 'number' && typeof home.z === 'number') {
      const hs = offVillage(home.x, home.z);
      home = Object.assign({}, home, { x: hs.x, z: hs.z });
    }
    const H = 175 * (def.scale || 1) * (opts.boss ? 1.25 : 1) * (opts.big || 1);

    const group = new THREE.Group();
    // A species stands in the round. The arena sheet is only the fallback,
    // for a kind that has no body yet.
    let body = null;
    let bill = null;
    let a0 = 1;
    if (C.species && C.species.build) {
      body = C.species.build(kind, { boss: !!opts.boss, form: opts.form || '' });
    }
    if (body) {
      body.group.scale.setScalar(H / body.height);
      group.add(body.group);
    } else {
      bill = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: tex(def.sprite), transparent: true, alphaTest: 0.18,
          side: THREE.DoubleSide, depthWrite: true
        })
      );
      a0 = ASPECT[def.sprite] || 1;
      bill.scale.set(H * a0, H, 1);
      bill.position.y = H / 2;
      group.add(bill);
    }

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.setScalar(H * 0.52);
    shadow.position.y = 2;
    group.add(shadow);

    // A slim health bar, drawn only once something has actually hit it.
    const bar = new THREE.Group();
    const barBg = new THREE.Mesh(
      new THREE.PlaneGeometry(H * 0.62, 9),
      new THREE.MeshBasicMaterial({ color: 0x120d18, transparent: true, opacity: 0.72, depthWrite: false })
    );
    const barFill = new THREE.Mesh(
      new THREE.PlaneGeometry(H * 0.6, 5),
      new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, depthWrite: false })
    );
    barFill.position.z = 0.4;
    bar.add(barBg, barFill);
    bar.position.y = H * 1.06;
    bar.visible = false;
    group.add(bar);

    const y = C.height(x, z);
    group.position.set(x, y, z);

    const e = {
      kind: kind, type: kind, name: opts.name || def.name, mesh: group, bill: bill, body: body,
      bar: bar, barFill: barFill,
      hp: opts.hp || def.hp, maxHp: opts.hp || def.hp, dmg: def.dmg, speed: def.speed,
      cd: def.cd, range: def.range, el: def.el, height: H,
      pos: { x: x, z: z }, y: y, home: home || { x: x, z: z },
      hitT: 0, dead: false, boss: !!opts.boss, phase: Math.random() * 6.283, shotAt: 0, aspect: a0
    };
    return e;
  }

  /* ---- what each of them throws at you -------------------------------- */

  const shots = [];
  const _w = new THREE.Vector3();
  const _q = new THREE.Quaternion();

  const COLOURS = {
    fire: 0xff8a3c, bolt: 0xffd08a, storm: 0xbfe9ff,
    rime: 0x6fc8ff, soul: 0xc98cff, shadow: 0x8a5cd8
  };

  function orb(x, y, z, r, colour) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(r, 10, 8),
      new THREE.MeshBasicMaterial({ color: colour })
    );
    m.position.set(x, y, z);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.9, 10, 8),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.28, depthWrite: false })
    );
    m.add(halo);
    return m;
  }

  function launch(opts) {
    const colour = COLOURS[opts.kind] || 0xffffff;
    const vis = shotVisual(opts.kind, opts.r || 20, colour);
    vis.group.position.set(opts.x, opts.y, opts.z);
    const s = {
      kind: opts.kind, x: opts.x, y: opts.y, z: opts.z,
      vx: opts.vx, vy: opts.vy || 0, vz: opts.vz,
      life: opts.life || 3.2, dmg: opts.dmg || 10, pool: !!opts.pool,
      homing: !!opts.homing, mesh: vis.group, core: vis.core, wake: vis.wake, orbit: vis.orbit,
      trail: 0
    };
    C.scene.add(s.mesh);
    shots.push(s);
    return s;
  }

  function burst(x, y, z, colour, size) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(size || 26, 10, 8),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.85, depthWrite: false })
    );
    m.position.set(x, y, z);
    C.scene.add(m);
    shots.push({ kind: 'burst', x: x, y: y, z: z, life: 0.34, max: 0.34, dmg: 0, mesh: m, vx: 0, vy: 0, vz: 0 });
  }

  // The Quake Strider does not throw anything: it splits the ground, and the
  // ring of stone runs out from its feet.
  function quake(e) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 40, 1),
      new THREE.MeshBasicMaterial({ color: 0xd8c48a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(e.pos.x, e.y + 4, e.pos.z);
    C.scene.add(ring);
    shots.push({
      kind: 'quake', x: e.pos.x, y: e.y + 4, z: e.pos.z, vx: 0, vy: 0, vz: 0,
      life: 1.15, max: 1.15, dmg: e.dmg, mesh: ring, r: 20, hit: false, speed: 620
    });
  }

  function fire(e, player) {
    const px = player.x, pz = player.z;
    const sx = e.pos.x, sy = e.y + e.height * 0.58, sz = e.pos.z;
    const dx = px - sx, dz = pz - sz;
    const d = Math.hypot(dx, dz) || 1;
    const nx = dx / d, nz = dz / d;

    if (e.el === 'quake') { quake(e); return; }

    if (e.el === 'storm') {
      for (const a of [-0.26, 0, 0.26]) {
        const cs = Math.cos(a), sn = Math.sin(a);
        launch({
          kind: 'storm', x: sx, y: sy, z: sz, r: 15, dmg: e.dmg, life: 2.4,
          vx: (nx * cs - nz * sn) * 900, vz: (nx * sn + nz * cs) * 900, vy: -20
        });
      }
      return;
    }
    if (e.el === 'rime') {
      launch({ kind: 'rime', x: sx, y: sy, z: sz, r: 28, dmg: e.dmg, life: 4, vx: nx * 330, vz: nz * 330 });
      return;
    }
    if (e.el === 'soul') {
      launch({ kind: 'soul', x: sx, y: sy, z: sz, r: 20, dmg: e.dmg, life: 5.5, vx: nx * 300, vz: nz * 300, homing: true });
      return;
    }
    if (e.el === 'fire') {
      // lobbed: it drops a burning pool where it lands
      launch({ kind: 'fire', x: sx, y: sy + 30, z: sz, r: 24, dmg: e.dmg, life: 3.4, vx: nx * 520, vz: nz * 520, vy: 120, pool: true });
      return;
    }
    if (e.el === 'bolt') {
      launch({ kind: 'bolt', x: sx, y: sy, z: sz, r: 15, dmg: e.dmg, life: 2.6, vx: nx * 1000, vz: nz * 1000 });
      return;
    }
    launch({ kind: 'shadow', x: sx, y: sy, z: sz, r: 22, dmg: e.dmg, life: 3.2, vx: nx * 620, vz: nz * 620 });
  }

  function pool(x, z, dmg) {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(96, 20),
      new THREE.MeshBasicMaterial({ color: 0xff6a2a, transparent: true, opacity: 0.42, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, (C.groundAt ? C.groundAt(x, z) : C.height(x, z)) + 5, z);
    C.scene.add(m);
    shots.push({ kind: 'pool', x: x, y: m.position.y, z: z, vx: 0, vy: 0, vz: 0, life: 4, max: 4, dmg: dmg * 0.5, mesh: m, r: 96, next: 0 });
  }

  /* ---- one monster, one frame ---------------------------------------- */
  function update(e, dt, now, player, camera) {
    if (e.dead) return;

    const dx = player.x - e.pos.x, dz = player.z - e.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    // a sanctum guardian sets its own fighting distance (bossattacks.js)
    const keep = e.keep != null ? e.keep : (e.el === 'quake' ? 280 : (e.range ? Math.min(e.range * 0.6, 320) : 80));
    const aggro = e.boss ? 1700 : 1200;

    if (d < aggro && d > keep) {
      const step = Math.min(e.speed * dt, d - keep);
      const nx = e.pos.x + (dx / d) * step;
      const nz = e.pos.z + (dz / d) * step;
      // monsters never walk into water or through the village's walls
      const g = C.groundAt ? C.groundAt(nx, nz) : C.height(nx, nz);
      if (g > 6) { e.pos.x = nx; e.pos.z = nz; }
    }

    e.y = C.groundAt ? C.groundAt(e.pos.x, e.pos.z) : C.height(e.pos.x, e.pos.z);
    e.mesh.position.set(e.pos.x, e.y + Math.sin(now * 1.6 + e.phase) * 3, e.pos.z);

    if (e.bar && C.camera) e.bar.quaternion.copy(C.camera.quaternion);
    if (e.body) {
      const moving = d < aggro && d > keep + 8;
      if (d < aggro) e.body.group.rotation.y = Math.atan2(dx, dz);
      e.body.animate(now + e.phase, moving, e.hitT > 0);
      const base = e.height / e.body.height;
      const k = e.hitT > 0 ? 1 + e.hitT * 0.2 : 1;
      e.body.group.scale.setScalar(base * k);
    } else if (e.bill && C.camera) {
      // The arena draws every monster as a standee turned to the eye, so the eye
      // is the only thing that decides which way is up.
      e.bill.quaternion.copy(C.camera.quaternion);
      e.bill.rotateZ(SPRITE_ROLL);
      const a = ASPECT[KINDS[e.kind].sprite] || 1;
      if (a !== e.aspect) e.aspect = a;
      const k = e.hitT > 0 ? 1 + e.hitT * 0.35 : 1;
      e.bill.scale.set(e.height * e.aspect * k, e.height * k, 1);
      e.bill.material.color.setHex(e.hitT > 0 ? 0xffb0b0 : 0xffffff);
    }

    if (e.hitT > 0) e.hitT -= dt;

    if (e.maxHp && e.hp < e.maxHp) {
      e.bar.visible = true;
      const k = Math.max(0, e.hp / e.maxHp);
      e.barFill.scale.x = k;
      e.barFill.position.x = -e.height * 0.3 * (1 - k);
    }

    if (e.el && d < e.range && d > 40) {
      if (!e.shotAt) e.shotAt = now + 0.6 + Math.random();
      if (now > e.shotAt) {
        e.shotAt = now + e.cd * (0.85 + Math.random() * 0.3);
        fire(e, player);
      }
    }

    if (d < 120 && !e.el && !e.noTouch && now - (e.touchAt || 0) > 1.1) {
      e.touchAt = now;
      C.hurtPlayer(e.dmg);
    }
  }

  function hit(e, dmg) {
    // an iron ward (the Rime Warden's utility) turns most of a blow aside
    if (e.wardUntil && performance.now() / 1000 < e.wardUntil) dmg *= 0.25;
    e.hp -= dmg;
    e.hitT = 0.24;
    // and the blow is read out over its chest, the way the arena pops one
    if (C.damage) C.damage(e.pos.x, e.y + e.height * 0.62, e.pos.z, dmg);
    if (e.hp <= 0) return true;
    return false;
  }

  /* ---- everything in the air ----------------------------------------- */
  function tickShots(dt, player) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.life -= dt;

      if (s.kind === 'burst') {
        const k = 1 - s.life / s.max;
        s.mesh.scale.setScalar(0.4 + k * 2.2);
        s.mesh.material.opacity = 0.85 * (1 - k);
        if (s.life <= 0) { C.scene.remove(s.mesh); shots.splice(i, 1); }
        continue;
      }

      if (s.kind === 'quake') {
        const k = 1 - s.life / s.max;
        s.r = 20 + k * 700;
        s.mesh.scale.setScalar(s.r);
        s.mesh.material.opacity = 0.8 * (1 - k * 0.8);
        const dd = Math.hypot(player.x - s.x, player.z - s.z);
        if (!s.hit && Math.abs(dd - s.r) < 70) { s.hit = true; C.hurtPlayer(s.dmg); }
        if (s.life <= 0) { C.scene.remove(s.mesh); shots.splice(i, 1); }
        continue;
      }

      if (s.kind === 'pool') {
        s.mesh.material.opacity = 0.42 * Math.min(1, s.life / 1.2);
        const dd = Math.hypot(player.x - s.x, player.z - s.z);
        if (dd < s.r && s.life > 0.6) {
          if (!s.next) s.next = 0;
          if (performance.now() / 1000 > s.next) { s.next = performance.now() / 1000 + 1; C.hurtPlayer(s.dmg); }
        }
        if (s.life <= 0) { C.scene.remove(s.mesh); shots.splice(i, 1); }
        continue;
      }

      // homing wisps steer toward the walker
      if (s.homing) {
        const dx = player.x - s.x, dz = player.z - s.z;
        const d = Math.hypot(dx, dz) || 1;
        s.vx += ((dx / d) * 420 - s.vx) * Math.min(1, dt * 1.8);
        s.vz += ((dz / d) * 420 - s.vz) * Math.min(1, dt * 1.8);
      }
      if (s.vy) s.vy -= 260 * dt;

      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.mesh.position.set(s.x, s.y, s.z);

      // the cast's own trail, laid along its flight and turned to the eye
      if (s.wake && C.camera) {
        s.wake.quaternion.copy(C.camera.quaternion);
        _w.set(s.vx, s.vy, s.vz).normalize().applyQuaternion(_q.copy(C.camera.quaternion).invert());
        s.wake.rotateZ(Math.atan2(-_w.x, _w.y));
      }
      if (s.core) s.core.rotation.y += dt * 6;
      if (s.orbit) s.orbit.rotation.z += dt * 3.4;

      const ground = C.groundAt ? C.groundAt(s.x, s.z) : C.height(s.x, s.z);
      const dd = Math.hypot(player.x - s.x, player.z - s.z);

      if (dd < 90 && Math.abs(s.y - (player.y + 90)) < 150) {
        C.hurtPlayer(s.dmg);
        burst(s.x, s.y, s.z, COLOURS[s.kind] || 0xffffff, 34);
        C.scene.remove(s.mesh);
        shots.splice(i, 1);
        continue;
      }
      if (s.life <= 0 || s.y < ground) {
        if (s.pool) pool(s.x, s.z, s.dmg);
        burst(s.x, Math.max(s.y, ground + 10), s.z, COLOURS[s.kind] || 0xffffff, 30);
        C.scene.remove(s.mesh);
        shots.splice(i, 1);
      }
    }
  }

  function clear() {
    shots.forEach((s) => C.scene.remove(s.mesh));
    shots.length = 0;
  }

  C.monsters = {
    KINDS: KINDS, make: make, update: update, hit: hit,
    tickShots: tickShots, clear: clear,
    // the sanctum guardians borrow the same projectiles and bursts
    launch: launch, burst: burst, shots: shots,
    // A monster that a shrine's vigil calls up, by name.
    at: (kind, x, z, home) => make(kind, x, z, home)
  };
})();
