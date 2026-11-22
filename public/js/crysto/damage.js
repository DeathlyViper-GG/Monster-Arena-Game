/* Crysto — the number a blow takes off.
   Every hit the walker lands reads out over the thing it landed on: a number
   that pops, drifts up a little and fades, in the arena's own damage-number
   type. The numbers live on their own DOM layer above the vale, placed by
   projecting the monster's chest through the walker's own camera, so they sit
   on the target wherever it is on screen. */
(function () {
  const C = (window.Crysto = window.Crysto || {});

  const LIFE = 0.9;      // seconds on screen
  const RISE = 95;       // world units it drifts up over that life
  const MAX_LIVE = 40;

  let layer = null;
  const live = [];
  const pool = [];
  const v = new THREE.Vector3();

  function build() {
    if (layer) return;
    layer = document.createElement('div');
    layer.id = 'cyDmg';
    const st = document.createElement('style');
    st.textContent = [
      '#cyDmg{position:fixed;inset:0;pointer-events:none;z-index:25500;overflow:hidden;}',
      '.cy-dmg{position:absolute;left:0;top:0;white-space:nowrap;',
      'font:900 20px/1 "Arial Black",system-ui,-apple-system,"Segoe UI",sans-serif;',
      'color:#ffe9a8;-webkit-text-stroke:2.5px rgba(8,4,16,.85);paint-order:stroke fill;',
      'text-shadow:0 2px 8px rgba(0,0,0,.85),0 0 16px rgba(255,190,80,.7);',
      'will-change:transform,opacity;}',
      '.cy-dmg.big{font-size:27px;color:#fff2c4;',
      'text-shadow:0 2px 10px rgba(0,0,0,.9),0 0 22px rgba(255,150,40,.95);}'
    ].join('');
    document.head.appendChild(st);
    document.body.appendChild(layer);
  }

  // A blow, read out where it landed.
  C.damage = function (x, y, z, amount) {
    const n = Math.round(Number(amount) || 0);
    if (n <= 0) return;
    build();
    if (live.length >= MAX_LIVE) {
      const old = live.shift();
      old.el.style.display = 'none';
      pool.push(old.el);
    }
    const el = pool.pop() || document.createElement('div');
    el.className = 'cy-dmg' + (n >= 70 ? ' big' : '');
    el.textContent = String(n);
    el.style.display = 'block';
    el.style.opacity = '1';
    if (el.parentNode !== layer) layer.appendChild(el);
    live.push({
      el: el, x: x, y: y, z: z, t: 0,
      dx: (Math.random() - 0.5) * 46, dz: (Math.random() - 0.5) * 46
    });
  };

  // One frame: every number rides up and fades, always facing the walker.
  C.damageTick = function (dt) {
    if (!live.length || !C.camera) return;
    const cam = C.camera;
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = live.length - 1; i >= 0; i--) {
      const d = live[i];
      d.t += dt;
      const k = d.t / LIFE;
      if (k >= 1) {
        d.el.style.display = 'none';
        pool.push(d.el);
        live.splice(i, 1);
        continue;
      }
      v.set(d.x + d.dx * k, d.y + RISE * k, d.z + d.dz * k).project(cam);
      if (v.z > 1) { d.el.style.opacity = '0'; continue; }
      const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
      d.el.style.opacity = String(k < 0.6 ? 1 : (1 - k) / 0.4);
      d.el.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0)' +
        ' translate(-50%,-50%) scale(' + (1 + 0.24 * (1 - k)).toFixed(3) + ')';
    }
  };

  // A restart drops every number that was still in the air.
  C.damageClear = function () {
    live.forEach((d) => { d.el.style.display = 'none'; pool.push(d.el); });
    live.length = 0;
  };
})();
