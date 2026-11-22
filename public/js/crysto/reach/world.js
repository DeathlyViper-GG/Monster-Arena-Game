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

  R.PATHS = [
    {
      name: 'Root Shrine Trail',
      points: [
        { x: -540, z: 620 }, { x: -1450, z: 820 }, { x: -3180, z: 1240 },
        { x: -4820, z: 1950 }, { x: -6200, z: 2900 }
      ]
    },
    {
      name: 'Tide Shrine Trail',
      points: [
        { x: 0, z: 820 }, { x: -720, z: 2280 }, { x: -1500, z: 4600 },
        { x: -2440, z: 7200 }, { x: -3200, z: 10080 }
      ]
    },
    {
      name: 'Keep Road',
      points: [
        { x: 3400, z: -520 }, { x: 3650, z: -1700 }, { x: 4300, z: -3000 },
        { x: 5050, z: -4100 }, { x: 6000, z: -5100 }
      ]
    },
    {
      name: 'Ember Shrine Spur',
      points: [
        { x: 5050, z: -4100 }, { x: 5600, z: -4120 }, { x: 6100, z: -4130 },
        { x: 6400, z: -3900 }
      ]
    },
    {
      name: 'The Shore Road',
      points: [
        { x: 0, z: 31120 }, { x: -380, z: 31640 }, { x: -1240, z: 32020 },
        { x: -2250, z: 32400 }, { x: -3420, z: 32750 }, { x: -4740, z: 33050 },
        { x: -6900, z: 33100 }
      ]
    },
    {
      name: 'The Old Pine Road',
      points: [
        { x: -6900, z: 33100 }, { x: -7900, z: 33700 }, { x: -9100, z: 34600 },
        { x: -9440, z: 35550 }, { x: -10850, z: 36900 }, { x: -12100, z: 38300 },
        { x: -13700, z: 39500 }, { x: -15800, z: 40100 }
      ]
    },
    {
      name: 'The Reed Track',
      points: [
        { x: -15100, z: 40100 }, { x: -14020, z: 40900 }, { x: -13050, z: 41650 },
        { x: -12000, z: 42000 }, { x: -12800, z: 43050 }, { x: -13900, z: 44000 }
      ]
    },
    {
      name: 'The Cinder Road',
      points: [
        { x: -6900, z: 33100 }, { x: -4200, z: 34400 }, { x: -2150, z: 35900 },
        { x: 300, z: 37400 }, { x: 2420, z: 39100 }, { x: 4100, z: 41150 },
        { x: 2800, z: 43500 }, { x: 2000, z: 44900 }
      ]
    },
    {
      name: 'The Crown Way',
      points: [
        { x: 2000, z: 44900 }, { x: 3800, z: 46800 }, { x: 5550, z: 47800 },
        { x: 6800, z: 48950 }, { x: 8200, z: 50400 }, { x: 10400, z: 50150 },
        { x: 12000, z: 48000 }
      ]
    },
    {
      name: 'Pine Stalkers’ Track',
      points: [
        { x: -6900, z: 33100 }, { x: -9100, z: 33600 }, { x: -12800, z: 34100 },
        { x: -15900, z: 34600 }, { x: -18000, z: 35000 }
      ]
    },
    {
      name: 'Shore Raiders’ Spur',
      points: [
        { x: -2150, z: 35900 }, { x: -2100, z: 36500 }, { x: -2000, z: 37000 }
      ]
    },
    {
      name: 'Ember Warband Spur',
      points: [
        { x: 4100, z: 41150 }, { x: 5600, z: 40500 }, { x: 7300, z: 40200 },
        { x: 9000, z: 40000 }
      ]
    }
  ];

  const PATH_CELL = 1000, PATH_MARGIN = 220;
  const pathIndex = Object.create(null);
  R.PATHS.forEach((route) => {
    for (let i = 0; i < route.points.length - 1; i++) {
      const a = route.points[i], b = route.points[i + 1];
      const segment = {
        a: a, dx: b.x - a.x, dz: b.z - a.z,
        length2: (b.x - a.x) * (b.x - a.x) + (b.z - a.z) * (b.z - a.z)
      };
      const minX = Math.floor((Math.min(a.x, b.x) - PATH_MARGIN) / PATH_CELL);
      const maxX = Math.floor((Math.max(a.x, b.x) + PATH_MARGIN) / PATH_CELL);
      const minZ = Math.floor((Math.min(a.z, b.z) - PATH_MARGIN) / PATH_CELL);
      const maxZ = Math.floor((Math.max(a.z, b.z) + PATH_MARGIN) / PATH_CELL);
      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          const key = x + ',' + z;
          if (!pathIndex[key]) pathIndex[key] = [];
          pathIndex[key].push(segment);
        }
      }
    }
  });

  function roadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#765d43';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1700; i++) {
      const shade = Math.random();
      ctx.fillStyle = shade > 0.5
        ? 'rgba(204,177,132,' + (0.04 + shade * 0.12) + ')'
        : 'rgba(35,29,23,' + (0.04 + (1 - shade) * 0.14) + ')';
      ctx.beginPath();
      ctx.ellipse(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 0.8 + Math.random() * 1.8, Math.random() * 3.14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(48,36,26,.22)';
    ctx.lineWidth = 5;
    [68, 188].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + 4, 256);
      ctx.stroke();
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function makeRoad(points, width, material) {
    const samples = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      const n = Math.max(1, Math.ceil(length / 180));
      for (let j = 0; j < n; j++) {
        const t = j / n;
        samples.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      }
    }
    samples.push(points[points.length - 1]);
    const positions = [], uvs = [], indices = [];
    let distance = 0;
    samples.forEach((point, i) => {
      const before = samples[Math.max(0, i - 1)];
      const after = samples[Math.min(samples.length - 1, i + 1)];
      let dx = after.x - before.x, dz = after.z - before.z;
      const length = Math.hypot(dx, dz) || 1;
      dx /= length; dz /= length;
      const half = width / 2, nx = -dz, nz = dx;
      const left = { x: point.x - nx * half, z: point.z - nz * half };
      const right = { x: point.x + nx * half, z: point.z + nz * half };
      if (i) distance += Math.hypot(point.x - before.x, point.z - before.z);
      positions.push(left.x, C.height(left.x, left.z) + 5, left.z);
      positions.push(right.x, C.height(right.x, right.z) + 5, right.z);
      uvs.push(0, distance / 210, 1, distance / 210);
      if (i < samples.length - 1) {
        const k = i * 2;
        indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  R.pathContains = function (x, z, padding) {
    const radius = 77 + (padding || 0);
    const radius2 = radius * radius;
    const segments = pathIndex[Math.floor(x / PATH_CELL) + ',' + Math.floor(z / PATH_CELL)] || [];
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const t = Math.max(0, Math.min(1, ((x - segment.a.x) * segment.dx + (z - segment.a.z) * segment.dz) / segment.length2));
      const ox = x - segment.a.x - segment.dx * t;
      const oz = z - segment.a.z - segment.dz * t;
      if (ox * ox + oz * oz < radius2) return true;
    }
    return false;
  };

  R.buildPaths = function (scene) {
    const material = new THREE.MeshStandardMaterial({
      map: roadTexture(), color: 0xc2a27b, roughness: 0.98, metalness: 0
    });
    R.PATHS.forEach((path) => scene.add(makeRoad(path.points, 154, material)));
  };

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
