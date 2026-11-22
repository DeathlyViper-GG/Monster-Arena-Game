/* Times the two things that make Crysto stutter: reshaping a tile as the walker
   crosses a chunk line, and a whole ring of them. Run: node src/scripts/crysto_perf.cjs */
const fs = require('fs'), vm = require('vm'), path = require('path');
const noop = () => {};

function ctx2d() {
  const base = {
    canvas: null, font: '', textAlign: '', textBaseline: '', fillStyle: '',
    measureText: (t) => ({ width: String(t || '').length * 10 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    getImageData: () => ({ data: [] }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4), width: w, height: h }),
    putImageData: noop, fillRect: noop
  };
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
}
function el(tag) {
  const node = {
    tagName: tag, style: {}, dataset: {}, children: [], innerHTML: '', textContent: '', className: '', type: '',
    clientWidth: 120, clientHeight: 120,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop,
    appendChild(c) { this.children.push(c); return c; }, remove: noop, setAttribute: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 120, height: 120 })
  };
  if (tag === 'canvas') { node.width = 128; node.height = 128; node.getContext = () => ctx2d(); }
  return node;
}
const document = {
  createElement: el, createElementNS: (ns, tag) => el(tag),
  getElementById: () => null, querySelector: () => null,
  querySelectorAll: () => [], addEventListener: noop, body: el('body'), head: el('head')
};
const store = {};
global.document = document;
const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };

(async () => {
  const THREE = await import('three');
  const T = {};
  for (const k of Object.keys(THREE)) T[k] = THREE[k];
  const sandbox = {
    console, THREE: T, document, localStorage, sessionStorage: localStorage,
    postMessage: noop, window: null, navigator: { userAgent: 'node', maxTouchPoints: 0 },
    performance: { now: () => Date.now() }, requestAnimationFrame: () => 1, cancelAnimationFrame: noop,
    setInterval: () => 1, clearInterval: noop, setTimeout: noop, clearTimeout: noop,
    getComputedStyle: () => ({ display: 'grid' }), addEventListener: noop,
    CustomEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o); } }, dispatchEvent: noop,
    location: { search: '', origin: 'http://x' }, parent: null, matchMedia: () => ({ matches: false })
  };
  sandbox.window = sandbox;
  sandbox.parent = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  const load = (f) => vm.runInContext(fs.readFileSync(path.join('public/js/crysto', f), 'utf8'), ctx, { filename: f });
  ['noise.js', 'materials.js', 'terrain.js', 'props.js'].forEach(load);

  const C = sandbox.Crysto;
  const scene = new T.Scene();
  const t0 = Date.now();
  const terrain = C.buildTerrain(scene);
  terrain.update(0, 520);
  console.log('first ring of tiles:', Date.now() - t0, 'ms');

  const time = (label, fn) => {
    const a = process.hrtime.bigint();
    fn();
    const ms = Number(process.hrtime.bigint() - a) / 1e6;
    console.log(label, ms.toFixed(1), 'ms');
    return ms;
  };

  // one chunk east: five tiles on the far edge have to be rebuilt
  time('crossing one chunk line:', () => terrain.update(2000, 520));
  time('crossing another:', () => terrain.update(4000, 520));
  // the whole ring at once, the worst case a teleport can cause
  time('teleport, whole ring:', () => terrain.update(60000, 60000));

  console.log('per-frame no-op update:', (() => {
    const a = process.hrtime.bigint();
    for (let i = 0; i < 1000; i++) terrain.update(60000, 60000);
    return (Number(process.hrtime.bigint() - a) / 1e6 / 1000).toFixed(3) + ' ms';
  })());
})().catch((e) => { console.log('FAILED', e && e.message); process.exit(1); });