// ============================================================
// Monster Arena — chest buffs + live essence counter
// Chest loot is applied on the match server in online play, so the local
// player only ever saw the health it sent back: shield and speed orbs did
// nothing on screen. This mirrors those two buffs onto the local player and
// keeps the in-match Essence counter live in every mode.
// ============================================================
(function () {
  'use strict';

  const SPEED_BOOST = 1.35;        // same burst the offline speed orb gives

  const playerRef = () => (window.__dbg && window.__dbg.player) || null;
  const stateRef = () => (window.__dbg && window.__dbg.state) || null;

  let boostT = 0;                  // seconds of mirrored speed boost left
  let boosted = false;

  function syncFromSnapshot(ev) {
    const p = playerRef();
    if (!p) return;
    const snap = (ev && ev.detail) || {};
    const meId = window.Net && Net.state ? Net.state.peerId : null;
    const me = (snap.players || []).find((x) => x && x.id === meId);
    if (!me) return;
    if (typeof me.shield === 'number') p.shield = me.shield;
    if (typeof me.speedBoostT === 'number' && me.speedBoostT > boostT) boostT = me.speedBoostT;
  }
  window.addEventListener('net:snapshot', syncFromSnapshot);

  // One animation-frame loop drives the boost countdown and the HUD counter.
  let last = performance.now();
  function step(now) {
    const dt = Math.min(0.12, Math.max(0, (now - last) / 1000));
    last = now;

    const p = playerRef();
    if (p) {
      if (boostT > 0) {
        boostT = Math.max(0, boostT - dt);
        if (p.spdMul < SPEED_BOOST) p.spdMul = SPEED_BOOST;
        boosted = true;
      } else if (boosted) {
        // Hand back only what this module borrowed.
        if (Math.abs(p.spdMul - SPEED_BOOST) < 1e-6) p.spdMul = 1;
        boosted = false;
      }
    }

    const s = stateRef();
    const el = document.getElementById('essenceHud');
    if (el && s) {
      const txt = String(Math.max(0, Math.floor(s.essence || 0)));
      if (el.textContent !== txt) el.textContent = txt;
    }

    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})();
