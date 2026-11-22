/* Headless build check for the walking menu. Run: node src/scripts/hub_check.cjs */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const noop = () => {};

function ctx2d() {
  const base = {
    canvas: null, font: '', textAlign: '', textBaseline: '',
    measureText: (t) => ({ width: String(t || '').length * 10 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    getImageData: () => ({ data: [] }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4), width: w, height: h }),
    putImageData: noop
  };
  return new Proxy(base, {
    get: (t, k) => (k in t ? t[k] : noop),
    set: (t, k, v) => { t[k] = v; return true; }
  });
}

const els = new Map();
function el(tag) {
  const node = {
    tagName: tag, style: {}, dataset: {}, children: [], innerHTML: '', textContent: '',
    firstChild: null, firstElementChild: null, clientWidth: 900, clientHeight: 600,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop, appendChild(c) { this.children.push(c); return c; },
    insertBefore(c) { this.children.unshift(c); return c; }, remove: noop, setAttribute: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 600 }),
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    focus: noop, blur: noop, click: noop
  };
  if (tag === 'canvas') { node.width = 256; node.height = 256; node.getContext = () => ctx2d(); }
  return node;
}

function getEl(id) {
  if (!els.has(id)) els.set(id, el('div'));
  return els.get(id);
}

const document = {
  createElement: el,
  getElementById: getEl,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: noop,
  body: el('body'),
  documentElement: el('html'),
  head: el('head'),
  activeElement: null
};

const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

(async () => {
  const THREE = await import('three');
  const T = {};
  for (const k of Object.keys(THREE)) T[k] = THREE[k];
  T.WebGLRenderer = class {
    constructor() { this.domElement = el('canvas'); }
    setSize() {} setPixelRatio() {} render() {}
  };

  const sandbox = {
    console,
    THREE: T,
    document,
    localStorage,
    sessionStorage: localStorage,
    postMessage: noop,
    window: null,
    navigator: { userAgent: 'node', maxTouchPoints: 0 },
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: noop,
    setInterval: () => 1,
    clearInterval: noop,
    setTimeout: noop,
    clearTimeout: noop,
    getComputedStyle: () => ({ display: 'grid' }),
    addEventListener: noop,
    CustomEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o); } },
    dispatchEvent: noop,
    location: { search: '', origin: 'http://x' },
    parent: null
  };
  sandbox.window = sandbox;
  sandbox.parent = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  const load = (f) => vm.runInContext(fs.readFileSync(path.join('public/js', f), 'utf8'), ctx, { filename: f });

  load('rank_emotes_shim.js'.replace('rank_emotes_shim.js', 'hub_presence.js'));
  load('hub_rooms.js');
  load('hub_world.js');
  load('hub_avatars.js');
  load('hub_portals.js');
  load('hub3d.js');
  load('hub_tour.js');

  const R = sandbox.HubRooms;
  console.log('rooms', Object.keys(R.ROOMS).join(','), '| gear', R.GEAR.length, '| gems', R.GEMS.length);

  // walkable sanity: every room's centre must be standable
  let bad = 0;
  const inSpace = (x, z) => (x * x + z * z <= 434 * 434) || R.SPACES.some((s) =>
    Math.abs(x - s.x) <= s.w / 2 && Math.abs(z - s.z) <= s.d / 2);
  for (const k in R.ROOMS) if (!inSpace(R.ROOMS[k].x, R.ROOMS[k].z)) { bad++; console.log('  NOT WALKABLE hall', k); }
  for (const g of R.GEAR) if (!inSpace(g.x, g.z)) { bad++; console.log('  NOT WALKABLE gear', g.id); }
  for (const c of R.CHAMBERS) if (!inSpace(c.x, c.z)) { bad++; console.log('  NOT WALKABLE chamber', c.id); }
  for (const c of R.CELLS) if (!inSpace(c.x, c.z)) { bad++; console.log('  NOT WALKABLE cell', c.id); }

  // every gem must sit on floor
  for (const g of R.GEMS) if (!inSpace(g.x, g.z)) { bad++; console.log('  GEM OFF FLOOR', g.id); }

  // no two rooms may overlap
  const rects = []
    .concat(Object.values(R.ROOMS).map((r) => ({ id: r.id, x: r.x, z: r.z, w: r.w, d: r.d })))
    .concat(R.GEAR.map((r) => ({ id: r.id, x: r.x, z: r.z, w: r.w, d: r.d })))
    .concat(R.CHAMBERS.map((r) => ({ id: r.id, x: r.x, z: r.z, w: r.w, d: r.d })))
    .concat(R.CELLS.map((r) => ({ id: r.id, x: r.x, z: r.z, w: r.w, d: r.d })));
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
      const oz = Math.min(a.z + a.d / 2, b.z + b.d / 2) - Math.max(a.z - a.d / 2, b.z - b.d / 2);
      if (ox > 6 && oz > 6) { bad++; console.log('  OVERLAP', a.id, b.id, ox.toFixed(0), oz.toFixed(0)); }
    }
  }

  // the world must build
  try {
    sandbox.Hub3D.show();
    const p = sandbox.Hub3D.pos();
    console.log('built; spawn at', p.x, p.z, '| gems left', sandbox.Hub3D.gems());
  } catch (e) {
    bad++;
    console.log('BUILD FAILED:', e && e.message);
    console.log((e && e.stack || '').split('\n').slice(0, 4).join('\n'));
  }

  for (const p of [[0, -500], [0, -900], [0, -1000], [0, -1440], [-755, -1780], [-1330, -1780], [-755, -1600]]) {
    console.log('  stand', p[0], p[1], sandbox.Hub3D.canStand(p[0], p[1]));
  }

  // flood fill the floor from the spawn: every open room must be reachable,
  // and every sealed one must have solid floor right outside its door
  const step = 20;
  const kOf = (i, j) => Math.round(i / step) + ',' + Math.round(j / step);
  const seen = new Set();
  const queue = [[0, 330]];
  seen.add(kOf(0, 330));
  let guard = 0;
  while (queue.length && guard++ < 400000) {
    const [x, z] = queue.pop();
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const nx = x + dx, nz = z + dz;
      const k = kOf(nx, nz);
      if (seen.has(k)) continue;
      seen.add(k);
      if (!sandbox.Hub3D.canStand(nx, nz)) continue;
      queue.push([nx, nz]);
    }
  }
  const near = (x, z) => {
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) if (seen.has(kOf(x + a * step, z + b * step))) return true;
    }
    return false;
  };
  const outside = (c) => {
    const hw = c.w / 2, hd = c.d / 2, d = 70;
    if (c.door === 'n') return [c.x, c.z - hd - d];
    if (c.door === 's') return [c.x, c.z + hd + d];
    if (c.door === 'e') return [c.x + hw + d, c.z];
    return [c.x - hw - d, c.z];
  };
  for (const k in R.ROOMS) {
    const r = R.ROOMS[k];
    if (!near(r.x, r.z)) { bad++; console.log('  UNREACHABLE hall', k); }
  }
  for (const g of R.GEAR) if (!near(g.x, g.z)) { bad++; console.log('  UNREACHABLE gear', g.id); }
  for (const c of R.CHAMBERS) {
    const [x, z] = outside(c);
    if (!near(x, z)) { bad++; console.log('  NO DOOR STEP chamber', c.id, x, z); }
  }
  for (const c of R.CELLS) {
    const [x, z] = outside(c);
    if (!near(x, z)) { bad++; console.log('  NO DOOR STEP cell', c.id, x, z); }
  }
  console.log('flood filled', seen.size, 'points');

  console.log(bad === 0 ? 'HALL OK' : bad + ' PROBLEM(S)');
})();