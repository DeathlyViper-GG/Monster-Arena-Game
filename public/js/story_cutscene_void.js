// ============================================================
// Monster Arena — Void Cutscene (Realm 5 intro)
// The realm 5 intro is the full 3D "Neon Void" cinematic (three.js),
// played by the host app over the game. Ask the host for it; when no
// host answers (standalone page / older host) fall back to the shared
// story cutscene player with the realm's own beats.
// Exposes window.VoidCutscene.
// ============================================================
(function () {
  'use strict';

  function playCanvas(script, opts, done) {
    if (window.StoryCutscene) {
      StoryCutscene.play(script, {
        accent: (opts && opts.accent) || '#d066ff',
        icon: (opts && opts.icon) || '🔮',
        onDone: done
      });
    } else {
      done();
    }
  }

  function play(script, opts) {
    const done = (opts && opts.onDone) || function () {};
    const host = (window.parent && window.parent !== window) ? window.parent : null;
    if (!host) { playCanvas(script, opts, done); return; }

    let acked = false;
    // The 3D intro is drawn by the host document, so this page has no overlay
    // to detect — flag it as an external cutscene so the cutscene music plays
    // (and the menu theme steps aside) for its whole duration.
    window._EXTERNAL_CUTSCENE = true;
    let settled = false;
    function finish() {
      if (settled) return;
      settled = true;
      window._EXTERNAL_CUTSCENE = false;
      done();
    }
    function fallback() {
      if (settled) return;
      window._EXTERNAL_CUTSCENE = false;
      playCanvas(script, opts, finish);
    }
    function onMsg(e) {
      const d = e.data || {};
      if (d.type === 'void-intro-ack') {
        acked = true;
        clearTimeout(timer);
      } else if (d.type === 'void-intro-done') {
        window.removeEventListener('message', onMsg);
        clearTimeout(timer);
        finish();
      }
    }
    const timer = setTimeout(function () {
      if (acked) return;
      window.removeEventListener('message', onMsg);
      fallback();
    }, 900);

    window.addEventListener('message', onMsg);
    try { host.postMessage({ type: 'void-intro-start' }, '*'); }
    catch (_) {
      window.removeEventListener('message', onMsg);
      clearTimeout(timer);
      fallback();
    }
  }

  window.VoidCutscene = { play };
})();
