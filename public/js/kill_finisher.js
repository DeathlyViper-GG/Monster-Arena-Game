// ============================================================
// Monster Arena — FINISHERS + KILL FEED.
// When a player dies in an online match the server reports who landed the last
// blow, with what weapon, and where the body fell. This module turns that into
// a short cinematic finisher on the spot (shockwaves, a weapon slash, a soul
// lifting away) and a kill-feed tab reading killer → weapon → victim.
//
// The finisher also fires when a body simply stops being alive, so any
// transport still gets the spectacle.
//
// Exposes window.KillFeed.
// ============================================================
(function () {
  'use strict';

  const FIN_MS = 1150;      // finisher lifetime (ms)
  const FEED_MS = 6500;     // how long a kill tab stays up
  const FEED_MAX = 4;       // tabs kept on screen at once

  injectCSS();

  const layer = document.createElement('div');
  layer.id = 'kfLayer';
  document.body.appendChild(layer);

  const bars = document.createElement('div');
  bars.id = 'kfBars';
  bars.innerHTML = '<div class="t"></div><div class="b"></div>';
  document.body.appendChild(bars);

  const feed = document.createElement('div');
  feed.id = 'killFeed';
  document.body.appendChild(feed);

  const covered = new Map();   // victim name -> time its kill was announced
  // The blow that ended the local player, kept so the death screen can say who
  // landed it and with what.
  let lastOnMe = null;

  function myName() {
    try {
      const st = window.Net && window.Net.state;
      if (!st) return '';
      const snap = st.snapshot;
      const me = snap && Array.isArray(snap.players) ? snap.players.find((p) => p.id === st.peerId) : null;
      return me ? (me.name || '') : '';
    } catch (_) { return ''; }
  }
  const wasDead = new Map();   // player id -> was dead on the previous snapshot
  let barsTimer = null;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function threeScene() {
    const R = window.Render3D;
    if (!R || !R.ok || !R.F) return null;
    const c3 = document.getElementById('game3d');
    if (c3 && c3.style.display === 'none') return null;
    return R;
  }

  // Same dual projection the damage numbers and nameplates use.
  function project(x, y, h) {
    const three = threeScene();
    if (three) {
      try {
        const p = three.w2s(x, y, (h || 0) + three.groundY(x, y));
        if (p && isFinite(p.x) && isFinite(p.y)) return p;
      } catch (_) { /* fall through to the top-down camera */ }
    }
    const me = window.__pvePlayer ? window.__pvePlayer() : null;
    const px = me ? me.x : x, pz = me ? me.y : y;
    return { x: x - px + window.innerWidth / 2, y: y - pz + window.innerHeight / 2 - (h || 0) };
  }

  // Each weapon family strikes in its own colour.
  function accent(weapon) {
    const w = String(weapon || '').toLowerCase();
    if (/melee|blade|sword|dagger|axe|hammer|scythe|katana/.test(w)) return '#ff3b3b';
    if (/shotgun|bomb|blast|boom/.test(w)) return '#ff8a2a';
    if (/sniper|rail|bow|cross/.test(w)) return '#8bffb0';
    if (/rifle/.test(w)) return '#5ad2ff';
    if (/claw|attack|hazard|lava|void|dark/.test(w)) return '#c066ff';
    return '#ffd76a';
  }

  function cinematic(on) {
    bars.classList.toggle('on', on);
    clearTimeout(barsTimer);
    if (on) barsTimer = setTimeout(() => bars.classList.remove('on'), 1000);
  }

  function finisher(x, y, info) {
    if (typeof x !== 'number' || typeof y !== 'number') return;
    const p = project(x, y, 24);
    if (!p || !isFinite(p.x) || !isFinite(p.y)) return;
    if (p.x < -80 || p.x > window.innerWidth + 80 || p.y < -80 || p.y > window.innerHeight + 80) return;

    const el = document.createElement('div');
    el.className = 'kf-fin';
    el.style.left = Math.round(p.x) + 'px';
    el.style.top = Math.round(p.y) + 'px';
    el.style.setProperty('--kf', accent(info.weapon));

    const credit = info.killer
      ? '<span class="kf-kill-k">' + esc(info.killer) + '</span>' +
        (info.weapon ? '<span class="kf-arrow">▸</span><span class="kf-kill-w">' + esc(info.weapon) + '</span>' : '') +
        '<span class="kf-arrow">▸</span>'
      : '<span class="kf-kill-tag">ELIMINATED</span>';

    el.innerHTML =
      '<div class="kf-shock"></div>' +
      '<div class="kf-shock kf-shock--2"></div>' +
      '<div class="kf-shock kf-shock--3"></div>' +
      '<div class="kf-flash"></div>' +
      '<div class="kf-blade"></div>' +
      '<div class="kf-blade kf-blade--2"></div>' +
      '<div class="kf-wisp"></div>' +
      '<div class="kf-slam">' + credit + '<span class="kf-kill-v">' + esc(info.victim) + '</span></div>';

    layer.appendChild(el);
    cinematic(true);
    setTimeout(() => el.remove(), FIN_MS + 250);
  }

  function tab(info) {
    const row = document.createElement('div');
    row.className = 'kf-row';
    row.style.setProperty('--kf', accent(info.weapon));
    row.innerHTML =
      '<span class="kf-k">' + esc(info.killer || 'Unknown') + '</span>' +
      '<span class="kf-arrow">▸</span>' +
      '<span class="kf-w">' + esc(info.weapon || '—') + '</span>' +
      '<span class="kf-arrow">▸</span>' +
      '<span class="kf-v">' + esc(info.victim) + '</span>';
    feed.appendChild(row);
    while (feed.children.length > FEED_MAX) feed.removeChild(feed.firstChild);
    setTimeout(() => { row.classList.add('out'); setTimeout(() => row.remove(), 460); }, FEED_MS);
  }

  function announce(info) {
    if (!info || !info.victim) return;
    covered.set(info.victim, Date.now());
    tab(info);
    finisher(info.x, info.y, info);
  }

  window.addEventListener('net:snapshot', (ev) => {
    const snap = ev && ev.detail;
    if (!snap) return;

    if (Array.isArray(snap.kills)) {
      const me = myName();
      for (const k of snap.kills) {
        if (!k) continue;
        if (me && k.v === me) lastOnMe = { k: k.k || '', w: k.w || '', at: Date.now() };
        announce({ killer: k.k || '', weapon: k.w || '', victim: k.v || 'Player', x: k.x, y: k.y });
      }
    }

    // Fallback: a player who stops being alive still gets the finisher, even
    // from a transport that carries no kill records.
    if (Array.isArray(snap.players)) {
      for (const p of snap.players) {
        if (!p || !p.id) continue;
        const dead = !!p.dead;
        const before = wasDead.get(p.id) || false;
        wasDead.set(p.id, dead);
        if (!dead || before) continue;
        const just = covered.get(p.name);
        if (just && Date.now() - just < 2500) continue;
        finisher(p.x, p.y, { killer: '', weapon: '', victim: p.name || 'Player' });
      }
    }
  });

  function injectCSS() {
    const st = document.createElement('style');
    st.id = 'killFinisherCSS';
    st.textContent = `
    #kfLayer{position:fixed;inset:0;pointer-events:none;z-index:34;overflow:hidden;}
    .kf-fin{position:absolute;width:0;height:0;}
    .kf-fin > *{position:absolute;left:0;top:0;}

    /* --- shockwaves --- */
    .kf-shock{width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;
      border:3px solid var(--kf);box-shadow:0 0 22px var(--kf),inset 0 0 18px var(--kf);
      opacity:0;animation:kfShock .62s cubic-bezier(.16,.9,.3,1) forwards;}
    .kf-shock--2{animation-delay:.1s;border-width:2px;}
    .kf-shock--3{animation-delay:.22s;border-width:1px;}
    @keyframes kfShock{0%{opacity:.95;transform:scale(.15)}70%{opacity:.5}100%{opacity:0;transform:scale(4.4)}}

    /* --- core flash --- */
    .kf-flash{width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;
      background:radial-gradient(circle,#fff 0%,var(--kf) 34%,rgba(0,0,0,0) 70%);
      animation:kfFlash .42s ease-out forwards;}
    @keyframes kfFlash{0%{opacity:0;transform:scale(.2)}22%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.9)}}

    /* --- weapon slash --- */
    .kf-blade{width:230px;height:5px;margin:-2.5px 0 0 -115px;transform-origin:50% 50%;
      background:linear-gradient(90deg,rgba(255,255,255,0) 0%,#fff 42%,var(--kf) 60%,rgba(255,255,255,0) 100%);
      filter:drop-shadow(0 0 12px var(--kf));border-radius:4px;
      animation:kfBlade .5s cubic-bezier(.2,.8,.25,1) forwards;transform:rotate(-26deg) scaleX(.05);}
    .kf-blade--2{animation-delay:.12s;transform:rotate(32deg) scaleX(.05);height:3px;opacity:.85;}
    @keyframes kfBlade{0%{opacity:0;transform:rotate(-26deg) scaleX(.05)}
      26%{opacity:1}100%{opacity:0;transform:rotate(-26deg) scaleX(1.5)}}

    /* --- soul leaving the body --- */
    .kf-wisp{width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;
      background:radial-gradient(circle,#fff 0%,var(--kf) 45%,rgba(0,0,0,0) 72%);
      box-shadow:0 0 22px var(--kf);
      animation:kfWisp 1.05s ease-out forwards;}
    @keyframes kfWisp{0%{opacity:0;transform:translateY(0) scale(.5)}
      25%{opacity:1}100%{opacity:0;transform:translateY(-118px) scale(1.5)}}

    /* --- credit slam --- */
    .kf-slam{display:flex;align-items:center;gap:7px;white-space:nowrap;
      transform:translate(-50%,0);
      font:900 15px/1 "Arial Black",system-ui,-apple-system,"Segoe UI",sans-serif;
      letter-spacing:.04em;padding:6px 12px;border-radius:10px;
      background:linear-gradient(180deg,rgba(10,7,18,.88),rgba(4,2,10,.86));
      border:1px solid var(--kf);box-shadow:0 0 26px rgba(0,0,0,.7),0 0 20px var(--kf);
      animation:kfSlam 1.1s ease-out forwards;}
    .kf-kill-k{color:#fff;text-shadow:0 0 12px var(--kf);}
    .kf-kill-w{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#0b0714;
      background:var(--kf);padding:2px 7px;border-radius:999px;}
    .kf-kill-v{color:#ff8f8f;text-decoration:line-through;text-decoration-thickness:2px;
      text-decoration-color:rgba(255,50,50,.9);}
    .kf-kill-tag{font-size:11px;letter-spacing:.22em;color:var(--kf);}
    @keyframes kfSlam{
      0%{opacity:0;transform:translate(-50%,14px) scale(1.45);filter:blur(8px)}
      16%{opacity:1;transform:translate(-50%,-16px) scale(1);filter:blur(0)}
      72%{opacity:1;transform:translate(-50%,-20px) scale(1)}
      100%{opacity:0;transform:translate(-50%,-34px) scale(1)}}

    /* --- cinematic letterbox --- */
    #kfBars{position:fixed;inset:0;pointer-events:none;z-index:33;}
    #kfBars div{position:absolute;left:0;width:100%;height:8vh;background:#000;
      transition:transform .18s ease-out;}
    #kfBars .t{top:0;transform:translateY(-100%);}
    #kfBars .b{bottom:0;transform:translateY(100%);}
    #kfBars.on div{transform:translateY(0);}

    /* --- kill feed tabs --- */
    #killFeed{position:fixed;top:64px;right:10px;z-index:36;display:flex;flex-direction:column;
      gap:6px;align-items:flex-end;pointer-events:none;}
    .kf-row{display:flex;align-items:center;gap:7px;padding:7px 12px;border-radius:10px;
      background:linear-gradient(180deg,rgba(14,10,24,.95),rgba(6,4,12,.93));
      border:1px solid rgba(255,255,255,.12);border-left:3px solid var(--kf);
      box-shadow:0 6px 20px rgba(0,0,0,.55),0 0 16px var(--kf);
      animation:kfIn .34s cubic-bezier(.2,1,.3,1) both;}
    .kf-row.out{animation:kfOut .44s ease-in forwards;}
    .kf-k{font:900 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;color:#fff;letter-spacing:.02em;}
    .kf-w{font:800 10px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;
      color:#0b0714;background:var(--kf);padding:3px 7px;border-radius:999px;white-space:nowrap;}
    .kf-v{font:800 13px/1 system-ui,sans-serif;color:#ff9a9a;
      text-decoration:line-through;text-decoration-color:rgba(255,60,60,.85);}
    .kf-arrow{font-size:9px;color:rgba(255,255,255,.35);}
    @keyframes kfIn{from{opacity:0;transform:translateX(46px) skewX(-8deg)}to{opacity:1;transform:none}}
    @keyframes kfOut{to{opacity:0;transform:translateX(40px) scale(.96)}}

    @media (max-width:760px){
      .kf-slam{font-size:12px;padding:5px 9px;}
      #killFeed{top:auto;bottom:150px;right:8px;}
      .kf-row{padding:6px 9px;gap:5px;}
      .kf-k,.kf-v{font-size:11px;}
    }`;
    document.head.appendChild(st);
  }

  window.KillFeed = {
    announce,
    // Who last killed the local player, and with what (null when the arena
    // never said — a hazard, or a blow from before the kill feed existed).
    lastOnMe: () => lastOnMe
  };
})();
