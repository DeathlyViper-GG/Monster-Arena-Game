/* BOSS CURSE
   Story runs from wave 5 onward — and the final boss fight — curse the player's
   glyphs: every glyph number the engine applies (damage, damage bonuses, damage
   over time, healing, armour) is halved. Before wave 5 glyphs are untouched. */
(function () {
  var SCALE = 0.5;          // half power
  var active = false;
  var announced = false;
  var hideT = null;

  var CSS = [
    '#bossCurseBanner{position:fixed;inset:0;z-index:4000;display:grid;place-items:center;pointer-events:none;opacity:0;}',
    '#bossCurseBanner.on{animation:bcFade 4.8s ease-out forwards;}',
    '#bossCurseBanner .bc-veil{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%, rgba(105,0,0,.5), rgba(0,0,0,.92) 72%);}',
    '#bossCurseBanner .bc-wrap{position:relative;padding:0 5vw;text-align:center;}',
    '#bossCurseBanner.on .bc-wrap{animation:bcSlam .75s cubic-bezier(.2,1.7,.4,1) forwards;}',
    '#bossCurseBanner .bc-ring{position:absolute;left:50%;top:50%;width:min(72vmin,560px);height:min(72vmin,560px);transform:translate(-50%,-50%);border:2px solid rgba(255,50,30,.32);border-radius:50%;box-shadow:0 0 60px rgba(255,30,10,.25) inset;animation:bcSpin 16s linear infinite;}',
    '#bossCurseBanner .bc-ring.inner{width:min(52vmin,400px);height:min(52vmin,400px);border-style:dashed;border-color:rgba(255,80,40,.28);animation-direction:reverse;animation-duration:11s;}',
    '#bossCurseBanner .bc-title{position:relative;margin:0;font-weight:900;font-size:clamp(26px,7vw,72px);line-height:1.05;letter-spacing:.12em;text-transform:uppercase;color:#ff2a1f;text-shadow:0 0 16px rgba(255,40,20,.9),0 0 60px rgba(255,0,0,.65),0 5px 0 rgba(55,0,0,.95);animation:bcFlicker 1.2s steps(1) infinite;}',
    '#bossCurseBanner .bc-title .bc-ghost{position:absolute;left:0;right:0;top:0;color:rgba(90,220,255,.45);clip-path:inset(0 0 55% 0);animation:bcGlitch 2.4s steps(2) infinite;}',
    '#bossCurseBanner .bc-sub{position:relative;margin-top:16px;font-size:clamp(10px,1.5vw,14px);letter-spacing:.42em;text-transform:uppercase;color:#ffb7ad;opacity:.92;}',
    '@keyframes bcFade{0%{opacity:0}8%{opacity:1}72%{opacity:1}100%{opacity:0}}',
    '@keyframes bcSlam{0%{transform:scale(1.5);filter:blur(6px)}55%{transform:scale(.97);filter:blur(0)}100%{transform:scale(1)}}',
    '@keyframes bcFlicker{0%,100%{opacity:1}42%{opacity:.82}44%{opacity:.35}46%{opacity:1}71%{opacity:.6}73%{opacity:1}}',
    '@keyframes bcGlitch{0%,100%{transform:translate(0,0)}25%{transform:translate(-3px,1px)}50%{transform:translate(3px,-1px)}75%{transform:translate(-2px,-1px)}}',
    '@keyframes bcSpin{to{transform:translate(-50%,-50%) rotate(360deg)}}'
  ].join('');

  function ensureStyles() {
    if (document.getElementById('bossCurseStyles')) return;
    var st = document.createElement('style');
    st.id = 'bossCurseStyles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function banner() {
    var existing = document.getElementById('bossCurseBanner');
    if (existing) return existing;
    ensureStyles();
    var el = document.createElement('div');
    el.id = 'bossCurseBanner';
    el.setAttribute('aria-live', 'assertive');
    el.innerHTML =
      '<div class="bc-veil"></div>' +
      '<div class="bc-wrap">' +
        '<div class="bc-ring"></div><div class="bc-ring inner"></div>' +
        '<h1 class="bc-title">Boss Curse Activated<span class="bc-ghost" aria-hidden="true">Boss Curse Activated</span></h1>' +
        '<div class="bc-sub">Your glyphs are weakened</div>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  function show() {
    var el = banner();
    el.classList.remove('on');
    // restart the animation even if it is still on screen
    void el.offsetWidth;
    el.classList.add('on');
    clearTimeout(hideT);
    hideT = setTimeout(function () { el.classList.remove('on'); }, 4900);
  }

  function activate() {
    if (active) return;
    active = true;
    window.BOSS_CURSE_ACTIVE = true;
    if (!announced) {
      announced = true;
      show();
    }
  }

  function reset() {
    active = false;
    announced = false;
    window.BOSS_CURSE_ACTIVE = false;
    var el = document.getElementById('bossCurseBanner');
    if (el) el.classList.remove('on');
    clearTimeout(hideT);
  }

  window.BossCurse = {
    scale: function () { return active ? SCALE : 1; },
    active: function () { return active; },
    activate: activate,
    reset: reset,
    // Story realms curse the player from wave 5 (the realm's boss wave).
    storyWave: function (n) {
      if (!window.STORY_ACTIVE) return;
      if (Number(n) >= 5) activate();
    },
    // The final boss fight curses the player too, whatever the wave.
    finalBoss: function () { activate(); }
  };
})();
