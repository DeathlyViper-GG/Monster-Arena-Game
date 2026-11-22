/* Headless check of the shot: a round must leave the barrel toward the point
   the crosshair is on, not parallel to the view. Run: node src/scripts/shot_probe.cjs */
const fs = require('fs'), vm = require('vm');
const noop = () => {};

function ctx2d() {
  const base = {
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    getImageData: () => ({ data: [] })
  };
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
}
function el(tag) {
  const n = {
    tagName: tag, style: {}, children: [], width: 64, height: 64, crossOrigin: '',
    getAttribute: () => null, setAttribute: noop,
    appendChild(c) { this.children.push(c); return c; },
    addEventListener: noop, removeEventListener: noop,
    classList: { add: noop, remove: noop, toggle: noop }
  };
  n.getContext = () => ctx2d();
  return n;
}
global.document = {
  createElement: el, createElementNS: (a, b) => el(b), getElementById: () => null,
  querySelector: () => null, querySelectorAll: () => [], addEventListener: noop,
  body: el('body'), head: el('head')
};
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

(async () => {
  const THREE = await import('three');
  const T = {};
  for (const k of Object.keys(THREE)) T[k] = THREE[k];

  const sandbox = {
    console, THREE: T, document: global.document, localStorage: global.localStorage,
    navigator: { userAgent: 'node' }, performance: { now: () => Date.now() },
    setTimeout: () => 1, clearTimeout: noop, setInterval: () => 1, clearInterval: noop,
    requestAnimationFrame: () => 1, addEventListener: noop,
    matchMedia: () => ({ matches: false }), location: { origin: 'http://x' }
  };
  sandbox.window = sandbox; sandbox.parent = sandbox; sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('public/js/shop_gun_preview.js', 'utf8'), ctx, { filename: 'shop.js' });
  vm.runInContext(fs.readFileSync('public/js/crysto/weapons.js', 'utf8'), ctx, { filename: 'weapons.js' });

  const C = sandbox.Crysto;
  C.hud = { setArms: noop, banner: noop };
  C.save = { auto: noop };
  C.quest = { attack: noop, kill: noop, state: { enemies: [] } };
  C.monsters = { hit: () => false };
  C.camera = new T.PerspectiveCamera(58, 1.6, 5, 30000);
  C.camera.position.set(0, 120, 0);
  C.camera.lookAt(0, 120, -10);
  C.camera.updateMatrixWorld();
  C.player = () => ({ x: 0, y: 100, z: 0 });

  const scene = new T.Scene();
  C.weapons.init(scene, 1.6);
  C.weapons.give('pistol');
  C.weapons.equip('pistol');
  for (let i = 0; i < 30; i++) C.weapons.update(0.016, false);

  // A still hand: with the spread rolled flat the aim point sits exactly on the
  // crosshair's own ray, so a converged tracer must pass through it while a
  // parallel one misses by the muzzle's own offset.
  vm.runInContext('Math.random = () => 0.5;', ctx);

  const bulletAt = () => {
    const m = scene.children.find((o) => o.isMesh && o.matrixAutoUpdate === false && o.material && o.material.uniforms);
    return m ? new T.Vector3().setFromMatrixPosition(m.matrix) : null;
  };

  let fails = 0;
  const check = (label, ok, extra) => {
    if (!ok) fails++;
    console.log((ok ? '  ok   ' : '  FAIL ') + label + (extra ? ' | ' + extra : ''));
  };

  C.weapons.trigger();
  let p1 = null, p2 = null;
  for (let i = 0; i < 4; i++) {
    C.weapons.update(0.016, false);
    if (!p1) p1 = bulletAt();
    else if (!p2) p2 = bulletAt();
  }
  const lineDist = (p, a, d) => {
    const w = p.clone().sub(a);
    return w.addScaledVector(d, -w.dot(d)).length();
  };
  const camFwd = C.camera.getWorldDirection(new T.Vector3());
  // the point the shot is aimed at: the far end of the crosshair's own ray
  const reach = Math.min(C.weapons.arm.range || 1600, 1600);
  const aim = C.camera.getWorldPosition(new T.Vector3()).addScaledVector(camFwd, reach);
  const flight = p2.clone().sub(p1).normalize();
  const miss = lineDist(aim, p1, flight);
  const parallel = lineDist(aim, p1, camFwd);
  check('the shot converges on the crosshair', miss < 3,
    'off by ' + miss.toFixed(2) + ' (a parallel tracer is ' + parallel.toFixed(2) + ' off)');
  check('and it is not simply flying parallel', parallel > miss + 1, parallel.toFixed(2) + ' vs ' + miss.toFixed(2));

  // the aim-down-sights shot converges too
  C.weapons.aim(true);
  for (let i = 0; i < 40; i++) C.weapons.update(0.016, false);
  for (let i = 0; i < 200; i++) C.weapons.update(0.016, false);
  C.weapons.trigger();
  let q1 = null, q2 = null;
  for (let i = 0; i < 4; i++) {
    C.weapons.update(0.016, false);
    if (!q1) q1 = bulletAt();
    else if (!q2) q2 = bulletAt();
  }
  const adsFlight = q2.clone().sub(q1).normalize();
  const adsAim = C.camera.getWorldPosition(new T.Vector3())
    .addScaledVector(C.camera.getWorldDirection(new T.Vector3()), reach);
  check('the sights converge as well', lineDist(adsAim, q1, adsFlight) < 3,
    lineDist(adsAim, q1, adsFlight).toFixed(2));

  C.weapons.dispose();
  console.log(fails ? 'FAILED ' + fails : 'OK');
  if (fails) process.exit(1);
})().catch((e) => { console.log('FAILED', e && e.message); console.log((e.stack || '').split('\n').slice(0, 5).join('\n')); process.exit(1); });