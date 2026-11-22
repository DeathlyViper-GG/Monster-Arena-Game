/* Crysto — the traveller's HUD: the vigil, the way ahead, the words spoken and
   the hands you play with. */
(function () {
  const C = (window.Crysto = window.Crysto || {});
  const els = {};
  let root = null;
  let lines = [], lineIdx = 0, after = null, typingTimer = null, typingText = '';
  let bannerTimer = null;
  let mapUpdateAt = 0;

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

    const worldTools = el('div', 'cy-world-tools');
    els.mapButton = el('button', 'cy-tool-button', 'MAP  [M]');
    els.packButton = el('button', 'cy-tool-button', 'PACK  [I]');
    els.mapButton.type = 'button';
    els.packButton.type = 'button';
    worldTools.appendChild(els.mapButton);
    worldTools.appendChild(els.packButton);
    root.appendChild(worldTools);

    els.mapPanel = el('section', 'cy-map-panel');
    const mapHead = el('div', 'cy-panel-head');
    mapHead.appendChild(el('div', 'cy-panel-title', 'The Kingdom of Crysto'));
    els.mapClose = el('button', 'cy-panel-close', 'Close  [M]');
    els.mapClose.type = 'button';
    mapHead.appendChild(els.mapClose);
    els.mapPanel.appendChild(mapHead);
    els.mapCanvas = el('canvas', 'cy-map-canvas');
    els.mapCanvas.width = 900;
    els.mapCanvas.height = 600;
    els.mapCanvas.setAttribute('aria-label', 'Map of Crysto showing towns, roads, forests, shrines and monster camps');
    els.mapPanel.appendChild(els.mapCanvas);
    els.mapPanel.appendChild(el('div', 'cy-map-legend', '◆ You　● Village　✦ Shrine　△ Monster camp　— Road'));
    root.appendChild(els.mapPanel);

    els.inventoryPanel = el('section', 'cy-inventory-panel');
    const packHead = el('div', 'cy-panel-head');
    packHead.appendChild(el('div', 'cy-panel-title', 'Field Pack'));
    els.packClose = el('button', 'cy-panel-close', 'Close  [I]');
    els.packClose.type = 'button';
    packHead.appendChild(els.packClose);
    els.inventoryPanel.appendChild(packHead);
    els.foodTrack = el('div', 'cy-food-track');
    els.foodFill = el('i', 'cy-food-fill');
    els.foodTrack.appendChild(els.foodFill);
    els.foodText = el('span', 'cy-food-text', 'Food 70 / 100');
    els.inventoryPanel.appendChild(els.foodTrack);
    els.inventoryPanel.appendChild(els.foodText);
    els.inventoryList = el('div', 'cy-inventory-list');
    els.inventoryPanel.appendChild(els.inventoryList);
    root.appendChild(els.inventoryPanel);

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
      'WASD move · Shift dash · Space jump · click strike · right-click aim · Q swap · R reload · E talk / act · T gather · M map · I pack · Esc leave');
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
    els.use.addEventListener('click', (e) => {
      e.stopPropagation();
      if (els.use.dataset.collect === 'true' && C.onCollect) C.onCollect();
      else if (C.onUse) C.onUse();
    });
    els.dash.addEventListener('click', (e) => { e.stopPropagation(); if (C.onDash) C.onDash(); });
    els.jump.addEventListener('click', (e) => { e.stopPropagation(); if (C.onJump) C.onJump(); });
    els.mapButton.addEventListener('click', (e) => { e.stopPropagation(); hud.toggleMap(); });
    els.packButton.addEventListener('click', (e) => { e.stopPropagation(); hud.toggleInventory(); });
    els.mapClose.addEventListener('click', (e) => { e.stopPropagation(); hud.toggleMap(false); });
    els.packClose.addEventListener('click', (e) => { e.stopPropagation(); hud.toggleInventory(false); });
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

  const MAP = { minX: -22000, maxX: 18000, minZ: -6000, maxZ: 54000 };
  function mapPoint(x, z) {
    return {
      x: (x - MAP.minX) / (MAP.maxX - MAP.minX) * els.mapCanvas.width,
      y: (MAP.maxZ - z) / (MAP.maxZ - MAP.minZ) * els.mapCanvas.height
    };
  }

  function drawMap(player, target) {
    const canvas = els.mapCanvas, ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const p = (x, z) => mapPoint(x, z);
    ctx.clearRect(0, 0, w, h);
    const paper = ctx.createLinearGradient(0, 0, w, h);
    paper.addColorStop(0, '#d7c79d');
    paper.addColorStop(0.52, '#c6b789');
    paper.addColorStop(1, '#a99568');
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#584b34';
    for (let i = 0; i < 180; i++) {
      const x = (i * 197 + 31) % w, y = (i * 113 + 17) % h;
      ctx.beginPath();
      ctx.ellipse(x, y, 1 + (i % 3), 0.7, i * 0.19, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    const land = (points, fill) => {
      ctx.beginPath();
      points.forEach((v, i) => {
        const q = p(v[0], v[1]);
        if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
      });
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(77,68,46,.65)';
      ctx.stroke();
    };
    land([
      [-20000, -5000], [-17000, -1100], [-13000, 700], [-9000, 1100], [-6000, 900],
      [-2500, 2400], [1000, 1900], [5000, 500], [9000, -900], [13000, -2200],
      [16000, -5000]
    ], '#86906b');
    land([
      [-14000, 24000], [-9500, 25500], [-5200, 26800], [-2000, 28500], [1800, 28100],
      [4200, 29100], [7300, 30300], [10500, 32200], [14200, 35000], [16000, 39000],
      [14000, 42500], [15500, 45800], [11200, 50000], [6000, 53500], [1500, 51700],
      [-3500, 52800], [-7200, 50000], [-9600, 47600], [-13000, 45300], [-17900, 42900],
      [-20400, 39700], [-19800, 36000], [-18000, 33200], [-16000, 28800]
    ], '#827d66');

    const region = (x, z, rx, rz, color) => {
      const q = p(x, z);
      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, rx / (MAP.maxX - MAP.minX) * w, rz / (MAP.maxZ - MAP.minZ) * h, -0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    region(-12500, 39900, 5200, 8000, '#344c35');
    region(-11100, 44600, 4300, 5200, '#667e6b');
    region(8000, 40800, 5700, 7200, '#9a6247');
    region(8500, 49000, 4800, 5800, '#c4bca7');
    region(-1000, 32200, 10500, 4300, '#b28b66');
    region(-11800, 45300, 4000, 3000, '#777c80');

    // The Sable and its banks.
    ctx.beginPath();
    for (let i = 0; i <= 45; i++) {
      const z = -5000 + i * 420;
      const x = -5200 + Math.sin(z * 0.00035) * 1100;
      const q = p(x, z);
      if (!i) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    }
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(75,117,127,.56)';
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(57,106,124,.9)';
    ctx.stroke();

    // Fine, broken contour lines give the parchment some relief without
    // introducing image downloads or additional rendering work.
    ctx.save();
    ctx.strokeStyle = 'rgba(58,61,44,.20)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const center = p(-6000 + i * 2400, 39000 + (i % 3) * 1800);
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, 100 + i * 5, 28 + i * 4, -0.35, 0.2, Math.PI * 1.8);
      ctx.stroke();
    }
    ctx.restore();

    // The actual Reach roads use the same point list as the 3D dirt tracks.
    (C.reach && C.reach.PATHS || []).forEach((route) => {
      ctx.beginPath();
      route.points.forEach((v, i) => {
        const q = p(v.x, v.z);
        if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
      });
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(72,49,32,.78)';
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(224,195,139,.8)';
      ctx.stroke();
    });

    const label = (text, x, z, size, color) => {
      const q = p(x, z);
      ctx.font = (size || 15) + 'px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(221,207,166,.8)';
      ctx.strokeText(text, q.x, q.y);
      ctx.fillStyle = color || '#3f3928';
      ctx.fillText(text, q.x, q.y);
    };
    const marker = (x, z, text, kind) => {
      const q = p(x, z);
      ctx.beginPath();
      if (kind === 'shrine') {
        ctx.moveTo(q.x, q.y - 7); ctx.lineTo(q.x + 7, q.y); ctx.lineTo(q.x, q.y + 7); ctx.lineTo(q.x - 7, q.y); ctx.closePath();
        ctx.fillStyle = '#e2b85b';
      } else if (kind === 'camp') {
        ctx.moveTo(q.x, q.y - 7); ctx.lineTo(q.x + 7, q.y + 6); ctx.lineTo(q.x - 7, q.y + 6); ctx.closePath();
        ctx.fillStyle = '#853e31';
      } else {
        ctx.arc(q.x, q.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#563f2d';
      }
      ctx.fill();
      ctx.strokeStyle = '#efe2bd';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      label(text, q.x === 0 ? x + 250 : x, z - 620, 13);
    };

    // Forest marks are deterministic and kept off the roads and settlements.
    for (let i = 0; i < 90; i++) {
      const x = -17400 + ((i * 7919) % 31000);
      const z = 35600 + ((i * 3571) % 13500);
      if (x > 5000 && z < 43500) continue;
      const q = p(x, z);
      ctx.fillStyle = i % 4 ? 'rgba(35,59,39,.7)' : 'rgba(57,79,49,.68)';
      ctx.beginPath();
      ctx.arc(q.x, q.y, 2 + i % 3, 0, Math.PI * 2);
      ctx.fill();
    }

    label('DRANE VALE', 0, -3200, 19, '#403b2b');
    label('THE HOLLOW REACH', -2000, 28500, 21, '#403b2b');
    label('BLACKPINE FOREST', -15100, 43100, 14, '#e1d8b8');
    label('EMBER WASTES', 8600, 37200, 14, '#f0d7b3');
    label('DROWNED MIRE', -11300, 46700, 13, '#e0dfd1');
    label('BONE CROWN', 8200, 50800, 14, '#514d42');
    label('THE RIVER SABLE', -6000, 6000, 12, '#274d5d');
    marker(0, 0, 'Drane Vale', 'village');
    (C.places && C.places.shrines || []).forEach((s) => marker(s.x, s.z, s.name, 'shrine'));
    if (C.places && C.places.keep) marker(C.places.keep.x, C.places.keep.z, 'Sunken Keep', 'camp');
    (C.reach && C.reach.villages || []).forEach((v) => marker(v.x, v.z, v.name, 'village'));
    (C.reach && C.reach.camps || []).forEach((c) => marker(c.x, c.z, c.name, 'camp'));
    (C.reach && C.reach.people && C.reach.people.NPCS || []).forEach((n) => {
      if (n.questGiver) marker(n.x, n.z, n.name, 'village');
    });

    if (target) {
      const q = p(target.x, target.z);
      ctx.beginPath();
      ctx.arc(q.x, q.y, 11, 0, Math.PI * 2);
      ctx.strokeStyle = '#fbf0d2';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(q.x, q.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ca4b38';
      ctx.fill();
    }
    if (player) {
      const q = p(player.x, player.z);
      ctx.beginPath();
      ctx.arc(q.x, q.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#54e4e6';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#10282a';
      ctx.stroke();
    }
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

    setFood(food, max) {
      build();
      const cap = Math.max(1, max || 100);
      const value = Math.max(0, Math.min(cap, Math.round(food || 0)));
      els.foodFill.style.width = (value / cap * 100) + '%';
      els.foodText.textContent = 'Food ' + value + ' / ' + cap;
      els.foodTrack.classList.toggle('low', value <= 25);
    },

    inventoryChanged(items, food, max) {
      build();
      hud.setFood(food, max);
      els.inventoryList.replaceChildren();
      const names = Object.keys(items || {}).filter((name) => items[name] > 0);
      if (!names.length) {
        els.inventoryList.appendChild(el('div', 'cy-pack-empty', 'Your pack is empty. Gather wild plants with [T].'));
        return;
      }
      names.forEach((name) => {
        const row = el('div', 'cy-pack-row');
        const text = el('div', 'cy-pack-name', name + ' × ' + items[name]);
        const eat = el('button', 'cy-pack-eat', 'Eat');
        eat.type = 'button';
        eat.addEventListener('click', (e) => {
          e.stopPropagation();
          if (C.herbs && C.herbs.eat) C.herbs.eat(name);
        });
        row.appendChild(text);
        row.appendChild(eat);
        els.inventoryList.appendChild(row);
      });
    },

    updateWorld(player, target, canCollect) {
      els.use.textContent = canCollect ? 'T' : 'E';
      els.use.dataset.collect = canCollect ? 'true' : 'false';
      if (els.mapPanel && els.mapPanel.classList.contains('on') && performance.now() - mapUpdateAt > 450) {
        mapUpdateAt = performance.now();
        drawMap(player, target);
      }
    },

    toggleMap(force) {
      build();
      const open = force == null ? !els.mapPanel.classList.contains('on') : !!force;
      els.mapPanel.classList.toggle('on', open);
      if (C.freeze) C.freeze(open);
      if (open) {
        els.inventoryPanel.classList.remove('on');
        drawMap(C.player && C.player(), null);
        if (document.pointerLockElement) document.exitPointerLock();
      }
    },

    toggleInventory(force) {
      build();
      const open = force == null ? !els.inventoryPanel.classList.contains('on') : !!force;
      els.inventoryPanel.classList.toggle('on', open);
      if (C.freeze) C.freeze(open);
      if (open) {
        els.mapPanel.classList.remove('on');
        if (document.pointerLockElement) document.exitPointerLock();
      }
    },

    get overlaysOpen() {
      return !!(els.mapPanel && (els.mapPanel.classList.contains('on') || els.inventoryPanel.classList.contains('on')));
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
