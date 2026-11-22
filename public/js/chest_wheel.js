/* =====================================================================
   chest_wheel.js — the roulette a chest spins before it gives anything up.

   Both chest families (the utility chests and the melee chests) call this
   the moment one is paid for. The wheel is cut into the chest's own rarity
   odds, each slice painted in that rarity's colour, and every slice carries
   a silhouette sized by how rare it is — a potion for the utility chests, a
   blade for the melee chests — bigger and brighter the higher the tier.

   Nothing on the wheel names an item: it only ever says how rare the thing
   about to arrive is. The wheel eases to a stop on the rarity the chest
   already rolled, holds it for a beat, and then hands back to the caller,
   which reveals the actual weapon or utility.

   G.ChestWheel.play({
     kind: 'util' | 'melee',        // which silhouette sits on the slices
     title: 'Gold Chest',
     accent: '#ffe08a',             // chest rim colour
     order: ['common', ...],        // rarity order, low to high
     weights: { common: 28, ... },  // the chest's own odds
     rarity: { common: { name, color }, ... },
     winner: 'monster',             // the rarity that was rolled
     done: () => {}                 // called once the wheel has settled
   });
   ===================================================================== */
(function (G) {
  'use strict';

  const TAU = Math.PI * 2;

  let host = null, cv = null, ctx = null, titleEl = null, resEl = null;
  let run = null, raf = 0, cssDone = false;

  /* ---------------------------------------------------------------- CSS */
  function injectCSS() {
    if (cssDone) return;
    cssDone = true;
    const s = document.createElement('style');
    s.textContent = `
    .cwWrap{position:fixed;inset:0;z-index:150;display:none;
      background:radial-gradient(circle at 50% 44%,rgba(38,20,72,.9),rgba(2,2,8,.96));
      -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-family:inherit;}
    .cwWrap.on{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;}
    .cwHead{font-size:11.5px;letter-spacing:.3em;text-transform:uppercase;color:#d3c7ff;opacity:.92;
      text-shadow:0 0 20px rgba(160,120,255,.9);}
    .cwStage{position:relative;line-height:0;filter:drop-shadow(0 26px 56px rgba(0,0,0,.75));}
    .cwStage canvas{display:block;}
    .cwResult{min-height:28px;font-family:var(--font-heading,Georgia,serif);font-weight:600;
      font-size:22px;letter-spacing:.18em;text-transform:uppercase;
      opacity:0;transform:translateY(8px);transition:opacity .3s ease,transform .3s ease;}
    .cwWrap.landed .cwResult{opacity:1;transform:translateY(0);text-shadow:0 0 28px currentColor;}
    @media (max-width:520px){ .cwResult{font-size:18px;} }`;
    document.head.appendChild(s);
  }

  function ensureHost() {
    if (host && host.isConnected) return host;
    host = document.createElement('div');
    host.id = 'cwWheel';
    host.className = 'cwWrap';
    host.innerHTML =
      '<div class="cwHead" id="cwTitle">Opening</div>' +
      '<div class="cwStage"><canvas id="cwCanvas"></canvas></div>' +
      '<div class="cwResult" id="cwResult"></div>';
    document.body.appendChild(host);
    cv = host.querySelector('#cwCanvas');
    ctx = cv.getContext('2d');
    titleEl = host.querySelector('#cwTitle');
    resEl = host.querySelector('#cwResult');
    return host;
  }

  /* -------------------------------------------------------------- colour */
  function shade(hex, k) {
    const n = parseInt(String(hex || '#9fb4c9').replace('#', ''), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = k > 0 ? 255 : 0, p = Math.abs(k);
    r = Math.round(r + (t - r) * p);
    g = Math.round(g + (t - g) * p);
    b = Math.round(b + (t - b) * p);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* --------------------------------------------------------------- icons
     Two silhouettes only: a potion for the utilities, a blade for melee.
     Neither is a real item — the wheel never spoils what is inside. */
  function flaskPath(c, w, h) {
    c.beginPath();
    c.moveTo(-w * 0.26, -h * 0.44);
    c.lineTo(-w * 0.26, -h * 0.08);
    c.bezierCurveTo(-w * 0.68, 0, -w * 0.62, h * 0.5, 0, h * 0.5);
    c.bezierCurveTo(w * 0.62, h * 0.5, w * 0.68, 0, w * 0.26, -h * 0.08);
    c.lineTo(w * 0.26, -h * 0.44);
    c.closePath();
  }

  function potion(c, u, col) {
    const w = u * 0.82, h = u * 1.72;
    c.save();
    flaskPath(c, w, h);
    c.fillStyle = 'rgba(16,12,26,.6)';
    c.fill();
    c.save();
    flaskPath(c, w, h);
    c.clip();
    const g = c.createLinearGradient(0, h * 0.02, 0, h * 0.5);
    g.addColorStop(0, col);
    g.addColorStop(1, '#ffffff');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-w, h * 0.18);
    c.quadraticCurveTo(-w * 0.3, h * 0.06, 0, h * 0.18);
    c.quadraticCurveTo(w * 0.3, h * 0.3, w, h * 0.14);
    c.lineTo(w, h);
    c.lineTo(-w, h);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)';
    c.beginPath();
    c.ellipse(-w * 0.24, h * 0.26, w * 0.13, h * 0.09, -0.5, 0, TAU);
    c.fill();
    c.restore();
    flaskPath(c, w, h);
    c.strokeStyle = 'rgba(255,255,255,.92)';
    c.lineWidth = Math.max(1, u * 0.085);
    c.stroke();
    // cork
    c.fillStyle = col;
    c.beginPath();
    if (c.roundRect) c.roundRect(-w * 0.3, -h * 0.6, w * 0.6, h * 0.2, 2);
    else c.rect(-w * 0.3, -h * 0.6, w * 0.6, h * 0.2);
    c.fill();
    c.restore();
  }

  function blade(c, u, col) {
    const w = u * 0.34, h = u * 1.9;
    c.save();
    // blade
    c.beginPath();
    c.moveTo(0, -h * 0.62);
    c.lineTo(w, -h * 0.12);
    c.lineTo(w * 0.66, h * 0.14);
    c.lineTo(-w * 0.66, h * 0.14);
    c.lineTo(-w, -h * 0.12);
    c.closePath();
    const g = c.createLinearGradient(-w, -h * 0.5, w, h * 0.1);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.42, col);
    g.addColorStop(1, 'rgba(255,255,255,.92)');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,.85)';
    c.lineWidth = Math.max(1, u * 0.06);
    c.stroke();
    // fuller
    c.beginPath();
    c.moveTo(0, -h * 0.5);
    c.lineTo(0, h * 0.08);
    c.strokeStyle = 'rgba(255,255,255,.7)';
    c.lineWidth = Math.max(1, u * 0.05);
    c.stroke();
    // guard
    c.fillStyle = col;
    c.beginPath();
    if (c.roundRect) c.roundRect(-w * 1.55, h * 0.13, w * 3.1, u * 0.16, 3);
    else c.rect(-w * 1.55, h * 0.13, w * 3.1, u * 0.16);
    c.fill();
    // grip
    c.fillStyle = 'rgba(28,22,40,.95)';
    c.fillRect(-w * 0.3, h * 0.24, w * 0.6, u * 0.46);
    // pommel
    c.beginPath();
    c.arc(0, h * 0.76, u * 0.17, 0, TAU);
    c.fillStyle = col;
    c.fill();
    c.restore();
  }

  /* --------------------------------------------------------------- wheel */
  function draw(s) {
    const W = s.size;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, W, W);
    const cx = W / 2, cy = W / 2, R = W / 2 - 14;

    // soft violet haze behind the disc
    const haze = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.02);
    haze.addColorStop(0, 'rgba(130,90,230,.24)');
    haze.addColorStop(1, 'rgba(10,6,20,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, W);

    // slices
    for (const sg of s.segs) {
      const a0 = sg.a0 + s.angle, a1 = sg.a1 + s.angle;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a1);
      ctx.closePath();
      const g = ctx.createRadialGradient(cx, cy, R * 0.14, cx, cy, R);
      g.addColorStop(0, shade(sg.color, -0.58));
      g.addColorStop(0.72, shade(sg.color, -0.3));
      g.addColorStop(1, shade(sg.color, 0.1));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(6,4,12,.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // silhouettes
    for (const sg of s.segs) {
      const mid = (sg.a0 + sg.a1) / 2 + s.angle;
      ctx.save();
      ctx.translate(cx + Math.cos(mid) * R * 0.66, cy + Math.sin(mid) * R * 0.66);
      ctx.rotate(mid + Math.PI / 2);
      ctx.shadowColor = sg.color;
      ctx.shadowBlur = 14;
      const u = R * 0.132 * sg.scale;
      if (s.kind === 'melee') blade(ctx, u, sg.color);
      else potion(ctx, u, sg.color);
      ctx.restore();
    }

    // rim
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.lineWidth = 6;
    ctx.strokeStyle = s.accent;
    ctx.shadowColor = s.accent;
    ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // studs around the rim
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * (R - 11), cy + Math.sin(a) * (R - 11), 2.4, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,.38)';
      ctx.fill();
    }

    // hub
    const hub = ctx.createRadialGradient(cx - 7, cy - 9, 2, cx, cy, R * 0.18);
    hub.addColorStop(0, '#fff8dd');
    hub.addColorStop(0.55, s.accent);
    hub.addColorStop(1, '#241634');
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.18, 0, TAU);
    ctx.fillStyle = hub;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.stroke();

    // pointer, fixed at the top
    ctx.save();
    ctx.translate(cx, cy - R);
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.lineTo(-13, -10);
    ctx.lineTo(13, -10);
    ctx.closePath();
    ctx.fillStyle = s.accent;
    ctx.shadowColor = s.accent;
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.restore();

    // the landing ring
    if (s.flash > 0) {
      const grow = 1 - s.flash;
      ctx.save();
      ctx.globalAlpha = Math.min(1, s.flash * 1.1);
      ctx.beginPath();
      ctx.arc(cx, cy, R * (1.02 + grow * 0.3), 0, TAU);
      ctx.lineWidth = 2 + s.flash * 10;
      ctx.strokeStyle = s.winnerColor;
      ctx.stroke();
      ctx.restore();
    }
  }

  function close() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (host) host.classList.remove('on', 'landed');
    run = null;
  }

  function frame(ts) {
    raf = 0;
    const s = run;
    if (!s) return;
    if (!s.t0) s.t0 = ts;
    const el = ts - s.t0;

    if (el < s.spinMs) {
      const p = el / s.spinMs;
      s.angle = s.a0 + (s.a1 - s.a0) * (1 - Math.pow(1 - p, 4));
    } else {
      if (!s.landed) {
        s.landed = ts;
        s.flash = 1;
        resEl.textContent = s.winnerName;
        resEl.style.color = s.winnerColor;
        host.classList.add('landed');
      }
      s.angle = s.a1;
      s.flash = Math.max(0, 1 - (el - s.spinMs) / 620);
      if (el > s.spinMs + s.holdMs && !s.doneCalled) {
        s.doneCalled = true;
        const done = s.done;
        close();
        try { if (done) done(); } catch (e) {}
        return;
      }
    }
    draw(s);
    raf = requestAnimationFrame(frame);
  }

  function play(opts) {
    if (!opts) return;
    injectCSS();
    ensureHost();
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    run = null;

    const order = (opts.order || []).slice();
    const weights = opts.weights || {};
    const RAR = opts.rarity || {};

    // Every rarity the chest can roll, plus the winner itself in case the
    // chest stepped down to a tier its own odds never list.
    const keys = order.filter((k) => (weights[k] || 0) > 0);
    if (keys.indexOf(opts.winner) < 0) keys.push(opts.winner);
    keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    const raw = keys.map((k) => Math.max(8, weights[k] || 8));
    const total = raw.reduce((a, b) => a + b, 0) || 1;
    const segs = [];
    let acc = 0;
    keys.forEach((k, i) => {
      const span = (raw[i] / total) * TAU;
      const rank = Math.max(0, order.indexOf(k));
      segs.push({
        key: k,
        a0: acc,
        a1: acc + span,
        span,
        color: (RAR[k] || {}).color || '#9fb4c9',
        name: (RAR[k] || {}).name || k,
        // rarer slices carry a bigger, brighter icon
        scale: 0.72 + rank * 0.13
      });
      acc += span;
    });

    const win = segs.find((sg) => sg.key === opts.winner) || segs[0];
    const mid = (win.a0 + win.a1) / 2;
    const pointer = -Math.PI / 2;
    const jitter = (Math.random() - 0.5) * win.span * 0.5;
    const turns = 4 + Math.floor(Math.random() * 3);
    const a1 = pointer - mid - jitter + TAU * turns;

    const size = Math.max(220, Math.min(420, Math.floor(Math.min(window.innerWidth * 0.84, window.innerHeight * 0.6))));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.style.width = size + 'px';
    cv.style.height = size + 'px';
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);

    run = {
      kind: opts.kind === 'melee' ? 'melee' : 'util',
      segs,
      angle: 0,
      a0: 0,
      a1,
      spinMs: 2500,
      holdMs: 800,
      size,
      dpr,
      accent: opts.accent || '#ffd27a',
      winnerColor: win.color,
      winnerName: win.name,
      done: opts.done,
      t0: 0,
      flash: 0,
      landed: 0,
      doneCalled: false
    };

    titleEl.textContent = opts.title ? ('Opening ' + opts.title) : 'Opening';
    resEl.textContent = '';
    resEl.style.color = '';
    host.classList.remove('landed');
    host.classList.add('on');
    draw(run);
    raf = requestAnimationFrame(frame);
  }

  G.ChestWheel = { play };
})(window);
