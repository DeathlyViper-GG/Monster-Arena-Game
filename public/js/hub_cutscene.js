/* =====================================================================
   hub_cutscene.js — the moment something gives way.

   A seal breaking or a gem coming off the floor is not a toast: the hall
   answers it. Letterbox bars close, a rune seal bursts outward, light
   rays rake the screen and the name of what just happened is struck
   across the middle in Cinzel. It clears itself after a moment.
   ===================================================================== */
(function (G) {
  'use strict';

  let host = null;
  let timer = 0;

  function ensure() {
    const intro = document.getElementById('overlayIntro');
    if (!intro) return null;
    if (!host) {
      host = document.createElement('div');
      host.id = 'hubCut';
      host.className = 'hub-cut';
      intro.appendChild(host);
    }
    return host;
  }

  const sparks = () => {
    let s = '';
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 360;
      s += '<i style="--a:' + a + 'deg;--d:' + (0.5 + (i % 5) * 0.14).toFixed(2) + 's"></i>';
    }
    return s;
  };

  // kind: 'gem' | 'door' | 'reward'
  function play(opts) {
    const h = ensure();
    if (!h) return;
    const o = opts || {};
    const accent = o.accent || '#7dffd0';
    h.innerHTML =
      '<div class="hc-bars"><i></i><i></i></div>' +
      '<div class="hc-stage" style="--c:' + accent + '">' +
        '<div class="hc-rays"></div>' +
        '<div class="hc-ring"></div>' +
        '<div class="hc-ring late"></div>' +
        '<div class="hc-seal"></div>' +
        '<div class="hc-sparks">' + sparks() + '</div>' +
        '<div class="hc-copy">' +
          '<div class="hc-kicker">' + (o.kicker || '') + '</div>' +
          '<div class="hc-title">' + (o.title || '') + '</div>' +
          '<div class="hc-sub">' + (o.sub || '') + '</div>' +
        '</div>' +
      '</div>';
    h.classList.remove('on');
    // restart the animations from zero even if one is already running
    void h.offsetWidth;
    h.classList.add('on');
    clearTimeout(timer);
    timer = setTimeout(() => h.classList.remove('on'), o.hold || 2600);
  }

  // A short, low-key line for things that do not deserve the whole theatre.
  function toast(text, accent) {
    const intro = document.getElementById('overlayIntro');
    if (!intro) return;
    let el = document.getElementById('hubToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hubToast';
      el.className = 'hub-toast';
      intro.appendChild(el);
    }
    el.textContent = text;
    el.style.setProperty('--c', accent || '#8fd4ff');
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('on'), 2400);
  }

  G.HubCutscene = { play, toast };
})(window);
