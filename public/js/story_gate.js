// ============================================================
// STORY GATE — story content belongs to the Story campaign only.
// The moment a normal match screen (Singleplayer or Offline) appears, any story
// run is closed: no realm Warden, no story objective, no chapter dialogue and no
// chapter-end hook can reach a standard match, however the player got there.
// Loaded after story.js and before the engine (pve16.js), so the menu handlers
// further down game.html can call window._endStoryRun() too.
// ============================================================
(function () {
  'use strict';

  function endStoryRun() {
    const wasLive = window.STORY_ACTIVE === true || window.STORY_REALM != null;
    window.STORY_ACTIVE = false;
    window.STORY_REALM = null;
    if (!wasLive) return;
    // A chapter's objective banner / dialogue box must not linger into a match.
    try {
      if (window.Story && window.Story.hideHUD) window.Story.hideHUD();
    } catch (_) {}
  }
  window._endStoryRun = endStoryRun;

  const SCREENS = ['overlaySingle', 'overlayOffline'];
  const shown = (el) => !!el && el.style.display !== 'none' && el.style.display !== '';

  function guard(el) {
    if (!el) return;
    // These overlays are shown by writing style.display, so watching the
    // attribute catches every route onto a normal match screen.
    new MutationObserver(() => { if (shown(el)) endStoryRun(); })
      .observe(el, { attributes: true, attributeFilter: ['style'] });
  }

  function init() {
    SCREENS.forEach((id) => guard(document.getElementById(id)));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
