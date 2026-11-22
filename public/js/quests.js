// ============================================================
// Monster Arena — QUESTS
// The board of things worth doing. Every quest pays XP, which is the only
// way up the rank ladder besides surviving waves, and the repeatable
// bounties keep paying for as long as you keep playing.
//
// Progress is driven by the events ranks.js already observes (arena:kill,
// arena:wave) plus the save itself for exploration, endurance and story.
// Claims persist in localStorage and ride the cloud save.
// Exposes window.Quests.
// ============================================================
(function () {
  'use strict';

  const KEY_CLAIMED = 'arena_quests_claimed';
  const KEY_PROG = 'arena_quests_progress';
  const KEY_EARNED = 'arena_quests_earned';
  const KEY_WAVE = 'arena_quest_wavebest';

  const CATS = {
    combat: { icon: '⚔️', label: 'Combat' },
    boss: { icon: '☠️', label: 'Bosses' },
    endurance: { icon: '🌊', label: 'Endurance' },
    explore: { icon: '🏰', label: 'Exploration' },
    story: { icon: '📖', label: 'Story' },
    bounty: { icon: '💰', label: 'Bounty' }
  };

  // Every quest belongs to exactly one mode (or 'any'). Its progress only
  // moves while that mode is the one being played, so a wave survived in a bot
  // battle or a story realm never pays for a Singleplayer endurance quest.
  const MODES = {
    solo: { icon: '🧍', label: 'Singleplayer' },
    offline: { icon: '💻', label: 'Offline PvE' },
    pvp: { icon: '⚔️', label: 'Offline Battles' },
    mp: { icon: '👥', label: 'Multiplayer' },
    duel: { icon: '⚔️', label: 'Duels' },
    story: { icon: '📖', label: 'Story' },
    any: { icon: '🌐', label: 'Any mode' }
  };
  const MODE_ORDER = ['solo', 'offline', 'pvp', 'mp', 'duel', 'story', 'any'];

  // stat: 'kill' / 'boss' / 'pvpMatch' / 'pvpWin' count up as you play, in the
  // quest's own mode; 'wave' is the deepest wave reached in that mode;
  // 'buildings' and 'realms' are read straight from the save (mode-agnostic).
  // repeat: resets after a claim.
  const QUESTS = [
    // ── Singleplayer ───────────────────────────────────────────────
    { id: 'soloKill25', mode: 'solo', cat: 'combat', name: 'First Blood', desc: 'Cut down 25 enemies in Singleplayer.', target: 25, xp: 150, stat: 'kill' },
    { id: 'soloWave10', mode: 'solo', cat: 'endurance', name: 'Hold the Line', desc: 'Reach wave 10 in Singleplayer.', target: 10, xp: 200, stat: 'wave' },
    { id: 'soloWave25', mode: 'solo', cat: 'endurance', name: 'Deep Descent', desc: 'Reach wave 25 in Singleplayer.', target: 25, xp: 900, stat: 'wave' },
    { id: 'soloWave50', mode: 'solo', cat: 'endurance', name: 'Endless Siege', desc: 'Reach wave 50 in Singleplayer.', target: 50, xp: 3000, stat: 'wave' },
    { id: 'soloKill250', mode: 'solo', cat: 'combat', name: 'Hunter of the Wastes', desc: 'Cut down 250 enemies in Singleplayer.', target: 250, xp: 600, stat: 'kill' },

    // ── Offline PvE (you and the bots against the waves) ────────────
    { id: 'offWave10', mode: 'offline', cat: 'endurance', name: 'Last Stand', desc: 'Reach wave 10 in Offline PvE.', target: 10, xp: 250, stat: 'wave' },
    { id: 'offWave25', mode: 'offline', cat: 'endurance', name: 'Immovable', desc: 'Reach wave 25 in Offline PvE.', target: 25, xp: 1000, stat: 'wave' },
    { id: 'offKill250', mode: 'offline', cat: 'combat', name: 'Bottleneck Butcher', desc: 'Cut down 250 enemies in Offline PvE.', target: 250, xp: 650, stat: 'kill' },

    // ── Offline battles: PvP, Teams, Capture the Flag ───────────────
    { id: 'pvpPlay5', mode: 'pvp', cat: 'combat', name: 'Contender', desc: 'Play 5 offline PvP, Teams or CTF matches to the end.', target: 5, xp: 500, stat: 'pvpMatch' },
    { id: 'pvpWin3', mode: 'pvp', cat: 'combat', name: 'Champion of the Yard', desc: 'Win 3 offline PvP, Teams or CTF matches.', target: 3, xp: 1200, stat: 'pvpWin' },

    // ── Multiplayer ────────────────────────────────────────────────
    { id: 'mpKill250', mode: 'mp', cat: 'combat', name: 'Arena Regular', desc: 'Cut down 250 enemies in online matches.', target: 250, xp: 800, stat: 'kill' },
    { id: 'mpWave15', mode: 'mp', cat: 'endurance', name: 'Online Siege', desc: 'Reach wave 15 in an online match.', target: 15, xp: 1000, stat: 'wave' },

    // ── Duels (the 1v1 pit, private or matchmade) ───────────────────
    { id: 'duelPlay3', mode: 'duel', cat: 'combat', name: 'Blood Pact', desc: 'Fight 3 duels through to the last round.', target: 3, xp: 500, stat: 'duelMatch' },
    { id: 'duelWin3', mode: 'duel', cat: 'combat', name: 'Pit Champion', desc: 'Win 3 duels.', target: 3, xp: 1200, stat: 'duelWin' },
    { id: 'duelWin10', mode: 'duel', cat: 'combat', name: 'Master of the Pit', desc: 'Win 10 duels.', target: 10, xp: 3500, stat: 'duelWin' },

    // ── Story ──────────────────────────────────────────────────────
    { id: 'realm1', mode: 'story', cat: 'story', name: 'First Seal', desc: 'Clear a realm of the story.', target: 1, xp: 500, stat: 'realms' },
    { id: 'realm3', mode: 'story', cat: 'story', name: 'Realm Walker', desc: 'Clear 3 realms of the story.', target: 3, xp: 1800, stat: 'realms' },
    { id: 'realm5', mode: 'story', cat: 'story', name: 'Keeper of the Five', desc: 'Clear all five realms.', target: 5, xp: 6000, stat: 'realms' },

    // ── Any mode ───────────────────────────────────────────────────
    { id: 'boss1', mode: 'any', cat: 'boss', name: 'Giant Slayer', desc: 'Defeat your first boss.', target: 1, xp: 400, stat: 'boss' },
    { id: 'boss5', mode: 'any', cat: 'boss', name: 'Titan Breaker', desc: 'Defeat 5 bosses.', target: 5, xp: 1500, stat: 'boss' },
    { id: 'boss15', mode: 'any', cat: 'boss', name: 'Realm Ender', desc: 'Defeat 15 bosses.', target: 15, xp: 5000, stat: 'boss' },
    { id: 'build5', mode: 'any', cat: 'explore', name: 'Curious Wanderer', desc: 'Add 5 buildings to your codex.', target: 5, xp: 350, stat: 'buildings' },
    { id: 'build15', mode: 'any', cat: 'explore', name: 'Codex Keeper', desc: 'Add 15 buildings to your codex.', target: 15, xp: 1200, stat: 'buildings' },
    { id: 'bountyKill', mode: 'any', cat: 'bounty', name: 'Bounty · Harvest', desc: 'Cut down 100 enemies. Repeats forever.', target: 100, xp: 300, stat: 'kill', repeat: true },
    { id: 'bountyBoss', mode: 'any', cat: 'bounty', name: 'Bounty · Titans', desc: 'Defeat 2 bosses. Repeats forever.', target: 2, xp: 700, stat: 'boss', repeat: true }
  ];

  const esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  const num = function (n) { return String(Math.floor(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

  // ---- storage ---------------------------------------------------------
  function readObj(key) {
    try {
      const o = JSON.parse(localStorage.getItem(key) || '{}');
      return o && typeof o === 'object' ? o : {};
    } catch (_) { return {}; }
  }
  function writeObj(key, o) { try { localStorage.setItem(key, JSON.stringify(o)); } catch (_) {} }
  function readNum(key) { try { return parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch (_) { return 0; } }

  const claimed = readObj(KEY_CLAIMED);
  const prog = readObj(KEY_PROG);

  function earned() { return readNum(KEY_EARNED); }

  // ---- which mode is being played right now ---------------------------
  // Quests are mode-locked, so every event has to say which mode it came from.
  function modeNow() {
    if (window.STORY_ACTIVE || window.HOLLOW_GAUNTLET_ACTIVE) return 'story';
    if (window.Net && window.Net.state && window.Net.state.lobbyId) {
      // A duel room pays duel quests, not the general online ones.
      const m = String((window.Net.state.meta && window.Net.state.meta.mode) || '');
      return m === 'duel' ? 'duel' : 'mp';
    }
    const ctx = window.MENU_CONTEXT;
    if (ctx === 'offline' || ctx === 'multi') {
      const m = String(window.OFFLINE_MODE_TYPE || '').toLowerCase();
      return (m === 'pvp' || m === 'teams' || m === 'ctf') ? 'pvp' : 'offline';
    }
    return 'solo';
  }

  // Deepest wave each mode has actually been played to. The engine's own
  // arenaBest record is shared by every mode (and by the owner's rank
  // shortcut), so it can never stand in for a single mode's run.
  const waveBestMap = readObj(KEY_WAVE);
  function waveBest(mode) { return Number(waveBestMap[mode]) || 0; }
  function recordWave(n, mode) {
    const m = mode || modeNow();
    if (!n || n <= 0 || m === 'pvp' || m === 'any') return;
    if (n <= waveBest(m)) return;
    waveBestMap[m] = Math.floor(n);
    writeObj(KEY_WAVE, waveBestMap);
    changed();
  }

  // ---- progress --------------------------------------------------------
  function absolute(stat) {
    if (stat === 'kills') return readNum('arena_kills');
    if (stat === 'buildings') {
      try {
        const a = JSON.parse(localStorage.getItem('arena_discovered_buildings') || '[]');
        return Array.isArray(a) ? a.length : 0;
      } catch (_) { return 0; }
    }
    if (stat === 'realms') {
      try {
        const p = JSON.parse(localStorage.getItem('arena_story_progress') || '{}');
        return Array.isArray(p.completed) ? p.completed.length : 0;
      } catch (_) { return 0; }
    }
    return 0;
  }

  function current(q) {
    let v;
    if (q.stat === 'wave') v = waveBest(q.mode);
    else if (q.stat === 'kill' || q.stat === 'boss' || q.stat === 'pvpMatch' || q.stat === 'pvpWin' ||
      q.stat === 'duelMatch' || q.stat === 'duelWin') v = Number(prog[q.id]) || 0;
    else v = absolute(q.stat);
    return Math.max(0, Math.min(q.target, v));
  }
  function isClaimed(q) { return !q.repeat && !!claimed[q.id]; }
  function isReady(q) { return !isClaimed(q) && current(q) >= q.target; }
  function readyCount() { return QUESTS.filter(isReady).length; }

  // Progress counts up as you play — but only for the quests of the mode the
  // event came from (plus the few that pay in any mode).
  function bump(stat, n, mode) {
    const m = mode || modeNow();
    let touched = false;
    for (let i = 0; i < QUESTS.length; i++) {
      const q = QUESTS[i];
      if (q.stat !== stat || isClaimed(q)) continue;
      if (q.mode !== 'any' && q.mode !== m) continue;
      prog[q.id] = (Number(prog[q.id]) || 0) + n;
      touched = true;
    }
    if (touched) { writeObj(KEY_PROG, prog); changed(); }
  }

  function claim(id, fromEl) {
    const q = QUESTS.find(function (x) { return x.id === id; });
    if (!q || !isReady(q)) return;
    if (q.repeat) prog[q.id] = 0; else claimed[q.id] = 1;
    writeObj(KEY_CLAIMED, claimed);
    writeObj(KEY_PROG, prog);
    try { localStorage.setItem(KEY_EARNED, String(earned() + q.xp)); } catch (_) {}
    // A shower of XP leaves the button that paid out.
    try { if (window.XPFx && XPFx.claim) XPFx.claim(fromEl, q.xp); } catch (_) {}
    // XPlaced through the rank system, so the level-up toast and the
    // medallion readouts update in the same breath.
    try { if (window.RankXP && RankXP.add) RankXP.add(q.xp, 'Quest — ' + q.name); } catch (_) {}
    changed();
  }

  // ---- order: one group per mode, then claimable, then closest, then done --
  function ordered() {
    const rank = function (q) { return isClaimed(q) ? 2 : (isReady(q) ? 0 : 1); };
    return QUESTS.slice().sort(function (a, b) {
      const g = MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode);
      if (g) return g;
      const d = rank(a) - rank(b);
      if (d) return d;
      return (current(b) / b.target) - (current(a) / a.target);
    });
  }

  // ---- UI --------------------------------------------------------------
  const CSS = `
  #overlayQuests{z-index:50;place-items:center;background:radial-gradient(1100px 620px at 50% -8%,rgba(120,80,220,.18),rgba(4,6,14,.95) 70%);}
  #qsCard{position:relative;width:min(880px,95vw);max-height:92vh;overflow-y:auto;padding:22px 24px 24px;border-radius:22px;
    background:linear-gradient(180deg,rgba(16,13,30,.97),rgba(7,7,16,.98));border:1px solid rgba(150,110,255,.3);
    box-shadow:0 24px 70px rgba(0,0,0,.74),0 0 44px rgba(130,90,220,.2);}
  #qsHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;}
  #qsHead h2{margin:0;font-size:20px;letter-spacing:.09em;text-transform:uppercase;
    background:linear-gradient(90deg,#fff,#c9b6ff 55%,#8ff0ff);-webkit-background-clip:text;background-clip:text;color:transparent;}
  #qsClose{padding:7px 14px;border-radius:10px;cursor:pointer;font-size:12px;font-weight:800;letter-spacing:.06em;color:#dfd6ff;
    background:rgba(255,255,255,.05);border:1px solid rgba(150,110,255,.4);}
  #qsClose:hover{background:rgba(255,255,255,.1);color:#fff;}
  #qsSum{display:flex;flex-wrap:wrap;gap:10px;margin:2px 0 16px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#9fb6d8;}
  #qsSum b{color:#ffe9c4;font-weight:900;}
  #qsSum .qs-ready-pill{padding:4px 12px;border-radius:999px;border:1px solid rgba(255,214,138,.6);
    background:rgba(255,190,90,.1);color:#ffe9c4;box-shadow:0 0 14px rgba(255,190,90,.25);}
  #qsGrid{display:flex;flex-direction:column;gap:16px;}
  .qs-group-head{display:flex;align-items:center;gap:8px;margin-bottom:8px;
    font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#9fb6d8;}
  .qs-group-head .qs-g-ico{font-size:13px;filter:drop-shadow(0 0 6px rgba(160,110,255,.55));}
  .qs-group-head .qs-g-line{flex:1;height:1px;background:linear-gradient(90deg,rgba(150,110,255,.42),transparent);}
  .qs-group-head .qs-g-count{color:#8f86b8;font-variant-numeric:tabular-nums;}
  .qs-group-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:11px;}
  .qs-mode{padding:2px 7px;border-radius:999px;font-size:8px;letter-spacing:.1em;text-transform:uppercase;
    color:#c9b6ff;border:1px solid rgba(150,110,255,.35);white-space:nowrap;}
  .qs-card{padding:13px 15px;border-radius:14px;position:relative;overflow:hidden;
    background:linear-gradient(180deg,rgba(22,18,38,.72),rgba(9,8,18,.72));
    border:1px solid rgba(150,110,255,.2);transition:border-color .2s ease,box-shadow .25s ease,transform .2s ease;}
  .qs-card:hover{border-color:rgba(170,120,255,.6);box-shadow:0 0 20px rgba(150,90,240,.28);transform:translateY(-1px);}
  .qs-card[data-cat="boss"]{border-color:rgba(255,180,90,.26);}
  .qs-card[data-cat="story"]{border-color:rgba(192,102,255,.3);}
  .qs-card[data-cat="endurance"]{border-color:rgba(90,210,255,.26);}
  .qs-card[data-cat="explore"]{border-color:rgba(125,255,163,.24);}
  .qs-card.is-ready{border-color:rgba(255,214,138,.8);box-shadow:0 0 24px rgba(255,190,90,.3),inset 0 0 18px rgba(255,200,120,.08);}
  .qs-card.is-claimed{opacity:.42;}
  .qs-card.is-claimed:hover{transform:none;box-shadow:none;}
  .qs-top{display:flex;align-items:center;gap:8px;}
  .qs-ico{font-size:15px;filter:drop-shadow(0 0 7px rgba(160,110,255,.6));}
  .qs-name{flex:1;min-width:0;font-size:13px;font-weight:900;letter-spacing:.04em;color:#f2ecff;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .qs-name em{font-style:normal;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#8ff0ff;opacity:.8;margin-left:4px;}
  .qs-xp{font-size:11px;font-weight:900;letter-spacing:.04em;color:#ffe9c4;white-space:nowrap;
    text-shadow:0 0 10px rgba(255,200,120,.5);}
  .qs-desc{font-size:11px;line-height:1.45;color:#a9a2cf;margin:5px 0 9px;min-height:2.2em;}
  .qs-bar{position:relative;height:7px;border-radius:6px;background:rgba(0,0,0,.62);border:1px solid rgba(255,255,255,.12);overflow:hidden;}
  .qs-bar span{display:block;height:100%;border-radius:6px;
    background:linear-gradient(90deg,#7ad0ff,#c066ff,#ffd27a);box-shadow:0 0 10px rgba(160,110,255,.75);transition:width .4s ease;}
  .qs-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px;}
  .qs-prog{font-size:10px;letter-spacing:.1em;color:#9fb6d8;font-variant-numeric:tabular-nums;}
  .qs-claim{padding:6px 14px;border-radius:9px;cursor:pointer;font-size:11px;font-weight:900;letter-spacing:.08em;
    text-transform:uppercase;color:#ffe9c4;border:1px solid rgba(255,190,90,.7);
    background:linear-gradient(180deg,#3a2a12,#1a1208);box-shadow:0 0 16px rgba(255,190,90,.3);}
  .qs-claim:hover{box-shadow:0 0 24px rgba(255,190,90,.55);}
  .qs-claim:disabled{cursor:default;color:#8f86b8;border-color:rgba(150,110,255,.28);background:rgba(255,255,255,.04);box-shadow:none;}
  .qs-done{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#7dffa3;opacity:.85;}
  .si-badge{position:absolute;top:2px;right:4px;min-width:15px;height:15px;padding:0 3px;border-radius:8px;
    display:none;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:#100c1e;
    background:linear-gradient(180deg,#ffd27a,#ff9a3c);box-shadow:0 0 10px rgba(255,190,90,.85);}
  .si-badge.show{display:flex;}`;

  let injected = false, gridEl = null, sumEl = null;
  function inject() {
    if (injected) return;
    injected = true;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const ov = document.createElement('div');
    ov.id = 'overlayQuests';
    ov.className = 'overlay';
    ov.innerHTML =
      '<div id="qsCard">' +
        '<div id="qsHead"><h2>📜 Quests</h2><button id="qsClose" type="button">Close</button></div>' +
        '<div id="qsSum"></div>' +
        '<div id="qsGrid"></div>' +
      '</div>';
    document.body.appendChild(ov);

    gridEl = document.getElementById('qsGrid');
    sumEl = document.getElementById('qsSum');
    gridEl.addEventListener('click', function (e) {
      const b = e.target.closest('.qs-claim');
      if (b && !b.disabled) claim(b.dataset.q, b);
    });
    document.getElementById('qsClose').addEventListener('click', close);
    paint();
  }

  // One quest card. The mode chip spells out where it has to be earned.
  function card(q) {
    const cur = current(q);
    const done = cur >= q.target;
    const cl = isClaimed(q);
    const pct = Math.max(0, Math.min(100, (cur / q.target) * 100));
    return '<div class="qs-card' + (cl ? ' is-claimed' : (done ? ' is-ready' : '')) + '" data-cat="' + q.cat + '" data-mode="' + q.mode + '">' +
      '<div class="qs-top">' +
        '<span class="qs-ico">' + CATS[q.cat].icon + '</span>' +
        '<span class="qs-name">' + esc(q.name) + (q.repeat ? '<em>repeatable</em>' : '') + '</span>' +
        '<span class="qs-xp">+' + num(q.xp) + ' XP</span>' +
      '</div>' +
      '<div class="qs-desc"><span class="qs-mode">' + MODES[q.mode].icon + ' ' + esc(MODES[q.mode].label) + '</span> ' + esc(q.desc) + '</div>' +
      '<div class="qs-bar"><span style="width:' + pct.toFixed(1) + '%"></span></div>' +
      '<div class="qs-foot">' +
        '<span class="qs-prog">' + num(cur) + ' / ' + num(q.target) + '</span>' +
        (cl ? '<span class="qs-done">Claimed</span>' :
          '<button class="qs-claim" type="button" data-q="' + q.id + '"' + (done ? '' : ' disabled') + '>' +
          (done ? 'Claim' : 'In progress') + '</button>') +
      '</div>' +
    '</div>';
  }

  function paint() {
    inject();
    const ready = readyCount();
    sumEl.innerHTML =
      (ready ? '<span class="qs-ready-pill">' + ready + ' ready to claim</span>' : '<span>Nothing ready yet — go earn it</span>') +
      '<span>XP from quests · <b>' + num(earned()) + '</b></span>';

    const all = ordered();
    gridEl.innerHTML = MODE_ORDER.map(function (m) {
      const list = all.filter(function (q) { return q.mode === m; });
      if (!list.length) return '';
      const open = list.filter(function (q) { return !isClaimed(q); }).length;
      return '<div class="qs-group" data-mode="' + m + '">' +
          '<div class="qs-group-head">' +
            '<span class="qs-g-ico">' + MODES[m].icon + '</span>' +
            esc(MODES[m].label) +
            '<span class="qs-g-line"></span>' +
            '<span class="qs-g-count">' + open + ' open</span>' +
          '</div>' +
          '<div class="qs-group-grid">' + list.map(card).join('') + '</div>' +
        '</div>';
    }).join('');
  }

  function badge() {
    const btn = document.getElementById('introQuests');
    if (!btn) return;
    let el = btn.querySelector('.si-badge');
    if (!el) {
      el = document.createElement('span');
      el.className = 'si-badge';
      btn.appendChild(el);
    }
    const n = readyCount();
    el.textContent = n > 9 ? '9+' : String(n);
    el.classList.toggle('show', n > 0);
  }

  function changed() {
    badge();
    const ov = document.getElementById('overlayQuests');
    if (ov && ov.style.display === 'grid') paint();
  }

  // ---- open / close ----------------------------------------------------
  const HUBS = ['overlayIntro', 'overlayHome', 'overlaySingle', 'overlayOffline'];
  let returnTo = 'overlayIntro';

  function open() {
    inject();
    paint();
    for (let i = 0; i < HUBS.length; i++) {
      const el = document.getElementById(HUBS[i]);
      if (el && el.style.display === 'grid') { returnTo = HUBS[i]; break; }
    }
    document.querySelectorAll('.overlay').forEach(function (o) {
      if (o.id !== 'overlayQuests') o.style.display = 'none';
    });
    document.getElementById('overlayQuests').style.display = 'grid';
  }
  function close() {
    const ov = document.getElementById('overlayQuests');
    if (ov) ov.style.display = 'none';
    const back = document.getElementById(returnTo) || document.getElementById('overlayIntro');
    if (back) back.style.display = 'grid';
  }

  // ---- live tracking ---------------------------------------------------
  window.addEventListener('arena:kill', function (e) {
    const mode = modeNow();
    bump('kill', 1, mode);
    if (e && e.detail && e.detail.boss) bump('boss', 1, mode);
  });
  // A wave was survived — remembered against the mode it was survived in.
  window.addEventListener('arena:wave', function (e) {
    recordWave(e && e.detail ? Number(e.detail.wave) : 0);
  });
  // A bot battle ended and was scored (offline PvP, Teams, CTF).
  window.addEventListener('arena:pvp', function (e) {
    const d = (e && e.detail) || {};
    bump('pvpMatch', 1, 'pvp');
    if (Number(d.placement) === 1) bump('pvpWin', 1, 'pvp');
  });
  // ...and a Teams/CTF match that ended in a loss still counts as played.
  window.addEventListener('arena:battle', function () {
    bump('pvpMatch', 1, 'pvp');
  });
  // A duel reached its final round: it was played, and maybe won.
  window.addEventListener('arena:duel', function (e) {
    const d = (e && e.detail) || {};
    bump('duelMatch', 1, 'duel');
    if (d.won) bump('duelWin', 1, 'duel');
  });
  window.addEventListener('rank:changed', function () { badge(); });

  function init() {
    inject();
    const navBtn = document.getElementById('introQuests');
    if (navBtn) navBtn.addEventListener('click', open);
    const playerBtn = document.getElementById('introPlayer');
    if (playerBtn) playerBtn.addEventListener('click', function () { setTimeout(badge, 60); });

    changed();
    // Endurance, codex and story progress change outside this file.
    setInterval(function () {
      badge();
      const ov = document.getElementById('overlayQuests');
      if (ov && ov.style.display === 'grid') paint();
    }, 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.Quests = { list: QUESTS, modes: MODES, open, close, paint, claim, readyCount, earned, modeNow, waveBest };
})();
