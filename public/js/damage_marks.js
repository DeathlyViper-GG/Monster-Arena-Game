/* =====================================================================
   damage_marks.js — every hit leaves a mark.

   Shots and melee already pop a number, but the damage the engine applies
   quietly is invisible: burn ticks, bleed, the poison cloud, a glyph's
   chain arc, a blast's splash, and anything that reaches you. This watches
   the live health of every monster, bot and the player, and turns each
   drop into a floating number plus a puff of the element behind it — so
   fire, poison and glyph procs all read on screen.

   A drop the engine already announced with its own number is never drawn
   a second time: every pop it makes is remembered for a moment and matched
   against the target that lost health.
   ===================================================================== */
(function (G) {
  'use strict';

  const PEEK = 0.05;      // ignore sub-pixel churn
  const GAP = 380;        // ms between two numbers for the same target
  const SUPPRESS = 190;   // ms: an engine pop this close is the same hit
  const SUPPRESS_R = 52;  // px

  const raw = typeof G.DN === 'function' ? G.DN : (G.DamageNumbers && G.DamageNumbers.pop);
  if (typeof raw !== 'function') return;   // no number layer to draw with

  const watch = new Map();   // target -> { hp, acc, next }
  const shown = [];          // pops the engine made itself: { x, y, t }

  // Remember every number the engine pops, so the same damage is not counted
  // twice here. The wrapper stays out of our own marks (they use `raw`).
  if (!raw._marksHooked) {
    G.DN = function (x, y, amount, kind) {
      shown.push({ x: x, y: y, t: performance.now() });
      if (shown.length > 48) shown.shift();
      return raw.apply(this, arguments);
    };
    G.DN._marksHooked = true;
    if (G.DamageNumbers) G.DamageNumbers.pop = G.DN;
  }

  // Which element is eating this target, if any — decides the colour of the
  // puff that lands with the number.
  function element(t) {
    if (!t) return null;
    if ((t.burnT || 0) > 0) return 'fire';
    if ((t.poisonT || 0) > 0) return 'earth';
    if ((t.bleedT || 0) > 0) return 'earth';
    if ((t.hauntT || 0) > 0) return 'spirit';
    if ((t.drenchT || 0) > 0) return 'water';
    return null;
  }

  function explainedAt(x, y, nowT) {
    for (let i = shown.length - 1; i >= 0; i--) {
      const s = shown[i];
      if (nowT - s.t > SUPPRESS) return false;   // list is ordered oldest first
      if (Math.abs(s.x - x) < SUPPRESS_R && Math.abs(s.y - y) < SUPPRESS_R) return true;
    }
    return false;
  }

  function mark(t, kind, nowT) {
    if (!t || !isFinite(t.hp)) return;
    const key = t.id != null ? t.id : t;
    const prev = watch.get(key);
    if (!prev) { watch.set(key, { hp: t.hp, acc: 0, next: 0 }); return; }

    const drop = prev.hp - t.hp;
    prev.hp = t.hp;
    if (drop > PEEK && !explainedAt(t.x, t.y, nowT)) prev.acc += drop;

    if (prev.acc >= 1 && nowT >= prev.next) {
      const amount = Math.round(prev.acc);
      prev.acc = 0;
      prev.next = nowT + GAP;
      raw(t.x, t.y, amount, kind);
      const el = element(t);
      if (el && G.botGlyphBurstFx) G.botGlyphBurstFx(t.x, t.y, el, 32, 0.3);
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    const running = typeof G.__pveMatchRunning === 'function'
      ? !!G.__pveMatchRunning()
      : !!(G.state && G.state.running);
    if (!running) { watch.clear(); shown.length = 0; return; }

    const ents = G._ents;
    if (!ents) return;
    const nowT = performance.now();

    for (const e of (ents.enemies || [])) if (e && e.hp > 0) mark(e, 'enemy', nowT);
    try {
      if (typeof SP_BOTS !== 'undefined' && SP_BOTS) {
        for (const b of SP_BOTS) if (b && b.hp > 0) mark(b, 'bot', nowT);
      }
    } catch (_) {}
    if (G.__arenaPlayer) mark(G.__arenaPlayer, 'player', nowT);
  }

  requestAnimationFrame(frame);

  G.DamageMarks = { element: element };
})(window);
