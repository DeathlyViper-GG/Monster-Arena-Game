// ============================================================
// Monster Arena — online Death Caches.
// The offline modes drop a cache whenever a bot falls. In a server-run Teams /
// Capture the Flag lobby the bots live on the server, so the lobby sends each
// new cache once in a snapshot; this module hands them to the engine's world
// so they render, open and pay out exactly like the offline ones.
// ============================================================
(function () {
  'use strict';

  let world = null;
  const pending = [];

  function drain() {
    if (!world || !pending.length) return;
    if (!Array.isArray(world.deathChests)) world.deathChests = [];
    while (pending.length) {
      const c = pending.shift();
      c.z = c.z || 0;
      c.opened = false;
      world.deathChests.push(c);
    }
  }

  // The engine hands the live world object to _onWorldBuilt on every build and
  // on every server world sync. building_catalog.js already listens there, so
  // chain the existing handler instead of replacing it.
  const prev = window._onWorldBuilt;
  window._onWorldBuilt = function (w, theme) {
    world = w || world;
    drain();
    if (typeof prev === 'function') prev(w, theme);
  };

  window.addEventListener('net:snapshot', function (ev) {
    const snap = ev.detail;
    if (!snap || !Array.isArray(snap.deathChests) || !snap.deathChests.length) return;
    for (const c of snap.deathChests) pending.push(c);
    snap.deathChests.length = 0;
    drain();
  });
})();