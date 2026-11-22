/* =====================================================================
   hub_avatars.js — the fighter, in three dimensions.

   In the arena a player is a lit sphere with an eye facing the way they
   aim, and their model hangs off it: rings, spikes, fangs, hex bands, a
   halo, motes, shards, arms, horns, blades and the five wing sets
   (avatar_model.js). This draws the same fifteen models with real meshes
   so the hall shows the orb you actually play, not a flat badge of it.
   ===================================================================== */
(function (G) {
  'use strict';

  const T = G.THREE;
  if (!T) return;
  const TAU = Math.PI * 2;

  function colorAt(i) {
    const list = (G.AvatarStyle && G.AvatarStyle.COLORS) || null;
    const c = list && list[Math.max(0, Math.min(list.length - 1, i | 0))];
    return (c && c.c) || '#98d7ff';
  }

  function glow(hex, size, opacity) {
    const S = 128, c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
    g.addColorStop(0, hex + 'cc');
    g.addColorStop(0.45, hex + '44');
    g.addColorStop(1, hex + '00');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    const tex = new T.CanvasTexture(c);
    const sp = new T.Sprite(new T.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false,
      opacity: opacity == null ? 0.85 : opacity, blending: T.AdditiveBlending
    }));
    sp.scale.set(size, size, 1);
    return sp;
  }

  const lit = (hex, k) => new T.MeshBasicMaterial({ color: new T.Color(hex).multiplyScalar(k || 1) });

  /* ------------------------------------------------------------------ */
  function build(design, colorIndex, opts) {
    opts = opts || {};
    const R = opts.r || 34;              // the ball's radius
    const col = colorAt(colorIndex);
    const tint = new T.Color(col);
    const grp = new T.Group();
    const spin = [];                     // (t) => void

    const body = new T.Mesh(
      new T.SphereGeometry(R, 22, 16),
      new T.MeshStandardMaterial({
        color: tint, metalness: 0.55, roughness: 0.22,
        emissive: tint.clone().multiplyScalar(0.18)
      })
    );
    body.position.y = R;
    grp.add(body);

    // the visor: dark glass with the aim light behind it
    const visor = new T.Mesh(
      new T.SphereGeometry(R * 0.36, 14, 10),
      new T.MeshStandardMaterial({
        color: 0x05080f, metalness: 0.8, roughness: 0.1,
        emissive: new T.Color(0x3fc8ff), emissiveIntensity: 0.9
      })
    );
    visor.scale.set(1, 0.72, 1.5);
    visor.position.set(0, R, R * 0.74);
    grp.add(visor);

    const aura = glow(col, R * 2.9, 0.5);
    aura.position.y = R;
    grp.add(aura);

    const d = design | 0;

    if (d === 0) {                                    // pulse ring
      const ring = new T.Mesh(new T.TorusGeometry(R + 6, 3, 8, 40), lit(col, 1.6));
      ring.position.y = R; ring.rotation.x = Math.PI / 2.4;
      grp.add(ring);
      spin.push((t) => {
        const k = 1 + Math.sin(t * 4) * 0.08;
        ring.scale.set(k, k, 1);
        ring.rotation.z = t * 0.8;
      });
    } else if (d === 1) {                             // spiked shell
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        const sp = new T.Mesh(new T.ConeGeometry(5, 16, 5),
          new T.MeshStandardMaterial({ color: 0xff6478, emissive: 0x8a1424, metalness: 0.4, roughness: 0.3 }));
        sp.position.set(Math.cos(a) * R * 0.78, R + R * 0.72, Math.sin(a) * R * 0.78);
        sp.rotation.z = -Math.cos(a) * 0.7;
        sp.rotation.x = Math.sin(a) * 0.7;
        grp.add(sp);
      }
    } else if (d === 2) {                             // toothy maw
      const ring = new T.Group();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const f = new T.Mesh(new T.ConeGeometry(4, 13, 4),
          new T.MeshStandardMaterial({ color: 0x1d1226, emissive: 0x4a0a18, metalness: 0.6, roughness: 0.3 }));
        f.position.set(Math.cos(a) * R * 0.92, 0, Math.sin(a) * R * 0.92);
        f.rotation.z = Math.PI;
        ring.add(f);
      }
      ring.position.y = R;
      grp.add(ring);
      spin.push((t) => { ring.rotation.y = t * 1.5; });
    } else if (d === 3) {                             // hex armour
      for (let i = 0; i < 3; i++) {
        const band = new T.Mesh(new T.TorusGeometry(R + 7 + i, 2.6, 4, 6), lit(0x5c8bd0, 1.2));
        band.position.y = R;
        band.rotation.set(i * 1.05, 0, i * 0.6);
        grp.add(band);
        spin.push((t) => { band.rotation.z = i * 0.6 + t * 0.6; });
      }
    } else if (d === 4) {                             // cyber halo
      const halo = new T.Mesh(new T.TorusGeometry(R + 11, 2.4, 6, 36), lit(0x9be8ff, 1.9));
      halo.position.y = R + 12; halo.rotation.x = Math.PI / 2;
      grp.add(halo);
      const hg = glow('#9be8ff', R * 2.4, 0.4);
      hg.position.y = R + 12;
      grp.add(hg);
      spin.push((t) => { halo.rotation.z = t; halo.position.y = R + 12 + Math.sin(t * 2) * 3; });
    } else if (d === 5) {                             // void flame
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const m = glow('#c07bff', 18, 0.6);
        m.position.set(Math.cos(a) * (R + 6), R, Math.sin(a) * (R + 6));
        grp.add(m);
        spin.push((t) => {
          const b = a + Math.sin(t * 2) * 0.2;
          m.position.set(Math.cos(b) * (R + 6), R + Math.sin(t * 4 + i) * 5, Math.sin(b) * (R + 6));
        });
      }
    } else if (d === 6) {                             // crystal shards
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const sh = new T.Mesh(new T.OctahedronGeometry(6),
          new T.MeshStandardMaterial({ color: 0xaee6ff, emissive: 0x3f9fd0, metalness: 0.5, roughness: 0.1 }));
        grp.add(sh);
        spin.push((t) => {
          const b = a + t;
          sh.position.set(Math.cos(b) * (R + 12), R + Math.sin(t * 2 + i) * 5, Math.sin(b) * (R + 12));
          sh.rotation.set(t, t * 1.4, 0);
        });
      }
    } else if (d === 7) {                             // nano arms
      for (let i = 0; i < 3; i++) {
        const arm = new T.Mesh(new T.BoxGeometry(6, 6, R + 22),
          new T.MeshStandardMaterial({ color: 0x7dffa3, emissive: 0x1e9a45, metalness: 0.6, roughness: 0.25 }));
        grp.add(arm);
        spin.push((t) => {
          const a = t * 2 + i * 2.09;
          arm.position.set(Math.cos(a) * R * 0.8, R, Math.sin(a) * R * 0.8);
          arm.rotation.y = -a + Math.PI / 2;
        });
      }
    } else if (d === 8) {                             // plasma horns
      for (const s of [-1, 1]) {
        const horn = new T.Mesh(new T.ConeGeometry(5, 22, 6),
          new T.MeshBasicMaterial({ color: 0xffa04a }));
        horn.position.set(s * R * 0.6, R + 16, -R * 0.2);
        horn.rotation.z = s * 0.5;
        grp.add(horn);
        const hg = glow('#ffb066', 26, 0.55);
        hg.position.copy(horn.position);
        grp.add(hg);
      }
    } else if (d === 9) {                             // tri-blade wheel
      for (let i = 0; i < 3; i++) {
        const blade = new T.Mesh(new T.BoxGeometry(34, 3, 7),
          new T.MeshStandardMaterial({ color: 0xe6ecff, metalness: 0.9, roughness: 0.12 }));
        grp.add(blade);
        spin.push((t) => {
          const a = t * 3 + (i * TAU) / 3;
          blade.position.set(Math.cos(a) * (R * 0.4 + 10), R, Math.sin(a) * (R * 0.4 + 10));
          blade.rotation.y = -a;
        });
      }
    } else {                                          // 10-14: wings
      const w = wings(d, R);
      grp.add(w.group);
      spin.push(w.tick);
    }

    function update(t) {
      body.position.y = R + Math.sin(t * 2.2) * 2.4;
      visor.position.y = body.position.y;
      aura.position.y = body.position.y;
      for (let i = 0; i < spin.length; i++) spin[i](t);
    }
    update(0);
    return { group: grp, update };
  }

  /* ---- the five wing sets --------------------------------------------- */
  function wings(design, R) {
    const g = new T.Group();
    const sets = [];

    for (const s of [-1, 1]) {
      const side = new T.Group();
      if (design === 10) {                       // angel feathers
        for (let i = 0; i < 5; i++) {
          const f = new T.Mesh(new T.SphereGeometry(1, 10, 8),
            new T.MeshStandardMaterial({
              color: 0xfffaf0, emissive: 0x5a5040, roughness: 0.4,
              metalness: 0.1
            }));
          const L = 22 + i * 7;
          f.scale.set(L, 3.5, 7 - i * 0.4);
          f.position.set(s * (10 + L * 0.5), R + 4 + i * 1.5, -8 - i * 3);
          f.rotation.y = s * (0.4 + i * 0.12);
          side.add(f);
        }
      } else if (design === 11) {                // cyber blades
        for (let i = 0; i < 4; i++) {
          const b = new T.Mesh(new T.BoxGeometry(26 + (i % 2) * 9, 3, 5),
            new T.MeshStandardMaterial({ color: 0x141c28, metalness: 0.9, roughness: 0.2, emissive: 0x1d7fd0 }));
          b.position.set(s * (16 + i * 4), R + 2, -6 - i * 4);
          b.rotation.y = s * (0.5 + i * 0.2);
          side.add(b);
        }
      } else if (design === 12) {                // void
        for (let i = 0; i < 4; i++) {
          const c = new T.Mesh(new T.ConeGeometry(4, 26 - i * 3, 5),
            new T.MeshStandardMaterial({ color: 0x160a26, emissive: 0x6a1ec0, metalness: 0.4, roughness: 0.3 }));
          c.position.set(s * (14 + i * 3), R + 3, -8 - i * 4);
          c.rotation.z = s * 1.35;
          side.add(c);
        }
      } else if (design === 13) {                // fire
        for (let i = 0; i < 4; i++) {
          const f = new T.Mesh(new T.SphereGeometry(1, 8, 6),
            new T.MeshBasicMaterial({ color: 0xff7a1a }));
          const L = 26 - i * 3;
          f.scale.set(L, 4, 8);
          f.position.set(s * (14 + i * 3), R + 5 + i * 2, -6 - i * 3);
          f.rotation.y = s * (0.5 + i * 0.2);
          side.add(f);
        }
      } else {                                    // insect
        for (let i = 0; i < 2; i++) {
          const w = new T.Mesh(new T.SphereGeometry(1, 8, 6),
            new T.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.5 }));
          const L = 26 - i * 6;
          w.scale.set(L, 2, 11);
          w.position.set(s * (14 + i * 5), R + 6, -6 - i * 4);
          side.add(w);
        }
      }
      side.position.set(s * R * 0.3, 0, 0);
      g.add(side);
      sets.push({ side, s });
    }

    const beat = design === 14 ? 18 : 3.2;
    const tick = (t) => {
      const a = Math.sin(t * beat) * (design === 14 ? 0.2 : 0.3);
      for (const set of sets) set.side.rotation.y = set.s * a;
    };
    return { group: g, tick };
  }

  G.HubAvatar = { build, colorAt, glow };
})(window);
