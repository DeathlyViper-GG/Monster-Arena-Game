// ============================================================
// Monster Arena — DEVELOPER STORY TOOLS
// Two switches in Settings that exist for one account only:
// deathlyviper@outlook.com. Every other player — admins included — never sees
// them, and the flags are ignored for anyone else.
//
//   Skip to the boss fight  drop straight onto the warden's wave (5) of the
//                           story chapter / realm you launched.
//   Kill all monsters       sweep the story arena of ordinary monsters the
//                           instant they appear. Wardens are never touched, so
//                           the plot still advances.
//
// Both are off until the developer turns them on, and the choice persists per
// device. Neither does anything outside a story run.
// ============================================================
(function () {
  'use strict';

  const DEV_EMAIL = 'deathlyviper@outlook.com';
  const DEV_HANDLES = ['deathlyviper', 'deathlyviper@outlook.com'];
  const KEY_SKIP = 'arenaDevSkipBoss';
  const KEY_KILL = 'arenaDevKillAll';
  const KEY_REALMS = 'arenaDevUnlockRealms';
  const WARDEN_TYPES = ['boss', 'void', 'hollow', 'hearth_warden', 'pharaoh_glass', 'rime_oracle', 'magma_titan'];
  const BOSS_WAVE = 5;

  // ---- who is signed in ---------------------------------------------------
  // The hosting page posts the account and mirrors it into storage; reading
  // both keeps the gate from depending on one message's timing. The posted
  // message does not always carry the address (the profile can arrive with
  // only its handle), so the handle is accepted too.
  function account() {
    const posted = window.__arenaAuth || null;
    let email = '';
    let dev = null;
    try {
      email = localStorage.getItem('arenaAuthEmail') || '';
      dev = localStorage.getItem('arenaDevAccount');
    } catch (_) {}
    const name = posted ? String(posted.username || posted.full_name || '') : '';
    if (!posted && !email && dev == null) return null;
    return {
      isAuthenticated: true,
      email: posted && posted.email ? posted.email : email,
      name: name,
      // The hosting page decides from the real signed-in account and says so
      // outright — the most reliable of the three signals.
      dev: posted && posted.dev === true ? true : dev === '1'
    };
  }

  function isDev() {
    const a = account();
    if (!a) return false;
    if (a.dev === true) return true;
    const mail = String(a.email || '').toLowerCase().trim();
    if (mail === DEV_EMAIL) return true;
    const handle = String(a.name || '').toLowerCase().trim();
    if (!handle) return false;
    return DEV_HANDLES.indexOf(handle) >= 0 || DEV_HANDLES.indexOf(handle.split('@')[0]) >= 0;
  }

  function flag(key) {
    if (!isDev()) return false;
    try { return localStorage.getItem(key) === '1'; } catch (_) { return false; }
  }
  function setFlag(key, v) {
    try { localStorage.setItem(key, v ? '1' : '0'); } catch (_) {}
  }

  function skipBoss() { return flag(KEY_SKIP); }
  function killAll() { return flag(KEY_KILL); }
  // Opens every story chapter at once, so the whole campaign can be played in
  // any order without breaking a single seal first.
  function unlockRealms() { return flag(KEY_REALMS); }

  // ---- the story run this is allowed to touch -----------------------------
  function inStory() {
    if (!window.STORY_ACTIVE && !window.SENTINEL_ACTIVE) return false;
    // The gauntlet, the parkour course and online matches run their own rules.
    if (window.HOLLOW_GAUNTLET_ACTIVE || (window.PARKOUR_ACTIVE||window.CONTAINMENT_ACTIVE)) return false;
    if (window.PVP_MODE) return false;
    try { if (window.Net && Net.state && Net.state.lobbyId) return false; } catch (_) {}
    return true;
  }

  function running() {
    try {
      if (typeof window.__pveMatchRunning === 'function') return !!window.__pveMatchRunning();
    } catch (_) {}
    const st = window.__dbg && window.__dbg.state;
    return !!(st && st.running);
  }

  function cullMinions() {
    const dbg = window.__dbg;
    if (!dbg || !dbg.ents || !dbg.ents.enemies) return;
    const list = dbg.ents.enemies;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (!e) continue;
      if (WARDEN_TYPES.indexOf(e.type) < 0) list.splice(i, 1);
    }
  }

  function jumpToWarden() {
    const dbg = window.__dbg;
    if (!dbg || typeof dbg.gotoWave !== 'function') return false;
    if (!inStory() || !running()) return false;
    if (dbg.state.wave >= BOSS_WAVE) return false;
    dbg.ents.enemies.length = 0;
    if (dbg.ents.ebullets) dbg.ents.ebullets.length = 0;
    dbg.gotoWave(BOSS_WAVE);
    return true;
  }

  // ---- the watch loop -----------------------------------------------------
  let jumped = false;      // has this run already been taken to the warden?
  let pending = false;
  let idle = 0;            // quiet ticks, so the next launch starts fresh

  function tick() {
    if (!isDev() || !inStory()) { jumped = false; idle = 0; return; }
    // Between matches (hub, outro, death screen) the next launch counts as new.
    if (!running()) { if (++idle > 12) jumped = false; return; }
    idle = 0;
    // Never yank a wave out from under a cutscene.
    if (window._CUTSCENE_ACTIVE || window._EXTERNAL_CUTSCENE) return;

    const st = window.__dbg && window.__dbg.state;
    if (!st) return;

    if (skipBoss() && !jumped && !pending && st.wave < BOSS_WAVE) {
      pending = true;
      // Let the launched wave finish wiring itself before the jump, so the
      // engine sets the warden wave up exactly as it would in a real run.
      setTimeout(function () { pending = false; if (jumpToWarden()) jumped = true; }, 800);
    }

    if (killAll()) cullMinions();
    else if (skipBoss() && jumped && st.wave % BOSS_WAVE === 0) cullMinions();
  }

  // ---- Settings switches (developer only) ---------------------------------
  function paint() {
    const box = document.getElementById('devStoryTools');
    if (!box) return;
    const dev = isDev();
    box.style.display = dev ? '' : 'none';
    if (!dev) return;
    const s1 = document.getElementById('devSkipBoss');
    const s2 = document.getElementById('devKillAll');
    const s3 = document.getElementById('devUnlockRealms');
    if (s1) s1.value = skipBoss() ? '1' : '0';
    if (s2) s2.value = killAll() ? '1' : '0';
    if (s3) s3.value = unlockRealms() ? '1' : '0';
  }

  const s1 = document.getElementById('devSkipBoss');
  const s2 = document.getElementById('devKillAll');
  const s3 = document.getElementById('devUnlockRealms');
  if (s1) s1.addEventListener('change', function () {
    setFlag(KEY_SKIP, s1.value === '1');
    jumped = false;
    paint();
  });
  if (s2) s2.addEventListener('change', function () { setFlag(KEY_KILL, s2.value === '1'); paint(); });
  if (s3) s3.addEventListener('change', function () {
    setFlag(KEY_REALMS, s3.value === '1');
    // The story hub is drawn from the progress when it opens, so it picks the
    // new state up on its own; tell anything already listening as well.
    try { window.dispatchEvent(new CustomEvent('story:realms-changed')); } catch (_) {}
    paint();
  });
  window.addEventListener('message', function (e) {
    const d = e.data || {};
    if (d.type !== 'auth:user') return;
    window.__arenaAuth = d;
    if (!isDev()) jumped = false;
    paint();
  });
  window.addEventListener('storage', paint);

  paint();
  setInterval(tick, 160);
  setInterval(paint, 1500);

  window.DevSwitches = {
    isDev: isDev,
    skipBoss: skipBoss,
    killAll: killAll,
    unlockRealms: unlockRealms,
    paint: paint
  };
})();
