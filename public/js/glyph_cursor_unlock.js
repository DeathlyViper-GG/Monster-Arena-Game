// ============================================================
// Monster Arena — glyph screen cursor release
// Between waves (and as a Gauntlet reward) the glyph chooser is opened, but a
// running match keeps the mouse locked to the canvas, so the cursor is
// invisible and the nodes cannot be clicked. Whenever the glyph overlay
// becomes visible, release the pointer lock.
// ============================================================
(function () {
  'use strict';

  function release() {
    if (document.pointerLockElement && document.exitPointerLock) {
      try { document.exitPointerLock(); } catch (_) {}
    }
  }

  function shown(ov) {
    const d = getComputedStyle(ov).display;
    return d && d !== 'none';
  }

  function watch() {
    const ov = document.getElementById('overlayGlyphs');
    if (!ov) { requestAnimationFrame(watch); return; }
    if (shown(ov)) release();
    // Both the wave-break chooser and the gauntlet reward show the same
    // overlay by flipping its display, so watching it covers every entry.
    new MutationObserver(() => { if (shown(ov)) release(); })
      .observe(ov, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  watch();
})();
