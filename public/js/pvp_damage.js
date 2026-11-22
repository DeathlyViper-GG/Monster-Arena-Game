// ============================================================
// Monster Arena — DAMAGE YOU DEAL TO OTHER PLAYERS
// Online matches are simulated by the server, so the client never damages a
// remote player itself and had nothing to float a number from. The server now
// names the hitter of the last hit on every player in its snapshot; whenever
// that hitter is us, the amount pops over the player we actually hit.
// ============================================================
(function () {
  'use strict';

  const seen = new Map();   // player id -> the hit stamp already shown

  function mine() {
    const N = window.Net;
    return (N && N.state && (N.state.peerId || N.state.myId)) || null;
  }

  function onSnapshot(snap) {
    if (!snap || !Array.isArray(snap.players)) return;
    const me = mine();
    if (!me || !window.DN) return;

    for (const p of snap.players) {
      if (!p || p.id === me || !p.hit) continue;
      if (String(p.hit.by) !== String(me)) continue;
      const stamp = p.hit.t;
      const last = seen.get(p.id);
      if (stamp && stamp === last) continue;
      seen.set(p.id, stamp);
      window.DN(p.x, p.y, p.hit.dmg, 'player');
    }
  }

  window.addEventListener('net:snapshot', (e) => onSnapshot(e.detail));

  window.PvPDamage = { onSnapshot: onSnapshot };
})();
