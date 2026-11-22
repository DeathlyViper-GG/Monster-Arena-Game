/* Headless check of the Hollow Reach: the land, the towns, the people, the
   camps and the doorway. Run: node src/scripts/reach_probe.cjs */
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
  ['noise.js', 'materials.js', 'terrain.js', 'props.js', 'npc.js', 'town.js', 'cave.js', 'monsters.js', 'weapons.js', 'save.js', 'quest.js', 'hud.js',
    'herbs.js', 'reach/world.js', 'reach/camps.js', 'reach/broods.js', 'reach/people.js', 'reach/reach.js'].forEach(load);

  const C = sandbox.Crysto;
  const R = C.reach;
  const scene = new T.Scene();
  let fails = 0;
  const check = (label, ok, extra) => {
    if (!ok) fails++;
    console.log((ok ? '  ok   ' : '  FAIL ') + label + (extra ? ' | ' + extra : ''));
  };

  // HUD stand-in: dialogue advances immediately, as a player clicking through.
  C.hud = {
    banner: noop, prompt: noop, setQuest: noop, setCompass: noop, setHearts: noop, setBoss: noop,
    // the villager menu: a player always picks the first line, which is "Talk"
    choose: (title, items) => { if (items && items[0] && items[0].run) items[0].run(); },
    build: () => ({}), show: noop, hide: noop, hideChoose: noop, advance: () => false, talking: false,
    say: (who, lines, done) => { if (done) done(); }
  };

  const t0 = Date.now();
  const terrain = C.buildTerrain(scene);
  terrain.update(0, 520);
  const town = C.buildTown(scene);
  C.quest.init(scene, town);
  C.terrain = terrain;
  R.build(scene, town.colliders);
  console.log('world built in', Date.now() - t0, 'ms');

  // ---- the land itself ----
  const vale = C.height(0, 0);
  check('the vale is untouched', Math.abs(vale - 46) < 3, 'village ground ' + vale.toFixed(1));
  const sea = C.height(0, 27500);
  check('a sea lies between the two lands', sea < 0, 'mid-water ' + sea.toFixed(0));
  R.villages.forEach((v) => {
    const h = C.height(v.x, v.z);
    const flat = Math.abs(C.height(v.x + 200, v.z) - h) < 6 && Math.abs(C.height(v.x, v.z + 200) - h) < 6;
    check('ground under ' + v.name, h > 60 && flat, 'height ' + h.toFixed(0) + (flat ? ' flat' : ' SLOPED'));
  });
  const reachCol = C.colorAt(-15000, 40000, C.height(-15000, 40000), 0.1);
  const valeCol = C.colorAt(0, 0, 46, 0.1);
  check('the Reach has its own palette', Math.abs(reachCol[1] - valeCol[1]) > 0.12,
    'green ' + reachCol[1].toFixed(2) + ' vs vale ' + valeCol[1].toFixed(2));
  const far = C.height(0, 52000);
  check('the continent runs south', far > 60, 'deep south ground ' + far.toFixed(0));

  // ---- the towns ----
  const houseCols = town.colliders.length;
  let villageMeshes = 0;
  scene.traverse((o) => { if (o.isMesh) villageMeshes++; });
  check('three towns are built', R.works && R.works.crown.length === 3 && R.works.greens.length === 3,
    'colliders ' + houseCols + ' | meshes ' + villageMeshes);
  check('eight people stand in the Reach', R.people.NPCS.length === 8, R.people.NPCS.map((n) => n.name).join(', '));
  check('every person is out of the walls', R.people.NPCS.every((n) => !town.colliders.some((c) => Math.hypot(n.x - c.x, n.z - c.z) < c.r + 30)));

  // ---- the camps ----
  check('six camps in the wilds', R.camps.length === 6);
  const P = { x: 0, z: 0 };
  P.x = R.camps[0].x; P.z = R.camps[0].z;
  R.tickCamps(0.016, P);
  const live = C.quest.state.enemies.filter((e) => e.camp === R.camps[0].id);
  check('walking into a camp raises its band', live.length === 3, live.map((e) => e.kind).join(', '));
  live.forEach((e) => { while (!e.dead) { if (C.monsters.hit(e, 100)) C.quest.kill(e); } });
  R.tickCamps(0.016, P);
  check('clearing a camp breaks it', R.camps[0].broken && R.people.state.campsBroken === 1,
    'broken ' + R.people.state.campsBroken + '/3');

  // ---- the three pieces of work ----
  const at = (n) => { P.x = n.x; P.z = n.z; };
  const talk = (id) => {
    const n = R.people.NPCS.find((x) => x.id === id);
    at(n);
    const t = R.people.target(P);
    if (t && t.run) t.run();
    return t ? t.label : 'nothing';
  };

  talk('marrow');
  check('Marrow sets the shore road', R.people.state.active === 'camps', R.people.tracker().objective);

  R.camps.filter((c) => c.quest === 'camps').forEach((c) => {
    P.x = c.x; P.z = c.z;
    R.tickCamps(0.016, P);
    C.quest.state.enemies.filter((e) => e.camp === c.id).forEach((e) => {
      while (!e.dead) { if (C.monsters.hit(e, 100)) C.quest.kill(e); }
    });
    R.tickCamps(0.016, P);
  });
  check('all three raider camps broken', R.people.state.campsBroken === 3, R.people.tracker().objective);
  talk('marrow');
  check('Marrow pays for the shore road', R.people.state.done.camps === true);

  talk('orla');
  check('Orla asks for Wren', R.people.state.active === 'scout', R.people.tracker().objective);
  const wren = R.people.NPCS.find((n) => n.id === 'wren');
  check('Wren stands where the wayfinder points', Math.hypot(R.people.tracker().target.x - wren.x, R.people.tracker().target.z - wren.z) < 200);
  talk('wren');
  check('Wren is found', R.people.state.scout === 1, R.people.tracker().objective);
  talk('orla');
  check('Orla has her daughter back', R.people.state.done.scout === true);

  talk('kaelen');
  check('Kaelen asks for the three fires', R.people.state.active === 'braziers', R.people.tracker().objective);
  R.works.crown.forEach((b) => {
    P.x = b.pos.x; P.z = b.pos.z;
    const t = R.people.target(P);
    if (t && t.run) t.run();
  });
  check('all three braziers lit', R.people.state.braziersLit === 3 && R.works.crown.every((b) => b.lit),
    R.people.tracker().objective);
  talk('kaelen');
  check('Kaelen closes the watch', R.people.state.done.braziers === true);

  // ---- the doorway ----
  let where = { x: 0, z: 0 };
  C.teleport = (x, z) => { where = { x: x, z: z }; P.x = x; P.z = z; };
  C.setLook = noop;
  C.player = () => P;
  P.x = 430; P.z = -450;
  const door = R.target(P);
  check('the doorway waits on the vale green', door && /Hollow Doorway/.test(door.label), door && door.label);
  if (door && door.run) door.run();
  check('stepping through lands on the Reach shore', where.z > 30000 && P.respawn.z > 30000,
    'landed at ' + where.x + ',' + where.z);
  P.x = 0; P.z = 30700;
  const back = R.target(P);
  check('and back again from the far side', back && /Drane Vale/.test(back.label), back && back.label);
  if (back && back.run) back.run();
  check('the vale is where you come out', where.z < 0, 'landed at ' + where.x + ',' + where.z);

  // ---- the ledger ----
  R.save();
  const raw = JSON.parse(localStorage.getItem('crysto_reach_v1') || 'null');
  check('the Reach remembers itself', !!raw && raw.q.done.camps && Object.keys(raw.broken).length === 3,
    'broken ' + Object.keys(raw.broken || {}).length);

  // ---- the five broods, and what brooded them ----
  R.people.state.active = 'broods';
  check('five broods stand in five countries', R.broods.length === 5,
    R.broods.map((b) => b.country).join(', '));
  R.broods.forEach((b) => {
    P.x = b.x; P.z = b.z;
    R.tickBroods(0.016, P);
    C.quest.state.enemies.filter((e) => e.brood === b.id).forEach((e) => {
      while (!e.dead) { if (C.monsters.hit(e, 100)) C.quest.kill(e); }
    });
    R.tickBroods(0.016, P);
  });
  check('every brood can be broken', R.broodsCleared() === 5, R.broodsCleared() + '/5');
  talk('marrow');
  check('Marrow turns to what brooded them',
    R.people.state.done.broods === true && R.people.state.active === 'matriarch',
    R.people.tracker().title);
  P.x = 11000; P.z = 51200;
  R.tickBroods(0.016, P);
  const mat = C.quest.state.enemies.find((e) => e.matriarch);
  check('the Matriarch comes up out of the crown', !!mat, mat && mat.name);
  if (mat) { while (!mat.dead) { if (C.monsters.hit(mat, 400)) C.quest.kill(mat); } }
  check('her fall closes the Reach', R.people.state.done.matriarch === true);

  // ---- trade: rounds for runestones, elixirs for a stronger heart ----
  sandbox.RS = { balance: () => 500, spend: (n) => { sandbox.__spent = n; return true; } };
  C.weapons.give('pistol');
  C.quest.state.elixirs = { a: true, b: true, c: true };
  let upgraded = 0;
  C.upgradeHealth = (n) => { upgraded += n; };
  const rounds0 = C.weapons.state.reserve.pistol || 0;
  C.hud.choose = (title, items) => { if (items[1] && items[1].run) items[1].run(); };
  talk('marrow');
  check('a villager sells rounds', (C.weapons.state.reserve.pistol || 0) > rounds0,
    '+' + ((C.weapons.state.reserve.pistol || 0) - rounds0) + ' rounds for ' + sandbox.__spent + ' runestones');
  C.hud.choose = (title, items) => { if (items[2] && items[2].run) items[2].run(); };
  talk('marrow');
  check('three elixirs buy a stronger heart', upgraded === 50 && C.quest.elixirCount() === 0,
    'max health +' + upgraded);

  // ---- what grows ----
  C.heal = (n) => n;
  C.herbs.build(scene);
  check('stands of healing plants grow across both lands', C.herbs.list.length > 20, C.herbs.list.length + ' stands');
  const stand = C.herbs.list[0];
  P.x = stand.x; P.z = stand.z; P.hp = 50; P.maxHp = 100;
  C.herbs.tick(0.016, P);
  check('walking through one puts life back', stand.ready === false);

  // ---- nothing broken in the world ----
  let nan = 0, meshes = 0;
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh && !o.isSprite) return;
    meshes++;
    const p = o.getWorldPosition(new T.Vector3());
    if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) nan++;
  });
  check('no mesh in the world is NaN', nan === 0, meshes + ' meshes');
  const ground = C.height(R.LANDING.x, R.LANDING.z);
  check('the landing is dry ground', ground > 8, 'height ' + ground.toFixed(0));
  const stuck = town.colliders.filter((c) => !isFinite(c.x) || !isFinite(c.z) || !isFinite(c.r)).length;
  check('every wall is a real wall', stuck === 0, town.colliders.length + ' colliders');

  console.log(fails ? 'FAILED ' + fails : 'OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.log('FAILED', e && e.message);
  console.log((e && e.stack || '').split('\n').slice(0, 8).join('\n'));
  process.exit(1);
});