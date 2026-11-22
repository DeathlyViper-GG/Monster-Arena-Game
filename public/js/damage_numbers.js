// ============================================================
// Monster Arena — DAMAGE NUMBERS.
// A floating DOM layer that pops the amount of damage you land on a monster,
// a bot or another player right above whatever you hit. Numbers rise, drift a
// little and fade; a strong hit reads bigger and hotter.
//
// Positions come from Render3D.w2s when the 3D scene is drawing, and from the
// top-down camera otherwise — the same dual projection the nameplates use, so
// the numbers sit on the target in either renderer.
//
// Exposes window.DamageNumbers.
// ============================================================
(function () {
  'use strict';

  const LIFE = 0.85;        // seconds on screen
  const RISE = 54;          // pixels travelled upward over that life
  const MAX_LIVE = 48;      // hard cap on simultaneous numbers

  const layer = document.createElement('div');
  layer.id = 'dmgLayer';
  document.body.appendChild(layer);
  injectCSS();

  const pool = [];
  const live = [];

  function take() {
    const el = pool.pop();
    if (el) { el.style.display = 'block'; el.className = 'dmg'; return el; }
    const n = document.createElement('div');
    n.className = 'dmg';
    layer.appendChild(n);
    return n;
  }

  function give(el) {
    el.style.display = 'none';
    if (pool.length < MAX_LIVE) pool.push(el);
  }

  // A match draws either through the 3D scene or the 2D fallback, whose
  // top-down camera rides the player — support both, like the nameplates.
  function threeScene() {
    const R = window.Render3D;
    if (!R || !R.ok || !R.F) return null;
    const c3 = document.getElementById('game3d');
    if (c3 && c3.style.display === 'none') return null;
    return R;
  }

  function project(x, y, h) {
    const three = threeScene();
    if (three) return three.w2s(x, y, (h || 0) + three.groundY(x, y));
    const me = window.__pvePlayer ? window.__pvePlayer() : null;
    const px = me ? me.x : x, pz = me ? me.y : y;
    return { x: x - px + window.innerWidth / 2, y: y - pz + window.innerHeight / 2 - (h || 0), w: 800 };
  }

  /**
   * pop(x, y, amount, kind)
   * kind: 'enemy' (default) | 'bot' | 'player'
   */
  function pop(x, y, amount, kind) {
    const n = Math.round(Number(amount) || 0);
    if (!Number.isFinite(n) || n <= 0) return;
    if (live.length >= MAX_LIVE) {
      const old = live.shift();
      if (old) give(old.el);
    }
    const el = take();
    el.textContent = String(n);
    el.className = 'dmg dmg--' + (kind || 'enemy') + (n >= 40 ? ' dmg--big' : '');
    el.style.opacity = '1';
    live.push({
      el: el,
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      h: 42,
      t: 0,
      drift: (Math.random() - 0.5) * 26
    });
  }

  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!live.length) return;
    if (window.__pveMatchRunning && !window.__pveMatchRunning()) {
      while (live.length) give(live.pop().el);
      return;
    }
    const cw = window.innerWidth, ch = window.innerHeight;
    for (let i = live.length - 1; i >= 0; i--) {
      const d = live[i];
      d.t += dt;
      const k = d.t / LIFE;
      if (k >= 1) { give(d.el); live.splice(i, 1); continue; }
      const p = project(d.x, d.y, d.h + RISE * k);
      if (!p || !isFinite(p.x) || !isFinite(p.y) || p.x < -120 || p.x > cw + 120 || p.y < -80 || p.y > ch + 80) {
        d.el.style.opacity = '0';
        continue;
      }
      d.el.style.opacity = String(k < 0.65 ? 1 : (1 - k) / 0.35);
      d.el.style.transform = 'translate3d(' + (p.x + d.drift * k).toFixed(1) + 'px,' + p.y.toFixed(1) +
        'px,0) translate(-50%,-50%) scale(' + (1 + 0.22 * (1 - k)).toFixed(3) + ')';
    }
  }

  function injectCSS() {
    const st = document.createElement('style');
    st.id = 'damageNumberCSS';
    st.textContent = `
    #dmgLayer{position:fixed;inset:0;pointer-events:none;z-index:6;overflow:hidden;}
    .dmg{position:absolute;left:0;top:0;display:none;white-space:nowrap;
      font:900 19px/1 "Arial Black",system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.02em;
      color:#fff;-webkit-text-stroke:2.5px rgba(8,4,16,.85);paint-order:stroke fill;
      text-shadow:0 2px 8px rgba(0,0,0,.85),0 0 14px rgba(255,190,90,.5);
      will-change:transform,opacity;}
    .dmg--enemy{color:#ffe9a8;text-shadow:0 2px 8px rgba(0,0,0,.85),0 0 16px rgba(255,190,80,.7);}
    .dmg--bot{color:#ffc79a;text-shadow:0 2px 8px rgba(0,0,0,.85),0 0 16px rgba(255,140,60,.7);}
    .dmg--player{color:#ff4d4d;text-shadow:0 2px 8px rgba(0,0,0,.9),0 0 16px rgba(255,40,40,.85);}
    .dmg--big{font-size:26px;color:#fff2c4;
      text-shadow:0 2px 10px rgba(0,0,0,.9),0 0 22px rgba(255,150,40,.95);}
    .dmg--player.dmg--big{color:#ff3b3b;text-shadow:0 2px 10px rgba(0,0,0,.95),0 0 24px rgba(255,30,30,.95);}`;
    document.head.appendChild(st);
  }

  requestAnimationFrame(tick);

  window.DamageNumbers = { pop: pop };
  // Short alias for the engine's hit sites: DN(x, y, damage, kind).
  window.DN = pop;
})();
