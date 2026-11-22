// ============================================================
// Monster Arena — ADMIN PERKS
// While admin mode is on, the owner plays with everything open: the magazine
// never runs dry and every player / gun skin is already unlocked. Switched off,
// nothing is granted and the player's real survival record is put back.
// Both the admin flag (ranks.js) and the switch (admin_mode.js) must agree.
// Loaded before pve16.js so the first frame already has the perks.
// ============================================================
(function () {
  'use strict';

  const TOP_BEST = 9999;          // above every skin's unlock wave
  const KEY_SAVED_BEST = 'arenaAdminSavedBest';
  const mags = {};                // weapon index -> magazine size seen
  let boosted = false;            // has the survival record been raised?
  let frame = 0;

  function enabled() {
    try { return !!(window.AdminMode && window.AdminMode.on()); } catch (_) { return false; }
  }

  // Remember the real record once, so switching admin mode off restores it.
  function boost(g) {
    if (!boosted) {
      try {
        if (localStorage.getItem(KEY_SAVED_BEST) === null) {
          localStorage.setItem(KEY_SAVED_BEST, String(g.state.best || 0));
        }
      } catch (_) {}
      boosted = true;
    }
    if (g.state.best < TOP_BEST) g.state.best = TOP_BEST;
  }

  function release(g) {
    if (!boosted) return;
    boosted = false;
    let saved = 0;
    try {
      saved = parseInt(localStorage.getItem(KEY_SAVED_BEST) || '0', 10) || 0;
      localStorage.removeItem(KEY_SAVED_BEST);
    } catch (_) {}
    if (g && g.state && g.state.best >= TOP_BEST) g.state.best = saved;
  }

  function tick() {
    requestAnimationFrame(tick);
    frame++;
    // The switch lives in Settings and only appears for the owner.
    if (frame % 30 === 0) paintSwitch();

    const g = window.__dbg;
    if (!g || !g.state || !g.player) return;

    if (!enabled()) { release(g); return; }

    // Every player and gun skin unlocks above the highest requirement.
    boost(g);

    // Unlimited ammo: the magazine is topped back up to its own size.
    const p = g.player;
    const i = p.weapon || 0;
    if (p.ammo > (mags[i] || 0)) mags[i] = p.ammo;
    if (mags[i] && p.ammo < mags[i]) p.ammo = mags[i];
  }

  // ---- Settings switch (admins only) -------------------------------------
  const row = document.getElementById('rowAdminMode');
  const sel = document.getElementById('selAdminMode');

  function paintSwitch() {
    if (!row || !window.AdminMode) return;
    const admin = window.AdminMode.isAdmin();
    row.style.display = admin ? '' : 'none';
    if (admin && sel) {
      const want = window.AdminMode.on() ? '1' : '0';
      if (sel.value !== want) sel.value = want;
    }
  }

  if (sel) {
    sel.addEventListener('change', function () {
      window.AdminMode.set(sel.value !== '0');
      paintSwitch();
    });
  }
  window.addEventListener('adminmode:change', paintSwitch);
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'auth:user') paintSwitch();
  });

  paintSwitch();
  requestAnimationFrame(tick);
})();
