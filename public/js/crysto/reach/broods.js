/* Crysto — the five broods of the Hollow Reach.
   One species to a country: rime on the ashen shore, root in the black pine,
   ember in the wastes, soul in the drowned mire, storm on the bone crown. Each
   nest is a ring of standing stones round a floating stone of its own colour,
   and each wakes when the walker comes near. Break all five and the thing that
   brooded them comes up out of the crown. */
(function () {
  const C = (window.Crysto = window.Crysto || {});
  const R = (C.reach = C.reach || {});

  R.broods = [
    { id: 'rime', name: 'The Rime Brood', kind: 'elem-rime', country: 'the Ashen Shore', colour: 0x8fd6ff, x: 10000, z: 32000, count: 4 },
    { id: 'root', name: 'The Root Brood', kind: 'elem-quake', country: 'Blackpine', colour: 0x9ce07a, x: -8500, z: 38000, count: 4 },
    { id: 'ember', name: 'The Ember Brood', kind: 'elem-fire', country: 'the Ember Wastes', colour: 0xff9a4c, x: 5000, z: 43500, count: 4 },
    { id: 'soul', name: 'The Soul Brood', kind: 'elem-soul', country: 'the Drowned Mire', colour: 0xc9a8ff, x: -9000, z: 46500, count: 4 },
    { id: 'storm', name: 'The Storm Brood', kind: 'elem-storm', country: 'the Bone Crown', colour: 0xbfe9ff, x: 8000, z: 50500, count: 4 }
  ];

  // Where the mother of all five waits.
  const MATRIARCH = { x: 11000, z: 51200 };

  let matriarch = null;
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4c4a46, roughness: 0.92 });

  function softDot() {
    const s = 64, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.38)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(cv);
  }

  /* ---- the nests --------------------------------------------------------- */
  R.buildBroods = function (scene) {
    const dot = softDot();
    R.broods.forEach((b) => {
      const g = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const h = 140 + ((i * 53) % 90);
        const s = new THREE.Mesh(new THREE.ConeGeometry(22, h, 5), stoneMat);
        s.position.set(Math.cos(a) * 255, h / 2, Math.sin(a) * 255);
        s.rotation.z = Math.cos(a) * 0.16;
        s.rotation.x = Math.sin(a) * 0.16;
        s.castShadow = true;
        g.add(s);
      }
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(62, 0),
        new THREE.MeshStandardMaterial({
          color: b.colour, emissive: b.colour, emissiveIntensity: 1.6,
          roughness: 0.35, metalness: 0.2
        })
      );
      crystal.position.y = 270;
      g.add(crystal);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: dot, color: b.colour, transparent: true, opacity: 0.5,
        depthWrite: false, blending: THREE.AdditiveBlending
      }));
      halo.scale.setScalar(560);
      halo.position.y = 270;
      g.add(halo);
      g.position.set(b.x, C.height(b.x, b.z), b.z);
      scene.add(g);

      b.mesh = g;
      b.crystal = crystal;
      b.halo = halo;
      b.spawned = false;
      b.members = [];
      b.cleared = false;
      C.tickers.push((t) => {
        crystal.rotation.y = t * 0.4;
        crystal.position.y = 270 + Math.sin(t * 1.2 + b.x * 0.01) * 14;
        halo.material.opacity = b.cleared ? 0.12 : 0.34 + 0.16 * Math.sin(t * 1.6 + b.z * 0.01);
      });
    });

    const arena = new THREE.Group();
    const ribs = new THREE.MeshStandardMaterial({ color: 0x77766f, roughness: 0.96, flatShading: true });
    const frost = new THREE.MeshStandardMaterial({
      color: 0xb9c7cd, roughness: 0.78, metalness: 0.04, emissive: 0x28353b, emissiveIntensity: 0.12
    });
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      const r = 780 + (i % 3) * 90;
      const x = MATRIARCH.x + Math.cos(a) * r;
      const z = MATRIARCH.z + Math.sin(a) * r;
      const h = 190 + (i * 43 % 170);
      const rib = new THREE.Mesh(new THREE.ConeGeometry(70 + (i % 2) * 22, h, 5), i % 4 === 0 ? frost : ribs);
      rib.position.set(x, C.height(x, z) + h / 2, z);
      rib.rotation.set(Math.sin(a) * 0.12, -a, Math.cos(a) * 0.16);
      rib.castShadow = true;
      arena.add(rib);
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(610, 630, 64),
      new THREE.MeshBasicMaterial({ color: 0x9e8bb7, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(MATRIARCH.x, C.height(MATRIARCH.x, MATRIARCH.z) + 3, MATRIARCH.z);
    arena.add(ring);
    scene.add(arena);
    if (C.keepClear) C.keepClear.push({ x: MATRIARCH.x, z: MATRIARCH.z, r: 700 });
    R.matriarchArena = arena;
  };

  function spawnBrood(b) {
    const list = C.quest && C.quest.state ? C.quest.state.enemies : null;
    if (!list) return;
    b.spawned = true;
    b.members = [];
    for (let i = 0; i < b.count; i++) {
      const a = (i / b.count) * Math.PI * 2 + 0.6;
      const x = b.x + Math.cos(a) * (190 + i * 40);
      const z = b.z + Math.sin(a) * (190 + i * 40);
      const e = C.monsters.make(b.kind, x, z, { x: b.x, z: b.z }, { hp: 190 });
      e.brood = b.id;
      C.scene.add(e.mesh);
      list.push(e);
      b.members.push(e);
    }
    C.hud.banner(b.name, 'The nest has woken');
  }

  function clearBrood(b) {
    if (b.cleared) return;
    b.cleared = true;
    b.members = [];
    if (b.crystal) b.crystal.material.emissiveIntensity = 0.2;
    C.reward(180);
    const n = R.broodsCleared();
    C.hud.banner(b.name + ' is broken', n + ' of 5 broods');
    if (C.quest && C.quest.elixir) C.quest.elixir('brood-' + b.id);
    if (R.people && R.people.broodCleared) R.people.broodCleared(b.id);
    if (R.save) R.save();
  }

  R.broodsCleared = function () {
    return (R.broods || []).filter((b) => b.cleared).length;
  };

  R.broodTarget = function () {
    const next = (R.broods || []).find((b) => !b.cleared);
    return next ? { x: next.x, z: next.z } : { x: -6000, z: 33000 };
  };

  R.matriarchPos = function () { return MATRIARCH; };

  R.markBrood = function (id) {
    const b = (R.broods || []).find((x) => x.id === id);
    if (!b) return;
    b.cleared = true;
    b.spawned = false;
    b.members = [];
    if (b.crystal) b.crystal.material.emissiveIntensity = 0.2;
  };

  /* ---- the mother of the five ------------------------------------------- */
  function spawnMatriarch() {
    const list = C.quest && C.quest.state ? C.quest.state.enemies : null;
    if (!list) return;
    const e = C.monsters.make(
      'void-seraph', MATRIARCH.x, MATRIARCH.z,
      { x: MATRIARCH.x, z: MATRIARCH.z },
      { boss: true, hp: 2600, big: 1.55 }
    );
    e.name = 'The Hollow Matriarch';
    e.matriarch = true;
    e.attackActive = false;
    C.scene.add(e.mesh);
    list.push(e);
    matriarch = e;
    const announce = () => C.hud.banner('The Hollow Matriarch', 'She comes up out of the crown');
    if (C.playFilm) C.playFilm('matriarch', announce);
    else announce();
  }

  R.matriarchDown = function () {
    if (matriarch && matriarch.attackActive && !(C.bossroom && C.bossroom.active())) C.bossattacks.clear();
    matriarch = null;
    if (C.hud && C.hud.setBoss) C.hud.setBoss(null);
    const Q = R.people && R.people.state;
    if (Q) { Q.done.matriarch = true; Q.active = null; }
    C.reward(900);
    try { if (window.RankXP && window.RankXP.addQuest) window.RankXP.addQuest(); } catch (_) {}
    C.hud.banner('The Hollow Matriarch falls', 'The Reach is quiet at last');
    if (C.quest && C.quest.elixir) C.quest.elixir('matriarch');
    if (R.save) R.save();
  };

  R.tickBroods = function (dt, player) {
    const list = C.quest && C.quest.state ? C.quest.state.enemies : null;
    if (!list) return;

    (R.broods || []).forEach((b) => {
      if (b.cleared) return;
      if (!b.spawned) {
        const dx = player.x - b.x, dz = player.z - b.z;
        if (dx * dx + dz * dz < 1800 * 1800) spawnBrood(b);
        return;
      }
      // A death in the vale empties the shared list: the nest goes quiet again
      // and is ready to be walked into.
      const here = b.members.filter((e) => list.indexOf(e) >= 0);
      if (!here.length) { b.spawned = false; b.members = []; return; }
      if (!here.some((e) => !e.dead)) clearBrood(b);
    });

    const Q = R.people && R.people.state;
    const hunting = !!(Q && Q.active === 'matriarch' && !Q.done.matriarch);
    if (!hunting) {
      if (matriarch && matriarch.attackActive && !(C.bossroom && C.bossroom.active())) {
        C.bossattacks.clear();
        matriarch.attackActive = false;
      }
      if (matriarch && C.hud && C.hud.setBoss && !(C.bossroom && C.bossroom.active())) C.hud.setBoss(null);
      return;
    }
    const targetX = matriarch ? matriarch.pos.x : MATRIARCH.x;
    const targetZ = matriarch ? matriarch.pos.z : MATRIARCH.z;
    const close = Math.hypot(player.x - targetX, player.z - targetZ) < 2800;
    if (!matriarch || list.indexOf(matriarch) < 0) {
      matriarch = null;
      if (close) spawnMatriarch();
      return;
    }
    const sanctumActive = !!(C.bossroom && C.bossroom.active());
    if (close && !sanctumActive) {
      if (!matriarch.attackActive) {
        C.bossattacks.start('matriarch', matriarch, MATRIARCH);
        matriarch.attackActive = true;
      }
      C.bossattacks.update(dt);
      if (C.hud && C.hud.setBoss) {
        C.hud.setBoss('The Hollow Matriarch', matriarch.hp / matriarch.maxHp, C.bossattacks.move());
      }
    } else if (matriarch.attackActive) {
      if (!sanctumActive) {
        C.bossattacks.clear();
        if (C.hud && C.hud.setBoss) C.hud.setBoss(null);
      }
      matriarch.attackActive = false;
    }
  };
})();
