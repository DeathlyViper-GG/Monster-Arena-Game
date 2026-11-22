/* =====================================================================
   hub_models.js — the real kit, standing in its room.

   The gunsmith, the orb chamber and the hall of blades each hold the
   actual hardware on plinths, turning slowly in their own light. Every
   piece is built from primitives with flat shading, so it reads as the
   same world the arena is made of and costs no downloads.
   ===================================================================== */
(function (G) {
  'use strict';

  const T = G.THREE;
  if (!T) return;

  const cache = {};
  function mat(color, rough, metal, emissive) {
    const key = color + '|' + rough + '|' + metal + '|' + (emissive || 0);
    if (!cache[key]) {
      cache[key] = new T.MeshStandardMaterial({
        color, roughness: rough, metalness: metal,
        emissive: emissive || 0x000000,
        emissiveIntensity: emissive ? 0.85 : 0,
        flatShading: true
      });
    }
    return cache[key];
  }

  const STEEL = () => mat(0xa8bcd4, 0.32, 0.95);
  const DARK = () => mat(0x28354c, 0.5, 0.85);
  const GOLD = () => mat(0xd8a75a, 0.28, 1);
  const WOOD = () => mat(0x6a4023, 0.88, 0.08);
  const BONE = () => mat(0xd8cbb4, 0.75, 0.1);
  const HOT = (c) => mat(c, 0.25, 0.4, c);

  function box(g, w, h, d, m, x, y, z, rx, ry, rz) {
    const o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
    o.position.set(x || 0, y || 0, z || 0);
    if (rx) o.rotation.x = rx;
    if (ry) o.rotation.y = ry;
    if (rz) o.rotation.z = rz;
    g.add(o);
    return o;
  }

  function cyl(g, rt, rb, h, m, x, y, z, seg) {
    const o = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 12), m);
    o.position.set(x || 0, y || 0, z || 0);
    g.add(o);
    return o;
  }

  /* ---------- firearms -------------------------------------------------- */
  function pistol(accent) {
    const g = new T.Group();
    box(g, 9, 9, 38, STEEL(), 0, 0, -6);
    box(g, 7, 5, 30, DARK(), 0, -6, -6);
    cyl(g, 3.4, 3.4, 22, DARK(), 0, 1.5, -26).rotation.x = Math.PI / 2;
    box(g, 11, 22, 12, DARK(), 0, -15, 8, 0.22);
    box(g, 6, 5, 14, GOLD(), 0, -26, 12, 0.22);
    const dot = box(g, 2.6, 2.6, 2.6, HOT(accent || 0x9fe3ff), 0, 6, -28);
    dot.material = HOT(accent || 0x9fe3ff);
    return g;
  }

  function rifle(accent) {
    const g = new T.Group();
    box(g, 8, 10, 62, STEEL(), 0, 0, -12);
    cyl(g, 3, 3, 42, DARK(), 0, 1, -58).rotation.x = Math.PI / 2;
    box(g, 7, 16, 16, DARK(), 0, -12, 2, 0.16);
    box(g, 7, 22, 12, WOOD(), 0, -6, 26, -0.1);
    box(g, 10, 8, 16, WOOD(), 0, 1, 34);
    cyl(g, 4.5, 4.5, 18, DARK(), 0, 11, -14).rotation.x = Math.PI / 2;
    box(g, 5, 3, 10, HOT(accent || 0x9fe3ff), 0, 15, -14);
    box(g, 3, 14, 6, STEEL(), 0, -12, -18);
    return g;
  }

  function shotgun(accent) {
    const g = new T.Group();
    for (const s of [-1, 1]) {
      cyl(g, 4.2, 4.2, 58, STEEL(), s * 4.4, 2, -26).rotation.x = Math.PI / 2;
    }
    box(g, 13, 9, 16, DARK(), 0, 0, 2);
    box(g, 12, 12, 30, WOOD(), 0, -6, 22, -0.08);
    box(g, 13, 9, 22, WOOD(), 0, -3, -22);
    box(g, 4, 3, 8, GOLD(), 0, 7, -2);
    box(g, 3, 3, 4, HOT(accent || 0xffb07a), 0, 7, -52);
    return g;
  }

  /* ---------- blades ---------------------------------------------------- */
  function sword(accent) {
    const g = new T.Group();
    const blade = box(g, 3.2, 74, 10, STEEL(), 0, 26, 0);
    blade.rotation.y = 0;
    const tip = new T.Mesh(new T.ConeGeometry(6, 16, 4), STEEL());
    tip.position.set(0, 70, 0);
    tip.rotation.y = Math.PI / 4;
    g.add(tip);
    box(g, 26, 5, 8, GOLD(), 0, -13, 0);
    cyl(g, 3.2, 3.2, 20, WOOD(), 0, -25, 0, 8);
    const pom = new T.Mesh(new T.IcosahedronGeometry(5, 0), HOT(accent || 0x9fe3ff));
    pom.position.y = -37;
    g.add(pom);
    box(g, 1.6, 50, 1.6, HOT(accent || 0x9fe3ff), 0, 26, 5.4);
    return g;
  }

  function axe(accent) {
    const g = new T.Group();
    cyl(g, 3.4, 3.8, 88, WOOD(), 0, 6, 0, 8);
    const head = new T.Mesh(new T.CylinderGeometry(30, 30, 7, 12, 1, false, -0.6, 1.2), STEEL());
    head.position.set(4, 42, 0);
    head.rotation.y = Math.PI / 2;
    head.rotation.z = Math.PI / 2;
    g.add(head);
    box(g, 12, 16, 14, DARK(), 0, 40, 0);
    box(g, 3, 3, 3, HOT(accent || 0xff9a8c), 0, 40, 9);
    return g;
  }

  function hammer(accent) {
    const g = new T.Group();
    cyl(g, 3.6, 4, 84, WOOD(), 0, 4, 0, 8);
    box(g, 34, 22, 22, DARK(), 0, 40, 0);
    box(g, 38, 5, 24, GOLD(), 0, 30, 0);
    box(g, 38, 5, 24, GOLD(), 0, 50, 0);
    box(g, 8, 12, 12, HOT(accent || 0xffd166), 0, 40, 0);
    return g;
  }

  function dagger(accent) {
    const g = new T.Group();
    box(g, 2.6, 44, 8, STEEL(), 0, 18, 0);
    const tip = new T.Mesh(new T.ConeGeometry(4.4, 12, 4), STEEL());
    tip.position.y = 46;
    tip.rotation.y = Math.PI / 4;
    g.add(tip);
    box(g, 18, 4, 6, DARK(), 0, -6, 0);
    cyl(g, 2.8, 2.8, 14, BONE(), 0, -15, 0, 8);
    box(g, 1.4, 30, 1.4, HOT(accent || 0xc9a0ff), 0, 18, 4.4);
    return g;
  }

  /* ---------- orbs ------------------------------------------------------ */
  function orb(accent, style) {
    const g = new T.Group();
    const col = accent || 0x9f7bff;
    const core = new T.Mesh(new T.IcosahedronGeometry(15, 0),
      new T.MeshStandardMaterial({
        color: col, emissive: col, emissiveIntensity: 1.3,
        roughness: 0.25, metalness: 0.5, flatShading: true
      }));
    g.add(core);
    const shell = new T.Mesh(new T.IcosahedronGeometry(21, 1),
      new T.MeshBasicMaterial({ color: col, wireframe: true, transparent: true, opacity: 0.4 }));
    g.add(shell);
    const rings = style === 2 ? 3 : (style === 1 ? 2 : 1);
    for (let i = 0; i < rings; i++) {
      const ring = new T.Mesh(new T.TorusGeometry(27 + i * 6, 1.8, 6, 26),
        new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.75 }));
      ring.rotation.x = Math.PI / 2 + i * 0.7;
      ring.rotation.y = i * 0.5;
      g.add(ring);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const shard = new T.Mesh(new T.TetrahedronGeometry(4, 0),
        new T.MeshBasicMaterial({ color: col }));
      shard.position.set(Math.cos(a) * 33, Math.sin(a * 1.7) * 16, Math.sin(a) * 33);
      g.add(shard);
    }
    return g;
  }

  const GUNS = { pistol, rifle, shotgun };
  const BLADES = { sword, axe, hammer, dagger };
  const ORBS = { orb };

  // One model, by room and slot. Unknown names fall back to the first piece.
  function build(kind, index, accent) {
    const i = index | 0;
    if (kind === 'guns') return (Object.values(GUNS)[i % 3])(accent);
    if (kind === 'blades') return (Object.values(BLADES)[i % 4])(accent);
    if (kind === 'orbs') return orb(accent, i % 3);
    return new T.Group();
  }

  G.HubModels = { build, pistol, rifle, shotgun, sword, axe, hammer, dagger, orb };
})(window);
