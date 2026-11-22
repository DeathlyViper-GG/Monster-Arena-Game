/* =====================================================================
   hub_world.js — the stone the hall is made of.

   Floors, walls, ceilings, windows, banners, pillars, chandeliers, pads,
   plinths and the sealed doors — every piece of the building is drawn
   here from canvases, so the menu needs no downloads at all. hub3d.js
   owns the camera and the walking; this file only builds.
   ===================================================================== */
(function (G) {
  'use strict';

  const T = G.THREE;
  if (!T) return;
  const TAU = Math.PI * 2;

  let scene = null, solids = null, walls = null, items = null, tickers = null;
  const MAT = {};

  function init(env) {
    scene = env.scene;
    solids = env.solids;
    walls = env.walls;
    items = env.items;
    tickers = env.tickers;
    makeMaterials();
  }

  /* =====================================================================
     textures
     ===================================================================== */
  function canvasOf(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // A noise field used as a bump map, so stone and metal catch the light
  // instead of reading as flat paint.
  function bumpTexture(spread) {
    const S = 256, c = canvasOf(S, S), x = c.getContext('2d');
    const img = x.createImageData(S, S);
    const k = spread || 90;
    for (let i = 0; i < S * S; i++) {
      const v = 128 + (Math.random() - 0.5) * k;
      img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }

  function stoneTexture() {
    const c = canvasOf(256, 256), x = c.getContext('2d');
    x.fillStyle = '#232e44'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3200; i++) {
      x.fillStyle = Math.random() > 0.5 ? 'rgba(150,200,255,0.05)' : 'rgba(0,0,0,0.18)';
      x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    x.strokeStyle = 'rgba(3,6,12,0.9)'; x.lineWidth = 3;
    for (let r = 0; r < 4; r++) {
      const y = r * 64;
      x.beginPath(); x.moveTo(0, y); x.lineTo(256, y); x.stroke();
      const off = (r % 2) ? 32 : 0;
      for (let i = 0; i < 4; i++) {
        const px = off + i * 64;
        x.beginPath(); x.moveTo(px, y); x.lineTo(px, y + 64); x.stroke();
      }
    }
    x.strokeStyle = 'rgba(130,190,255,0.10)'; x.lineWidth = 1;
    for (let r = 0; r < 4; r++) {
      const y = r * 64 + 3;
      x.beginPath(); x.moveTo(0, y); x.lineTo(256, y); x.stroke();
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.encoding = T.sRGBEncoding;
    return t;
  }

  function floorTexture() {
    const c = canvasOf(256, 256), x = c.getContext('2d');
    x.fillStyle = '#0a1018'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 44; i++) {
      x.strokeStyle = 'rgba(90,160,230,' + (0.03 + Math.random() * 0.05).toFixed(3) + ')';
      x.lineWidth = 1 + Math.random() * 2;
      x.beginPath();
      let px = Math.random() * 256, py = Math.random() * 256;
      x.moveTo(px, py);
      for (let j = 0; j < 4; j++) {
        px += (Math.random() - 0.5) * 60; py += (Math.random() - 0.5) * 60;
        x.lineTo(px, py);
      }
      x.stroke();
    }
    const inlay = (w, col) => {
      x.strokeStyle = col; x.lineWidth = w;
      x.strokeRect(w / 2, w / 2, 256 - w, 256 - w);
      x.beginPath();
      x.moveTo(128, 0); x.lineTo(128, 256);
      x.moveTo(0, 128); x.lineTo(256, 128);
      x.stroke();
    };
    inlay(13, 'rgba(30,120,190,0.30)');
    inlay(4, 'rgba(110,235,255,0.95)');
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.encoding = T.sRGBEncoding;
    return t;
  }

  function glassTexture() {
    const c = canvasOf(128, 256), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#0b3550'); g.addColorStop(0.5, '#1b6f9e'); g.addColorStop(1, '#061520');
    x.fillStyle = g; x.fillRect(0, 0, 128, 256);
    x.strokeStyle = 'rgba(34,230,255,0.85)'; x.lineWidth = 5;
    x.strokeRect(0, 0, 128, 256);
    x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 256); x.moveTo(0, 96); x.lineTo(128, 96); x.stroke();
    x.strokeStyle = 'rgba(140,240,255,0.5)'; x.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      x.beginPath(); x.moveTo(0, 96 + i * 40); x.lineTo(128, 96 + i * 40); x.stroke();
    }
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    return t;
  }

  function runeTexture() {
    const S = 512, c = canvasOf(S, S), x = c.getContext('2d');
    x.translate(S / 2, S / 2);
    x.strokeStyle = 'rgba(150,215,255,0.85)';
    x.lineWidth = 3;
    for (let ring = 0; ring < 3; ring++) {
      const r = 90 + ring * 62;
      x.beginPath(); x.arc(0, 0, r, 0, TAU); x.stroke();
      const n = 24 + ring * 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        x.beginPath();
        x.moveTo(Math.cos(a) * (r - 8), Math.sin(a) * (r - 8));
        x.lineTo(Math.cos(a) * (r + 8), Math.sin(a) * (r + 8));
        x.stroke();
      }
    }
    x.lineWidth = 4;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, r = 152;
      const cx = Math.cos(a) * r, cy = Math.sin(a) * r;
      x.save(); x.translate(cx, cy); x.rotate(a);
      x.beginPath(); x.moveTo(-11, -11); x.lineTo(11, -11); x.lineTo(-11, 11); x.stroke();
      x.restore();
    }
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    return t;
  }

  function bannerTexture(hex) {
    const c = canvasOf(128, 256), x = c.getContext('2d');
    x.fillStyle = hex; x.fillRect(0, 0, 128, 256);
    x.fillStyle = 'rgba(0,0,0,0.34)';
    for (let i = 0; i < 6; i++) x.fillRect(0, 20 + i * 42, 128, 6);
    x.shadowColor = 'rgba(60,220,255,0.95)';
    x.shadowBlur = 16;
    x.strokeStyle = 'rgba(150,240,255,0.95)'; x.lineWidth = 4;
    x.beginPath(); x.arc(64, 110, 30, 0, TAU); x.stroke();
    x.beginPath(); x.moveTo(64, 80); x.lineTo(64, 140); x.moveTo(34, 110); x.lineTo(94, 110); x.stroke();
    x.beginPath(); x.moveTo(48, 94); x.lineTo(80, 126); x.moveTo(80, 94); x.lineTo(48, 126); x.stroke();
    x.shadowBlur = 0;
    x.fillStyle = 'rgba(0,0,0,0.55)';
    x.beginPath(); x.moveTo(0, 246); x.lineTo(64, 218); x.lineTo(128, 246); x.lineTo(128, 256); x.lineTo(0, 256); x.fill();
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    return t;
  }

  /* =====================================================================
     materials
     ===================================================================== */
  function makeMaterials() {
    const stone = stoneTexture(), floor = floorTexture();
    const coarse = bumpTexture(120), fine = bumpTexture(55);
    MAT.wall = new T.MeshStandardMaterial({ map: stone, bumpMap: coarse, bumpScale: 1.1, roughness: 0.93, metalness: 0.14 });
    MAT.wallDark = new T.MeshStandardMaterial({ map: stone, color: 0x7e8cae, bumpMap: coarse, bumpScale: 0.9, roughness: 0.95, metalness: 0.1 });
    MAT.trim = new T.MeshStandardMaterial({ color: 0x2b3a5c, bumpMap: fine, bumpScale: 0.35, roughness: 0.34, metalness: 0.86 });
    MAT.floor = new T.MeshStandardMaterial({
      map: floor, bumpMap: fine, bumpScale: 0.3, emissive: 0x86e2ff, emissiveMap: floor, emissiveIntensity: 1.05,
      roughness: 0.28, metalness: 0.62
    });
    MAT.floorDark = new T.MeshStandardMaterial({
      map: floor, color: 0x9fb4d6, bumpMap: fine, bumpScale: 0.3, emissive: 0x4fa8d8, emissiveMap: floor, emissiveIntensity: 0.7,
      roughness: 0.4, metalness: 0.52
    });
    MAT.iron = new T.MeshStandardMaterial({ color: 0x1e2942, metalness: 0.8, roughness: 0.42 });
    MAT.ceiling = new T.MeshStandardMaterial({ map: stone, color: 0x6c7c9c, roughness: 0.95, metalness: 0.08 });
    MAT.glass = new T.MeshBasicMaterial({
      map: glassTexture(), transparent: true, opacity: 0.9,
      side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false
    });
    MAT.dust = new T.PointsMaterial({
      color: 0x9fe4ff, size: 4, transparent: true, opacity: 0.45,
      depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true
    });
    MAT.rune = runeTexture();
  }

  /* =====================================================================
     helpers
     ===================================================================== */
  function scaleUV(geo, sx, sy) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
    uv.needsUpdate = true;
    return geo;
  }

  function box(w, h, d, mat, x, y, z, ry) {
    const g = scaleUV(new T.BoxGeometry(w, h, d), Math.max(1, w / 190), Math.max(1, h / 190));
    const m = new T.Mesh(g, mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    scene.add(m);
    return m;
  }

  function emissive(hex) {
    return new T.MeshBasicMaterial({ color: hex });
  }

  function label(text, opts) {
    opts = opts || {};
    const size = opts.size || 40, pad = opts.pad || 18;
    const c = canvasOf(8, 8);
    let x = c.getContext('2d');
    x.font = '600 ' + size + 'px Cinzel, Georgia, serif';
    const w = Math.ceil(x.measureText(text).width) + pad * 2;
    c.width = Math.max(16, w);
    c.height = size + pad * 2;
    x = c.getContext('2d');
    x.font = '600 ' + size + 'px Cinzel, Georgia, serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.shadowColor = opts.glow || 'rgba(130,205,255,0.9)';
    x.shadowBlur = 18;
    x.fillStyle = opts.color || '#e2f1ff';
    x.fillText(text, c.width / 2, c.height / 2);
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    const s = opts.scale || 0.24;
    sp.scale.set(c.width * s, c.height * s, 1);
    return sp;
  }

  function glowSprite(hex, size, opacity) {
    const S = 128, c = canvasOf(S, S), x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
    g.addColorStop(0, hex + 'cc');
    g.addColorStop(0.45, hex + '44');
    g.addColorStop(1, hex + '00');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    const tex = new T.CanvasTexture(c);
    const sp = new T.Sprite(new T.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: opacity == null ? 0.85 : opacity,
      blending: T.AdditiveBlending
    }));
    sp.scale.set(size, size, 1);
    return sp;
  }

  const hexOf = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');

  // An axis-aligned wall you cannot walk through.
  function blockSolid(x, z, w, d) {
    const s = { x, z, hw: w / 2, hd: d / 2 };
    walls.push(s);
    return s;
  }

  /* =====================================================================
     the shell
     ===================================================================== */
  function addFloor(cx, cz, w, d, y, mat) {
    const g = scaleUV(new T.PlaneGeometry(w, d), w / 220, d / 220);
    const m = new T.Mesh(g, mat || MAT.floor);
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, y, cz);
    scene.add(m);
    return m;
  }

  function addWallRun(cx, cz, len, h, ry, mat) {
    return box(len, h, 22, mat || MAT.wall, cx, h / 2, cz, ry || 0);
  }

  function dressedWall(cx, cz, len, h, ry) {
    addWallRun(cx, cz, len, h, ry);
    box(len, 22, 30, MAT.trim, cx, 11, cz, ry || 0);
    box(len, 20, 34, MAT.trim, cx, h - 10, cz, ry || 0);
    box(len, 5, 34, emissive(0x2ee6ff), cx, 26, cz, ry || 0);
  }

  function archedWindow(cx, cy, cz, ry, w, h, accent) {
    const g = new T.Group();
    g.position.set(cx, cy, cz);
    g.rotation.y = ry || 0;
    const glass = new T.Mesh(new T.PlaneGeometry(w, h), MAT.glass);
    g.add(glass);
    const jamb = new T.Mesh(new T.BoxGeometry(14, h, 18), MAT.trim);
    jamb.position.set(-w / 2, 0, 2); g.add(jamb);
    const jamb2 = jamb.clone(); jamb2.position.x = w / 2; g.add(jamb2);
    const sill = new T.Mesh(new T.BoxGeometry(w + 28, 16, 28), MAT.trim);
    sill.position.set(0, -h / 2, 4); g.add(sill);
    const head = new T.Mesh(new T.BoxGeometry(w + 28, 18, 28), MAT.trim);
    head.position.set(0, h / 2, 4); g.add(head);
    const mull = new T.Mesh(new T.BoxGeometry(6, h, 14), MAT.trim);
    g.add(mull);
    const halo = glowSprite(hexOf(accent || 0x9fd8ff), w * 3.6, 0.4);
    halo.position.z = 18;
    g.add(halo);
    const shaft = new T.Mesh(
      new T.ConeGeometry(w * 0.8, h * 2.8, 10, 1, true),
      new T.MeshBasicMaterial({
        color: accent || 0x9fd8ff, transparent: true, opacity: 0.05,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      })
    );
    shaft.position.set(0, -h * 0.9, 130);
    shaft.rotation.x = Math.PI * 0.42;
    g.add(shaft);
    scene.add(g);
    return g;
  }

  function banner(cx, cy, cz, ry, hex) {
    const g = new T.Group();
    g.position.set(cx, cy, cz);
    g.rotation.y = ry || 0;
    const rail = new T.Mesh(new T.CylinderGeometry(4, 4, 130, 8), MAT.iron);
    rail.rotation.z = Math.PI / 2;
    rail.position.y = 74;
    g.add(rail);
    const cloth = new T.Mesh(
      new T.PlaneGeometry(96, 190),
      new T.MeshStandardMaterial({ map: bannerTexture(hex), roughness: 0.95, side: T.DoubleSide })
    );
    cloth.position.y = -20;
    g.add(cloth);
    scene.add(g);
    tickers.push((t) => { cloth.rotation.y = Math.sin(t * 0.7 + cx) * 0.06; });
    return g;
  }

  function pillar(x, z, h, r) {
    const g = new T.Group();
    const base = new T.Mesh(new T.CylinderGeometry(r + 16, r + 22, 28, 14), MAT.trim);
    base.position.y = 14; g.add(base);
    const shaft = new T.Mesh(new T.CylinderGeometry(r, r + 4, h - 100, 16), MAT.wallDark);
    shaft.position.y = h / 2; g.add(shaft);
    const cap = new T.Mesh(new T.CylinderGeometry(r + 22, r + 14, 32, 14), MAT.trim);
    cap.position.y = h - 32; g.add(cap);
    for (let i = 1; i <= 3; i++) {
      const ring = new T.Mesh(new T.TorusGeometry(r + 6, 3.5, 6, 24), emissive(0x2ee6ff));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 40 + (h - 140) * (i / 3.4);
      g.add(ring);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    solids.push({ x, z, r: r + 24 });
    return g;
  }

  function chandelier(x, y, z, accent) {
    const g = new T.Group();
    const hex = hexOf(accent || 0x66e0ff);
    const ring = new T.Mesh(new T.TorusGeometry(96, 7, 8, 30), MAT.iron);
    ring.rotation.x = Math.PI / 2; g.add(ring);
    const ring2 = new T.Mesh(new T.TorusGeometry(60, 5, 8, 26), MAT.iron);
    ring2.rotation.x = Math.PI / 2; ring2.position.y = 30; g.add(ring2);
    const glowRing = new T.Mesh(new T.TorusGeometry(96, 2.5, 6, 30), emissive(accent || 0x66e0ff));
    glowRing.rotation.x = Math.PI / 2; glowRing.position.y = -4; g.add(glowRing);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const px = Math.cos(a) * 96, pz = Math.sin(a) * 96;
      const candle = new T.Mesh(new T.CylinderGeometry(6, 7, 30, 8), MAT.trim);
      candle.position.set(px, 18, pz); g.add(candle);
      const flame = new T.Mesh(new T.SphereGeometry(8, 8, 8), emissive(0xbfefff));
      flame.position.set(px, 40, pz); g.add(flame);
      const s = glowSprite(hex, 60, 0.5);
      s.position.set(px, 40, pz); g.add(s);
    }
    const core = glowSprite(hex, 340, 0.5);
    g.add(core);
    for (let i = 0; i < 3; i++) {
      const chain = new T.Mesh(new T.CylinderGeometry(2, 2, 140, 6), MAT.iron);
      chain.position.set(Math.cos(i * 2.1) * 52, 150, Math.sin(i * 2.1) * 52);
      g.add(chain);
    }
    g.position.set(x, y, z);
    scene.add(g);
    tickers.push((t) => { g.rotation.y = t * 0.08; });
    return g;
  }

  /* =====================================================================
     the rotunda
     ===================================================================== */
  function buildRotunda(HALL_R, CORR) {
    const RH = 420;
    const disc = new T.Mesh(new T.CircleGeometry(HALL_R + 10, 72), MAT.floor);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.5;
    scene.add(disc);

    const seal = new T.Mesh(
      new T.PlaneGeometry(HALL_R * 1.7, HALL_R * 1.7),
      new T.MeshBasicMaterial({
        map: MAT.rune, transparent: true, opacity: 0.7,
        blending: T.AdditiveBlending, depthWrite: false
      })
    );
    seal.rotation.x = -Math.PI / 2;
    seal.position.y = 2;
    scene.add(seal);
    tickers.push((t) => { seal.rotation.z = -t * 0.06; });

    const open = Math.asin(Math.min(0.92, CORR / HALL_R));
    for (let q = 0; q < 4; q++) {
      const base = q * (Math.PI / 2);
      const a0 = base + open, a1 = base + Math.PI / 2 - open;
      const segs = 6;
      for (let i = 0; i < segs; i++) {
        const a = a0 + (a1 - a0) * (i + 0.5) / segs;
        const len = 2 * HALL_R * Math.sin((a1 - a0) / (2 * segs)) + 12;
        const w = new T.Mesh(
          scaleUV(new T.BoxGeometry(len, RH, 28), len / 190, RH / 190),
          MAT.wall
        );
        w.position.set(Math.cos(a) * HALL_R, RH / 2, Math.sin(a) * HALL_R);
        w.rotation.y = -(a + Math.PI / 2);
        scene.add(w);
        const seam = new T.Mesh(new T.BoxGeometry(len, 5, 40), emissive(0x2ee6ff));
        seam.position.set(Math.cos(a) * HALL_R, 26, Math.sin(a) * HALL_R);
        seam.rotation.y = -(a + Math.PI / 2);
        scene.add(seam);
        const crown = new T.Mesh(new T.BoxGeometry(len, 6, 42), emissive(0x1f7fd0));
        crown.position.set(Math.cos(a) * HALL_R, RH - 14, Math.sin(a) * HALL_R);
        crown.rotation.y = -(a + Math.PI / 2);
        scene.add(crown);
      }
    }

    // Eight pillars around the drum — except the two that stood directly in
    // front of the arena's name, and now hold up the upper deck instead.
    for (let i = 0; i < 8; i++) {
      if (i === 5 || i === 6) continue;
      const a = (i / 8) * TAU + Math.PI / 8;
      pillar(Math.cos(a) * 380, Math.sin(a) * 380, RH, 34);
    }

    const dome = new T.Mesh(
      new T.SphereGeometry(HALL_R + 10, 40, 20, 0, TAU, 0, Math.PI / 2),
      new T.MeshStandardMaterial({ map: MAT.wall.map, color: 0x4a5a7c, roughness: 0.96, side: T.BackSide })
    );
    dome.position.y = RH;
    scene.add(dome);

    for (let i = 1; i <= 3; i++) {
      const r = (HALL_R - 40) * (1 - i * 0.24);
      const y = RH + (HALL_R * 0.92) * (i * 0.24);
      const ring = new T.Mesh(new T.TorusGeometry(r, 4, 6, 48), emissive(0x2fa8e0));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      scene.add(ring);
    }

    const oculus = new T.Mesh(new T.TorusGeometry(78, 11, 8, 34), emissive(0x22e6ff));
    oculus.rotation.x = Math.PI / 2;
    oculus.position.y = RH + HALL_R * 0.94;
    scene.add(oculus);

    const beam = new T.Mesh(
      new T.ConeGeometry(110, 900, 20, 1, true),
      new T.MeshBasicMaterial({
        color: 0x8fe4ff, transparent: true, opacity: 0.055,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      })
    );
    beam.position.y = RH + HALL_R * 0.94 - 450;
    scene.add(beam);

    chandelier(0, 320, 0, 0x66e0ff);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      banner(Math.cos(a) * 438, 250, Math.sin(a) * 438, -a - Math.PI / 2, i % 2 ? '#1b1440' : '#0f2340');
    }

    // The name itself hangs over the middle of the floor (buildLogo), so the
    // rotunda leaves the space above the seal clear for it.
  }

  /* =====================================================================
     passages — the four corridors and the ones behind the halls
     ===================================================================== */
  function buildPassage(p) {
    const horiz = p.w >= p.d;
    const len = horiz ? p.w : p.d;
    const width = horiz ? p.d : p.w;
    const h = p.h || 300;
    const cx = p.x, cz = p.z;

    addFloor(cx, cz, p.w, p.d, 0.4, MAT.floorDark);

    const ceil = new T.Mesh(
      scaleUV(new T.PlaneGeometry(p.w, p.d), p.w / 260, p.d / 260),
      MAT.ceiling
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(cx, h, cz);
    scene.add(ceil);

    const steps = Math.max(2, Math.round(len / 110));
    for (let i = 0; i < steps; i++) {
      const d = -len / 2 + (i + 0.5) * (len / steps);
      const rx = horiz ? cx + d : cx, rz = horiz ? cz : cz + d;
      box(horiz ? 18 : width, 26, horiz ? width : 18, MAT.trim, rx, h - 12, rz);
      box(horiz ? 6 : width - 40, 4, horiz ? width - 40 : 6, emissive(0x2b9fd8), rx, h - 26, rz);
    }

    const half = width / 2;
    for (const side of [-1, 1]) {
      const sx = horiz ? cx : cx + side * half;
      const sz = horiz ? cz + side * half : cz;
      const ry = horiz ? 0 : Math.PI / 2;

      // Doorways cut into this wall (the crypt opens onto its cells here).
      const cuts = (p.openings || [])
        .filter((o) => o.side === side)
        .map((o) => ({ at: (horiz ? o.at - cx : o.at - cz), hw: (o.width || 240) / 2 }))
        .sort((a, b) => a.at - b.at);

      const runs = [];
      let cursor = -len / 2;
      for (const c of cuts) {
        const a = Math.max(-len / 2, c.at - c.hw);
        const b = Math.min(len / 2, c.at + c.hw);
        if (b <= a) continue;
        if (a > cursor) runs.push([cursor, a]);
        cursor = Math.max(cursor, b);
      }
      if (cursor < len / 2) runs.push([cursor, len / 2]);
      for (const run of runs) {
        const segLen = run[1] - run[0];
        if (segLen < 6) continue;
        const mid = (run[0] + run[1]) / 2;
        dressedWall(horiz ? cx + mid : sx, horiz ? sz : cz + mid, segLen, h, ry);
      }
      for (const c of cuts) {
        for (const s of [-1, 1]) {
          const at = c.at + s * (c.hw + 15);
          if (Math.abs(at) > len / 2 - 10) continue;
          box(horiz ? 30 : 36, h, horiz ? 36 : 30, MAT.trim,
            horiz ? cx + at : sx, h / 2, horiz ? sz : cz + at);
        }
      }

      const n = Math.max(2, Math.round(len / 175));
      for (let i = 0; i < n; i++) {
        const d = -len / 2 + (i + 0.5) * (len / n);
        if (cuts.some((c) => Math.abs(c.at - d) < c.hw + 30)) continue;
        const fx = horiz ? cx + d : cx + side * (half - 14);
        const fz = horiz ? cz + side * (half - 14) : cz + d;
        const bar = new T.Mesh(new T.BoxGeometry(horiz ? 10 : 8, 150, horiz ? 8 : 10), emissive(0x59d8ff));
        bar.position.set(fx, 150, fz);
        scene.add(bar);
        const s = glowSprite('#8fd4ff', 150, 0.55);
        s.position.set(fx, 150, fz);
        scene.add(s);
      }
    }

    // the corridor ceiling is lower than the doorways at each end
    for (const s of [-1, 1]) {
      const hx = horiz ? cx + s * (len / 2 - 2) : cx;
      const hz = horiz ? cz : cz + s * (len / 2 - 2);
      box(horiz ? 34 : width, 160, horiz ? width : 34, MAT.wall, hx, h + 80, hz);
      box(horiz ? 40 : width, 8, horiz ? width : 40, emissive(0x2ee6ff), hx, h + 6, hz);
    }
  }

  /* =====================================================================
     a hall: floor, four walls with one doorway, windows, ceiling, banners
     ===================================================================== */
  function buildHall(r) {
    const hw = r.w / 2, hd = r.d / 2, h = r.h;
    const accentHex = hexOf(r.accent);
    const door = Math.min(300, r.doorW || 300);

    addFloor(r.x, r.z, r.w, r.d, 0.6, MAT.floor);

    const ceil = new T.Mesh(
      scaleUV(new T.PlaneGeometry(r.w, r.d), r.w / 260, r.d / 260),
      MAT.ceiling
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(r.x, h, r.z);
    scene.add(ceil);
    const bays = Math.max(2, Math.round(r.w / 190));
    for (let i = 0; i < bays; i++) {
      const bx = r.x - hw + (i + 0.5) * (r.w / bays);
      box(22, 34, r.d, MAT.trim, bx, h - 17, r.z);
    }
    const baysZ = Math.max(2, Math.round(r.d / 190));
    for (let j = 0; j < baysZ; j++) {
      const bz = r.z - hd + (j + 0.5) * (r.d / baysZ);
      box(r.w, 34, 22, MAT.trim, r.x, h - 17, bz);
    }
    const sky = new T.Mesh(
      new T.PlaneGeometry(320, 320),
      new T.MeshBasicMaterial({ color: accentHex, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false })
    );
    sky.rotation.x = Math.PI / 2;
    sky.position.set(r.x, h - 6, r.z);
    scene.add(sky);
    const beam = new T.Mesh(
      new T.ConeGeometry(240, 520, 16, 1, true),
      new T.MeshBasicMaterial({
        color: r.accent, transparent: true, opacity: 0.045,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      })
    );
    beam.position.set(r.x, h - 260, r.z);
    scene.add(beam);

    const sides = [
      { s: 'n', len: r.w, x: r.x, z: r.z - hd, ry: 0, along: 'x' },
      { s: 's', len: r.w, x: r.x, z: r.z + hd, ry: 0, along: 'x' },
      { s: 'w', len: r.d, x: r.x - hw, z: r.z, ry: Math.PI / 2, along: 'z' },
      { s: 'e', len: r.d, x: r.x + hw, z: r.z, ry: Math.PI / 2, along: 'z' }
    ];

    // Doors arrive as a side name, or as {s, at} to slide the opening along
    // that wall — the Quartermaster's wing opens onto four rooms this way.
    const doorList = (r.doors || (r.door ? [r.door] : [])).map((d) =>
      (typeof d === 'string' ? { s: d, at: 0 } : d));

    for (const sd of sides) {
      const opens = doorList
        .filter((d) => d.s === sd.s)
        .map((d) => Math.max(-sd.len / 2 + door / 2 + 12, Math.min(sd.len / 2 - door / 2 - 12, d.at || 0)))
        .sort((a, b) => a - b);

      if (!opens.length) {
        dressedWall(sd.x, sd.z, sd.len, h, sd.ry);
        for (let i = -1; i <= 1; i += 2) {
          const d = i * (sd.len * 0.26);
          if (sd.along === 'x') archedWindow(sd.x + d, h * 0.56, sd.z + (sd.s === 'n' ? 18 : -18), sd.s === 'n' ? 0 : Math.PI, 112, 190, r.accent);
          else archedWindow(sd.x + (sd.s === 'w' ? 18 : -18), h * 0.56, sd.z + d, sd.s === 'w' ? Math.PI / 2 : -Math.PI / 2, 112, 190, r.accent);
        }
        banner(sd.x, h * 0.74, sd.z + (sd.along === 'x' ? (sd.s === 'n' ? 30 : -30) : 0), sd.ry + (sd.s === 's' || sd.s === 'e' ? Math.PI : 0), '#141c33');
        continue;
      }

      // the wall runs that remain between the openings
      const runs = [];
      let cursor = -sd.len / 2;
      for (const at of opens) {
        const a = at - door / 2;
        if (a - cursor > 8) runs.push([cursor, a]);
        cursor = at + door / 2;
      }
      if (sd.len / 2 - cursor > 8) runs.push([cursor, sd.len / 2]);
      for (const run of runs) {
        const seg = run[1] - run[0];
        const mid = (run[0] + run[1]) / 2;
        if (sd.along === 'x') dressedWall(sd.x + mid, sd.z, seg, h, 0);
        else dressedWall(sd.x, sd.z + mid, seg, h, Math.PI / 2);
      }

      for (const at of opens) {
        if (sd.along === 'x') {
          box(26, h, 40, MAT.trim, sd.x + at - door / 2, h / 2, sd.z);
          box(26, h, 40, MAT.trim, sd.x + at + door / 2, h / 2, sd.z);
          const arch = new T.Mesh(new T.TorusGeometry(door / 2, 15, 8, 24, Math.PI), MAT.trim);
          arch.position.set(sd.x + at, h - 8, sd.z);
          scene.add(arch);
          const lit = new T.Mesh(new T.TorusGeometry(door / 2 - 6, 4, 6, 24, Math.PI), emissive(0x2ee6ff));
          lit.position.set(sd.x + at, h - 8, sd.z);
          scene.add(lit);
        } else {
          box(40, h, 26, MAT.trim, sd.x, h / 2, sd.z + at - door / 2);
          box(40, h, 26, MAT.trim, sd.x, h / 2, sd.z + at + door / 2);
          const arch = new T.Mesh(new T.TorusGeometry(door / 2, 15, 8, 24, Math.PI), MAT.trim);
          arch.position.set(sd.x, h - 8, sd.z + at);
          arch.rotation.y = Math.PI / 2;
          scene.add(arch);
          const lit = new T.Mesh(new T.TorusGeometry(door / 2 - 6, 4, 6, 24, Math.PI), emissive(0x2ee6ff));
          lit.position.set(sd.x, h - 8, sd.z + at);
          lit.rotation.y = Math.PI / 2;
          scene.add(lit);
        }
      }
    }

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) pillar(r.x + sx * (hw - 130), r.z + sz * (hd - 130), h, 30);
    }

    chandelier(r.x, h - 120, r.z, r.accent);
  }

  /* =====================================================================
     a cell of the crypt: three walls, a doorway, a lantern
     ===================================================================== */
  function buildCell(c) {
    const hw = c.w / 2, hd = c.d / 2, h = c.h;
    addFloor(c.x, c.z, c.w, c.d, 0.6, MAT.floorDark);
    const ceil = new T.Mesh(
      scaleUV(new T.PlaneGeometry(c.w, c.d), c.w / 240, c.d / 240),
      MAT.ceiling
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(c.x, h, c.z);
    scene.add(ceil);

    const sides = [
      { s: 'n', len: c.w, x: c.x, z: c.z - hd, ry: 0, along: 'x' },
      { s: 's', len: c.w, x: c.x, z: c.z + hd, ry: 0, along: 'x' },
      { s: 'w', len: c.d, x: c.x - hw, z: c.z, ry: Math.PI / 2, along: 'z' },
      { s: 'e', len: c.d, x: c.x + hw, z: c.z, ry: Math.PI / 2, along: 'z' }
    ];
    for (const sd of sides) {
      if (sd.s === c.door) {
        // set a step back from the corridor's own wall, so the two never
        // occupy the same plane and the doorway reads as a recess
        const door = 200, seg = (sd.len - door) / 2, off = door / 2 + seg / 2, t = 14;
        if (sd.along === 'x') {
          const z = sd.z + (sd.s === 'n' ? t : -t);
          dressedWall(sd.x - off, z, seg, h, 0);
          dressedWall(sd.x + off, z, seg, h, 0);
        } else {
          const x = sd.x + (sd.s === 'w' ? t : -t);
          dressedWall(x, sd.z - off, seg, h, Math.PI / 2);
          dressedWall(x, sd.z + off, seg, h, Math.PI / 2);
        }
      } else {
        dressedWall(sd.x, sd.z, sd.len, h, sd.ry);
      }
    }

    // a lantern of the cell's own colour, and the light it throws
    const lamp = new T.Mesh(new T.SphereGeometry(14, 12, 10), emissive(c.accent));
    lamp.position.set(c.x, h - 40, c.z);
    scene.add(lamp);
    const halo = glowSprite(hexOf(c.accent), 340, 0.32);
    halo.position.set(c.x, h - 40, c.z);
    scene.add(halo);
    tickers.push((t) => {
      const k = 1 + Math.sin(t * 1.7 + c.x) * 0.07;
      halo.scale.set(340 * k, 340 * k, 1);
    });
  }

  /* =====================================================================
     a sealed door: two slabs, a lock sigil, and the level it answers to
     ===================================================================== */
  function buildSeal(c, onOpen) {
    const hw = c.w / 2, hd = c.d / 2;
    const horiz = (c.door === 'n' || c.door === 's');   // door in a wall that runs along x
    const doorX = horiz ? c.x : (c.door === 'e' ? c.x + hw : c.x - hw);
    const doorZ = horiz ? (c.door === 's' ? c.z + hd : c.z - hd) : c.z;
    const half = 118;                                    // half the opening
    const group = new T.Group();
    group.position.set(doorX, 0, doorZ);
    if (!horiz) group.rotation.y = Math.PI / 2;
    scene.add(group);

    const panels = [];
    for (const s of [-1, 1]) {
      const p = new T.Mesh(
        scaleUV(new T.BoxGeometry(half, 250, 26), half / 180, 1.4),
        new T.MeshStandardMaterial({ map: MAT.wall.map, color: 0x5c6a8c, roughness: 0.9, metalness: 0.3 })
      );
      p.position.set(s * (half / 2), 125, 0);
      group.add(p);
      const band = new T.Mesh(new T.BoxGeometry(half - 12, 6, 32), emissive(c.accent));
      band.position.set(s * (half / 2), 200, 0);
      group.add(band);
      panels.push({ mesh: p, band, s });
    }

    // the lock: a rune sigil and the level it wants
    const lock = new T.Mesh(new T.TorusGeometry(30, 5, 8, 26), emissive(c.accent));
    lock.position.set(0, 150, 18);
    group.add(lock);
    const lockHalo = glowSprite(hexOf(c.accent), 200, 0.5);
    lockHalo.position.set(0, 150, 14);
    group.add(lockHalo);
    const need = label(c.admin ? 'STAFF ONLY' : (c.gems ? c.gems + ' GEMS' : 'LEVEL ' + (c.level || 1)), {
      size: 34, scale: 0.2, color: '#ffe9c4', glow: 'rgba(255,180,90,0.85)'
    });
    need.position.set(0, 236, 24);
    group.add(need);

    // what it is standing in the way of
    const solid = { x: doorX, z: doorZ, hw: horiz ? half : 16, hd: horiz ? 16 : half };
    walls.push(solid);

    let open = 0, target = 0;
    tickers.push((t, dt) => {
      lock.rotation.z = t * 0.8;
      if (open !== target) {
        open += (target - open) * Math.min(1, dt * 3.2);
        if (Math.abs(target - open) < 0.02) open = target;
        for (const p of panels) {
          p.mesh.position.x = p.s * (half / 2 + open * half * 0.92);
          p.band.position.x = p.mesh.position.x;
        }
        lockHalo.material.opacity = 0.5 * (1 - open);
        lock.visible = open < 0.9;
      }
    });

    return {
      group,
      setLocked(locked) {
        target = locked ? 0 : 1;
        const i = walls.indexOf(solid);
        if (!locked && i >= 0) walls.splice(i, 1);
        if (locked && i < 0) walls.push(solid);
        if (onOpen) onOpen(!locked);
      }
    };
  }

  /* =====================================================================
     props
     ===================================================================== */
  function pad(x, z, name, sub, act, accent, radius, locked) {
    const r = radius || 62;
    const g = new T.Group();
    const disc = new T.Mesh(new T.CylinderGeometry(r, r + 8, 14, 32), MAT.floorDark);
    disc.position.y = 7; g.add(disc);
    const rim = new T.Mesh(new T.TorusGeometry(r, 5, 8, 36), emissive(locked ? 0x3a4a66 : accent));
    rim.rotation.x = Math.PI / 2; rim.position.y = 15; g.add(rim);
    const inner = new T.Mesh(new T.TorusGeometry(r * 0.6, 2.5, 6, 30), emissive(locked ? 0x2a3550 : accent));
    inner.rotation.x = Math.PI / 2; inner.position.y = 15; g.add(inner);
    const halo = glowSprite(hexOf(accent), r * 4.8, locked ? 0.12 : 0.34);
    halo.position.y = 18; g.add(halo);
    g.position.set(x, 0, z);
    scene.add(g);

    const lb = label(name, { size: 40, scale: 0.25, color: locked ? '#8fa0b8' : '#eaf6ff' });
    lb.position.set(x, 158, z);
    scene.add(lb);
    if (sub) {
      const sb = label(sub, { size: 26, scale: 0.2, color: '#8fb0d0', glow: 'rgba(80,150,220,0.6)' });
      sb.position.set(x, 124, z);
      scene.add(sb);
    }

    tickers.push((t) => {
      const k = 1 + Math.sin(t * 2.2 + x * 0.01) * 0.05;
      halo.scale.set(r * 4.8 * k, r * 4.8 * k, 1);
      rim.scale.setScalar(1 + Math.sin(t * 3 + z * 0.01) * 0.03);
      inner.rotation.z = t * 0.4;
    });

    const item = { name, sub, x, z, act, locked: !!locked };
    items.push(item);
    return item;
  }

  // A plinth with the real fighter standing on it.
  function pedestal(x, z, design, modelName, unlocked, color, act) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    const base = new T.Mesh(new T.BoxGeometry(62, 64, 62), MAT.trim);
    base.position.y = 32; g.add(base);
    const rim = new T.Mesh(new T.BoxGeometry(70, 6, 70), emissive(unlocked ? 0x2ee6ff : 0x24344d));
    rim.position.y = 66; g.add(rim);
    scene.add(g);
    solids.push({ x, z, r: 34 });

    let avatar = null;
    if (G.HubAvatar) {
      avatar = G.HubAvatar.build(design, color, { r: 26 });
      avatar.group.position.set(x, 76, z);
      if (!unlocked) avatar.group.visible = false;
      scene.add(avatar.group);
      tickers.push((t) => { avatar.update(t); });
    }
    if (!unlocked) {
      const shade = glowSprite('#5f7fa8', 90, 0.3);
      shade.position.set(x, 130, z);
      scene.add(shade);
    }

    const lb = label(modelName, { size: 28, scale: 0.2, color: unlocked ? '#e6f2ff' : '#7c8ba4' });
    lb.position.set(x, 186, z);
    scene.add(lb);

    items.push({
      name: unlocked ? modelName : 'Locked model',
      sub: unlocked ? 'Wear it now' : 'Win more waves to unlock',
      x, z, act, locked: !unlocked
    });
  }

  function dummy(x, z) {
    const g = new T.Group();
    const post = new T.Mesh(new T.CylinderGeometry(6, 10, 30, 10), MAT.iron);
    post.position.y = 15; g.add(post);
    const body = new T.Mesh(new T.CylinderGeometry(30, 38, 120, 14), MAT.floorDark);
    body.position.y = 90; g.add(body);
    const head = new T.Mesh(new T.SphereGeometry(30, 16, 14), MAT.trim);
    head.position.y = 172; g.add(head);
    for (let i = 0; i < 3; i++) {
      const ring = new T.Mesh(new T.TorusGeometry(34 - i * 2, 3.5, 6, 24), emissive(0xff5a7a));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 60 + i * 34;
      g.add(ring);
    }
    const halo = glowSprite('#ff5a7a', 220, 0.28);
    halo.position.y = 110; g.add(halo);
    g.position.set(x, 0, z);
    scene.add(g);
    solids.push({ x, z, r: 48 });
    tickers.push((t) => { g.rotation.y = Math.sin(t * 0.6 + x) * 0.5; });
    return g;
  }

  // The figure who keeps a sealed cell: a hooded warden over a stone plinth.
  function warden(c) {
    const g = new T.Group();
    const robe = new T.Mesh(
      new T.ConeGeometry(34, 110, 12),
      new T.MeshStandardMaterial({ color: 0x121a2c, roughness: 0.9, metalness: 0.2, emissive: 0x0a1830 })
    );
    robe.position.y = 55; g.add(robe);
    const hood = new T.Mesh(new T.SphereGeometry(26, 16, 12),
      new T.MeshStandardMaterial({ color: 0x1a2438, roughness: 0.85, metalness: 0.25 }));
    hood.position.y = 122; g.add(hood);
    const face = glowSprite(hexOf(c.accent), 66, 0.75);
    face.position.set(0, 120, 20);
    g.add(face);
    const staff = new T.Mesh(new T.CylinderGeometry(3, 4, 150, 8), MAT.iron);
    staff.position.set(30, 75, 6);
    g.add(staff);
    const orb = new T.Mesh(new T.SphereGeometry(11, 12, 10), emissive(c.accent));
    orb.position.set(30, 156, 6);
    g.add(orb);
    const halo = glowSprite(hexOf(c.accent), 190, 0.34);
    halo.position.y = 110;
    g.add(halo);
    g.position.set(c.x, 0, c.z);
    scene.add(g);
    solids.push({ x: c.x, z: c.z, r: 40 });
    tickers.push((t) => {
      orb.position.y = 156 + Math.sin(t * 1.6) * 6;
      halo.material.opacity = 0.28 + Math.sin(t * 1.9) * 0.08;
    });
    return g;
  }

  // A human on a plinth — the staff-only exhibit.
  function human(x, z, name, accent) {
    const g = new T.Group();
    const skin = new T.MeshStandardMaterial({ color: 0xd9b49a, roughness: 0.7, metalness: 0.05 });
    const cloth = new T.MeshStandardMaterial({ color: 0x2a3a58, roughness: 0.8, metalness: 0.2 });
    const torso = new T.Mesh(new T.CylinderGeometry(20, 17, 74, 14), cloth);
    torso.position.y = 108; g.add(torso);
    const head = new T.Mesh(new T.SphereGeometry(17, 16, 14), skin);
    head.position.y = 160; g.add(head);
    for (const s of [-1, 1]) {
      const leg = new T.Mesh(new T.CylinderGeometry(8, 7, 62, 10), cloth);
      leg.position.set(s * 10, 40, 0); g.add(leg);
      const arm = new T.Mesh(new T.CylinderGeometry(7, 6, 56, 10), skin);
      arm.position.set(s * 26, 112, 0);
      arm.rotation.z = s * 0.16;
      g.add(arm);
    }
    const plinth = new T.Mesh(new T.CylinderGeometry(34, 40, 16, 20), MAT.trim);
    plinth.position.y = 8; g.add(plinth);
    const halo = glowSprite(hexOf(accent), 230, 0.3);
    halo.position.y = 110; g.add(halo);
    g.position.set(x, 0, z);
    scene.add(g);
    solids.push({ x, z, r: 40 });
    const lb = label(name, { size: 26, scale: 0.19, color: '#ffe9c4' });
    lb.position.set(x, 210, z);
    scene.add(lb);
    tickers.push((t) => { g.rotation.y = Math.sin(t * 0.4 + x * 0.01) * 0.35; });
    return g;
  }

  /* =====================================================================
     the sign over the hall — the arena's own name, cut in stone and light
     ===================================================================== */
  function logoTexture() {
    const W = 1024, H = 384, c = canvasOf(W, H), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0e1a2c'); g.addColorStop(0.55, '#0a1220'); g.addColorStop(1, '#05080f');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    // an old stone bevel, then the light inlaid in it
    x.strokeStyle = 'rgba(150,190,240,0.22)'; x.lineWidth = 14; x.strokeRect(9, 9, W - 18, H - 18);
    x.strokeStyle = 'rgba(34,230,255,0.55)'; x.lineWidth = 3; x.strokeRect(30, 30, W - 60, H - 60);
    x.strokeStyle = 'rgba(255,190,90,0.35)'; x.lineWidth = 1; x.strokeRect(42, 42, W - 84, H - 84);

    // two crossed blades, worn into the stone behind the letters
    x.strokeStyle = 'rgba(160,210,255,0.20)'; x.lineWidth = 9;
    x.beginPath(); x.moveTo(110, 340); x.lineTo(330, 44); x.moveTo(914, 340); x.lineTo(694, 44); x.stroke();
    x.lineWidth = 6;
    x.beginPath(); x.moveTo(84, 300); x.lineTo(150, 356); x.moveTo(940, 300); x.lineTo(874, 356); x.stroke();

    // corner runes
    const rune = (cx, cy, s) => {
      x.strokeStyle = 'rgba(140,220,255,0.6)'; x.lineWidth = 3;
      x.beginPath();
      x.moveTo(cx - s, cy - s); x.lineTo(cx + s, cy - s);
      x.lineTo(cx - s, cy + s); x.lineTo(cx + s, cy + s);
      x.closePath(); x.stroke();
    };
    rune(64, 64, 12); rune(W - 64, 64, 12); rune(64, H - 64, 12); rune(W - 64, H - 64, 12);

    x.textAlign = 'center'; x.textBaseline = 'middle';

    x.font = '900 148px Cinzel, Georgia, serif';
    x.shadowColor = 'rgba(34,230,255,0.95)'; x.shadowBlur = 70;
    const t1 = x.createLinearGradient(0, 40, 0, 220);
    t1.addColorStop(0, '#ffffff'); t1.addColorStop(0.5, '#dff2ff'); t1.addColorStop(1, '#57c6ff');
    x.fillStyle = t1;
    x.fillText('MONSTER', W / 2, 146);

    x.font = '900 108px Cinzel, Georgia, serif';
    x.shadowColor = 'rgba(255,175,80,0.9)'; x.shadowBlur = 60;
    const t2 = x.createLinearGradient(0, 210, 0, 330);
    t2.addColorStop(0, '#ffeec4'); t2.addColorStop(1, '#ff9a3c');
    x.fillStyle = t2;
    x.fillText('A R E N A', W / 2, 282);

    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    return tex;
  }

  // A banner hung over the middle of the rotunda, turning slowly on its chains.
  function buildLogo(x, y, z) {
    const g = new T.Group();
    g.position.set(x, y, z);

    const W = 720, H = 270;
    const slab = new T.Mesh(new T.BoxGeometry(W + 26, H + 26, 12), MAT.wallDark);
    slab.position.z = -8;
    g.add(slab);

    const face = new T.Mesh(
      new T.PlaneGeometry(W, H),
      new T.MeshBasicMaterial({ map: logoTexture(), transparent: true, side: T.DoubleSide })
    );
    face.position.z = 1;
    g.add(face);

    const halo = glowSprite('#3fd8ff', 940, 0.3);
    halo.position.z = -16;
    g.add(halo);

    for (const s of [-1, 1]) {
      const chain = new T.Mesh(new T.CylinderGeometry(3, 3, 160, 6), MAT.iron);
      chain.position.set(s * (W / 2 - 70), H / 2 + 76, 0);
      g.add(chain);
    }

    scene.add(g);
    tickers.push((t) => {
      g.rotation.y = Math.sin(t * 0.28) * 0.045;
      g.position.y = y + Math.sin(t * 0.5) * 4;
      halo.material.opacity = 0.24 + Math.sin(t * 0.9) * 0.08;
    });
    return g;
  }

  /* ---------- the old world: fire, statues, and what it left lying ------ */
  function brazier(x, z) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    const foot = new T.Mesh(new T.CylinderGeometry(30, 38, 14, 12), MAT.trim);
    foot.position.y = 7; g.add(foot);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      const leg = new T.Mesh(new T.CylinderGeometry(4, 5, 74, 6), MAT.iron);
      leg.position.set(Math.cos(a) * 20, 44, Math.sin(a) * 20);
      leg.rotation.z = Math.cos(a) * 0.16;
      leg.rotation.x = -Math.sin(a) * 0.16;
      g.add(leg);
    }
    const bowl = new T.Mesh(new T.CylinderGeometry(46, 26, 34, 16, 1, true), MAT.iron);
    bowl.position.y = 96; g.add(bowl);
    const coals = new T.Mesh(new T.CircleGeometry(42, 18), emissive(0xff8a3c));
    coals.rotation.x = -Math.PI / 2; coals.position.y = 100; g.add(coals);

    const flames = [];
    for (let i = 0; i < 5; i++) {
      const f = new T.Mesh(new T.ConeGeometry(16 - i * 2, 46 + i * 8, 7),
        new T.MeshBasicMaterial({
          color: i % 2 ? 0xffd166 : 0xff7a3c, transparent: true, opacity: 0.5 - i * 0.06,
          blending: T.AdditiveBlending, depthWrite: false
        }));
      f.position.set((Math.random() - 0.5) * 22, 130 + i * 10, (Math.random() - 0.5) * 22);
      g.add(f);
      flames.push(f);
    }
    const halo = glowSprite('#ff9a3c', 320, 0.4);
    halo.position.y = 130; g.add(halo);

    scene.add(g);
    solids.push({ x, z, r: 44 });
    tickers.push((t) => {
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i];
        f.scale.y = 1 + Math.sin(t * (5 + i) + i) * 0.22;
        f.position.x = Math.sin(t * 2.4 + i * 2) * 8;
      }
      halo.material.opacity = 0.34 + Math.sin(t * 6) * 0.06;
    });
    return g;
  }

  // A warrior of the old arena, standing where the builders left him.
  function statue(x, z, ry, accent) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    const plinth = new T.Mesh(new T.BoxGeometry(96, 46, 96), MAT.trim);
    plinth.position.y = 23; g.add(plinth);
    const plinth2 = new T.Mesh(new T.BoxGeometry(78, 18, 78), MAT.wallDark);
    plinth2.position.y = 55; g.add(plinth2);
    const stone = new T.MeshStandardMaterial({ color: 0x46557a, roughness: 0.95, metalness: 0.1 });
    const legs = new T.Mesh(new T.CylinderGeometry(24, 30, 96, 10), stone);
    legs.position.y = 112; g.add(legs);
    const torso = new T.Mesh(new T.CylinderGeometry(30, 24, 92, 10), stone);
    torso.position.y = 202; g.add(torso);
    const head = new T.Mesh(new T.SphereGeometry(22, 14, 12), stone);
    head.position.y = 262; g.add(head);
    for (const s of [-1, 1]) {
      const horn = new T.Mesh(new T.ConeGeometry(7, 42, 8), stone);
      horn.position.set(s * 20, 288, 0);
      horn.rotation.z = -s * 0.5;
      g.add(horn);
    }
    const blade = new T.Mesh(new T.BoxGeometry(9, 150, 20), MAT.iron);
    blade.position.set(0, 200, 40);
    blade.rotation.x = 0.12;
    g.add(blade);
    const guard = new T.Mesh(new T.BoxGeometry(52, 8, 14), MAT.iron);
    guard.position.set(0, 280, 40); g.add(guard);
    const rune = new T.Mesh(new T.TorusGeometry(34, 4, 6, 22), emissive(accent || 0x2ee6ff));
    rune.position.set(0, 200, -34); g.add(rune);
    const halo = glowSprite(hexOf(accent || 0x2ee6ff), 260, 0.16);
    halo.position.y = 200; g.add(halo);

    scene.add(g);
    solids.push({ x, z, r: 58 });
    tickers.push((t) => { rune.rotation.z = t * 0.5; });
    return g;
  }

  // A gem the old builders left behind: a cut stone standing in its own
  // shaft of light, with the fire of it showing through the facets.
  function gem(x, z, accent) {
    const col = accent || 0x7dffd0;
    const g = new T.Group();
    g.position.set(x, 62, z);

    const body = new T.Mesh(
      new T.OctahedronGeometry(20, 0),
      new T.MeshStandardMaterial({
        color: 0xffffff, emissive: col, emissiveIntensity: 0.5,
        roughness: 0.05, metalness: 0.15, flatShading: true,
        transparent: true, opacity: 0.9
      })
    );
    body.scale.set(0.72, 1.3, 0.72);
    g.add(body);

    const core = new T.Mesh(new T.IcosahedronGeometry(8, 0), new T.MeshBasicMaterial({ color: col }));
    g.add(core);

    const edges = new T.LineSegments(
      new T.EdgesGeometry(body.geometry),
      new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
    );
    edges.scale.copy(body.scale);
    g.add(edges);

    const shaft = new T.Mesh(new T.ConeGeometry(17, 240, 12, 1, true),
      new T.MeshBasicMaterial({
        color: col, transparent: true, opacity: 0.15,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      }));
    shaft.position.y = 108;
    g.add(shaft);

    const halo = glowSprite(hexOf(col), 170, 0.6);
    g.add(halo);

    const pool = new T.Mesh(new T.CircleGeometry(48, 24),
      new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = -60;
    g.add(pool);

    const sparks = [];
    for (let i = 0; i < 6; i++) {
      const s = glowSprite('#ffffff', 14, 0.85);
      g.add(s);
      sparks.push(s);
    }

    scene.add(g);
    tickers.push((t) => {
      g.rotation.y = t * 0.9;
      g.position.y = 62 + Math.sin(t * 1.6 + x * 0.01) * 8;
      body.material.emissiveIntensity = 0.42 + Math.sin(t * 2.4 + z * 0.01) * 0.2;
      halo.material.opacity = 0.5 + Math.sin(t * 3) * 0.14;
      pool.material.opacity = 0.16 + Math.sin(t * 2.2) * 0.06;
      for (let i = 0; i < sparks.length; i++) {
        const a = t * 1.5 + (i / sparks.length) * TAU;
        sparks[i].position.set(Math.cos(a) * 31, Math.sin(t * 2 + i * 1.3) * 13, Math.sin(a) * 31);
      }
    });
    return g;
  }

  /* =====================================================================
     the upper deck — a balcony over the north half of the rotunda
     ===================================================================== */
  function buildGallery(GAL) {
    const y = GAL.y;
    const a0 = 0.62, alen = Math.PI - 1.24;

    const deck = new T.Mesh(new T.CircleGeometry(434, 64, a0, alen), MAT.floorDark);
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = y;
    scene.add(deck);

    // the edge beam, and the parapet with a gap where each flight arrives
    box(810, 46, 22, MAT.trim, 0, y - 23, -250);
    box(810, 5, 26, emissive(0x2ee6ff), 0, y + 3, -250);
    const runs = [[-405, -345], [-215, 215], [345, 405]];
    for (const r of runs) {
      const len = r[1] - r[0];
      box(len, 46, 16, MAT.wallDark, (r[0] + r[1]) / 2, y + 23, -250);
      box(len, 5, 20, emissive(0x2ee6ff), (r[0] + r[1]) / 2, y + 48, -250);
    }
    for (let x = -390; x <= 390; x += 65) {
      if (Math.abs(Math.abs(x) - 280) < 80) continue;
      const post = new T.Mesh(new T.CylinderGeometry(7, 9, 52, 8), MAT.trim);
      post.position.set(x, y + 26, -250);
      scene.add(post);
    }

    // two flights up from the floor
    for (const st of GAL.stairs) {
      const steps = 19;
      for (let i = 0; i < steps; i++) {
        const z = 130 - (i + 0.5) * 20;
        const h = (i + 1) * 10;
        box(130, h, 20, i % 2 ? MAT.wallDark : MAT.trim, st.x, h / 2, z);
        box(126, 4, 4, emissive(0x2ee6ff), st.x, h - 2, z + 8);
      }
      for (const s of [-1, 1]) {
        const rail = new T.Mesh(new T.BoxGeometry(7, 7, 400), MAT.iron);
        rail.position.set(st.x + s * 68, y / 2 + 52, -60);
        rail.rotation.x = Math.atan2(y, 380);
        scene.add(rail);
        for (let i = 0; i < 7; i++) {
          const z = 120 - i * 62;
          const h = Math.max(20, (130 - z) / 380 * y + 46);
          const p = new T.Mesh(new T.CylinderGeometry(4, 4, 46, 6), MAT.iron);
          p.position.set(st.x + s * 68, h, z);
          scene.add(p);
        }
      }
    }

    // a low light strip under the deck so it reads from the floor
    box(760, 6, 12, emissive(0x1f7fd0), 0, y - 52, -262);
    return deck;
  }

  /* =====================================================================
     a glowing doorway: stone frame, swirling light, and where it leads
     ===================================================================== */
  function portal(x, z, y, accent) {
    const g = new T.Group();
    g.position.set(x, y || 0, z);
    const col = accent || 0x9fd8ff;

    for (const s of [-1, 1]) {
      const jamb = new T.Mesh(new T.BoxGeometry(26, 230, 30), MAT.trim);
      jamb.position.set(s * 92, 115, 0);
      g.add(jamb);
      const lit = new T.Mesh(new T.BoxGeometry(6, 210, 34), emissive(col));
      lit.position.set(s * 78, 115, 0);
      g.add(lit);
    }
    const crown = new T.Mesh(new T.TorusGeometry(92, 15, 8, 26, Math.PI), MAT.trim);
    crown.position.y = 228;
    g.add(crown);
    const crownLit = new T.Mesh(new T.TorusGeometry(80, 5, 6, 26, Math.PI), emissive(col));
    crownLit.position.y = 228;
    g.add(crownLit);

    // the surface itself: two rune discs turning against each other
    const discA = new T.Mesh(new T.CircleGeometry(86, 40),
      new T.MeshBasicMaterial({ map: MAT.rune, color: col, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
    discA.position.y = 112;
    g.add(discA);
    const discB = new T.Mesh(new T.CircleGeometry(64, 32),
      new T.MeshBasicMaterial({ map: MAT.rune, color: 0xffffff, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false }));
    discB.position.set(0, 112, 6);
    g.add(discB);
    const core = glowSprite(hexOf(col), 260, 0.5);
    core.position.y = 112;
    g.add(core);

    // the light spilling out onto the deck
    const spill = new T.Mesh(new T.CircleGeometry(120, 24),
      new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, blending: T.AdditiveBlending, depthWrite: false }));
    spill.rotation.x = -Math.PI / 2;
    spill.position.y = 2;
    g.add(spill);

    scene.add(g);
    // It only stands in the way of someone on its own level.
    solids.push({ x, z, r: 70, y: y || 0 });
    tickers.push((t) => {
      discA.rotation.z = t * 0.35;
      discB.rotation.z = -t * 0.55;
      core.material.opacity = 0.4 + Math.sin(t * 2.2 + x) * 0.12;
    });
    return g;
  }

  /* =====================================================================
     the practice range — boards that hold, silhouettes that pace
     ===================================================================== */
  const hittables = [];

  function targetBoard(x, z, ry, accent) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    const col = accent || 0xff7a5c;
    const stand = new T.Mesh(new T.BoxGeometry(14, 96, 14), MAT.iron);
    stand.position.y = 48; g.add(stand);
    const foot = new T.Mesh(new T.BoxGeometry(54, 10, 40), MAT.trim);
    foot.position.y = 5; g.add(foot);
    const face = new T.Mesh(new T.CircleGeometry(56, 26),
      new T.MeshStandardMaterial({ color: 0x18202f, roughness: 0.85, metalness: 0.2 }));
    face.position.y = 150;
    face.rotation.x = 0;
    g.add(face);
    for (let i = 0; i < 3; i++) {
      const ring = new T.Mesh(new T.TorusGeometry(50 - i * 15, 3.4, 6, 26), emissive(i === 1 ? 0xeaf6ff : col));
      ring.position.set(0, 150, 2);
      g.add(ring);
    }
    const bull = new T.Mesh(new T.CircleGeometry(7, 16), emissive(0xffd166));
    bull.position.set(0, 150, 4);
    g.add(bull);
    const hit = glowSprite(hexOf(0xffffff), 210, 0);
    hit.position.set(0, 150, 8);
    g.add(hit);

    scene.add(g);
    solids.push({ x, z, r: 40 });
    hittables.push({
      mesh: face, glow: hit,
      strike() { hit.material.opacity = 0.9; },
      tick(dt) { if (hit.material.opacity > 0) hit.material.opacity = Math.max(0, hit.material.opacity - dt * 2.2); }
    });
    tickers.push((t, dt) => {
      if (hit.material.opacity > 0) hit.material.opacity = Math.max(0, hit.material.opacity - dt * 2.2);
    });
    return g;
  }

  function silhouette(x, z, opts) {
    const o = opts || {};
    const g = new T.Group();
    g.position.set(x, 0, z);
    const col = o.accent || 0xc066ff;
    const body = new T.Mesh(new T.ConeGeometry(40, 120, 7),
      new T.MeshStandardMaterial({ color: 0x0b0f18, roughness: 0.9, metalness: 0.3, emissive: 0x120a20 }));
    body.position.y = 78; g.add(body);
    const head = new T.Mesh(new T.IcosahedronGeometry(22, 0),
      new T.MeshStandardMaterial({ color: 0x141a28, roughness: 0.85, metalness: 0.3, flatShading: true }));
    head.position.y = 152; g.add(head);
    for (const s of [-1, 1]) {
      const horn = new T.Mesh(new T.ConeGeometry(6, 30, 6), emissive(col));
      horn.position.set(s * 14, 172, 0);
      horn.rotation.z = -s * 0.42;
      g.add(horn);
      const arm = new T.Mesh(new T.CylinderGeometry(7, 4, 76, 6),
        new T.MeshStandardMaterial({ color: 0x0d121c, roughness: 0.9, metalness: 0.3 }));
      arm.position.set(s * 34, 92, 0);
      arm.rotation.z = s * 0.5;
      g.add(arm);
    }
    for (const s of [-1, 1]) {
      const eye = glowSprite(hexOf(col), 34, 0.95);
      eye.position.set(s * 8, 152, 20);
      g.add(eye);
    }
    const aura = glowSprite(hexOf(col), 240, 0.2);
    aura.position.y = 100; g.add(aura);
    scene.add(g);

    const base = x, range = o.range || 300, speed = o.speed || 0.45, phase = o.phase || 0;
    tickers.push((t) => {
      g.position.x = base + Math.sin(t * speed + phase) * range;
      g.position.y = Math.abs(Math.sin(t * speed * 2 + phase)) * 8;
      g.rotation.y = Math.sin(t * speed + phase) * 0.35;
      aura.material.opacity = 0.16 + Math.sin(t * 2.4 + phase) * 0.06;
    });
    hittables.push({ mesh: body, glow: aura, strike() { aura.material.opacity = 0.8; } });
    return g;
  }

  /* =====================================================================
     the rank, hanging in the air of the hall of renown
     ===================================================================== */
  function rankEmblem(x, z, lvl, accent) {
    const col = accent || 0xffd166;
    const g = new T.Group();
    g.position.set(x, 0, z);

    const plinth = new T.Mesh(new T.CylinderGeometry(78, 96, 26, 24), MAT.trim);
    plinth.position.y = 13; g.add(plinth);
    const ring = new T.Mesh(new T.TorusGeometry(82, 5, 8, 40), emissive(col));
    ring.rotation.x = Math.PI / 2; ring.position.y = 28; g.add(ring);

    const float = new T.Group();
    float.position.y = 210;
    const outer = new T.Mesh(new T.TorusGeometry(96, 5, 8, 48), emissive(col));
    float.add(outer);
    const outer2 = new T.Mesh(new T.TorusGeometry(96, 5, 8, 48), emissive(col));
    outer2.rotation.x = Math.PI / 2; float.add(outer2);
    const inner = new T.Mesh(new T.TorusGeometry(66, 3, 6, 36), emissive(0x9fe3ff));
    inner.rotation.x = Math.PI / 3; float.add(inner);
    const disc = new T.Mesh(new T.CircleGeometry(62, 32),
      new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.14, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    float.add(disc);
    const num = label(String(lvl), { size: 120, scale: 0.34, color: '#fff6dd', glow: 'rgba(255,190,90,0.95)' });
    float.add(num);
    const title = label('RANK', { size: 34, scale: 0.2, color: '#ffe9c4', glow: 'rgba(255,190,90,0.8)' });
    title.position.y = 88;
    float.add(title);
    const halo = glowSprite(hexOf(col), 620, 0.35);
    float.add(halo);
    g.add(float);

    // the beam it rides on
    const beam = new T.Mesh(new T.CylinderGeometry(58, 96, 190, 20, 1, true),
      new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.09, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    beam.position.y = 120; g.add(beam);

    scene.add(g);
    solids.push({ x, z, r: 96 });
    tickers.push((t) => {
      float.rotation.y = t * 0.42;
      outer.rotation.z = t * 0.5;
      inner.rotation.z = -t * 0.7;
      float.position.y = 210 + Math.sin(t * 0.9) * 10;
      halo.material.opacity = 0.28 + Math.sin(t * 1.6) * 0.08;
      num.material.opacity = 0.9 + Math.sin(t * 2.2) * 0.1;
    });
    return g;
  }

  /* =====================================================================
     the kit itself, turning on a plinth
     ===================================================================== */
  function modelPlinth(x, z, kind, index, accent, name) {
    const col = accent || 0x9fd8ff;
    const g = new T.Group();
    g.position.set(x, 0, z);

    const base = new T.Mesh(new T.CylinderGeometry(52, 64, 20, 18), MAT.trim);
    base.position.y = 10; g.add(base);
    const shaft = new T.Mesh(new T.CylinderGeometry(26, 34, 74, 14), MAT.wallDark);
    shaft.position.y = 56; g.add(shaft);
    const top = new T.Mesh(new T.CylinderGeometry(44, 30, 14, 18), MAT.trim);
    top.position.y = 100; g.add(top);
    const rim = new T.Mesh(new T.TorusGeometry(44, 3.4, 6, 26), emissive(col));
    rim.rotation.x = Math.PI / 2; rim.position.y = 108; g.add(rim);

    const halo = glowSprite(hexOf(col), 330, 0.34);
    halo.position.y = 190; g.add(halo);
    const shaftLight = new T.Mesh(new T.CylinderGeometry(40, 62, 150, 16, 1, true),
      new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.07, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    shaftLight.position.y = 186; g.add(shaftLight);

    let model = null;
    if (G.HubModels && G.HubModels.build) {
      model = G.HubModels.build(kind, index, col);
      model.position.y = 186;
      if (kind === 'guns') model.scale.setScalar(1.35);
      else if (kind === 'blades') model.scale.setScalar(1.15);
      g.add(model);
    }
    scene.add(g);
    solids.push({ x, z, r: 62 });

    const lb = label(name, { size: 28, scale: 0.19, color: '#e6f2ff' });
    lb.position.set(x, 292, z);
    scene.add(lb);

    tickers.push((t) => {
      if (model) {
        model.rotation.y = t * 0.5 + index;
        model.position.y = 186 + Math.sin(t * 1.1 + index) * 6;
      }
      halo.material.opacity = 0.28 + Math.sin(t * 1.8 + index) * 0.08;
    });
    return g;
  }

  /* =====================================================================
     the holographic board
     Two standings on one pane of light: the deepest wave anyone has cleared
     and the most monsters anyone has put down. The developer account's
     admin-assisted runs are dropped before a single row is drawn.
     ===================================================================== */
  function leaderboard(x, z, rotY) {
    const W = 640, H = 760;
    const cv = canvasOf(W, H);
    const ctx = cv.getContext('2d');
    const tex = new T.CanvasTexture(cv);
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY || 0;

    // the stand it is projected from
    const base = new T.Mesh(new T.CylinderGeometry(58, 74, 16, 20), MAT.trim);
    base.position.y = 8; g.add(base);
    const post = new T.Mesh(new T.CylinderGeometry(16, 22, 92, 12), MAT.wallDark);
    post.position.y = 54; g.add(post);

    // the light the pane is made of
    const halo = new T.Mesh(new T.PlaneGeometry(340, 396),
      new T.MeshBasicMaterial({ color: 0x22e6ff, transparent: true, opacity: 0.1, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    halo.position.set(0, 258, -2.5); g.add(halo);

    const pane = new T.Mesh(new T.PlaneGeometry(300, 356),
      new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.94, depthWrite: false, side: T.DoubleSide }));
    pane.position.y = 258; g.add(pane);

    // two thin rails, so the pane reads as a frame rather than a poster
    for (const sx of [-1, 1]) {
      const rail = new T.Mesh(new T.BoxGeometry(4, 360, 4), emissive(0x22e6ff));
      rail.position.set(sx * 154, 258, 0); g.add(rail);
    }
    const glow = glowSprite('#22e6ff', 420, 0.3);
    glow.position.y = 258; g.add(glow);

    scene.add(g);
    solids.push({ x, z, r: 60 });

    function paint(rows) {
      const list = (Array.isArray(rows) ? rows : []).filter((r) => r && !r.staff);
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, 'rgba(10,26,42,0.94)');
      bg.addColorStop(1, 'rgba(4,10,20,0.97)');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(34,230,255,0.05)';
      for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
      ctx.strokeStyle = 'rgba(34,230,255,0.55)'; ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, W - 12, H - 12);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#eafcff';
      ctx.font = '700 40px Cinzel, Georgia, serif';
      ctx.fillText('HALL OF RENOWN', W / 2, 66);
      ctx.fillStyle = 'rgba(159,210,255,0.85)';
      ctx.font = '600 17px system-ui, sans-serif';
      ctx.fillText('DEEPEST WAVES   ·   MOST KILLS', W / 2, 96);
      ctx.strokeStyle = 'rgba(34,230,255,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(30, 116); ctx.lineTo(W - 30, 116); ctx.stroke();

      const waves = list.slice().sort((a, b) => (b.wave || 0) - (a.wave || 0)).slice(0, 5);
      const kills = list.slice().sort((a, b) => (b.kills || 0) - (a.kills || 0)).slice(0, 5);

      const column = (title, items, valueOf, x0) => {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#7dffa3';
        ctx.font = '700 18px system-ui, sans-serif';
        ctx.fillText(title, x0, 154);
        if (!items.length) {
          ctx.fillStyle = 'rgba(180,205,235,0.6)';
          ctx.font = '500 18px system-ui, sans-serif';
          ctx.fillText('no records yet', x0, 200);
          return;
        }
        items.forEach((r, i) => {
          const y = 202 + i * 106;
          ctx.fillStyle = i === 0 ? 'rgba(34,230,255,0.13)' : 'rgba(120,180,255,0.06)';
          ctx.fillRect(x0 - 10, y - 34, 272, 86);
          ctx.fillStyle = i === 0 ? '#ffd166' : 'rgba(180,215,255,0.85)';
          ctx.font = '800 26px Cinzel, Georgia, serif';
          ctx.fillText(String(i + 1), x0 + 2, y);
          ctx.fillStyle = '#f2f9ff';
          ctx.font = '700 22px system-ui, sans-serif';
          ctx.fillText(String(r.name || 'Fighter').slice(0, 13), x0 + 34, y);
          ctx.fillStyle = 'rgba(159,210,255,0.85)';
          ctx.font = '600 15px system-ui, sans-serif';
          ctx.fillText('RANK ' + (Number(r.rank) || 1), x0 + 34, y + 26);
          ctx.fillStyle = '#22e6ff';
          ctx.font = '800 24px system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(String(valueOf(r)), x0 + 250, y);
          ctx.textAlign = 'left';
        });
      };
      column('WAVES', waves, (r) => Number(r.wave) || 0, 34);
      column('KILLS', kills, (r) => Number(r.kills) || 0, 332);
    }
    paint([]);

    tickers.push((t) => {
      g.position.y = Math.sin(t * 0.9) * 2.2;
      halo.material.opacity = 0.08 + Math.sin(t * 1.6) * 0.03;
      glow.material.opacity = 0.24 + Math.sin(t * 1.6 + 1) * 0.06;
    });

    return {
      group: g,
      setRecords(rows) { paint(rows); tex.needsUpdate = true; }
    };
  }

  G.HubWorld = {
    init, MAT, hexOf, hittables, leaderboard,
    label, glowSprite, pad, pedestal, dummy, warden, human,
    buildRotunda, buildHall, buildPassage, buildCell, buildSeal, blockSolid,
    addFloor, buildLogo, brazier, statue, gem,
    buildGallery, portal, targetBoard, silhouette, rankEmblem, modelPlinth
  };
})(window);
