/* Crysto — the traveller's HUD: the vigil, the way ahead, the words spoken and
   the hands you play with. */
(function () {
  const C = (window.Crysto = window.Crysto || {});
  const els = {};
  let root = null;
  let lines = [], lineIdx = 0, after = null, typingTimer = null, typingText = '';
  let bannerTimer = null;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  const touch = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  function build() {
    if (root) return root;
    root = el('div', 'cy-hud');

    const top = el('div', 'cy-top');
    const quest = el('div', 'cy-quest');
    els.qTitle = el('div', 'cy-qt', 'The Sunstone Vigil');
    els.qObj = el('div', 'cy-qo', '');
    els.qDist = el('div', 'cy-qd', '');
    quest.appendChild(els.qTitle);
    quest.appendChild(els.qObj);
    quest.appendChild(els.qDist);

    // One bar, the way the arena reads a life: a track, a fill and the count.
    els.hearts = el('div', 'cy-hp');
    const hpTrack = el('div', 'cy-hp-track');
    els.hpFill = el('i', 'cy-hp-fill');
    els.hpText = el('span', 'cy-hp-text', '');
    hpTrack.appendChild(els.hpFill);
    els.hearts.appendChild(hpTrack);
    els.hearts.appendChild(els.hpText);
    top.appendChild(quest);
    top.appendChild(els.hearts);

    // A way back to the beginning, kept where the vigil is read. Two taps, so a
    // stray touch on a tablet never wipes a run.
    els.reset = el('button', 'cy-reset', 'Restart progress');
    els.reset.type = 'button';
    els.reset.addEventListener('click', (e) => {
      e.stopPropagation();
      if (els.reset.classList.contains('arm')) {
        els.reset.textContent = 'Erasing…';
        if (C.resetProgress) C.resetProgress();
        return;
      }
      els.reset.classList.add('arm');
      els.reset.textContent = 'Tap again to erase';
      clearTimeout(els.reset._t);
      els.reset._t = setTimeout(() => {
        els.reset.classList.remove('arm');
        els.reset.textContent = 'Restart progress';
      }, 3200);
    });
    top.appendChild(els.reset);
    root.appendChild(top);

    els.compass = el('div', 'cy-compass');
    els.needle = el('span', 'cy-needle', '▲');
    els.cDist = el('span', 'cy-cdist', '');
    els.compass.appendChild(els.needle);
    els.compass.appendChild(els.cDist);
    root.appendChild(els.compass);

    // the aim point, and the bars a film played inside the world wears
    els.cross = el('div', 'cy-cross');
    root.appendChild(els.cross);
    els.scope = el('div', 'cy-scope');
    els.scope.innerHTML = '<div class="cy-scope-h"></div><div class="cy-scope-v"></div>';
    root.appendChild(els.scope);
    els.cine = el('div', 'cy-cine');
    els.cine.appendChild(el('div', 'cy-cine-bar top'));
    els.cine.appendChild(el('div', 'cy-cine-bar bot'));
    root.appendChild(els.cine);

    els.prompt = el('div', 'cy-prompt');
    root.appendChild(els.prompt);

    els.banner = el('div', 'cy-banner');
    els.bTitle = el('div', 'cy-bt', '');
    els.bSub = el('div', 'cy-bs', '');
    els.banner.appendChild(els.bTitle);
    els.banner.appendChild(els.bSub);
    root.appendChild(els.banner);

    els.dialogue = el('div', 'cy-dialogue');
    els.who = el('div', 'cy-who', '');
    els.line = el('div', 'cy-line', '');
    els.next = el('div', 'cy-next', 'Continue ▸');
    els.dialogue.appendChild(els.who);
    els.dialogue.appendChild(els.line);
    els.dialogue.appendChild(els.next);
    els.dialogue.addEventListener('click', (e) => { e.stopPropagation(); advance(); });
    root.appendChild(els.dialogue);

    els.choose = el('div', 'cy-choose');
    root.appendChild(els.choose);

    // ---- what is in your hands ----
    els.arms = el('div', 'cy-arms');
    // the arena's own sprite art of the weapon in hand, drawn beside its name
    els.armsImg = el('img', 'cy-armimg');
    els.armsImg.alt = '';
    els.armsName = el('div', 'cy-an', 'Bare Knuckles');
    els.armsAmmo = el('div', 'cy-aa', '');
    els.armsText = el('div', 'cy-armtxt');
    els.armsText.appendChild(els.armsName);
    els.armsText.appendChild(els.armsAmmo);
    els.arms.appendChild(els.armsImg);
    els.arms.appendChild(els.armsText);
    root.appendChild(els.arms);

    // ---- a sanctum's guardian ----
    els.boss = el('div', 'cy-boss');
    els.bossName = el('div', 'cy-bn', '');
    els.bossMove = el('div', 'cy-bm', '');
    const bossTrack = el('div', 'cy-bt-track');
    els.bossFill = el('i', 'cy-bf');
    bossTrack.appendChild(els.bossFill);
    els.boss.appendChild(els.bossName);
    els.boss.appendChild(els.bossMove);
    els.boss.appendChild(bossTrack);
    root.appendChild(els.boss);

    els.save = el('div', 'cy-save', 'progress saved');
    root.appendChild(els.save);

    els.hint = el('div', 'cy-hint',
      'WASD move · Shift dash · Space jump · click to strike · right-click to aim · Q swap arms · R reload · E to act · Esc to leave Crysto');
    root.appendChild(els.hint);

    // ---- hands ----
    const hands = el('div', 'cy-hands');
    els.stick = el('div', 'cy-stick');
    els.knob = el('i', 'cy-knob');
    els.stick.appendChild(els.knob);
    hands.appendChild(els.stick);

    els.atk = el('button', 'cy-btn cy-atk', '⚔');
    els.use = el('button', 'cy-btn cy-use', 'E');
    els.dash = el('button', 'cy-btn cy-dash', '⇧');
    els.jump = el('button', 'cy-btn cy-jump', '↑');
    els.atk.type = 'button';
    els.use.type = 'button';
    els.dash.type = 'button';
    els.jump.type = 'button';
    hands.appendChild(els.atk);
    hands.appendChild(els.use);
    hands.appendChild(els.dash);
    hands.appendChild(els.jump);
    root.appendChild(hands);

    if (!touch()) hands.style.display = 'none';

    document.body.appendChild(root);
    wireStick();
    els.atk.addEventListener('click', (e) => { e.stopPropagation(); if (C.onAttack) C.onAttack(); });
    els.use.addEventListener('click', (e) => { e.stopPropagation(); if (C.onUse) C.onUse(); });
    els.dash.addEventListener('click', (e) => { e.stopPropagation(); if (C.onDash) C.onDash(); });
    els.jump.addEventListener('click', (e) => { e.stopPropagation(); if (C.onJump) C.onJump(); });
    return root;
  }

  const stick = { x: 0, y: 0, active: false };

  function wireStick() {
    let id = null, cx = 0, cy = 0;
    const start = (e) => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      id = t.identifier === undefined ? 'mouse' : t.identifier;
      const r = els.stick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      stick.active = true;
      move(e);
    };
    const move = (e) => {
      if (!stick.active) return;
      const t = e.changedTouches
        ? Array.from(e.changedTouches).find((c) => (c.identifier === undefined ? 'mouse' : c.identifier) === id)
        : e;
      if (!t) return;
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const r = els.stick.clientWidth / 2 || 60;
      const len = Math.hypot(dx, dy) || 1;
      if (len > r) { dx = (dx / len) * r; dy = (dy / len) * r; }
      stick.x = dx / r;
      stick.y = dy / r;
      els.knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      e.preventDefault();
    };
    const end = () => {
      stick.active = false;
      stick.x = stick.y = 0;
      els.knob.style.transform = 'translate(0,0)';
    };
    els.stick.addEventListener('touchstart', start, { passive: false });
    els.stick.addEventListener('touchmove', move, { passive: false });
    els.stick.addEventListener('touchend', end);
    els.stick.addEventListener('touchcancel', end);
    els.stick.addEventListener('mousedown', start);
    window.addEventListener('mousemove', (e) => { if (stick.active) move(e); });
    window.addEventListener('mouseup', end);
  }

  // The pit's reticle markup, exactly as render3d_fx.js builds it (buildXh):
  // four ticks or a ring, the weapon's colour, and a gap that opens with
  // movement and recoil. Crysto reads the same table the arena does.
  function buildReticle(c, kind) {
    const CROSS = (C.weapons && C.weapons.CROSS) || {};
    const cfg = CROSS[kind] || CROSS.pistol || { type: 'tick', gap: 6, len: 7, thick: 2, dot: 2, col: '#ffffff' };
    c.style.setProperty('--xh-col', cfg.col);
    const sh = 'box-shadow:0 0 4px #000,0 0 1px #000;';
    let h = '';
    if (cfg.type === 'ring') {
      h += '<div style="position:absolute;left:50%;top:50%;width:calc(2*var(--xh-r));height:calc(2*var(--xh-r));transform:translate(-50%,-50%);border:' + cfg.thick + 'px solid var(--xh-col);border-radius:50%;' + sh + '"></div>';
      if (cfg.dot > 0) h += '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:' + cfg.dot + 'px;height:' + cfg.dot + 'px;background:var(--xh-col);border-radius:50%;' + sh + '"></div>';
    } else {
      const t = cfg.thick, L = cfg.len;
      h += '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,calc(-100% - var(--xh-gap)));width:' + t + 'px;height:' + L + 'px;background:var(--xh-col);' + sh + '"></div>';
      h += '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,var(--xh-gap));width:' + t + 'px;height:' + L + 'px;background:var(--xh-col);' + sh + '"></div>';
      h += '<div style="position:absolute;left:50%;top:50%;transform:translate(calc(-100% - var(--xh-gap)),-50%);width:' + L + 'px;height:' + t + 'px;background:var(--xh-col);' + sh + '"></div>';
      h += '<div style="position:absolute;left:50%;top:50%;transform:translate(var(--xh-gap),-50%);width:' + L + 'px;height:' + t + 'px;background:var(--xh-col);' + sh + '"></div>';
      if (cfg.dot > 0) h += '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:' + cfg.dot + 'px;height:' + cfg.dot + 'px;background:var(--xh-col);border-radius:50%;' + sh + '"></div>';
    }
    c.innerHTML = h;
  }

  const hud = {
    build,
    stick,
    show() { build().style.display = 'block'; },
    hide() { if (root) root.style.display = 'none'; },

    // The pit's own reticle (render3d_fx.js, CROSS/buildXh): a tick cross or a
    // ring, in the weapon's colour, breathing open with movement and recoil
    // and fading as the sights come up. `kind` names the gun.
    crosshair(on, kind, gap, alpha, r) {
      build();
      const c = els.cross;
      if (kind && c._k !== kind) { c._k = kind; buildReticle(c, kind); }
      c.classList.toggle('on', !!on);
      c.style.opacity = on ? (alpha == null ? 1 : alpha) : 0;
      if (gap != null) c.style.setProperty('--xh-gap', gap.toFixed(1) + 'px');
      if (r != null) c.style.setProperty('--xh-r', r.toFixed(1) + 'px');
    },

    // A film played inside the world: the bars come down over the vale.
    cinematic(on) { build(); els.cine.classList.toggle('on', !!on); },

    // A scoped gun's vignette (render3d_fx.js, #scope3d), dimmed in with the sights.
    scope(a) { build(); els.scope.style.opacity = a || 0; },

    setQuest(title, objective, dist) {
      build();
      els.qTitle.textContent = title;
      els.qObj.textContent = objective;
      els.qDist.textContent = dist == null ? '' : Math.round(dist / 10) + ' m';
    },

    setCompass(angle, dist) {
      build();
      if (angle == null) { els.compass.style.opacity = '0'; return; }
      els.compass.style.opacity = '1';
      els.needle.style.transform = 'rotate(' + angle + 'deg)';
      els.cDist.textContent = Math.round(dist / 10) + ' m';
    },

    // what is in your hands
    setArms(name, ammo, sprite) {
      build();
      els.armsName.textContent = name || '';
      els.armsAmmo.textContent = ammo || '';
      els.armsAmmo.style.display = ammo ? '' : 'none';
      const src = sprite || '';
      if (els.armsImg.getAttribute('src') !== src) els.armsImg.setAttribute('src', src);
      els.armsImg.style.display = src ? '' : 'none';
    },

    // a sanctum guardian's health, or null to put the bar away
    setBoss(name, frac, move) {
      build();
      if (!name) { els.boss.classList.remove('on'); return; }
      els.bossName.textContent = name;
      const tag = move || '';
      if (els.bossMove.textContent !== tag) els.bossMove.textContent = tag;
      els.bossFill.style.width = (Math.max(0, Math.min(1, frac == null ? 1 : frac)) * 100) + '%';
      els.boss.classList.add('on');
    },

    savePing() {
      build();
      els.save.classList.add('on');
      clearTimeout(els.save._t);
      els.save._t = setTimeout(() => els.save.classList.remove('on'), 1800);
    },

    setHearts(hp, max) {
      build();
      const m = Math.max(1, Math.round(max || 100));
      const v = Math.max(0, Math.min(m, Math.round(hp || 0)));
      const f = v / m;
      els.hpFill.style.width = (f * 100) + '%';
      els.hpText.textContent = v + ' / ' + m;
      els.hearts.classList.toggle('low', f <= 0.3);
    },

    prompt(text) {
      build();
      els.prompt.textContent = text || '';
      els.prompt.classList.toggle('on', !!text);
    },

    banner(title, sub) {
      build();
      els.bTitle.textContent = title || '';
      els.bSub.textContent = sub || '';
      els.banner.classList.add('on');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => els.banner.classList.remove('on'), 3200);
    },

    say(who, list, onDone) {
      build();
      lines = Array.isArray(list) ? list.slice() : [String(list)];
      lineIdx = 0;
      after = onDone || null;
      els.who.textContent = who || '';
      els.dialogue.classList.add('on');
      showLine();
    },

    advance,
    get talking() { return els.dialogue && els.dialogue.classList.contains('on'); },

    choose(title, items) {
      build();
      els.choose.innerHTML = '';
      const head = el('div', 'cy-ch-title', title);
      els.choose.appendChild(head);
      items.forEach((it) => {
        const b = el('button', 'cy-ch-item', it.label);
        b.type = 'button';
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          els.choose.classList.remove('on');
          if (it.run) it.run();
        });
        els.choose.appendChild(b);
      });
      const close = el('button', 'cy-ch-close', 'Stay here');
      close.type = 'button';
      close.addEventListener('click', (e) => { e.stopPropagation(); els.choose.classList.remove('on'); });
      els.choose.appendChild(close);
      els.choose.classList.add('on');
    },

    hideChoose() { if (els.choose) els.choose.classList.remove('on'); }
  };

  function showLine() {
    const text = lines[lineIdx] || '';
    typingText = text;
    els.line.textContent = '';
    clearInterval(typingTimer);
    let i = 0;
    typingTimer = setInterval(() => {
      i += 2;
      els.line.textContent = typingText.slice(0, i);
      if (i >= typingText.length) clearInterval(typingTimer);
    }, 16);
  }

  function advance() {
    if (!els.dialogue || !els.dialogue.classList.contains('on')) return false;
    if (els.line.textContent.length < typingText.length) {
      clearInterval(typingTimer);
      els.line.textContent = typingText;
      return true;
    }
    lineIdx++;
    if (lineIdx < lines.length) { showLine(); return true; }
    els.dialogue.classList.remove('on');
    const fn = after;
    after = null;
    if (fn) fn();
    return true;
  }

  C.hud = hud;
})();
