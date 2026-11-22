// Temp probe: replay the real bot AI + Teams mode against neutral golems.
const fs = require('fs');
const vm = require('vm');

const nowFn = () => Date.now();
const sandbox = {
  console,
  performance: { now: nowFn },
  Math, Date, JSON, Object, Array, Number, String, Boolean, Infinity, NaN, isFinite, isNaN,
  setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: { getItem: () => null, setItem: () => {} },
  document: {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      style: {}, getContext: () => null, appendChild: () => {}, remove: () => {},
      addEventListener: () => {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    }),
    addEventListener: () => {},
    body: {
      classList: { add: () => {}, remove: () => {}, toggle: () => {} }, style: {},
      appendChild: () => {},
    },
  },
  requestAnimationFrame: () => 0,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.addEventListener = () => {};
sandbox.dispatchEvent = () => {};
vm.createContext(sandbox);

vm.runInContext(fs.readFileSync(__dirname + '/../public/js/bot_sp.js', 'utf8'), sandbox, { filename: 'bot_sp.js' });
vm.runInContext(fs.readFileSync(__dirname + '/../public/js/teams_mode.js', 'utf8'), sandbox, { filename: 'teams_mode.js' });

const W = 8000, H = 5600;
const world = {
  w: W, h: H, walls: [], buildings: [], chests: [], hazards: [],
  isBlocked: () => false,
};
const ents = { bullets: [], ebullets: [], enemies: [], effects: [], pickups: [] };
const weapons = [
  { kind: 'pistol', name: 'Pistol', rof: 4.5, dmg: 12, speed: 900, spread: 0.03, shots: 1, ammo: 15, reserve: 90, reload: 1.2 },
  { kind: 'rifle', name: 'Rifle', rof: 8, dmg: 9, speed: 1200, spread: 0.04, shots: 1, ammo: 30, reserve: 120, reload: 1.6 },
  { kind: 'shotgun', name: 'Shotgun', rof: 1.4, dmg: 7, speed: 800, spread: 0.12, shots: 6, ammo: 6, reserve: 30, reload: 2.0 },
];
const player = { x: 700, y: H / 2, r: 16, hp: 100, hpMax: 100, ang: 0, z: 0, team: 0, weapon: 0, speed: 230 };

sandbox.TEAMS_MODE = true;
sandbox.PVP_MODE = true;
sandbox.BOTS_ENABLED = true;
sandbox.CTF_MODE = false;

const env = {
  world, ents, weapons, player, cam: { shake: 0 }, audio: null,
  losBlocked: () => false,
  losBlocked3D: () => false,
  moveWithCollide: (o, dx, dy) => { o.x += dx; o.y += dy; },
  addEffect: () => {},
  dist2: (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2,
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  rand: (a, b) => a + Math.random() * (b - a),
  rint: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pointInRect: () => false,
  openChest: () => {}, applyQuicksand: () => {}, applyIceSlide: () => {},
  resolveVoid: () => {}, applyBurn: () => {}, applyDrench: () => {}, stun: () => {},
  spawnDashTrail: () => {}, sweptDashDistance: () => 0, dropXpOrb: () => {}, dropPickup: () => {},
  hurtPlayer: () => {}, setKiller: () => {}, onBotDeath: () => {},
};
sandbox.initSPBots(player, ['#fff'], [0], { pistols: [null], rifles: [null], shotguns: [null], melee: [null], extra: [null] }, null);
sandbox.setBotEnv(env);
const BOTS = vm.runInContext('SP_BOTS', sandbox);
sandbox.Teams.init({ ...env, colors: ['#fff'], SP_BOTS: BOTS });

const golems = sandbox.Teams.getGolems();
const bots = BOTS;
const golemancers = bots.filter((b) => b.role === 'golemancer');
console.log('bots', bots.length, 'golemancers', golemancers.length, 'golems', golems.length);
console.log('golemancer teams', golemancers.map((b) => b.team).join(','));
console.log('golem thresholds', golems.slice(0, 4).map((g) => g.size + ':' + g.threshold).join(' '));

const dt = 1 / 60;
let fired = 0;
for (let f = 0; f < 60 * 40; f++) {
  const before = ents.ebullets.length;
  sandbox.updateSPBots(dt, player, ents, world, weapons, null);
  fired += Math.max(0, ents.ebullets.length - before);
  for (let i = ents.ebullets.length - 1; i >= 0; i--) {
    const b = ents.ebullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) ents.ebullets.splice(i, 1);
  }
  sandbox.Teams.tick(dt);
  if (f % (60 * 5) === 0) {
    console.log('t=' + Math.round(f * dt) + 's',
      'activated=' + golems.filter((g) => g.activated).length,
      'dmg0=' + Math.round(Math.max(0, ...golems.map((g) => g.dmg[0] || 0))),
      'dmg1=' + Math.round(Math.max(0, ...golems.map((g) => g.dmg[1] || 0))),
      'alive=' + golems.filter((g) => !g._dead).length,
      'ebullets=' + ents.ebullets.length);
  }
}

console.log('golemancers at end', golemancers.map((b) => ({
  team: b.team, hp: Math.round(b.hp), ammo: b.ammo, d2golem: Math.round(Math.min(...golems.filter((g) => !g.activated).map((g) => Math.hypot(g.x - b.x, g.y - b.y)))),
})));
console.log('activated total', golems.filter((g) => g.activated).length, 'shots fired', fired);