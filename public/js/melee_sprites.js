// js/melee_sprites.js
// Melee weapons: sprite loading + simple attack animations (punch/kick shrink, blade swing)
// Usage:
//  1) Include <script src="js/melee_sprites.js"></script> in index.html (before game_2.js).
//  2) Call Melee.loadAll() once at start to preload.
//  3) Create an instance: const myMelee = Melee.create({ kind:'punch', rarity:'common', name:'common_punch1' });
//  4) In your main update(dt): Melee.update(myMelee, dt);
//  5) In draw(), inside the player's rotate() block: Melee.draw(ctx, myMelee, { playerR: player.r });
//  6) Trigger an attack: Melee.use(myMelee);

(function(global){
  const TAU = Math.PI * 2;
  const DEG = d => d * Math.PI / 180;

  const DEFAULT_EXT = '.png';
  const BASE = 'assets/melee/';

  const FILES = {
    common: {
      basePath: BASE + 'common/',
      names: ['common_blade1','common_punch1','common_punch2','common_blade2','common_kick']
    },
    rare: {
      basePath: BASE + 'rare/',
      names: ['rare_blade1','rare_blade2','rare_blade3','rare_punch1','rare_punch2']
    },
    epic: {
      basePath: BASE + 'epic/',
      names: ['epic_punch1','epic_punch2','epic_punch3','epic_blade1','epic_blade2']
    },
    legendary: {
      basePath: BASE + 'legendary/',
      names: ['legendary_punch1','legendary_punch2','legendary_blade3','legendary_blade1','legendary_blade2']
    },
    god: {
      basePath: BASE + 'god/',
      names: ['god_punch1','god_punch2','god_blade3','god_blade1','god_blade2']
    }
  };

  function inferKindFromName(name){
    const n = name.toLowerCase();
    if(n.includes('kick')) return 'kick';
    if(n.includes('punch')) return 'punch';
    if(n.includes('blade')) return 'blade';
    return 'punch';
  }

  const OFF = {
    punch:  { x: -0.20, y: -0.50 },
    kick:   { x: -0.22, y: -0.55 },
    blade:  { x: -0.16, y: -0.70 }
  };

  const LEN = { punch: 34, kick: 38, blade: 64 };

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const easeInOutCubic = t => (t<0.5) ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;

  const sheets = { common:{}, rare:{}, epic:{}, legendary:{}, god:{} };

  function loadAll(){
    const jobs = [];
    for(const rarity of Object.keys(FILES)){
      const { basePath, names } = FILES[rarity];
      for(const name of names){
        jobs.push(new Promise(res=>{
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => { sheets[rarity][name] = img; res(); };
          img.onerror = () => { if((img._r=(img._r||0)+1)<4){ const s = name.match(/\.(png|gif|webp|jpg|jpeg)$/i) ? name : (name + DEFAULT_EXT); setTimeout(()=>{ img.src = basePath + s + '?r' + img._r; }, 400*img._r); } else { console.warn('[Melee] Missing sprite', rarity, name); res(); } };
          const src = name.match(/\.(png|gif|webp|jpg|jpeg)$/i) ? name : (name + DEFAULT_EXT);
          img.src = basePath + src;
        }));
      }
    }
    return Promise.all(jobs);
  }

  function getImage({ rarity='common', name }){
    const tier = sheets[rarity] || sheets.common;
    return tier && tier[name];
  }

  function create({ kind, rarity='common', name, length, anchorDist }){
    const k = kind || inferKindFromName(name||'');
    return {
      kind: k,
      rarity,
      name,
      length: length || LEN[k] || 40,
      anchorDist: anchorDist || 0.4,
      state: 'idle',
      t: 0,
      // each weapon swings at its own pace (melee_anim.js owns the timings)
      dur: (global.MeleeAnim && MeleeAnim.dur(name, k)) || ((k==='blade') ? 0.20 : 0.14),
      restSide: 1
    };
  }

  function use(inst){
    inst.state = 'using';
    inst.t = 0;
  }

  function update(inst, dt){
    if(inst.state !== 'using') return;
    inst.t += dt / Math.max(0.001, inst.dur);
    if(inst.t >= 1){
      inst.t = 1;
      if(inst.kind === 'blade') inst.restSide *= -1;
      inst.state = 'idle';
    }
  }

  function draw(ctx, inst, { playerR=16 }={}){
    const img = getImage(inst);
    if(!img) return;

    const off = OFF[inst.kind] || OFF.punch;
    const L = inst.length;
    const ar = (img.width>0 ? (img.height / img.width) : 1.6);
    const drawW = L / ar;
    const drawH = L;

    ctx.save();
    ctx.translate(playerR * inst.anchorDist, 0);

    // The swing belongs to the weapon, not to its family: the pose comes from
    // melee_anim.js, which gives every blade, fist and heel its own motion.
    const rest = (inst.kind === 'blade') ? inst.restSide * DEG(45) : 0;
    const q = (global.MeleeAnim && inst.state === 'using') ? MeleeAnim.pose(inst.name, inst.kind, inst.t, inst.restSide) : null;
    // the weapon smears behind itself through the swing
    if (q && global.MeleeAnim) {
      for (const g of MeleeAnim.trail(inst.name, inst.kind, inst.t, inst.restSide, 2)) {
        ctx.save();
        ctx.rotate(g.swing);
        if (g.sc !== 1) ctx.scale(g.sc, g.sc);
        if (g.push) ctx.translate(g.push, 0);
        ctx.globalAlpha = g.a;
        ctx.drawImage(img, drawW * off.x, drawH * off.y, drawW, drawH);
        ctx.restore();
      }
    }
    ctx.rotate(q ? q.swing : rest);
    if (q && q.sc !== 1) ctx.scale(q.sc, q.sc);
    if (q && q.push) ctx.translate(q.push, 0);
    ctx.shadowColor='rgba(0,0,0,0.35)';
    ctx.shadowBlur=6;
    ctx.drawImage(img, drawW*off.x, drawH*off.y, drawW, drawH);

    ctx.restore();
  }

  function firstOf(rarity, kind){
    const names = (FILES[rarity]?.names)||[];
    const hit = names.find(n => inferKindFromName(n) === kind);
    return hit || names[0];
  }

  global.Melee = {
    loadAll,
    create,
    use,
    update,
    draw,
    firstOf,
    _files: FILES,
    _sheets: sheets
  };

})(window);