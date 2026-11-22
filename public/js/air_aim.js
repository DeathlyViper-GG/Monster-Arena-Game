// ============================================================
// Monster Arena — SHOTS FOLLOW THE CROSSHAIR
// The gun used to fire perfectly flat: a bullet left the muzzle at chest height
// and stayed there, while the crosshair pointed at the floor somewhere else.
// Look down and the tracer sailed out above whatever you were aiming at — the
// gap grew with height, which is why flying made it obvious.
//
// Now every shot leaves the muzzle and comes down onto the exact floor point
// the crosshair is over, so the tracer ends where the crosshair does. The
// lobby server is told about that descent too, so a shot fired from the air is
// simulated along the line the player actually fired.
//
// Nothing changes in the top-down camera (there the mouse is the aim, not the
// screen centre).
// ============================================================
(function () {
  'use strict';

  const FLOOR = 10;        // how high above the floor a shot lands
  const MIN_LEN = 24;      // closer than this the crosshair is basically on you
  let frames = 0;

  function me() { return (window.__dbg && window.__dbg.player) || null; }
  function flying() { try { return !!(window.Flight && Flight.active()); } catch (_) { return false; } }
  function net() { return window.Net || null; }

  // The floor point under the crosshair. A single flat plane is wrong as soon
  // as there is terrain, so the ray is walked down until it settles on the
  // floor that is really there (hills, slopes, rooftops).
  function aimPoint() {
    const R = window.Render3D;
    if (!R || !R.ok || !R.cw || !R.isTps || typeof R.screenToWorld !== 'function') return null;
    let y = (R.eye && isFinite(R.eye[1])) ? R.eye[1] : 12;
    let hit = null;
    for (let i = 0; i < 6; i++) {
      const p = R.screenToWorld(R.cw / 2, R.ch / 2, y);
      if (!p) return hit;                       // crosshair above the horizon
      hit = p;
      let g = 0;
      try { g = (window.W3 && W3.terrain) ? (W3.terrain(p.x, p.y) || 0) : 0; } catch (_) { g = 0; }
      const next = g + FLOOR;
      if (Math.abs(next - y) < 6) break;
      y = next;
    }
    return hit;
  }

  // How fast the shot has to fall: the muzzle is 'drop' above the floor the
  // crosshair is on, and that floor is 'horiz' away, so the drop is spread
  // across the time the bullet takes to fly that far.
  function diveVz(speed) {
    const p = me();
    if (!p || !(speed > 0)) return null;
    const hit = aimPoint();
    if (!hit) return null;
    const horiz = Math.hypot(hit.x - p.x, hit.y - p.y);
    if (!(horiz > MIN_LEN)) return null;
    let muzzle = 0, gz = 0;
    try { muzzle = W3.muzzleZ(p); gz = (W3.terrain && W3.terrain(hit.x, hit.y)) || 0; } catch (_) { return null; }
    const drop = muzzle - (gz + FLOOR);
    if (!(Math.abs(drop) > 3)) return null;
    const vz = -drop * speed / horiz;
    const cap = speed * 2.4;
    return Math.max(-cap, Math.min(cap, vz));
  }

  // ---- the tracers you see ------------------------------------------------
  // Each bullet is patched once, on its first frame, so the drawn shot bends
  // onto the crosshair the same way the hit test does.
  const seen = new WeakSet();
  function fixTracers() {
    const ents = window.__dbg && window.__dbg.ents;
    const list = ents && ents.bullets;
    if (!list || !list.length) return;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b || seen.has(b)) continue;
      seen.add(b);
      const vz = diveVz(Math.hypot(b.vx || 0, b.vy || 0));
      if (vz !== null) b.vz = vz;
    }
  }

  // ---- the shots the server simulates -------------------------------------
  function wrapNet() {
    const N = net();
    if (!N || N._airShotWrap || typeof N.sendShoot !== 'function') return;
    const orig = N.sendShoot;
    N.sendShoot = function (x, y, ang, speed, dmg, z, vz, weapon) {
      let v = vz;
      const d = diveVz(speed);
      if (d !== null) v = d;
      return orig.call(this, x, y, ang, speed, dmg, z, v, weapon);
    };
    N._airShotWrap = true;
  }

  function tick() {
    requestAnimationFrame(tick);
    frames++;
    if (frames % 30 === 0) wrapNet();   // the network layer can arrive later
    fixTracers();
  }

  wrapNet();
  requestAnimationFrame(tick);

  window.AirAim = { diveVz, flying, aimPoint };
})();
