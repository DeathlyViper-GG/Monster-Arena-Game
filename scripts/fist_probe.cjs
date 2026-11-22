/* Headless check of the inflated fist and its strike. Run: node scripts/fist_probe.cjs */
const fs = require('fs'), vm = require('vm');
const noop = () => {};
function ctx2d() {
  const base = { measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }), getImageData: () => ({ data: [] }) };
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
}
function el(tag) {
  const n = { tagName: tag, style: {}, children: [], className: '', getAttribute: () => null,
    setAttribute: noop, appendChild(c) { this.children.push(c); return c; }, addEventListener: noop,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false } };
  if (tag === 'canvas') { n.width = 64; n.height = 64; n.getContext = () => ctx2d(); }
  return n;
}
const document = { createElement: el, createElementNS: (ns, t) => el(t), getElementById: () => null,
  querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, body: el('body'), head: el('head') };
const store = {};
const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
global.document = document;

(async () => {
  const THREE = await import('three');
  const T = {};
  for (const k of Object.keys(THREE)) T[k] = THREE[k];
  // count the fist's own slices as they are built
  const slices = [];
  class TrackedMesh extends T.Mesh {
    constructor(g, m) { super(g, m); if (m && m.alphaTest === 0.3) slices.push(this); }
  }
  T.Mesh = TrackedMesh;
  const sandbox = {
    console, THREE: T, document, localStorage, navigator: { userAgent: 'node' },
    performance: { now: () => Date.now() }, setTimeout, clearTimeout, setInterval: () => 1, clearInterval: noop,
    requestAnimationFrame: () => 1, addEventListener: noop, matchMedia: () => ({ matches: false }), location: { origin: 'http://x' }
  };
  sandbox.window = sandbox;
  sandbox.parent = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  const run = (p) => vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p });

  run('public/js/melee_anim.js');
  run('public/js/crysto/arms.js');
  run('public/js/crysto/weapons.js');
  console.log('MeleeAnim on the page:', !!sandbox.MeleeAnim, '| swing of a jab:', sandbox.MeleeAnim.pose('common_punch1', 'punch', .55, 1).pz.toFixed(2));

  const C = sandbox.Crysto;
  C.hud = { setArms: noop, banner: noop };
  C.save = { auto: noop };
  C.quest = { attack: noop, kill: noop, state: { enemies: [] } };
  C.camera = new T.PerspectiveCamera(58, 1.6, 5, 30000);
  C.camera.position.set(0, 100, 0);
  C.camera.lookAt(0, 100, -10);
  C.player = () => ({ x: 0, y: 60, z: 0 });
  C.getLook = () => ({ yaw: 0, pitch: 0 });

  const scene = new T.Scene();
  C.weapons.init(scene, 1.6);
  const fist = C.weapons.arm;
  console.log('in hand:', fist.name, '|', fist.kind);
  const depth = slices.reduce((a, m) => Math.max(a, Math.abs(m.position.z)), 0);
  console.log('fist slices', slices.length, '| half depth', depth.toFixed(1));

  C.weapons.trigger();
  let swung = 0;
  for (let i = 0; i < 30; i++) {
    C.weapons.update(0.016, false);
    scene.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.index && o.material && o.material.depthTest === false) swung++; });
  }
  console.log('strike ribbon meshes drawn:', swung > 0);

  // The card must lie ALONG the view axis (its long axis pointing away from the
  // eye), not across it: a card across the view is exactly what "the melee is
  // horizontal" looked like.
  const body = slices[0].parent;
  const e = body.matrix.elements;
  const ax = { x: e[0], y: e[1], z: e[2] };
  const alen = Math.hypot(ax.x, ax.y, ax.z) || 1;
  console.log('fist long axis', (ax.x / alen).toFixed(2), (ax.y / alen).toFixed(2), (ax.z / alen).toFixed(2));
  if (Math.abs(ax.z / alen) < 0.9) { console.log('FAILED: the fist still lies across the view'); process.exit(1); }

  // and a jab must drive it away from the eye without throwing it off screen
  C.weapons.trigger();
  const model = slices[0].parent.parent;
  let zNear = 1e9, zFar = -1e9;
  for (let i = 0; i < 45; i++) {
    C.weapons.update(0.016, false);
    zNear = Math.min(zNear, model.position.z);
    zFar = Math.max(zFar, model.position.z);
  }
  console.log('jab travel z', zFar.toFixed(1), '->', zNear.toFixed(1));
  if (!(zNear < zFar)) { console.log('FAILED: the punch does not drive forward'); process.exit(1); }
  if (zNear < -140) { console.log('FAILED: the punch flies out of the frame'); process.exit(1); }

  C.weapons.dispose();
  console.log('OK');
})().catch((e) => { console.log('FAILED', e && e.message); console.log((e && e.stack || '').split('\n').slice(0, 6).join('\n')); process.exit(1); });