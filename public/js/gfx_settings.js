// ============================================================
// Monster Arena — GRAPHICS QUALITY SETTING
// The settings panel's "Graphics quality" picker. The renderer already owns
// the four presets (low / medium / high / ultra) and its own persisted key;
// this only wires the dropdown to it so the choice applies the moment it is
// changed, and shows the current pick next time the panel opens.
// Loaded after pve16.js, which publishes window.setGfxQuality.
// ============================================================
(function () {
  'use strict';

  const KEY = 'arenaSettings';

  function readAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; }
  }
  function read(name, fallback) {
    const v = readAll()[name];
    return v == null ? fallback : v;
  }
  function write(name, val) {
    const all = readAll();
    all[name] = val;
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (_) {}
  }

  function apply(sel) {
    const name = sel.value;
    write('gfxQuality', name);
    if (typeof window.setGfxQuality === 'function') window.setGfxQuality(name);
    else if (window.Render3D && window.Render3D.setQuality) window.Render3D.setQuality(name);
  }

  function init() {
    const sel = document.getElementById('selGfx');
    if (!sel) return;
    // A stored pick wins; otherwise show whatever quality the renderer booted
    // with (it picks one from the screen, or from a ?q= link).
    sel.value = read('gfxQuality', '') || (window.Render3D && window.Render3D.qName) || 'medium';
    sel.addEventListener('change', function () { apply(sel); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
