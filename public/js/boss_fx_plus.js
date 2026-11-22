// ============================================================
// Monster Arena — BOSS FX PLUS
// A graphics layer wrapped around every boss renderer (Last Scribe:
// Hearth Warden, Pharaoh of Glass, Rime Oracle, Magma Titan, Void, Hollow;
// Age of the Sentinel: Sealwright, Choir of Ash and the wardens that reuse
// those bodies). It never touches attack logic or damage — it only reads each
// boss's own attack state (e._hw / _pg / _ro / _mt / _vb / _hb / _sw / _ca,
// its `cur` telegraph and phase) and adds, on top of the original draw:
//
//   • a rotating ground sigil and orbiting spirit-lights under the boss
//   • WINDUP  — energy converging into the body, rising charge glow
//   • TELE    — every danger zone gets a pulsing disc, rotating dashed rim,
//               rising warning pillars and ground cracks; ring/line attacks
//               get a travelling wavefront and streaks
//   • ACTIVE  — impact flash, shock rings, sparks, camera shake (once per hit)
//   • STAGE   — expanding shock rings when the boss drops past 75/50/25 % HP
//   • ENRAGE  — embers and a hotter aura under 30 % HP
//
// Disable with window.BOSS_FX_PLUS = false.
// ============================================================
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // per-boss palette (float rgb, pre-boosted for additive blending) and state key
  const BOSSES = [
    { mod: 'HearthWarden', key: '_hw', col: [.55, 1.7, .8],  hot: [1.9, 1.5, .6] },
    { mod: 'PharaohGlass', key: '_pg', col: [1.7, 1.45, .55], hot: [2.2, 2.0, 1.4] },
    { mod: 'RimeOracle',   key: '_ro', col: [.6, 1.4, 1.9],   hot: [1.8, 2.2, 2.4] },
    { mod: 'MagmaTitan',   key: '_mt', col: [1.9, .75, .25],  hot: [2.4, 1.7, .7] },
    { mod: 'VoidBoss',     key: '_vb', col: [1.2, .45, 1.9],  hot: [2.0, 1.2, 2.4] },
    { mod: 'HollowBoss',   key: '_hb', col: [1.5, .5, 1.6],   hot: [2.2, 1.4, 2.0] },
    { mod: 'SealWright',   key: '_sw', col: [1.75, 1.28, .5], hot: [2.45, 2.0, 1.15] },
    { mod: 'ChoirOfAsh',   key: '_ca', col: [1.6, 1.1, .55],  hot: [2.2, 1.7, 1.0] },
    { mod: 'HourglassStag', key: '_hs', col: [.7, 1.5, 1.9],  hot: [2.0, 2.0, 1.6] },
    { mod: 'GildedBailiff', key: '_gb', col: [1.9, 1.4, .45], hot: [2.5, 2.1, 1.1] }
  ];

  function shake(v) { try { window._Gauntlet && window._Gauntlet.camShake && window._Gauntlet.camShake(v); } catch (_) {} }
  const rnd = (seed) => { const x = Math.sin(seed * 127.1) * 43758.5453; return x - Math.floor(x); };

  function zoneList(cur) {
    const z = [];
    if (cur.zones && cur.zones.length) cur.zones.forEach((q) => { if (q && isFinite(q.x) && isFinite(q.y) && q.r) z.push({ x: q.x, y: q.y, r: q.r }); });
    return z;
  }

  function fx3D(R, e, B) {
    const st = e[B.key]; if (!st) return;
    const t = R.time, x = e.x, z = e.y, rr = e.r || 40;
    const fp = e._fxp || (e._fxp = { lastKey: null, lastPhase: null, hit: 0, stage: 4, burst: -9, burstAt: 0 });
    const hpf = clamp((e.hp || 0) / Math.max(1, e.maxhp || e.hp || 1), 0, 1);
    const enrage = hpf < .3 ? 1 : 0;
    const col = B.col, hot = B.hot;

    // ---- aura: ground sigil, orbiting lights, up-light --------------------
    const pulse = .75 + .25 * Math.sin(t * 2.2);
    R.decal(x, z, rr * 7.2, col[0], col[1], col[2], .30 * pulse, 9, t * .4, t * .35, true, 2.2);
    R.decal(x, z, rr * 5.0, hot[0], hot[1], hot[2], .20, 9, -t * .6, -t * .5, true, 2.4);
    R.decal(x, z, rr * 3.2, col[0], col[1], col[2], .35 * pulse, 2, .06, 0, true, 2.6);
    for (let i = 0; i < 6; i++) {
      const a = t * (.9 + enrage * .6) + i * TAU / 6, orb = rr * (1.9 + .25 * Math.sin(t * 1.3 + i));
      R.glow(x + Math.cos(a) * orb, 34 + Math.sin(t * 2 + i) * 16 + (i % 2) * 22, z + Math.sin(a) * orb, 30, hot[0], hot[1], hot[2], .55, 0);
      R.glow(x + Math.cos(a - .18) * orb, 34 + (i % 2) * 22, z + Math.sin(a - .18) * orb, 18, col[0], col[1], col[2], .3, 0);
    }
    R.light(x, z, 70, rr * 7, col[0], col[1], col[2], .55 + enrage * .5);
    if (enrage) for (let i = 0; i < 10; i++) {
      const lf = (t * .7 + i * .137) % 1, a = i * 2.4 + t * .3;
      R.glow(x + Math.cos(a) * rr * (1 + lf * 2), 10 + lf * 170, z + Math.sin(a) * rr * (1 + lf * 2), 16, hot[0], hot[1] * .6, hot[2] * .4, (1 - lf) * .6, 0);
    }

    // ---- stage-drop shock rings ------------------------------------------
    const stage = hpf > .75 ? 4 : hpf > .5 ? 3 : hpf > .25 ? 2 : 1;
    if (stage < fp.stage) { fp.stage = stage; fp.burst = t; shake(14); }
    const bt = t - fp.burst;
    if (bt >= 0 && bt < 1.6) for (let i = 0; i < 3; i++) {
      const k = clamp(bt / 1.4 - i * .12, 0, 1); if (k <= 0) continue;
      R.decal(x, z, rr * 3 + k * 1400, hot[0], hot[1], hot[2], (1 - k) * .8, 2, .05 + k * .05, 0, true, 3);
      R.glow(x, 60 + k * 80, z, rr * 6 * (1 - k * .5), hot[0], hot[1], hot[2], (1 - k) * .5, 0);
    }

    // ---- attack telegraphs ------------------------------------------------
    const cur = st.cur; if (!cur || !cur.phase) return;
    const ck = cur.key + ':' + cur.phase;
    if (fp.lastKey !== ck) {
      if (cur.phase === 'active') { fp.hit = t; shake(7); }
      fp.lastKey = ck;
    }
    const ph = cur.phase, pt = cur.t || 0;
    const dur = (cur.phases && cur.phases[ph]) || 1, u = clamp(pt / Math.max(.05, dur), 0, 1);

    if (ph === 'windup') {
      // energy converging into the body
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU + t * 2, d = rr * (4.4 - u * 3.4);
        R.glow(x + Math.cos(a) * d, 40 + u * 30, z + Math.sin(a) * d, 16 + u * 22, hot[0], hot[1], hot[2], .35 + u * .5, 0);
      }
      R.decal(x, z, rr * (7 - u * 4.6), hot[0], hot[1], hot[2], .6 * u + .1, 2, .06, 0, true, 3);
      R.glow(x, 50, z, rr * (2 + u * 4), hot[0], hot[1], hot[2], .25 + u * .55, 0);
    }

    const zones = zoneList(cur);
    if (ph === 'tele' || ph === 'active') {
      const fastPulse = .6 + .4 * Math.sin(t * (ph === 'tele' ? 12 : 22));
      zones.forEach((q, i) => {
        const d = q.r * 2;
        if (ph === 'tele') {
          R.decal(q.x, q.y, d * 1.06, hot[0], hot[1], hot[2], .30 * fastPulse, 7, 0, 0, true, 2.8);
          R.decal(q.x, q.y, d * 1.18, col[0], col[1], col[2], .55, 9, t * .8 + i, t * .6, true, 3);
          R.decal(q.x, q.y, d * (.25 + .75 * ((t * 1.5 + i * .3) % 1)), hot[0], hot[1], hot[2], .5 * (1 - (t * 1.5 + i * .3) % 1), 2, .08, 0, true, 3.2);
          for (let k = 0; k < 5; k++) {                                       // warning pillars rising off the ground
            const a = k / 5 * TAU + t * .7 + i, rad = q.r * .7;
            const h = 30 + 80 * u + 18 * Math.sin(t * 6 + k);
            R.glow(q.x + Math.cos(a) * rad, h * .5, q.y + Math.sin(a) * rad, 20, hot[0], hot[1], hot[2], .35 + .3 * fastPulse, 0);
            R.glow(q.x + Math.cos(a) * rad, h, q.y + Math.sin(a) * rad, 12, 2, 2, 2, .35, 0);
          }
        } else {
          const k = clamp(pt / .6, 0, 1);
          R.decal(q.x, q.y, d * (1.0 + k * .25), hot[0], hot[1], hot[2], (1 - k * .7) * .55, 2, .1, 0, true, 3);
          R.glow(q.x, 30 + 70 * (1 - k), q.y, q.r * 1.9, col[0], col[1], col[2], .45 * (1 - k * .6), 0);
          for (let s = 0; s < 6; s++) {                                       // sparks
            const sa = rnd(i * 13 + s) * TAU, sl = (t * .9 + rnd(s + i)) % 1;
            R.glow(q.x + Math.cos(sa) * q.r * sl, 10 + sl * 120, q.y + Math.sin(sa) * q.r * sl, 10, hot[0], hot[1], hot[2], (1 - sl) * .8, 0);
          }
        }
      });
    }

    // expanding ring attacks (cx,cy,r): a bright wavefront with trailing echoes
    if (ph === 'active' && cur.r != null && cur.maxR && isFinite(cur.cx != null ? cur.cx : cur.x)) {
      const cx = cur.cx != null ? cur.cx : cur.x, cy = cur.cy != null ? cur.cy : cur.y;
      for (let k = 0; k < 3; k++) R.decal(cx, cy, Math.max(10, (cur.r - k * 26) * 2), hot[0], hot[1], hot[2], .55 - k * .17, 2, .035 + k * .02, 0, true, 3.4);
      R.glow(cx, 24, cy, Math.max(30, cur.r * .5), col[0], col[1], col[2], .12, 0);
    }
    // directed attacks (boss → ang): streaks and a hot core
    if ((ph === 'tele' || ph === 'active') && cur.ang != null && cur.len && !zones.length) {
      const a = cur.ang, L = cur.len;
      for (let i = 0; i < 9; i++) {
        const f = i / 8, off = (ph === 'active' ? (t * 2.5 % 1) : 0) * 40;
        R.glow(x + Math.cos(a) * (f * L + off), 22, z + Math.sin(a) * (f * L + off), 18 + (ph === 'active' ? 14 : 0), hot[0], hot[1], hot[2], (ph === 'active' ? .55 : .25 + .15 * Math.sin(t * 10 + i)), 0);
      }
      R.streak(x, 26, z, a, 22, L, hot[0], hot[1], hot[2], ph === 'active' ? .7 : .3);
    }
    if (ph === 'recover') for (let i = 0; i < 6; i++) {
      const lf = (t * .8 + i * .21) % 1; R.glow(x + Math.cos(i * 1.7) * rr * 1.4, 10 + lf * 90, z + Math.sin(i * 1.7) * rr * 1.4, 14, col[0], col[1], col[2], (1 - lf) * .4, 0);
    }
  }

  function fx2D(ctx, e, cx, cy, B) {
    const st = e[B.key]; if (!st) return;
    const t = performance.now() / 1000, rr = (e.r || 40), c = B.col.map((v) => Math.round(clamp(v / 2.4, 0, 1) * 255));
    const env = (B.env && B.env.cam) || null;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const a = t + i * TAU / 6, o = rr * 1.9;
      const g = ctx.createRadialGradient(cx + Math.cos(a) * o, cy + Math.sin(a) * o, 0, cx + Math.cos(a) * o, cy + Math.sin(a) * o, 18);
      g.addColorStop(0, 'rgba(' + c + ',.7)'); g.addColorStop(1, 'rgba(' + c + ',0)'); ctx.fillStyle = g; ctx.fillRect(cx + Math.cos(a) * o - 18, cy + Math.sin(a) * o - 18, 36, 36);
    }
    ctx.strokeStyle = 'rgba(' + c + ',.35)'; ctx.setLineDash([10, 12]); ctx.lineDashOffset = -t * 30; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, rr * 3.2, 0, TAU); ctx.stroke(); ctx.restore();
  }

  function install() {
    if (window.BOSS_FX_PLUS === false) return;
    BOSSES.forEach((B) => {
      const M = window[B.mod]; if (!M || M.__fxPlus) return; M.__fxPlus = true;
      if (M.setEnv) { const se = M.setEnv; M.setEnv = function (en) { B.env = en; return se.apply(this, arguments); }; }
      const d3 = M.draw3D, d2 = M.draw2D;
      if (d3) M.draw3D = function (R, e) {
        const r = d3.apply(this, arguments);
        if (window.BOSS_FX_PLUS !== false) { try { fx3D(R, e, B); } catch (err) { if (!B.warned) { B.warned = 1; console.warn('[BossFX+]', B.mod, err); } } }
        return r;
      };
      if (d2) M.draw2D = function (e, ctx, cx, cy) {
        const r = d2.apply(this, arguments);
        if (window.BOSS_FX_PLUS !== false) { try { fx2D(ctx, e, cx, cy, B); } catch (_) {} }
        return r;
      };
    });
  }
  // every boss module registers before pve16 runs; install once the page has finished loading
  if (document.readyState === 'complete') install(); else window.addEventListener('load', install);
  window.BossFXPlus = { install };
})();
