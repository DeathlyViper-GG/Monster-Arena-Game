const fs = require('fs'), vm = require('vm');
const win = {}; win.window = win;
win.Image = class { constructor(){ this.naturalWidth=0; } set src(v){} };
win.HearthWarden = { setEnv(o){ win.__henv = o; } };
win.console = console;
win.document = { createElement: () => ({ style:{}, set textContent(v){} }), head: { appendChild(){} }, body:{ appendChild(){} } };
vm.createContext(win);
for (const f of ['boss_sealwright.js','boss_choir_ash.js','elem_monsters.js']) {
  try { vm.runInContext(fs.readFileSync('/app/public/js/'+f,'utf8'), win, {filename:f}); }
  catch (err) { console.log('load fail', f, err.message); }
}
const player = { x:500, y:500, r:14, z:0, vx:0, vy:0 };
const env = { ents:{enemies:[],bullets:[]}, player, world:{w:2000,h:2000}, cam:{shake:0},
  addEffect(){}, hurtPlayer(){}, spawnEBullet(){}, dist2:(a,b,c,d)=>(a-c)**2+(b-d)**2,
  angleTo:(a,b,c,d)=>Math.atan2(d-b,c-a), clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  lerp:(a,b,t)=>a+(b-a)*t, rand:(a,b)=>a+Math.random()*(b-a), isNetActive:()=>false,
  moveWithCollide(){}, aoeDamage(){}, spawnBomb(){}, addWorldVfx(){}, audio:{}, state:{wave:5} };
win.HearthWarden.setEnv(env);

function spawn(type, chapter, active) {
  win.SENTINEL_ACTIVE = active !== false;
  win.SENTINEL_CHAPTER = chapter;
  const e = { type, x:900, y:900, r:42, hp:1000, maxhp:1000, vx:0, vy:0 };
  win.ElemMonsters.tune(e);
  return e;
}
const a = spawn('boss', 1);
console.log('sentinel ch1 boss ->', a.type, 'hp', a.hp, 'sw?', !!a._sw, 'ca?', !!a._ca, '|', a.bossName);
const b = spawn('hearth_warden', 2);
console.log('sentinel ch2 warden ->', b.type, 'hp', b.hp, 'sw?', !!b._sw, 'ca?', !!b._ca, '|', b.bossName);
const c = spawn('hearth_warden', 2, false);
console.log('non-sentinel warden ->', c.type, 'hp', c.hp, 'sw?', !!c._sw, 'ca?', !!c._ca, '(untouched)');
const d = { type:'boss', x:900, y:900, r:42, vx:0, vy:0, _ca: b._ca };
win.ElemMonsters.tickEnemy(d, 0.016);
console.log('tick routed -> choir stage', d._ca.stage);