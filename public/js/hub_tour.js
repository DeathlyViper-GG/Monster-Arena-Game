/* =====================================================================
   hub_tour.js — the first walk through the hall.

   The tour is not a slideshow: every step names a room, and the step only
   moves on when the player actually walks there. It ends in the training
   ring, where the practice hands them a target and then a Ravener.

   Replayed from the side rail's Tutorial button at any time.
   ===================================================================== */
(function (G) {
  'use strict';

  const DONE = 'arenaHubTourDone';

  const STEPS = [
    {
      title: 'The Hall of the Arena',
      text: 'This is the arena’s own house. <b>WASD</b> walks (or the stick), drag to look, ' +
        '<b>Space</b> jumps. Every door in this building leads somewhere real.',
      hint: 'Walk forward a few steps'
    },
    {
      at: { x: 0, z: -1440 }, r: 600,
      title: 'The Quartermaster’s Wing',
      text: 'Four doors, four rooms — and each keeps one part of your kit. Guns and utilities ' +
        'on the west wall, blades and your fighter on the east.',
      hint: 'Walk to the wing'
    },
    {
      at: { x: -1330, z: -1780 }, r: 330,
      title: 'The Gunsmith',
      text: 'Stand on the pad and press <b>E</b> to open the gun racks. Three weapons ride with you: ' +
        'swap between them with <b>Q</b> and <b>E</b>, or the WPN button on a phone.',
      hint: 'Find the gunsmith'
    },
    {
      at: { x: -1330, z: -1100 }, r: 330,
      title: 'The Orb Chamber',
      text: 'Utilities are thrown with <b>G</b> — hold to aim, release to throw. The marker on the ' +
        'floor is where it lands, so you can drop one at your own feet and live.',
      hint: 'Find the orb chamber'
    },
    {
      at: { x: 1330, z: -1780 }, r: 330,
      title: 'The Hall of Blades',
      text: 'Melee is <b>F</b>. Swing at anything that gets inside your gun — every blade has its own ' +
        'reach, its own guard, and its own curse.',
      hint: 'Find the hall of blades'
    },
    {
      at: { x: 1330, z: -1100 }, r: 330,
      title: 'The Hall of Flesh',
      text: 'Here you choose the body you fight in. Higher waves unlock the stranger ones, and the ' +
        'wardens of the crypt talk about what is coming.',
      hint: 'Find the hall of flesh'
    },
    {
      at: { x: 0, z: 1440 }, r: 600,
      title: 'The Training Ring',
      text: 'One last door. DeathlyViper keeps a living target in the ring — and something faster ' +
        'behind it. Nothing here costs you anything.',
      hint: 'Walk to the training ring',
      cta: 'Begin the practice'
    }
  ];

  let root = null, idx = 0, poll = 0, startPos = null;
  let titleEl = null, textEl = null, stepEl = null, hintEl = null, goEl = null;

  function done() {
    try { return localStorage.getItem(DONE) === '1'; } catch (_) { return false; }
  }

  function markDone() {
    try { localStorage.setItem(DONE, '1'); } catch (_) {}
  }

  function build() {
    root = document.createElement('div');
    root.className = 'hub-tour';
    root.innerHTML =
      '<div class="ht-card">' +
        '<div class="ht-top"><span class="ht-who">DEATHLYVIPER · THE HALL</span>' +
        '<span class="ht-step" id="htStep"></span></div>' +
        '<div class="ht-title" id="htTitle"></div>' +
        '<p class="ht-text" id="htText"></p>' +
        '<div class="ht-foot"><span class="ht-hint" id="htHint"></span>' +
        '<span class="ht-btns"><button class="ht-go" id="htGo" type="button" style="display:none">Begin</button>' +
        '<button class="ht-skip" id="htSkip" type="button">Leave the tour</button></span></div>' +
      '</div>';
    document.body.appendChild(root);

    titleEl = document.getElementById('htTitle');
    textEl = document.getElementById('htText');
    stepEl = document.getElementById('htStep');
    hintEl = document.getElementById('htHint');
    goEl = document.getElementById('htGo');

    document.getElementById('htSkip').addEventListener('click', function () { stop(); });
    goEl.addEventListener('click', function () {
      finish();
      if (G.TutorialTraining && G.TutorialTraining.startPractice) G.TutorialTraining.startPractice();
    });
    show(0);
  }

  function show(i) {
    idx = i;
    if (i >= STEPS.length) { finish(); return; }
    const s = STEPS[i];
    titleEl.textContent = s.title;
    textEl.innerHTML = s.text;
    stepEl.textContent = (i + 1) + ' / ' + STEPS.length;
    hintEl.textContent = s.hint || 'Walk on';
    if (s.cta) {
      goEl.textContent = s.cta;
      goEl.style.display = 'inline-block';
    } else {
      goEl.style.display = 'none';
    }
    if (root) root.classList.add('on');
  }

  function tick() {
    if (!root) return;
    // The card belongs to the hall: it steps out of the way the moment a match
    // starts, and comes back with the menu.
    const on = !!(G.Hub3D && G.Hub3D.active());
    root.classList.toggle('on', on);
    if (!on) return;
    const s = STEPS[idx];
    if (!s) return;
    const p = G.Hub3D.pos();
    if (!s.at) {
      if (!startPos) startPos = p;
      else if (Math.hypot(p.x - startPos.x, p.z - startPos.z) > 140) show(idx + 1);
      return;
    }
    if (Math.hypot(p.x - s.at.x, p.z - s.at.z) < (s.r || 320)) show(idx + 1);
  }

  function start(force) {
    if (!G.Hub3D) return;
    if (!force && done()) return;
    stop();
    startPos = null;
    build();
    poll = setInterval(tick, 250);
  }

  function finish() {
    markDone();
    if (root) { root.remove(); root = null; }
    if (poll) { clearInterval(poll); poll = 0; }
  }

  function stop() {
    // Leaving counts as having seen it: the tour only opens by itself once.
    markDone();
    if (poll) { clearInterval(poll); poll = 0; }
    if (root) { root.remove(); root = null; }
  }

  // A first visit walks the tour on its own, once the hall is up.
  setInterval(function () {
    if (root || done()) return;
    if (G.Hub3D && G.Hub3D.active()) start();
  }, 2500);

  G.HubTour = { start: start, stop: stop, done: done };
})(window);
