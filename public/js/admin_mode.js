// ============================================================
// Monster Arena — ADMIN MODE SWITCH
// Being the owner does not mean playing with everything open: admin mode can be
// switched on (all RuneStones, every weapon and skin, unlimited ammo) or off to
// play exactly like everyone else. The choice persists per device.
// Only a real admin (decided in ranks.js) can ever have it on.
// ============================================================
(function () {
  'use strict';

  const KEY = 'arenaAdminMode';

  function isAdmin() {
    try { return !!(window.RankXP && RankXP.isAdmin && RankXP.isAdmin()); } catch (_) { return false; }
  }

  // Default is on, so the owner keeps the perks until they choose otherwise.
  function on() {
    if (!isAdmin()) return false;
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (_) {}
    return raw !== '0';
  }

  function set(v) {
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('adminmode:change', { detail: { on: on() } })); } catch (_) {}
  }

  window.AdminMode = { on: on, set: set, isAdmin: isAdmin };
})();
