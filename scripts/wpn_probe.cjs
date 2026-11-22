/* Headless check of Crysto's first-person arms. Run: node scripts/wpn_probe.cjs */
const fs = require('fs'), vm = require('vm'), path = require('path');
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
global.document = document;
const store = {};
const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };

(async () => {
  const THREE = await import('three');
  const T = {};
  for (const k of Object.keys(THREE)) T[k] = THREE[k];
  const sandbox = {
    console, THREE: T, document, localStorage, window: null, navigator: { userAgent: 'node' },
    performance: { now: () => Date.now() }, setTimeout, clearTimeout, setInterval: () => 1, clearInterval: noop,
    requestAnimationFrame: () => 1, addEventListener: noop, matchMedia: () => ({ matches: false }), location: { origin: 'http://x' }
  };
  sandbox.window = sandbox;
  sandbox.parent = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('public/js/shop_gun_preview.js', 'utf8'), ctx, { filename: 'shop_gun_preview.js' });
  console.log('arena builder exposed:', typeof sandbox.ShopGunPreview.build);
  vm.runInContext(fs.readFileSync('public/js/crysto/arms.js', 'utf8'), ctx, { filename: 'arms.js' });
  vm.runInContext(fs.readFileSync('public/js/crysto/weapons.js', 'utf8'), ctx, { filename: 'weapons.js' });

  const C = sandbox.Crysto;
  C.hud = { setArms: noop, banner: noop };
  C.save = { auto: noop };
  C.quest = { attack: noop, kill: noop, state: { enemies: [] } };
  C.camera = new T.PerspectiveCamera(58, 1.6, 5, 30000);
  C.camera.position.set(0, 100, 0);
  C.camera.lookAt(0, 100, -10);
  C.player = () => ({ x: 0, y: 60, z: 0 });

  const scene = new T.Scene();
  C.weapons.init(scene, 1.6);
  console.log('starts with', C.weapons.state.owned.join(','), '| equipped', C.weapons.equipped);

  for (const id of ['pistol', 'rifle', 'scatter', 'storm', 'dawn']) {
    C.weapons.give(id);
    const arm = C.weapons.arm;
    // the pit's rig itself: gun parts + both hands, posed as the arena poses it
    const rig = sandbox.Crysto.arms.build(arm.model || 'smg', '#98d7ff');
    rig.pose(6.8, -5.8, -17.8, 0.25, 0, 0, 0, 0.4);
    let meshes = 0;
    rig.group.traverse((o) => { if (o.isMesh) meshes++; });
    const bb = new T.Box3().setFromObject(rig.group);
    const sz = bb.getSize(new T.Vector3());
    C.weapons.trigger();
    C.weapons.update(0.016, true);
    console.log(' ', id.padEnd(8), '|', arm.name.padEnd(18), '| model', (arm.model || '—').padEnd(10),
      '| parts', String(meshes).padStart(3),
      '| size', sz.x.toFixed(1) + 'x' + sz.y.toFixed(1) + 'x' + sz.z.toFixed(1),
      '| ammo', C.weapons.ammoText());
  }
  C.weapons.dispose();
  console.log('OK');
})().catch((e) => { console.log('FAILED', e && e.message); console.log((e && e.stack || '').split('\n').slice(0, 5).join('\n')); process.exit(1); });