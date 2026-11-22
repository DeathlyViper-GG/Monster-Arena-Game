// ============================================================
// Monster Arena — FULLSCREEN TOGGLE
// The arena only ever shows a browser bar it does not need. The button in the
// top-right corner owns the whole screen; on a phone the game takes it on the
// first touch, without waiting to be asked.
//
// A browser only grants fullscreen from inside the tap itself, so this document
// asks first and the page hosting the frame is only a fallback. Where a browser
// has no fullscreen for web pages at all (iPhone Safari), the tap says how to
// still get a chrome-free game instead of doing nothing.
// ============================================================
(function () {
  'use strict';

  const btn = document.getElementById('fsBtn');
  if (!btn) return;

  const inFrame = () => !!(window.parent && window.parent !== window);
  const native = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  // Launched from the home screen, the game already owns the whole display:
  // there is not a single browser bar left for the button to remove.
  const chromeFree = () => {
    try {
      if (window.navigator.standalone === true) return true;
      return window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches;
    } catch (_) { return false; }
  };
  const isOn = () => window.__ARENA_FS === true || native() || chromeFree();

  function paint(on) {
    const changed = (window.__ARENA_FS === true) !== !!on;
    window.__ARENA_FS = !!on;
    // Screen shape changed: let the arena re-measure itself (minimap included).
    if (changed) window.dispatchEvent(new Event('resize'));
    btn.classList.toggle('is-on', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.title = on ? 'Exit fullscreen' : 'Fullscreen';
    btn.setAttribute('aria-label', btn.title);
  }

  function relay(on) {
    if (!inFrame()) return;
    try { window.parent.postMessage({ type: 'arena:fullscreen', on: !!on }, '*'); } catch (_) {}
  }

  // Ask this document for the screen. Returns false when the browser has no
  // way to do it here, so the host page can try instead.
  function nativeOn() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return false;
    try {
      const res = req.call(el, { navigationUI: 'hide' });
      if (res && typeof res.then === 'function') {
        res.then(function () { /* the frame owns the screen now */ }, function () { relay(true); });
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function nativeOff() {
    const ex = document.exitFullscreen || document.webkitExitFullscreen;
    if (!ex) return;
    try { Promise.resolve(ex.call(document)).catch(function () {}); } catch (_) {}
  }

  let hintEl = null, hintTimer = null;
  function hint() {
    // Only reached when the browser kept its bars even after the page scrolled.
    const msg = 'This browser will not hand the whole screen to a web page. The arena is playable as it is — for no bars at all, open it from your home screen.';
    if (!hintEl) {
      hintEl = document.createElement('div');
      hintEl.id = 'fsHint';
      hintEl.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:70;' +
        'max-width:min(420px,90vw);padding:11px 16px;border-radius:12px;' +
        'background:linear-gradient(180deg,rgba(22,17,38,.96),rgba(8,6,16,.97));' +
        'border:1px solid rgba(150,110,255,.6);box-shadow:0 10px 30px rgba(0,0,0,.6),0 0 20px rgba(140,90,240,.3);' +
        'color:#e8e0ff;font:600 12px/1.45 system-ui,sans-serif;text-align:center;letter-spacing:.02em;' +
        'cursor:pointer;display:none;';
      hintEl.addEventListener('click', function () { hintEl.style.display = 'none'; });
      document.body.appendChild(hintEl);
    }
    hintEl.textContent = msg;
    hintEl.style.display = 'block';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { if (hintEl) hintEl.style.display = 'none'; }, 6000);
  }

  // A browser that refused once will refuse every time. Say so once, then take
  // the button away instead of leaving a control that only pretends to work.
  function retire() {
    hint();
    setTimeout(function () { btn.style.display = 'none'; }, 4500);
  }

  function ask(on, quiet) {
    if (on) {
      if (!nativeOn()) relay(true);
      // Nothing on screen shortly after = the browser refused.
      if (!quiet) setTimeout(function () { if (!isOn()) retire(); }, 900);
      return;
    }
    nativeOff();
    // The host page may be the one holding the screen; tell it either way.
    relay(false);
  }

  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    ask(!isOn());
  });

  window.addEventListener('message', function (e) {
    const d = e.data || {};
    if (d.type === 'arena:fullscreen-state') { paint(!!d.on); return; }
    // The host page needs the screen back (it is showing a story cutscene or
    // the death screen, which live in its own document).
    if (d.type === 'arena:fullscreen' && d.on === false) { nativeOff(); paint(false); }
  });

  ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (t) {
    document.addEventListener(t, function () { paint(native()); });
  });

  // Nothing to gain where the browser bars are already gone.
  if (chromeFree()) btn.style.display = 'none';
  paint(isOn());

  // Phones: the arena should own the screen from the start. The first gesture
  // is the earliest a browser allows it.
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
    const first = function () {
      if (!isOn()) ask(true, true);
      window.removeEventListener('pointerdown', first);
      window.removeEventListener('touchstart', first);
    };
    window.addEventListener('pointerdown', first, { passive: true });
    window.addEventListener('touchstart', first, { passive: true });
  }
})();
