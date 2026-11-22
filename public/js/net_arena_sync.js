/* net_arena_sync.js — the parts of an online match the room owns.
   Two jobs:
   1. THE STORM. A Battle Royale room closes a ring and damages whoever is
      outside it; the free-for-all room has no ring at all. The engine draws
      whatever zone it is handed, so this hands it the room's.
   2. LOOT. Online the room spawns chest drops and monster drops and keeps the
      list itself. The body that walks over one takes it here and tells the
      room, so a chest opened online really does give you what it spilled. */
(function () {
  'use strict';

  const snap = () => (window.Net && window.Net.state && window.Net.state.snapshot) || null;
  const live = () => !!(window.Net && window.Net.state && window.Net.state.lobbyId && window.Net.state.peerId);

  function zone() {
    if (!live()) return null;
    const s = snap();
    return s && s.zone ? s.zone : null;
  }

  const taken = new Map();
  let lastPickup = 0;

  function collect() {
    if (!live()) return;
    const p = window.__arenaPlayer;
    const s = snap();
    if (!p || !s || !Array.isArray(s.pickups) || (p.hp ?? 1) <= 0) return;
    const now = Date.now();
    if (now - lastPickup < 90) return;
    lastPickup = now;
    for (const pk of s.pickups) {
      if (!pk || pk.type === 'bossWarn' || pk.type === 'bossTarget' || pk.type === 'bossBoom') continue;
      const key = Math.round(pk.x) + '|' + Math.round(pk.y) + '|' + pk.type;
      if ((taken.get(key) || 0) > now - 1500) continue;
      const rr = (pk.r ?? 14) + (p.r ?? 16);
      const dx = p.x - pk.x, dy = p.y - pk.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      if (pk.type === 'health') p.hp = Math.min(p.hpMax || 100, (p.hp || 0) + 25);
      else if (pk.type === 'shield') p.shield = Math.min(100, (p.shield || 0) + 40);
      else if (pk.type === 'ammo') p.reserve = Math.min(999, (p.reserve || 0) + 24);
      taken.set(key, now);
      if (taken.size > 90) for (const [k, at] of taken) if (at < now - 4000) taken.delete(k);
      if (window.addEffect) { try { window.addEffect(pk.x, pk.y, 'pop', 0.4, '#aef'); } catch (e) {} }
      if (window.Net && window.Net.takePickup) window.Net.takePickup(pk.x, pk.y);
    }
  }

  function loop() {
    requestAnimationFrame(loop);
    try { collect(); } catch (e) {}
  }
  requestAnimationFrame(loop);

  window.NetArena = { zone, collect };
})();
