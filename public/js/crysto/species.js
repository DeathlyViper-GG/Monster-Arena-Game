/* Crysto — the bodies that live here.
   Each kind is a creature in the round: hide, stone, ice, fire, or void,
   built from the same low shapes as the rest of the vale and animated from
   the hips. A boss is the same bloodline, grown into the thing the shrines
   and the crown actually name. */
(function () {
  const C = (window.Crysto = window.Crysto || {});

  let DOT = null;
  function dotTex() {
    if (DOT) return DOT;
    const s = 64, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    DOT = new THREE.CanvasTexture(cv);
    return DOT;
  }

  function shade(color, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({
      color: color, roughness: 0.78, metalness: 0.08, flatShading: true
    }, extra || {}));
  }

  function glow(color, size, opacity) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dotTex(), color: color, transparent: true,
      opacity: opacity == null ? 0.65 : opacity,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    s.scale.setScalar(size);
    return s;
  }

  function mesh(geo, material, x, y, z, parent) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function limb(parent, x, y, z, len, rad, material, limbs, kind) {
    const p = new THREE.Group();
    p.position.set(x, y, z);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.62, rad, len, 5), material);
    m.position.y = -len * 0.5;
    m.castShadow = true;
    p.add(m);
    parent.add(p);
    limbs.push({ p: p, kind: kind || 'leg', rest: y, sign: x < 0 ? -1 : 1 });
    return p;
  }

  function horn(parent, x, y, z, h, rad, material, tilt) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 5), material);
    m.position.set(x, y + h * 0.4, z);
    m.rotation.z = tilt || 0;
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  function finish(group, limbs, height) {
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(height * 0.34, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff8a8a, transparent: true, opacity: 0, depthWrite: false })
    );
    flash.position.y = height * 0.46;
    group.add(flash);
    return {
      group: group,
      height: height,
      animate: function (now, moving, hit) {
        const amp = moving ? 0.62 : 0.07;
        const sp = moving ? 7.2 : 1.5;
        for (let i = 0; i < limbs.length; i++) {
          const l = limbs[i];
          if (l.kind === 'leg' || l.kind === 'arm') {
            l.p.rotation.x = Math.sin(now * sp + i * 1.4) * amp * (l.kind === 'arm' ? 0.7 : 1);
          } else if (l.kind === 'wing') {
            l.p.rotation.z = l.sign * (0.35 + Math.sin(now * (moving ? 8 : 2.6) + i) * 0.38);
          } else if (l.kind === 'hover') {
            l.p.position.y = l.rest + Math.sin(now * 2.1 + i) * (moving ? 10 : 6);
          } else if (l.kind === 'spin') {
            l.p.rotation.y = now * 1.3;
          }
        }
        flash.material.opacity = hit ? 0.38 : 0;
      }
    };
  }

  function quadruped(o) {
    const g = new THREE.Group();
    const limbs = [];
    const hide = shade(o.hide, { roughness: 0.9 });
    const dark = shade(o.dark, { roughness: 0.86 });
    const accent = shade(o.accent, { emissive: o.accent, emissiveIntensity: o.glow || 0.35, roughness: 0.45 });
    mesh(new THREE.BoxGeometry(o.body[0], o.body[1], o.body[2]), hide, 0, o.hip, 6, g);
    mesh(new THREE.BoxGeometry(o.head[0], o.head[1], o.head[2]), dark, 0, o.hip + 8, o.body[2] * 0.55, g);
    if (o.snout) mesh(new THREE.BoxGeometry(o.snout[0], o.snout[1], o.snout[2]), accent, 0, o.hip, o.body[2] * 0.72, g);
    const legLen = o.leg || o.hip * 0.85;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
      limb(g, s[0] * o.body[0] * 0.38, o.hip - 4, s[1] * o.body[2] * 0.28, legLen, o.legR || 7, dark, limbs, 'leg');
    });
    const tail = new THREE.Group();
    tail.position.set(0, o.hip, -o.body[2] * 0.45);
    mesh(new THREE.CylinderGeometry(3, 7, o.tail || 54, 5), dark, 0, 0, -((o.tail || 54) / 2), tail);
    tail.rotation.x = 0.8;
    g.add(tail);
    limbs.push({ p: tail, kind: 'arm' });
    if (o.crest) horn(g, 0, o.hip + o.head[1], o.body[2] * 0.4, o.crest, 6, accent, 0.4);
    if (o.light) {
      const gl = glow(o.light, o.lightSize || 70, 0.55);
      gl.position.set(0, o.hip + 10, o.body[2] * 0.4);
      g.add(gl);
    }
    return finish(g, limbs, o.hip + o.head[1] + 16);
  }

  function biped(o) {
    const g = new THREE.Group();
    const limbs = [];
    const hide = shade(o.hide, { roughness: o.rough == null ? 0.72 : o.rough, metalness: o.metal || 0.12 });
    const dark = shade(o.dark, { roughness: 0.8, metalness: o.metal || 0 });
    const accent = shade(o.accent, {
      emissive: o.accent, emissiveIntensity: o.glow == null ? 0.45 : o.glow, roughness: 0.4
    });
    const hip = o.hip;
    mesh(new THREE.BoxGeometry(o.chest[0], o.chest[1], o.chest[2]), hide, 0, hip + o.chest[1] * 0.35, 0, g);
    mesh(new THREE.BoxGeometry(o.head[0], o.head[1], o.head[2]), dark, 0, hip + o.chest[1] + o.head[1] * 0.35, 4, g);
    if (o.eye) {
      mesh(new THREE.BoxGeometry(o.head[0] * 0.7, 6, 4), accent, 0, hip + o.chest[1] + 4, o.head[2] * 0.55, g);
    }
    limb(g, -o.chest[0] * 0.42, hip + o.chest[1] * 0.7, 0, o.arm || 52, o.armR || 6, dark, limbs, 'arm');
    limb(g, o.chest[0] * 0.42, hip + o.chest[1] * 0.7, 0, o.arm || 52, o.armR || 6, dark, limbs, 'arm');
    limb(g, -o.chest[0] * 0.22, hip, 0, o.leg || hip * 0.92, o.legR || 8, hide, limbs, 'leg');
    limb(g, o.chest[0] * 0.22, hip, 0, o.leg || hip * 0.92, o.legR || 8, hide, limbs, 'leg');
    (o.horns || []).forEach(function (h) {
      horn(g, h[0], hip + o.chest[1] + o.head[1] * 0.2, h[2] || 0, h[1], h[3] || 5, accent, h[4] || 0);
    });
    if (o.wings) {
      [-1, 1].forEach(function (s) {
        const w = new THREE.Group();
        w.position.set(s * o.chest[0] * 0.5, hip + o.chest[1] * 0.6, -6);
        mesh(new THREE.BoxGeometry(o.wings, 6, 28), accent, s * o.wings * 0.45, 0, 0, w);
        g.add(w);
        limbs.push({ p: w, kind: 'wing', sign: s });
      });
    }
    if (o.light) {
      const gl = glow(o.light, o.lightSize || 90, 0.5);
      gl.position.set(0, hip + o.chest[1] * 0.4, 8);
      g.add(gl);
    }
    const top = hip + o.chest[1] + o.head[1] + (o.horns && o.horns.length ? 28 : 8);
    return finish(g, limbs, top);
  }

  function wraith() {
    const g = new THREE.Group();
    const limbs = [];
    const cloth = shade(0x2a2140, { roughness: 0.95 });
    const core = shade(0xc9a6ff, { emissive: 0xb07cff, emissiveIntensity: 1.1, transparent: true, opacity: 0.85, roughness: 0.3 });
    const orb = mesh(new THREE.SphereGeometry(22, 12, 10), core, 0, 118, 0, g);
    limbs.push({ p: orb, kind: 'hover', rest: 118 });
    const skirt = mesh(new THREE.ConeGeometry(46, 110, 7), cloth, 0, 62, 0, g);
    skirt.scale.y = 1;
    limbs.push({ p: skirt, kind: 'hover', rest: 62 });
    ;[-1, 1].forEach(function (s, i) {
      limb(g, s * 28, 100, 0, 70, 4, cloth, limbs, 'arm');
    });
    const gl = glow(0xc9a6ff, 120, 0.45);
    gl.position.y = 118;
    g.add(gl);
    return finish(g, limbs, 160);
  }

  function colossus() {
    const b = biped({
      hide: 0x5c6a48, dark: 0x3d4a34, accent: 0x9cffc0, glow: 0.7,
      chest: [78, 70, 48], head: [40, 32, 36], hip: 96,
      arm: 64, armR: 11, leg: 90, legR: 12, eye: true, light: 0x9cffc0, lightSize: 130,
      horns: [[-16, 36, 0, 7, 0.5], [16, 36, 0, 7, -0.5], [0, 48, -4, 8, 0]]
    });
    const root = shade(0x6a8a52, { emissive: 0x9cffc0, emissiveIntensity: 0.4, roughness: 0.9 });
    [-1, 1].forEach(function (s) {
      const p = new THREE.Group();
      p.position.set(s * 48, 150, -8);
      mesh(new THREE.CylinderGeometry(5, 9, 70, 5), root, s * 10, 10, 0, p);
      b.group.add(p);
    });
    return b;
  }

  function sovereign() {
    return biped({
      hide: 0x3a2218, dark: 0x24140e, accent: 0xff9a4c, glow: 1.1, metal: 0.35,
      chest: [64, 62, 40], head: [32, 28, 30], hip: 100,
      arm: 58, armR: 8, leg: 92, legR: 10, eye: true, light: 0xff6a22, lightSize: 150,
      horns: [[-18, 40, 2, 8, 0.7], [18, 40, 2, 8, -0.7], [0, 52, 6, 14, 0]],
      wings: 54
    });
  }

  function rimeWarden() {
    return biped({
      hide: 0xc5e4f5, dark: 0x8fb8d0, accent: 0xd8f4ff, glow: 0.8, rough: 0.28, metal: 0.25,
      chest: [58, 78, 36], head: [28, 36, 26], hip: 108,
      arm: 70, armR: 7, leg: 100, legR: 9, eye: true, light: 0x9fe3ff, lightSize: 140,
      horns: [[-12, 44, 0, 6, 0.3], [12, 44, 0, 6, -0.3], [0, 60, 0, 22, 0]]
    });
  }

  function knight() {
    return biped({
      hide: 0x2c2838, dark: 0x16141e, accent: 0x8a5cd8, glow: 0.9, metal: 0.55, rough: 0.4,
      chest: [62, 66, 36], head: [30, 34, 28], hip: 104,
      arm: 60, armR: 8, leg: 96, legR: 10, eye: true, light: 0x6a3cff, lightSize: 160,
      horns: [[-20, 28, -6, 10, 0.9], [20, 28, -6, 10, -0.9]],
      wings: 78
    });
  }

  function matriarch() {
    const g = new THREE.Group();
    const limbs = [];
    const hide = shade(0x241c30, { roughness: 0.7, metalness: 0.3 });
    const accent = shade(0xc9a6ff, { emissive: 0xb07cff, emissiveIntensity: 1.05, roughness: 0.35 });
    mesh(new THREE.SphereGeometry(70, 10, 8), hide, 0, 96, 0, g);
    mesh(new THREE.SphereGeometry(36, 10, 8), accent, 0, 150, 18, g);
    const gl = glow(0xd2b6ff, 220, 0.55);
    gl.position.set(0, 150, 18);
    g.add(gl);
    for (let i = 0; i < 6; i++) {
      const s = i < 3 ? -1 : 1;
      const z = -40 + (i % 3) * 40;
      limb(g, s * 48, 80, z, 78, 8, hide, limbs, 'leg');
    }
    [-1, 1].forEach(function (s) {
      const w = new THREE.Group();
      w.position.set(s * 60, 130, -10);
      mesh(new THREE.BoxGeometry(90, 8, 36), accent, s * 40, 0, 0, w);
      g.add(w);
      limbs.push({ p: w, kind: 'wing', sign: s });
    });
    horn(g, 0, 168, 10, 48, 10, accent, 0);
    horn(g, -28, 150, 0, 30, 7, accent, 0.6);
    horn(g, 28, 150, 0, 30, 7, accent, -0.6);
    return finish(g, limbs, 230);
  }

  function stormHarrier() {
    return biped({
      hide: 0x3a4658, dark: 0x1e2836, accent: 0xbfe9ff, glow: 0.9, metal: 0.4,
      chest: [40, 48, 28], head: [22, 20, 24], hip: 86,
      arm: 40, armR: 4, leg: 70, legR: 5, eye: true, light: 0xd6f3ff, lightSize: 80,
      wings: 64
    });
  }

  const BUILDERS = {
    ravener: function () {
      return quadruped({
        hide: 0x6a5344, dark: 0x3a2c24, accent: 0xc4553a, glow: 0.25,
        body: [78, 32, 110], head: [28, 24, 36], snout: [16, 12, 22],
        hip: 62, leg: 50, legR: 6, crest: 22, tail: 64
      });
    },
    hellforged: function () {
      return biped({
        hide: 0x4a4038, dark: 0x2a221c, accent: 0xff6a2a, glow: 0.8, metal: 0.62, rough: 0.42,
        chest: [52, 48, 30], head: [26, 24, 24], hip: 88,
        arm: 50, armR: 7, leg: 78, legR: 8, eye: true, light: 0xff8a3a, lightSize: 70,
        horns: [[-12, 26, 0, 6, 0.45], [12, 26, 0, 6, -0.45]]
      });
    },
    'gorgon-x': function () {
      const g = new THREE.Group();
      const limbs = [];
      const scale = shade(0x3e6a45, { roughness: 0.55, metalness: 0.15 });
      const pale = shade(0xd8e2c8, { roughness: 0.7 });
      const coil = mesh(new THREE.CylinderGeometry(16, 22, 90, 7), scale, 0, 48, -10, g);
      coil.rotation.x = 0.4;
      mesh(new THREE.BoxGeometry(36, 40, 28), scale, 0, 108, 16, g);
      mesh(new THREE.BoxGeometry(28, 22, 24), pale, 0, 138, 24, g);
      ;[-1, 1].forEach(function (s) {
        const hood = mesh(new THREE.BoxGeometry(28, 36, 4), pale, s * 22, 146, 10, g);
        hood.rotation.z = s * -0.5;
      });
      limb(g, -20, 112, 10, 48, 4, scale, limbs, 'arm');
      limb(g, 20, 112, 10, 48, 4, scale, limbs, 'arm');
      const gl = glow(0xffd08a, 60, 0.45);
      gl.position.set(0, 140, 30);
      g.add(gl);
      return finish(g, limbs, 170);
    },
    noctilith: function () {
      return biped({
        hide: 0x2a2440, dark: 0x14121c, accent: 0x7a5cff, glow: 0.85, metal: 0.2,
        chest: [44, 70, 30], head: [22, 28, 22], hip: 96,
        arm: 64, armR: 5, leg: 88, legR: 7, eye: true, light: 0x8a6cff, lightSize: 100,
        horns: [[0, 40, 0, 16, 0]]
      });
    },
    'bone-warden': function () {
      return biped({
        hide: 0xd9d3c4, dark: 0xb7b0a2, accent: 0x6a5a48, glow: 0.15, rough: 0.9,
        chest: [48, 56, 28], head: [24, 26, 22], hip: 100,
        arm: 58, armR: 5, leg: 92, legR: 6, eye: true,
        horns: [[-10, 18, 4, 8, 0.2], [10, 18, 4, 8, -0.2]]
      });
    },
    'elem-fire': function (boss) { return boss ? sovereign() : quadruped({
      hide: 0x3a1c12, dark: 0x24100c, accent: 0xff6a22, glow: 1.0,
      body: [70, 28, 100], head: [30, 22, 34], snout: [18, 12, 24],
      hip: 54, leg: 42, legR: 7, tail: 48, light: 0xff8a3a, lightSize: 90, crest: 16
    }); },
    'elem-storm': function () { return stormHarrier(); },
    'elem-rime': function (boss) {
      return boss ? rimeWarden() : quadruped({
        hide: 0xd4eef8, dark: 0x9ec8de, accent: 0xeaf8ff, glow: 0.55,
        body: [64, 26, 96], head: [24, 20, 30], hip: 58, leg: 46, legR: 6,
        crest: 30, light: 0xbfe9ff, lightSize: 80
      });
    },
    'elem-quake': function (boss) {
      return boss ? colossus() : biped({
        hide: 0x6a5b42, dark: 0x3e3428, accent: 0xc6d98a, glow: 0.35, rough: 0.95,
        chest: [60, 50, 40], head: [32, 24, 30], hip: 84,
        arm: 48, armR: 9, leg: 76, legR: 11, eye: true, light: 0xd8c48a, lightSize: 70
      });
    },
    'elem-soul': function () { return wraith(); },
    'void-seraph': function (boss, form) {
      if (form === 'matriarch') return matriarch();
      return knight();
    }
  };

  C.species = {
    build: function (kind, opts) {
      opts = opts || {};
      const fn = BUILDERS[kind] || BUILDERS.ravener;
      const boss = !!opts.boss || opts.form === 'root' || opts.form === 'ember' || opts.form === 'tide';
      return fn(boss, opts.form);
    }
  };
})();
