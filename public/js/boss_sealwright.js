// ============================================================
// Monster Arena — THE SEALWRIGHT (Age of the Sentinel, Chapter 1)
// The first warden of the Still Days. It does not break the arena;
// it corrects it — writing seals into the floor and striking
// whatever stands on the wrong mark.
//
// Four stages, driven by remaining health, EIGHT attacks in total:
//   Stage 1 (100–75%): Seal-Line Sweep, Binding Sigils
//   Stage 2 (75–50%):  + Waxen Adds, Counterfeit Ward
//   Stage 3 (50–25%):  + Edict Slam, Ink-Spike Inscription
//   Stage 4 (25–0%):   + Final Inscription, Safe Passage
// Earlier attacks stay in the pool at every later stage.
//
// Spawned by the engine in place of the generic boss when
// SENTINEL_ACTIVE && SENTINEL_CHAPTER === 1 (wave 5 of chapter 1).
// ============================================================
(function () {
  'use strict';

  const ACCENT = '#ffcf6a';   // molten gold — the ward-seal
  const INK = '#1d1526';      // wet ink of the cloak
  const PARCH = '#f2e6c6';    // parchment mask
  const WAX = '#9a7442';      // the warden's wax arm
  const BLOOD = '#c03a2b';    // crimson wax-seal accents

  // ---- DIFFICULTY (Age of the Sentinel, chapter 1 — no glyphs carried) ----
  // Pressure comes from four places at once: every seal hits harder, is written
  // faster (so the warning is short), covers more ground, and the warden almost
  // never stands idle between them.
  const DMG = 2.5;      // multiplier on every discrete (one-off) hit
  const DPS = 2.2;      // multiplier on every sustained per-second tick
  const TEMPO = 0.55;   // phase-length multiplier — lower is faster
  const STAGE_INTERVAL = [0.34, 0.28, 0.2, 0.14];   // idle gap per stage
  const SWEEP_LEN = 900, SWEEP_N = 16;              // the low sweep's reach

  // ---- engine refs (handed in via setEnv) ----
  let env = null;

  // The engine hands its references to the other custom bosses; borrow that
  // same channel, so the Sealwright needs no wiring of its own in the engine.
  (function borrowEnv() {
    const hw = window.HearthWarden;
    if (!hw || !hw.setEnv) return;
    const orig = hw.setEnv;
    hw.setEnv = function (obj) { env = obj; return orig.call(hw, obj); };
  })();

  // The warden's own art and every effect it casts are drawn by
  // sealwright_fx.js, so its look can be tuned without touching the attack
  // timing and damage that live in this file.

  // ---- attack phases -------------------------------------------------------
  // Each attack runs windup -> tele -> active -> recover, exactly like the
  // other custom bosses, so the engine's loop timing stays untouched.
  const ATTACKS = {
    // ---- Stage 1 ----------------------------------------------------------
    sealLine: {
      name: 'Seal-Line Sweep', minStage: 1,
      windup: 0.5, tele: 0.8, active: 1.0, recover: 0.7,
      build(e, cur) {
        // Aimed where the player is *going*, not where they stand — strafing
        // no longer walks you out of the line.
        const pl = env.player;
        const a = Math.atan2(pl.y + (pl.vy || 0) * 0.3 - e.y, pl.x + (pl.vx || 0) * 0.3 - e.x);
        cur.ang = a;
        cur.zones = [];
        const len = SWEEP_LEN, n = SWEEP_N;
        for (let i = 1; i <= n; i++) {
          const d = (i / n) * len;
          cur.zones.push({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, r: 44, u: i / n });
        }
        cur.dmg = 15;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const sweep = Math.min(1, cur.t / cur.phases.active);
        cur.sweep = sweep;
        if ((pl.z || 0) > 30) return;   // jump the low sweep
        for (const z of cur.zones) {
          if (Math.abs(z.u - sweep) > 0.1) continue;
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) {
            env.hurtPlayer(cur.dmg * dt * 2.2 * DPS);
            if (Math.random() < 0.25) env.addEffect(pl.x, pl.y, 'pop', 0.2, ACCENT);
            break;
          }
        }
      }
    },

    bindingSigils: {
      name: 'Binding Sigils', minStage: 1,
      windup: 0.35, tele: 0.8, active: 1.1, recover: 0.6,
      build(e, cur) {
        // Five marks, laid on the ground the player is about to cross — the
        // middle one always underfoot, so standing still is never an answer.
        const pl = env.player;
        const a = Math.atan2(pl.y - e.y, pl.x - e.x) + Math.PI / 2;
        cur.zones = [];
        for (let i = 0; i < 5; i++) {
          const off = (i - 2) * 112;
          cur.zones.push({
            x: pl.x + Math.cos(a) * off,
            y: pl.y + Math.sin(a) * off,
            r: 56, at: 0.06 + i * 0.075, fired: false
          });
        }
      },
      tick(e, cur, dt) {
        const pl = env.player;
        for (const z of cur.zones) {
          if (z.fired || cur.t < z.at) continue;
          z.fired = true;
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) {
            env.hurtPlayer(22 * DMG);
            pl.slowT = Math.max(pl.slowT || 0, 1.9);
            env.addEffect(pl.x, pl.y, 'pop', 0.5, BLOOD);
          }
          env.addEffect(z.x, z.y, 'pop', 0.4, ACCENT);
        }
      }
    },

    // ---- Stage 2 ----------------------------------------------------------
    waxenAdds: {
      name: 'Waxen Adds', minStage: 2,
      windup: 0.4, tele: 0.6, active: 5.5, recover: 0.5,
      build(e, cur) {
        cur.nodes = [];
        const n = 5;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + env.rand(0, 1);
          const d = 520 + env.rand(-60, 60);
          cur.nodes.push({
            x: env.clamp(e.x + Math.cos(a) * d, 90, env.world.w - 90),
            y: env.clamp(e.y + Math.sin(a) * d, 90, env.world.h - 90),
            hp: 70, r: 22, dead: false
          });
        }
        cur.wardT = 0;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const bullets = (env.ents && env.ents.bullets) || [];
        let alive = 0;
        for (const nd of cur.nodes) {
          if (nd.dead) continue;
          alive++;
          // player fire burns the wax down
          for (const b of bullets) {
            if (!b || b.dmg == null) continue;
            if (env.dist2(nd.x, nd.y, b.x, b.y) < (nd.r + 12) * (nd.r + 12)) {
              nd.hp -= b.dmg;
              if (Math.random() < 0.3) env.addEffect(nd.x, nd.y, 'pop', 0.15, WAX);
              break;
            }
          }
          if (nd.hp <= 0) { nd.dead = true; env.addEffect(nd.x, nd.y, 'pop', 0.5, WAX); continue; }

          // otherwise it marches to the Sealwright and raises its ward
          const a = Math.atan2(e.y - nd.y, e.x - nd.x);
          const step = 175 * dt;
          nd.x += Math.cos(a) * step;
          nd.y += Math.sin(a) * step;
          if (env.dist2(nd.x, nd.y, e.x, e.y) < 70 * 70) {
            nd.dead = true;
            // The wax is drunk by the warden: every construct that reaches it
            // pays for its march out of the Sealwright's own wound.
            e.hp = Math.min(e.maxhp || e.hp, (e.hp || 0) + 95);
            env.addEffect(e.x, e.y, 'pop', 0.8, ACCENT);
          }
          // it also sears the player on contact
          if (env.dist2(pl.x, pl.y, nd.x, nd.y) < (nd.r + pl.r) * (nd.r + pl.r)) {
            env.hurtPlayer(14 * dt * 3 * DPS);
          }
        }
        if (alive === 0 && cur.nodes.every((n) => n.dead)) cur.nodes = [];
      }
    },

    counterfeitWard: {
      name: 'Counterfeit Ward', minStage: 2,
      windup: 0.45, tele: 0.7, active: 3.4, recover: 0.6,
      build(e, cur) {
        cur.R = 205;
        cur.gap = env.rand(0, Math.PI * 2);
        cur.spin = 2.8;      // the refuge circles the warden — keep moving with it
        cur.fireT = 0.2;
        cur.dmg = 30;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        cur.gap += cur.spin * dt;
        const d = Math.sqrt(env.dist2(pl.x, pl.y, e.x, e.y));
        // the ring itself sears anything standing in its band
        if (Math.abs(d - cur.R) < 36 && (pl.z || 0) < 26) env.hurtPlayer(cur.dmg * dt * DPS);
        // ink bolts leave the rim everywhere except the open gap
        cur.fireT -= dt;
        if (cur.fireT <= 0) {
          cur.fireT = 0.1;
          for (let i = 0; i < 3; i++) {
            let a = env.rand(0, Math.PI * 2);
            let tries = 0;
            while (Math.abs(((a - cur.gap + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.5 && tries++ < 6) {
              a = env.rand(0, Math.PI * 2);
            }
            env.spawnEBullet(e.x + Math.cos(a) * cur.R, e.y + Math.sin(a) * cur.R, a, 430, 20);
          }
        }
      }
    },

    // ---- Stage 3 ----------------------------------------------------------
    edictSlam: {
      name: 'Edict Slam', minStage: 3,
      windup: 0.6, tele: 0.7, active: 2.6, recover: 0.8,
      build(e, cur) {
        // Five rings instead of three, each quicker than the last to arrive.
        cur.rings = [];
        for (let i = 0; i < 5; i++) {
          cur.rings.push({ born: i * 0.42, sp: 520 + i * 40, hit: false });
        }
        cur.dmg = 26;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const d = Math.sqrt(env.dist2(pl.x, pl.y, e.x, e.y));
        for (const r of cur.rings) {
          if (cur.t < r.born) continue;
          if (r.hit) continue;
          const rad = (cur.t - r.born) * r.sp;
          if (Math.abs(d - rad) > 34) continue;
          if ((pl.z || 0) > 26) continue;   // jump the ring
          r.hit = true;
          env.hurtPlayer(cur.dmg * DMG);
        }
      }
    },

    inkSpikes: {
      name: 'Ink-Spike Inscription', minStage: 3,
      windup: 0.45, tele: 0.6, active: 2.4, recover: 0.7,
      build(e, cur) {
        const pl = env.player;
        const a = Math.atan2(pl.y + (pl.vy || 0) * 0.3 - e.y, pl.x + (pl.vx || 0) * 0.3 - e.x);
        cur.ang = a;
        cur.nodes = [];
        const n = 14, step = 68;
        for (let i = 0; i < n; i++) {
          const d = 100 + i * step;
          cur.nodes.push({
            x: e.x + Math.cos(a) * d,
            y: e.y + Math.sin(a) * d,
            r: 34, at: i * 0.085, erupt: 0, done: false
          });
        }
      },
      tick(e, cur, dt) {
        const pl = env.player;
        for (const nd of cur.nodes) {
          if (!nd.done && cur.t >= nd.at) { nd.done = true; nd.erupt = 0.45; env.addEffect(nd.x, nd.y, 'pop', 0.3, INK); }
          if (nd.erupt <= 0) continue;
          nd.erupt -= dt;
          if (env.dist2(pl.x, pl.y, nd.x, nd.y) < (nd.r + pl.r) * (nd.r + pl.r)) {
            env.hurtPlayer(30 * dt * 1.6 * DPS);
          }
        }
      }
    },

    // ---- Stage 4 ----------------------------------------------------------
    finalInscription: {
      name: 'Final Inscription', minStage: 4,
      windup: 0.6, tele: 0.9, active: 3.4, recover: 0.9,
      build(e, cur) {
        const pl = env.player;
        const perp = Math.atan2(pl.y - e.y, pl.x - e.x) + Math.PI / 2;
        // first half: the binding
        cur.sigils = [];
        for (let i = 0; i < 5; i++) {
          const off = (i - 2) * 108;
          cur.sigils.push({
            x: pl.x + Math.cos(perp) * off, y: pl.y + Math.sin(perp) * off,
            r: 56, fired: false
          });
        }
        // second half: the sweep written through the marked ground
        const a = Math.atan2(pl.y + (pl.vy || 0) * 0.3 - e.y, pl.x + (pl.vx || 0) * 0.3 - e.x);
        cur.ang = a;
        cur.zones = [];
        const len = SWEEP_LEN, n = SWEEP_N;
        for (let i = 1; i <= n; i++) {
          const d = (i / n) * len;
          cur.zones.push({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, r: 46, u: i / n });
        }
        cur.sweep = 0;
        cur.dmg = 20;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const BIND = 0.6, SWEEP_FROM = 0.85, SWEEP_SPAN = 0.95;
        if (cur.t < BIND) {
          for (const z of cur.sigils) {
            if (z.fired || cur.t < 0.15) continue;
            z.fired = true;
            if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) {
              env.hurtPlayer(20 * DMG);
              pl.slowT = Math.max(pl.slowT || 0, 2.0);
              env.addEffect(pl.x, pl.y, 'pop', 0.5, BLOOD);
            }
            env.addEffect(z.x, z.y, 'pop', 0.4, ACCENT);
          }
          return;
        }
        if (cur.t < SWEEP_FROM) return;
        const sweep = Math.min(1, (cur.t - SWEEP_FROM) / SWEEP_SPAN);
        cur.sweep = sweep;
        if ((pl.z || 0) > 30) return;
        for (const z of cur.zones) {
          if (Math.abs(z.u - sweep) > 0.1) continue;
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) {
            env.hurtPlayer(cur.dmg * dt * 2.4 * DPS);
            break;
          }
        }
      }
    },

    safePassage: {
      name: 'Safe Passage', minStage: 4,
      windup: 0.7, tele: 1.5, active: 2.0, recover: 0.9,
      build(e, cur) {
        const pl = env.player;
        const step = 118, rad = 780;
        const cells = [];
        // one true refuge is always written under the player's feet
        const safe = [{ x: pl.x, y: pl.y, r: 70 }];
        const a0 = env.rand(0, Math.PI * 2);
        for (let i = 0; i < 2; i++) {
          const a = a0 + (i * Math.PI * 2) / 2;
          safe.push({
            x: env.clamp(pl.x + Math.cos(a) * 320, 100, env.world.w - 100),
            y: env.clamp(pl.y + Math.sin(a) * 320, 100, env.world.h - 100),
            r: 70
          });
        }
        for (let gx = -rad; gx <= rad; gx += step) {
          for (let gy = -rad; gy <= rad; gy += step) {
            const x = pl.x + gx, y = pl.y + gy;
            if (x < 70 || y < 70 || x > env.world.w - 70 || y > env.world.h - 70) continue;
            let isSafe = false;
            for (const s of safe) {
              if (env.dist2(x, y, s.x, s.y) < (s.r + 40) * (s.r + 40)) { isSafe = true; break; }
            }
            if (!isSafe) cells.push({ x, y, r: step * 0.44 });
          }
        }
        cur.cells = cells;
        cur.safe = safe;
        cur.detonated = false;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        for (const s of cur.safe) {
          if (env.dist2(pl.x, pl.y, s.x, s.y) < s.r * s.r) return;   // sheltered
        }
        env.hurtPlayer(52 * dt * DPS);
      }
    }
  };

  const STAGE_NAMES = ['The First Marks', 'The Wards', 'The Edicts', 'The Final Seal'];

  // ---- stage helpers -------------------------------------------------------
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
    const st = e._sw;
    const pool = availableAttacks(st.stage);
    let opts = pool;
    if (st.last && pool.length > 1) opts = pool.filter((k) => k !== st.last);
    const k = opts[Math.floor(env.rand(0, opts.length))];
    st.last = k;
    return k;
  }
  function startAttack(e, key) {
    const A = ATTACKS[key];
    e._sw.cur = {
      key, name: A.name, phase: 'windup', t: 0,
      // Every phase is compressed: the warning before a seal lands is short,
      // and the warden recovers from one seal only just before the next.
      phases: {
        windup: Math.max(0.1, A.windup * TEMPO),
        tele: Math.max(0.18, A.tele * TEMPO),
        active: Math.max(0.45, A.active * 0.85),
        recover: Math.max(0.12, A.recover * TEMPO)
      }
    };
    // The health bar names the seal that is being written, so the shape
    // landing on the floor is always announced before it strikes.
    e.bossName = 'The Sealwright · ' + A.name;
  }

  // ---- per-frame update (called from the engine's enemy loop) -------------
  function tick(e, dt) {
    if (!env) return;
    if (!e._sw) {
      e._sw = { stage: 1, cur: null, last: null, idle: 0.4, phaseAnim: null, hitFlash: 0, intro: 0.6, volley: 0 };
    }
    const st = e._sw;

    // The Sealwright fights with its own seals — never with the generic
    // boss gun, so its shots never muddy an attack's telegraph.
    e.cd = 3;
    e.alerted = false;

    st.hitFlash = Math.max(0, st.hitFlash - dt);

    if (st.intro > 0) {
      st.intro -= dt;
      e.vx = 0; e.vy = 0;
      return;
    }

    const pl = env.player;

    // ---- phase-change burst: the warden re-writes itself and the ground ----
    if (st.phaseAnim) {
      st.phaseAnim.t += dt;
      const pa = st.phaseAnim;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 9 * (1 - pa.t / pa.dur));
      e.vx *= 0.7; e.vy *= 0.7;
      if (pa.t >= pa.dur) { st.phaseAnim = null; st.idle = 0.1; st.cur = null; }
      return;
    }

    // ---- health thresholds drive the stages ----
    const ns = stageFor(e);
    if (ns !== st.stage) {
      const old = st.stage;
      st.stage = ns;
      st.cur = null;
      st.phaseAnim = { t: 0, dur: 0.9, from: old, to: ns };
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 16);
      if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 1.0, ACCENT);
      try {
        if (window.BossStageCutscene) {
          window.BossStageCutscene.play({
            theme: 'meadow', accent: ACCENT, name: 'The Sealwright', from: old, to: ns
          });
        }
      } catch (_) {}
      return;
    }

    // ---- footwork ----
    // The engine already walks this "boss" toward the player every frame, so
    // the Sealwright only slows itself down to plant a heavy seal.
    if (st.cur && st.cur.phase !== 'recover' && st.cur.key !== 'sealLine' &&
        st.cur.key !== 'bindingSigils' && st.cur.key !== 'counterfeitWard') {
      e.vx *= 0.55; e.vy *= 0.55;
    }

    // ---- between seals: the warden never stops writing ----
    // Aimed ink bolts keep coming even mid-attack, so the gaps that used to
    // be free are now spent dodging.
    if (st.stage >= 1) {
      st.volley = (st.volley || 0) - dt;
      if (st.volley <= 0) {
        st.volley = Math.max(0.4, 1.15 - st.stage * 0.17);
        const a = Math.atan2(pl.y - e.y, pl.x - e.x);
        for (let i = -1; i <= 1; i++) {
          env.spawnEBullet(
            e.x + Math.cos(a) * (e.r || 40), e.y + Math.sin(a) * (e.r || 40),
            a + i * 0.16, 400, 16
          );
        }
      }
    }

    // ---- attack state machine ----
    if (!st.cur) {
      st.idle -= dt;
      if (st.idle <= 0) startAttack(e, pickNext(e));
      return;
    }
    const c = st.cur, P = c.phases;
    const su = (c.phase === 'windup' || c.phase === 'recover') ? 1.05 : 1;
    c.t += dt * su;

    if (c.phase === 'windup' && c.t >= P.windup) {
      c.phase = 'tele'; c.t = 0;
      // Lay the seal out the moment the warning starts, so the whole
      // telegraph the player sees is the shape that will actually strike.
      ATTACKS[c.key].build(e, c);
    } else if (c.phase === 'tele' && c.t >= P.tele) {
      c.phase = 'active'; c.t = 0;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 4);
    } else if (c.phase === 'active' && c.t >= P.active) {
      c.phase = 'recover'; c.t = 0;
    } else if (c.phase === 'recover' && c.t >= P.recover) {
      st.cur = null;
      st.idle = stageInterval(st.stage);
      e.bossName = 'The Sealwright';
      return;
    }

    if (c.phase === 'active' && ATTACKS[c.key].tick) ATTACKS[c.key].tick(e, c, dt);
  }

  // ---- rendering ----------------------------------------------------------
  // Both renderers hand off to the effects module; the tiny procedural
  // fallback keeps the warden visible if that script never loaded.
  function draw2D(e, ctx, cx, cy, t) {
    if (window.SealWrightFX) { window.SealWrightFX.draw2D(e, ctx, cx, cy, t, env); return; }
    if (!ctx) return;
    ctx.fillStyle = ACCENT;
    ctx.beginPath(); ctx.arc(cx, cy, (e.r || 40) * 0.8, 0, Math.PI * 2); ctx.fill();
  }

  function draw3D(R, e, tt) {
    if (window.SealWrightFX) { window.SealWrightFX.draw3D(R, e, tt, env); return; }
    if (!R || !R.ok) return;
    R.glow(e.x, (e.r || 40) * 1.2, e.y, (e.r || 40) * 1.6, 1.2, 0.9, 0.4, 0.5, 0);
  }

  // ---- spawn init ---------------------------------------------------------
  function initEnemy(e) {
    e.r = 40;
    e.hp = e.maxhp = 8900;
    e.speed = 138;                // it closes the distance; no kiting in circles
    e.cd = 99;
    e.detectR = 1300;
    e.absorbing = false;          // a straight fight: no add-shield gating
    e.commandCD = 3.0;
    e.bossName = 'The Sealwright';
    e.bossColor = ACCENT;
    e._sw = { stage: 1, cur: null, last: null, idle: 0.4, phaseAnim: null, hitFlash: 0, intro: 0.6, wardT: 0, volley: 0 };
  }

  function onHit(e, dmg) {
    if (!e._sw) return;
    e._sw.hitFlash = Math.min(1, (e._sw.hitFlash || 0) + Math.min(0.5, dmg / 60));
  }

  window.SealWright = {
    setEnv(_env) { env = _env; },
    initEnemy,
    tick,
    draw2D,
    draw3D,
    onHit,
    ACCENT,
    GLYPH: PARCH,
    STAGE_NAMES,
    get attackNames() { return Object.keys(ATTACKS).map((k) => ATTACKS[k].name); }
  };
})();
