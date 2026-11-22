// ============================================================
// Monster Arena — FIRST-TIME GUIDED TOUR
// ------------------------------------------------------------------
// DeathlyViper walks a new player round the hub the first time they
// reach it: the side rail, the six doors, and — because a menu you
// have never opened is not explained by looking at its button — the
// sub-menus of Singleplayer, Multiplayer and Story, which the player
// must open and close themselves.
//
// It runs once (localStorage), always carries a Skip button, and
// never blocks a click: the dimming is a box-shadow with a hole in
// it, so the game underneath still receives every press.
// ============================================================
(function () {
  'use strict';

  const KEY = 'arenaTutorialSeen_v1';

  const STEPS = [
    {
      text: 'DeathlyViper here. First time in the arena? I will walk you round the hub once — every tab, every door. Press Next, or Skip if you would rather learn by bleeding.'
    },
    {
      target: '#sideNav',
      text: 'Your side rail. Player shows rank and record, Quests pay RuneStones, Customize holds models, guns and melee, Shop spends them, and Buildings is the codex of every chest-structure you have found. Help, Settings and Account sit at the bottom.'
    },
    {
      target: '#overlayIntro .row',
      text: 'Six doors out of the hub: Offline against bots, Singleplayer, Multiplayer with friends, Story, Levels and Parkour. Each one opens its own menu — I will open two with you.'
    },
    {
      click: '#btnIntroSingle',
      label: 'Singleplayer',
      after: '#overlaySingle',
      text: 'Open Singleplayer.'
    },
    {
      target: '#singleLevelStrip',
      text: 'The realm ladder. Each card is a cursed realm with its own hazards and its own warden waiting at wave five. Pick a card and the waves begin; the footer names whatever you have selected.'
    },
    {
      click: '#backFromSingle',
      label: 'Back',
      after: '#overlayIntro',
      text: 'Every menu has a Back button, bottom left. Click it to come home.'
    },
    {
      click: '#btnIntroMulti',
      label: 'Multiplayer',
      after: '#overlayHome',
      text: 'Now the online side. Open Multiplayer.'
    },
    {
      target: '#overlayHome .card',
      text: 'Create a lobby or paste a friend\u2019s code. Pick a mode — PvE, PvP, Teams or Capture the Flag — then a side. Only the host can start the match, and there is a chat for everyone and one for your lobby.'
    },
    {
      click: '#backFromMulti',
      label: 'Back',
      after: '#overlayIntro',
      text: 'Click Back.'
    },
    {
      click: '#introStory',
      label: 'Story',
      after: '#overlayStory',
      text: 'One more. Open Story.'
    },
    {
      target: '#overlayStory',
      text: 'The campaign lives here: five realms, a cutscene before and after each warden, and a shard to carry out of every one. The Casket tracks your seals, and Reset wipes your progress if you ever want a clean run.'
    },
    {
      click: '#storyBack',
      label: 'Back',
      after: '#overlayIntro',
      text: 'Click Back to shut it.'
    },
    {
      text: 'Before you fight, the short version of the Handbook: <b>move</b> WASD, <b>aim</b> with the mouse, <b>fire</b> with the left button, <b>reload</b> R, <b>swap</b> weapons Q/E, <b>jump</b> Space, <b>slide</b> Shift, <b>melee</b> F, <b>pause</b> Esc, <b>help</b> H. On a phone the sticks and the FIRE, RLD, WPN, JUMP, SLIDE and MELEE buttons do the same jobs.'
    },
    {
      text: 'Everything else the Handbook covers: clearing a wave opens a <b>glyph</b> choice — three paths, each one changes how you fight. <b>Chests</b> hide inside buildings and hand out weapons, shields and speed. Monsters come in six kinds — chasers, tanks, shooters, snipers, bombers and healers — and every fifth wave sends something far worse. Hazards belong to the realm: quicksand, chasms, lava, void. The Help menu keeps the whole Handbook.'
    },
    {
      text: 'That is the hub. Offline for a scrap with bots, Singleplayer for the ladder, Story for the real fight — and the shop takes what you earn in all of them. I will be watching. Try not to bore me.'
    },
    {
      training: true,
      text: 'Reading it is not the same as doing it. I will drop you into an empty arena — no monsters, nothing that can touch you — and coach the controls one at a time until you have used every one yourself.'
    }
  ];

  let root = null;
  let spot = null;
  let cardEl = null;
  let textEl = null;
  let stepEl = null;
  let nextBtn = null;
  let skipBtn = null;
  let hintEl = null;
  let idx = -1;
  let poll = 0;
  let moving = false;

  function visible(sel) {
    if (!sel) return null;
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
    const r = el.getBoundingClientRect();
    return (r.width > 2 && r.height > 2) ? el : null;
  }

  function paint() {
    const s = STEPS[idx];
    if (!s || !spot) return;
    const el = visible(s.target || s.click);
    if (!el) {
      spot.hidden = true;
      root.classList.add('tut-dim');
      cardEl.classList.remove('tut-top');
      return;
    }
    const r = el.getBoundingClientRect();
    root.classList.remove('tut-dim');
    spot.hidden = false;
    spot.style.left = (r.left - 6) + 'px';
    spot.style.top = (r.top - 6) + 'px';
    spot.style.width = (r.width + 12) + 'px';
    spot.style.height = (r.height + 12) + 'px';
    // Anything in the lower third (the Back buttons, the mobile rail) would be
    // hidden behind the card, so the card moves to the top for those steps.
    const vh = window.innerHeight || 800;
    cardEl.classList.toggle('tut-top', (r.top + r.height * 0.5) > vh * 0.56);
  }

  function show(i) {
    idx = i;
    moving = false;
    if (i >= STEPS.length) { finish(); return; }
    const s = STEPS[i];
    const last = i === STEPS.length - 1;
    textEl.textContent = s.text;
    stepEl.textContent = (i + 1) + ' / ' + STEPS.length;
    nextBtn.textContent = s.training ? 'Enter training' : (last ? 'Enter the arena' : 'Next');
    nextBtn.hidden = !!s.click;
    hintEl.hidden = !s.click;
    if (s.click) hintEl.textContent = 'Click ' + (s.label || 'the glowing outline') + ' to carry on';
    paint();
  }

  function advance() {
    if (moving) return;
    moving = true;
    setTimeout(function () { show(idx + 1); }, 280);
  }

  function onClick(e) {
    const s = STEPS[idx];
    if (!s || !s.click || moving) return;
    const t = e.target;
    if (t && t.closest && t.closest(s.click)) advance();
  }

  function tick() {
    const s = STEPS[idx];
    if (!s) return;
    // The player may already have opened the menu themselves, or the click's
    // own handler may have moved the game on — either way the step is done.
    if (s.click && !moving && s.after && visible(s.after)) advance();
    paint();
  }

  function finish() {
    try { localStorage.setItem(KEY, '1'); } catch (_) {}
    if (poll) { clearInterval(poll); poll = 0; }
    document.removeEventListener('click', onClick, true);
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = spot = cardEl = textEl = stepEl = nextBtn = skipBtn = hintEl = null;
    idx = -1;
  }

  function build() {
    root = document.createElement('div');
    root.className = 'tut-root';
    root.innerHTML =
      '<div class="tut-spot" id="tutSpot" hidden></div>' +
      '<div class="tut-card" id="tutCard" role="dialog" aria-label="Tutorial">' +
        '<div class="tut-who">' +
          '<div class="tut-ava" aria-hidden="true">\uD83D\uDC0D</div>' +
          '<div><div class="tut-name">DeathlyViper</div>' +
          '<div class="tut-step" id="tutStepN"></div></div>' +
        '</div>' +
        '<p class="tut-text" id="tutText"></p>' +
        '<div class="tut-actions">' +
          '<button class="tut-skip" id="tutSkip" type="button">Skip tutorial</button>' +
          '<button class="tut-next" id="tutNext" type="button">Next</button>' +
        '</div>' +
        '<div class="tut-hint" id="tutHint" hidden></div>' +
      '</div>';
    document.body.appendChild(root);

    spot = document.getElementById('tutSpot');
    cardEl = document.getElementById('tutCard');
    textEl = document.getElementById('tutText');
    stepEl = document.getElementById('tutStepN');
    nextBtn = document.getElementById('tutNext');
    skipBtn = document.getElementById('tutSkip');
    hintEl = document.getElementById('tutHint');

    nextBtn.addEventListener('click', function () {
      if (moving) return;
      const s = STEPS[idx];
      if (s && s.training) {
        finish();
        if (window.TutorialTraining) window.TutorialTraining.start();
        return;
      }
      show(idx + 1);
    });
    skipBtn.addEventListener('click', finish);
    document.addEventListener('click', onClick, true);
    poll = setInterval(tick, 220);
  }

  function boot() {
    try { if (localStorage.getItem(KEY)) return; } catch (_) { return; }
    let tries = 0;
    const wait = setInterval(function () {
      tries++;
      if (visible('#overlayIntro')) {
        clearInterval(wait);
        if (!root) { build(); show(0); }
      } else if (tries > 240) {
        clearInterval(wait);
      }
    }, 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Called from the Tutorial tab on the hub. Any tour already on screen is torn
  // down first, the "seen" mark is cleared and the walkthrough starts again
  // from the first step.
  window.ArenaTutorial = {
    restart: function () {
      if (root) finish();
      try { localStorage.removeItem(KEY); } catch (_) {}
      boot();
    },
    skip: finish
  };
})();
