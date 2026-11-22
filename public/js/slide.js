// ============================================================
// Monster Arena — THE SLIDE (replaces the old blink-dash)
// Instead of popping from A to B, the player drops into a slide: they keep
// travelling along the ground for the length of the slide with momentum that
// bleeds off, the camera swings out of first person into a low over-the-
// shoulder chase, and a neon streak is laid down behind them.
// The engine still owns the trigger (playerDash in pve16) and hands the
// distance over; this module runs the motion, the camera and the trail.
// Exposes window.Slide.
// ============================================================
(function () {
  'use strict';

  const DUR = 0.55;   // seconds the slide lasts
  const CD = 1.4;     // cooldown between slides (matches the old dash)
  const COL = { fire: '#ff8a3c', lightning: '#9fe3ff', water: '#5fc4ff', earth: '#7dffa3', spirit: '#c066ff' };

  let s = null;       // { t, a, dist }
  let saved = null;   // camera settings to restore afterwards
  let acc = 0;        // trail emission timer

  const dbg = () => window.__dbg || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function colorOf(p) { return COL[p && p.glyphPath] || '#39ffe0'; }

  // ---- camera: pull out to a low over-the-shoulder chase -------------------
  function campull(on, p) {
    const R = window.Render3D, c = R && R.cam;
    if (!c) return;
    if (on) {
      if (c.mode !== 'tps' || saved) return;      // a non-chase view keeps its own framing
      saved = { fp: c.fp, tdist: c.tdist, shoulder: c.shoulder, tpitch: c.tpitch, zoom: c.zoom };
      c.fp = false;                                // out of first person
      c.tdist = Math.max(saved.tdist, 320);        // far enough back to read the whole body
      c.zoom = 0.92;
      c.shoulder = 0;                              // dead centre: the runner sits in front of the camera
      c.tpitch = 0.16;                             // dropped low, looking along the ground
      if (p) c.tyaw = p.angle;                     // snap the chase behind the slide
      c.tcur = c.tdist * c.zoom;                   // no long camera slide-in
    } else if (saved) {
      Object.assign(c, saved);
      saved = null;
    }
  }

  // ---- neon streak ---------------------------------------------------------
  function trail(p, x0, y0, x1, y1) {
    const ents = dbg().ents;
    if (!ents || !ents.effects) return;
    const col = colorOf(p);
    ents.effects.push({ type: 'dashTrail', x1: x0, y1: y0, x2: x1, y2: y1, col, life: 0.3, t: 0 });
    ents.effects.push({ type: 'dashGhost', x: x1, y: y1, col, life: 0.24, t: 0, r: 14 });
    // kick up a little dust at the feet
    for (let i = 0; i < 2; i++) {
      ents.effects.push({
        type: 'dashGhost',
        x: x1 + (Math.random() - 0.5) * 22,
        y: y1 + (Math.random() - 0.5) * 22,
        col: '#ffffff', life: 0.18, t: 0, r: 9
      });
    }
  }

  // ---- start ---------------------------------------------------------------
  function start(distance) {
    const p = dbg().player;
    if (!p || p.hp <= 0 || s) return false;
    if (p.dashCD > 0) return false;
    s = { t: 0, a: p.angle, dist: Math.max(190, distance || 380) };
    acc = 0;
    p.dashCD = CD;
    p.dashI = DUR;                  // keeps the body lean / flare for the whole slide
    campull(true, p);
    trail(p, p.x, p.y, p.x, p.y);
    return true;
  }

  function end() {
    if (!s) return;
    s = null;
    campull(false);
  }

  function active() { return !!s; }

  // ---- per-frame ----------------------------------------------------------
  function tick(dt) {
    if (!s) return;
    const p = dbg().player, w = dbg().world, st = dbg().state;
    if (!p || p.hp <= 0 || (st && !st.running) || window.STAGE_CUTSCENE_ACTIVE) { end(); return; }

    s.t += dt;
    const k = Math.max(0, 1 - s.t / DUR);        // momentum bleeds off as it goes
    if (k <= 0) { end(); return; }

    const sp = (2 * s.dist / DUR) * k;
    const x0 = p.x, y0 = p.y;
    const nx = p.x + Math.cos(s.a) * sp * dt;
    const ny = p.y + Math.sin(s.a) * sp * dt;

    if (w && w.isBlocked && w.isBlocked(nx, ny, p.r * 0.9, p.z)) { end(); return; }

    p.x = w ? clamp(nx, 60, w.w - 60) : nx;
    p.y = w ? clamp(ny, 60, w.h - 60) : ny;

    // a streak every few centimetres of travel
    acc += dt;
    if (acc > 0.04) { acc = 0; trail(p, x0, y0, p.x, p.y); }

    const c = window.Render3D && Render3D.cam;
    if (c) c.kick = Math.max(c.kick || 0, 0.35 * k);
  }

  // The slide runs itself on the animation frame — the engine only starts it,
  // so nothing here has to be hooked into the match loop.
  let last = 0;
  function loop(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (s && dt) tick(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.Slide = { start, tick, end, active };
})();
