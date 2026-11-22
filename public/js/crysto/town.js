/* Crysto — the places built by hands: Drane Vale, the three shrines, the
   Weeping Bridge, the waystones and the Sunken Keep.

   Every structure is real carpentry and real masonry: a stone plinth, lime
   plaster walls paneled in oak, a jetty, a shingled gable with a ridge beam and
   a smoking chimney, doors of planks with iron hinges, glazed windows with
   shutters and flower boxes, barrels and woodpiles against the wall. The
   shrines are stepped stone with carved pillars and a burning rune frieze, and
   the keep is coursed ashlar with battlements, buttresses, arrow slits, a
   portcullis and torches. Everything stands on the real ground height. */
(function () {
  const C = (window.Crysto = window.Crysto || {});
  C.keepClear = C.keepClear || [];
  C.tickers = C.tickers || [];

  const rand = (a, b) => a + Math.random() * (b - a);

  function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
  function cyl(rt, rb, h, seg, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); }
  function put(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }
  function solid(m) { m.castShadow = true; m.receiveShadow = true; return m; }

  /* soft radial sprite, used for smoke and flame glow */
  let GLOW = null;
  function glowTex() {
    if (GLOW) return GLOW;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    GLOW = new THREE.CanvasTexture(c);
    return GLOW;
  }

  function smoke(x, y, z, count) {
    const puffs = [];
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(), color: 0xb9b6ae, transparent: true,
        opacity: 0.22 - i * 0.03, depthWrite: false
      }));
      s.scale.setScalar(34 + i * 16);
      s.position.set(x, y + i * 26, z);
      puffs.push(s);
    }
    return {
      add(g) { puffs.forEach((p) => g.add(p)); },
      tick(t) {
        puffs.forEach((p, i) => {
          p.position.y = y + i * 26 + Math.sin(t * 0.6 + i) * 6 + ((t * 9) % 30);
          p.position.x = x + Math.sin(t * 0.4 + i * 1.7) * 8;
          p.material.opacity = Math.max(0, 0.2 - i * 0.028) * (0.7 + 0.3 * Math.sin(t + i));
        });
      }
    };
  }

  function flame(x, y, z, color, scale) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: color, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    s.scale.setScalar(scale || 60);
    s.position.set(x, y, z);
    return {
      sprite: s,
      tick(t) {
        s.scale.setScalar((scale || 60) * (0.86 + 0.18 * Math.sin(t * 7.3 + x)));
        s.material.opacity = 0.72 + 0.24 * Math.sin(t * 9.1 + z);
      }
    };
  }

  /* ---- a house of Drane Vale ------------------------------------------- */
  function house(o) {
    const M = C.materials;
    const g = new THREE.Group();
    const w = o.w, d = o.d, h = o.h, base = 46;
    const wallMat = M.plaster(o.wall, w / 90, h / 90);
    const oakMat = M.timber(0x4a3527, 1, 3);
    const stoneMat = M.stone(0x6d6559, w / 74, 1);

    // stone plinth, a hand's width proud of the wall
    const plinth = solid(box(w + 22, base, d + 22, stoneMat));
    plinth.position.y = base / 2;
    g.add(plinth);

    // the wall itself
    const body = solid(box(w, h, d, wallMat));
    body.position.y = base + h / 2;
    g.add(body);

    // oak frame: corner posts, a mid rail and the top plate
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const p = box(13, h, 13, oakMat);
        p.position.set(sx * (w / 2 - 3), base + h / 2, sz * (d / 2 - 3));
        g.add(p);
      }
    }
    for (const sz of [-1, 1]) {
      const r = box(w + 6, 13, 10, oakMat);
      r.position.set(0, base + h * 0.56, sz * d / 2);
      g.add(r);
      const plate = box(w + 10, 15, 12, oakMat);
      plate.position.set(0, base + h - 8, sz * d / 2);
      g.add(plate);
    }
    for (const sx of [-1, 1]) {
      const r = box(10, 13, d + 6, oakMat);
      r.position.set(sx * w / 2, base + h * 0.56, 0);
      g.add(r);
    }
    // braces either side of the door
    for (const sx of [-1, 1]) {
      const b = box(11, h * 0.46, 9, oakMat);
      b.position.set(sx * w * 0.27, base + h * 0.29, d / 2 + 2);
      b.rotation.z = sx * 0.62;
      g.add(b);
    }

    // the gable roof: two shingled planes, a ridge beam and closed gable ends
    const rise = Math.max(66, w * 0.4);
    const halfSpan = w / 2 + 30;
    const slope = Math.hypot(halfSpan, rise);
    const ang = Math.atan2(rise, halfSpan);
    const roofMat = o.thatch ? M.thatch(2.4, 2) : M.shingle(o.roof, 3, 2);
    for (const sx of [-1, 1]) {
      const plane = solid(box(slope, 15, d * 1.18, roofMat));
      plane.position.set(sx * (halfSpan / 2), base + h + rise / 2, 0);
      plane.rotation.z = -sx * ang;
      g.add(plane);
    }
    const ridge = box(18, 18, d * 1.2, oakMat);
    ridge.position.y = base + h + rise;
    g.add(ridge);

    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(shape, { depth: 10, bevelEnabled: false });
    for (const sz of [-1, 1]) {
      const gable = new THREE.Mesh(gableGeo, wallMat);
      gable.position.set(0, base + h, sz > 0 ? d / 2 - 10 : -d / 2);
      gable.castShadow = true;
      g.add(gable);
    }

    // chimney, standing proud of the ridge with its smoke
    const chimH = h + rise + 60;
    const chimney = solid(box(50, chimH, 50, M.stone(0x6d6559, 1, 2)));
    chimney.position.set(w * 0.3, base + chimH / 2, -d * 0.22);
    g.add(chimney);
    const cap = box(64, 16, 64, M.stone(0x5d574d, 1, 1));
    cap.position.set(w * 0.3, base + chimH + 8, -d * 0.22);
    g.add(cap);
    const sm = smoke(w * 0.3, cap.position.y + 20, -d * 0.22, 5);
    sm.add(g);
    C.tickers.push(sm.tick);

    // door: frame, planks, iron hinges, handle, step and a lantern over it
    const dw = Math.min(64, w * 0.26), dh = 148;
    const doorMat = M.plank(0x5a3f26, 1, 2);
    const frameMat = M.timber(0x3d2c1e, 1, 2);
    const dfL = box(10, dh + 12, 12, frameMat);
    dfL.position.set(-dw / 2 - 5, base + dh / 2, d / 2 + 3);
    g.add(dfL);
    const dfR = dfL.clone();
    dfR.position.x = dw / 2 + 5;
    g.add(dfR);
    const dfT = box(dw + 22, 12, 12, frameMat);
    dfT.position.set(0, base + dh + 6, d / 2 + 3);
    g.add(dfT);
    const door = solid(box(dw, dh, 7, doorMat));
    door.position.set(0, base + dh / 2, d / 2 + 4);
    g.add(door);
    for (const hy of [0.28, 0.74]) {
      const hinge = box(dw * 0.7, 6, 3, new THREE.MeshStandardMaterial({ color: 0x2b2b2f, roughness: 0.55, metalness: 0.7 }));
      hinge.position.set(-dw * 0.12, base + dh * hy, d / 2 + 8);
      g.add(hinge);
    }
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(5, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a6a34, roughness: 0.4, metalness: 0.8 })
    );
    knob.position.set(dw * 0.3, base + dh * 0.5, d / 2 + 9);
    g.add(knob);
    const step = solid(box(dw + 34, 12, 34, M.stone(0x77705f, 1, 1)));
    step.position.set(0, base / 2 - 6, d / 2 + 18);
    g.add(step);

    // a lamp over the door
    const lampPost = box(6, 40, 6, frameMat);
    lampPost.position.set(dw * 0.62, base + dh + 30, d / 2 + 10);
    g.add(lampPost);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(18, 24, 18),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffab48, emissiveIntensity: 1.5, roughness: 0.4 })
    );
    lamp.position.set(dw * 0.62, base + dh + 12, d / 2 + 10);
    g.add(lamp);
    const lampGlow = flame(dw * 0.62, base + dh + 12, d / 2 + 10, 0xffb45c, 54);
    g.add(lampGlow.sprite);
    C.tickers.push(lampGlow.tick);

    // windows: recess, glazing, mullions, sill, open shutters, flower box
    const paneMat = new THREE.MeshStandardMaterial({
      color: 0x2a2418, emissive: 0xffb457, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.1
    });
    const winFrame = M.timber(0x3d2c1e, 1, 1);
    function windowUnit(px, py, pz, ry, size) {
      const u = new THREE.Group();
      const ww = size, wh = size * 1.15;
      const recess = box(ww, wh, 8, new THREE.MeshStandardMaterial({ color: 0x1b150e, roughness: 0.9 }));
      u.add(recess);
      const pane = new THREE.Mesh(new THREE.BoxGeometry(ww - 10, wh - 10, 4), paneMat);
      pane.position.z = 4;
      u.add(pane);
      const barV = box(5, wh - 8, 6, winFrame);
      barV.position.z = 7;
      u.add(barV);
      const barH = box(ww - 8, 5, 6, winFrame);
      barH.position.z = 7;
      u.add(barH);
      const sill = box(ww + 16, 7, 16, winFrame);
      sill.position.set(0, -wh / 2 - 4, 6);
      u.add(sill);
      const lintel = box(ww + 18, 8, 12, winFrame);
      lintel.position.set(0, wh / 2 + 6, 5);
      u.add(lintel);
      for (const sx of [-1, 1]) {
        const sh = box(ww * 0.52, wh, 5, M.plank(0x4a3527, 1, 1));
        sh.position.set(sx * (ww * 0.78), 0, 9);
        sh.rotation.y = sx * -0.55;
        u.add(sh);
      }
      u.position.set(px, py, pz);
      u.rotation.y = ry || 0;
      g.add(u);
      return u;
    }
    windowUnit(-w * 0.29, base + h * 0.66, d / 2 + 2, 0, 46);
    windowUnit(w * 0.29, base + h * 0.66, d / 2 + 2, 0, 46);
    windowUnit(-w * 0.29, base + h * 0.24, d / 2 + 2, 0, 40);
    windowUnit(w / 2 + 2, base + h * 0.62, 0, Math.PI / 2, 42);

    // flowers under the two front windows
    const soil = box(56, 12, 18, M.plank(0x3a2a1c, 1, 1));
    soil.position.set(-w * 0.29, base + h * 0.66 - 34, d / 2 + 12);
    g.add(soil);
    for (let i = 0; i < 6; i++) {
      const bud = new THREE.Mesh(
        new THREE.SphereGeometry(rand(4, 6), 6, 5),
        new THREE.MeshStandardMaterial({ color: [0xd8557a, 0xe8c14a, 0xc45ad0, 0xe0703a][i % 4], roughness: 0.8 })
      );
      bud.position.set(-w * 0.29 - 24 + i * 10, base + h * 0.66 - 26, d / 2 + 14);
      g.add(bud);
    }

    // barrel, crate and a woodpile against the front wall
    function barrel(px, pz) {
      const b = new THREE.Group();
      const bodyM = cyl(21, 24, 54, 12, M.plank(0x6b4a2c, 1, 1));
      bodyM.position.y = 27;
      b.add(solid(bodyM));
      for (const yy of [12, 40]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(22.5, 2.4, 5, 14),
          new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.5, metalness: 0.7 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = yy;
        b.add(ring);
      }
      b.position.set(px, base / 2, pz);
      g.add(b);
    }
    barrel(-w * 0.42, d / 2 + 26);
    barrel(-w * 0.42 + 46, d / 2 + 20);
    const crate = solid(box(44, 44, 44, M.plank(0x7a5a36, 1, 1)));
    crate.position.set(w * 0.42, base / 2 + 22, d / 2 + 26);
    g.add(crate);
    for (const sx of [-1, 1]) {
      const brace = box(46, 5, 5, M.timber(0x3d2c1e, 1, 1));
      brace.position.set(w * 0.42, base / 2 + 22 + sx * 14, d / 2 + 49);
      brace.rotation.z = sx * 0.6;
      g.add(brace);
    }
    const logMat = M.timber(0x6a4a2a, 1, 1);
    for (let i = 0; i < 7; i++) {
      const log = cyl(8, 8, 52, 7, logMat);
      log.rotation.z = Math.PI / 2;
      log.position.set(w * 0.42 - 10 + (i % 2) * 16, base / 2 + 9 + Math.floor(i / 3) * 16, d / 2 + 58);
      g.add(log);
    }

    // ivy climbing the back corner
    const ivyMat = new THREE.MeshStandardMaterial({ color: 0x2f5c33, roughness: 0.9 });
    for (let i = 0; i < 9; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(rand(9, 16), 6, 5), ivyMat);
      leaf.position.set(-w / 2 + rand(-4, 20), base + rand(6, h * 0.8), -d / 2 + rand(-2, 22));
      leaf.scale.y = 0.6;
      g.add(leaf);
    }

    return g;
  }

  /* ---- the well at the heart of the vale -------------------------------- */
  function well(x, z) {
    const M = C.materials;
    const g = new THREE.Group();
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(150, 150, 4, 22), M.cobble(3, 3));
    yard.position.y = 2;
    yard.receiveShadow = true;
    g.add(yard);

    const drum = solid(cyl(60, 66, 62, 16, M.stone(0x8b8578, 2, 1)));
    drum.position.y = 33;
    g.add(drum);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(60, 7, 6, 18), M.stone(0x9d968a, 1, 1));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 64;
    g.add(rim);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(52, 18),
      new THREE.MeshStandardMaterial({ color: 0x14384a, roughness: 0.15, metalness: 0.5 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 48;
    g.add(water);

    const oakMat = M.timber(0x4a3527, 1, 2);
    for (const sx of [-1, 1]) {
      const post = box(11, 130, 11, oakMat);
      post.position.set(sx * 52, 96, 0);
      g.add(post);
    }
    const beam = box(130, 12, 12, oakMat);
    beam.position.y = 158;
    g.add(beam);
    // bucket on a rope
    const rope = box(2.4, 78, 2.4, new THREE.MeshStandardMaterial({ color: 0x8a7a55, roughness: 0.9 }));
    rope.position.y = 116;
    g.add(rope);
    const bucket = cyl(13, 10, 20, 10, M.plank(0x6b4a2c, 1, 1));
    bucket.position.y = 72;
    g.add(bucket);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(88, 54, 4), M.shingle(0x7a4a2e, 2, 2));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 196;
    roof.castShadow = true;
    g.add(roof);

    g.position.set(x, C.height(x, z), z);
    return g;
  }

  /* ---- the gate at the south road --------------------------------------- */
  function gate(x, z, rotY) {
    const M = C.materials;
    const g = new THREE.Group();
    const stoneMat = M.stone(0x8d8577, 1.4, 2.6);
    for (const sx of [-1, 1]) {
      const pier = solid(box(58, 210, 58, stoneMat));
      pier.position.set(sx * 140, 105, 0);
      g.add(pier);
      // quoins: alternating proud blocks up the pier
      for (let i = 0; i < 7; i++) {
        const q = box(66, 20, 62, M.stone(0x9a9384, 1, 1));
        q.position.set(sx * 140, 18 + i * 29, 0);
        q.scale.x = i % 2 ? 1 : 0.92;
        g.add(q);
      }
      const cap = solid(box(74, 20, 74, M.stone(0x7d7568, 1, 1)));
      cap.position.set(sx * 140, 218, 0);
      g.add(cap);
      // a lantern hanging from each pier
      const lantern = new THREE.Mesh(
        new THREE.BoxGeometry(24, 30, 24),
        new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffab48, emissiveIntensity: 1.6, roughness: 0.4 })
      );
      lantern.position.set(sx * 140, 176, 40);
      g.add(lantern);
      const gl = flame(sx * 140, 176, 40, 0xffb45c, 62);
      g.add(gl.sprite);
      C.tickers.push(gl.tick);
    }
    const lintel = solid(box(348, 42, 64, M.timber(0x4a3527, 4, 1)));
    lintel.position.y = 232;
    g.add(lintel);
    const beam2 = box(348, 16, 46, M.timber(0x3d2c1e, 4, 1));
    beam2.position.y = 258;
    g.add(beam2);

    // banners either side of the arch
    for (const sx of [-1, 1]) {
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(84, 150, 1, 6), M.cloth(0x1f5f8c, 1, 1));
      cloth.position.set(sx * 70, 150, 36);
      g.add(cloth);
      C.tickers.push((t) => { cloth.rotation.y = Math.sin(t * 1.3 + sx) * 0.08; });
    }

    // open plank doors, swung back against the piers
    for (const sx of [-1, 1]) {
      const leaf = box(96, 150, 7, M.plank(0x5a3f26, 2, 2));
      leaf.position.set(sx * 190, 78, 44);
      leaf.rotation.y = sx * 0.9;
      g.add(leaf);
    }

    g.position.set(x, C.height(x, z), z);
    g.rotation.y = rotY || 0;
    return g;
  }

  /* ---- a shrine: steps, carved pillars, a rune frieze, a waking orb ----- */
  function shrine(def) {
    const M = C.materials;
    const g = new THREE.Group();
    const stoneMat = M.stone(0x9a9488, 3, 1);
    const carveMat = M.stone(0x8b8679, 1, 2);

    // three worn steps up to the platform
    for (let i = 0; i < 3; i++) {
      const r = 258 - i * 18;
      const step = solid(cyl(r, r + 8, 16, 22, stoneMat));
      step.position.y = 8 + i * 16;
      g.add(step);
    }
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(196, 196, 10, 22), M.cobble(4, 4));
    floor.position.y = 58;
    floor.receiveShadow = true;
    g.add(floor);

    // six pillars: base, shaft and capital
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * 178, pz = Math.sin(a) * 178;
      const baseB = solid(box(52, 26, 52, carveMat));
      baseB.position.set(px, 74, pz);
      baseB.rotation.y = -a;
      g.add(baseB);
      const shaft = solid(box(38, 190, 38, M.stone(0x8b8679, 1, 3)));
      shaft.position.set(px, 182, pz);
      shaft.rotation.y = -a;
      g.add(shaft);
      // fluting
      for (const off of [-11, 11]) {
        const flute = box(6, 186, 4, M.stone(0x7e796d, 1, 3));
        flute.position.set(px + Math.cos(a) * off, 182, pz + Math.sin(a) * off);
        flute.rotation.y = -a;
        g.add(flute);
      }
      const cap = solid(box(56, 24, 56, carveMat));
      cap.position.set(px, 289, pz);
      cap.rotation.y = -a;
      g.add(cap);
      // a brazen bowl at every other pillar
      if (i % 2 === 0) {
        const bowl = cyl(26, 18, 22, 10, new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.5, metalness: 0.6 }));
        bowl.position.set(px, 80, pz);
        g.add(bowl);
        const fl = flame(px, 96, pz, def.color, 58);
        g.add(fl.sprite);
        C.tickers.push(fl.tick);
      }
    }

    // the entablature and the burning frieze between the capitals
    const ring = new THREE.Mesh(new THREE.TorusGeometry(196, 15, 6, 24), carveMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 306;
    ring.castShadow = true;
    g.add(ring);

    const frieze = new THREE.Mesh(
      new THREE.CylinderGeometry(186, 186, 40, 6, 1, true),
      C.materials.rune(def.color)
    );
    frieze.position.y = 252;
    g.add(frieze);

    // the altar the orb hangs over
    const altar = solid(cyl(54, 70, 46, 8, carveMat));
    altar.position.y = 84;
    g.add(altar);

    const orbMat = new THREE.MeshStandardMaterial({
      color: def.color, emissive: def.color, emissiveIntensity: 0.1, roughness: 0.22, metalness: 0.15
    });
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(44, 1), orbMat);
    orb.position.y = 250;
    g.add(orb);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: def.color, transparent: true, opacity: 0.16,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    halo.scale.setScalar(190);
    halo.position.y = 250;
    g.add(halo);

    const runeMat = new THREE.MeshStandardMaterial({
      color: def.color, emissive: def.color, emissiveIntensity: 0.45, roughness: 0.4
    });
    const rune = new THREE.Mesh(new THREE.TorusGeometry(92, 5, 6, 40), runeMat);
    rune.rotation.x = Math.PI / 2;
    rune.position.y = 250;
    g.add(rune);

    C.tickers.push((t) => {
      orb.rotation.y = t * 0.35;
      orb.position.y = 250 + Math.sin(t * 0.9) * 6;
      halo.position.y = orb.position.y;
      rune.rotation.z = t * 0.4;
      rune.scale.setScalar(1 + Math.sin(t * 1.4) * 0.04);
    });

    g.position.set(def.x, C.height(def.x, def.z), def.z);
    return { group: g, orb: orb, rune: rune, def: def, halo: halo };
  }

  /* ---- a waystone: a standing stone carved with burning runes ---------- */
  function waystone(x, z) {
    const M = C.materials;
    const g = new THREE.Group();
    const baseRing = solid(cyl(46, 54, 18, 7, M.stone(0x77716a, 1, 1)));
    baseRing.position.y = 9;
    g.add(baseRing);

    const stone = solid(cyl(24, 44, 210, 5, M.stone(0x8a877e, 1, 3)));
    stone.position.y = 105;
    stone.rotation.y = 0.4;
    g.add(stone);

    const band = new THREE.Mesh(new THREE.CylinderGeometry(30, 34, 120, 5, 1, true), C.materials.rune(0x6fd0ff));
    band.position.y = 130;
    band.rotation.y = 0.4;
    g.add(band);

    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x9fd8ff, emissive: 0x4fa8ff, emissiveIntensity: 0.12, roughness: 0.3
    });
    const glow = new THREE.Mesh(new THREE.OctahedronGeometry(20, 0), glowMat);
    glow.position.y = 250;
    g.add(glow);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: 0x9fd8ff, transparent: true, opacity: 0.1,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    halo.scale.setScalar(120);
    halo.position.y = 250;
    g.add(halo);

    C.tickers.push((t) => {
      glow.rotation.y = t * 0.8;
      glow.position.y = 250 + Math.sin(t * 1.1) * 7;
      halo.position.y = glow.position.y;
      halo.material.opacity = 0.08 + glowMat.emissiveIntensity * 0.05;
    });

    g.position.set(x, C.height(x, z), z);
    return { group: g, glow: glow, halo: halo };
  }

  /* ---- the Weeping Bridge: an arched span with balusters and lamps ------ */
  function bridge(x, z) {
    const M = C.materials;
    const g = new THREE.Group();
    const span = 2200, seg = 16;
    const stoneMat = M.stone(0x8d8577, 1, 1);
    const deckMat = M.plank(0x6a4a2c, 4, 1);

    for (let i = 0; i < seg; i++) {
      const t = i / (seg - 1);
      const px = -span / 2 + t * span;
      const py = 66 + Math.sin(t * Math.PI) * 110;
      const tilt = Math.cos(t * Math.PI) * 0.16;
      const deck = solid(box(span / seg + 10, 20, 214, deckMat));
      deck.position.set(px, py, 0);
      deck.rotation.z = tilt;
      g.add(deck);
      const skirt = box(span / seg + 6, 46, 190, stoneMat);
      skirt.position.set(px, py - 32, 0);
      skirt.rotation.z = tilt;
      g.add(skirt);
      // balusters down both sides
      for (const sz of [-1, 1]) {
        const post = box(12, 62, 12, M.stone(0x7d7568, 1, 1));
        post.position.set(px, py + 40, sz * 100);
        g.add(post);
        if (i % 2 === 0) {
          const lamp = new THREE.Mesh(
            new THREE.BoxGeometry(16, 22, 16),
            new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffab48, emissiveIntensity: 1.3, roughness: 0.4 })
          );
          lamp.position.set(px, py + 88, sz * 100);
          g.add(lamp);
        }
      }
    }
    // the arch under the span
    for (const sx of [-1, 1]) {
      const pier = solid(box(130, 300, 190, M.stone(0x767065, 2, 2)));
      pier.position.set(sx * 620, -90, 0);
      g.add(pier);
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(430, 46, 8, 26, Math.PI), stoneMat);
    arch.position.y = 120;
    arch.castShadow = true;
    g.add(arch);
    for (const sz of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.TorusGeometry(430, 40, 8, 26, Math.PI), stoneMat);
      side.position.set(0, 120, sz * 92);
      g.add(side);
    }

    g.position.set(x, 0, z);
    return g;
  }

  /* ---- the Sunken Keep -------------------------------------------------- */
  function keep(x, z) {
    const M = C.materials;
    const g = new THREE.Group();
    const wallH = 280, half = 720;
    const wallMat = M.stone(0x6f6a60, 5, 1.6);
    const trimMat = M.stone(0x847e72, 1, 1);

    function curtain(w, d, px, pz) {
      const wm = solid(box(w, wallH, d, wallMat));
      wm.position.set(px, wallH / 2, pz);
      g.add(wm);
      // battlements along the top
      const along = Math.max(w, d), horiz = w > d;
      const n = Math.floor(along / 130);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        const m = box(horiz ? 66 : 110, 66, horiz ? 110 : 66, trimMat);
        m.position.set(px + (horiz ? t * w : 0), wallH + 30, pz + (horiz ? 0 : t * d));
        g.add(m);
      }
      // string course and buttresses
      const course = box(w + 18, 16, d + 18, trimMat);
      course.position.set(px, wallH - 40, pz);
      g.add(course);
      const bn = Math.floor(along / 240);
      for (let i = 0; i < bn; i++) {
        const t = (i + 0.5) / bn - 0.5;
        const b = box(horiz ? 70 : 120, wallH * 0.78, horiz ? 120 : 70, wallMat);
        b.position.set(px + (horiz ? t * w : 0), wallH * 0.39, pz + (horiz ? 0 : t * d));
        b.castShadow = true;
        g.add(b);
      }
    }

    curtain(90, half * 2, -half, 0);
    curtain(90, half * 2, half, 0);
    curtain(half * 2, 90, 0, -half);
    for (const sx of [-1, 1]) curtain(half - 200, 90, sx * (half / 2 + 100), half);

    // arrow slits down the north wall
    for (let i = -2; i <= 2; i++) {
      const slit = box(16, 90, 12, new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 1 }));
      slit.position.set(i * 240, wallH * 0.62, -half + 48);
      g.add(slit);
    }

    // corner towers with battlement rings
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const tower = solid(cyl(150, 172, 560, 12, wallMat));
        tower.position.set(sx * half, 280, sz * half);
        g.add(tower);
        const corbel = solid(cyl(186, 168, 40, 12, trimMat));
        corbel.position.set(sx * half, 570, sz * half);
        g.add(corbel);
        const cap = solid(new THREE.Mesh(
          new THREE.ConeGeometry(206, 200, 12),
          M.shingle(0x4a3f52, 3, 2)
        ));
        cap.position.set(sx * half, 690, sz * half);
        g.add(cap);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const m = box(50, 60, 50, trimMat);
          m.position.set(sx * half + Math.cos(a) * 176, 604, sz * half + Math.sin(a) * 176);
          m.rotation.y = -a;
          g.add(m);
        }
      }
    }

    // the gatehouse: two towers, an arch and a raised portcullis
    for (const sx of [-1, 1]) {
      const t = solid(box(190, 420, 190, wallMat));
      t.position.set(sx * 250, 210, half);
      g.add(t);
      const tc = solid(new THREE.Mesh(new THREE.ConeGeometry(150, 170, 4), M.shingle(0x4a3f52, 2, 2)));
      tc.rotation.y = Math.PI / 4;
      tc.position.set(sx * 250, 505, half);
      g.add(tc);
      // torch at the gate
      const post = box(14, 110, 14, M.timber(0x4a3527, 1, 1));
      post.position.set(sx * 160, 55, half + 110);
      g.add(post);
      const fl = flame(sx * 160, 130, half + 110, 0xff9a3c, 74);
      g.add(fl.sprite);
      C.tickers.push(fl.tick);
    }
    const archTop = solid(box(330, 70, 190, trimMat));
    archTop.position.set(0, 420, half);
    g.add(archTop);
    for (let i = 0; i < 6; i++) {
      const bar = box(10, 260, 10, new THREE.MeshStandardMaterial({ color: 0x33343a, roughness: 0.5, metalness: 0.7 }));
      bar.position.set(-125 + i * 50, 300, half + 96);
      g.add(bar);
    }

    // banners on the gatehouse
    for (const sx of [-1, 1]) {
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(90, 200, 1, 6), M.cloth(0x6a2130, 1, 1));
      cloth.position.set(sx * 250, 250, half + 96);
      g.add(cloth);
      C.tickers.push((t) => { cloth.rotation.y = Math.sin(t * 1.1 + sx * 2) * 0.07; });
    }

    // the broken inner hall
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const col = solid(box(74, 330, 74, M.stone(0x847e72, 1, 3)));
        col.position.set(sx * 330, 165, -260 + sz * 190);
        g.add(col);
        const cap = box(96, 26, 96, trimMat);
        cap.position.set(sx * 330, 340, -260 + sz * 190);
        g.add(cap);
      }
    }
    const lintel = solid(box(760, 58, 90, M.stone(0x847e72, 3, 1)));
    lintel.position.set(0, 366, -260);
    g.add(lintel);
    // rubble
    for (let i = 0; i < 22; i++) {
      const r = new THREE.Mesh(
        new THREE.DodecahedronGeometry(rand(14, 40), 0),
        M.stone(0x7a746a, 1, 1)
      );
      r.position.set(rand(-620, 620), rand(6, 22), rand(-620, 560));
      r.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      g.add(r);
    }

    // the dais and the Sunstone on its carved pedestal
    for (let i = 0; i < 3; i++) {
      const step = solid(cyl(230 - i * 34, 240 - i * 34, 20, 16, M.stone(0x8b8579, 2, 1)));
      step.position.y = 10 + i * 20;
      g.add(step);
    }
    const pedestal = solid(cyl(56, 76, 90, 8, M.stone(0x9a9488, 1, 2)));
    pedestal.position.y = 105;
    g.add(pedestal);

    const sunMat = new THREE.MeshStandardMaterial({
      color: 0x6b6250, emissive: 0xffc457, emissiveIntensity: 0.06, roughness: 0.2, metalness: 0.2
    });
    const sun = new THREE.Mesh(new THREE.IcosahedronGeometry(64, 1), sunMat);
    sun.position.y = 232;
    g.add(sun);
    const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color: 0xffc457, transparent: true, opacity: 0.08,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    sunHalo.scale.setScalar(260);
    sunHalo.position.y = 232;
    g.add(sunHalo);
    const cage = new THREE.Mesh(
      new THREE.TorusGeometry(96, 7, 6, 30),
      new THREE.MeshStandardMaterial({ color: 0x4a4034, roughness: 0.6, metalness: 0.5 })
    );
    cage.rotation.x = Math.PI / 2;
    cage.position.y = 232;
    g.add(cage);

    C.tickers.push((t) => {
      sun.rotation.y = t * 0.16;
      sun.position.y = 232 + Math.sin(t * 0.7) * 7;
      sunHalo.position.y = sun.position.y;
      sunHalo.material.opacity = 0.06 + sunMat.emissiveIntensity * 0.12;
      cage.rotation.z = t * 0.2;
    });

    g.position.set(x, C.height(x, z), z);
    return { group: g, sun: sun, sunMat: sunMat, halo: sunHalo };
  }

  /* ---- the roads: cobbles laid as a ribbon that follows the ground ------ */
  function road(points, width) {
    const pos = [], uv = [], idx = [];
    let run = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
      let dx = b.x - a.x, dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      const nx = -dz, nz = dx;
      const hw = width / 2;
      const lx = p.x - nx * hw, lz = p.z - nz * hw;
      const rx2 = p.x + nx * hw, rz2 = p.z + nz * hw;
      if (i > 0) run += Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z);
      pos.push(lx, C.height(lx, lz) + 3, lz, rx2, C.height(rx2, rz2) + 3, rz2);
      uv.push(0, run / 70, 1, run / 70);
      if (i < points.length - 1) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, C.materials.cobble(width / 70, 1));
    m.receiveShadow = true;
    return m;
  }

  function ringRoad(radius, width, steps) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      pts.push({ x: Math.cos(a) * radius, z: Math.sin(a) * radius });
    }
    return road(pts, width);
  }

  function fence(len) {
    const g = new THREE.Group();
    const oak = C.materials.timber(0x5a4230, 1, 1);
    const posts = Math.max(2, Math.round(len / 46));
    for (let i = 0; i <= posts; i++) {
      const p = box(9, 74, 9, oak);
      p.position.set(-len / 2 + (len * i) / posts, 37, 0);
      g.add(solid(p));
    }
    for (const y of [28, 56]) {
      const rail = box(len, 7, 5, oak);
      rail.position.y = y;
      g.add(solid(rail));
    }
    return g;
  }

  // A kitchen garden: dug beds with something growing in them.
  function garden(w, d) {
    const g = new THREE.Group();
    const soil = box(w, 12, d, C.materials.stone(0x6a563c, 2, 2));
    soil.position.y = 6;
    soil.receiveShadow = true;
    g.add(soil);
    const rows = Math.max(2, Math.round(d / 58));
    const veg = [0x5f8a3a, 0x7fa04a, 0x9a7a3a, 0x4f7a34];
    for (let r = 0; r < rows; r++) {
      const z = -d / 2 + (r + 0.5) * (d / rows);
      const ridge = box(w - 26, 14, 30, C.materials.stone(0x7a6242, 2, 0.5));
      ridge.position.set(0, 12, z);
      g.add(ridge);
      const n = Math.max(2, Math.floor((w - 40) / 44));
      for (let k = 0; k < n; k++) {
        const c = new THREE.Mesh(
          new THREE.SphereGeometry(12, 7, 6),
          new THREE.MeshStandardMaterial({ color: veg[(r + k) % 4], roughness: 0.92, flatShading: true })
        );
        c.position.set(-w / 2 + 24 + k * ((w - 44) / Math.max(1, n - 1)), 22, z);
        g.add(c);
      }
    }
    return g;
  }

  function haystack() {
    const g = new THREE.Group();
    const bale = new THREE.Mesh(new THREE.CylinderGeometry(44, 50, 96, 12), C.materials.thatch(2, 2));
    bale.position.y = 48;
    bale.castShadow = true;
    g.add(bale);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(46, 12, 8, 0, 6.283, 0, 1.35),
      C.materials.thatch(2, 2)
    );
    cap.position.y = 92;
    cap.castShadow = true;
    g.add(cap);
    return g;
  }

  function cart() {
    const g = new THREE.Group();
    const oak = C.materials.timber(0x4a3527, 1, 1);
    const bed = box(130, 12, 74, C.materials.plank(0x6b4a2c, 2, 1));
    bed.position.y = 56;
    g.add(solid(bed));
    for (const sz of [-1, 1]) {
      const side = box(130, 34, 6, C.materials.plank(0x6b4a2c, 2, 1));
      side.position.set(0, 72, sz * 34);
      g.add(solid(side));
      for (const sx of [-1, 1]) {
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(28, 7, 6, 14), oak);
        wheel.rotation.y = Math.PI / 2;
        wheel.position.set(sx * 52, 32, sz * 40);
        g.add(wheel);
      }
    }
    const shaft = box(120, 9, 9, oak);
    shaft.position.set(-118, 48, 0);
    g.add(shaft);
    return g;
  }

  // The pod they came down in: a landed capsule, its hatch blown open.
  function pod(x, z, rotY) {
    const g = new THREE.Group();
    const hullMat = C.materials.stone(0x707781, 2, 3);
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(78, 90, 220, 18), hullMat);
    hull.position.y = 116;
    g.add(solid(hull));
    const nose = new THREE.Mesh(new THREE.SphereGeometry(78, 18, 12, 0, 6.283, 0, 1.5), hullMat);
    nose.position.y = 226;
    g.add(solid(nose));
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(96, 116, 34, 18), C.materials.stone(0x4a5058, 2, 1));
    skirt.position.y = 17;
    g.add(solid(skirt));
    // the hatch, thrown back
    const hatch = new THREE.Mesh(new THREE.CircleGeometry(58, 20), C.materials.stone(0x2e343b, 2, 2));
    hatch.position.set(0, 128, 79);
    g.add(hatch);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(60, 7, 8, 22), C.materials.stone(0x8d95a0, 2, 1));
    rim.position.set(0, 128, 78);
    g.add(rim);
    const door = box(96, 108, 10, C.materials.stone(0x5b626b, 2, 2));
    door.position.set(112, 128, 52);
    door.rotation.y = -1.1;
    g.add(solid(door));
    for (const sx of [-1, 1]) {
      const leg = box(14, 70, 14, C.materials.timber(0x3f4650, 1, 1));
      leg.position.set(sx * 96, 34, 40);
      leg.rotation.z = sx * 0.22;
      g.add(solid(leg));
    }
    g.position.set(x, C.height(x, z), z);
    g.rotation.y = rotY || 0;
    return g;
  }

  /* The vale's own builders, lent to the land beyond the water: the Reach is
     built from the same parts, so a town over there is as solid as this one. */
  C.build = {
    house, well, gate, road, ringRoad, fence, garden, haystack, cart, pod,
    smoke, flame, box, cyl, put, solid
  };

  C.buildTown = function (scene) {
    const root = new THREE.Group();
    scene.add(root);
    const colliders = [];

    const places = (C.places = {
      village: { x: 0, z: 0 },
      shrines: [
        { id: 'root', name: 'Shrine of Root', x: -6200, z: 2600, color: 0x7dffa3 },
        { id: 'ember', name: 'Shrine of Ember', x: 6400, z: -4200, color: 0xff9a5c },
        { id: 'tide', name: 'Shrine of Tide', x: -3200, z: 9800, color: 0x6fd0ff }
      ],
      bridge: { x: C.riverX(-2600), z: -2600 },
      keep: { x: 6000, z: -6000 }
    });

    // ---- Drane Vale ----
    const village = new THREE.Group();
    root.add(village);
    C.keepClear.push({ x: 0, z: 0, r: 2000 });

    // The plan of the vale: one wide ring road round the green, six lanes in to
    // the well, the south road out under the gate and the east road away toward
    // the river. Houses stand well back from every lane, each with its own yard,
    // so a cart can always pass between any two of them.
    const RING_R = 820, ROAD_W = 190, HOUSE_N = 12;
    village.add(ringRoad(RING_R, ROAD_W, 96));

    const spokeAngles = [0.52, 1.57, 2.62, 3.67, 4.71, 5.76];
    spokeAngles.forEach((a) => {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const r = 150 + (RING_R - 150) * (i / 10);
        pts.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
      }
      village.add(road(pts, 150));
      for (let i = 1; i <= 7; i++) {
        C.keepClear.push({ x: Math.cos(a) * (150 + i * 96), z: Math.sin(a) * (150 + i * 96), r: 118 });
      }
    });

    // the south road, out under the gate
    const southRoad = [];
    for (let i = 0; i <= 16; i++) southRoad.push({ x: 0, z: 760 + i * 74 });
    village.add(road(southRoad, 176));
    // the east road, away toward the river and the shrines
    const eastRoad = [];
    for (let i = 0; i <= 18; i++) eastRoad.push({ x: 760 + i * 150, z: -60 - i * 26 });
    village.add(road(eastRoad, 160));

    // nothing grows on the roads
    C.roadClear = C.roadClear || [];
    for (let i = 0; i <= 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      C.keepClear.push({ x: Math.cos(a) * RING_R, z: Math.sin(a) * RING_R, r: 150 });
      C.roadClear.push({ x: Math.cos(a) * RING_R, z: Math.sin(a) * RING_R, r: 128 });
    }
    for (let i = 0; i <= 16; i++) {
      C.keepClear.push({ x: 0, z: 760 + i * 88, r: 128 });
      C.roadClear.push({ x: 0, z: 760 + i * 88, r: 108 });
    }
    for (let i = 0; i <= 16; i++) {
      C.keepClear.push({ x: 760 + i * 190, z: -60 - i * 32, r: 122 });
      C.roadClear.push({ x: 760 + i * 190, z: -60 - i * 32, r: 102 });
    }
    for (const a of spokeAngles) {
      for (let i = 1; i <= 7; i++) {
        C.roadClear.push({ x: Math.cos(a) * (150 + i * 96), z: Math.sin(a) * (150 + i * 96), r: 92 });
      }
    }

    const walls = [0xe4d7bb, 0xdccdb0, 0xe9dcc4, 0xd8c8a8];
    const roofs = [0x8c3f2c, 0x7a4a2e, 0x6b3a34, 0x5d5a52];
    const sizes = [
      { w: 236, d: 210, h: 205, thatch: true },
      { w: 210, d: 230, h: 218 },
      { w: 250, d: 200, h: 232, thatch: true },
      { w: 220, d: 226, h: 196 },
      { w: 244, d: 212, h: 224 },
      { w: 208, d: 236, h: 210, thatch: true },
      { w: 232, d: 214, h: 236 },
      { w: 216, d: 224, h: 200 },
      { w: 240, d: 208, h: 214, thatch: true }
    ];

    for (let i = 0; i < HOUSE_N; i++) {
      const a = (i / HOUSE_N) * Math.PI * 2 + 0.16;
      const s = sizes[i % sizes.length];
      const r = RING_R + ROAD_W / 2 + 90 + s.d / 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const g = house({
        w: s.w, d: s.d, h: s.h, thatch: s.thatch,
        roof: roofs[i % roofs.length], wall: walls[i % walls.length]
      });
      g.position.set(x, C.height(x, z), z);
      g.rotation.y = Math.atan2(-x, -z);
      village.add(g);
      colliders.push({ x: x, z: z, r: Math.max(s.w, s.d) * 0.5 });
      C.roadClear.push({ x: x, z: z, r: Math.max(s.w, s.d) * 0.62 });

      // Behind every house: a fenced kitchen garden, so the village feeds itself.
      const gr = r + s.d / 2 + 210;
      const gx = Math.cos(a) * gr, gz = Math.sin(a) * gr;
      const plot = new THREE.Group();
      plot.add(garden(220, 165));
      const back = fence(258);
      back.position.set(0, 0, -96);
      plot.add(back);
      for (const sx of [-1, 1]) {
        const side = fence(175);
        side.rotation.y = Math.PI / 2;
        side.position.set(sx * 128, 0, 0);
        plot.add(side);
      }
      plot.position.set(gx, C.height(gx, gz), gz);
      plot.rotation.y = Math.atan2(-gx, -gz);
      village.add(plot);
      colliders.push({ x: gx, z: gz, r: 104 });
      C.roadClear.push({ x: gx, z: gz, r: 128 });
    }

    village.add(well(0, 0));
    colliders.push({ x: 0, z: 0, r: 86 });
    village.add(gate(0, 1500, Math.PI));
    colliders.push({ x: -140, z: 1500, r: 44 }, { x: 140, z: 1500, r: 44 });

    // The pod they came down in, out in the meadow east of the ring.
    village.add(pod(1450, 380, -2.35));
    colliders.push({ x: 1450, z: 380, r: 108 });

    // Hay and carts, set out round the green where a village keeps them.
    const onGreen = (r, a) => ({ x: Math.cos(a) * r, z: Math.sin(a) * r });
    [[1.83, 480], [3.93, 480], [5.5, 500]].forEach((h) => {
      const p = onGreen(h[1], h[0]);
      const st = haystack();
      st.position.set(p.x, C.height(p.x, p.z), p.z);
      st.rotation.y = h[0];
      village.add(st);
      colliders.push({ x: p.x, z: p.z, r: 48 });
    });
    [[2.36, 540], [4.45, 540]].forEach((c) => {
      const p = onGreen(c[1], c[0]);
      const k = cart();
      k.position.set(p.x, C.height(p.x, p.z), p.z);
      k.rotation.y = -c[0] + Math.PI;
      village.add(k);
      colliders.push({ x: p.x, z: p.z, r: 62 });
    });

    // lantern posts down the lanes
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + 0.26;
      const lx = Math.cos(a) * 718, lz = Math.sin(a) * 718;
      const post = new THREE.Group();
      const shaft = box(9, 150, 9, C.materials.timber(0x4a3527, 1, 2));
      shaft.position.y = 75;
      post.add(solid(shaft));
      const arm = box(38, 8, 8, C.materials.timber(0x4a3527, 1, 1));
      arm.position.set(16, 146, 0);
      post.add(arm);
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(24, 30, 24),
        new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffab48, emissiveIntensity: 1.5, roughness: 0.4 })
      );
      lamp.position.set(32, 126, 0);
      post.add(lamp);
      const fl = flame(32, 126, 0, 0xffb45c, 62);
      post.add(fl.sprite);
      C.tickers.push(fl.tick);
      post.position.set(lx, C.height(lx, lz), lz);
      post.rotation.y = -a;
      village.add(post);
    }

    // market stalls with striped awnings and goods, set wide on the green
    for (let i = 0; i < 5; i++) {
      // set between the lanes, never on one
      const a = 1.05 + i * 1.05;
      const x = Math.cos(a) * 430, z = Math.sin(a) * 430;
      const stall = new THREE.Group();
      const oak = C.materials.timber(0x4a3527, 1, 1);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const post = box(9, 116, 9, oak);
          post.position.set(sx * 50, 58, sz * 36);
          stall.add(post);
        }
      }
      const table = box(110, 12, 74, C.materials.plank(0x6b4a2c, 2, 1));
      table.position.y = 70;
      stall.add(solid(table));
      const awning = box(126, 8, 92, C.materials.cloth(i % 2 ? 0x8a3a34 : 0x2f5f6c, 2, 1));
      awning.position.y = 118;
      awning.rotation.x = -0.12;
      stall.add(awning);
      for (let k = 0; k < 5; k++) {
        const good = new THREE.Mesh(
          new THREE.SphereGeometry(rand(6, 10), 7, 6),
          new THREE.MeshStandardMaterial({ color: [0xc4552f, 0xd9a53a, 0x5f8a3a, 0x8a3a5a][k % 4], roughness: 0.8 })
        );
        good.position.set(-40 + k * 20, 82, rand(-18, 18));
        stall.add(good);
      }
      stall.position.set(x, C.height(x, z), z);
      stall.rotation.y = -a + Math.PI;
      village.add(stall);
      colliders.push({ x: x, z: z, r: 52 });
    }

    // ---- the vale's own people, walking its roads ----
    const paths = [];
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      paths.push({ x: Math.cos(a) * RING_R, z: Math.sin(a) * RING_R });
    }
    spokeAngles.forEach((a) => {
      for (let i = 1; i <= 4; i++) paths.push({ x: Math.cos(a) * (150 + i * 160), z: Math.sin(a) * (150 + i * 160) });
    });
    for (let i = 1; i <= 4; i++) paths.push({ x: 0, z: 760 + i * 190 });
    const crowd = C.npc ? C.npc.crowd(village, paths, 10) : null;

    // ---- the three shrines ----
    const shrines = {};
    places.shrines.forEach((def) => {
      const s = shrine(def);
      root.add(s.group);
      shrines[def.id] = s;
      C.keepClear.push({ x: def.x, z: def.z, r: 340 });
    });

    // ---- the Weeping Bridge ----
    root.add(bridge(places.bridge.x, places.bridge.z));
    C.keepClear.push({ x: places.bridge.x, z: places.bridge.z, r: 1400 });

    // ---- the Sunken Keep ----
    const k = keep(places.keep.x, places.keep.z);
    root.add(k.group);
    C.keepClear.push({ x: places.keep.x, z: places.keep.z, r: 1000 });
    // The curtain walls are solid: the only way in is the broken south gate.
    for (const sx of [-1, 1]) {
      for (let i = -3; i <= 3; i++) {
        colliders.push({ x: places.keep.x + sx * 720, z: places.keep.z + i * 210, r: 140 });
      }
    }
    for (let i = -3; i <= 3; i++) {
      colliders.push({ x: places.keep.x + i * 210, z: places.keep.z - 720, r: 140 });
    }
    for (const sx of [-1, 1]) {
      colliders.push({ x: places.keep.x + sx * 330, z: places.keep.z + 720, r: 140 });
      colliders.push({ x: places.keep.x + sx * 560, z: places.keep.z + 720, r: 140 });
    }

    // ---- waystones ----
    const stoneSpots = [
      { id: 'vale', name: 'Drane Vale', x: 0, z: -150 },
      { id: 'bridge', name: 'Weeping Bridge', x: places.bridge.x + 1250, z: places.bridge.z },
      { id: 'root', name: 'Shrine of Root', x: places.shrines[0].x + 380, z: places.shrines[0].z + 120 },
      { id: 'ember', name: 'Shrine of Ember', x: places.shrines[1].x + 380, z: places.shrines[1].z + 120 },
      { id: 'tide', name: 'Shrine of Tide', x: places.shrines[2].x + 380, z: places.shrines[2].z + 120 },
      { id: 'keep', name: 'Sunken Keep', x: places.keep.x, z: places.keep.z + 900 }
    ];
    const stones = {};
    stoneSpots.forEach((s) => {
      const w = waystone(s.x, s.z);
      root.add(w.group);
      w.id = s.id;
      w.name = s.name;
      w.pos = { x: s.x, z: s.z };
      w.lit = s.id === 'vale';
      stones[s.id] = w;
    });

    return { root, colliders, shrines, stones, keep: k, sunstone: k.sun, sunMat: k.sunMat, crowd: crowd };
  };
})();
