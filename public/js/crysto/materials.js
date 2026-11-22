/* Crysto — the stuff the world is built from.
   Every surface in Drane Vale, the shrines and the Sunken Keep is painted onto a
   canvas here: coursed stone with mortar and pitting, lime plaster with damp and
   hairline cracks, oak with grain and knots, shingles laid row over row, straw
   thatch, plank doors, cobbles and woven cloth. Nothing is downloaded, and every
   material carries a bump map so the sun rakes across it instead of sliding over
   flat paint. */
(function () {
  const C = (window.Crysto = window.Crysto || {});

  const CANVAS = {};
  const MATS = {};

  function cv(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  const rand = (a, b) => a + Math.random() * (b - a);

  function tint(hex, k, a) {
    const r = Math.min(255, Math.max(0, ((hex >> 16) & 255) * (1 + k)));
    const g = Math.min(255, Math.max(0, ((hex >> 8) & 255) * (1 + k)));
    const b = Math.min(255, Math.max(0, (hex & 255) * (1 + k)));
    return a === undefined
      ? 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'
      : 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a + ')';
  }

  /* ---- stone: coursed blocks, mortar, pitting ---------------------------- */
  function stoneCanvas(tone) {
    const S = 256, c = cv(S, S), x = c.getContext('2d');
    x.fillStyle = tint(tone, -0.52);
    x.fillRect(0, 0, S, S);
    const rows = 5, rh = S / rows;
    for (let r = 0; r < rows; r++) {
      let px = r % 2 ? -30 : 0;
      while (px < S) {
        const bw = rand(42, 80), bh = rh - 4, t = rand(-0.15, 0.15);
        x.fillStyle = tint(tone, t);
        x.fillRect(px + 2, r * rh + 2, bw - 4, bh - 2);
        // sunlight on the top edge, shadow under the course
        x.fillStyle = 'rgba(255,255,255,0.11)';
        x.fillRect(px + 2, r * rh + 2, bw - 4, 3);
        x.fillStyle = 'rgba(0,0,0,0.20)';
        x.fillRect(px + 2, r * rh + bh - 2, bw - 4, 3);
        for (let i = 0; i < 16; i++) {
          x.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.07)';
          x.fillRect(px + rand(4, bw - 8), r * rh + rand(4, bh - 6), 2, 2);
        }
        // lichen
        if (Math.random() > 0.72) {
          x.fillStyle = 'rgba(120,140,80,0.16)';
          x.beginPath();
          x.ellipse(px + rand(10, bw - 14), r * rh + rand(8, bh - 8), rand(4, 12), rand(3, 7), 0, 0, 7);
          x.fill();
        }
        px += bw;
      }
    }
    return c;
  }

  /* ---- lime plaster: mottling, damp, hairline cracks -------------------- */
  function plasterCanvas(tone) {
    const S = 256, c = cv(S, S), x = c.getContext('2d');
    x.fillStyle = tint(tone, 0);
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < 90; i++) {
      const px = rand(0, S), py = rand(0, S), r = rand(6, 34);
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      const warm = Math.random() > 0.45;
      g.addColorStop(0, warm ? 'rgba(255,250,235,0.10)' : 'rgba(90,80,60,0.09)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    // hairline cracks
    x.strokeStyle = 'rgba(70,60,45,0.22)';
    for (let i = 0; i < 7; i++) {
      x.lineWidth = rand(0.6, 1.6);
      x.beginPath();
      let px = rand(0, S), py = rand(0, S);
      x.moveTo(px, py);
      for (let j = 0; j < 5; j++) {
        px += rand(-18, 18);
        py += rand(4, 22);
        x.lineTo(px, py);
      }
      x.stroke();
    }
    // damp rising from the ground
    const damp = x.createLinearGradient(0, S * 0.72, 0, S);
    damp.addColorStop(0, 'rgba(60,55,40,0)');
    damp.addColorStop(1, 'rgba(60,55,40,0.24)');
    x.fillStyle = damp;
    x.fillRect(0, S * 0.72, S, S * 0.28);
    return c;
  }

  /* ---- oak: grain, knots ------------------------------------------------ */
  function timberCanvas(tone) {
    const S = 128, c = cv(S, S), x = c.getContext('2d');
    x.fillStyle = tint(tone, 0);
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < 150; i++) {
      const px = rand(0, S);
      x.strokeStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,225,190,0.09)';
      x.lineWidth = rand(0.5, 2.2);
      x.beginPath();
      x.moveTo(px, 0);
      x.bezierCurveTo(px + rand(-6, 6), S * 0.33, px + rand(-6, 6), S * 0.66, px + rand(-4, 4), S);
      x.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const px = rand(10, S - 10), py = rand(10, S - 10);
      x.strokeStyle = 'rgba(0,0,0,0.35)';
      x.lineWidth = 1.4;
      for (let k = 0; k < 3; k++) {
        x.beginPath();
        x.ellipse(px, py, 3 + k * 2.4, 5 + k * 3.4, rand(0, 3), 0, 7);
        x.stroke();
      }
    }
    return c;
  }

  /* ---- shingles: rows of split oak tiles -------------------------------- */
  function shingleCanvas(tone) {
    const S = 256, c = cv(S, S), x = c.getContext('2d');
    x.fillStyle = tint(tone, -0.45);
    x.fillRect(0, 0, S, S);
    const rh = 26;
    for (let r = 0; r * rh < S + rh; r++) {
      const off = r % 2 ? 16 : 0;
      for (let px = -32 + off; px < S + 32; px += 32) {
        const t = rand(-0.2, 0.18);
        x.fillStyle = tint(tone, t);
        x.beginPath();
        x.moveTo(px + 1, r * rh + rh);
        x.lineTo(px + 1, r * rh + 6);
        x.quadraticCurveTo(px + 16, r * rh - 2, px + 31, r * rh + 6);
        x.lineTo(px + 31, r * rh + rh);
        x.closePath();
        x.fill();
        x.fillStyle = 'rgba(255,240,220,0.10)';
        x.fillRect(px + 3, r * rh + 7, 26, 2);
        x.fillStyle = 'rgba(0,0,0,0.26)';
        x.fillRect(px + 1, r * rh + rh - 3, 30, 3);
      }
    }
    return c;
  }

  /* ---- thatch: straw laid in courses ------------------------------------ */
  function thatchCanvas() {
    const S = 256, c = cv(S, S), x = c.getContext('2d');
    x.fillStyle = '#9c7f45';
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) {
      const px = rand(0, S), py = rand(0, S);
      x.strokeStyle = Math.random() > 0.5
        ? 'rgba(226,198,132,' + rand(0.2, 0.55).toFixed(2) + ')'
        : 'rgba(84,64,30,' + rand(0.15, 0.4).toFixed(2) + ')';
      x.lineWidth = rand(0.6, 1.8);
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + rand(-3, 3), py + rand(7, 20));
      x.stroke();
    }
    for (let r = 0; r < 4; r++) {
      x.fillStyle = 'rgba(60,44,18,0.22)';
      x.fillRect(0, r * 64 + 54, S, 6);
    }
    return c;
  }

  /* ---- planks for doors, decks and shutters ----------------------------- */
  function plankCanvas(tone) {
    const S = 128, c = cv(S, S), x = c.getContext('2d');
    x.fillStyle = tint(tone, -0.5);
    x.fillRect(0, 0, S, S);
    for (let px = 0; px < S; px += 32) {
      x.fillStyle = tint(tone, rand(-0.12, 0.12));
      x.fillRect(px + 2, 0, 29, S);
      for (let i = 0; i < 22; i++) {
        x.strokeStyle = 'rgba(0,0,0,0.12)';
        x.lineWidth = rand(0.5, 1.3);
        const gx = px + rand(4, 28);
        x.beginPath();
        x.moveTo(gx, 0);
        x.bezierCurveTo(gx + rand(-2, 2), S * 0.4, gx + rand(-2, 2), S * 0.7, gx + rand(-2, 2), S);
        x.stroke();
      }
      x.fillStyle = 'rgba(255,240,220,0.08)';
      x.fillRect(px + 2, 0, 2, S);
    }
    return c;
  }

  /* ---- cobbles for the well yard and the keep yard ---------------------- */
  function cobbleCanvas() {
    const S = 256, c = cv(S, S), x = c.getContext('2d');
    x.fillStyle = '#3b3630';
    x.fillRect(0, 0, S, S);
    for (let gy = 0; gy < 9; gy++) {
      for (let gx = 0; gx < 9; gx++) {
        const px = gx * 29 + (gy % 2 ? 14 : 0) + rand(-3, 3);
        const py = gy * 29 + rand(-3, 3);
        const tone = rand(0.42, 0.72);
        x.fillStyle = 'rgb(' + ((150 * tone) | 0) + ',' + ((145 * tone) | 0) + ',' + ((132 * tone) | 0) + ')';
        x.beginPath();
        x.ellipse(px, py, rand(10, 14), rand(9, 13), rand(0, 3), 0, 7);
        x.fill();
        x.fillStyle = 'rgba(255,255,255,0.12)';
        x.beginPath();
        x.ellipse(px - 2, py - 3, rand(5, 8), rand(4, 6), 0, 0, 7);
        x.fill();
      }
    }
    return c;
  }

  /* ---- woven cloth for banners and awnings ------------------------------ */
  function clothCanvas(color) {
    const S = 128, c = cv(S, S), x = c.getContext('2d');
    x.fillStyle = tint(color, 0);
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < S; i += 3) {
      x.fillStyle = i % 6 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)';
      x.fillRect(i, 0, 1.4, S);
      x.fillStyle = 'rgba(0,0,0,0.05)';
      x.fillRect(0, i, S, 1.2);
    }
    x.fillStyle = 'rgba(0,0,0,0.28)';
    x.fillRect(0, 0, S, 5);
    x.fillStyle = tint(0xffe6b0, 0, 0.5);
    x.fillRect(0, 12, S, 4);
    x.fillRect(0, S - 18, S, 4);
    return c;
  }

  /* ---- runes: a black field with burning sigils ------------------------ */
  function runeCanvas(color) {
    const S = 256, c = cv(S, S), x = c.getContext('2d');
    x.fillStyle = '#0a0b0e';
    x.fillRect(0, 0, S, S);
    x.strokeStyle = tint(color, 0.35);
    x.shadowColor = tint(color, 0.2);
    x.shadowBlur = 12;
    x.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      const px = rand(16, S - 16), py = rand(16, S - 16), s = rand(7, 15);
      x.lineWidth = rand(1.6, 3);
      x.beginPath();
      const strokes = 2 + ((Math.random() * 3) | 0);
      for (let j = 0; j < strokes; j++) {
        x.moveTo(px + rand(-s, s), py + rand(-s, s));
        x.lineTo(px + rand(-s, s), py + rand(-s, s));
      }
      x.stroke();
    }
    return c;
  }

  /* ---- the material factory -------------------------------------------- */
  function build(key, canvasFn, rx, ry, cfg) {
    const k = key + '|' + rx + '|' + ry;
    if (MATS[k]) return MATS[k];
    if (!CANVAS[key]) CANVAS[key] = canvasFn();
    const t = new THREE.CanvasTexture(CANVAS[key]);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = 4;
    const m = new THREE.MeshStandardMaterial({
      map: t,
      roughness: cfg.rough === undefined ? 0.9 : cfg.rough,
      metalness: cfg.metal || 0.04
    });
    if (cfg.bump) {
      m.bumpMap = t;
      m.bumpScale = cfg.bump;
    }
    MATS[k] = m;
    return m;
  }

  // Repeats are snapped to halves so neighbouring houses share one material
  // (and one upload) instead of each asking the GPU for its own texture.
  const R = (v) => Math.max(0.5, Math.min(6, Math.round((v || 1) * 2) / 2));

  C.materials = {
    stone: (tone, rx, ry) => build('s' + tone, () => stoneCanvas(tone), R(rx), R(ry), { rough: 0.95, bump: 0.22 }),
    plaster: (tone, rx, ry) => build('p' + tone, () => plasterCanvas(tone), R(rx), R(ry), { rough: 0.9, bump: 0.09 }),
    timber: (tone, rx, ry) => build('t' + tone, () => timberCanvas(tone), R(rx), R(ry), { rough: 0.86, bump: 0.14 }),
    shingle: (tone, rx, ry) => build('h' + tone, () => shingleCanvas(tone), R(rx), R(ry), { rough: 0.88, bump: 0.26 }),
    thatch: (rx, ry) => build('th', thatchCanvas, R(rx), R(ry), { rough: 0.97, bump: 0.4 }),
    plank: (tone, rx, ry) => build('k' + tone, () => plankCanvas(tone), R(rx), R(ry), { rough: 0.85, bump: 0.12 }),
    cobble: (rx, ry) => build('c', cobbleCanvas, R(rx), R(ry), { rough: 0.95, bump: 0.3 }),
    cloth: (color, rx, ry) => build('w' + color, () => clothCanvas(color), R(rx), R(ry), { rough: 0.92, extra: true }),
    rune: (color) => {
      const key = 'r' + color;
      if (MATS[key]) return MATS[key];
      if (!CANVAS[key]) CANVAS[key] = runeCanvas(color);
      const t = new THREE.CanvasTexture(CANVAS[key]);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1, 2);
      MATS[key] = new THREE.MeshStandardMaterial({
        map: t, emissiveMap: t, emissive: color, emissiveIntensity: 1.1,
        color: 0x23252b, roughness: 0.7, metalness: 0.15
      });
      return MATS[key];
    }
  };

  // Cloth wants both faces; build() keeps one shared instance per key, so the
  // double-sided flag is applied there.
  const clothFactory = C.materials.cloth;
  C.materials.cloth = function (color, rx, ry) {
    const m = clothFactory(color, rx, ry);
    m.side = THREE.DoubleSide;
    return m;
  };
})();
