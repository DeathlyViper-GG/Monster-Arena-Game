// ============================================================
// Monster Arena — multiplayer bot death bursts.
// The lobby drops a dead bot from the snapshot immediately, so instead of a
// body lingering on screen for a few seconds the bot now erupts where it fell
// in its team's colour (vibrant blue / dark red).
// ============================================================
(function () {
  'use strict';

  const TEAM_COLOR = { 0: '#3aa6ff', 1: '#c1121f' };
  const NEUTRAL = '#e6e8ee';

  let prev = new Map();

  function burst(x, y, color) {
    // A ring of sparks plus a shockwave core — reads instantly at any zoom.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      if (window.impactSparks) {
        window.impactSparks(x, y, 12, -Math.cos(a) * 240, -Math.sin(a) * 240, { glyphColor: color });
      }
    }
    if (window.addEffect) {
      window.addEffect(x, y, 'pop', 0.55, color);
      window.addEffect(x, y, 'hit', 0.35, color);
    }
  }

  function poll() {
    const s = window.Net && window.Net.state && window.Net.state.snapshot;
    if (!s || !Array.isArray(s.bots)) { prev = new Map(); return; }

    const now = new Map();
    for (const b of s.bots) {
      if (!b || !b.id || (b.hp ?? 1) <= 0) continue;
      now.set(b.id, { x: b.x, y: b.y, team: b.team });
    }
    for (const [id, old] of prev) {
      if (now.has(id)) continue;
      const color = (old.team === 0 || old.team === 1) ? TEAM_COLOR[old.team] : NEUTRAL;
      burst(old.x, old.y, color);
    }
    prev = now;
  }

  setInterval(poll, 100);
  window.NetBotDeaths = { poll, burst };
})();
