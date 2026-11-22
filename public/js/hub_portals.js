/* =====================================================================
   hub_portals.js — the gateways, and what is on the other side of them.

   A portal is not a picture of a portal: it is a mouth of light with its
   own weather. Every mode gets its own frame, its own pattern and its own
   motion, so you can tell the campaign from the containment lab from the
   parkour course from across the hall.
   ===================================================================== */
(function (G) {
  'use strict';

  const T = G.THREE;
  if (!T) return;
  const TAU = Math.PI * 2;
  const hexOf = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');

  function canvasOf(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  /* ---- the pattern inside the mouth ------------------------------------ */
  function swirlTexture(pattern, hex) {
    const S = 512, c = canvasOf(S, S), x = c.getContext('2d');
    x.translate(S / 2, S / 2);

    const glow = x.createRadialGradient(0, 0, 10, 0, 0, S / 2);
    glow.addColorStop(0, 'rgba(255,255,255,0.95)');
    glow.addColorStop(0.22, hex + 'cc');
    glow.addColorStop(0.62, hex + '55');
    glow.addColorStop(1, hex + '00');
    x.fillStyle = glow;
    x.beginPath(); x.arc(0, 0, S / 2, 0, TAU); x.fill();

    x.strokeStyle = 'rgba(255,255,255,0.55)';
    x.lineCap = 'round';

    if (pattern === 'spiral') {
      for (let i = 0; i < 6; i++) {
        x.lineWidth = 2 + (i % 3);
        x.beginPath();
        for (let a = 0; a < TAU * 2.4; a += 0.09) {
          const r = 8 + a * 32;
          const px = Math.cos(a + i) * r, py = Math.sin(a + i) * r;
          if (a === 0) x.moveTo(px, py); else x.lineTo(px, py);
        }
        x.stroke();
      }
    } else if (pattern === 'hex') {
      for (let ring = 1; ring <= 5; ring++) {
        const r = ring * 44;
        x.lineWidth = 3;
        x.beginPath();
        for (let i = 0; i <= 6; i++) {
          const a = (i / 6) * TAU + ring * 0.2;
          const px = Math.cos(a) * r, py = Math.sin(a) * r;
          if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
        }
        x.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        x.lineWidth = 6;
        x.beginPath();
        x.moveTo(Math.cos(a) * 40, Math.sin(a) * 40);
        x.lineTo(Math.cos(a) * 240, Math.sin(a) * 240);
        x.stroke();
      }
    } else if (pattern === 'rays') {
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU;
        x.lineWidth = i % 3 ? 2 : 5;
        x.beginPath();
        x.moveTo(Math.cos(a) * 26, Math.sin(a) * 26);
        x.lineTo(Math.cos(a) * (150 + (i % 5) * 44), Math.sin(a) * (150 + (i % 5) * 44));
        x.stroke();
      }
    } else if (pattern === 'shards') {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU, r0 = 40 + (i % 4) * 26;
        x.lineWidth = 3;
        x.beginPath();
        x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        x.lineTo(Math.cos(a + 0.24) * (r0 + 84), Math.sin(a + 0.24) * (r0 + 84));
        x.lineTo(Math.cos(a + 0.06) * (r0 + 44), Math.sin(a + 0.06) * (r0 + 44));
        x.closePath();
        x.stroke();
      }
    } else if (pattern === 'hazard') {
      for (let ring = 1; ring <= 4; ring++) {
        const r = ring * 56;
        x.lineWidth = 9;
        x.setLineDash([26, 18]);
        x.beginPath(); x.arc(0, 0, r, 0, TAU); x.stroke();
      }
      x.setLineDash([]);
      x.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        x.beginPath();
        x.moveTo(Math.cos(a) * 34, Math.sin(a) * 34);
        x.lineTo(Math.cos(a) * 226, Math.sin(a) * 226);
        x.stroke();
      }
    } else {                       // runes
      for (let ring = 1; ring <= 3; ring++) {
        const r = ring * 66;
        x.lineWidth = 3;
        x.beginPath(); x.arc(0, 0, r, 0, TAU); x.stroke();
        const n = 10 + ring * 6;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          x.beginPath();
          x.moveTo(Math.cos(a) * (r - 9), Math.sin(a) * (r - 9));
          x.lineTo(Math.cos(a) * (r + 9), Math.sin(a) * (r + 9));
          x.stroke();
        }
      }
      x.lineWidth = 5;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        x.save();
        x.rotate(a);
        x.translate(0, -150);
        x.beginPath(); x.moveTo(-13, -13); x.lineTo(13, -13); x.lineTo(-13, 13); x.stroke();
        x.restore();
      }
    }

    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    return t;
  }

  // A soft vertical curtain of light, so the mouth spills onto the dais.
  function curtainTexture(hex) {
    const c = canvasOf(64, 256), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, hex + '88');
    g.addColorStop(0.55, hex + '33');
    g.addColorStop(1, hex + '00');
    x.fillStyle = g; x.fillRect(0, 0, 64, 256);
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    return t;
  }

  function glow(hex, size, opacity) {
    const S = 128, c = canvasOf(S, S), x = c.getContext('2d');
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

  /* ---- what each mode looks like --------------------------------------- */
  const STYLES = {
    story:       { frame: 'arch',   pattern: 'runes',  spin: 0.30, motes: 14 },
    single:      { frame: 'arch',   pattern: 'spiral', spin: 0.55, motes: 12 },
    offline:     { frame: 'jagged', pattern: 'shards', spin: 0.42, motes: 10 },
    levels:      { frame: 'hex',    pattern: 'hex',    spin: 0.24, motes: 8 },
    parkour:     { frame: 'ring',   pattern: 'rays',   spin: 1.10, motes: 16 },
    containment: { frame: 'jagged', pattern: 'hazard', spin: 0.66, motes: 12 },
    pve:         { frame: 'arch',   pattern: 'spiral', spin: 0.50, motes: 12 },
    pvp:         { frame: 'jagged', pattern: 'shards', spin: 0.70, motes: 12 },
    teams:       { frame: 'hex',    pattern: 'hex',    spin: 0.36, motes: 10 },
    ctf:         { frame: 'ring',   pattern: 'rays',   spin: 0.80, motes: 10 },
    duel:        { frame: 'ring',   pattern: 'runes',  spin: 0.44, motes: 10 },
    default:     { frame: 'arch',   pattern: 'spiral', spin: 0.5,  motes: 10 }
  };

  /* ---- the portal itself ----------------------------------------------- */
  function build(kind, accent, opts) {
    opts = opts || {};
    const st = STYLES[kind] || STYLES.default;
    const hex = hexOf(accent);
    const S = opts.scale || 1;
    const g = new T.Group();
    const mouth = 76 * S;          // radius of the opening
    const cy = 196 * S;            // height of its middle

    // dais
    const dais = new T.Mesh(new T.CylinderGeometry(110 * S, 122 * S, 18, 28), new T.MeshStandardMaterial({
      color: 0x9fb4d6, emissive: 0x1b3a58, roughness: 0.42, metalness: 0.5
    }));
    dais.position.y = 9 * S;
    g.add(dais);
    const daisRim = new T.Mesh(new T.TorusGeometry(112 * S, 6 * S, 8, 40),
      new T.MeshBasicMaterial({ color: accent }));
    daisRim.rotation.x = Math.PI / 2;
    daisRim.position.y = 19 * S;
    g.add(daisRim);

    const stone = new T.MeshStandardMaterial({ color: 0x2b3a5c, roughness: 0.38, metalness: 0.82 });
    const lit = new T.MeshBasicMaterial({ color: accent });

    if (st.frame === 'arch') {
      for (const sx of [-86, 86]) {
        const j = new T.Mesh(new T.BoxGeometry(30 * S, 196 * S, 42 * S), stone);
        j.position.set(sx * S, 98 * S, 0);
        g.add(j);
        const strip = new T.Mesh(new T.BoxGeometry(6 * S, 190 * S, 8 * S), lit);
        strip.position.set(sx * 0.86 * S, 98 * S, 22 * S);
        g.add(strip);
      }
      const arch = new T.Mesh(new T.TorusGeometry(86 * S, 17 * S, 8, 26, Math.PI), stone);
      arch.position.y = 196 * S;
      g.add(arch);
      const archLit = new T.Mesh(new T.TorusGeometry(72 * S, 5 * S, 6, 26, Math.PI), lit);
      archLit.position.set(0, 196 * S, 16 * S);
      g.add(archLit);
    } else if (st.frame === 'hex') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + Math.PI / 6;
        const bar = new T.Mesh(new T.BoxGeometry(22 * S, 118 * S, 30 * S), stone);
        bar.position.set(Math.cos(a) * 104 * S, cy + Math.sin(a) * 104 * S, 0);
        bar.rotation.z = a + Math.PI / 2;
        g.add(bar);
        const edge = new T.Mesh(new T.BoxGeometry(5 * S, 112 * S, 36 * S), lit);
        edge.position.set(Math.cos(a) * 104 * S, cy + Math.sin(a) * 104 * S, 10 * S);
        edge.rotation.z = a + Math.PI / 2;
        g.add(edge);
      }
    } else if (st.frame === 'jagged') {
      const ring = new T.Mesh(new T.TorusGeometry(104 * S, 12 * S, 8, 30), stone);
      ring.position.y = cy;
      g.add(ring);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const spike = new T.Mesh(new T.ConeGeometry(9 * S, 40 * S, 5), stone);
        spike.position.set(Math.cos(a) * 118 * S, cy + Math.sin(a) * 118 * S, 0);
        spike.rotation.z = a - Math.PI / 2;
        g.add(spike);
        const tip = new T.Mesh(new T.ConeGeometry(3.4 * S, 18 * S, 5), lit);
        tip.position.set(Math.cos(a) * 138 * S, cy + Math.sin(a) * 138 * S, 0);
        tip.rotation.z = a - Math.PI / 2;
        g.add(tip);
      }
    } else {                       // a free-standing ring
      const ring = new T.Mesh(new T.TorusGeometry(104 * S, 14 * S, 10, 40), stone);
      ring.position.y = cy;
      g.add(ring);
      const inner = new T.Mesh(new T.TorusGeometry(96 * S, 4 * S, 6, 40), lit);
      inner.position.set(0, cy, 8 * S);
      g.add(inner);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + Math.PI / 4;
        const leg = new T.Mesh(new T.CylinderGeometry(8 * S, 12 * S, cy - 100 * S, 8), stone);
        leg.position.set(Math.cos(a) * 96 * S, (cy - 100 * S) / 2, 0);
        g.add(leg);
      }
    }

    // the mouth: two counter-turning discs over a hot core
    const tex = swirlTexture(st.pattern, hex);
    const front = new T.Mesh(
      new T.CircleGeometry(mouth, 48),
      new T.MeshBasicMaterial({
        map: tex, transparent: true, blending: T.AdditiveBlending,
        depthWrite: false, side: T.DoubleSide
      })
    );
    front.position.set(0, cy, 3);
    g.add(front);

    const back = new T.Mesh(
      new T.CircleGeometry(mouth * 0.72, 40),
      new T.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.8, blending: T.AdditiveBlending,
        depthWrite: false, side: T.DoubleSide
      })
    );
    back.position.set(0, cy, 1);
    g.add(back);

    const core = glow(hex, mouth * 2.6, 0.7);
    core.position.set(0, cy, -2);
    g.add(core);

    // light spilling down onto the dais
    const curtain = new T.Mesh(
      new T.PlaneGeometry(mouth * 1.9, cy),
      new T.MeshBasicMaterial({
        map: curtainTexture(hex), transparent: true, opacity: 0.55,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      })
    );
    curtain.position.set(0, cy / 2, 4);
    g.add(curtain);

    // motes drawn into the mouth and spat back out
    const motes = [];
    for (let i = 0; i < st.motes; i++) {
      const m = glow(hex, 12 + Math.random() * 10, 0.85);
      g.add(m);
      motes.push({
        s: m,
        a: Math.random() * TAU,
        r: mouth * (0.35 + Math.random() * 1.1),
        v: 0.5 + Math.random() * 0.9,
        y: (Math.random() - 0.5) * mouth * 1.4
      });
    }

    const halo = glow(hex, 460 * S, 0.4);
    halo.position.set(0, cy * 0.72, -10);
    g.add(halo);

    function update(t, dt) {
      const step = Math.min(0.05, dt || 0.016);
      front.rotation.z = t * st.spin;
      back.rotation.z = -t * st.spin * 1.7;
      const pulse = 1 + Math.sin(t * 2.1) * 0.06;
      core.scale.set(mouth * 2.6 * pulse, mouth * 2.6 * pulse, 1);
      halo.scale.set(460 * S * pulse, 460 * S * pulse, 1);
      curtain.material.opacity = 0.42 + Math.sin(t * 2.6) * 0.16;
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        m.a += step * m.v * st.spin * 3;
        m.r -= step * 26;
        if (m.r < mouth * 0.22) { m.r = mouth * (1.1 + Math.random() * 0.4); m.y = (Math.random() - 0.5) * mouth * 1.4; }
        m.s.position.set(Math.cos(m.a) * m.r, cy + m.y * (m.r / (mouth * 1.4)), 6);
        m.s.material.opacity = 0.35 + (1 - m.r / (mouth * 1.5)) * 0.6;
      }
    }
    update(0, 0.016);

    return { group: g, update, radius: 92 * S };
  }

  G.HubPortal = { build, STYLES };
})(window);
