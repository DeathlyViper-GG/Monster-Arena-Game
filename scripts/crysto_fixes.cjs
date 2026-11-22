/* Checks the four things this pass changed: damage numbers, the monsters' roll,
   the restart button and a clean reset. Run: node scripts/crysto_fixes.cjs */
const fs = require('fs'), vm = require('vm'), path = require('path');
const noop = () => {};

function ctx2d() {
  const base = { measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }), getImageData: () => ({ data: [] }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4), width: w, height: h }),
    putImageData: noop, fillRect: noop };
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
}
const made = [];
function el(tag) {
  const node = {
    tagName: tag, style: {}, dataset: {}, children: [], innerHTML: '', textContent: '', className: '', type: '',
    clientWidth: 120, clientHeight: 120, parentNode: null,
    classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); },
      toggle(c, on) { if (on) this.set.add(c); else this.set.delete(c); }, contains(c) { return this.set.has(c); } },
    addEventListener: noop, removeEventListener: noop,
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; }, remove: noop, setAttribute: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 120, height: 120 })
  };
  if (tag === 'canvas') { node.width = 128; node.height = 128; node.getContext = () => ctx2d(); }
  made.push(node);
  return node;
}
const document = { createElement: el, createElementNS: (ns, tag) => el(tag),
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  addEventListener: noop, body: el('body'), head: el('head') };
global.document = document;
const store = {};
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
    location: { search: '', origin: 'http://x', reload: noop }, parent: null, matchMedia: () => ({ matches: false }),
    innerWidth: 1280, innerHeight: 720
  };
  sandbox.window = sandbox;
  sandbox.parent = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  const load = (f) => vm.runInContext(fs.readFileSync(path.join('public/js/crysto', f), 'utf8'), ctx, { filename: f });
  ['noise.js', 'materials.js', 'terrain.js', 'props.js', 'monsters.js', 'arms.js', 'weapons.js', 'damage.js', 'hud.js'].forEach(load);

  const C = sandbox.Crysto;
  const scene = new T.Scene();
  C.scene = scene;
  const camera = new T.PerspectiveCamera(58, 1.6, 5, 30000);
  camera.position.set(0, 200, 400);
  camera.lookAt(0, 100, 0);
  camera.updateMatrixWorld(true);
  C.camera = camera;

  let fail = 0;
  const check = (label, ok, extra) => { console.log((ok ? '  ok   ' : '  FAIL ') + label + (extra ? ' | ' + extra : '')); if (!ok) fail++; };

  // ---- the standee stands up ----
  const e = C.monsters.make('ravener', 300, 300);
  // the village pushes a spawn out to the treeline, so the eye goes to it
  camera.position.set(e.pos.x, e.y + 320, e.pos.z + 700);
  camera.lookAt(e.pos.x, e.y + 110, e.pos.z);
  camera.updateMatrixWorld(true);
  C.monsters.update(e, 0.016, 1, { x: e.pos.x - 400, z: e.pos.z }, camera);
  const billUp = new T.Vector3(0, 1, 0).applyQuaternion(e.bill.quaternion);
  const camUp = new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const roll = Math.round(billUp.angleTo(camUp) * 180 / Math.PI);
  check('sprite rolled a quarter turn', Math.abs(roll - 90) < 2, 'roll ' + roll + '°');

  // ---- a blow reads out over the monster ----
  C.damage(e.pos.x, e.y + e.height * 0.6, e.pos.z, 42);
  C.damageTick(0.05);
  const layer = made.filter((n) => n.id === 'cyDmg').pop() || document.body.children.find((n) => n.id === 'cyDmg');
  const numbers = layer ? layer.children.filter((n) => /cy-dmg/.test(n.className)) : [];
  check('damage number on screen', numbers.length === 1 && numbers[0].textContent === '42',
    numbers.length ? numbers[0].textContent + ' @ ' + numbers[0].style.transform : 'none');
  check('number is placed, not stacked at 0,0', numbers.length && /translate3d\(/.test(numbers[0].style.transform || ''));

  // and a real hit through the monster's own damage entry pops one too
  const before = numbers.length;
  C.monsters.hit(e, 62);
  C.damageTick(0.05);
  const after = layer.children.filter((n) => /cy-dmg/.test(n.className) && n.style.display !== 'none').length;
  check('hit() pops its own number', after > before, before + ' -> ' + after);

  // ---- the restart button ----
  C.hud.build();
  const reset = made.filter((n) => /cy-reset/.test(n.className)).pop();
  check('restart button in the HUD', !!reset && reset.textContent === 'Restart progress');

  // ---- a clean reset ----
  C.weapons.state.owned.push('dawn');
  C.weapons.state.equipped = 'dawn';
  C.weapons.save();
  C.save = { clear: () => { store.crysto_vigil_v1 = undefined; } };
  C.weapons.reset();
  check('arms back to bare knuckles', C.weapons.state.owned.join(',') === 'fists' && C.weapons.equipped === 'fists',
    C.weapons.state.owned.join(','));
  check('saved arms erased', !localStorage.getItem('crysto_arms_v1'));

  console.log(fail ? 'FAILED ' + fail : 'OK');
  if (fail) process.exit(1);
})().catch((e) => { console.log('FAILED', e && e.message); console.log((e && e.stack || '').split('\n').slice(0, 6).join('\n')); process.exit(1); });