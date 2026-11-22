/* =====================================================================
   br_hud.js — Battle Royale's numbers.

   The storm's readout used to be canvas text at the top centre, which drew
   straight over the mode panel. It now lives in #brZone, top-right under that
   panel: how many are still standing, the round, and the storm's clock.

   Every number here is the room's own — the server counts the bodies and runs
   the clock — so the readout can never drift from the match.
   ===================================================================== */
(function (G) {
  'use strict';

  const el = () => document.getElementById('brZone');
  let last = '';

  function zoneOf() {
    if (!G.BR_MODE || !G.PVP_MODE) return null;
    try {
      if (G.NetArena && typeof G.NetArena.zone === 'function') return G.NetArena.zone();
    } catch (e) {}
    return null;
  }

  function tick() {
    const node = el();
    if (!node) return;
    const z = zoneOf();
    if (!z) {
      if (last !== '') { last = ''; node.style.display = 'none'; }
      return;
    }
    const closing = z.mode === 'shrink';
    const secs = Math.max(0, Math.ceil((z.wait ?? 20) - (z.t || 0)));
    const alive = (z.alive != null) ? z.alive + ' LEFT' : 'STORM LIVE';
    const sub = 'ROUND ' + (z.round || 1) + ' · ' + (closing ? 'ZONE CLOSING' : 'ZONE CLOSES IN ' + secs + 's');
    const key = alive + '|' + sub;
    if (key === last) return;
    last = key;
    node.innerHTML = '<b>' + alive + '</b><span class="br-zone-sub">' + sub + '</span>';
    node.classList.toggle('is-closing', closing);
    node.style.display = 'block';
  }

  setInterval(tick, 120);
  G.BrHud = { tick, zoneOf };
})(window);
