// ============================================================
// Monster Arena — THE GILDED BAILIFF (Age of the Sentinel, Chapter 4)
// March of Embers' warden: the writ that keeps a festival evening
// kind. Where the Magma Titan forges, chains and reshapes the
// arena, the Bailiff SERVES NOTICE — every attack is a sentence
// written on the floor in molten gold, stamped, and then carried
// out. Seals, dockets, scales and decrees: nothing it does is a
// blunt physical blow.
//
// Four stages, EIGHT attacks in total:
//   Stage 1 (100–75%): Brand of Entry, Cinder Writ
//   Stage 2 (75–50%):  + Bailiff's Procession, Writ-Reversal
//   Stage 3 (50–25%):  + Obsidian Docket, Scales of Sentence
//   Stage 4 (25–0%):   + Final Decree, The Golden Verdict
// Earlier attacks stay in the pool at every later stage.
// ============================================================
(function () {
  'use strict';

  const ACCENT = '#ffc45c';   // molten gold — the writ's ink
  const GOLD = '#ffe6a8';     // hot gold
  const EMBER = '#ff7a2a';    // the ember of a stamped seal
  const OBSIDIAN = '#241a1d'; // the docket's black glass
  const PARCH = '#f6e8c6';    // the Bailiff's parchment mask

  // ---- DIFFICULTY -------------------------------------------------------
  const DMG = 2.3;            // multiplier on every discrete hit
  const DPS = 2.1;            // multiplier on sustained per-second ticks
  const TEMPO = 0.62;         // phase-length multiplier — lower is faster
  const STAGE_INTERVAL = [0.34, 0.28, 0.2, 0.15];
  // Above the Hourglass Stag's 14000: the writ outlasts the hourglass.
  const MAXHP = 16000;

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrap = (a) => ((a % TAU) + TAU) % TAU;

  // ---- sprite (optional art; procedural body until it loads) -------------
  const SPRITE_SRC = 'assets/boss/gilded_bailiff.png?v=5';
  const img = new Image();
  let imgReady = false;
  img.crossOrigin = 'anonymous';
  img.onload = () => { imgReady = true; };
  img.onerror = () => { imgReady = false; };
  img.src = SPRITE_SRC;

  // ---- engine refs (handed in via setEnv) -------------------------------
  // Custom bosses are given their references through HearthWarden.setEnv;
  // borrow that same channel rather than adding engine wiring of our own.
  let env = null;
  (function borrowEnv() {
    const hw = window.HearthWarden;
    if (!hw || !hw.setEnv) return;
    const orig = hw.setEnv;
    hw.setEnv = function (obj) { env = obj; return orig.call(hw, obj); };
  })();

  // ---- geometry helpers --------------------------------------------------
  function bearingTo(e, pl) { return Math.atan2(pl.y - e.y, pl.x - e.x); }
  function leadingAngle(e, pl, lead) {
    return Math.atan2(pl.y + (pl.vy || 0) * lead - e.y, pl.x + (pl.vx || 0) * lead - e.x);
  }
  function edgeX(v) { return clamp(v, 90, (env.world.w || 1600) - 90); }
  function edgeY(v) { return clamp(v, 90, (env.world.h || 1600) - 90); }
  function inLane(pl, ax, ay, ang, len, w) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const rx = pl.x - ax, ry = pl.y - ay;
    const along = rx * dx + ry * dy;
    if (along < -20 || along > len) return false;
    return Math.abs(-rx * dy + ry * dx) < w * 0.5 + (pl.r || 14);
  }

  // ============================================================
  // EIGHT ATTACKS
  // ============================================================
  const ATTACKS = {
    // 1. A seal is stamped where the player stands and slides after them
    //    until it sets — then the ground it holds becomes a burning entry.
    brandOfEntry: {
      name: 'Brand of Entry', minStage: 1, windup: 0.45, tele: 0.75, active: 3.0, recover: 0.5,
      build(e, c) {
        const pl = env.player;
        c.mark = { x: edgeX(pl.x), y: edgeY(pl.y), r: 96 };
        c.lockAt = 1.0; c.linger = 1.9; c.dmg = 26;
      },
      tick(e, c, dt) {
        const pl = env.player;
        const m = c.mark;
        if (c.t < c.lockAt) {
          const a = Math.atan2(pl.y - m.y, pl.x - m.x);
          const d = Math.hypot(pl.x - m.x, pl.y - m.y);
          const step = Math.min(d, 330 * dt);
          m.x = edgeX(m.x + Math.cos(a) * step);
          m.y = edgeY(m.y + Math.sin(a) * step);
          return;
        }
        const local = c.t - c.lockAt;
        if (local > c.linger) return;
        if (env.dist2(pl.x, pl.y, m.x, m.y) < (m.r + pl.r) * (m.r + pl.r)) {
          env.hurtPlayer(c.dmg * dt * (local < 0.45 ? DPS * 1.35 : DPS * 0.8));
        }
      }
    },
    // 2. A line of small seals is written down the player's path and read
    //    back the other way: the far end ignites first and the sentence
    //    travels back to the Bailiff's hand.
    cinderWrit: {
      name: 'Cinder Writ', minStage: 1, windup: 0.45, tele: 0.7, active: 2.1, recover: 0.5,
      build(e, c) {
        const pl = env.player;
        c.ang = leadingAngle(e, pl, 0.35);
        c.zones = [];
        const n = 7;
        for (let i = 1; i <= n; i++) {
          const d = 120 + i * 120;
          c.zones.push({
            x: edgeX(e.x + Math.cos(c.ang) * d), y: edgeY(e.y + Math.sin(c.ang) * d),
            r: 48, at: 0.1 + (n - i) * 0.16, dur: 0.42
          });
        }
        c.dmg = 22;
      },
      tick(e, c, dt) {
        const pl = env.player;
        for (const z of c.zones) {
          const local = c.t - z.at;
          if (local < 0 || local > z.dur) continue;
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) {
            env.hurtPlayer(c.dmg * dt * DPS);
            pl.slowT = Math.max(pl.slowT || 0, 0.35);
          }
        }
      }
    },
    // 3. Three censers are carried across the square in a column; each one
    //    burns whatever it passes over, and they arrive one after another.
    bailiffsProcession: {
      name: "Bailiff's Procession", minStage: 2, windup: 0.6, tele: 0.85, active: 3.4, recover: 0.6,
      build(e, c) {
        const pl = env.player;
        c.ang = bearingTo(e, pl);
        c.walkers = [];
        for (let i = 0; i < 3; i++) {
          const back = 200 + i * 300;
          c.walkers.push({
            x: edgeX(e.x - Math.cos(c.ang) * back),
            y: edgeY(e.y - Math.sin(c.ang) * back),
            r: 74, seed: i * 1.7
          });
        }
        c.spd = 250; c.dmg = 24;
      },
      tick(e, c, dt) {
        const pl = env.player;
        for (const w of c.walkers) {
          w.x = edgeX(w.x + Math.cos(c.ang) * c.spd * dt);
          w.y = edgeY(w.y + Math.sin(c.ang) * c.spd * dt);
          if (env.dist2(pl.x, pl.y, w.x, w.y) < (w.r + pl.r) * (w.r + pl.r)) {
            env.hurtPlayer(c.dmg * dt * DPS);
          }
        }
      }
    },
    // 4. Two seals — one under the player, one out at the point the writ
    //    will be read from. The first bursts, then the whole line between
    //    them catches. Leave the mark, then leave the line.
    writReversal: {
      name: 'Writ-Reversal', minStage: 2, windup: 0.55, tele: 0.8, active: 2.4, recover: 0.6,
      build(e, c) {
        const pl = env.player;
        const a = bearingTo(e, pl);
        c.a = { x: edgeX(pl.x), y: edgeY(pl.y), r: 92 };
        c.b = { x: edgeX(e.x + Math.cos(a) * 520), y: edgeY(e.y + Math.sin(a) * 520), r: 64 };
        c.fireA = 0.35; c.fireBeam = 1.05; c.beamW = 52; c.dmg = 26;
      },
      tick(e, c, dt) {
        const pl = env.player;
        if (c.t >= c.fireA && c.t - c.fireA < 0.5) {
          if (env.dist2(pl.x, pl.y, c.a.x, c.a.y) < (c.a.r + pl.r) * (c.a.r + pl.r)) {
            env.hurtPlayer(c.dmg * dt * DPS * 1.3);
          }
        }
        if (c.t >= c.fireBeam && c.t - c.fireBeam < 0.9) {
          const len = Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y);
          const ang = Math.atan2(c.b.y - c.a.y, c.b.x - c.a.x);
          if (inLane(pl, c.a.x, c.a.y, ang, len, c.beamW)) env.hurtPlayer(c.dmg * dt * DPS);
        }
      }
    },
    // 5. Black glass plates rise out of the square in a loose ring, then
    //    each cracks open and fires a short lane in the direction it was
    //    standing against. Shelter in the gaps; never beside a plate.
    obsidianDocket: {
      name: 'Obsidian Docket', minStage: 3, windup: 0.6, tele: 0.9, active: 2.8, recover: 0.7,
      build(e, c) {
        const pl = env.player;
        c.plates = [];
        const n = 6;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + env.rand(0, 0.6);
          const d = 120 + env.rand(0, 300);
          c.plates.push({
            x: edgeX(pl.x + Math.cos(a) * d), y: edgeY(pl.y + Math.sin(a) * d),
            r: 54, ang: a + Math.PI + env.rand(-0.35, 0.35),
            len: 340, w: 50, up: 0.2 + i * 0.05, fire: 1.25 + i * 0.14, dur: 0.42
          });
        }
        c.dmg = 24;
      },
      tick(e, c, dt) {
        const pl = env.player;
        for (const p of c.plates) {
          if (c.t > p.up && c.t < p.fire &&
              env.dist2(pl.x, pl.y, p.x, p.y) < (p.r * 0.8 + pl.r) * (p.r * 0.8 + pl.r)) {
            env.hurtPlayer(9 * dt * DPS);
          }
          const local = c.t - p.fire;
          if (local < 0 || local > p.dur) continue;
          if (inLane(pl, p.x, p.y, p.ang, p.len, p.w)) env.hurtPlayer(c.dmg * dt * DPS);
        }
      }
    },
    // 6. The scales are set down on either side of the Bailiff and weighed
    //    three times: one pan fills with fire, empties, and the other fills.
    scalesOfSentence: {
      name: 'Scales of Sentence', minStage: 3, windup: 0.65, tele: 0.9, active: 3.2, recover: 0.6,
      build(e, c) {
        const a = env.rand(0, TAU);
        c.cx = e.x; c.cy = e.y; c.r = 152;
        const dist = 310;
        c.sides = [
          { x: edgeX(e.x + Math.cos(a) * dist), y: edgeY(e.y + Math.sin(a) * dist) },
          { x: edgeX(e.x + Math.cos(a + Math.PI) * dist), y: edgeY(e.y + Math.sin(a + Math.PI) * dist) }
        ];
        c.beats = [];
        for (let i = 0; i < 3; i++) c.beats.push({ side: i % 2, at: 0.15 + i * 0.95, dur: 0.6 });
        c.dmg = 30;
      },
      tick(e, c, dt) {
        const pl = env.player;
        for (const b of c.beats) {
          const local = c.t - b.at;
          if (local < 0 || local > b.dur) continue;
          const s = c.sides[b.side];
          if (env.dist2(pl.x, pl.y, s.x, s.y) < (c.r + pl.r) * (c.r + pl.r)) {
            env.hurtPlayer(c.dmg * dt * DPS);
          }
        }
      }
    },
    // 7. The decree is read: two rings of molten script travel out from the
    //    stamp, each with a clause missing — and the clause the second ring
    //    leaves open is not the one the first did.
    finalDecree: {
      name: 'Final Decree', minStage: 4, windup: 0.8, tele: 1.1, active: 3.6, recover: 0.8,
      build(e, c) {
        c.cx = e.x; c.cy = e.y;
        const g0 = env.rand(0, TAU);
        c.rings = [
          { born: 0.0, gap: g0, spin: 0.22, r: 0, sp: 520, max: 1000, half: 0.48 },
          { born: 1.05, gap: wrap(g0 + 1.9), spin: -0.26, r: 0, sp: 520, max: 1000, half: 0.44 }
        ];
        c.dmg = 30;
      },
      tick(e, c, dt) {
        const pl = env.player;
        const d = Math.hypot(pl.x - c.cx, pl.y - c.cy);
        for (const r of c.rings) {
          const local = c.t - r.born;
          if (local < 0) continue;
          r.r = local * r.sp;
          if (r.r > r.max) continue;
          r.gap = wrap(r.gap + r.spin * dt);
          if (Math.abs(d - r.r) > 42 + pl.r) continue;
          const a = Math.atan2(pl.y - c.cy, pl.x - c.cx);
          const diff = Math.abs(wrap(a - r.gap + Math.PI) - Math.PI);
          if (diff > r.half) env.hurtPlayer(c.dmg * dt * DPS);
        }
      }
    },
    // 8. SIGNATURE — four seals are numbered and laid around the player, a
    //    line of molten script sweeps through the square, and then the
    //    seals are carried out in the order they were written.
    goldenVerdict: {
      name: 'The Golden Verdict', minStage: 4, windup: 0.9, tele: 1.0, active: 4.2, recover: 1.1,
      build(e, c) {
        const pl = env.player;
        c.marks = [];
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + env.rand(0, 0.5);
          const d = 140 + env.rand(0, 220);
          c.marks.push({
            x: edgeX(pl.x + Math.cos(a) * d), y: edgeY(pl.y + Math.sin(a) * d),
            r: 80, at: 2.0 + i * 0.3, dur: 0.36, ord: i + 1
          });
        }
        c.sweep = {
          dir: env.rand(0, TAU), pos: -700, from: -700, spd: 600,
          w: 66, half: 560, born: 0.7, dur: 1.2
        };
        c.ox = e.x; c.oy = e.y;
        c.dmg = 30;
      },
      tick(e, c, dt) {
        const pl = env.player;
        const s = c.sweep;
        const localS = c.t - s.born;
        if (localS >= 0 && localS <= s.dur) {
          s.pos = s.from + s.spd * localS;
          const nx = Math.cos(s.dir + Math.PI / 2), ny = Math.sin(s.dir + Math.PI / 2);
          const dx = pl.x - c.ox, dy = pl.y - c.oy;
          const along = dx * nx + dy * ny;
          const lat = dx * Math.cos(s.dir) + dy * Math.sin(s.dir);
          if (Math.abs(along - s.pos) < s.w * 0.5 + pl.r && Math.abs(lat) < s.half + pl.r) {
            env.hurtPlayer(c.dmg * dt * DPS);
          }
        }
        for (const m of c.marks) {
          const local = c.t - m.at;
          if (local < 0 || local > m.dur) continue;
          if (env.dist2(pl.x, pl.y, m.x, m.y) < (m.r + pl.r) * (m.r + pl.r)) {
            env.hurtPlayer(c.dmg * dt * DPS);
            pl.slowT = Math.max(pl.slowT || 0, 0.5);
          }
        }
      }
    }
  };

  const STAGE_NAMES = ['The Opening Clauses', 'The Court Convenes', 'The Court Turns Hostile', 'The Final Ruling'];

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
    const st = e._gb;
    const pool = availableAttacks(st.stage);
    let opts = pool;
    if (st.last && pool.length > 1) opts = pool.filter((k) => k !== st.last);
    const k = opts[Math.floor(env.rand(0, opts.length))];
    st.last = k;
    return k;
  }
  function startAttack(e, key) {
    const A = ATTACKS[key];
    e._gb.cur = {
      key, name: A.name, phase: 'windup', t: 0,
      phases: {
        windup: Math.max(0.1, A.windup * TEMPO),
        tele: Math.max(0.18, A.tele * TEMPO),
        active: Math.max(0.45, A.active * 0.85),
        recover: Math.max(0.12, A.recover * TEMPO)
      }
    };
    // The health bar names the writ being served, so its shape is always
    // announced before it is carried out.
    e.bossName = 'The Gilded Bailiff · ' + A.name;
  }

  // ---- per-frame update (called from the engine's enemy loop) ------------
  function tick(e, dt) {
    if (!env) return;
    if (!e._gb) {
      e._gb = { stage: 1, cur: null, last: null, idle: 0.4, phaseAnim: null, hitFlash: 0, intro: 0.7 };
    }
    const st = e._gb;

    // The Bailiff fights with its writ, never with the generic boss gun.
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
      if (pa.t >= pa.dur) { st.phaseAnim = null; st.idle = 0.3; st.cur = null; }
      return;
    }

    // ---- stage transitions ----
    const ns = stageFor(e);
    if (ns !== st.stage) {
      const old = st.stage;
      st.stage = ns;
      st.cur = null;
      st.phaseAnim = { t: 0, dur: 1.5, from: old, to: ns };
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 16);
      if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 1.1, ACCENT);
      if (window.BossStageCutscene) {
        window.BossStageCutscene.play({ theme: 'cinder', accent: ACCENT, name: 'The Gilded Bailiff', from: old, to: ns });
      }
      return;
    }

    // ---- keep the bench: it holds the middle of the square and strafes ----
    const pl = env.player;
    if (!st.cur) {
      const d = Math.sqrt(env.dist2(e.x, e.y, pl.x, pl.y));
      const want = 280;
      const a = bearingTo(e, pl);
      if (d > want + 90) {
        const sp = e.speed;
        e.vx = env.lerp(e.vx || 0, Math.cos(a) * sp, 0.16);
        e.vy = env.lerp(e.vy || 0, Math.sin(a) * sp, 0.16);
      } else if (d < want - 90) {
        const sp = e.speed * 0.8;
        e.vx = env.lerp(e.vx || 0, -Math.cos(a) * sp, 0.16);
        e.vy = env.lerp(e.vy || 0, -Math.sin(a) * sp, 0.16);
      } else {
        const sp = e.speed * 0.5;
        e.vx = env.lerp(e.vx || 0, Math.cos(a + Math.PI / 2) * sp, 0.08);
        e.vy = env.lerp(e.vy || 0, Math.sin(a + Math.PI / 2) * sp, 0.08);
      }
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
    }

    // ---- attack cycle ----
    if (!st.cur) {
      st.idle -= dt;
      if (st.idle <= 0) startAttack(e, pickNext(e));
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
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 6);
    } else if (c.phase === 'active' && c.t >= P.active) {
      c.phase = 'recover'; c.t = 0;
      c.mark = null; c.zones = null; c.walkers = null; c.a = null; c.b = null;
      c.plates = null; c.beats = null; c.rings = null; c.marks = null; c.sweep = null;
    } else if (c.phase === 'recover' && c.t >= P.recover) {
      st.cur = null;
      st.idle = stageInterval(st.stage);
      e.bossName = 'The Gilded Bailiff';
      return;
    }
    if (c.phase === 'active' && ATTACKS[c.key].tick) ATTACKS[c.key].tick(e, c, dt);
  }

  // ============================================================
  // 2D RENDERER
  // ============================================================
  function glowCircle(ctx, x, y, r, inner, outer) {
    const g = ctx.createRadialGradient(x, y, 1, x, y, Math.max(2, r));
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, Math.max(2, r), 0, TAU); ctx.fill();
  }

  function seal2(ctx, x, y, r, prog, bright, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,196,92,' + (0.08 + 0.22 * prog) + ')';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,168,' + (bright ? 0.95 : 0.4 + 0.5 * prog) + ')';
    ctx.lineWidth = bright ? 4 : 2;
    ctx.beginPath(); ctx.arc(x, y, bright ? r : r * (0.6 + 0.4 * prog), 0, TAU); ctx.stroke();
    ctx.setLineDash([Math.max(5, r * 0.22), Math.max(3, r * 0.16)]);
    ctx.lineDashOffset = -t * 30;
    ctx.strokeStyle = 'rgba(255,196,92,' + (0.35 + 0.4 * prog) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r * 0.68, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawBody2(ctx, cx, cy, rr, t, stage) {
    ctx.save();
    ctx.translate(cx, cy);

    // soot shadow / robe
    ctx.fillStyle = 'rgba(0,0,0,.48)';
    ctx.beginPath(); ctx.ellipse(0, rr * 0.78, rr * 1.02, rr * 0.42, 0, 0, TAU); ctx.fill();

    // the writ's halo
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    glowCircle(ctx, 0, -rr * 0.1, rr * (1.9 + stage * 0.14), 'rgba(255,196,92,.22)', 'rgba(255,122,42,0)');
    ctx.restore();

    if (imgReady) {
      const h = rr * 3.1, w = h * ((img.naturalWidth || 1) / Math.max(1, img.naturalHeight || 1));
      ctx.drawImage(img, -w / 2, -h * 0.62, w, h);
      ctx.restore();
      return;
    }

    // obsidian robe
    ctx.beginPath();
    ctx.moveTo(0, -rr * 0.95);
    ctx.quadraticCurveTo(rr * 0.78, -rr * 0.2, rr * 0.92, rr * 0.82);
    ctx.quadraticCurveTo(0, rr * 1.02, -rr * 0.92, rr * 0.82);
    ctx.quadraticCurveTo(-rr * 0.78, -rr * 0.2, 0, -rr * 0.95);
    ctx.closePath();
    ctx.fillStyle = OBSIDIAN;
    ctx.fill();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // gold trim
    ctx.strokeStyle = 'rgba(255,196,92,.75)';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(0, -rr * 0.9); ctx.lineTo(0, rr * 0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, rr * 0.1, rr * 0.62, 0.3, Math.PI - 0.3); ctx.stroke();

    // parchment mask
    ctx.fillStyle = PARCH;
    ctx.beginPath(); ctx.ellipse(0, -rr * 0.62, rr * 0.34, rr * 0.44, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,122,42,.95)';
    ctx.beginPath(); ctx.arc(-rr * 0.12, -rr * 0.68, rr * 0.07, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(rr * 0.12, -rr * 0.68, rr * 0.07, 0, TAU); ctx.fill();

    // the raised writ
    ctx.save();
    ctx.translate(rr * 0.66, -rr * 0.34);
    ctx.rotate(-0.22 + Math.sin(t * 1.4) * 0.04);
    ctx.fillStyle = 'rgba(255,230,168,.95)';
    ctx.fillRect(-rr * 0.11, -rr * 0.3, rr * 0.22, rr * 0.6);
    ctx.strokeStyle = 'rgba(255,122,42,.85)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const y = -rr * 0.18 + i * rr * 0.16;
      ctx.beginPath(); ctx.moveTo(-rr * 0.06, y); ctx.lineTo(rr * 0.06, y); ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  function drawPhase2(ctx, e, pa, t) {
    const cam = env.cam || { x: 0, y: 0, sx: 0, sy: 0 };
    const cx = e.x - cam.x - (cam.sx || 0), cy = e.y - cam.y - (cam.sy || 0);
    const p = clamp(pa.t / pa.dur, 0, 1), fade = 1 - p;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    glowCircle(ctx, cx, cy, (e.r || 40) * (2.2 + p * 2.4), 'rgba(255,230,168,' + (0.7 * fade) + ')', 'rgba(255,122,42,0)');
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU + t;
      const d = (e.r || 40) + p * 460;
      ctx.fillStyle = 'rgba(255,196,92,' + (0.6 * fade) + ')';
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function telegraph2(ctx, e, c, t) {
    const cam = env.cam || { x: 0, y: 0, sx: 0, sy: 0 };
    const sx = (x) => x - cam.x - (cam.sx || 0);
    const sy = (y) => y - cam.y - (cam.sy || 0);
    const on = c.phase === 'active';
    const prog = on ? 1 : clamp(c.t / c.phases.tele, 0, 1);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    glowCircle(ctx, sx(e.x), sy(e.y), (e.r || 40) * (1.7 + prog * 0.5), 'rgba(255,196,92,' + (0.14 + 0.16 * prog) + ')', 'rgba(0,0,0,0)');
    ctx.restore();

    if (c.key === 'brandOfEntry' && c.mark) {
      const m = c.mark;
      const locked = on && c.t >= c.lockAt;
      seal2(ctx, sx(m.x), sy(m.y), m.r, locked ? 1 : prog * 0.8, locked, t);
      if (locked) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        glowCircle(ctx, sx(m.x), sy(m.y), m.r * 1.15, 'rgba(255,140,60,.45)', 'rgba(0,0,0,0)');
        ctx.restore();
      }
    } else if (c.key === 'cinderWrit' && c.zones) {
      for (const z of c.zones) {
        const lit = on && c.t >= z.at && c.t <= z.at + z.dur;
        seal2(ctx, sx(z.x), sy(z.y), z.r, lit ? 1 : prog * 0.7, lit, t);
      }
    } else if (c.key === 'bailiffsProcession' && c.walkers) {
      if (!on) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,196,92,' + (0.25 + 0.4 * prog) + ')';
        ctx.lineWidth = 2;
        ctx.setLineDash([18, 14]);
        ctx.lineDashOffset = -t * 90;
        const p0 = sx(e.x), p1 = sy(e.y);
        ctx.beginPath();
        ctx.moveTo(p0 - Math.cos(c.ang) * 1000, p1 - Math.sin(c.ang) * 1000);
        ctx.lineTo(p0 + Math.cos(c.ang) * 1200, p1 + Math.sin(c.ang) * 1200);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      for (const w of c.walkers) {
        const x = sx(w.x), y = sy(w.y);
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        glowCircle(ctx, x, y, w.r * 1.25, 'rgba(255,150,70,.42)', 'rgba(0,0,0,0)');
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,230,168,.95)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, w.r, 0, TAU); ctx.stroke();
        // the censer itself
        ctx.fillStyle = 'rgba(255,230,168,1)';
        ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
      }
    } else if (c.key === 'writReversal' && c.a && c.b) {
      const litA = on && c.t >= c.fireA && c.t < c.fireA + 0.5;
      const litB = on && c.t >= c.fireBeam && c.t < c.fireBeam + 0.9;
      seal2(ctx, sx(c.b.x), sy(c.b.y), c.b.r, prog, litB, t);
      seal2(ctx, sx(c.a.x), sy(c.a.y), c.a.r, prog, litA, t);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = 'rgba(255,196,92,' + (litB ? 0.95 : 0.25 + 0.4 * prog) + ')';
      ctx.lineWidth = litB ? c.beamW : 2;
      ctx.beginPath();
      ctx.moveTo(sx(c.a.x), sy(c.a.y));
      ctx.lineTo(sx(c.b.x), sy(c.b.y));
      ctx.stroke();
      ctx.restore();
    } else if (c.key === 'obsidianDocket' && c.plates) {
      for (const p of c.plates) {
        const x = sx(p.x), y = sy(p.y);
        const risen = on && c.t > p.up;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.ang + Math.PI / 2);
        ctx.fillStyle = risen ? 'rgba(20,12,16,.92)' : 'rgba(20,12,16,.55)';
        ctx.fillRect(-p.r * 0.16, -p.r * (risen ? 1.0 : 0.45), p.r * 0.32, p.r * (risen ? 1.0 : 0.45));
        ctx.strokeStyle = 'rgba(255,196,92,' + (risen ? 0.95 : 0.45) + ')';
        ctx.lineWidth = 2;
        ctx.strokeRect(-p.r * 0.16, -p.r * (risen ? 1.0 : 0.45), p.r * 0.32, p.r * (risen ? 1.0 : 0.45));
        ctx.restore();
        const local = on ? c.t - p.fire : -1;
        if (local >= 0 && local <= p.dur) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.strokeStyle = 'rgba(255,180,90,.9)';
          ctx.lineWidth = p.w;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(p.ang) * p.len, y + Math.sin(p.ang) * p.len);
          ctx.stroke();
          ctx.restore();
        } else if (!on) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,196,92,' + (0.2 + 0.4 * prog) + ')';
          ctx.lineWidth = 2;
          ctx.setLineDash([14, 12]);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(p.ang) * p.len, y + Math.sin(p.ang) * p.len);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
    } else if (c.key === 'scalesOfSentence' && c.sides) {
      for (let i = 0; i < c.sides.length; i++) {
        const s = c.sides[i];
        const beat = c.beats ? c.beats.find((b) => b.side === i && (on ? c.t >= b.at - 0.45 && c.t <= b.at + b.dur : true)) : null;
        const lit = on && c.beats ? c.beats.some((b) => b.side === i && c.t >= b.at && c.t <= b.at + b.dur) : false;
        const warn = !!(beat && !lit && on);
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        glowCircle(ctx, sx(s.x), sy(s.y), c.r * (lit ? 1.2 : 0.9), lit ? 'rgba(255,190,110,.45)' : 'rgba(255,196,92,.16)', 'rgba(0,0,0,0)');
        ctx.restore();
        ctx.strokeStyle = lit ? 'rgba(255,240,200,.98)' : warn ? 'rgba(255,220,150,.85)' : 'rgba(255,196,92,' + (0.3 + 0.45 * prog) + ')';
        ctx.lineWidth = lit ? 5 : 2;
        ctx.beginPath(); ctx.arc(sx(s.x), sy(s.y), c.r, 0, TAU); ctx.stroke();
        // the pan of the scales
        ctx.strokeStyle = 'rgba(255,196,92,.5)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx(s.x), sy(s.y), c.r * 0.55, 0, TAU); ctx.stroke();
      }
    } else if (c.key === 'finalDecree' && c.rings) {
      for (const r of c.rings) {
        const local = on ? c.t - r.born : -1;
        const rad = local >= 0 ? local * r.sp : (e.r || 40) * (1.2 + prog);
        if (local >= 0 && rad > r.max) continue;
        if (local < 0) {
          ctx.strokeStyle = 'rgba(255,196,92,' + (0.3 + 0.4 * prog) + ')';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx(c.cx), sy(c.cy), rad, 0, TAU); ctx.stroke();
          continue;
        }
        const fade = clamp(1 - rad / r.max, 0, 1);
        ctx.strokeStyle = 'rgba(255,214,140,' + (0.35 + 0.6 * fade) + ')';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(sx(c.cx), sy(c.cy), rad, r.gap + r.half, r.gap - r.half + TAU);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,122,42,' + (0.3 * fade) + ')';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(sx(c.cx), sy(c.cy), rad, r.gap + r.half, r.gap - r.half + TAU);
        ctx.stroke();
      }
    } else if (c.key === 'goldenVerdict' && c.marks) {
      const s = c.sweep;
      if (s) {
        const localS = on ? c.t - s.born : -1;
        const pos = localS >= 0 ? s.from + s.spd * localS : s.from;
        const ox = sx(c.ox || e.x), oy = sy(c.oy || e.y);
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(s.dir);
        if (localS >= 0 && localS <= s.dur) {
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = 'rgba(255,170,80,.55)';
          ctx.fillRect(-s.half, pos - s.w * 0.5, s.half * 2, s.w);
          ctx.fillStyle = 'rgba(255,240,200,.9)';
          ctx.fillRect(-s.half, pos - s.w * 0.12, s.half * 2, s.w * 0.24);
        } else {
          ctx.strokeStyle = 'rgba(255,196,92,' + (0.2 + 0.35 * prog) + ')';
          ctx.lineWidth = 2;
          ctx.setLineDash([20, 14]);
          ctx.strokeRect(-s.half, -s.w * 0.5, s.half * 2, s.w);
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
      for (const m of c.marks) {
        const lit = on && c.t >= m.at && c.t <= m.at + m.dur;
        seal2(ctx, sx(m.x), sy(m.y), m.r, prog, lit, t);
        ctx.fillStyle = 'rgba(255,240,205,.95)';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(m.ord), sx(m.x), sy(m.y));
      }
    }
  }

  function draw2D(e, ctx, cx, cy, t) {
    if (!env || !ctx) return;
    const rr = e.r || 40;
    const st = e._gb || {};
    const stage = st.stage || 1;
    drawBody2(ctx, cx, cy, rr, t, stage);

    if (st.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = clamp(st.hitFlash, 0, 1) * 0.8;
      glowCircle(ctx, cx, cy, rr * 1.2, 'rgba(255,255,255,1)', 'rgba(255,180,120,0)');
      ctx.restore();
    }
    if (st.cur) telegraph2(ctx, e, st.cur, t);
    if (st.phaseAnim) drawPhase2(ctx, e, st.phaseAnim, t);

    // health ring + stage pips
    const hpR = clamp((e.hp || 0) / Math.max(1, e.maxhp || e.hp || 1), 0, 1);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.7)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, rr + 12, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,196,92,.95)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, rr + 12, -Math.PI / 2, -Math.PI / 2 + hpR * TAU); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i / 4) * TAU;
      ctx.fillStyle = i < stage ? 'rgba(255,236,190,1)' : 'rgba(255,255,255,.22)';
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (rr + 24), cy + Math.sin(a) * (rr + 24), 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ============================================================
  // 3D RENDERER
  // ============================================================
  const GOLD3 = [1.9, 1.4, 0.7];
  const EMBER3 = [2.2, 0.85, 0.28];

  function body3(R, e, tt, hb) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    const rr = e.r || 40;
    const x = e.x, z = e.y;

    // obsidian robe
    R.draw(U.cone, mm(x, hb - rr * 0.9, z, tt * 0.1, rr * 1.15, rr * 2.1, rr * 1.15),
      mat([0.09, 0.07, 0.08], { rough: 0.72, metal: 0.28, rim: 1.4, rimCol: R.hexRGB(ACCENT), emissive: [0.09, 0.05, 0.03], emisK: 1.1 }));
    // gold trim
    R.draw(U.torus, mm(x, hb - rr * 0.55, z, tt * 0.4, rr * 0.92, rr * 0.92, rr * 0.92, 0.1),
      mat(GOLD3, { emissive: GOLD3, emisK: 1.6, rough: 0.4, metal: 0.3, shadow: false }));
    R.draw(U.torus, mm(x, hb + rr * 0.1, z, -tt * 0.3, rr * 0.66, rr * 0.66, rr * 0.66, 0.08),
      mat(GOLD3, { emissive: GOLD3, emisK: 1.4, rough: 0.4, metal: 0.3, shadow: false }));
    // mitre
    R.draw(U.cone, mm(x, hb + rr * 0.72, z, tt * 0.2, rr * 0.4, rr * 0.85, rr * 0.4),
      mat([0.14, 0.11, 0.12], { rough: 0.55, metal: 0.45, rim: 1.6, rimCol: R.hexRGB(GOLD), emissive: [0.16, 0.1, 0.04], emisK: 1.3 }));
    // parchment mask
    R.draw(U.sphereLo, mm(x, hb + rr * 0.34, z, 0, rr * 0.34, rr * 0.44, rr * 0.34),
      mat([1.25, 1.15, 0.92], { rough: 0.6, emissive: [0.2, 0.16, 0.1], emisK: 1.2, shadow: false }));
    R.glow(x, hb + rr * 0.34, z, rr * 1.1, 1.9, 1.2, 0.5, 0.5, 0);
    // the raised writ
    R.draw(U.box, mm(x + rr * 0.7, hb + rr * 0.2, z, 0.22, rr * 0.22, rr * 0.6, rr * 0.05),
      mat([1, 1, 1], { emissive: GOLD3, emisK: 2.2, rough: 0.35, shadow: false, rim: 1.4, rimCol: R.hexRGB(ACCENT) }));
    R.glow(x + rr * 0.7, hb + rr * 0.2, z, rr * 1.3, 1.8, 1.25, 0.55, 0.55, 0);
    R.light(x, z, hb + rr, 220 + (e._gb && e._gb.stage ? e._gb.stage : 1) * 40, 1.6, 1.1, 0.45, 0.65);
  }

  function phase3(R, e, pa, tt, hb) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    const p = clamp(pa.t / pa.dur, 0, 1), fade = 1 - p;
    const rr = e.r || 40, x = e.x, z = e.y;
    R.draw(U.torus, mm(x, 6, z, tt * 1.2, rr + p * 420, 2 + 8 * fade, rr + p * 420, 0.1),
      mat([1.8, 1.2, 0.5], { emissive: EMBER3, emisK: 2.4, alpha: 0.9 * fade, shadow: false }));
    R.glow(x, hb, z, rr * (2 + p * 1.6), 1.9, 1.2, 0.5, 0.85 * fade, 0);
    R.light(x, z, hb + 20, 320 + p * 240, 1.7, 1.05, 0.45, 0.9 * fade);
    for (let i = 0; i < 8; i++) {
      if (Math.random() < 0.8) {
        const a = Math.random() * TAU, d = rr * (0.5 + Math.random() * 1.6);
        R.emit({
          x: x + Math.cos(a) * d, y: 6 + Math.random() * 20, z: z + Math.sin(a) * d,
          vx: Math.cos(a) * (30 + 60 * fade), vy: 70 + Math.random() * 90, vz: Math.sin(a) * (30 + 60 * fade),
          life: 0.9 + Math.random() * 0.6, age: 0, s0: 10, s1: 2,
          col: Math.random() < 0.5 ? EMBER3 : GOLD3, a: 0.9 * fade, kind: 0, drag: 0.6
        });
      }
    }
    R.cameraKick = Math.max(R.cameraKick || 0, 0.4 * fade);
  }

  function draw3D(R, e, tt) {
    if (!R || !R.ok || !env) return;
    const st = e._gb || {};
    const stage = st.stage || 1;
    const rr = e.r || 40;
    const hb = rr * 1.2 + Math.sin(tt * 2.2) * 3;
    const x = e.x, z = e.y;

    R.decal(x, z, rr * 2.8, 0, 0, 0, 0.42, 9, 0, 0, false, 1.3);

    if (imgReady) {
      const sp = R.spriteMesh(img, { depth: 0.5, power: 0.45 });
      if (sp) {
        const pl = env.player || { x: x + 100, y: z };
        const ang = Math.atan2(pl.y - z, pl.x - x);
        const size = (rr + 20) * 2.3;
        const m = R.mat([1, 1, 1], {
          tex: sp.tex, emis: sp.emis, emisK: 0.3, rough: 0.6, metal: 0,
          emissive: [0.04, 0.025, 0.01], rim: 0.14, rimCol: R.hexRGB(ACCENT)
        });
        if (R.isTps) {
          const c = Math.cos(R.cam.tyaw), sn = Math.sin(R.cam.tyaw), ux = -sn, uz = c;
          const tilt = Math.PI * 0.5;
          const _t1 = new Float32Array(16), o = new Float32Array(16);
          R.GL3D.M.trs(_t1, 0, 0, 0, ang, size * 1.1, size * 0.55, size * 1.1);
          const co = Math.cos(tilt), si = Math.sin(tilt), tT = 1 - co;
          o.fill(0); o[15] = 1;
          o[0] = co + tT * ux * ux; o[1] = si * uz; o[2] = tT * ux * uz;
          o[4] = -si * uz; o[5] = co; o[6] = si * ux;
          o[8] = tT * ux * uz; o[9] = -si * ux; o[10] = co + tT * uz * uz;
          const out = R.mm(0, 0, 0, 0, 1, 1, 1);
          R.GL3D.M.mul(out, o, _t1);
          out[12] = x; out[13] = hb + size * 0.44 + R.groundY(x, z); out[14] = z;
          R.draw(sp.mesh, out, m);
        } else {
          R.draw(sp.mesh, R.mm(x, hb, z, ang, size, size * 1.35, size), m);
        }
      }
    } else {
      body3(R, e, tt, hb);
    }

    // the writ's own aura: stamped seals under the bench, script turning
    if (window.GildedBailiffFX) window.GildedBailiffFX.ambience(R, e, tt, stage);

    // gold motes rising off the robe
    const motes = 2 + stage;
    for (let i = 0; i < motes; i++) {
      if (Math.random() < 0.5 * ((R.q && R.q.parts) || 1)) {
        const a = Math.random() * TAU, d = rr * (0.5 + Math.random() * 0.9);
        R.emit({
          x: x + Math.cos(a) * d, y: hb - rr * 0.4 + Math.random() * rr, z: z + Math.sin(a) * d,
          vx: (Math.random() - 0.5) * 10, vy: 26 + Math.random() * 34, vz: (Math.random() - 0.5) * 10,
          life: 1.2 + Math.random() * 0.8, age: 0, s0: 6, s1: 1,
          col: Math.random() < 0.55 ? GOLD3 : EMBER3, a: 0.8, kind: 0, drag: 0.75
        });
      }
    }

    if (st.hitFlash > 0) R.glow(x, hb, z, rr * 2.6, 2.2, 2.0, 1.5, clamp(st.hitFlash, 0, 1) * 0.8, 0);
    if (st.cur && window.GildedBailiffFX) window.GildedBailiffFX.telegraph(R, e, st.cur, tt, env);
    if (st.phaseAnim) phase3(R, e, st.phaseAnim, tt, hb);
  }

  // ---- spawn init --------------------------------------------------------
  function initEnemy(e) {
    e.r = 42;
    e.hp = e.maxhp = MAXHP;
    e.speed = 124;
    e.cd = 99;
    e.detectR = 1300;
    e.absorbing = false;
    e.commandCD = 3.0;
    e.bossName = 'The Gilded Bailiff';
    e.bossColor = ACCENT;
    e._gb = { stage: 1, cur: null, last: null, idle: 0.5, phaseAnim: null, hitFlash: 0, intro: 0.7 };
  }

  function onHit(e, dmg) {
    if (!e._gb) return;
    e._gb.hitFlash = Math.min(1, (e._gb.hitFlash || 0) + Math.min(0.5, dmg / 60));
  }

  window.GildedBailiff = {
    setEnv(_env) { env = _env; },
    initEnemy,
    tick,
    draw2D,
    draw3D,
    onHit,
    ACCENT,
    GOLD,
    STAGE_NAMES,
    MAXHP,
    get attackNames() { return Object.keys(ATTACKS).map((k) => ATTACKS[k].name); }
  };
})();
