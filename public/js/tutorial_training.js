// ============================================================
// Monster Arena — TRAINING GROUND
// ------------------------------------------------------------------
// The second half of the first-time tour: DeathlyViper drops the
// player into an empty arena (no monsters, no waves, nothing that can
// kill them) and coaches the controls one at a time. A step only
// clears when the player actually performs it, so the tour teaches
// the hands rather than naming the keys.
//
// Steps: move · aim & fire · reload · swap weapon · jump · slide ·
// melee. Every step can be skipped, and leaving the arena ends the
// session and restores normal play.
// ============================================================
(function () {
  'use strict';

  const KEY = 'arenaTrainedOnce_v1';

  const STEPS = [
    { id: 'move', text: 'Empty arena, nothing hunting you. <b>Move</b> — WASD or arrows, or the left stick on a phone. Walk a few steps.' },
    { id: 'fire', text: 'Now <b>aim and fire</b>. Mouse aims, hold the left button to shoot — on a phone, drag the right stick to aim and tap FIRE.' },
    { id: 'reload', text: 'Empty mag. <b>Reload</b> with R, or the RLD button on a phone.' },
    { id: 'swap', text: 'Three weapons ride with you. <b>Swap</b> with Q or E, or the WPN button.' },
    { id: 'jump', text: '<b>Jump</b> with Space, or JUMP on a phone. Vault the rocks to break sight lines.' },
    { id: 'slide', text: '<b>Slide</b> with Shift, or SLIDE on a phone — the fastest way out of a volley.' },
    { id: 'melee', text: 'Last one: <b>melee</b>. Tap MELEE (or press F) to swing at anything that gets too close.' }
  ];

  let root = null;
  let card = null;
  let textEl = null;
  let stepEl = null;
  let nextBtn = null;
  let idx = 0;
  let poll = 0;
  let startPos = null;
  const seen = {};

  function esc(s) { return s; }

  function build() {
    root = document.createElement('div');
    root.className = 'tut-root';
    root.style.pointerEvents = 'none';
    root.innerHTML =
      '<div class="tut-card tut-training" id="trainCard">' +
        '<div class="tut-who">' +
          '<div class="tut-ava" aria-hidden="true">\uD83D\uDC0D</div>' +
          '<div><div class="tut-name">DeathlyViper \u00B7 training</div>' +
          '<div class="tut-step" id="trainStep"></div></div>' +
        '</div>' +
        '<p class="tut-text" id="trainText"></p>' +
        '<div class="tut-actions">' +
          '<button class="tut-skip" id="trainSkip" type="button">Leave training</button>' +
          '<button class="tut-next" id="trainNext" type="button">Skip this step</button>' +
        '</div>' +
        '<div class="tut-hint" id="trainHint">Nothing here can hurt you.</div>' +
      '</div>';
    document.body.appendChild(root);
    card = document.getElementById('trainCard');
    textEl = document.getElementById('trainText');
    stepEl = document.getElementById('trainStep');
    nextBtn = document.getElementById('trainNext');
    document.getElementById('trainSkip').addEventListener('click', stop);
    nextBtn.addEventListener('click', function () { show(idx + 1); });
    show(0);
  }

  function show(i) {
    idx = i;
    if (i >= STEPS.length) { finish(); return; }
    textEl.innerHTML = esc(STEPS[i].text);
    stepEl.textContent = (i + 1) + ' / ' + STEPS.length;
    nextBtn.textContent = (i === STEPS.length - 1) ? 'Skip this step' : 'Skip this step';
  }

  function finish() {
    try { localStorage.setItem(KEY, '1'); } catch (_) {}
    if (root) root.remove();
    root = card = textEl = stepEl = nextBtn = null;
    if (poll) { clearInterval(poll); poll = 0; }
    // Hands back to the hub: the training arena closes and the menu returns.
    window.TRAINING_GROUND = false;
    window.DEBUG_NO_ENEMIES = false;
    window.PRACTICE_ALL = false;
    try { if (window._hardStopGame) window._hardStopGame(); } catch (_) {}
    document.querySelectorAll('.overlay').forEach(function (o) { o.style.display = 'none'; });
    const intro = document.getElementById('overlayIntro');
    if (intro) intro.style.display = 'grid';
  }

  function stop() {
    if (poll) { clearInterval(poll); poll = 0; }
    finish();
  }

  function advance(id) {
    if (seen[id]) return;
    seen[id] = true;
    if (STEPS[idx] && STEPS[idx].id === id) {
      show(idx + 1);
    }
  }

  // ---- what counts as "you did it" ---------------------------------------
  let wired = false;
  function watchInput() {
    if (wired) return;
    wired = true;
    window.addEventListener('keydown', function (e) {
      if (!root) return;
      const k = String(e.key || '').toLowerCase();
      if (k === 'r') advance('reload');
      if (k === 'q' || k === 'e') advance('swap');
      if (k === ' ') advance('jump');
      if (k === 'shift') advance('slide');
      if (k === 'f') advance('melee');
    }, true);
    window.addEventListener('mousedown', function (e) {
      if (!root) return;
      if (e.button === 0) advance('fire');
    }, true);
    const tap = function (sel, id) {
      const el = document.querySelector(sel);
      if (!el) return;
      const fire = function () { advance(id); };
      el.addEventListener('touchstart', fire, { passive: true });
      el.addEventListener('mousedown', fire);
      el.addEventListener('click', fire);
    };
    tap('#btnFire', 'fire');
    tap('#btnReload', 'reload');
    tap('#btnSwap', 'swap');
    tap('#btnJump', 'jump');
    tap('#btnDash', 'slide');
    tap('#btnMelee', 'melee');
  }

  function tick() {
    if (!root) return;
    // Movement is judged by the fighter actually travelling, not by a keypress,
    // so a stick on a phone counts exactly like WASD.
    const me = (window.__pvePlayer && window.__pvePlayer()) || null;
    if (me && STEPS[idx] && STEPS[idx].id === 'move') {
      if (!startPos) startPos = { x: me.x, y: me.y };
      else if (Math.hypot(me.x - startPos.x, me.y - startPos.y) > 90) advance('move');
    }
  }

  // opts.silent opens the empty arena on its own, with no coaching card: that
  // is the practice room's door, not the first-time tour.
  function start(opts) {
    const silent = !!(opts && opts.silent);
    window.TRAINING_GROUND = true;
    window.DEBUG_NO_ENEMIES = true;
    startPos = null;
    idx = 0;
    Object.keys(seen).forEach(function (k) { delete seen[k]; });
    document.querySelectorAll('.overlay').forEach(function (o) { o.style.display = 'none'; });
    try { if (window._Gauntlet && window._Gauntlet.setThemeById) window._Gauntlet.setThemeById(1); } catch (_) {}
    const btn = document.getElementById('btnRestart');
    if (btn) btn.click();
    if (silent) return;
    setTimeout(function () {
      if (!root) build();
      watchInput();
      if (poll) clearInterval(poll);
      poll = setInterval(tick, 350);
    }, 800);
  }

  /* =====================================================================
     the training ring — one target, then a Ravener that wants you
     ===================================================================== */
  let pRoot = null, pText = null;
  const pTimers = [];

  function clearPractice() {
    while (pTimers.length) clearTimeout(pTimers.pop());
  }

  // The arena refuses to spawn while the empty-arena flag is on, so it is
  // lifted for the single spawn call and put straight back.
  function spawnAt(kind, dx, dy) {
    const me = (window.__pvePlayer && window.__pvePlayer()) || null;
    if (!me || !window.__pveSpawnEnemy) return false;
    const was = window.DEBUG_NO_ENEMIES;
    window.DEBUG_NO_ENEMIES = false;
    try { window.__pveSpawnEnemy(kind, me.x + dx, me.y + dy); } catch (_) {}
    window.DEBUG_NO_ENEMIES = was;
    return true;
  }

  function practiceText(html) {
    if (pText) pText.innerHTML = html;
  }

  function buildPracticeCard() {
    if (pRoot) return;
    pRoot = document.createElement('div');
    pRoot.className = 'tut-root';
    pRoot.style.pointerEvents = 'none';
    pRoot.innerHTML =
      '<div class="tut-card tut-training">' +
        '<div class="tut-who">' +
          '<div class="tut-ava" aria-hidden="true">\uD83D\uDC0D</div>' +
          '<div><div class="tut-name">DeathlyViper \u00B7 the ring</div>' +
          '<div class="tut-step">practice</div></div>' +
        '</div>' +
        '<p class="tut-text" id="pracText">Stand ready\u2026</p>' +
        '<div class="tut-actions">' +
          '<button class="tut-skip" id="pracLeave" type="button">Leave the ring</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(pRoot);
    pText = document.getElementById('pracText');
    document.getElementById('pracLeave').addEventListener('click', function () { stopPractice(); });
  }

  function stopPractice() {
    clearPractice();
    if (pRoot) { pRoot.remove(); pRoot = null; pText = null; }
    window.TRAINING_GROUND = false;
    window.DEBUG_NO_ENEMIES = false;
    try { if (window._hardStopGame) window._hardStopGame(); } catch (_) {}
    document.querySelectorAll('.overlay').forEach(function (o) { o.style.display = 'none'; });
    const intro = document.getElementById('overlayIntro');
    if (intro) intro.style.display = 'grid';
  }

  // The hall's tour ends here: an empty arena, a target to shoot, then the
  // Ravener — the fastest thing in the game — walking the player down.
  function startPractice() {
    clearPractice();
    window.TRAINING_GROUND = true;
    window.DEBUG_NO_ENEMIES = true;
    document.querySelectorAll('.overlay').forEach(function (o) { o.style.display = 'none'; });
    const btn = document.getElementById('btnRestart');
    if (btn) btn.click();

    buildPracticeCard();
    practiceText('Nothing in this ring can end your run. <b>Move</b>, aim, and get used to the weight of the gun.');

    pTimers.push(setTimeout(function () {
      const ok = spawnAt('tank', 40, -280);
      practiceText(ok
        ? 'A Gorgon stands ahead. <b>Shoot it</b> — hold the trigger, <b>R</b> to reload, <b>Q</b>/<b>E</b> to change weapon.'
        : 'Walk out into the ring and get a feel for the gun.');
    }, 1500));

    pTimers.push(setTimeout(function () {
      const ok = spawnAt('chaser', -80, -220);
      practiceText(ok
        ? '<b>A Ravener is awake.</b> It is the fastest thing in the arena and it is coming for you. ' +
          'Keep moving, swing with <b>F</b> if it closes, and put it down.'
        : 'That is the ring. The hall is yours whenever you are ready.');
    }, 16000));
  }

  // Leaving the arena by any other door (Home, a level card) must not leave the
  // empty-arena flags switched on, or the next match would spawn nothing.
  document.addEventListener('click', function (e) {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#btnHome') || t.closest('#homeBtn2') || t.closest('#victoryHomeBtn') || t.closest('[data-level]')) {
      if (root) { if (poll) { clearInterval(poll); poll = 0; } root.remove(); root = null; }
      window.TRAINING_GROUND = false;
      window.DEBUG_NO_ENEMIES = false;
      window.PRACTICE_ALL = false;
    }
  }, true);

  window.TutorialTraining = {
    start: start,
    stop: stop,
    startPractice: startPractice,
    stopPractice: stopPractice,
    seen: function () { try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; } }
  };
})();
