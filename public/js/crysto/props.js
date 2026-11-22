/* Crysto — everything growing, lying about or left standing on the land.
   Scenery is seeded per terrain tile, so it always matches the ground it sits
   on and disappears with the tile when the walker leaves the area. */
(function () {
  const C = (window.Crysto = window.Crysto || {});

  // Places the world must keep clear of trees: the village, shrines, the bridge
  // and the keep. town.js fills this in as it builds.
  C.keepClear = C.keepClear || [];

  // One clock for every blade in the world: terrain.js ticks it each frame.
  C.wind = C.wind || { value: 0 };
  const GRASS_THRESHOLDS = { vale: 0.40, shore: 0.47, pine: 0.44, mire: 0.39, ember: 0.59, crown: 0.53 };
  const GRASS_PALETTES = {
    pine: [0.29, 0.42, 0.39], mire: [0.27, 0.34, 0.43],
    ember: [0.12, 0.36, 0.48], crown: [0.25, 0.18, 0.53],
    shore: [0.17, 0.32, 0.48], vale: [0.235, 0.40, 0.43]
  };

  function clearAt(x, z) {
    if (C.reach && C.reach.pathContains && C.reach.pathContains(x, z, 90)) return true;
    for (let i = 0; i < C.keepClear.length; i++) {
      const p = C.keepClear[i];
      const dx = x - p.x, dz = z - p.z;
      if (dx * dx + dz * dz < p.r * p.r) return true;
    }
    return false;
  }

  function trunkGeo() {
    const g = new THREE.CylinderGeometry(5, 11, 130, 6);
    g.translate(0, 65, 0);
    return g;
  }

  // Two or three pieces welded into one geometry, so a tree is still a single
  // instance and a single draw call.
  function mergeGeos(list) {
    const pos = [], nor = [], uv = [], idx = [];
    let off = 0;
    list.forEach((g) => {
      const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        nor.push(n.getX(i), n.getY(i), n.getZ(i));
        uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      }
      const ix = g.index;
      if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
      else for (let i = 0; i < p.count; i++) idx.push(i + off);
      off += p.count;
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    out.setIndex(idx);
    return out;
  }

  /* ---- grass: two crossed, textured cards, grouped by ground cover ------ */
  let TUFT = null;
  function tuftTexture() {
    if (TUFT) return TUFT;
    const s = 64, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const x = cv.getContext('2d');
    x.clearRect(0, 0, s, s);
    for (let i = 0; i < 44; i++) {
      const bx = 5 + Math.random() * (s - 10);
      const h = s * (0.4 + Math.random() * 0.58);
      const lean = (Math.random() - 0.5) * 18;
      const w = 1.1 + Math.random() * 1.7;
      const grad = x.createLinearGradient(0, s, 0, s - h);
      const dark = Math.random() > 0.6;
      grad.addColorStop(0, dark ? 'rgba(44,68,30,0.97)' : 'rgba(56,82,36,0.97)');
      grad.addColorStop(0.5, dark ? 'rgba(80,116,46,0.97)' : 'rgba(102,140,58,0.97)');
      grad.addColorStop(0.85, 'rgba(150,182,84,0.95)');
      grad.addColorStop(1, 'rgba(206,222,140,0.85)');
      x.strokeStyle = grad;
      x.lineWidth = w;
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(bx, s);
      x.quadraticCurveTo(bx + lean * 0.4, s - h * 0.6, bx + lean, s - h);
      x.stroke();
    }
    TUFT = new THREE.CanvasTexture(cv);
    if (THREE.sRGBEncoding !== undefined) TUFT.encoding = THREE.sRGBEncoding;
    return TUFT;
  }

  /* ---- flowers: small bright heads nodding on their stems -------------- */
  let BLOOM = null;
  function bloomTexture() {
    if (BLOOM) return BLOOM;
    const s = 64, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const x = cv.getContext('2d');
    x.clearRect(0, 0, s, s);
    for (let i = 0; i < 10; i++) {
      const bx = 6 + Math.random() * (s - 12);
      const top = s * (0.16 + Math.random() * 0.3);
      x.strokeStyle = 'rgba(70,104,44,0.95)';
      x.lineWidth = 1.6;
      x.beginPath();
      x.moveTo(bx, s);
      x.quadraticCurveTo(bx + (Math.random() - 0.5) * 8, s * 0.6, bx, top + 6);
      x.stroke();
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * 6.283;
        x.fillStyle = 'rgba(255,253,246,0.97)';
        x.beginPath();
        x.ellipse(bx + Math.cos(a) * 3.2, top + Math.sin(a) * 3.2, 3.4, 2.6, a, 0, 6.283);
        x.fill();
      }
      x.fillStyle = 'rgba(255,226,140,0.98)';
      x.beginPath();
      x.arc(bx, top, 2.2, 0, 6.283);
      x.fill();
    }
    BLOOM = new THREE.CanvasTexture(cv);
    if (THREE.sRGBEncoding !== undefined) BLOOM.encoding = THREE.sRGBEncoding;
    return BLOOM;
  }

  function tuftGeo() {
    const g = new THREE.BufferGeometry();
    const pos = [
      -0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0,
      0, 0, -0.5, 0, 0, 0.5, 0, 1, 0.5, 0, 1, -0.5
    ];
    const uv = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1];
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    g.computeVertexNormals();
    return g;
  }

  /* ---- bark, needles and leaves: real surfaces, not flat colour -------- */
  let BARK = null, NEEDLE = null, LEAF = null;

  function barkTexture() {
    if (BARK) return BARK;
    const w = 64, h = 128, cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    x.fillStyle = '#5a4630';
    x.fillRect(0, 0, w, h);
    // the long plates bark splits into
    for (let i = 0; i < 110; i++) {
      const px = Math.random() * w;
      const g = 40 + Math.random() * 80;
      x.strokeStyle = 'rgba(' + (g | 0) + ',' + ((g * 0.78) | 0) + ',' + ((g * 0.54) | 0) + ',0.9)';
      x.lineWidth = 1 + Math.random() * 4;
      x.beginPath();
      let py = 0;
      x.moveTo(px, 0);
      while (py < h) {
        py += 10 + Math.random() * 18;
        x.lineTo(px + (Math.random() - 0.5) * 4, py);
      }
      x.stroke();
    }
    // knots
    for (let i = 0; i < 5; i++) {
      const kx = Math.random() * w, ky = Math.random() * h;
      const g2 = x.createRadialGradient(kx, ky, 0, kx, ky, 8);
      g2.addColorStop(0, 'rgba(28,20,12,0.95)');
      g2.addColorStop(1, 'rgba(60,45,30,0)');
      x.fillStyle = g2;
      x.beginPath();
      x.arc(kx, ky, 8, 0, 6.283);
      x.fill();
    }
    BARK = new THREE.CanvasTexture(cv);
    BARK.wrapS = BARK.wrapT = THREE.RepeatWrapping;
    BARK.repeat.set(2, 2);
    if (THREE.sRGBEncoding !== undefined) BARK.encoding = THREE.sRGBEncoding;
    return BARK;
  }

  function needleTexture() {
    if (NEEDLE) return NEEDLE;
    const s = 128, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const x = cv.getContext('2d');
    x.fillStyle = '#1b3120';
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 1500; i++) {
      const px = Math.random() * s, py = Math.random() * s;
      const len = 4 + Math.random() * 11;
      const g = 55 + Math.random() * 125;
      x.strokeStyle = 'rgba(' + ((g * 0.42) | 0) + ',' + (g | 0) + ',' + ((g * 0.48) | 0) + ',' + (0.45 + Math.random() * 0.55) + ')';
      x.lineWidth = 0.7 + Math.random() * 0.9;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + (Math.random() - 0.5) * 4, py + len);
      x.stroke();
    }
    for (let i = 0; i < 46; i++) {
      const px = Math.random() * s, py = Math.random() * s, r = 4 + Math.random() * 12;
      const g2 = x.createRadialGradient(px, py, 0, px, py, r);
      g2.addColorStop(0, 'rgba(10,26,14,0.55)');
      g2.addColorStop(1, 'rgba(10,26,14,0)');
      x.fillStyle = g2;
      x.beginPath();
      x.arc(px, py, r, 0, 6.283);
      x.fill();
    }
    NEEDLE = new THREE.CanvasTexture(cv);
    NEEDLE.wrapS = NEEDLE.wrapT = THREE.RepeatWrapping;
    NEEDLE.repeat.set(3, 2);
    if (THREE.sRGBEncoding !== undefined) NEEDLE.encoding = THREE.sRGBEncoding;
    return NEEDLE;
  }

  function leafTexture() {
    if (LEAF) return LEAF;
    const s = 128, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const x = cv.getContext('2d');
    x.fillStyle = '#3f5f2c';
    x.fillRect(0, 0, s, s);
    // a canopy is a heap of small leaves, each catching the light its own way
    for (let i = 0; i < 620; i++) {
      const px = Math.random() * s, py = Math.random() * s;
      const r = 2.2 + Math.random() * 5.5;
      const t = Math.random();
      x.fillStyle = t > 0.72
        ? 'rgba(' + (120 + Math.random() * 60 | 0) + ',' + (168 + Math.random() * 50 | 0) + ',' + (74 + Math.random() * 40 | 0) + ',0.95)'
        : t > 0.34
          ? 'rgba(' + (74 + Math.random() * 40 | 0) + ',' + (116 + Math.random() * 40 | 0) + ',' + (48 + Math.random() * 26 | 0) + ',0.95)'
          : 'rgba(' + (32 + Math.random() * 26 | 0) + ',' + (58 + Math.random() * 28 | 0) + ',' + (24 + Math.random() * 16 | 0) + ',0.95)';
      x.beginPath();
      x.ellipse(px, py, r, r * 0.62, Math.random() * 3.14, 0, 6.283);
      x.fill();
    }
    // the dark hollows between the clumps
    for (let i = 0; i < 40; i++) {
      const px = Math.random() * s, py = Math.random() * s, r = 5 + Math.random() * 13;
      const g2 = x.createRadialGradient(px, py, 0, px, py, r);
      g2.addColorStop(0, 'rgba(14,28,12,0.5)');
      g2.addColorStop(1, 'rgba(14,28,12,0)');
      x.fillStyle = g2;
      x.beginPath();
      x.arc(px, py, r, 0, 6.283);
      x.fill();
    }
    LEAF = new THREE.CanvasTexture(cv);
    LEAF.wrapS = LEAF.wrapT = THREE.RepeatWrapping;
    LEAF.repeat.set(2.5, 2);
    if (THREE.sRGBEncoding !== undefined) LEAF.encoding = THREE.sRGBEncoding;
    return LEAF;
  }

  // A crown is not a smooth ball: nudge every face until the silhouette breaks.
  function lump(geo, amount, seed) {
    const p = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = C.hash2(Math.round(v.x + seed * 13), Math.round(v.y * 1.3 + v.z));
      v.multiplyScalar(1 + (n - 0.5) * (amount / 100));
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  C.scatterChunk = function (minX, minZ, size) {
    const g = new THREE.Group();
    const STEP = 120;
    const n = Math.max(1, Math.floor(size / STEP));
    const seed = Math.round(minX * 0.13 + minZ * 0.71);

    const conifer = [], broad = [], rocks = [];
    const blooms = [], bushes = [], logs = [], dead = [], crags = [];

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const r1 = C.hash2(seed + i * 31, j * 17 + 5);
        const r2 = C.hash2(i * 13 + 7, seed + j * 29);
        const x = minX + (i + 0.15 + r1 * 0.7) * STEP;
        const z = minZ + (j + 0.15 + r2 * 0.7) * STEP;

        const region = C.region ? C.region(x, z) : 'vale';
        const dens = C.fbm(x * 0.00085 + 3.2, z * 0.00085 - 2.6, 3, 2.0, 0.5);
        const h = C.height(x, z);
        if (h < 26 || h > 2500) continue;
        if (clearAt(x, z)) continue;
        const sl = C.slope(x, z);
        if (sl > 0.62) continue;

        const woodland = region === 'pine' ? 0.40 : region === 'mire' ? 0.57 : region === 'ember' || region === 'crown' ? 0.66 : 0.5;
        const treeLine = region === 'vale' ? 1540 : region === 'crown' ? 980 : region === 'ember' ? 1120 : 1320;
        if (h < treeLine && dens > woodland && r1 > 0.12) {
          const item = { x, y: h, z, s: 0.75 + r2 * 0.85, rot: r1 * 6.283, tint: r2, region: region };
          if (region === 'pine' || dens > 0.605 || h > 800) conifer.push(item);
          else broad.push(item);
        } else if (sl > 0.34 || r1 > 0.86) {
          rocks.push({ x, y: h, z, s: 0.7 + r2 * 1.9, rot: r1 * 6.283, tint: r2, region: region });
        }

        // the little things that make a meadow a meadow: flowers in the open,
        // low scrub at the wood's edge, a trunk that came down years ago
        if (region !== 'ember' && region !== 'crown' && sl < 0.16 && dens > 0.34 && r1 > 0.52) {
          blooms.push({ x, y: h, z, s: 0.7 + r2 * 0.9, rot: r1 * 6.283, tint: r2, region: region });
        }
        if (dens > 0.4 && dens < 0.56 && r2 > 0.62) {
          bushes.push({ x, y: h, z, s: 0.55 + r1 * 0.7, rot: r2 * 6.283, tint: r1 });
        }
        if ((dens > 0.55 || region === 'ember' || region === 'mire') && r2 > 0.86) {
          logs.push({ x, y: h, z, s: 0.7 + r1 * 0.7, rot: r2 * 6.283, tint: r1, region: region });
        }
        if (sl > 0.2 && sl < 0.5 && r1 > 0.82) {
          dead.push({ x, y: h, z, s: 0.6 + r2 * 0.7, rot: r1 * 6.283, tint: r2, region: region });
        }
        // crags: the bone of the hillside breaking through on the steep ground
        if (sl > 0.42 && r2 > 0.55) {
          crags.push({ x, y: h, z, s: 1.6 + r1 * 4.2, rot: r2 * 6.283, tint: r1, region: region });
        }
      }
    }

    const bark = barkTexture();
    const trunkMat = new THREE.MeshStandardMaterial({
      map: bark, bumpMap: bark, bumpScale: 1.9, roughness: 0.96
    });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x7b7a74, roughness: 0.92, flatShading: true });

    function instanced(geo, mat, list, colorFn, scaleY, shadows) {
      if (!list.length) return null;
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const v = new THREE.Vector3();
      const s = new THREE.Vector3();
      const col = new THREE.Color();
      list.forEach((it, k) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot);
        v.set(it.x - (minX + size / 2), it.y, it.z - (minZ + size / 2));
        s.set(it.s, (scaleY || 1) * it.s, it.s);
        m.compose(v, q, s);
        mesh.setMatrixAt(k, m);
        if (colorFn) {
          col.setHex(colorFn(it));
          mesh.setColorAt(k, col);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      // Trees throw their shade across the grass, which is most of what makes
      // a wood feel like a wood. Blades never cast: they are far too many.
      mesh.castShadow = !!shadows;
      mesh.receiveShadow = !!shadows;
      // Instances live far from the geometry's own origin; a culled bounding
      // sphere would make whole woods pop out of the world.
      mesh.frustumCulled = false;
      return mesh;
    }

    // Trunks for both kinds
    const all = conifer.concat(broad);
    const trunks = instanced(trunkGeo(), trunkMat, all, (it) => {
      if (it.region === 'pine') return it.tint > 0.5 ? 0x665a4d : 0x453f39;
      if (it.region === 'ember') return it.tint > 0.5 ? 0x95745b : 0x58453a;
      if (it.region === 'mire') return it.tint > 0.5 ? 0x6d7060 : 0x41483e;
      if (it.region === 'crown') return 0xaaa697;
      return it.tint > 0.5 ? 0xd8c8ae : 0xb0a08c;
    }, 1, true);
    if (trunks) g.add(trunks);

    // Conifers: three tiers of needles stacked up the trunk
    const t1 = new THREE.ConeGeometry(48, 116, 7); t1.translate(0, 110 + 58, 0);
    const t2 = new THREE.ConeGeometry(36, 100, 7); t2.translate(0, 110 + 128, 0);
    const t3 = new THREE.ConeGeometry(22, 78, 7); t3.translate(0, 110 + 196, 0);
    const needles = needleTexture();
    const coneMat = new THREE.MeshStandardMaterial({
      map: needles, bumpMap: needles, bumpScale: 1.0, roughness: 0.93, flatShading: true
    });
    const con = instanced(mergeGeos([t1, t2, t3]), coneMat, conifer, (it) => {
      const t = it.tint;
      if (it.region === 'pine') return t > 0.5 ? 0x718365 : 0x405244;
      if (it.region === 'ember') return t > 0.5 ? 0xa87855 : 0x684638;
      if (it.region === 'mire') return t > 0.5 ? 0x748879 : 0x485d58;
      if (it.region === 'crown') return t > 0.5 ? 0xb5b6ad : 0x8c9295;
      if (it.region === 'shore') return t > 0.5 ? 0xa9a08c : 0x6f7866;
      return t > 0.62 ? 0xdfeedd : t > 0.3 ? 0xffffff : 0xc4d4c0;
    }, 1, true);
    if (con) g.add(con);

    // Broadleaf: a fat low-poly crown made of three lobes
    const c1 = lump(new THREE.IcosahedronGeometry(54, 1), 26, 3); c1.translate(0, 176, 0);
    const c2 = lump(new THREE.IcosahedronGeometry(36, 0), 30, 7); c2.translate(32, 150, 14);
    const c3 = lump(new THREE.IcosahedronGeometry(31, 0), 30, 11); c3.translate(-29, 160, -18);
    const leaves = leafTexture();
    const crownMat = new THREE.MeshStandardMaterial({
      map: leaves, bumpMap: leaves, bumpScale: 1.2, roughness: 0.92, flatShading: true
    });
    const bro = instanced(mergeGeos([c1, c2, c3]), crownMat, broad, (it) => (it.tint > 0.6 ? 0xe8ffd8 : it.tint > 0.3 ? 0xffffff : 0xd0e4c0), 0.9, true);
    if (bro) g.add(bro);

    const rockGeo = new THREE.DodecahedronGeometry(22, 0);
    rockGeo.translate(0, 12, 0);
    const rk = instanced(rockGeo, rockMat, rocks, (it) => (it.tint > 0.5 ? 0x8a8880 : 0x6f6d66), 0.7, true);
    if (rk) g.add(rk);

    // ---- crags: big broken stone standing out of the slopes ----
    const cragGeo = lump(new THREE.DodecahedronGeometry(34, 0), 44, 17);
    cragGeo.translate(0, 16, 0);
    const cragMat = new THREE.MeshStandardMaterial({
      map: bark, bumpMap: bark, bumpScale: 0.6, color: 0x8d8b83, roughness: 0.95, flatShading: true
    });
    const cg = instanced(cragGeo, cragMat, crags, (it) => (it.tint > 0.5 ? 0x9b998f : 0x74736c), 0.9, true);
    if (cg) g.add(cg);

    // ---- fallen trunks, lying where the wind left them ----
    const logGeo = new THREE.CylinderGeometry(13, 16, 130, 7);
    logGeo.rotateZ(Math.PI / 2);
    logGeo.translate(0, 15, 0);
    const lg = instanced(logGeo, trunkMat, logs, (it) => (it.tint > 0.5 ? 0xbfae95 : 0x8d7f6b), 1, true);
    if (lg) g.add(lg);

    // ---- dead trees: a bare trunk with two broken limbs ----
    const b1 = new THREE.CylinderGeometry(2.4, 5.5, 62, 5);
    b1.rotateZ(0.85); b1.translate(22, 92, 0);
    const b2 = new THREE.CylinderGeometry(2.0, 4.6, 54, 5);
    b2.rotateZ(-0.7); b2.rotateY(1.2); b2.translate(-19, 108, 8);
    const deadGeo = mergeGeos([trunkGeo(), b1, b2]);
    const dd = instanced(deadGeo, trunkMat, dead, (it) => (it.tint > 0.5 ? 0xb4a693 : 0x8b8072), 1, true);
    if (dd) g.add(dd);

    // ---- low scrub at the wood's edge ----
    const bushGeo = lump(new THREE.IcosahedronGeometry(30, 0), 40, 23);
    bushGeo.translate(0, 22, 0);
    const bushMat = new THREE.MeshStandardMaterial({
      map: leaves, bumpMap: leaves, bumpScale: 0.9, roughness: 0.94, flatShading: true
    });
    const bs = instanced(bushGeo, bushMat, bushes, (it) => (it.tint > 0.6 ? 0xc8e6a8 : it.tint > 0.3 ? 0x9dc47f : 0x7aa163), 0.85, false);
    if (bs) g.add(bs);

    // ---- grass: knee-high tufts, everywhere the ground lies gentle ----
    const tufts = [];
    const GSTEP = 58;
    const gx0 = Math.floor(minX / GSTEP), gx1 = Math.ceil((minX + size) / GSTEP);
    const gz0 = Math.floor(minZ / GSTEP), gz1 = Math.ceil((minZ + size) / GSTEP);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        const r1 = C.hash2(gx * 53 + 173, gz * 71 + 11);
        const r2 = C.hash2(gx * 41 + 3, gz * 59 + 967);
        const x = (gx + 0.15 + r1 * 0.7) * GSTEP;
        const z = (gz + 0.15 + r2 * 0.7) * GSTEP;
        if (x < minX || x >= minX + size || z < minZ || z >= minZ + size) continue;
        const h = C.height(x, z);
        const region = C.region ? C.region(x, z) : 'vale';
        const grassLine = region === 'vale' ? 1320 : region === 'crown' ? 760 : region === 'ember' ? 720 : 980;
        if (h < 30 || h > grassLine) continue;
        // Grass grows over the green but not through the roads or the houses.
        if (C.reach && C.reach.pathContains && C.reach.pathContains(x, z, 50)) continue;
        let onBuild = false;
        const rc = C.roadClear || [];
        for (let k = 0; k < rc.length; k++) {
          const p = rc[k];
          const ddx = x - p.x, ddz = z - p.z;
          if (ddx * ddx + ddz * ddz < p.r * p.r) { onBuild = true; break; }
        }
        if (onBuild) continue;
        // grass only on ground that lies close to level
        if (Math.abs(C.height(x + 40, z) - h) > 26 || Math.abs(C.height(x, z + 40) - h) > 26) continue;
        const patch = C.fbm(x * 0.0010 - 8.4, z * 0.0010 + 5.7, 3, 2.0, 0.5);
        if (patch < (GRASS_THRESHOLDS[region] || 0.46)) continue;
        const fine = C.fbm(x * 0.006 - 2.2, z * 0.006 + 6.4, 2, 2.0, 0.5);
        const canopy = C.fbm(x * 0.00085 + 3.2, z * 0.00085 - 2.6, 3, 2.0, 0.5);
        if (region === 'pine' && canopy > 0.58 && fine < 0.62) continue;
        if (fine < 0.22 && r2 > 0.42) continue;
        tufts.push({ x: x, y: h, z: z, s: 0.65 + r2 * 0.72, rot: r1 * 6.283, tint: r2, region: region });
      }
    }
    if (tufts.length) {
      const gm = new THREE.MeshStandardMaterial({
        map: tuftTexture(), transparent: true, alphaTest: 0.34,
        side: THREE.DoubleSide, roughness: 0.95, metalness: 0
      });
      // The wind: every blade bends from its root, and the gust travels across
      // the field because the phase comes from where the blade is standing.
      gm.onBeforeCompile = (shader) => {
        shader.uniforms.uWind = C.wind;
        shader.vertexShader = 'uniform float uWind;\n' + shader.vertexShader.replace(
          '#include <begin_vertex>',
          [
            '#include <begin_vertex>',
            'float wx = instanceMatrix[3].x;',
            'float wz = instanceMatrix[3].z;',
            'float gust = sin(uWind * 1.35 + wx * 0.0045 + wz * 0.0031);',
            'float ripple = sin(uWind * 2.7 + wx * 0.011 - wz * 0.007);',
            'float bend = position.y * position.y;',
            'transformed.x += (gust * 0.42 + ripple * 0.16) * bend;',
            'transformed.z += (cos(uWind * 1.1 + wz * 0.0052) * 0.30 + ripple * 0.12) * bend;'
          ].join('\n')
        );
      };
      const gmesh = new THREE.InstancedMesh(tuftGeo(), gm, tufts.length);
      const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion();
      const v4 = new THREE.Vector3(), s4 = new THREE.Vector3(), c4 = new THREE.Color();
      const up = new THREE.Vector3(0, 1, 0);
      tufts.forEach((it, k) => {
        q4.setFromAxisAngle(up, it.rot);
        v4.set(it.x - (minX + size / 2), it.y, it.z - (minZ + size / 2));
        s4.set(25 * it.s, (22 + it.tint * 8) * it.s, 25 * it.s);
        m4.compose(v4, q4, s4);
        gmesh.setMatrixAt(k, m4);
        const palette = GRASS_PALETTES[it.region] || GRASS_PALETTES.vale;
        c4.setHSL(palette[0] + it.tint * 0.035, palette[1], palette[2] + it.tint * 0.10);
        gmesh.setColorAt(k, c4);
      });
      gmesh.instanceMatrix.needsUpdate = true;
      if (gmesh.instanceColor) gmesh.instanceColor.needsUpdate = true;
      gmesh.frustumCulled = false;
      g.add(gmesh);
    }

    // ---- flowers: the colour the meadow keeps between the blades ----
    if (blooms.length) {
      const fm = new THREE.MeshStandardMaterial({
        map: bloomTexture(), transparent: true, alphaTest: 0.3,
        side: THREE.DoubleSide, roughness: 0.9, metalness: 0
      });
      const fmesh = new THREE.InstancedMesh(tuftGeo(), fm, blooms.length);
      const PALETTE = [0xffe08a, 0xf2f6ff, 0xd8a8ff, 0xff9db4, 0xfff3b0, 0xbfe0ff];
      const m5 = new THREE.Matrix4(), q5 = new THREE.Quaternion();
      const v5 = new THREE.Vector3(), s5 = new THREE.Vector3(), c5 = new THREE.Color();
      const up5 = new THREE.Vector3(0, 1, 0);
      blooms.forEach((it, k) => {
        q5.setFromAxisAngle(up5, it.rot);
        v5.set(it.x - (minX + size / 2), it.y, it.z - (minZ + size / 2));
        s5.set(26 * it.s, (22 + it.tint * 10) * it.s, 26 * it.s);
        m5.compose(v5, q5, s5);
        fmesh.setMatrixAt(k, m5);
        c5.setHex(PALETTE[Math.floor(it.tint * PALETTE.length) % PALETTE.length]);
        fmesh.setColorAt(k, c5);
      });
      fmesh.instanceMatrix.needsUpdate = true;
      if (fmesh.instanceColor) fmesh.instanceColor.needsUpdate = true;
      fmesh.frustumCulled = false;
      g.add(fmesh);
    }

    return g;
  };
})();
