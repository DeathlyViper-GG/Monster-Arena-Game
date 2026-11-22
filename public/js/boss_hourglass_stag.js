// ============================================================
// Monster Arena — THE HOURGLASS STAG (Age of the Sentinel, Chapter 3)
// Glasswater Reach's warden: a bone-white stag whose antlers are
// hourglasses, holding one Still Day open. It does not so much kill
// you as put the fight back where it started.
//
// Four stages, EIGHT attacks in total:
//   Stage 1 (100–75%): Rimefall, Glasshorn Charge
//   Stage 2 (75–50%):  + Frozen Reprise, Crevasse Wave
//   Stage 3 (50–25%):  + Stolen Second, Shardstorm
//   Stage 4 (25–0%):   + Everfrost, The Same Beginning
// Earlier attacks stay in the pool at every later stage.
//
// Spawned by the engine in place of the realm boss when
// SENTINEL_ACTIVE && SENTINEL_CHAPTER === 3 (wave 5 of chapter 3).
// ============================================================
(function () {
  'use strict';

  const ACCENT = '#bfe9ff';   // frost glass — the read of its antlers
  const GLASS = '#9fe3ff';    // hourglass light
  const BONE = '#eef4f8';     // the stag itself
  const SAND = '#ffe9b8';     // sand running the wrong way

  // ---- DIFFICULTY -------------------------------------------------------
  const DMG = 2.2;           // multiplier on every discrete hit
  const DPS = 2.0;           // multiplier on sustained per-second ticks
  const TEMPO = 0.6;         // phase-length multiplier — lower is faster
  const STAGE_INTERVAL = [0.36, 0.3, 0.22, 0.16];
  const MAXHP = 14000;       // above the Choir of Ash (12000): a longer Still Day

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrap = (a) => ((a % TAU) + TAU) % TAU;

  // ---- engine refs (handed in via setEnv) -------------------------------
  // The engine hands the custom bosses their references through
  // HearthWarden.setEnv; borrow that same channel rather than adding
  // engine wiring of our own.
  let env = null;
  (function borrowEnv() {
    const hw = window.HearthWarden;
    if (!hw || !hw.setEnv) return;
    const orig = hw.setEnv;
    hw.setEnv = function (obj) { env = obj; return orig.call(hw, obj); };
  })();

  // ---- shared geometry helpers ------------------------------------------
  // Is the player inside a corridor written from (ax,ay) along `ang`?
  function inLane(pl, ax, ay, ang, len, w) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const rx = pl.x - ax, ry = pl.y - ay;
    const along = rx * dx + ry * dy;
    if (along < -20 || along > len) return false;
    const perp = Math.abs(-rx * dy + ry * dx);
    return perp < w * 0.5 + (pl.r || 14);
  }
  function bearingTo(e, pl) { return Math.atan2(pl.y - e.y, pl.x - e.x); }
  // Where the player is *going* — standing still is never an answer.
  function leadingAngle(e, pl, lead) {
    return Math.atan2(pl.y + (pl.vy || 0) * lead - e.y, pl.x + (pl.vx || 0) * lead - e.x);
  }
  function edgeX(v) { return clamp(v, 90, (env.world.w || 1600) - 90); }
  function edgeY(v) { return clamp(v, 90, (env.world.h || 1600) - 90); }

  // ============================================================
  // EIGHT ATTACKS
  // ============================================================
  const ATTACKS = {
    // 1. Frost sigils gather near the player, then erupt as ice pillars.
    //    The rings lock the moment they form: always dodgeable.
    rimefall: {
      name: 'Rimefall', minStage: 1, windup: 0.5, tele: 0.8, active: 2.0, recover: 0.5,
      build(e, c) {
        const pl = env.player;
        c.zones = [];
        const n = 5;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + env.rand(0, 0.9);
          const d = 60 + env.rand(0, 320);
          c.zones.push({
            x: edgeX(pl.x + Math.cos(a) * d), y: edgeY(pl.y + Math.sin(a) * d),
            r: 76, fire: i * 0.24, dur: 0.62, seed: i * 1.7
          });
        }
        c.dmg = 24;
      },
      tick(e, c, dt) {
        const pl = env.player;
        for (const z of c.zones) {
          const local = c.t - z.fire;
          if (local < 0 || local > z.dur) continue;
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) {
            env.hurtPlayer(c.dmg * dt * DPS);
            pl.slowT = Math.max(pl.slowT || 0, 0.5);
          }
        }
      }
    },
    // 2. The stag lowers its crystal antlers and runs a marked lane,
    //    leaving a slick, cracked trail behind it.
    glasshornCharge: {
      name: 'Glasshorn Charge', minStage: 1, windup: 0.5, tele: 0.85, active: 1.5, recover: 0.6,
      build(e, c) {
        const pl = env.player;
        c.ang = leadingAngle(e, pl, 0.35);
        c.x0 = e.x; c.y0 = e.y;
        c.len = 820; c.w = 58; c.dmg = 38;
        c.travelled = 0; c.trail = [];
      },
      tick(e, c, dt) {
        const pl = env.player;
        if (c.travelled < c.len) {
          const step = Math.min(1500 * dt, c.len - c.travelled);
          c.travelled += step;
          const nx = c.x0 + Math.cos(c.ang) * c.travelled;
          const ny = c.y0 + Math.sin(c.ang) * c.travelled;
          if (env.moveWithCollide) env.moveWithCollide(e, nx - e.x, ny - e.y);
          else { e.x = nx; e.y = ny; }
          e.vx = Math.cos(c.ang) * 600; e.vy = Math.sin(c.ang) * 600;
          if (env.dist2(pl.x, pl.y, e.x, e.y) < (e.r + pl.r + 12) * (e.r + pl.r + 12)) {
            env.hurtPlayer(c.dmg * dt * 1.6 * DPS);
          }
          c.trail.push({ x: e.x, y: e.y, life: 2.2, r: 48 + env.rand(0, 16) });
          if (c.trail.length > 90) c.trail.shift();
        } else {
          e.vx *= 0.8; e.vy *= 0.8;
        }
        for (const s of c.trail) {
          s.life -= dt;
          if (s.life <= 0) continue;
          if (env.dist2(pl.x, pl.y, s.x, s.y) < (s.r + pl.r) * (s.r + pl.r)) {
            env.hurtPlayer(10 * dt * DPS);
            pl.slowT = Math.max(pl.slowT || 0, 0.6);
          }
        }
        c.trail = c.trail.filter((s) => s.life > 0);
      }
    },
    // 3. Three pale echoes replay old charge lanes across the ice,
    //    one after another. The present self stays still and watches.
    frozenReprise: {
      name: 'Frozen Reprise', minStage: 2, windup: 0.6, tele: 0.8, active: 2.6, recover: 0.6,
      build(e, c) {
        const base = c.hist ? c.hist : bearingTo(e, env.player);
        c.lanes = [];
        for (let i = 0; i < 3; i++) {
          const ang = base + (i - 1) * 0.42;
          c.lanes.push({
            ang, x0: e.x - Math.cos(ang) * 260, y0: e.y - Math.sin(ang) * 260,
            len: 900, w: 50, start: i * 0.58, dur: 0.62, seed: i * 2.1
          });
        }
        c.dmg = 26;
      },
      tick(e, c, dt) {
        const pl = env.player;
        for (const L of c.lanes) {
          const local = c.t - L.start;
          if (local < 0 || local > L.dur) continue;
          if (inLane(pl, L.x0, L.y0, L.ang, L.len, L.w)) {
            env.hurtPlayer(c.dmg * dt * DPS);
            pl.slowT = Math.max(pl.slowT || 0, 0.45);
          }
        }
      }
    },
    // 4. A fracture races out from the stag and ice spires burst along it.
    crevasseWave: {
      name: 'Crevasse Wave', minStage: 2, windup: 0.6, tele: 0.8, active: 2.6, recover: 0.6,
      build(e, c) {
        const pl = env.player;
        c.cx = e.x; c.cy = e.y;
        c.dir = bearingTo(e, pl);
        c.n = 9; c.spacing = 118; c.colR = 52; c.dur = 0.5; c.step = 0.17;
        c.dmg = 26;
        c.cols = [];
        for (let i = 0; i < c.n; i++) {
          const d = 90 + i * c.spacing;
          c.cols.push({
            x: edgeX(c.cx + Math.cos(c.dir) * d), y: edgeY(c.cy + Math.sin(c.dir) * d),
            fire: i * c.step, seed: i * 1.3
          });
        }
      },
      tick(e, c, dt) {
        const pl = env.player;
        for (const col of c.cols) {
          const local = c.t - col.fire;
          if (local < 0 || local > c.dur) continue;
          if (env.dist2(pl.x, pl.y, col.x, col.y) < (c.colR + pl.r) * (c.colR + pl.r)) {
            env.hurtPlayer(c.dmg * dt * DPS);
            pl.slowT = Math.max(pl.slowT || 0, 0.6);
          }
        }
      }
    },
    // 5. It marks where you are and where you are going, then strikes
    //    both — the second one a beat later. Change direction to live.
    stolenSecond: {
      name: 'Stolen Second', minStage: 3, windup: 0.7, tele: 0.9, active: 2.6, recover: 0.7,
      build(e, c) {
        const pl = env.player;
        const lead = 0.9;
        c.marks = [
          { x: edgeX(pl.x), y: edgeY(pl.y), r: 84, delay: 0.35, dur: 0.5, kind: 0 },
          {
            x: edgeX(pl.x + (pl.vx || 0) * lead), y: edgeY(pl.y + (pl.vy || 0) * lead),
            r: 92, delay: 1.25, dur: 0.55, kind: 1
          }
        ];
        c.dmg = 30;
      },
      tick(e, c, dt) {
        const pl = env.player;
        for (const m of c.marks) {
          const local = c.t - m.delay;
          if (local < 0 || local > m.dur) continue;
          if (env.dist2(pl.x, pl.y, m.x, m.y) < (m.r + pl.r) * (m.r + pl.r)) {
            env.hurtPlayer(c.dmg * dt * DPS);
            pl.slowT = Math.max(pl.slowT || 0, 0.7);
          }
        }
      }
    },
    // 6. The antlers burst into glass shards that sweep the ice in a
    //    closing ring. There is always a gap; it moves.
    shardstorm: {
      name: 'Shardstorm', minStage: 3, windup: 0.6, tele: 0.7, active: 3.0, recover: 0.7,
      build(e, c) {
        const pl = env.player;
        c.cx = e.x; c.cy = e.y;
        c.r0 = 230; c.r1 = 118; c.gap = 0.95;
        c.gapAng = bearingTo(e, pl);
        c.spin = 0.34; c.thick = 34; c.dmg = 15;
        c.shards = [];
        for (let i = 0; i < 18; i++) c.shards.push({ a: (i / 18) * TAU, seed: i * 0.7 });
      },
      tick(e, c, dt) {
        const pl = env.player;
        const p = Math.min(1, c.t / c.phases.active);
        const r = c.r0 + (c.r1 - c.r0) * p;
        c.gapAng = wrap(c.gapAng + c.spin * dt);
        const d = Math.hypot(pl.x - c.cx, pl.y - c.cy);
        if (Math.abs(d - r) < c.thick + pl.r) {
          const a = Math.atan2(pl.y - c.cy, pl.x - c.cx);
          const diff = Math.abs(wrap(a - c.gapAng + Math.PI) - Math.PI);
          if (diff > c.gap / 2) {
            env.hurtPlayer(c.dmg * dt * DPS);
            pl.slowT = Math.max(pl.slowT || 0, 0.5);
          }
        }
      }
    },
    // 7. A ring of impacts marches across the arena and each one leaves
    //    a sheet of frost that does not melt. The floor shrinks.
    everfrost: {
      name: 'Everfrost', minStage: 4, windup: 0.8, tele: 0.9, active: 3.6, recover: 0.8,
      build(e, c) {
        const pl = env.player;
        c.zones = [];
        const n = 6;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + env.rand(0, 0.8);
          const d = 90 + (i % 3) * 150 + env.rand(0, 90);
          c.zones.push({
            x: edgeX(pl.x + Math.cos(a) * d), y: edgeY(pl.y + Math.sin(a) * d),
            r: 88, fire: 0.1 + i * 0.3, dur: 0.5, linger: 2.6, seed: i * 2.3
          });
        }
        c.dmg = 22;
      },
      tick(e, c, dt) {
        const pl = env.player;
        for (const z of c.zones) {
          const local = c.t - z.fire;
          if (local < 0) continue;
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) {
            const erupting = local < z.dur;
            env.hurtPlayer(c.dmg * dt * (erupting ? DPS : 0.7));
            if (erupting) pl.slowT = Math.max(pl.slowT || 0, 0.6);
          }
        }
      }
    },
    // 8. SIGNATURE — the echoes run the old lanes, and then the real stag
    //    charges a lane that is aimed at wherever you stand *now*.
    sameBeginning: {
      name: 'The Same Beginning', minStage: 4, windup: 0.9, tele: 1.0, active: 3.4, recover: 0.8,
      build(e, c) {
        const base = c.hist ? c.hist : bearingTo(e, env.player);
        c.lanes = [];
        for (let i = 0; i < 3; i++) {
          const ang = base + (i - 1) * 0.46;
          c.lanes.push({
            ang, x0: e.x - Math.cos(ang) * 240, y0: e.y - Math.sin(ang) * 240,
            len: 900, w: 54, start: i * 0.5, dur: 0.55, seed: i * 3.4
          });
        }
        c.final = { start: 1.9, dur: 1.1, w: 74, len: 1000, dmg: 44, ang: base, locked: false, x0: 0, y0: 0 };
        c.dmg = 30;
      },
      tick(e, c, dt) {
        const pl = env.player;
        for (const L of c.lanes) {
          const local = c.t - L.start;
          if (local < 0 || local > L.dur) continue;
          if (inLane(pl, L.x0, L.y0, L.ang, L.len, L.w)) {
            env.hurtPlayer(c.dmg * dt * DPS);
            pl.slowT = Math.max(pl.slowT || 0, 0.5);
          }
        }
        // the present finally commits — to where you are standing, not where you were
        if (!c.final.locked && c.t >= c.final.start) {
          c.final.locked = true;
          c.final.ang = bearingTo(e, pl);
          c.final.x0 = e.x; c.final.y0 = e.y;
          if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 10);
          if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 1.0, ACCENT);
        }
        if (c.final.locked) {
          const local = c.t - c.final.start;
          if (local >= 0 && local <= c.final.dur && inLane(pl, c.final.x0, c.final.y0, c.final.ang, c.final.len, c.final.w)) {
            env.hurtPlayer(c.final.dmg * dt * DPS);
            pl.slowT = Math.max(pl.slowT || 0, 0.8);
          }
        }
      }
    }
  };

  const STAGE_NAMES = ['The Still Day', 'The Second Replaying', 'The Stolen Hour', 'The Same Beginning'];

  // ---- stage helpers -----------------------------------------------------
  function stageFor(e) {
    const r = (e.hp || 0) / Math.max(1, e.maxhp || e.hp || 1);
    if (r > 0.75) return 1;
    if (r > 0.50) return 2;
    if (r > 0.25) return 3;
    return 4;
  }
  function stageInterval(stage) { return STAGE_INTERVAL[stage - 1] || STAGE_INTERVAL[3]; }

  function availableAttacks(stage) {
    const out = [];
    for (const k in ATTACKS) if (ATTACKS[k].minStage <= stage) out.push(k);
    return out;
  }
  function pickNext(e) {
    const st = e._hs;
    const pool = availableAttacks(st.stage);
    let opts = pool;
    if (st.last && pool.length > 1) opts = pool.filter((k) => k !== st.last);
    const k = opts[Math.floor(env.rand(0, opts.length))];
    st.last = k;
    return k;
  }
  function startAttack(e, key) {
    const A = ATTACKS[key];
    e._hs.cur = {
      key, name: A.name, phase: 'windup', t: 0, hist: e._hs.lastBearing,
      phases: {
        windup: Math.max(0.1, A.windup * TEMPO),
        tele: Math.max(0.18, A.tele * TEMPO),
        active: Math.max(0.45, A.active * 0.85),
        recover: Math.max(0.12, A.recover * TEMPO)
      }
    };
    // The health bar names the hour being spent, so the shape on the ice is
    // always announced before it lands.
    e.bossName = 'The Hourglass Stag · ' + A.name;
  }

  // ---- per-frame update (called from the engine's enemy loop) ------------
  function tick(e, dt) {
    if (!env) return;
    if (!e._hs) {
      e._hs = { stage: 1, cur: null, last: null, lastBearing: 0, idle: 0.4, phaseAnim: null, hitFlash: 0, intro: 0.7 };
    }
    const st = e._hs;

    // The stag fights with its antlers, never with the generic boss gun.
    e.cd = 3;
    e.alerted = false;

    st.hitFlash = Math.max(0, st.hitFlash - dt);

    if (st.intro > 0) { st.intro -= dt; e.vx = 0; e.vy = 0; return; }

    if (st.phaseAnim) {
      st.phaseAnim.t += dt;
      const pa = st.phaseAnim;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 9 * (1 - pa.t / pa.dur));
      e.vx *= 0.7; e.vy *= 0.7;
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
      if (pa.t >= pa.dur) { st.phaseAnim = null; st.idle = 0.35; st.cur = null; }
      return;
    }

    // ---- stage transitions ----
    const ns = stageFor(e);
    if (ns !== st.stage) {
      const old = st.stage;
      st.stage = ns;
      st.cur = null;
      st.phaseAnim = { t: 0, dur: 1.6, from: old, to: ns };
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 16);
      if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 1.1, ACCENT);
      if (window.BossStageCutscene) {
        window.BossStageCutscene.play({ theme: 'glacial', accent: ACCENT, name: 'The Hourglass Stag', from: old, to: ns });
      }
      return;
    }

    // ---- keep station at a middle distance; the antlers do the work ----
    const pl = env.player;
    if (!st.cur) {
      const d2p = env.dist2(e.x, e.y, pl.x, pl.y);
      const want = 300;
      const d = Math.sqrt(d2p);
      const a = bearingTo(e, pl);
      if (d > want + 90) {
        const sp = e.speed * 1.05;
        e.vx = env.lerp(e.vx || 0, Math.cos(a) * sp, 0.16);
        e.vy = env.lerp(e.vy || 0, Math.sin(a) * sp, 0.16);
      } else if (d < want - 90) {
        const sp = e.speed * 0.8;
        e.vx = env.lerp(e.vx || 0, -Math.cos(a) * sp, 0.16);
        e.vy = env.lerp(e.vy || 0, -Math.sin(a) * sp, 0.16);
      } else {
        const sp = e.speed * 0.55;
        e.vx = env.lerp(e.vx || 0, Math.cos(a + Math.PI / 2) * sp, 0.08);
        e.vy = env.lerp(e.vy || 0, Math.sin(a + Math.PI / 2) * sp, 0.08);
      }
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
    }

    // ---- attack cycle ----
    if (!st.cur) {
      st.lastBearing = bearingTo(e, pl);
      st.idle -= dt;
      if (st.idle <= 0) {
        startAttack(e, pickNext(e));
        if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 4);
      }
      return;
    }

    const c = st.cur;
    const P = c.phases;
    const su = (c.phase === 'windup' || c.phase === 'recover') ? 2.0 : 1;
    c.t += dt * su;
    if (c.phase === 'windup' && c.t >= P.windup) { c.phase = 'tele'; c.t = 0; }
    else if (c.phase === 'tele' && c.t >= P.tele) {
      c.phase = 'active'; c.t = 0;
      ATTACKS[c.key].build(e, c);
      if (c.dmg) c.dmg *= DMG;
      if (c.final && c.final.dmg) c.final.dmg *= DMG;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 6);
    } else if (c.phase === 'active' && c.t >= P.active) {
      c.phase = 'recover'; c.t = 0;
      c.zones = null; c.lanes = null; c.marks = null; c.shards = null; c.cols = null; c.trail = null;
    } else if (c.phase === 'recover' && c.t >= P.recover) {
      st.cur = null;
      st.idle = stageInterval(st.stage);
      e.bossName = 'The Hourglass Stag';
      return;
    }
    if (c.phase === 'active' && ATTACKS[c.key].tick) ATTACKS[c.key].tick(e, c, dt);
  }

  // ---- rendering ---------------------------------------------------------
  // Both renderers hand off to the effects module; the small procedural
  // fallback keeps the stag visible if that script never loaded.
  function draw2D(e, ctx, cx, cy, t) {
    if (window.HourglassStagFX) { window.HourglassStagFX.draw2D(e, ctx, cx, cy, t, env); return; }
    if (!ctx) return;
    ctx.fillStyle = ACCENT;
    ctx.beginPath(); ctx.arc(cx, cy, (e.r || 42) * 0.8, 0, TAU); ctx.fill();
  }
  function draw3D(R, e, tt) {
    if (window.HourglassStagFX) { window.HourglassStagFX.draw3D(R, e, tt, env); return; }
    if (!R || !R.ok) return;
    R.glow(e.x, (e.r || 42) * 1.2, e.y, (e.r || 42) * 1.7, 0.55, 0.85, 1.1, 0.5, 0);
  }

  // ---- spawn init --------------------------------------------------------
  function initEnemy(e) {
    e.r = 44;
    e.hp = e.maxhp = MAXHP;
    e.speed = 128;
    e.cd = 99;
    e.detectR = 1300;
    e.absorbing = false;
    e.commandCD = 3.0;
    e.bossName = 'The Hourglass Stag';
    e.bossColor = ACCENT;
    e._hs = { stage: 1, cur: null, last: null, lastBearing: 0, idle: 0.5, phaseAnim: null, hitFlash: 0, intro: 0.7 };
  }

  function onHit(e, dmg) {
    if (!e._hs) return;
    e._hs.hitFlash = Math.min(1, (e._hs.hitFlash || 0) + Math.min(0.5, dmg / 60));
  }

  window.HourglassStag = {
    setEnv(_env) { env = _env; },
    initEnemy,
    tick,
    draw2D,
    draw3D,
    onHit,
    ACCENT,
    GLASS,
    SAND,
    STAGE_NAMES,
    MAXHP,
    get attackNames() { return Object.keys(ATTACKS).map((k) => ATTACKS[k].name); }
  };
})();
