/* Headless check of the shrine halls. Run: node scripts/shrine_probe.cjs */
const fs = require('fs'), vm = require('vm');
const noop = () => {};

function el(tag) {
  const n = {
    tagName: tag, style: {}, children: [], className: '', textContent: '',
    getAttribute: () => null, setAttribute: noop,
    appendChild(c) { this.children.push(c); return c; },
    addEventListener: noop, removeChild: noop,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false }
  };
  if (tag === 'canvas') {
    n.width = 64; n.height = 64;
    const grad = () => ({ addColorStop: noop });
    n.getContext = () => ({
      createRadialGradient: grad, createLinearGradient: grad, fillRect: noop,
      strokeRect: noop, beginPath: noop, arc: noop, fill: noop, stroke: noop,
      moveTo: noop, lineTo: noop, save: noop, restore: noop,
      fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
      globalCompositeOperation: 'source-over', putImageData: noop,
      getImageData: () => ({ data: new Uint8ClampedArray(4) }), drawImage: noop
    });
  }
  return n;
}
const document = {
  createElement: el, getElementById: () => null, querySelector: () => null,
  querySelectorAll: () => [], addEventListener: noop, body: el('body'), head: el('head')
};

(async () => {
  const THREE = await import('three');
  const T = {};
  for (const k of Object.keys(THREE)) T[k] = THREE[k];

  const sandbox = {
    console, THREE: T, document, navigator: { userAgent: 'node' },
    performance: { now: () => Date.now() }, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: noop, requestAnimationFrame: () => 1,
    addEventListener: noop, matchMedia: () => ({ matches: false }), location: { origin: 'http://x' }
  };
  sandbox.window = sandbox;
  sandbox.parent = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  const run = (p) => vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p });

  run('public/js/crysto/shrine.js');
  const C = sandbox.Crysto;

  // ---- the world the halls borrow ---------------------------------------
  const scene = new T.Scene();
  C.scene = scene;
  const shrine = {
    orb: new T.Mesh(new T.IcosahedronGeometry(4, 0), new T.MeshStandardMaterial()),
    rune: new T.Mesh(new T.TorusGeometry(9, 1, 4, 12), new T.MeshStandardMaterial()),
    halo: new T.Sprite(new T.SpriteMaterial())
  };
  const player = { x: -6200 + 260, z: 2600, y: 150, maxHp: 100, hp: 100 };
  let placed = null, cinematic = false, banners = [], elixir = null;
  const spawned = [];
  C.player = () => player;
  C.getLook = () => ({ yaw: 0, pitch: 0.05 });
  C.setLook = (y, p) => { player.yaw = y; player.pitch = p; };
  C.freeze = (on) => { player.frozen = on; };
  C.place = (x, z) => { placed = { x, z }; player.x = x; player.z = z; };
  C.teleport = (x, z) => { player.x = x; player.z = z; };
  C.groundAt = () => 150;
  C.hud = {
    banner: (a, b) => banners.push(a), prompt: noop, setHearts: noop,
    cinematic: (on) => { cinematic = on; }
  };
  C.quest = {
    state: { town: { shrines: { root: shrine }, colliders: [] }, enemies: [] },
    elixir: (id) => { elixir = id; }
  };
  C.monsters = {
    make: (kind, x, z) => {
      const e = { kind, pos: { x, z }, y: 0, height: 175, dead: false, mesh: new T.Group() };
      spawned.push(e);
      return e;
    }
  };

  const def = { id: 'root', name: 'Shrine of Root', x: -6200, z: 2600, color: 0x7dffa3 };

  C.shrine.activate(def);
  if (!cinematic) throw new Error('the waking film never started');
  let t = 0;
  while (t < 5 && !C.shrine.active()) { C.shrine.tick(0.05, player); t += 0.05; }
  console.log('film ran', t.toFixed(2) + 's | inside', C.shrine.active(), '| bars', cinematic);
  console.log('set down at', placed && Math.round(placed.x), placed && Math.round(placed.z));
  console.log('floor inside the hall', C.interiorFloor(placed.x, placed.z));
  console.log('waves called', spawned.length, '| colliders', C.quest.state.town.colliders.length);
  if (C.quest.state.town.colliders.length < 20) throw new Error('the hall has no walls');

  // walking to the far end
  const before = spawned.length;
  player.z = placed.z - 2500;
  C.shrine.tick(0.05, player);
  console.log('waves after the advance', spawned.length, '(was', before + ')');

  // the elixir
  const altarZ = placed.z - 3200 + 380;
  player.z = altarZ;
  console.log('prompt:', C.shrine.prompt(player));
  const took = C.shrine.use(player);
  console.log('took the elixir', took, '| quest heard', elixir, '| inside now', C.shrine.active());
  if (!took || elixir !== 'root') throw new Error('the elixir never reached the vigil');

  C.shrine.reset();
  console.log('OK');
})().catch((e) => { console.log('FAILED', e && e.message); console.log((e && e.stack || '').split('\n').slice(0, 6).join('\n')); process.exit(1); });