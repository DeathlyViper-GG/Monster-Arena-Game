/* Crysto — the Hollow Reach: the villages, the camps' furniture and the
   doorway. Every part is the vale's own proven builder wearing the Reach's
   wood and colour, so a town beyond the water is as solid as the one you
   woke in. */
(function () {
  const C = (window.Crysto = window.Crysto || {});
  const R = (C.reach = C.reach || {});

  const mat = (c, r, m) => new THREE.MeshStandardMaterial({
    color: c, roughness: r == null ? 0.88 : r, metalness: m || 0
  });

  // Three towns, each with its own wood and its own colour: ash and rust on the
  // shore, tar-dark timber in the pines, bone stone on the crown.
  R.villages = [
    {
      id: 'ashfall', name: 'Ashfall', x: -6000, z: 33000, ring: 780, houses: 8,
      wall: 0x8d8678, roof: 0x6a3a2a, thatch: false, banner: 0xb4552f, fire: 0xff8a3a,
      blurb: 'Grey huts on grey ash, and a bell that has not rung in a century.'
    },
    {
      id: 'blackpine', name: 'Blackpine', x: -15000, z: 40000, ring: 700, houses: 7,
      wall: 0x5b5348, roof: 0x2c2823, thatch: true, banner: 0x3f6b58, fire: 0x9fe3ff,
      blurb: 'Tar-dark timber under the pines, where the smoke never quite clears.'
    },
    {
      id: 'cinderfall', name: 'Cinderfall', x: 2000, z: 46000, ring: 860, houses: 9,
      wall: 0xa8a294, roof: 0x4a4a52, thatch: false, banner: 0x9a7ad0, fire: 0xbfd8ff,
      blurb: 'Bone-pale stone on the crown, built on the bones of something older.'
    }
  ];

  /* ---- a pole with a torn cloth: the colours of whoever holds this ground -- */
  function banner(x, z, colour) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(5, 8, 340, 8), mat(0x3b332a));
    pole.position.y = 170;
    pole.castShadow = true;
    g.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(96, 190), mat(colour, 0.96));
    cloth.position.set(48, 236, 0);
    g.add(cloth);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(9, 34, 6), mat(0xc9b06a, 0.4, 0.8));
    tip.position.y = 356;
    g.add(tip);
    g.position.set(x, C.height(x, z), z);
    C.tickers.push((t) => { cloth.rotation.y = Math.sin(t * 1.6 + x * 0.01) * 0.22; });
    return { group: g, cloth: cloth };
  }

  /* ---- a bowl of coals on a tripod: cold until something wakes it --------- */
  function brazier(x, z, colour) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 150, 6), mat(0x3a3a3a, 0.6, 0.5));
      leg.position.set(Math.cos(a) * 34, 75, Math.sin(a) * 34);
      leg.rotation.z = -Math.cos(a) * 0.22;
      leg.rotation.x = Math.sin(a) * 0.22;
      g.add(leg);
    }
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(58, 34, 46, 12), mat(0x4a4a4a, 0.5, 0.6));
    bowl.position.y = 162;
    bowl.castShadow = true;
    g.add(bowl);
    const coals = new THREE.Mesh(new THREE.CylinderGeometry(44, 44, 10, 12), mat(0x2a1a14, 0.95));
    coals.position.y = 184;
    g.add(coals);
    const fire = C.build.flame(0, 200, 0, colour, 70);
    fire.sprite.visible = false;
    g.add(fire.sprite);
    C.tickers.push(fire.tick);
    g.position.set(x, C.height(x, z), z);
    return {
      group: g, pos: { x: x, z: z }, lit: false, colour: colour,
      light() {
        if (this.lit) return false;
        this.lit = true;
        fire.sprite.visible = true;
        coals.material = mat(0x6a2a10, 0.7);
        return true;
      }
    };
  }

  /* ---- a raider's tent: a hide over poles, with guy ropes ----------------- */
  function tent(x, z, rotY, colour) {
    const g = new THREE.Group();
    const hide = new THREE.Mesh(new THREE.ConeGeometry(122, 194, 4), mat(colour, 0.96));
    hide.rotation.y = Math.PI / 4;
    hide.position.y = 97;
    hide.castShadow = true;
    g.add(hide);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(70, 124), mat(0x241d18, 0.98));
    door.position.set(0, 62, 86);
    g.add(door);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 200, 4), mat(0x6a5a44, 0.95));
      rope.position.set(Math.cos(a) * 100, 96, Math.sin(a) * 100);
      rope.rotation.z = -Math.cos(a) * 0.62;
      rope.rotation.x = Math.sin(a) * 0.62;
      g.add(rope);
    }
    g.position.set(x, C.height(x, z), z);
    g.rotation.y = rotY || 0;
    return g;
  }

  function crate(x, z) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(74, 58, 74), mat(0x5a4632, 0.95));
    b.position.y = 29;
    b.castShadow = true;
    g.add(b);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(80, 10, 80), mat(0x473523, 0.95));
    lid.position.y = 62;
    g.add(lid);
    g.position.set(x, C.height(x, z), z);
    g.rotation.y = x * 0.03;
    return g;
  }

  function spikes(x, z) {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const h = 120 + ((i * 37) % 70);
      const s = new THREE.Mesh(new THREE.ConeGeometry(14, h, 6), mat(0x4a3a2c, 0.9));
      s.position.set(((i % 3) - 1) * 62, h / 2, (((i / 3) | 0) - 0.5) * 90);
      s.rotation.z = ((i % 2) - 0.5) * 0.24;
      g.add(s);
    }
    g.position.set(x, C.height(x, z), z);
    return g;
  }

  /* ---- the Hollow Doorway: two stones and a veil between them ------------- */
  function doorway(x, z, rotY, colour) {
    const g = new THREE.Group();
    const stone = mat(0x4e4a44, 0.85);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(58, 330, 58), stone);
      post.position.set(sx * 132, 165, 0);
      post.castShadow = true;
      g.add(post);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(76, 30, 76), mat(0x5d5850, 0.85));
      cap.position.set(sx * 132, 340, 0);
      g.add(cap);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(348, 64, 64), stone);
    lintel.position.y = 350;
    lintel.castShadow = true;
    g.add(lintel);
    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(206, 300),
      new THREE.MeshBasicMaterial({
        color: colour, transparent: true, opacity: 0.32,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    veil.position.y = 152;
    g.add(veil);
    const seal = new THREE.Mesh(new THREE.TorusGeometry(58, 4, 6, 22), mat(colour, 0.4, 0.6));
    seal.position.y = 152;
    g.add(seal);
    g.position.set(x, C.height(x, z), z);
    g.rotation.y = rotY || 0;
    C.tickers.push((t) => {
      veil.material.opacity = 0.22 + 0.14 * Math.sin(t * 1.7);
      seal.rotation.z = t * 0.5;
    });
    return { group: g, pos: { x: x, z: z } };
  }

  R.props = { tent, crate, spikes, banner, brazier, doorway };

  /* ---- the three towns --------------------------------------------------- */
  R.buildVillages = function (scene, colliders) {
    const B = C.build;
    const crown = [];
    const greens = [];

    R.villages.forEach((v, vi) => {
      // the town keeps its own ground clear of trees and rocks
      C.keepClear.push({ x: v.x, z: v.z, r: v.ring + 560 });

      const well = B.well(v.x, v.z);
      scene.add(well);
      colliders.push({ x: v.x, z: v.z, r: 78 });

      // the ring of houses, each turned to face the green
      for (let i = 0; i < v.houses; i++) {
        const a = (i / v.houses) * Math.PI * 2 + 0.34 + vi * 0.2;
        const r = v.ring + (i % 2) * 64;
        const hx = v.x + Math.cos(a) * r, hz = v.z + Math.sin(a) * r;
        const w = 194 + ((i * 37) % 48), d = 186 + ((i * 53) % 52);
        const h = B.house({
          w: w, d: d, h: 194 + ((i * 29) % 42),
          wall: v.wall, roof: v.roof, thatch: v.thatch && i % 3 === 0
        });
        h.position.set(hx, C.height(hx, hz), hz);
        h.rotation.y = Math.atan2(v.x - hx, v.z - hz);
        scene.add(h);
        colliders.push({ x: hx, z: hz, r: Math.max(w, d) * 0.5 });
        (C.roadClear = C.roadClear || []).push({ x: hx, z: hz, r: Math.max(w, d) * 0.62 });

        // a yard behind each house: a fence and something growing
        const gx = v.x + Math.cos(a) * (r + 250), gz = v.z + Math.sin(a) * (r + 250);
        const plot = new THREE.Group();
        plot.add(B.garden(210, 158));
        const back = B.fence(248);
        back.position.set(0, 0, -94);
        plot.add(back);
        for (const sx of [-1, 1]) {
          const side = B.fence(170);
          side.rotation.y = Math.PI / 2;
          side.position.set(sx * 124, 0, 0);
          plot.add(side);
        }
        plot.position.set(gx, C.height(gx, gz), gz);
        plot.rotation.y = Math.atan2(v.x - gx, v.z - gz);
        scene.add(plot);
      }

      // the gate banners and the work of a place people live in
      const ba = 1.1 + vi;
      scene.add(banner(v.x + Math.cos(ba) * (v.ring - 40), v.z + Math.sin(ba) * (v.ring - 40), v.banner).group);
      scene.add(banner(v.x + Math.cos(ba + 0.22) * (v.ring - 40), v.z + Math.sin(ba + 0.22) * (v.ring - 40), v.banner).group);

      const cart = B.cart();
      cart.position.set(v.x + 190, C.height(v.x + 190, v.z - 240), v.z - 240);
      cart.rotation.y = 0.6 + vi;
      scene.add(cart);

      const hay = B.haystack();
      hay.position.set(v.x - 300, C.height(v.x - 300, v.z + 260), v.z + 260);
      scene.add(hay);
      colliders.push({ x: v.x - 300, z: v.z + 260, r: 90 });

      // a fire in the middle of every green
      const green = brazier(v.x + 170, v.z + 150, v.fire);
      green.light();
      scene.add(green.group);
      greens.push(green);

      // Cinderfall's three fires stand out on the crown, waiting for a hand
      if (v.id === 'cinderfall') {
        [0.4, 2.5, 4.6].forEach((a, i) => {
          const bx = v.x + Math.cos(a) * 950, bz = v.z + Math.sin(a) * 950;
          const b = brazier(bx, bz, 0xffd27a);
          b.id = 'crown-' + i;
          scene.add(b.group);
          colliders.push({ x: bx, z: bz, r: 60 });
          crown.push(b);
        });
      }
    });

    R.works = { crown: crown, greens: greens };
    return R.works;
  };
})();
