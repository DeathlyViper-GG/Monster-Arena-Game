/* Crysto — the ground itself.
   One analytic height field drives the terrain mesh, the walker and every prop
   placed on it, so nothing ever floats and the world needs no stored map. */
(function () {
  const C = (window.Crysto = window.Crysto || {});

  function hash2(x, y) {
    // Math.imul keeps the whole chain in 32 bits: a plain multiply would lose
    // its low bits to float precision and the noise would collapse to a plain.
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  const fade = (t) => t * t * (3 - 2 * t);

  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = fade(x - xi), yf = fade(y - yi);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi);
    const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    const top = a + (b - a) * xf;
    const bot = c + (d - c) * xf;
    return top + (bot - top) * yf;
  }

  function fbm(x, y, oct, lac, gain) {
    let f = 1, a = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += vnoise(x * f, y * f) * a;
      norm += a;
      f *= lac;
      a *= gain;
    }
    return sum / norm;
  }

  // Where the River Sable runs at a given z.
  function riverX(z) {
    return -5200 + Math.sin(z * 0.00035) * 1100;
  }

  function rawHeight(x, z) {
    const cont = fbm(x * 0.00013, z * 0.00013, 5, 2.0, 0.5);
    // The bias keeps the continent standing proud of the sea: most of Crysto is
    // walkable land, with the ocean only where the south falls away.
    let h = (cont - 0.44) * 2400 + 420;
    const ridge = fbm(x * 0.00042 + 19.3, z * 0.00042 - 7.1, 4, 2.0, 0.5);
    h += Math.max(0, ridge - 0.5) * 5200;
    h += (fbm(x * 0.0026, z * 0.0026, 3, 2.1, 0.5) - 0.5) * 90;
    // the sea opens up in the far south
    h -= Math.max(0, z - 7200) * 0.55;
    return h;
  }

  /* ---- the Hollow Reach -------------------------------------------------
     The continent under the ice. Not the vale at another latitude: its own
     field, its own palette, five kinds of ground — the ashen shore, the black
     pine, the ember wastes, the drowned mire and the bone crown in the middle
     of it. The two fields cross-fade across the water between them, so the
     vale is left exactly as it was and the Reach rises out of the sea on its
     own account. */
  const REACH_EDGE = 24000;      // the vale's sea gives way here
  const REACH_BODY = 32000;      // fully the Reach from here south
  const REACH_HEART = 46000;
  const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  function reachBlend(z) {
    if (z <= REACH_EDGE) return 0;
    const t = c01((z - REACH_EDGE) / (REACH_BODY - REACH_EDGE));
    return t * t * (3 - 2 * t);
  }

  function reachRaw(x, z) {
    const zz = z - REACH_HEART;
    const cont = fbm(x * 0.00010 + 71.3, zz * 0.00010 - 26.7, 5, 2.0, 0.5);
    let h = (cont - 0.42) * 2100 + 360;
    // long ridges, sharpest in the east where the ember wastes run
    const east = c01((x - 2000) / 14000);
    const ridge = fbm(x * 0.00045 - 12.4, zz * 0.00045 + 31.8, 4, 2.0, 0.5);
    h += Math.max(0, ridge - 0.52) * (1800 + 3400 * east);
    h += (fbm(x * 0.0031 + 4.7, zz * 0.0031 - 8.2, 3, 2.1, 0.5) - 0.5) * 70;
    // the mire: a drowned bowl in the south-west
    const m = Math.hypot((x + 12000) / 9500, (zz - 2000) / 8500);
    if (m < 1) h = h * (0.30 + 0.70 * m) - 190 * (1 - m) * (1 - m);
    // the crown: a high table of bone stone
    const cr = Math.hypot(x / 7600, (zz - 6200) / 6800);
    if (cr < 1.3) {
      const t = c01((1.3 - cr) / 0.55);
      const b = t * t * (3 - 2 * t);
      h = h * (1 - b) + 660 * b;
    }
    // the northern shore falls away into the sea
    const shore = c01((z - REACH_EDGE) / 9000);
    h = h * (0.05 + 0.95 * shore) - (1 - shore) * 640;
    return h;
  }

  // Where the Reach's villages and camps stand. Their ground is levelled to the
  // height found at the middle of each, so no shelf is ever a cliff away.
  const REACH_SITES = [
    { id: 'landing', x: 0, z: 31000, r: 900 },
    { id: 'ashfall', x: -6000, z: 33000, r: 1500 },
    { id: 'blackpine', x: -15000, z: 40000, r: 1400 },
    { id: 'cinderfall', x: 2000, z: 46000, r: 1700 },
    { id: 'scout', x: -12000, z: 42000, r: 620 },
    { id: 'camp-shore', x: -2000, z: 37000, r: 780 },
    { id: 'camp-gully', x: -10000, z: 36000, r: 780 },
    { id: 'camp-mire', x: -14000, z: 44000, r: 780 },
    { id: 'camp-mesa', x: 9000, z: 40000, r: 780 },
    { id: 'camp-crown', x: 12000, z: 48000, r: 800 },
    { id: 'camp-pine', x: -18000, z: 35000, r: 780 },
    // the five broods: one flat nest to a country
    { id: 'brood-rime', x: 10000, z: 32000, r: 820 },
    { id: 'brood-root', x: -8500, z: 38000, r: 820 },
    { id: 'brood-ember', x: 5000, z: 43500, r: 820 },
    { id: 'brood-soul', x: -9000, z: 46500, r: 820 },
    { id: 'brood-storm', x: 8000, z: 50500, r: 820 }
  ];
  REACH_SITES.forEach((s) => { s.y = Math.max(70, reachRaw(s.x, s.z)); });

  // The places built by hands get a shelf of their own, so a village or a keep
  // is never drowned by whichever continent the noise happened to roll.
  const BRIDGE_Z = -2600;
  const BRIDGE_X = riverX(BRIDGE_Z);
  // The three sanctums: sealed rooms a shrine sends you to. Their ground is cut
  // dead flat, so the arena's floor sits exactly on the land.
  const SANCTUMS = {
    root: { x: -11000, z: -6000, y: 300 },
    ember: { x: 12000, z: 6200, y: 220 },
    tide: { x: -12000, z: 12000, y: 160 }
  };
  // A shrine stands on its own paved shelf: dead flat out past its steps, so
  // the pillars and the altar never lean or float.
  const SHRINES = [
    { x: -6200, z: 2600, y: 150 },
    { x: 6400, z: -4200, y: 420 },
    { x: -3200, z: 9800, y: 110 }
  ];
  const SITES = [
    { x: 0, z: 0, r: 3000, y: 46 },
    { x: -6200, z: 2600, r: 760, y: 150 },
    { x: 6400, z: -4200, r: 760, y: 420 },
    { x: -3200, z: 9800, r: 780, y: 110 },
    { x: 6000, z: -6000, r: 1100, y: 300 },
    { x: BRIDGE_X - 1250, z: BRIDGE_Z, r: 560, y: 150 },
    { x: BRIDGE_X + 1250, z: BRIDGE_Z, r: 560, y: 150 }
  ].concat(REACH_SITES);

  function height(x, z) {
    // Past the water the Reach takes over on its own field. Deep in the Reach
    // the vale's field is never computed at all: the ground there costs
    // exactly what the vale's own ground costs.
    const rb = reachBlend(z);
    let h;
    if (rb >= 1) h = reachRaw(x, z);
    else {
      h = rawHeight(x, z);
      if (rb > 0) h = h * (1 - rb) + reachRaw(x, z) * rb;
    }
    // Drane Vale: a broad gentle bowl the village sits in
    const d = Math.hypot(x, z);
    const flat = Math.max(0, 1 - d / 2000);
    const w = Math.pow(flat, 1.4) * 0.94;
    h = h * (1 - w) + 46 * w;
    // the river's channel: a broad valley with a wet floor at its heart. The
    // Sable is the vale's own water — its formula would otherwise wrap round
    // and carve a second channel through the Reach, so it keeps to the vale.
    const dr = Math.abs(x - riverX(z));
    if (z < 14000 && dr < 900) {
      h -= Math.pow(1 - dr / 900, 2) * 420;
      if (dr < 430) {
        const c = (1 - dr / 430) * 0.92;
        h = h * (1 - c) + -45 * c;
      }
    }
    // the built places hold their own ground: flat to the middle, ramping only
    // at the rim, so a village, shrine or keep never stands on a slope
    for (let i = 0; i < SITES.length; i++) {
      const s = SITES[i];
      const dx = x - s.x, dz = z - s.z;
      const dist = Math.hypot(dx, dz);
      if (dist > s.r) continue;
      const flatTo = s.r * 0.62;
      const t = dist < flatTo ? 1 : 1 - (dist - flatTo) / (s.r - flatTo);
      const blend = t * t * (3 - 2 * t) * 0.98;
      h = h * (1 - blend) + s.y * blend;
    }
    // the shrines: a paved shelf, dead flat under the steps and the pillars
    for (let i = 0; i < SHRINES.length; i++) {
      const s = SHRINES[i];
      const dist = Math.hypot(x - s.x, z - s.z);
      if (dist > 620) continue;
      const t = dist < 430 ? 1 : 1 - (dist - 430) / 190;
      const blend = t * t * (3 - 2 * t);
      h = h * (1 - blend) + s.y * blend;
    }
    // the sanctums: cut stone, dead flat right out to their walls
    for (const k in SANCTUMS) {
      const s = SANCTUMS[k];
      const dist = Math.hypot(x - s.x, z - s.z);
      if (dist > 1150) continue;
      const t = dist < 880 ? 1 : 1 - (dist - 880) / 270;
      h = h * (1 - t) + s.y * t;
    }
    // The vale is a shelf, never a lagoon: its rim cannot fall below the water
    // line, so the walk out of the village is always dry.
    if (d < 3200) {
      const shelf = 34 * Math.pow(Math.max(0, 1 - d / 3200), 0.75);
      if (h < shelf) h = shelf;
    }
    return h;
  }

  function slope(x, z) {
    const e = 34;
    const dx = Math.abs(height(x + e, z) - height(x - e, z)) / (2 * e);
    const dz = Math.abs(height(x, z + e) - height(x, z - e)) / (2 * e);
    return Math.max(dx, dz);
  }

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  // Ground colour per vertex: meadow greens, silt at the waterline, stone on
  // cliffs, snow on the high peaks. Returned as 0..1 floats for vertex colours.
  // The Reach's own ground: ash and charcoal, rust in the east, a black-green
  // wet in the mire, bone-pale stone on the crown. No meadow green anywhere.
  function reachColor(x, z, h, sl) {
    const zz = z - REACH_HEART;
    const patch = fbm(x * 0.0009 + 41.7, zz * 0.0009 - 17.2, 3, 2.0, 0.5);
    const near = fbm(x * 0.0052 - 9.1, zz * 0.0052 + 22.6, 3, 2.0, 0.55);
    let r = 0.30 + patch * 0.20;
    let g = 0.29 + patch * 0.18;
    let b = 0.27 + patch * 0.16;
    // the grain underfoot: cinders, then dry bone dust, then bare rock
    const ash = c01((near - 0.46) / 0.28);
    const grit = c01((0.40 - near) / 0.26);
    r += (0.44 - r) * ash; g += (0.42 - g) * ash; b += (0.39 - b) * ash;
    r += (0.21 - r) * grit; g += (0.20 - g) * grit; b += (0.19 - b) * grit;
    // black pine in the west
    const pine = c01((-x - 2000) / 10000) * c01((z - 30000) / 6000);
    r += (0.13 - r) * pine * 0.85; g += (0.24 - g) * pine * 0.85; b += (0.15 - b) * pine * 0.85;
    // the ember wastes in the east
    const ember = c01((x - 2000) / 9000);
    r += (0.46 - r) * ember * 0.8; g += (0.25 - g) * ember * 0.8; b += (0.18 - b) * ember * 0.8;
    // the mire: black water and wet peat
    const m = Math.max(0, 1 - Math.hypot((x + 12000) / 10000, (zz - 2000) / 9000));
    const wet = m * m;
    r += (0.17 - r) * wet; g += (0.23 - g) * wet; b += (0.16 - b) * wet;
    // the crown: pale stone, the only bright ground in the Reach
    const crown = Math.max(0, 1 - Math.hypot(x / 7500, (zz - 6000) / 7000));
    const cw = crown * crown;
    r += (0.62 - r) * cw; g += (0.60 - g) * cw; b += (0.54 - b) * cw;
    // silt at the waterline, rock on the steep faces
    const sand = c01((24 - h) / 44);
    r += (0.55 - r) * sand; g += (0.50 - g) * sand; b += (0.42 - b) * sand;
    const rock = c01((sl - 0.40) / 0.55);
    r += (0.34 - r) * rock; g += (0.32 - g) * rock; b += (0.31 - b) * rock;
    return [r, g, b];
  }

  function colorAt(x, z, h, sl) {
    if (z > REACH_EDGE + 1200) return reachColor(x, z, h, sl);
    const patch = fbm(x * 0.0011 + 5.1, z * 0.0011 - 3.4, 3, 2.0, 0.5);
    let r = 0.26 + patch * 0.22;
    let g = 0.44 + patch * 0.30;
    let b = 0.19 + patch * 0.13;
    // A second, far closer grain: the field you are actually standing in turns
    // over every few dozen paces — dark moss, then dry straw, then the plain
    // green between them. Without it the ground under the grass is one flat
    // wash of colour all the way to the horizon.
    const near = fbm(x * 0.0046 - 2.7, z * 0.0046 + 8.3, 3, 2.0, 0.55);
    const dry = clamp01((near - 0.44) / 0.30) * 0.9;
    const moss = clamp01((0.40 - near) / 0.30) * 0.85;
    r += (0.58 - r) * dry; g += (0.50 - g) * dry; b += (0.23 - b) * dry;
    r += (0.12 - r) * moss; g += (0.25 - g) * moss; b += (0.09 - b) * moss;

    const sand = clamp01((16 - h) / 30);
    r += (0.70 - r) * sand; g += (0.63 - g) * sand; b += (0.44 - b) * sand;

    const rock = clamp01((sl - 0.42) / 0.55);
    r += (0.45 - r) * rock; g += (0.44 - g) * rock; b += (0.43 - b) * rock;

    const high = clamp01((h - 620) / 900);
    r += (0.50 - r) * high; g += (0.51 - g) * high; b += (0.54 - b) * high;

    const snow = clamp01((h - 1500) / 700);
    r += (0.95 - r) * snow; g += (0.96 - g) * snow; b += (1.0 - b) * snow;
    return [r, g, b];
  }

  // Which country a foot is standing in. The vale keeps its meadows; past the
  // water the ground is shore, pine, ember, mire or the bone crown.
  function region(x, z) {
    if (z < REACH_EDGE + 800) return 'vale';
    const zz = z - REACH_HEART;
    if (Math.hypot((x + 12000) / 10000, (zz - 2000) / 9000) < 0.85) return 'mire';
    if (Math.hypot(x / 7500, (zz - 6000) / 7000) < 1.02) return 'crown';
    if (x > 2500 && z > 36000) return 'ember';
    if (x < -4000 && z > 34000) return 'pine';
    return 'shore';
  }

  C.region = region;
  C.hash2 = hash2;
  C.vnoise = vnoise;
  C.fbm = fbm;
  C.riverX = riverX;
  C.sanctums = SANCTUMS;
  C.height = height;
  C.slope = slope;
  C.colorAt = colorAt;
  C.clamp01 = clamp01;
  C.reachField = {
    edge: REACH_EDGE, body: REACH_BODY, heart: { x: 0, z: REACH_HEART },
    sites: REACH_SITES, blend: reachBlend
  };
})();
