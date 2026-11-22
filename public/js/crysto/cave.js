/* Crysto — the cave you wake in.
   A whole mountain, not a hole: a vast round chamber of cut stone and living
   rock, a colonnade of carved pillars, a broken altar where the pod came down,
   and a long processional way out — braziers, glyphs on the floor and daylight
   pouring through a doorway big enough to walk a cart through. There is no
   doubt which way the hero goes. The floor inside is analytic, exactly like the
   land, so the walker never falls through a rock. */
(function () {
  const C = (window.Crysto = window.Crysto || {});

  // Where the crag stands, and which way it faces. It stands on the line of the
  // north-east lane, so the walk down out of the mountain lands on a road into
  // the village rather than in somebody's garden.
  const CH = { x: 2768, z: 1585 };
  const DIR = { x: 0, z: 0 };
  (function () {
    const l = Math.hypot(CH.x, CH.z) || 1;
    DIR.x = -CH.x / l;
    DIR.z = -CH.z / l;
  })();
  const PERP = { x: DIR.z, z: -DIR.x };

  const R = 330;    // the chamber's floor
  const A0 = 330;   // where the processional way leaves the chamber
  const A1 = 900;   // the great doorway, open to the sky
  const A2 = 1080;  // the ledge ends
  const A3 = 1750;  // the ramp's foot, back on the meadow
  const HALF = 160; // how wide the walkable floor is, all the way out

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  let BASE = 26, Y0 = 260, Y1 = 150, FOOT = 28;

  function floorY(a) {
    if (a <= A1) return Y0 + (Y1 - Y0) * clamp01((a - A0) / (A1 - A0));
    if (a <= A2) return Y1;
    return Y1 + (FOOT - Y1) * clamp01((a - A2) / (A3 - A2));
  }

  function at(along, across, y) {
    return {
      x: CH.x + DIR.x * along + PERP.x * across,
      y: y,
      z: CH.z + DIR.z * along + PERP.z * across
    };
  }

  /* ---- rock ---------------------------------------------------------- */
  function rockGeo(radius, seed, squash) {
    const g = new THREE.IcosahedronGeometry(radius, 1);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = C.hash2(Math.round(v.x * 3.1 + seed), Math.round(v.y * 2.7 + v.z * 3.3 + seed * 1.7));
      v.multiplyScalar(0.68 + n * 0.62);
      if (squash) v.y *= squash;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }

  let ROCKTEX = null, MOSSTEX = null;
  function rockTexture(mossy) {
    if (mossy && MOSSTEX) return MOSSTEX;
    if (!mossy && ROCKTEX) return ROCKTEX;
    const s = 128, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const x = cv.getContext('2d');
    x.fillStyle = mossy ? '#3b4038' : '#4a4b45';
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const g = 40 + Math.random() * 70;
      x.fillStyle = 'rgba(' + (g | 0) + ',' + ((g + 2) | 0) + ',' + ((g - 6) | 0) + ',0.55)';
      x.beginPath();
      x.arc(Math.random() * s, Math.random() * s, 0.6 + Math.random() * 2.4, 0, 6.283);
      x.fill();
    }
    for (let i = 0; i < 14; i++) {
      x.strokeStyle = 'rgba(18,20,18,0.5)';
      x.lineWidth = 0.8 + Math.random();
      x.beginPath();
      let px = Math.random() * s, py = Math.random() * s;
      x.moveTo(px, py);
      for (let k = 0; k < 5; k++) {
        px += (Math.random() - 0.5) * 34;
        py += (Math.random() - 0.5) * 34;
        x.lineTo(px, py);
      }
      x.stroke();
    }
    if (mossy) {
      for (let i = 0; i < 70; i++) {
        const r = 3 + Math.random() * 16;
        const g = x.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, Math.random() > 0.5 ? 'rgba(96,126,58,0.85)' : 'rgba(68,96,44,0.85)');
        g.addColorStop(1, 'rgba(60,88,40,0)');
        x.save();
        x.translate(Math.random() * s, Math.random() * s);
        x.fillStyle = g;
        x.beginPath();
        x.arc(0, 0, r, 0, 6.283);
        x.fill();
        x.restore();
      }
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    if (mossy) MOSSTEX = t; else ROCKTEX = t;
    return t;
  }

  function rockMat(mossy) {
    const tex = rockTexture(mossy);
    return new THREE.MeshStandardMaterial({
      map: tex, bumpMap: tex, bumpScale: 1.4,
      color: mossy ? 0x9aa08c : 0xb2b4ab,
      roughness: 0.97, metalness: 0.02, flatShading: true
    });
  }

  // Cut stone, for the parts that hands made.
  function cutMat(tint) {
    const tex = rockTexture(false);
    return new THREE.MeshStandardMaterial({
      map: tex, bumpMap: tex, bumpScale: 0.9,
      color: tint || 0x8f8f86, roughness: 0.9, metalness: 0.03
    });
  }

  function strip(fromA, toA, half, mat, steps) {
    const pos = [], uv = [], idx = [];
    const n = steps || 36;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = fromA + (toA - fromA) * t;
      const y = floorY(a);
      const l = at(a, half, y), r = at(a, -half, y);
      pos.push(l.x, l.y, l.z, r.x, r.y, r.z);
      uv.push(0, a * 0.02, 1, a * 0.02);
    }
    for (let i = 0; i < n; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  }

  /* ---- the cryo pod, on its broken altar ------------------------------ */
  function buildPod(scene, chamberY, colliders) {
    const g = new THREE.Group();
    const p = at(-176, 0, chamberY);
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = Math.atan2(DIR.x, DIR.z);
    g.scale.setScalar(1.7);

    const metal = new THREE.MeshStandardMaterial({ color: 0x2d343a, roughness: 0.45, metalness: 0.85 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x8fb6c4, roughness: 0.3, metalness: 0.9 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0xbfe9ff, emissive: 0x2f8fc0, emissiveIntensity: 0.55,
      transparent: true, opacity: 0.30, roughness: 0.06, metalness: 0.1,
      side: THREE.DoubleSide
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(48, 54, 22, 14), metal);
    base.position.y = 11;
    g.add(base);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(44, 5, 8, 20), trim);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 24;
    g.add(rim);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, 104, 16, 1, true), glass);
    tube.position.y = 76;
    g.add(tube);
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(6, 106, 10), metal);
      const a = (i / 4) * Math.PI * 2;
      rib.position.set(Math.cos(a) * 40, 76, Math.sin(a) * 40);
      rib.rotation.y = -a;
      g.add(rib);
    }
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(44, 44, 108, 16, 1, true, 0, Math.PI), glass);
    lid.position.set(0, 122, -52);
    lid.rotation.x = -0.62;
    g.add(lid);
    const lidRim = new THREE.Mesh(new THREE.TorusGeometry(44, 4, 6, 18, Math.PI), trim);
    lidRim.position.set(0, 170, -56);
    lidRim.rotation.set(-0.62 + Math.PI / 2, 0, 0);
    g.add(lidRim);
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(17, 17, 74, 12),
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.35 })
    );
    core.position.y = 78;
    g.add(core);
    const lamp = new THREE.PointLight(0x7fd6ff, 1.6, 900, 2);
    lamp.position.y = 96;
    g.add(lamp);

    const frost = new THREE.Mesh(
      new THREE.RingGeometry(56, 150, 26),
      new THREE.MeshStandardMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.2, roughness: 0.4 })
    );
    frost.rotation.x = -Math.PI / 2;
    frost.position.y = 1.5;
    g.add(frost);
    const ice = new THREE.MeshStandardMaterial({ color: 0xcfeeff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.283, r = 60 + Math.random() * 70;
      const s = 6 + Math.random() * 16;
      const sh = new THREE.Mesh(new THREE.ConeGeometry(s * 0.5, s * 2.4, 5), ice);
      sh.position.set(Math.cos(a) * r, s * 1.2, Math.sin(a) * r);
      sh.rotation.set((Math.random() - 0.5) * 0.7, Math.random() * 3, (Math.random() - 0.5) * 0.7);
      g.add(sh);
    }

    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g);
    colliders.push({ x: p.x, z: p.z, r: 76 });
    return g;
  }

  /* ---- the crag, the chamber and the way out -------------------------- */
  C.buildCave = function (scene) {
    BASE = C.height(CH.x, CH.z);
    Y0 = BASE + 300;
    Y1 = BASE + 150;
    FOOT = C.height(CH.x + DIR.x * A3, CH.z + DIR.z * A3) + 2;

    const colliders = [];
    const mossy = rockMat(true);
    const bare = rockMat(false);
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b302e, roughness: 0.98, flatShading: true });
    const cut = cutMat(0x9a9a90);
    const root = new THREE.Group();

    /* ---- the mountain the chamber is cut into ---- */
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + 0.4;
      const r = 420 + (i % 4) * 80;
      const size = 150 + ((i * 37) % 110);
      const m = new THREE.Mesh(rockGeo(size, i + 3), i % 3 === 0 ? bare : mossy);
      m.position.set(CH.x + Math.cos(a) * r, BASE + 60 + ((i * 53) % 300), CH.z + Math.sin(a) * r);
      m.rotation.set((i % 5) * 0.3, a, (i % 3) * 0.24);
      m.scale.y = 1.3 + (i % 3) * 0.4;
      root.add(m);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.9;
      const cap = new THREE.Mesh(rockGeo(200, 91 + i, 0.7), mossy);
      cap.position.set(CH.x + Math.cos(a) * 150, Y0 + 470, CH.z + Math.sin(a) * 150);
      cap.rotation.y = a;
      root.add(cap);
    }

    /* ---- the chamber: a great round room, floored and domed ---- */
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 64), dark);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(CH.x, Y0, CH.z);
    floor.receiveShadow = true;
    root.add(floor);

    // a cut stone apron round the altar, so the floor reads as made by hands
    const apron = new THREE.Mesh(new THREE.RingGeometry(R * 0.42, R * 0.58, 56), cut);
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(CH.x, Y0 + 0.6, CH.z);
    root.add(apron);

    const domeTex = rockTexture(true);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(372, 30, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
      new THREE.MeshStandardMaterial({
        map: domeTex, bumpMap: domeTex, bumpScale: 1.2,
        color: 0x8d9382, roughness: 0.98, side: THREE.DoubleSide, flatShading: true
      })
    );
    dome.position.set(CH.x, Y0 + 40, CH.z);
    dome.scale.set(1.02, 1, 1.02);
    root.add(dome);

    /* ---- a colonnade: ten carved pillars round the room ---- */
    const glyphMat = new THREE.MeshBasicMaterial({ color: 0x8fe6b4, transparent: true, opacity: 0.5 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.31;
      // the processional way runs out through the colonnade: no pillar may be
      // left standing in the doorway
      const ox = Math.cos(a) * 288, oz = Math.sin(a) * 288;
      const alongP = ox * DIR.x + oz * DIR.z;
      const perpP = Math.abs(ox * PERP.x + oz * PERP.z);
      if (alongP > 100 && perpP < 230) continue;
      const px = CH.x + Math.cos(a) * 288;
      const pz = CH.z + Math.sin(a) * 288;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(30, 38, 380, 12), cut);
      col.position.set(px, Y0 + 190, pz);
      col.castShadow = true;
      root.add(col);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(46, 52, 30, 12), cut);
      base.position.set(px, Y0 + 15, pz);
      root.add(base);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(96, 34, 96), cut);
      cap.position.set(px, Y0 + 392, pz);
      root.add(cap);
      // a band of glyph light round each pillar
      for (let k = 0; k < 3; k++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(32, 2.6, 6, 20), glyphMat);
        band.rotation.x = Math.PI / 2;
        band.position.set(px, Y0 + 90 + k * 92, pz);
        root.add(band);
      }
      colliders.push({ x: px, z: pz, r: 52 });
    }

    /* ---- the wall ring, open where the way out leaves ---- */
    const openA = Math.atan2(DIR.x, DIR.z);
    const angleFromOpening = (a) => {
      let d = a - openA;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    };
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      if (Math.abs(angleFromOpening(a)) < 0.42) continue;
      const size = 130 + ((i * 29) % 70);
      const m = new THREE.Mesh(rockGeo(size, 40 + i), i % 2 ? mossy : bare);
      m.position.set(CH.x + Math.sin(a) * 372, Y0 + 70, CH.z + Math.cos(a) * 372);
      m.rotation.y = a;
      m.scale.set(1, 2.6, 1);
      root.add(m);
      colliders.push({ x: CH.x + Math.sin(a) * 384, z: CH.z + Math.cos(a) * 384, r: 60 });
    }

    /* ---- the processional way: a long, lit road out of the mountain ---- */
    const walk = strip(A0 - 20, A3, HALF + 2, dark, 56);
    walk.receiveShadow = true;
    root.add(walk);

    // glyphs inlaid down the centre, all of them pointing at the daylight
    for (let a = A0 + 40; a < A1 - 30; a += 78) {
      const p = at(a, 0, floorY(a) + 1.2);
      const rune = new THREE.Mesh(new THREE.RingGeometry(18, 26, 6, 1), glyphMat);
      rune.rotation.x = -Math.PI / 2;
      rune.position.set(p.x, p.y, p.z);
      root.add(rune);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(9, 8), glyphMat);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(p.x, p.y + 0.2, p.z);
      root.add(dot);
    }

    // ribbed arches and braziers the whole way down
    for (let a = A0 + 60; a <= A1 - 40; a += 140) {
      const y = floorY(a);
      for (const s of [-1, 1]) {
        const p = at(a, s * 178, y);
        const pier = new THREE.Mesh(new THREE.BoxGeometry(96, 300, 96), cut);
        pier.position.set(p.x, y + 140, p.z);
        pier.rotation.y = Math.atan2(DIR.x, DIR.z);
        root.add(pier);
        const capital = new THREE.Mesh(new THREE.BoxGeometry(120, 26, 120), cut);
        capital.position.set(p.x, y + 300, p.z);
        root.add(capital);
        colliders.push({ x: p.x, z: p.z, r: 62 });

        // a brazier on every second pier, so the way is never dark
        if ((a / 140) % 2 < 1.2) {
          const b = new THREE.Group();
          const bowl = new THREE.Mesh(new THREE.CylinderGeometry(26, 16, 26, 10), cut);
          bowl.position.y = 12;
          b.add(bowl);
          const fire = new THREE.Mesh(
            new THREE.SphereGeometry(17, 10, 8),
            new THREE.MeshBasicMaterial({ color: 0xffb45c, transparent: true, opacity: 0.85 })
          );
          fire.position.y = 34;
          b.add(fire);
          const bp = at(a, s * 120, y);
          b.position.set(bp.x, bp.y, bp.z);
          root.add(b);
          if (C.tickers) {
            const ph = Math.random() * 6.28;
            C.tickers.push((t) => {
              fire.scale.setScalar(0.85 + Math.sin(t * 7 + ph) * 0.2);
            });
          }
        }
      }
      // the roof over this stretch
      const cap = new THREE.Mesh(rockGeo(190, 400 + a, 0.45), dark);
      const cp = at(a, 0, y + 330);
      cap.position.set(cp.x, cp.y, cp.z);
      cap.rotation.y = a * 0.03;
      root.add(cap);
    }

    /* ---- the great doorway: the way out, and it could not be clearer ---- */
    const mouthY = floorY(A1);
    for (const s of [-1, 1]) {
      const p = at(A1, s * 190, mouthY);
      const pier = new THREE.Mesh(new THREE.BoxGeometry(120, 420, 130), cut);
      pier.position.set(p.x, mouthY + 200, p.z);
      pier.rotation.y = Math.atan2(DIR.x, DIR.z);
      root.add(pier);
      colliders.push({ x: p.x, z: p.z, r: 76 });
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(520, 70, 150), cut);
    const lp = at(A1, 0, mouthY + 420);
    lintel.position.set(lp.x, lp.y, lp.z);
    lintel.rotation.y = Math.atan2(DIR.x, DIR.z);
    root.add(lintel);

    // the daylight itself, falling through the door in a shaft
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(150, 260, 520, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2cc, transparent: true, opacity: 0.10,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
      })
    );
    const sp = at(A1 - 40, 0, mouthY + 240);
    shaft.position.set(sp.x, sp.y, sp.z);
    root.add(shaft);

    /* ---- the ledge, and the ramp down to the meadow ---- */
    for (let a = A1; a <= A3; a += 74) {
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(rockGeo(70 + ((a * 7) % 34), 900 + a + s), s < 0 ? mossy : bare);
        const p = at(a, s * 196, floorY(a) - 40);
        m.position.set(p.x, p.y, p.z);
        m.scale.set(1, 0.9, 1);
        root.add(m);
        // the ledge itself stays open — you can stand at its lip and look out —
        // but the ramp down is walled, so nobody walks off the side of it
        if (a > A2) {
          const c = at(a, s * 196, floorY(a));
          colliders.push({ x: c.x, z: c.z, r: 56 });
        }
      }
    }
    // two standing stones mark the viewpoint
    for (const s of [-1, 1]) {
      const p = at(A2 - 60, s * 150, floorY(A2 - 60));
      const st = new THREE.Mesh(new THREE.BoxGeometry(24, 150, 34), cut);
      st.position.set(p.x, p.y + 66, p.z);
      st.rotation.y = Math.atan2(DIR.x, DIR.z) + s * 0.12;
      root.add(st);
    }

    /* ---- moss: cushions over the floor and the mountain ---- */
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x5c7f3c, roughness: 1, flatShading: true });
    const mossGeo = new THREE.IcosahedronGeometry(1, 0);
    const spots = [];
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * 6.283;
      const r = 60 + Math.random() * 190;
      spots.push({ p: { x: CH.x + Math.cos(a) * r, y: Y0 + 1, z: CH.z + Math.sin(a) * r }, s: 8 + Math.random() * 22 });
    }
    for (let i = 0; i < 90; i++) {
      const a = A0 + Math.random() * (A3 - A0);
      const p = at(a, (Math.random() - 0.5) * (HALF - 24), floorY(a) + 1);
      spots.push({ p: p, s: 6 + Math.random() * 16 });
    }
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * 6.283, r = 320 + Math.random() * 220;
      spots.push({
        p: { x: CH.x + Math.cos(a) * r, y: BASE + 90 + Math.random() * 320, z: CH.z + Math.sin(a) * r },
        s: 12 + Math.random() * 30
      });
    }
    const moss = new THREE.InstancedMesh(mossGeo, mossMat, spots.length);
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3();
    spots.forEach((it, k) => {
      v4.set(it.p.x, it.p.y, it.p.z);
      s4.set(it.s, it.s * 0.35, it.s);
      m4.compose(v4, q4, s4);
      moss.setMatrixAt(k, m4);
    });
    moss.instanceMatrix.needsUpdate = true;
    moss.frustumCulled = false;
    root.add(moss);

    /* ---- light: the cold lamp over the altar, the sun at the door ---- */
    const glow = new THREE.PointLight(0x8fe6b4, 1.5, 1600, 1.7);
    glow.position.set(CH.x, Y0 + 260, CH.z);
    root.add(glow);
    const lip = new THREE.PointLight(0xffe9c0, 2.0, 1500, 1.6);
    const lpp = at(A1 - 30, 0, mouthY + 200);
    lip.position.set(lpp.x, lpp.y, lpp.z);
    root.add(lip);

    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(root);

    buildPod(scene, Y0, colliders);

    // the grass and the trees keep out of the mountain and off the path down
    C.keepClear.push({ x: CH.x, z: CH.z, r: 620 });
    C.roadClear.push({ x: CH.x, z: CH.z, r: 520 });
    for (let a = A1; a <= A3 + 40; a += 110) {
      const p = at(a, 0, 0);
      C.keepClear.push({ x: p.x, z: p.z, r: 200 });
      C.roadClear.push({ x: p.x, z: p.z, r: 160 });
    }

    const spawnP = at(40, 0, Y0);
    return {
      colliders: colliders,
      spawn: { x: spawnP.x, z: spawnP.z },
      // the walker faces the way out, so the vale is what they see first
      yaw: Math.atan2(-DIR.x, -DIR.z),
      mouth: at(A1, 0, mouthY),
      ledge: at(A2, 0, floorY(A2))
    };
  };

  // The walkable floor inside the mountain. Null means "not in the cave" and
  // the land's own height takes over.
  C.caveFloor = function (x, z) {
    const dx = x - CH.x, dz = z - CH.z;
    if (dx * dx + dz * dz < R * R) return Y0;
    const along = dx * DIR.x + dz * DIR.z;
    if (along < A0 || along > A3) return null;
    const across = Math.abs(dx * PERP.x + dz * PERP.z);
    if (across > HALF) return null;
    return floorY(along);
  };

  C.cave = { at: CH, dir: DIR, chamberY: function () { return Y0; } };
})();
