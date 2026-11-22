// ============================================================
// Monster Arena — ELEMENTAL MONSTERS
// Enchanting the first glyph of an element's path calls new monsters into
// the arena: each of them fights with that element's own attack instead of
// the plain shots of the ordinary bestiary. The old monsters keep the
// attacks they always had.
//
//   fire      → Magma Lurker   lobs magma that leaves a burning pool
//   lightning → Storm Caller   splits its bolt into a forked volley
//   water     → Rime Warden    hurls a slow surge of water that chills you
//   earth     → Quake Strider  ruptures the ground in a ring of stone
//   spirit    → Soul Mote      casts a homing wisp
//
// A monster only appears once its element's first glyph is enchanted AND the
// run has reached that monster's wave. Nothing here runs inside an online
// match — the server owns those enemies.
// Exposes window.ElemMonsters.
// ============================================================
(function () {
  'use strict';

  const MONSTERS = {
    magmalurk: {
      el: 'fire', wave: 3, cd: 2.3, minR: 120, range: 380,
      sprite: 'elem-fire',
      name: 'Magma Lurker', color: '#ff6a2a',
      blurb: 'A bomber of living rock — its magma bursts and leaves a burning pool.'
    },
    stormcaller: {
      el: 'lightning', wave: 4, cd: 2.1, minR: 0, range: 620,
      sprite: 'elem-storm',
      name: 'Storm Caller', color: '#9fe3ff',
      blurb: 'Every bolt it fires forks into three.'
    },
    rimewarden: {
      el: 'water', wave: 5, cd: 2.6, minR: 0, range: 820,
      sprite: 'elem-rime',
      name: 'Rime Warden', color: '#5fc4ff',
      blurb: 'Hurls a slow, heavy surge of cold water that slows you to a crawl.'
    },
    quakestrider: {
      el: 'earth', wave: 6, cd: 3.4, minR: 0, range: 320,
      sprite: 'elem-quake',
      name: 'Quake Strider', color: '#7dffa3',
      blurb: 'Stomps the ground into a ring of stone — mind the gaps.'
    },
    soulmote: {
      el: 'spirit', wave: 7, cd: 3.2, minR: 170, range: 560,
      sprite: 'elem-soul',
      name: 'Soul Mote', color: '#c066ff',
      blurb: 'Casts a wisp that follows you until it burns out.'
    }
  };

  // TEST MODE: while this is on, every elemental monster can spawn from wave 1
  // with no glyph enchanted, and they come up far more often so all five are
  // easy to meet in one run. Off: they only appear once their element's first
  // glyph is enchanted and their wave is reached.
  const TEST_ALL = false;

  // How often a spawn is one of the elemental monsters rather than the
  // ordinary bestiary.
  const SPAWN_CHANCE = TEST_ALL ? 0.85 : 0.26;
  let testRot = 0;

  // The same elemental monster may turn up to three times in a single wave —
  // three Magma Lurkers alongside Storm Callers, say — so a wave can be all
  // elemental monsters, or any mix of them.
  const MAX_PER_TYPE_PER_WAVE = 3;
  let spawnWave = -1;
  const spawnedThisWave = Object.create(null);

  let env = null;
  const announced = new Set();
  let lastWisp = 0;

  function setEnv(e) { env = e; }

  // Stats the engine applies when one of them spawns (it only knows the
  // ordinary bestiary). Each is a sturdier, slower or quicker cousin of the
  // monster whose art it wears.
  // Every elemental monster is as tough as the bestiary's tank (140 HP).
  const TANK_HP = 140;
  const STATS = {
    magmalurk:    { speed: 170, hp: TANK_HP, r: 17, detectR: 700 },
    stormcaller:  { speed: 160, hp: TANK_HP, r: 15, detectR: 720 },
    rimewarden:   { speed: 115, hp: TANK_HP, r: 16, detectR: 900 },
    quakestrider: { speed: 95,  hp: TANK_HP, r: 19, detectR: 560 },
    soulmote:     { speed: 150, hp: TANK_HP, r: 15, detectR: 700 }
  };

  function tune(e) {
    // Sentinel wardens only ever take the boss slot inside a live Age of the
    // Sentinel chapter. Without this guard a stale SENTINEL_ACTIVE flag put the
    // Sentinel sprites and their camera tilt on the Last Scribe's own wardens.
    const sentinelRun = !!window.SENTINEL_ACTIVE && !window.STORY_ACTIVE &&
      window.STORY_REALM == null;
    // The Sentinel's first warden takes over the boss slot it spawns into.
    if (e && e.type === 'boss' && window.SealWright && sentinelRun &&
        Number(window.SENTINEL_CHAPTER) === 1) window.SealWright.initEnemy(e);
    // Age of the Sentinel, chapter 2: the Sunken Archive's warden is the Choir
    // of Ash. The arena picks its boss by realm, so the Choir takes that slot —
    // retyped to the plain 'boss' so it is driven like the Sealwright is.
    if (e && window.ChoirOfAsh && sentinelRun && Number(window.SENTINEL_CHAPTER) === 2 &&
        (e.type === 'hearth_warden' || e.type === 'boss')) {
      e.type = 'boss';
      window.ChoirOfAsh.initEnemy(e);
    }
    // Age of the Sentinel, chapter 3: Glasswater Reach's warden is the
    // Hourglass Stag. It takes the realm-boss slot the same way.
    if (e && window.HourglassStag && sentinelRun && Number(window.SENTINEL_CHAPTER) === 3 &&
        (e.type === 'rime_oracle' || e.type === 'boss')) {
      e.type = 'boss';
      window.HourglassStag.initEnemy(e);
    }
    // Age of the Sentinel, chapter 4: March of Embers' warden is the Gilded
    // Bailiff. It takes the realm-boss slot (the Magma Titan's) the same way.
    if (e && window.GildedBailiff && sentinelRun && Number(window.SENTINEL_CHAPTER) === 4 &&
        (e.type === 'magma_titan' || e.type === 'boss')) {
      e.type = 'boss';
      window.GildedBailiff.initEnemy(e);
    }
    const s = e && STATS[e.type];
    if (!s) return e;
    e.speed = s.speed;
    e.hp = e.maxhp = s.hp;
    e.r = s.r;
    e.detectR = s.detectR;
    e.cd = 99;          // its attack comes from this module, not the engine
    e._elemCd = 0.6;
    return e;
  }

  function isElemental(type) { return !!MONSTERS[type]; }
  function spriteFor(type) { return MONSTERS[type] ? MONSTERS[type].sprite : type; }
  function elementOf(type) { return MONSTERS[type] ? MONSTERS[type].el : null; }

  // ---- gating ----------------------------------------------------------
  // The first glyph of a path is the tier-1 node of any of its three
  // branches; the tree's node keys live in the engine and arrive via env.
  function firstGlyph(elm) {
    const g = env && env.player && env.player.glyph && env.player.glyph[elm];
    if (!g) return false;
    const keys = (env.treeKeys && env.treeKeys[elm]) || [];
    for (let b = 0; b < keys.length; b++) {
      if (keys[b] && g[keys[b][0]]) return true;
    }
    return false;
  }

  function unlocked(type) {
    if (!env) return false;
    const M = MONSTERS[type];
    if (!M) return false;
    if (TEST_ALL) return true;
    if (!firstGlyph(M.el)) return false;
    const w = (env.state && env.state.wave) || 0;
    return w >= M.wave;
  }

  // Called by the engine's spawn director: hand back an elemental monster now
  // and then, never in an online match.
  function pick() {
    if (!env || (env.isNetActive && env.isNetActive())) return null;

    // Each wave gets a fresh allowance, so a new wave can field three of the
    // same elemental monster again.
    const wave = (env.state && env.state.wave) || 0;
    if (wave !== spawnWave) {
      spawnWave = wave;
      for (const k in spawnedThisWave) delete spawnedThisWave[k];
    }

    const open = [];
    for (const k in MONSTERS) {
      if (!unlocked(k)) continue;
      if ((spawnedThisWave[k] || 0) >= MAX_PER_TYPE_PER_WAVE) continue;
      open.push(k);
    }
    if (!open.length) return null;
    if (env.rand(0, 1) > SPAWN_CHANCE) return null;

    // Testing: cycle through the unlocked ones in order, so a single run meets
    // them all. Live: any of them, freely repeated.
    const type = TEST_ALL
      ? open[testRot++ % open.length]
      : (open[Math.floor(env.rand(0, open.length - 0.001))] || open[0]);
    spawnedThisWave[type] = (spawnedThisWave[type] || 0) + 1;
    return type;
  }

  // ---- shots -----------------------------------------------------------
  function shot(e, a, speed, dmg, opts) {
    return env.spawnEBullet(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, a, speed, dmg, opts);
  }
  function radial(e, a, speed, dmg, opts) {
    return env.spawnEBullet(e.x, e.y, a, speed, dmg, opts);
  }

  // fire — a lobbed magma bomb; the pool it leaves is handled by the engine's
  // napalm tick, tagged hostile so it burns you instead of the monsters.
  function magma(e, p, M) {
    const a = env.angleTo(e.x, e.y, p.x, p.y) + env.rand(-0.06, 0.06);
    env.spawnBomb(
      e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r,
      a, 330 + (env.state.wave || 0) * 3, 18, 130, 0.8,
      { elem: 'fire', glyphColor: M.color }
    );
    env.addEffect(e.x, e.y, 'pop', 0.3, M.color);
    return true;
  }

  // lightning — three thin bolts in a fan.
  function fork(e, p, M) {
    const base = env.angleTo(e.x, e.y, p.x, p.y);
    const sp = 520 + (env.state.wave || 0) * 4;
    for (let i = -1; i <= 1; i++) {
      shot(e, base + i * 0.15, sp, 10, {
        r: 4, life: 1.6, glyphColor: M.color, elem: 'lightning'
      });
    }
    env.addEffect(e.x, e.y, 'pop', 0.28, M.color);
    return true;
  }

  // water — one heavy surge of water that rolls at you slowly and chills on
  // contact, with two smaller droplets trailing it. Nothing sharp or fan-shaped
  // like the storm's bolts: you beat it by stepping aside, not by outrunning it.
  function rime(e, p, M) {
    const base = env.angleTo(e.x, e.y, p.x, p.y);
    shot(e, base, 175, 16, {
      r: 15, life: 3.4, slow: 1.6, glyphColor: M.color, elem: 'water'
    });
    for (let i = -1; i <= 1; i += 2) {
      shot(e, base + i * 0.06, 225, 7, {
        r: 7, life: 2.6, slow: 1.2, glyphColor: '#8fe8ff', elem: 'water'
      });
    }
    env.addEffect(e.x, e.y, 'pop', 0.3, '#dff6ff');
    return true;
  }

  // earth — telegraphed by a short wind-up, then a radial ring with gaps
  // every few shards: dash through a gap or back out of range.
  function stomp(e, p, M) {
    e._stompT = 0.55;
    e._stompN = 12;
    e._stompCol = M.color;
    env.addEffect(e.x, e.y, 'pop', 0.55, M.color);
    if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 3);
    return true;
  }
  function stompBurst(e) {
    const N = e._stompN || 12;
    const col = e._stompCol || '#7dffa3';
    for (let i = 0; i < N; i++) {
      if (i % 4 === 2) continue;                     // the gaps you slip through
      radial(e, (Math.PI * 2 * i) / N, 300, 9, {
        r: 6, life: 1.2, glyphColor: col, elem: 'earth'
      });
    }
    env.addEffect(e.x, e.y, 'pop', 0.5, '#d9ffe6');
    if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 6);
  }

  // spirit — one slow wisp at a time across the whole arena, so a crowd of
  // Soul Motes can't bury you in homing shots.
  function wisp(e, p, M) {
    const now = performance.now();
    if (now - lastWisp < 700) return false;
    lastWisp = now;
    shot(e, env.angleTo(e.x, e.y, p.x, p.y), 250, 15, {
      r: 5, life: 3.2, homing: 1.5, glyphColor: M.color, elem: 'spirit'
    });
    env.addEffect(e.x, e.y, 'pop', 0.3, M.color);
    return true;
  }

  function attack(type, e, p) {
    const M = MONSTERS[type];
    if (!M) return false;
    switch (M.el) {
      case 'fire': return magma(e, p, M);
      case 'lightning': return fork(e, p, M);
      case 'water': return rime(e, p, M);
      case 'earth': return stomp(e, p, M);
      case 'spirit': return wisp(e, p, M);
      default: return false;
    }
  }

  // ---- per-monster tick -------------------------------------------------
  function tickEnemy(e, dt) {
    // A custom boss drives itself through this same per-enemy hook.
    if (e && e._sw && window.SealWright) { window.SealWright.tick(e, dt); return; }
    if (e && e._ca && window.ChoirOfAsh) { window.ChoirOfAsh.tick(e, dt); return; }
    if (e && e._hs && window.HourglassStag) { window.HourglassStag.tick(e, dt); return; }
    if (e && e._gb && window.GildedBailiff) { window.GildedBailiff.tick(e, dt); return; }
    if (!env || !e) return;
    if (!MONSTERS[e.type]) return;
    if (env.isNetActive && env.isNetActive()) return;
    // A fresh run starts at wave 1: the notices get to show again.
    if (announced.size && ((env.state && env.state.wave) || 0) <= 1) announced.clear();
    if (e.hp <= 0) return;

    // A stomp already winding up always resolves, even if you leave.
    if (e._stompT > 0) {
      e._stompT -= dt;
      if (e._stompT <= 0) stompBurst(e);
      return;
    }

    if (!e.alerted) return;

    const M = MONSTERS[e.type];
    const p = env.player;
    const d2 = env.dist2(e.x, e.y, p.x, p.y);

    e._elemCd = (e._elemCd || 0) - dt;
    if (e._elemCd > 0) return;
    if (d2 > M.range * M.range) return;
    if (d2 < (M.minR || 0) * (M.minR || 0)) return;

    if (!attack(e.type, e, p)) return;
    e._elemCd = M.cd + env.rand(-0.3, 0.3);
    announce(e.type);
  }

  // ---- drawing ----------------------------------------------------------
  // A ring of elemental light under the monster so it reads as something new
  // rather than one of the ordinary creatures.
  function drawAura(ctx, cx, cy, rr, t, type) {
    const M = MONSTERS[type];
    if (!M) return;
    const R = rr + 11;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(cx, cy, rr * 0.6, cx, cy, R + 8);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.7, M.color + '33');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = M.color;
    ctx.globalAlpha = 0.55 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3.4));
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.lineDashOffset = -t * 26;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ---- one-time notice --------------------------------------------------
  // The first time each elemental monster strikes in a run, say so: an
  // unfamiliar attack otherwise reads as a bug rather than a glyph paying off.
  let noticeEl = null, noticeTimer = null;
  function announce(type) {
    if (announced.has(type)) return;
    announced.add(type);
    const M = MONSTERS[type];
    if (!M) return;

    if (!noticeEl) {
      noticeEl = document.createElement('div');
      noticeEl.id = 'elemNotice';
      document.body.appendChild(noticeEl);
    }
    noticeEl.innerHTML =
      '<span class="en-sig"></span>' +
      '<span class="en-body"><b>' + M.name + '</b><i>' + M.blurb + '</i></span>';
    noticeEl.style.setProperty('--en', M.color);
    noticeEl.classList.add('show');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { noticeEl.classList.remove('show'); }, 4200);
  }

  const CSS = `
  #elemNotice{position:fixed;left:50%;top:14px;transform:translate(-50%,-18px);z-index:58;
    display:flex;align-items:center;gap:11px;max-width:min(430px,92vw);padding:9px 16px 9px 12px;
    border-radius:16px;opacity:0;pointer-events:none;
    background:linear-gradient(180deg,rgba(14,12,24,.95),rgba(6,6,14,.92));
    border:1px solid var(--en,#9fe3ff);box-shadow:0 12px 34px rgba(0,0,0,.6),0 0 26px var(--en,#9fe3ff);
    backdrop-filter:blur(6px);transition:opacity .3s ease,transform .35s cubic-bezier(.22,1,.36,1);}
  #elemNotice.show{opacity:1;transform:translate(-50%,0);}
  #elemNotice .en-sig{flex:0 0 auto;width:12px;height:26px;border-radius:6px;
    background:linear-gradient(180deg,var(--en,#9fe3ff),transparent);box-shadow:0 0 14px var(--en,#9fe3ff);}
  #elemNotice .en-body{display:flex;flex-direction:column;line-height:1.3;min-width:0;}
  #elemNotice .en-body b{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#f6f0ff;}
  #elemNotice .en-body i{font-style:normal;font-size:11px;color:#a9b6d0;}`;

  (function injectCSS() {
    const st = document.createElement('style');
    st.id = 'elemNoticeCSS';
    st.textContent = CSS;
    document.head.appendChild(st);
  })();

  window.ElemMonsters = {
    setEnv,
    tune,
    isElemental,
    spriteFor,
    elementOf,
    unlocked,
    pick,
    tickEnemy,
    drawAura,
    monsters: MONSTERS
  };
})();
