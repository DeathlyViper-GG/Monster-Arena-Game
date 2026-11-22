// ============================================================
// Monster Arena — inspector guard
// The platform badge is drawn in the hosting page, behind the corner panel.
// A player must not be able to open the browser's inspector (where the badge,
// its link and the page markup are all reachable) — so the right-click menu and
// the DevTools shortcuts are blocked across the whole game document.
// Text fields keep their menu so copying, pasting and spellcheck still work in
// the global chat and the nickname box.
// ============================================================
(function () {
  'use strict';

  function inTextField(target) {
    var el = target;
    while (el && el.nodeType === 1) {
      var tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable) return true;
      el = el.parentElement;
    }
    return false;
  }

  document.addEventListener('contextmenu', function (e) {
    if (inTextField(e.target)) return;
    e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
  }, true);

  document.addEventListener('keydown', function (e) {
    var k = String(e.key || '').toLowerCase();
    // F12 opens the inspector on its own, in every browser.
    if (k === 'f12') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    var mod = e.ctrlKey || e.metaKey;
    // Ctrl/Cmd + Shift + I / J / C — inspector, console, element picker.
    if (mod && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Ctrl/Cmd + U — page source, which exposes the same markup.
    if (mod && !e.shiftKey && k === 'u') {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
})();
