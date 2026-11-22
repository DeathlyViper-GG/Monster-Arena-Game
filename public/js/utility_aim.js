/* =====================================================================
   utility_aim.js — aiming a throw in three dimensions.

   Hold the utility trigger (G, the UTIL button, or FIRE while the utility
   is in hand) and the throw winds up:

     • the view's yaw and pitch give the direction, and one fixed throw
       speed means the angle alone sets the distance: flat drops short, a
       lobbed 45° carries furthest, aiming down drops it at your feet
     • a thin tracer arcs from your hand to the exact spot it will land,
       with a ring, a disc and a beam on that spot so it reads at any range
     • scrolling away from the utility mid-aim drops the throw without
       letting it go

   Let go and the utility flies that arc. The simulation here is the same
   one the throw uses (UtilityGame.throwVel), so what you see is what you
   get — floor, wall or rooftop.

   It also handles being thrown by a blast: one under your feet lifts you
   straight up, one beside you throws you away from it.
   ===================================================================== */
(function (G) {
  'use strict';

  const STEPS = 420;     // tracer samples (~7 s of flight)
  const DT = 1 / 60;

  const st = { on: false, path: null, land: null, knock: [], last: 0 };

  const now = () => performance.now();
  const player = () => G.__arenaPlayer || null;
  const world = () => G.__arenaWorld || null;
  const running = () => !!(G.__pveMatchRunning && G.__pveMatchRunning());
  const game = () => G.UtilityGame || null;

  function groundAt(x, y) {
    try {
      if (G.W3 && W3.enabled && W3.data && W3.terrain) return W3.terrain(x, y) || 0;
    } catch (_) {}
    return 0;
  }

  // The throw follows the crosshair: in first person that is the view's yaw
  // and pitch. The top-down camera keeps the old flat throw along the facing.
  function angles() {
    const R = G.Render3D, c = R && R.cam, p = player();
    if (R && R.isTps && c && c.fp) return { yaw: c.tyaw || 0, pitch: c.tpitch || 0 };
    return { yaw: (p && (p.angle != null ? p.angle : p.ang)) || 0, pitch: 0 };
  }

  /* ------------------------------------------------------------ the arc */
  // Flies the throw forward in small steps and remembers the whole path, so
  // the same run can be drawn as a tracer and used as the real landing spot.
  function simulate(yaw, pitch) {
    const p = player(), w = world(), G2 = game();
    if (!p || !G2 || !G2.throwVel) return null;
    const v = G2.throwVel(yaw, pitch);
    const grav = G2.gravity || 420;
    let x = p.x + Math.cos(yaw) * ((p.r || 16) + 6);
    let y = p.y + Math.sin(yaw) * ((p.r || 16) + 6);
    let z = (p.z || 0) + 34;
    let vx = v.vx, vy = v.vy, vz = v.vz;
    const path = [];
    for (let i = 0; i < STEPS; i++) {
      const nx = x + vx * DT, ny = y + vy * DT;
      vz -= grav * DT;
      z += vz * DT;
      const blocked = !!(w && w.isBlocked(nx, ny, 5, z));
      x = nx; y = ny;
      if (i % 3 === 0) path.push({ x: x, y: y, z: Math.max(z, 0) });
      const g = groundAt(x, y);
      if (z <= g || blocked) { path.push({ x: x, y: y, z: Math.max(z, g) }); break; }
    }
    if (!path.length) return null;
    return { path: path, land: path[path.length - 1] };
  }

  // Where this throw would come to rest — the throw itself asks for this, so
  // a placed utility lands exactly where the tracer pointed.
  function landing(yaw, pitch) {
    const sim = simulate(yaw, pitch);
    return sim ? sim.land : null;
  }

  /* --------------------------------------------------------- wind-up */
  function begin() {
    const G2 = game();
    if (!G2 || !G2.equipped || !G2.ready || !running()) return false;
    st.on = true; st.path = null; st.land = null;
    // a throw puts the utility in your hands, whichever slot was up
    if (G.HeldSlot && G.HeldSlot.setSlot && !G.HeldSlot.isUtil()) G.HeldSlot.setSlot(1);
    return true;
  }

  function release() {
    if (!st.on) return false;
    st.on = false;
    const G2 = game();
    const ang = angles();
    st.path = null; st.land = null;
    paint(true);
    if (G2 && G2.ready) G2.use(ang.yaw, ang.pitch);
    return true;
  }

  function cancel() {
    if (!st.on) return false;
    st.on = false; st.path = null; st.land = null;
    paint(true);
    return true;
  }

  /* ------------------------------------------------------------- HUD */
  function paint(clear) {
    const el = document.getElementById('utilName');
    const btn = document.getElementById('btnUtil');
    const id = G.Utilities && G.Utilities.equipped ? G.Utilities.equipped() : null;
    const u = id && G.Utilities.BY_ID ? G.Utilities.BY_ID[id] : null;
    if (!u) return;
    if (el) el.textContent = u.name;
    if (btn) btn.textContent = clear ? 'UTIL' : 'AIM';
  }

  /* ----------------------------------------------------------- drawing */
  function draw(R, tt) {
    if (!st.on || !st.path || !st.path.length || !R || !R.ok) return;
    const path = st.path, land = st.land;
    const pulse = .62 + .38 * Math.sin(tt * 7);

    // a thin flat tracer with no bloom on it, so the landing marker is the
    // only thing that glows and stays readable at any range
    if (R.rib) {
      const pts = [];
      for (let i = 0; i < path.length; i += 2) pts.push(path[i].x, path[i].z + 1, path[i].y);
      if (pts.length >= 6) R.rib.line(pts, 2.0, 1.2, .35, .7, .95, .55);
    }
    if (!land) return;

    // the landing marker: a ring, a soft disc and a beam, so a throw across
    // the arena still shows exactly where it comes down
    R.decal(land.x, land.y, 40, .55, 1.05, 1.45, .65 * pulse, 2, .1, 0, true);
    R.decal(land.x, land.y, 60 + pulse * 6, .3, .8, 1.2, .22, 11, 0, 0, false);
    R.draw(R.unit.torus, R.mm(land.x, 2, land.y, 0, 40, 5, 40),
      R.mat([.5, 1.1, 1.5], { emissive: [.45, 1.0, 1.4], alpha: .8 * pulse, shadow: false }));
    R.bolt(land.x, 2, land.y, land.x, 78, land.y, [.4, .95, 1.4], 2.0, .28 * pulse, 5, 4);
  }

  function hook() {
    const R = G.Render3D;
    if (!R || !R.collect || R.collect._aimHooked) return;
    const orig = R.collect;
    R.collect = function (F, th) {
      const r = orig.apply(this, arguments);
      try { draw(R, th || 0); } catch (e) {
        if (!draw._err) { draw._err = 1; console.warn('[utility aim]', e); }
      }
      return r;
    };
    R.collect._aimHooked = true;
  }

  /* ------------------------------------------------------ blast launch */
  // An explosion throws whoever is standing in it: off to one side it throws
  // you away from the blast, and a charge at your own feet still sends you
  // forward along the way you are looking — a diagonal flight, not a hop.
  function blast(x, y, r, strength) {
    const p = player();
    if (!p || p.hp <= 0 || !(r > 0)) return;
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
    if (d > r) return;
    const k = 1 - d / r;                          // dead centre = the full kick
    const up = 850 * strength * (0.35 + k * 0.65);
    const push = 1400 * strength * (0.40 + k * 0.60);

    // Direction: away from the blast, blending into the way you are facing as
    // it gets closer to your feet.
    const a = angles().yaw;
    const fx = Math.cos(a), fy = Math.sin(a);
    const near = Math.max(0, 1 - d / Math.max(1, r * 0.5));
    let nx = (d > 1 ? dx / d : 0) * (1 - near) + fx * near;
    let ny = (d > 1 ? dy / d : 0) * (1 - near) + fy * near;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;

    if (G.Jump && G.Jump.lift) G.Jump.lift(up, 1.5);
    else p.vz = Math.max(p.vz || 0, up);
    st.knock.push({ vx: nx * push, vy: ny * push, t: 1.15 });
  }

  function applyKnock() {
    if (!st.knock.length) return;
    const t = now();
    const dt = st.last ? Math.min(0.05, (t - st.last) / 1000) : 0.016;
    st.last = t;
    const p = player(), w = world();
    if (!p) { st.knock.length = 0; return; }
    for (let i = st.knock.length - 1; i >= 0; i--) {
      const k = st.knock[i];
      k.t -= dt;
      if (k.t <= 0) { st.knock.splice(i, 1); continue; }
      const nx = p.x + k.vx * dt, ny = p.y + k.vy * dt;
      if (!w || !w.isBlocked(nx, ny, p.r)) { p.x = nx; p.y = ny; }
      // drag by the second rather than the frame, so the kick carries you the
      // whole length of the arc instead of dying in the first few frames
      const drag = Math.exp(-dt * 2.2);
      k.vx *= drag; k.vy *= drag;
    }
  }

  /* ------------------------------------------------------------- loop */
  function tick() {
    requestAnimationFrame(tick);
    applyKnock();
    if (!st.on) return;
    const G2 = game();
    if (!running() || !G2 || !G2.ready) { cancel(); return; }
    // scrolled (or tapped) off the utility: the wind-up is dropped, so the
    // release that follows throws nothing at all
    if (G.HeldSlot && G.HeldSlot.isUtil && !G.HeldSlot.isUtil()) { cancel(); return; }
    const ang = angles();
    const sim = simulate(ang.yaw, ang.pitch);
    st.path = sim ? sim.path : null;
    st.land = sim ? sim.land : null;
    paint(false);
  }

  /* ------------------------------------------------------------ input */
  function typing(e) {
    return !!(e && e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName));
  }

  G.addEventListener('keydown', (e) => {
    if (!e || e.repeat || typing(e)) return;
    if ((e.key || '').toLowerCase() !== 'g') return;
    begin();
  });
  G.addEventListener('keyup', (e) => {
    if (!e || typing(e)) return;
    if ((e.key || '').toLowerCase() !== 'g') return;
    release();
  });

  function bindButton() {
    const btn = document.getElementById('btnUtil');
    if (!btn || btn._aimBound) return;
    btn._aimBound = true;
    const down = (e) => { e.preventDefault(); begin(); };
    const up = (e) => { e.preventDefault(); release(); };
    btn.addEventListener('touchstart', down, { passive: false });
    btn.addEventListener('touchend', up, { passive: false });
    btn.addEventListener('mousedown', down);
    btn.addEventListener('mouseup', up);
    btn.addEventListener('mouseleave', up);
  }

  // The trigger that started the wind-up can end anywhere — off the button,
  // off the canvas, after a hop into another window.
  G.addEventListener('mouseup', () => release());
  G.addEventListener('touchend', () => release());
  G.addEventListener('pointercancel', () => cancel());
  G.addEventListener('blur', () => cancel());

  function init() {
    hook();
    bindButton();
    if (!tick._started) { tick._started = true; requestAnimationFrame(tick); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  setTimeout(init, 800);

  G.UtilityAim = { begin, release, cancel, landing, simulate, blast, draw };
})(window);
