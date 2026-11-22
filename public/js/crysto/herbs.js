/* Crysto — what grows out of the ground.
   Bloodroot in the vale, hearthcap on the ash, mireweed in the wet ground: low
   stands of it scattered wherever people walk, and a handful of them put a
   little life back into a walker who is running low. A stand goes to seed when
   it is picked and comes back a while later, so the world keeps giving without
   ever turning into a shop. */
(function () {
  const C = (window.Crysto = window.Crysto || {});
  const H = (C.herbs = C.herbs || {});

  // 0 bloodroot · 1 hearthcap · 2 mireweed
  const KINDS = [
    { name: 'Bloodroot', heal: 14, leaf: 0x7fb84a, glow: 0xa8ff7a },
    { name: 'Hearthcap', heal: 20, leaf: 0xcf8a3a, glow: 0xffc46a },
    { name: 'Mireweed', heal: 26, leaf: 0x4fa08a, glow: 0x8ff0d0 }
  ];

  // Where the stands grow: a scatter round every place worth walking to, never
  // on a village green and never out on the water.
  const PATCHES = [
    { x: 0, z: 0, r: 2300, n: 7, kind: 0 },
    { x: -6200, z: 2600, r: 1000, n: 3, kind: 0 },
    { x: 6400, z: -4200, r: 1000, n: 3, kind: 0 },
    { x: -3200, z: 9800, r: 1000, n: 3, kind: 0 },
    { x: 4200, z: -1400, r: 1200, n: 2, kind: 0 },
    { x: -6000, z: 33000, r: 2600, n: 5, kind: 1 },
    { x: -15000, z: 40000, r: 2400, n: 5, kind: 1 },
    { x: 2000, z: 46000, r: 2600, n: 5, kind: 1 },
    { x: 10000, z: 32000, r: 1700, n: 4, kind: 1 },
    { x: -8500, z: 38000, r: 1700, n: 4, kind: 2 },
    { x: 5000, z: 43500, r: 1700, n: 4, kind: 1 },
    { x: -9000, z: 46500, r: 1700, n: 4, kind: 2 },
    { x: 8000, z: 50500, r: 1700, n: 4, kind: 2 },
    { x: 0, z: 31100, r: 1400, n: 3, kind: 1 }
  ];

  let built = false, glowMats = [];
  const inventory = Object.create(null);
  let food = 70;
  const maxFood = 100;
  let foodClock = 0;
  const list = [];

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  function softDot() {
    const s = 64, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(cv);
  }

  H.build = function (scene) {
    // Every walk builds its own world: the stands of the last visit went with
    // the scene they were planted in.
    if (built) { list.length = 0; glowMats = []; }
    built = true;
    const leafGeo = new THREE.ConeGeometry(15, 52, 5);
    const leafMats = KINDS.map((k) => new THREE.MeshStandardMaterial({ color: k.leaf, roughness: 0.92 }));
    const dot = softDot();
    glowMats = KINDS.map((k) => new THREE.SpriteMaterial({
      map: dot, color: k.glow, transparent: true, opacity: 0.42,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));

    PATCHES.forEach((patch, pi) => {
      const rnd = rng(1000 + pi * 7919);
      const kind = KINDS[patch.kind] || KINDS[0];
      for (let i = 0; i < patch.n; i++) {
        const a = rnd() * Math.PI * 2;
        const d = Math.sqrt(rnd()) * patch.r;
        const x = patch.x + Math.cos(a) * d;
        const z = patch.z + Math.sin(a) * d;
        const y = C.height(x, z);
        if (y < 36) continue;                 // not out on the water
        const g = new THREE.Group();
        for (let k = 0; k < 3; k++) {
          const m = new THREE.Mesh(leafGeo, leafMats[patch.kind] || leafMats[0]);
          const ka = (k / 3) * Math.PI * 2 + rnd();
          m.position.set(Math.cos(ka) * 17, 26, Math.sin(ka) * 17);
          m.rotation.z = Math.cos(ka) * 0.24;
          m.rotation.x = Math.sin(ka) * 0.24;
          m.castShadow = true;
          g.add(m);
        }
        const sp = new THREE.Sprite(glowMats[patch.kind] || glowMats[0]);
        sp.scale.setScalar(118);
        sp.position.y = 56;
        g.add(sp);
        g.position.set(x, y, z);
        scene.add(g);
        list.push({ group: g, x: x, z: z, heal: kind.heal, name: kind.name, ready: true, at: 0 });
      }
    });

    // one pulse for every stand, so the ground reads as alive at a glance
    C.tickers.push((t) => {
      const o = 0.30 + 0.16 * Math.sin(t * 1.7);
      glowMats.forEach((m) => { m.opacity = o; });
    });
  };

  H.tick = function (dt, player) {
    if (!built || !player) return;
    const now = performance.now() / 1000;
    foodClock += dt;
    if (foodClock >= 60) {
      foodClock %= 60;
      food = Math.max(0, food - 1);
    }
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      if (!h.ready) {
        if (now >= h.at) { h.ready = true; h.group.visible = true; }
      }
    }
  };

  H.target = function (player) {
    if (!built || !player) return null;
    let best = null, bestD = 140 * 140;
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      if (!h.ready) continue;
      const dx = player.x - h.x, dz = player.z - h.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = h; }
    }
    return best;
  };

  H.collect = function (player) {
    const h = H.target(player);
    if (!h) return false;
    inventory[h.name] = (inventory[h.name] || 0) + 1;
    h.ready = false;
    h.at = performance.now() / 1000 + 80;
    h.group.visible = false;
    if (C.hud) {
      C.hud.inventoryChanged(inventory, food, maxFood);
      C.hud.banner(h.name + ' gathered', 'Added to your pack');
    }
    if (C.save) C.save.auto();
    return true;
  };

  H.eat = function (name) {
    if (!inventory[name]) return false;
    inventory[name] -= 1;
    if (!inventory[name]) delete inventory[name];
    const values = { Bloodroot: 26, Hearthcap: 34, Mireweed: 42 };
    const healingValues = { Bloodroot: 14, Hearthcap: 20, Mireweed: 26 };
    food = Math.min(maxFood, food + (values[name] || 20));
    const healing = C.heal ? C.heal(healingValues[name] || 8) : 0;
    if (C.hud) {
      C.hud.inventoryChanged(inventory, food, maxFood);
      C.hud.banner('You eat ' + name, '+' + (values[name] || 20) + ' food' + (healing ? ' · +' + healing + ' health' : ''));
    }
    if (C.save) C.save.auto();
    return true;
  };

  H.snapshot = function () {
    return { inventory: Object.assign({}, inventory), food: food };
  };

  H.restore = function (data) {
    Object.keys(inventory).forEach((name) => { delete inventory[name]; });
    if (data && data.inventory) {
      Object.keys(data.inventory).forEach((name) => {
        const count = Math.floor(Number(data.inventory[name]));
        if (KINDS.some((kind) => kind.name === name) && count > 0) inventory[name] = count;
      });
    }
    if (data && data.food != null) food = Math.max(0, Math.min(maxFood, Number(data.food) || 0));
    foodClock = 0;
    if (C.hud) C.hud.inventoryChanged(inventory, food, maxFood);
  };

  H.list = list;
  H.inventory = inventory;
  H.food = function () { return food; };
  H.maxFood = maxFood;
})();
