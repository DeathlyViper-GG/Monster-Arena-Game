// ============================================================
// Monster Arena — FLIGHT (DeathlyViper only)
// Gives one account real flying: hover, rise and descend freely, and pass over
// walls and rooftops instead of being pinned to the ground.
//
//   F   toggle flight on / off
//   SPACE (or C)  hold to climb
//   X            hold to sink
//
// It works by taking over the player's vertical physics for the frames it is
// active (W3.stepPlayer is wrapped, everything else is untouched), so the body,
// the camera riding on it and anything that reads player.z follow along. It is
// available in every mode and map: singleplayer, offline PvE/PvP/Teams/CTF,
// Levels, story chapters and parkour.
// ============================================================
(function () {
  'use strict';

  const LIFT = 240;   // hover height above the ground when flight starts
  const RISE = 620;   // units per second while climbing or sinking
  const MIN = 60;     // never closer to the ground than this while flying
  const MAX = 1500;   // never higher above the ground than this
  const EASE = 9;     // how quickly the body settles onto its altitude

  let on = false;
  let target = 0;
  let up = false;
  let down = false;
  let mine = null;    // our wrapper, so it can stay the outermost hook
  let badge = null;

  const me = () => (window.__dbg && window.__dbg.player) || null;

  function isDev() {
    try { return !!(window.DevSwitches && window.DevSwitches.isDev()); } catch (_) { return false; }
  }

  function running() {
    try { if (typeof window.__pveMatchRunning === 'function') return !!window.__pveMatchRunning(); } catch (_) {}
    const st = window.__dbg && window.__dbg.state;
    return !!(st && st.running);
  }

  function ready() {
    const p = me();
    return !!p && p.hp > 0 && isDev() && running() &&
      !!(window.W3 && W3.enabled && W3.data);
  }

  function ground(p) {
    try { return W3.surfaceZ(p.x, p.y, p.z || 0); } catch (_) { return 0; }
  }

  // The vertical step used while flying: hold the altitude, never sink into the
  // floor, and keep the camera glued to the body.
  function fly(p, dt) {
    const g = ground(p);
    if (up && !down) target += RISE * dt;
    else if (down && !up) target -= RISE * dt;
    target = Math.max(g + MIN, Math.min(g + MAX, target));
    p.z += (target - p.z) * Math.min(1, dt * EASE);
    p.vz = 0;
  }

  // Mid-flight you count as airborne, so ground hazards and monster contact
  // pass underneath you exactly as they do during a hop.
  function wrapAirborne() {
    if (!window.Jump || Jump.__flyWrapped || typeof Jump.airborne !== 'function') return;
    const orig = Jump.airborne;
    Jump.airborne = function () { return on || orig(); };
    Jump.__flyWrapped = true;
  }

  // Parkour (and anything else loaded after this file) hooks the same step, so
  // the wrapper is re-asserted as the outermost one instead of a one-shot hook.
  function wrap() {
    if (!window.W3 || typeof W3.stepPlayer !== 'function' || W3.stepPlayer === mine) return;
    const orig = W3.stepPlayer;
    mine = function (p, dt) {
      if (on && p === me()) { fly(p, dt); return; }
      orig.call(W3, p, dt);
    };
    W3.stepPlayer = mine;
  }

  function paint() {
    if (!isDev()) {
      if (badge) badge.style.display = 'none';
      return;
    }
    if (!badge) {
      badge = document.createElement('div');
      badge.textContent = '✈ Flying — F to land · Space up · X down';
      badge.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);' +
        'z-index:2147483000;pointer-events:none;display:none;padding:6px 14px;border-radius:999px;' +
        'font:800 11px/1.4 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;' +
        'color:#eafcff;background:rgba(8,16,28,.86);border:1px solid rgba(120,220,255,.65);' +
        'box-shadow:0 0 22px rgba(90,200,255,.45)';
      document.body.appendChild(badge);
    }
    badge.style.display = on ? 'block' : 'none';
  }

  function setOn(v) {
    if (v && !ready()) return;
    on = !!v;
    if (on) {
      const p = me();
      const g = ground(p);
      target = Math.max(g + MIN, (p.z || g) + LIFT);
      p.vz = 0;
    }
    up = down = false;
    paint();
  }

  // ---- input -------------------------------------------------------------
  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (!isDev()) return;
    const k = (e.key || '').toLowerCase();

    if (k === 'f') {
      // Only inside a live match — never in a lobby or a menu.
      if (!on && !ready()) return;
      e.preventDefault();
      setOn(!on);
      return;
    }
    if (!on) return;
    if (k === ' ' || k === 'c') { e.preventDefault(); up = true; }
    else if (k === 'x') { e.preventDefault(); down = true; }
  }, { passive: false });

  window.addEventListener('keyup', function (e) {
    const k = (e.key || '').toLowerCase();
    if (k === ' ' || k === 'c') up = false;
    else if (k === 'x') down = false;
  });

  // ---- keep it honest ----------------------------------------------------
  let frame = 0;
  function tick() {
    requestAnimationFrame(tick);
    frame++;
    wrap();
    wrapAirborne();
    // Landing when the match ends, the player dies or the account changes.
    if (on && !ready()) setOn(false);
    if (frame % 20 === 0) paint();
  }

  paint();
  wrap();
  wrapAirborne();
  requestAnimationFrame(tick);

  window.Flight = {
    isDev,
    active: () => on,
    toggle: () => setOn(!on),
    off: () => setOn(false)
  };
})();
