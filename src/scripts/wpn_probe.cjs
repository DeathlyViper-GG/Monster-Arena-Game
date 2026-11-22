/* temp probe: Crysto's fists + bullets */
const fs = require('fs'), vm = require('vm');
const noop = () => {};
function ctx2d() {
  const base = { measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }), getImageData: () => ({ data: [] }) };
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
}
function el(tag) {
  const n = { tagName: tag, style: {}, children: [], width: 64, height: 64, crossOrigin: '',
    getAttribute: () => null, setAttribute: noop, appendChild(c) { this.children.push(c); return c; },
    addEventListener: noop, removeEventListener: noop, classList: { add: noop, remove: noop } };
  n.getContext = () => ctx2d();
  return n;
}
global.document = { createElement: el, createElementNS: (ns, t) => el(t), getElementById: () => null,
  querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, body: el('body'), head: el('head') };
const store = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };

(async () => {
  const THREE = await import('three');
  const T = {}; for (const k of Object.keys(THREE)) T[k] = THREE[k];
  const sandbox = { console, THREE: T, document: global.document, localStorage: global.localStorage,
    navigator: { userAgent: 'node' }, performance: { now: () => Date.now() }, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: noop, requestAnimationFrame: () => 1, addEventListener: noop,
    matchMedia: () => ({ matches: false }), location: { origin: 'http://x' } };
  sandbox.window = sandbox; sandbox.parent = sandbox; sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('public/js/shop_gun_preview.js', 'utf8'), ctx, { filename: 'shop.js' });
  vm.runInContext(fs.readFileSync('public/js/crysto/weapons.js', 'utf8'), ctx, { filename: 'weapons.js' });

  const C = sandbox.Crysto;
  C.hud = { setArms: noop, banner: noop };
  C.save = { auto: noop };
  const enemy = { dead: false, pos: { x: 0, z: -900 }, y: 20, height: 175, hp: 90 };
  C.quest = { attack: noop, kill: (e) => { e.dead = true; }, state: { enemies: [enemy] } };
  C.monsters = { hit: (e, d) => { e.hp -= d; return e.hp <= 0; } };
  C.camera = new T.PerspectiveCamera(58, 1.6, 5, 30000);
  C.camera.position.set(0, 120, 0);
  C.camera.lookAt(0, 120, -10);
  C.camera.updateMatrixWorld();
  C.player = () => ({ x: 0, y: 100, z: 0 });

  const scene = new T.Scene();
  C.weapons.init(scene, 1.6);
  const arm = () => C.weapons.arm;

  console.log('start:', arm().name, '| sprite', C.weapons.spriteFor());
  C.weapons.trigger();
  for (let i = 0; i < 8; i++) C.weapons.update(0.016, true);
  console.log('punched, still', arm().name);

  for (const id of ['pistol', 'rifle', 'scatter', 'storm', 'dawn']) {
    C.weapons.give(id);
    C.weapons.trigger();
    let inAir = 0;
    for (let i = 0; i < 3; i++) { C.weapons.update(0.016, false); inAir += scene.children.filter((o) => o.type === 'Group' && o.children.some((c) => c.isSprite)).length; }
    console.log(' ', id.padEnd(8), 'speed', arm().speed, '| bullets in the air', inAir, '| enemy hp', enemy.hp);
    // let every round land
    for (let i = 0; i < 200; i++) C.weapons.update(0.016, false);
  }
  console.log('enemy dead:', enemy.dead, '| hud ammo', C.weapons.ammoText());
  // ---- aim down sights: the pit's own profile, table and timing ----
  C.weapons.equip('pistol');
  console.log('hip | zoom', C.weapons.zoom().toFixed(2), '| spread', C.weapons.spreadMul().toFixed(2),
    '| move', C.weapons.moveMul().toFixed(2), '| sens', C.weapons.sensMul().toFixed(2));
  C.weapons.aim(true);
  for (let i = 0; i < 40; i++) C.weapons.update(0.016, false);
  const rt = C.weapons.reticle();
  console.log('ads | zoom', C.weapons.zoom().toFixed(2), '| spread', C.weapons.spreadMul().toFixed(2),
    '| move', C.weapons.moveMul().toFixed(2), '| sens', C.weapons.sensMul().toFixed(2),
    '| reticle', rt.kind, 'gap', rt.gap.toFixed(1), 'alpha', rt.alpha.toFixed(2));
  C.weapons.aim(false);
  for (let i = 0; i < 40; i++) C.weapons.update(0.016, false);
  console.log('lowered | zoom', C.weapons.zoom().toFixed(2), '| alpha', C.weapons.reticle().alpha.toFixed(2));
  // the vale's rifle is a scoped marksman: the edges black out at full sight
  C.weapons.equip('rifle');
  C.weapons.aim(true);
  for (let i = 0; i < 40; i++) C.weapons.update(0.016, false);
  console.log('scoped | zoom', C.weapons.zoom().toFixed(2), '| vignette', C.weapons.reticle().scope.toFixed(2));
  C.weapons.aim(false);
  for (let i = 0; i < 40; i++) C.weapons.update(0.016, false);

  C.weapons.dispose();
  console.log('OK');
})().catch((e) => { console.log('FAILED', e && e.message, '\n', (e.stack || '').split('\n').slice(0, 4).join('\n')); process.exit(1); });