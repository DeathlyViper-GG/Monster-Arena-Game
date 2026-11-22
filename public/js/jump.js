// ============================================================
// Monster Arena — JUMP
// A short hop for the player: just high enough to clear a hazard tile or pass
// over a monster's body, low enough that it never becomes a way to travel.
// The lift itself comes from the engine's own vertical physics — we only set
// the launch speed (the 3D body, and the camera riding on it, follow player.z
// automatically). Everything the player should pass over mid-hop asks
// airborne() before it bites.
// Exposes window.Jump.
// ============================================================
(function () {
  'use strict';

  const V = 640;    // launch speed — with the engine's 1300 gravity, ~158 units of lift
  const AIR = 1.0;  // seconds counted as off the ground (a touch longer than the hop)
  let until = 0;

  function me() { return window.__dbg && window.__dbg.player; }

  // True while the player is off the ground. Hazards and monster contact read
  // this, so a well-timed hop carries you over them.
  function airborne() { return performance.now() < until; }

  function jump() {
    const p = me();
    if (!p || p.hp <= 0 || airborne()) return;
    if (window.W3 && W3.enabled && W3.data) {
      // Only from the ground: a second tap mid-fall does nothing. The
      // tolerance (and the snap) mean a slope you are still settling onto
      // never swallows the jump — you can hop mid-stride, mid-burst.
      const g = W3.surfaceZ(p.x, p.y, p.z);
      if (Math.abs((p.z || 0) - g) > 24) return;
      p.z = g;
      p.vz = V;
    }
    until = performance.now() + AIR * 1000;
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = (e.key || '').toLowerCase();
    if (k === ' ' || k === 'c') { e.preventDefault(); jump(); }
  }, { passive: false });

  // Mobile: the JUMP button beside SLIDE. It listens on its own pointer only,
  // so a thumb already holding FIRE keeps firing through the whole hop.
  function bindMobile() {
    const b = document.getElementById('btnJump');
    if (!b) return;
    b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); jump(); }, { passive: false });
    b.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); jump(); });
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', bindMobile);
  else bindMobile();

  // A blast (or anything else that throws the player) sets its own lift: the
  // hop above is only the hop the player asks for.
  function lift(vz, air) {
    const p = me();
    if (!p || p.hp <= 0 || !(vz > 0)) return;
    p.vz = Math.max(p.vz || 0, vz);
    until = Math.max(until, performance.now() + (air || 1.1) * 1000);
  }

  window.Jump = { jump, airborne, lift };
})();
