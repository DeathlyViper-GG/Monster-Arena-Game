// ============================================================
// Monster Arena — Burning screen
// A flamethrower leaves a player on fire. The server owns the burn — how long
// it lasts and the damage it deals — and reports it on every snapshot; this
// file only paints it: the edges of the burning player's screen glow red and
// pulse, with embers licking up the frame while the fire lasts.
// ============================================================
(function () {
  'use strict';

  let el = null;
  let left = 0;        // burn seconds still to paint
  let shown = 0;       // opacity currently on screen
  let last = 0;

  function ensure() {
    if (el) return el;

    const style = document.createElement('style');
    style.textContent = `
      #burnVignette{position:fixed;inset:0;pointer-events:none;z-index:24;display:none;opacity:0;will-change:opacity}
      #burnVignette .bv-glow{position:absolute;inset:0;
        background:
          radial-gradient(120% 95% at 50% 50%, rgba(255,70,20,0) 40%, rgba(255,80,20,.30) 70%, rgba(200,24,0,.72) 100%),
          radial-gradient(60% 42% at 50% 100%, rgba(255,140,40,.45), rgba(255,60,10,0) 70%);
        animation:bvPulse 900ms ease-in-out infinite alternate}
      #burnVignette .bv-heat{position:absolute;inset:0;
        background:radial-gradient(70% 60% at 50% 120%, rgba(255,110,20,.35), rgba(255,60,0,0) 70%);
        animation:bvHeat 1.6s ease-in-out infinite alternate}
      @keyframes bvPulse{from{opacity:.6}to{opacity:1}}
      @keyframes bvHeat{from{transform:translateY(6px) scaleY(.96);opacity:.5}to{transform:translateY(-4px) scaleY(1.06);opacity:.95}}
      #burnVignette .bv-ember{position:absolute;bottom:-14px;border-radius:50%;
        background:radial-gradient(circle,#fff3c4,#ff9a2a 45%,rgba(255,70,10,0) 72%);
        opacity:0;animation:bvRise linear infinite}
      @keyframes bvRise{
        0%{opacity:0;transform:translateY(0) scale(.7)}
        12%{opacity:.95}
        70%{opacity:.6}
        100%{opacity:0;transform:translateY(-58vh) scale(1.5)}}
    `;
    document.head.appendChild(style);

    el = document.createElement('div');
    el.id = 'burnVignette';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="bv-glow"></div><div class="bv-heat"></div>';
    // Embers climb the left and right thirds, so the middle of the screen —
    // where the fight is — stays clear.
    for (let i = 0; i < 18; i++) {
      const e = document.createElement('span');
      e.className = 'bv-ember';
      const side = i % 2 === 0;
      e.style.left = (side ? 2 + Math.random() * 26 : 72 + Math.random() * 26).toFixed(1) + '%';
      e.style.animationDuration = (1.5 + Math.random() * 1.6).toFixed(2) + 's';
      e.style.animationDelay = (-Math.random() * 2.5).toFixed(2) + 's';
      const s = (2 + Math.random() * 3).toFixed(1);
      e.style.width = s + 'px';
      e.style.height = s + 'px';
      el.appendChild(e);
    }
    document.body.appendChild(el);
    return el;
  }

  // burn = seconds of fire the server says this player has left.
  function set(burn) {
    const b = Number(burn) || 0;
    if (!(b > 0)) return;
    ensure();
    left = Math.max(left, b);
  }
  function clear() { left = 0; }

  function loop(t) {
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    if (left > 0) left = Math.max(0, left - dt);

    // Stronger while there is real fire left, fading out over the last moment.
    const target = left > 0 ? Math.min(1, 0.35 + left * 0.16) : 0;
    shown += (target - shown) * Math.min(1, dt * 9);

    if (el) {
      if (shown < 0.01 && target === 0) {
        if (el.style.display !== 'none') { el.style.display = 'none'; shown = 0; }
      } else {
        if (el.style.display === 'none') el.style.display = 'block';
        el.style.opacity = shown.toFixed(3);
      }
    }
    requestAnimationFrame(loop);
  }

  // The authoritative snapshot carries the burn left on every player.
  window.addEventListener('net:snapshot', (ev) => {
    const snap = ev.detail || (window.Net && window.Net.state && window.Net.state.snapshot);
    const peerId = window.Net && window.Net.state ? window.Net.state.peerId : null;
    if (!snap || !peerId || !Array.isArray(snap.players)) return;
    const me = snap.players.find((p) => p && p.id === peerId);
    if (me) set(me.burn);
  });

  window.BurnFx = { set: set, clear: clear };
  requestAnimationFrame(loop);
})();
