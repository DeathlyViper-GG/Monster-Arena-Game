/* Headless build + quest check for Crysto. Run: node src/scripts/crysto_check.cjs */
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
// three is imported as a real module, so it reads the real global document
global.document = document;
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

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
    location: { search: '', origin: 'http://x' }, parent: null,
    matchMedia: () => ({ matches: false })
  };
  sandbox.window = sandbox;
  sandbox.parent = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  const load = (f) => vm.runInContext(fs.readFileSync(path.join('public/js/crysto', f), 'utf8'), ctx, { filename: f });
  ['noise.js', 'materials.js', 'terrain.js', 'props.js', 'npc.js', 'town.js', 'cave.js', 'monsters.js', 'weapons.js', 'save.js', 'bossroom.js', 'quest.js', 'hud.js'].forEach(load);

  const C = sandbox.Crysto;
  const scene = new T.Scene();

  const t0 = Date.now();
  const terrain = C.buildTerrain(scene);
  terrain.update(0, 520);
  console.log('terrain', Date.now() - t0, 'ms');

  const town = C.buildTown(scene);
  console.log('town | colliders', town.colliders.length, '| stones', Object.keys(town.stones).join(','));

  // ---- the cave the walk begins in ----
  const cave = C.buildCave(scene);
  const cols = town.colliders.concat(cave.colliders);
  const spawnFloor = C.caveFloor(cave.spawn.x, cave.spawn.z);
  const spawnClear = !cols.some((c) => Math.hypot(cave.spawn.x - c.x, cave.spawn.z - c.z) < c.r + 24);
  console.log('cave | colliders', cave.colliders.length, '| spawn floor', spawnFloor.toFixed(1), '| spawn clear', spawnClear);
  const CD = C.cave.dir, CC = C.cave.at;
  [0, 60, 96, 160, 240, 300, 400, 519, 540].forEach((a) => {
    const x = CC.x + CD.x * a, z = CC.z + CD.z * a;
    const f = C.caveFloor(x, z);
    const off = C.caveFloor(x + 60, z + 60);
    console.log('  along', a, 'floor', f == null ? 'land ' + C.height(x, z).toFixed(1) : f.toFixed(1), '| 85 off-axis', off == null ? 'land' : off.toFixed(1));
  });

  // HUD stand-in: dialogue advances immediately, exactly as a player clicking through.
  C.hud = {
    banner: noop, choose: noop, prompt: noop, setQuest: noop, setCompass: noop, setHearts: noop,
    build: () => ({}), show: noop, hide: noop, hideChoose: noop, advance: () => false, talking: false,
    say: (who, lines, done) => { if (done) done(); }
  };

  C.quest.init(scene, town);
  C.hurtPlayer = noop;
  const P = { x: 90, z: 60 };
  const call = (label) => {
    const t = C.quest.target(P);
    console.log(' ', label, '->', t ? t.label : 'nothing');
    if (t && t.run) t.run();
  };

  call('at Maera');
  console.log('  step', C.quest.state.step, '|', C.quest.tracker().objective);

  for (const d of C.places.shrines) {
    P.x = d.x; P.z = d.z;
    C.quest.tick(0.016, P);
    let guard = 0;
    while (C.quest.state.enemies.some((e) => !e.dead && e.home && e.home.id === d.id) && guard++ < 40) {
      const e = C.quest.state.enemies.find((x) => !x.dead && x.home && x.home.id === d.id);
      // step up to it, the way a player would
      P.x = e.pos.x - 90; P.z = e.pos.z;
      const dx = e.pos.x - P.x, dz = e.pos.z - P.z, l = Math.hypot(dx, dz) || 1;
      C.quest.attack(P, { x: dx / l, z: dz / l });
    }
    P.x = d.x; P.z = d.z;
    call('shrine ' + d.id);
    console.log('   lit', Object.keys(C.quest.state.lit).join(','), '| step', C.quest.state.step);
  }

  P.x = 90; P.z = 60;
  call('back at Maera');
  console.log('  step', C.quest.state.step, '|', C.quest.tracker().objective);

  P.x = C.places.keep.x; P.z = C.places.keep.z;
  C.quest.tick(0.016, P);
  console.log('  keep -> step', C.quest.state.step, '| enemies', C.quest.state.enemies.length);
  let g2 = 0;
  while (C.quest.state.enemies.some((e) => !e.dead) && g2++ < 80) {
    const e = C.quest.state.enemies.find((x) => !x.dead);
    P.x = e.pos.x - 110; P.z = e.pos.z;
    const dx = e.pos.x - P.x, dz = e.pos.z - P.z, l = Math.hypot(dx, dz) || 1;
    C.quest.attack(P, { x: dx / l, z: dz / l });
  }
  console.log('  boss dead', C.quest.state.bossDead, '| step', C.quest.state.step);

  P.x = C.places.keep.x; P.z = C.places.keep.z;
  call('at the Sunstone');
  console.log('  done', C.quest.state.done, '| step', C.quest.state.step, '|', C.quest.tracker().objective);

  // The walker's first step must be clear ground, and nothing may be built into
  // anything else.
  const blockedAt = (x, z) => town.colliders.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 26);
  console.log('spawn clear', !blockedAt(470, 250), '| ground', C.height(470, 250).toFixed(1));
  let tight = 0;
  for (let i = 0; i < town.colliders.length; i++) {
    for (let j = i + 1; j < town.colliders.length; j++) {
      const a = town.colliders[i], b = town.colliders[j];
      if (Math.hypot(a.x - b.x, a.z - b.z) < (a.r + b.r) * 0.7) tight++;
    }
  }
  console.log('colliders built into each other', tight);

  let townMeshes = 0;
  town.root.traverse((o) => { if (o.isMesh) townMeshes++; });
  console.log('town meshes', townMeshes);

  let nanMeshes = 0, textured = 0;
  town.root.updateMatrixWorld(true);
  town.root.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.getWorldPosition(new T.Vector3());
    if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) nanMeshes++;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((mm) => mm && mm.map)) textured++;
  });
  console.log('nan meshes', nanMeshes, '| textured meshes', textured);

  let inst = 0;  scene.traverse((o) => { if (o.isInstancedMesh) inst += o.count; });
  console.log('scenery pieces', inst);

  // ---- the sanctums: a shrine's boss room ----
  C.bossroom.build(scene, town.colliders);
  C.teleport = (x, z) => { P.x = x; P.z = z; };
  let won = false;
  const entered = C.bossroom.enter('root', () => { won = true; });
  const boss = C.quest.state.enemies.find((e) => e.shrineBoss === 'root');
  console.log('sanctum entered', entered, '| boss', boss ? boss.kind + ' hp ' + boss.hp : 'none',
    '| player at', P.x.toFixed(0), P.z.toFixed(0), '| site', C.sanctums.root.x, C.sanctums.root.z);
  let g3 = 0;
  while (boss && !boss.dead && g3++ < 200) {
    if (C.monsters.hit(boss, 100)) C.quest.kill(boss);
  }
  for (let i = 0; i < 40; i++) C.bossroom.update(0.1, i * 0.1);
  console.log('sanctum won', won, '| still active', C.bossroom.active(), '| arms', C.weapons.state.owned.join(','));

  console.log('OK');
})().catch((e) => {
  console.log('FAILED', e && e.message);
  console.log((e && e.stack || '').split('\n').slice(0, 6).join('\n'));
  process.exit(1);
});