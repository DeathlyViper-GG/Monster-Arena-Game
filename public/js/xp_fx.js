// ============================================================
// Monster Arena — XP EFFECTS.
// Two moments that make progress feel earned:
//
// 1. XPFx.claim(button, amount) — a burst of glowing motes and a rising
//    "+N XP" that streams out of the Claim button and arcs up to where the
//    XP toast appears.
// 2. XPFx.levelUp(level) — a slim rank-up tab that drops from the top edge
//    (3D medallion from rank_emblem.js + the new rank's name) and slides away
//    again after a few seconds, so it never covers the match.
// ============================================================
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const rand = (a, b) => a + Math.random() * (b - a);

  let styled = false;
  function css() {
    if (styled) return;
    styled = true;
    const s = document.createElement('style');
    s.id = 'xpFxCSS';
    s.textContent = `
    #xpFxLayer{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:72;}
    .fx-orb{position:absolute;left:0;top:0;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;
      background:radial-gradient(circle at 35% 32%,#fff,#ffd27a 45%,#ff9a3c 76%,rgba(255,154,60,0) 100%);
      box-shadow:0 0 10px rgba(255,200,120,.9),0 0 22px rgba(255,150,60,.5);will-change:transform,opacity;}
    .fx-orb.v{background:radial-gradient(circle at 35% 32%,#fff,#c9b6ff 46%,#8a5cff 78%,rgba(138,92,255,0) 100%);
      box-shadow:0 0 10px rgba(190,150,255,.9),0 0 22px rgba(140,90,255,.45);}
    .fx-glyph{position:absolute;left:0;top:0;font:900 14px/1 system-ui,sans-serif;color:#ffe9c4;
      text-shadow:0 0 12px rgba(255,190,90,.95);will-change:transform,opacity;}
    .fx-amount{position:absolute;left:0;top:0;font:900 24px/1 system-ui,sans-serif;letter-spacing:.02em;white-space:nowrap;
      background:linear-gradient(180deg,#fff,#ffd27a 55%,#ff9a3c);-webkit-background-clip:text;background-clip:text;color:transparent;
      filter:drop-shadow(0 0 16px rgba(255,180,80,.9));will-change:transform,opacity;}
    .fx-ring{position:absolute;left:0;top:0;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;
      border:2px solid rgba(255,214,138,.9);box-shadow:0 0 20px rgba(255,190,90,.65);will-change:transform,opacity;}

    /* -------- rank-up tab: a slim banner that drops from the top edge -------- */
    #lvlTab{position:fixed;left:50%;top:0;z-index:74;pointer-events:none;overflow:hidden;
      display:flex;align-items:center;gap:11px;padding:7px 18px 9px 12px;
      border-radius:0 0 16px 16px;
      background:linear-gradient(180deg,rgba(34,24,10,.96),rgba(11,9,20,.94));
      border:1px solid rgba(255,214,138,.6);border-top:none;
      box-shadow:0 14px 32px rgba(0,0,0,.5),0 0 26px rgba(255,190,90,.3),inset 0 -8px 18px rgba(255,190,90,.1);
      backdrop-filter:blur(7px);
      transform:translate(-50%,-115%);opacity:0;
      transition:transform .55s cubic-bezier(.22,1,.36,1),opacity .35s ease;}
    #lvlTab.show{transform:translate(-50%,0);opacity:1;}
    #lvlTab::after{content:"";position:absolute;left:12px;right:12px;bottom:0;height:1.5px;border-radius:2px;
      background:linear-gradient(90deg,transparent,rgba(255,222,160,.95),transparent);opacity:.85;}
    .lt-medal{flex:0 0 auto;display:flex;filter:drop-shadow(0 0 10px rgba(255,190,90,.55));}
    .lt-body{display:flex;flex-direction:column;gap:1px;line-height:1.15;text-align:left;}
    .lt-kicker{font-size:8.5px;letter-spacing:.34em;text-transform:uppercase;color:#ffd9a0;
      text-shadow:0 0 12px rgba(255,190,90,.8);}
    .lt-title{font-size:14px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;
      background:linear-gradient(180deg,#fff,#ffe4b0 52%,#ff9f3c);-webkit-background-clip:text;background-clip:text;color:transparent;}
    .lt-chip{flex:0 0 auto;font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#ffe9c4;
      padding:3px 9px;border-radius:999px;background:rgba(255,190,90,.14);border:1px solid rgba(255,214,138,.45);}
    @media (max-width:560px){
      #lvlTab{gap:8px;padding:6px 12px 8px 9px;}
      .lt-title{font-size:12px;}
      .lt-chip{display:none;}
    }`;
    document.head.appendChild(s);
  }

  function layer() {
    css();
    let l = document.getElementById('xpFxLayer');
    if (!l) {
      l = document.createElement('div');
      l.id = 'xpFxLayer';
      document.body.appendChild(l);
    }
    return l;
  }

  // ---- claim burst ------------------------------------------------------
  // A fan of glowing motes leaves the button, arcs outward and then streams
  // up to the top of the screen where the XP toast lands, while the amount
  // rises off the card.
  function claim(el, amount) {
    const host = layer();
    const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    const sx = r ? r.left + r.width / 2 : window.innerWidth / 2;
    const sy = r ? r.top + r.height / 2 : window.innerHeight / 2;
    const tx = window.innerWidth / 2;
    const ty = 74;

    // shockwave on the button
    const ring = document.createElement('div');
    ring.className = 'fx-ring';
    ring.style.transform = 'translate(' + sx + 'px,' + sy + 'px)';
    host.appendChild(ring);
    ring.animate([
      { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.35)', opacity: 0.95 },
      { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(3.4)', opacity: 0 }
    ], { duration: 620, easing: 'cubic-bezier(.16,.8,.3,1)' }).onfinish = () => ring.remove();

    // the amount itself
    const num = Math.round(Number(amount) || 0);
    const tag = document.createElement('div');
    tag.className = 'fx-amount';
    tag.textContent = '+' + String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' XP';
    tag.style.transform = 'translate(' + sx + 'px,' + (sy - 6) + 'px) translate(-50%,-50%)';
    host.appendChild(tag);
    tag.animate([
      { transform: 'translate(' + sx + 'px,' + (sy - 6) + 'px) translate(-50%,-50%) scale(.6)', opacity: 0 },
      { transform: 'translate(' + sx + 'px,' + (sy - 26) + 'px) translate(-50%,-50%) scale(1.18)', opacity: 1, offset: 0.28 },
      { transform: 'translate(' + sx + 'px,' + (sy - 96) + 'px) translate(-50%,-50%) scale(1)', opacity: 0 }
    ], { duration: 1150, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = () => tag.remove();

    // motes
    const count = 24;
    for (let i = 0; i < count; i++) {
      const mote = document.createElement('div');
      const violet = i % 4 === 0;
      mote.className = 'fx-orb' + (violet ? ' v' : '');
      host.appendChild(mote);

      const a = rand(0, Math.PI * 2);
      const spread = rand(28, 130);
      const mx = sx + Math.cos(a) * spread;
      const my = sy + Math.sin(a) * spread * 0.75 - rand(10, 70);
      const ex = tx + rand(-46, 46);
      const ey = ty + rand(-14, 26);
      const t = rand(0.85, 1.25);

      const anim = mote.animate([
        { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.4)', opacity: 0 },
        { transform: 'translate(' + (mx * 0.5 + sx * 0.5) + 'px,' + (my * 0.5 + sy * 0.5) + 'px) scale(1)', opacity: 1, offset: 0.24 },
        { transform: 'translate(' + mx + 'px,' + my + 'px) scale(.95)', opacity: 1, offset: 0.45 },
        { transform: 'translate(' + ex + 'px,' + ey + 'px) scale(.22)', opacity: 0 }
      ], { duration: 760 * t, delay: i * 16, easing: 'cubic-bezier(.3,.1,.35,1)', fill: 'forwards' });
      anim.onfinish = () => mote.remove();
    }

    // little ✦ sparkles drifting off the card
    for (let i = 0; i < 6; i++) {
      const g = document.createElement('div');
      g.className = 'fx-glyph';
      g.textContent = i % 2 ? '✦' : '✧';
      host.appendChild(g);
      const gx = sx + rand(-70, 70);
      const gy = sy + rand(-30, 20);
      const anim = g.animate([
        { transform: 'translate(' + gx + 'px,' + gy + 'px) translate(-50%,-50%) scale(.5) rotate(0deg)', opacity: 0 },
        { opacity: 1, offset: 0.3 },
        { transform: 'translate(' + (gx + rand(-40, 40)) + 'px,' + (gy - rand(60, 130)) + 'px) translate(-50%,-50%) scale(1.15) rotate(' + rand(-120, 120) + 'deg)', opacity: 0 }
      ], { duration: rand(850, 1250), delay: 60 + i * 45, easing: 'cubic-bezier(.22,1,.36,1)' });
      anim.onfinish = () => g.remove();
    }
  }

  // ---- rank-up tab ------------------------------------------------------
  // A rank-up is announced by a slim tab that drops from the top edge and
  // slides away again: the match stays visible and playable underneath it.
  let tabEl = null;
  let tabTimer = null;

  function levelUp(level, info) {
    css();

    const EM = window.RankEmblem;
    const lvl = Math.max(1, Math.floor(Number(level) || 1));
    const p = info || (EM && EM.parts ? EM.parts(lvl) : { title: 'Level ' + lvl });
    const art = (EM && EM.render) ? EM.render(p, 34, true) : '<span>✦</span>';

    if (!tabEl) {
      tabEl = document.createElement('div');
      tabEl.id = 'lvlTab';
      document.body.appendChild(tabEl);
    }

    tabEl.innerHTML =
      '<span class="lt-medal">' + art + '</span>' +
      '<span class="lt-body">' +
        '<span class="lt-kicker">Rank up</span>' +
        '<span class="lt-title">' + esc(p.title || ('Level ' + lvl)) + '</span>' +
      '</span>' +
      '<span class="lt-chip">' + (p.secret > 0 ? 'Secret ' + p.secret : 'Lv ' + lvl) + '</span>';

    void tabEl.offsetWidth; // restart the drop when ranks come back to back
    tabEl.classList.add('show');
    clearTimeout(tabTimer);
    tabTimer = setTimeout(function () { tabEl.classList.remove('show'); }, 3800);
  }

  window.XPFx = { claim: claim, levelUp: levelUp };
})();
