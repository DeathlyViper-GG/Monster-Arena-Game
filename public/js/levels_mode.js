// ============================================================
// Monster Arena — LEVELS (RUNE PROGRESSION)
// A run climbs 100 waves. Every 5 waves the arena moves on to the next map
// (the five realms cycle), and the 5th wave of each map is a boss wave.
//
// Wave 100 ends the run: a victory screen offers "Progress", which carries the
// player into the next Rune. The arena and the rules stay exactly the same —
// every monster simply has far more health and hits far harder. Rune 1 is the
// normal game; by Rune 10 even a ravener is a serious threat.
//
// Exposes window.LevelsMode.
// ============================================================
(function () {
  'use strict';

  const RUNE_KEY = 'arenaLevelsRune';
  const WAVES = 100;      // waves in one rune
  const PER_MAP = 5;      // waves on each map before it changes
  const MAPS = 5;         // realms to cycle through
  const MAX_RUNE = 10;

  const state = { active: false, rune: 1 };

  const clampRune = (r) => Math.min(MAX_RUNE, Math.max(1, Number(r) || 1));
  function storedRune() { return clampRune(parseInt(localStorage.getItem(RUNE_KEY) || '1', 10)); }

  // Which realm the wave is fought on. Waves 1-5 → map 1, 6-10 → map 2, …
  function themeForWave(n) { return ((Math.floor((Math.max(1, n) - 1) / PER_MAP)) % MAPS) + 1; }
  function mapName(id) {
    const levels = (window._Gauntlet && window._Gauntlet.LEVELS) || [];
    const th = levels.find((l) => l.id === id);
    return th ? th.name : 'Map ' + id;
  }

  // Rune difficulty. Health, then damage, then a gentle speed creep — Rune 1
  // leaves everything untouched.
  function hpMul() { const r = state.rune - 1; return 1 + 0.45 * r + 0.08 * r * r; }
  function damageMul() { const r = state.rune - 1; return 1 + 0.30 * r + 0.05 * r * r; }
  function speedMul() { return Math.min(1.6, 1 + 0.035 * (state.rune - 1)); }

  // Called for every monster that enters the arena while a rune run is live.
  function scaleEnemy(e) {
    if (!e || !(e.maxhp > 0)) return;
    const h = hpMul();
    e.maxhp = Math.round(e.maxhp * h);
    e.hp = Math.round(e.hp * h);
    if (e.type !== 'boss' && e.speed) e.speed *= speedMul();
  }

  function paintHud(n) {
    const box = document.getElementById('levelsHud');
    if (!box) return;
    box.style.display = state.active ? '' : 'none';
    const runeEl = document.getElementById('levelsRune');
    const waveEl = document.getElementById('levelsWave');
    const mapEl = document.getElementById('levelsMap');
    if (runeEl) runeEl.textContent = String(state.rune);
    if (waveEl) waveEl.textContent = Math.min(WAVES, Math.max(1, n)) + '/' + WAVES;
    if (mapEl) mapEl.textContent = mapName(themeForWave(n));
  }

  // Called by the engine at the top of every wave. Returns true when the run is
  // over (wave 100 cleared), so no further wave ever starts.
  function beforeWave(n) {
    if (!state.active) return false;
    if (n > WAVES) { finish(); return true; }
    const api = window._Gauntlet && window._Gauntlet.api;
    if (api) {
      const lid = themeForWave(n);
      if (lid && (!api.theme || api.theme.id !== lid)) {
        const th = api.levels.find((l) => l.id === lid);
        if (th) { api.applyTheme(th); api.clearAll(); api.resetPlayer(); }
      }
    }
    paintHud(n);
    return false;
  }

  function hideOverlays(exceptId) {
    document.querySelectorAll('.overlay').forEach((o) => {
      if (o.id !== exceptId && o.id !== 'overlayBoot') o.style.display = 'none';
    });
  }

  function start() {
    const G = window._Gauntlet;
    if (!G || !G.restart) return;
    state.active = true;
    state.rune = storedRune();

    // A rune run is an offline solo run: no bots, no Teams/CTF flags.
    window.TEAMS_MODE = false;
    window.CTF_MODE = false;
    window.PVP_MODE = false;
    window.BOTS_ENABLED = false;
    try { if (window.Teams && Teams.reset) Teams.reset(); } catch (_) {}
    try { if (window.CTF && CTF.reset) CTF.reset(); } catch (_) {}
    try { if (window._endStoryRun) window._endStoryRun(); } catch (_) {}

    window.MENU_CONTEXT = 'single';
    hideOverlays('');
    if (G.setThemeById) G.setThemeById(themeForWave(1));
    G.restart();
    paintHud(1);
  }

  function stop() {
    state.active = false;
    const hud = document.getElementById('levelsHud');
    if (hud) hud.style.display = 'none';
    const ov = document.getElementById('overlayLevelsVictory');
    if (ov) ov.style.display = 'none';
  }

  // All 100 waves of the rune are done.
  function finish() {
    try { if (window._hardStopGame) window._hardStopGame(); } catch (_) {}
    paintHud(WAVES);
    hideOverlays('overlayLevelsVictory');

    const ov = document.getElementById('overlayLevelsVictory');
    if (ov) ov.style.display = 'grid';

    const atMax = state.rune >= MAX_RUNE;
    const text = document.getElementById('levelsVictoryText');
    if (text) {
      text.textContent = atMax
        ? 'Rune 10 has fallen — there are no deeper runes left.'
        : 'All ' + WAVES + ' waves cleared on Rune ' + state.rune + '. Rune ' + (state.rune + 1) + ' is waiting.';
    }
    const runeTag = document.getElementById('levelsVictoryRune');
    if (runeTag) runeTag.textContent = 'Rune ' + state.rune;

    const btn = document.getElementById('levelsProgressBtn');
    if (btn) btn.textContent = atMax ? '▶ Replay Rune 10' : '▶ Progress';
  }

  function progress() {
    if (state.rune < MAX_RUNE) {
      state.rune += 1;
      try { localStorage.setItem(RUNE_KEY, String(state.rune)); } catch (_) {}
    }
    start();
  }

  function goMenu() {
    stop();
    try { if (window._hardStopGame) window._hardStopGame(); } catch (_) {}
    hideOverlays('overlayIntro');
    const intro = document.getElementById('overlayIntro');
    if (intro) intro.style.display = 'grid';
    window.MENU_CONTEXT = 'intro';
  }

  function bind() {
    const on = (id, fn, capture) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn, !!capture);
    };
    on('introLevels', (e) => { e.preventDefault(); start(); });
    on('levelsProgressBtn', (e) => { e.preventDefault(); progress(); });
    on('levelsHomeBtn', (e) => { e.preventDefault(); goMenu(); });

    // Choosing any other mode, or going home, ends the rune run.
    ['btnIntroSingle', 'btnIntroOffline', 'btnIntroMulti', 'introStory', 'btnHome', 'homeBtn2', 'victoryHomeBtn']
      .forEach((id) => on(id, () => { if (state.active) stop(); }, true));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

  window.LevelsMode = {
    get active() { return state.active; },
    get rune() { return state.rune; },
    WAVES,
    MAX_RUNE,
    start,
    stop,
    themeForWave,
    beforeWave,
    finish,
    hpMul,
    damageMul,
    scaleEnemy
  };
})();
