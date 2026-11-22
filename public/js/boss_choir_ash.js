// ============================================================
// Monster Arena — THE CHOIR OF ASH (Age of the Sentinel, Chapter 2)
// The Sunken Archive's warden: nine drowned voices that lost their
// lines and refuse to be read. It does not stalk the arena — it
// sings over it, and whatever stands where the hymn lands burns.
//
// Four stages, driven by remaining health, EIGHT attacks in total:
//   Stage 1 (100–75%): Cinder Canticle, Ashen Notes
//   Stage 2 (75–50%):  + Funeral Chorus, Sootbound Voices
//   Stage 3 (50–25%):  + Pyre Procession, Hollow Refrain
//   Stage 4 (25–0%):   + Ashfall Cathedral, Finale of Embers
// Earlier attacks stay in the pool at every later stage.
//
// Spawned by the engine in place of the generic boss when
// SENTINEL_ACTIVE && SENTINEL_CHAPTER === 2 (wave 5 of chapter 2).
// ============================================================
(function () {
  'use strict';

  const ACCENT = '#ff2f10';   // scarlet — the singing wound (never gold)
  const ASH = '#2b2428';      // soot of the robes
  const BONE = '#d8c8bc';     // the cracked masks
  const EMBER = '#ff7a3c';    // hot cinders

  // ---- DIFFICULTY (same baseline as the Sealwright) ----
  const DMG = 2.5;      // multiplier on every discrete (one-off) hit
  const DPS = 2.2;      // multiplier on every sustained per-second tick
  const TEMPO = 0.55;   // phase-length multiplier — lower is faster
  const STAGE_INTERVAL = [0.34, 0.28, 0.2, 0.14];   // idle gap per stage
  const MAXHP = 12000;  // more health than the Sealwright: a longer hymn

  // ---- engine refs (handed in via setEnv) ----
  let env = null;

  // The engine hands its references to the custom bosses through
  // HearthWarden.setEnv; borrow that same channel rather than adding
  // engine wiring of our own.
  (function borrowEnv() {
    const hw = window.HearthWarden;
    if (!hw || !hw.setEnv) return;
    const orig = hw.setEnv;
    hw.setEnv = function (obj) { env = obj; return orig.call(hw, obj); };
  })();

  // ---- shared geometry helpers -------------------------------------------
  // Is the player standing inside a beam written from (ex,ey) along `ang`?
  function inBeam(pl, ex, ey, ang, len, w) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const rx = pl.x - ex, ry = pl.y - ey;
    const along = rx * dx + ry * dy;
    if (along < 0 || along > len) return false;
    const perp = Math.abs(-rx * dy + ry * dx);
    return perp < w * 0.5 + (pl.r || 14);
  }

  function ahead(pl, e, k) {
    // where the player is *going* — standing still is never an answer
    return Math.atan2(
      pl.y + (pl.vy || 0) * (k || 0.3) - e.y,
      pl.x + (pl.vx || 0) * (k || 0.3) - e.x
    );
  }

  // ---- attack phases -----------------------------------------------------
  // Each attack runs windup -> tele -> active -> recover, exactly like the
  // Sealwright, so the engine's loop timing stays untouched.
  const ATTACKS = {
    // ---- Stage 1: The First Cinders --------------------------------------
    cinderCanticle: {
      name: 'Cinder Canticle', minStage: 1,
      windup: 0.5, tele: 0.8, active: 0.9, recover: 0.65,
      build(e, cur) {
        cur.ang = ahead(env.player, e, 0.3);
        cur.len = 980;
        cur.w = 56;
        cur.dmg = 16;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        if ((pl.z || 0) > 30) return;   // jump the low stream
        if (inBeam(pl, e.x, e.y, cur.ang, cur.len, cur.w)) {
          env.hurtPlayer(cur.dmg * dt * 2.2 * DPS);
          if (Math.random() < 0.2) env.addEffect(pl.x, pl.y, 'pop', 0.2, EMBER);
        }
      }
    },

    ashenNotes: {
      name: 'Ashen Notes', minStage: 1,
      windup: 0.35, tele: 0.75, active: 1.25, recover: 0.55,
      build(e, cur) {
        // Six notes written in an arc across the player's path, each one
        // bursting on its own beat — the marks never move once laid.
        const pl = env.player;
        const a = Math.atan2(pl.y - e.y, pl.x - e.x) + Math.PI / 2;
        cur.zones = [];
        for (let i = 0; i < 6; i++) {
          const off = (i - 2.5) * 106;
          cur.zones.push({
            x: pl.x + Math.cos(a) * off + env.rand(-16, 16),
            y: pl.y + Math.sin(a) * off + env.rand(-16, 16),
            r: 54, at: 0.05 + i * 0.075, fired: false
          });
        }
      },
      tick(e, cur, dt) {
        const pl = env.player;
        for (const z of cur.zones) {
          if (z.fired || cur.t < z.at) continue;
          z.fired = true;
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) {
            env.hurtPlayer(20 * DMG);
            env.addEffect(pl.x, pl.y, 'pop', 0.5, ACCENT);
          }
          env.addEffect(z.x, z.y, 'pop', 0.4, EMBER);
        }
      }
    },

    // ---- Stage 2: The Gathering ------------------------------------------
    funeralChorus: {
      name: 'Funeral Chorus', minStage: 2,
      windup: 0.45, tele: 0.7, active: 2.5, recover: 0.6,
      build(e, cur) {
        // Three rings of ash, each quicker than the last.
        cur.rings = [
          { born: 0.0, sp: 430, hit: false },
          { born: 0.42, sp: 540, hit: false },
          { born: 0.84, sp: 660, hit: false }
        ];
        cur.dmg = 24;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        if ((pl.z || 0) > 28) return;   // jump every ring
        const d = Math.sqrt(env.dist2(pl.x, pl.y, e.x, e.y));
        for (const r of cur.rings) {
          if (r.hit || cur.t < r.born) continue;
          const rad = (cur.t - r.born) * r.sp;
          if (Math.abs(d - rad) > 34) continue;
          r.hit = true;
          env.hurtPlayer(cur.dmg * DMG);
        }
      }
    },

    sootboundVoices: {
      name: 'Sootbound Voices', minStage: 2,
      windup: 0.4, tele: 0.6, active: 5.0, recover: 0.5,
      build(e, cur) {
        cur.nodes = [];
        const n = 4;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + env.rand(0, 1);
          const d = 470 + env.rand(-70, 70);
          cur.nodes.push({
            x: env.clamp(e.x + Math.cos(a) * d, 90, env.world.w - 90),
            y: env.clamp(e.y + Math.sin(a) * d, 90, env.world.h - 90),
            hp: 60, r: 20, dead: false, t: 0
          });
        }
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const bullets = (env.ents && env.ents.bullets) || [];
        for (const nd of cur.nodes) {
          if (nd.dead) continue;
          nd.t += dt;
          // player fire burns the spirit away before it arrives
          for (const b of bullets) {
            if (!b || b.dmg == null) continue;
            if (env.dist2(nd.x, nd.y, b.x, b.y) < (nd.r + 12) * (nd.r + 12)) {
              nd.hp -= b.dmg;
              if (Math.random() < 0.3) env.addEffect(nd.x, nd.y, 'pop', 0.15, ASH);
              break;
            }
          }
          if (nd.hp <= 0) { nd.dead = true; env.addEffect(nd.x, nd.y, 'pop', 0.5, ASH); continue; }

          // otherwise it drifts toward the player and sings itself out
          const a = Math.atan2(pl.y - nd.y, pl.x - nd.x);
          const step = 168 * dt;
          nd.x += Math.cos(a) * step;
          nd.y += Math.sin(a) * step;
          if (env.dist2(pl.x, pl.y, nd.x, nd.y) < (nd.r + pl.r + 4) * (nd.r + pl.r + 4)) {
            nd.dead = true;
            env.hurtPlayer(26 * DMG);
            env.addEffect(nd.x, nd.y, 'pop', 0.7, ACCENT);
          }
        }
      }
    },

    // ---- Stage 3: The Blackened Hymn -------------------------------------
    pyreProcession: {
      name: 'Pyre Procession', minStage: 3,
      windup: 0.5, tele: 0.8, active: 2.7, recover: 0.7,
      build(e, cur) {
        // Four burning lanes cross the arena in a lattice; the corridors
        // between them are the whole fight.
        cur.w = 124;
        cur.lanes = [
          { axis: 'h', born: 0.0, sp: 660 },
          { axis: 'v', born: 0.5, sp: 660 },
          { axis: 'h', born: 1.0, sp: 660 },
          { axis: 'v', born: 1.5, sp: 660 }
        ];
        cur.dmg = 20;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        if ((pl.z || 0) > 30) return;
        for (const ln of cur.lanes) {
          if (cur.t < ln.born) continue;
          const p = -200 + (cur.t - ln.born) * ln.sp;
          const at = ln.axis === 'h' ? pl.y : pl.x;
          if (Math.abs(at - p) < cur.w * 0.5 + (pl.r || 14)) {
            env.hurtPlayer(cur.dmg * dt * DPS);
            break;
          }
        }
      }
    },

    hollowRefrain: {
      name: 'Hollow Refrain', minStage: 3,
      windup: 0.5, tele: 0.7, active: 2.3, recover: 0.6,
      build(e, cur) {
        // The canticle, then the same note again from the other side of the
        // warden — an echo, not a repeat, so dodging the first is not enough.
        const a = ahead(env.player, e, 0.3);
        cur.len = 940;
        cur.w = 54;
        cur.beams = [
          { ang: a, from: 0.0, to: 1.05 },
          { ang: a + Math.PI, from: 1.15, to: 2.2 }
        ];
        cur.dmg = 20;
        cur.echoed = false;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        if (!cur.echoed && cur.t >= 1.15) {
          cur.echoed = true;
          env.addEffect(e.x, e.y, 'pop', 0.6, EMBER);
        }
        if ((pl.z || 0) > 30) return;
        for (const bm of cur.beams) {
          if (cur.t < bm.from || cur.t > bm.to) continue;
          if (inBeam(pl, e.x, e.y, bm.ang, cur.len, cur.w)) {
            env.hurtPlayer(cur.dmg * dt * DPS);
            break;
          }
        }
      }
    },

    // ---- Stage 4: The Last Verse -----------------------------------------
    ashfallCathedral: {
      name: 'Ashfall Cathedral', minStage: 4,
      windup: 0.7, tele: 1.2, active: 3.6, recover: 0.9,
      build(e, cur) {
        // The whole floor is written over with falling cinders; three
        // pockets stay safe — and they drift, so shelter must be followed.
        const pl = env.player;
        const safe = [{ x: pl.x, y: pl.y, r: 92, vx: env.rand(60, 150) * (Math.random() < 0.5 ? -1 : 1), vy: env.rand(60, 150) * (Math.random() < 0.5 ? -1 : 1) }];
        for (let i = 0; i < 2; i++) {
          const a = env.rand(0, Math.PI * 2);
          safe.push({
            x: env.clamp(pl.x + Math.cos(a) * 420, 140, env.world.w - 140),
            y: env.clamp(pl.y + Math.sin(a) * 420, 140, env.world.h - 140),
            r: 92, vx: env.rand(60, 150) * (Math.random() < 0.5 ? -1 : 1),
            vy: env.rand(60, 150) * (Math.random() < 0.5 ? -1 : 1)
          });
        }
        cur.safe = safe;
        cur.cells = [];
        const step = 122, rad = 800;
        for (let gx = -rad; gx <= rad; gx += step) {
          for (let gy = -rad; gy <= rad; gy += step) {
            const x = pl.x + gx, y = pl.y + gy;
            if (x < 70 || y < 70 || x > env.world.w - 70 || y > env.world.h - 70) continue;
            let isSafe = false;
            for (const s of safe) {
              if (env.dist2(x, y, s.x, s.y) < (s.r + 46) * (s.r + 46)) { isSafe = true; break; }
            }
            if (!isSafe) cur.cells.push({ x, y, r: step * 0.44 });
          }
        }
      },
      tick(e, cur, dt) {
        const pl = env.player;
        for (const s of cur.safe) {
          s.x = env.clamp(s.x + s.vx * dt, 120, env.world.w - 120);
          s.y = env.clamp(s.y + s.vy * dt, 120, env.world.h - 120);
          if (s.x <= 120 || s.x >= env.world.w - 120) s.vx *= -1;
          if (s.y <= 120 || s.y >= env.world.h - 120) s.vy *= -1;
          if (env.dist2(pl.x, pl.y, s.x, s.y) < s.r * s.r) return;   // sheltered
        }
        env.hurtPlayer(46 * dt * DPS);
      }
    },

    finaleOfEmbers: {
      name: 'Finale of Embers', minStage: 4,
      windup: 0.6, tele: 0.85, active: 3.2, recover: 0.9,
      build(e, cur) {
        const pl = env.player;
        // first the stream, then the notes, then it reels.
        cur.ang = ahead(pl, e, 0.25);
        cur.len = 1000;
        cur.w = 58;
        cur.marks = [];
        const a = cur.ang + Math.PI / 2;
        for (let i = 0; i < 6; i++) {
          const off = (i - 2.5) * 96;
          cur.marks.push({
            x: pl.x + Math.cos(a) * off, y: pl.y + Math.sin(a) * off,
            r: 50, at: 1.5 + i * 0.16, fired: false
          });
        }
      },
      tick(e, cur, dt) {
        const pl = env.player;
        if (cur.t <= 1.15 && (pl.z || 0) <= 30 && inBeam(pl, e.x, e.y, cur.ang, cur.len, cur.w)) {
          env.hurtPlayer(20 * dt * 2.2 * DPS);
        }
        for (const z of cur.marks) {
          if (z.fired || cur.t < z.at) continue;
          z.fired = true;
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) {
            env.hurtPlayer(22 * DMG);
            env.addEffect(pl.x, pl.y, 'pop', 0.5, ACCENT);
          }
          env.addEffect(z.x, z.y, 'pop', 0.35, EMBER);
        }
      }
    }
  };

  const STAGE_NAMES = ['The First Cinders', 'The Gathering', 'The Blackened Hymn', 'The Last Verse'];

  // ---- stage helpers ------------------------------------------------------
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
    const st = e._ca;
    const pool = availableAttacks(st.stage);
    let opts = pool;
    if (st.last && pool.length > 1) opts = pool.filter((k) => k !== st.last);
    const k = opts[Math.floor(env.rand(0, opts.length))];
    st.last = k;
    return k;
  }
  function startAttack(e, key) {
    const A = ATTACKS[key];
    e._ca.cur = {
      key, name: A.name, phase: 'windup', t: 0,
      phases: {
        windup: Math.max(0.1, A.windup * TEMPO),
        tele: Math.max(0.18, A.tele * TEMPO),
        active: Math.max(0.45, A.active * 0.85),
        recover: Math.max(0.12, A.recover * TEMPO)
      }
    };
    // The health bar names the verse being sung, so the shape landing on the
    // floor is always announced before it strikes.
    e.bossName = 'The Choir of Ash · ' + A.name;
  }

  // ---- per-frame update (called from the engine's enemy loop) -------------
  function tick(e, dt) {
    if (!env) return;
    if (!e._ca) {
      e._ca = { stage: 1, cur: null, last: null, idle: 0.4, phaseAnim: null, hitFlash: 0, intro: 0.6, volley: 0, exposed: 0 };
    }
    const st = e._ca;

    // The Choir fights with its own hymn — never with the generic boss gun.
    e.cd = 3;
    e.alerted = false;

    st.hitFlash = Math.max(0, st.hitFlash - dt);

    if (st.intro > 0) {
      st.intro -= dt;
      e.vx = 0; e.vy = 0;
      return;
    }

    const pl = env.player;

    // ---- reeling after the Finale: the window to punish it ----
    if (st.exposed > 0) {
      st.exposed -= dt;
      e.vx *= 0.2; e.vy *= 0.2;
      if (st.exposed <= 0) { st.idle = Math.max(st.idle, 0.25); e.bossName = 'The Choir of Ash'; }
      return;
    }

    // ---- phase-change burst: the Choir splits and re-forms ----
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
            theme: 'cinder', accent: ACCENT, name: 'The Choir of Ash', from: old, to: ns
          });
        }
      } catch (_) {}
      return;
    }

    // ---- footwork: it plants itself to sing ----
    if (st.cur && st.cur.phase !== 'recover' &&
        st.cur.key !== 'cinderCanticle' && st.cur.key !== 'hollowRefrain') {
      e.vx *= 0.55; e.vy *= 0.55;
    }

    // ---- between verses: cinders fall where you stand ----
    // The Sealwright spends every gap firing an aimed three-bolt volley, and
    // that volley was the thing players kept mistaking for the Choir's. The
    // Choir never shoots at all: two cinders drop on the floor near the
    // player's feet and burst after a beat, so the pressure is spent ground
    // and a countdown, not a pulse of light flying down a lane.
    st.volley = (st.volley || 0) - dt;
    if (st.volley <= 0) {
      st.volley = Math.max(0.95, 2.4 - st.stage * 0.3);
      for (let i = 0; i < 2; i++) {
        const px = pl.x + env.rand(-78, 78);
        const py = pl.y + env.rand(-78, 78);
        env.spawnBomb(px, py, 0, 0, 15, 82, 0.95, { glyphColor: ACCENT });
        if (env.addEffect) env.addEffect(px, py, 'pop', 0.28, ACCENT);
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
      ATTACKS[c.key].build(e, c);
    } else if (c.phase === 'tele' && c.t >= P.tele) {
      c.phase = 'active'; c.t = 0;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 4);
    } else if (c.phase === 'active' && c.t >= P.active) {
      c.phase = 'recover'; c.t = 0;
    } else if (c.phase === 'recover' && c.t >= P.recover) {
      const wasFinale = c.key === 'finaleOfEmbers';
      st.cur = null;
      st.idle = stageInterval(st.stage);
      if (wasFinale) {
        // The last verse leaves it open: it holds still and stops singing.
        st.exposed = 1.6;
        e.bossName = 'The Choir of Ash · Reeling';
      } else e.bossName = 'The Choir of Ash';
      return;
    }

    if (c.phase === 'active' && ATTACKS[c.key].tick) ATTACKS[c.key].tick(e, c, dt);
  }

  // ---- rendering ----------------------------------------------------------
  // Both renderers hand off to the effects module; the tiny procedural
  // fallback keeps the Choir visible if that script never loaded.
  function draw2D(e, ctx, cx, cy, t) {
    if (window.ChoirAshFX) { window.ChoirAshFX.draw2D(e, ctx, cx, cy, t, env); return; }
    if (!ctx) return;
    ctx.fillStyle = ACCENT;
    ctx.beginPath(); ctx.arc(cx, cy, (e.r || 40) * 0.8, 0, Math.PI * 2); ctx.fill();
  }

  function draw3D(R, e, tt) {
    if (window.ChoirAshFX) { window.ChoirAshFX.draw3D(R, e, tt, env); return; }
    if (!R || !R.ok) return;
    R.glow(e.x, (e.r || 40) * 1.2, e.y, (e.r || 40) * 1.6, 1.4, 0.7, 0.35, 0.5, 0);
  }

  // ---- spawn init ---------------------------------------------------------
  function initEnemy(e) {
    e.r = 42;
    e.hp = e.maxhp = MAXHP;
    e.speed = 136;
    e.cd = 99;
    e.detectR = 1300;
    e.absorbing = false;
    e.commandCD = 3.0;
    e.bossName = 'The Choir of Ash';
    e.bossColor = ACCENT;
    e._ca = { stage: 1, cur: null, last: null, idle: 0.4, phaseAnim: null, hitFlash: 0, intro: 0.6, volley: 0, exposed: 0 };
  }

  function onHit(e, dmg) {
    if (!e._ca) return;
    e._ca.hitFlash = Math.min(1, (e._ca.hitFlash || 0) + Math.min(0.5, dmg / 60));
  }

  window.ChoirOfAsh = {
    setEnv(_env) { env = _env; },
    initEnemy,
    tick,
    draw2D,
    draw3D,
    onHit,
    ACCENT,
    GLYPH: BONE,
    STAGE_NAMES,
    MAXHP,
    get attackNames() { return Object.keys(ATTACKS).map((k) => ATTACKS[k].name); }
  };
})();
