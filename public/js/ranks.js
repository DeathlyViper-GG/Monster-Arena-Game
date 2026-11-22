// ============================================================
// Monster Arena — XP RANKS, PLAYER PROFILE & FRIENDS
// Ten ranks, ten stages each; the 3D medallions themselves are built in
// rank_emblem.js. What lies further up the ladder is never shown: the
// profile only names the rank a player has actually earned and seals the
// rest behind a locked medallion, so each new rank is a discovery.
//
// XP comes from activity (waves, kills, matches) and quests
// (story realms), but it is banked, not spent freely: every rank stays sealed
// until a certain wave of a run has been survived, so progress follows skill.
// Progress, kills, deaths and friends persist in localStorage and are part of
// the cloud save.
// Exposes window.RankXP.
// ============================================================
(function () {
  'use strict';

  const KEY_XP = 'arena_xp';
  const KEY_KILLS = 'arena_kills';
  const KEY_DEATHS = 'arena_deaths';
  const KEY_FRIENDS = 'arena_friends';

  // The ladder and its 3D emblems live in rank_emblem.js; this file only
  // handles XP, stats, the profile and the readouts.
  const EM = window.RankEmblem;
  const RANKS = EM.RANKS;
  const ROMAN = EM.ROMAN;
  const MAX_LEVEL = EM.MAX_LEVEL;

  // ---- XP curve --------------------------------------------------------
  // The first rank is earned in a match or two, the last ones demand real
  // dedication: each level costs a geometric step plus a squared tail, so the
  // climb gets steeper with every rank instead of flattening out. Past level
  // 100 the secret levels keep climbing linearly and never stop.
  function levelCost(l) {
    if (l >= MAX_LEVEL) return 9000 + (l - MAX_LEVEL) * 2400;
    const step = l - 1;
    return Math.round(50 * Math.pow(1.045, step) + 0.55 * step * step);
  }
  // ---- Wave gate -------------------------------------------------------
  // Levels are not bought with time: each one stays sealed until a certain
  // wave has been survived, so the ladder follows skill instead of grinding.
  // Level 2 wants wave 2, level 10 wants wave 10, and past that the arena
  // keeps demanding deeper runs — the secret levels never stop climbing.
  function waveGate(l) {
    if (l <= 1) return 0;
    if (l <= 11) return l;
    return 11 + Math.ceil((l - 11) * 1.1);
  }

  // Deepest wave this device has ever reached (the engine's record, plus the
  // per-realm records it keeps for each level).
  function bestWave() {
    let best = readNum('arenaBest');
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('arenaBestWave_') === 0) {
          const v = parseInt(localStorage.getItem(k) || '0', 10);
          if (Number.isFinite(v) && v > best) best = v;
        }
      }
    } catch (_) {}
    return best;
  }

  function levelFor(xp, wave) {
    const total = Math.max(0, Math.floor(Number(xp) || 0));
    const reached = wave == null ? bestWave() : Math.max(0, Math.floor(Number(wave) || 0));
    let l = 1;
    let rem = total;
    let guard = 0;
    while (guard++ < 4000) {
      const c = levelCost(l);
      if (rem < c) break;
      rem -= c;
      l++;
    }

    // Sealed by the wave gate: the XP stays banked until a deeper run opens it.
    let cap = 1;
    while (cap < 4000 && waveGate(cap + 1) <= reached) cap++;
    if (l > cap) {
      let spent = total;
      for (let i = 1; i < cap; i++) spent -= levelCost(i);
      const need = levelCost(cap);
      return {
        level: cap,
        into: Math.max(0, Math.min(spent, need)),
        need, capped: true, gate: waveGate(cap + 1)
      };
    }
    return { level: l, into: rem, need: levelCost(l), capped: false, gate: waveGate(l + 1) };
  }
  const parts = EM.parts;

  // ---- Storage ---------------------------------------------------------
  function readNum(k) {
    try {
      const v = parseInt(localStorage.getItem(k) || '0', 10);
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch (_) { return 0; }
  }
  function writeNum(k, v) {
    try { localStorage.setItem(k, String(Math.max(0, Math.floor(v)))); } catch (_) {}
  }
  function friends() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY_FRIENDS) || '[]');
      return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string' && x; }) : [];
    } catch (_) { return []; }
  }
  function saveFriends(a) {
    try { localStorage.setItem(KEY_FRIENDS, JSON.stringify(a.slice(0, 60))); } catch (_) {}
  }

  const xp = function () { return readNum(KEY_XP); };
  const kills = function () { return readNum(KEY_KILLS); };
  const deaths = function () { return readNum(KEY_DEATHS); };
  const level = function () { return levelFor(xp()).level; };

  function view() {
    const total = xp();
    const wave = bestWave();
    const st = levelFor(total, wave);
    const p = parts(st.level);
    return {
      xp: total, level: st.level, into: st.into, need: st.need,
      pct: Math.max(0, Math.min(1, st.into / st.need)),
      rankIndex: p.rankIndex, stage: p.stage, secret: p.secret, title: p.title,
      capped: !!st.capped, gate: st.gate, bestWave: wave
    };
  }

  // What the progress bar under a rank says: normal XP, or the wave that has
  // to be survived before the next rank unlocks.
  function xpLine(v) {
    if (v.capped) return 'Sealed — survive wave ' + v.gate + ' to ascend';
    return numStr(v.into) + ' / ' + numStr(v.need) + ' XP · Lv ' + v.level;
  }

  // ---- Emblems ---------------------------------------------------------
  // The medallions themselves are built in rank_emblem.js.
  function emblemSVG(levelIn, size, animate) {
    return EM.render(parts(levelIn), size || 40, animate);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Small badge used next to a name in any chat feed.
  function badgeHTML(levelIn, size) {
    return EM.badge(levelIn, size || 16);
  }

  // ---- XP awards -------------------------------------------------------
  const KILL_XP = {
    swarm: 4, shooter: 9, tank: 14, boss: 160,
    hearth_warden: 200, pharaoh_glass: 200, rime_oracle: 200, magma_titan: 200, void: 200, hollow: 400
  };

  let toastEl = null, toastTimer = null;
  function ensureToast() {
    if (toastEl) return toastEl;
    toastEl = document.createElement('div');
    toastEl.id = 'rankToast';
    document.body.appendChild(toastEl);
    return toastEl;
  }
  function showToast(kind, headline, sub, lv) {
    ensureToast();
    toastEl.className = 'rank-toast ' + (kind === 'rank' ? 'is-rank' : '');
    toastEl.innerHTML = '<span class="rt-emblem">' + emblemSVG(lv || level(), kind === 'rank' ? 34 : 26) + '</span>' +
      '<span class="rt-body"><b>' + esc(headline) + '</b>' + (sub ? '<i>' + esc(sub) + '</i>' : '') + '</span>';
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, kind === 'rank' ? 3400 : 1900);
  }

  function add(n, reason) {
    const amt = Math.floor(Number(n) || 0);
    if (amt <= 0) return;
    const before = levelFor(xp()).level;
    writeNum(KEY_XP, xp() + amt);
    const after = levelFor(xp()).level;
    if (after > before) {
      const p = parts(after);
      // A new rank gets the full ceremony: 3D medallion, rays, shockwave.
      if (window.XPFx && XPFx.levelUp) setTimeout(function () { XPFx.levelUp(after, p); }, 460);
      else showToast('rank', 'Rank up — ' + p.title, p.secret > 0 ? 'Secret level ' + p.secret + ' unlocked' : 'Level ' + after, after);
    } else if (reason) {
      showToast('xp', '+' + amt + ' XP', reason);
    }
    change();
  }

  // Quests (quests.js) follow the same events, so every kill, boss and wave
  // is announced once here instead of being sampled twice.
  function fire(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (_) {}
  }

  function addKill(type) {
    writeNum(KEY_KILLS, kills() + 1);
    add(KILL_XP[type] || 8, '');
    fire('arena:kill', { type: type || 'swarm', boss: (KILL_XP[type] || 0) >= 160 });
  }
  function addDeath() { writeNum(KEY_DEATHS, deaths() + 1); change(); fire('arena:death', {}); }
  function addWave(n) {
    if (n <= 0) return;
    add(12 + n * 2, 'Wave ' + n);
    fire('arena:wave', { wave: n });
  }
  function addQuest(n, label) { add(n || 200, label || 'Quest complete'); }

  // ---- Gameplay watcher -------------------------------------------------
  // The engine owns the live entity list and exposes it as window._ents, so
  // kills, deaths and waves are followed from here without touching it: an
  // enemy that was present last sample and is gone now has been killed.
  // Enemy ids survive both local play and server snapshots, so a death is
  // only ever paid out once.
  const seen = new Map();
  let ridSeq = 0;
  let hpWas = null;
  let lastWave = 0;

  let watchingOnline = null;
  function sampleGame() {
    // Local play keeps its monsters in ents.enemies; an online match renders the
    // server snapshot, which is the authority there.
    const netOnline = !!(window.Net && window.Net.state && window.Net.state.lobbyId && window.Net.state.snapshot);
    const ents = window._ents;
    const list = netOnline
      ? (Array.isArray(window.Net.state.snapshot.enemies) ? window.Net.state.snapshot.enemies : null)
      : (ents && Array.isArray(ents.enemies) ? ents.enemies : null);
    if (watchingOnline !== null && watchingOnline !== netOnline) seen.clear();
    watchingOnline = netOnline;

    if (list) {
      const ids = new Set();
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e) continue;
        const id = e.id != null ? e.id : (e.__rankId || (e.__rankId = 'e' + (++ridSeq)));
        ids.add(id);
        seen.set(id, { type: e.type });
      }
      const gone = [];
      seen.forEach(function (rec, id) { if (!ids.has(id)) gone.push(rec); });
      // A wiped board is a restart or a mode change, not a killstreak.
      if (gone.length <= 6) for (let i = 0; i < gone.length; i++) addKill(gone[i].type);
      seen.forEach(function (rec, id) { if (!ids.has(id)) seen.delete(id); });
    }

    const waveEl = document.getElementById('wave');
    const w = waveEl ? parseInt(waveEl.textContent, 10) : 0;
    if (Number.isFinite(w) && w > 0) {
      if (w > lastWave && lastWave > 0) {
        const upto = Math.min(w, lastWave + 3);
        for (let i = lastWave + 1; i <= upto; i++) addWave(i);
      }
      lastWave = w;
    }

    const p = window.__pvePlayer ? window.__pvePlayer() : null;
    if (p && typeof p.hp === 'number') {
      if (hpWas != null && hpWas > 0 && p.hp <= 0) addDeath();
      hpWas = p.hp;
    }
  }

  // ---- UI --------------------------------------------------------------
  const CSS = `
  #rankToast{position:fixed;left:50%;top:64px;transform:translate(-50%,-14px);z-index:62;display:flex;align-items:center;gap:11px;
    padding:9px 16px 9px 10px;border-radius:16px;opacity:0;pointer-events:none;transition:opacity .3s ease,transform .35s cubic-bezier(.22,1,.36,1);
    background:linear-gradient(180deg,rgba(14,12,26,.95),rgba(6,6,14,.92));border:1px solid rgba(160,110,255,.5);
    box-shadow:0 12px 34px rgba(0,0,0,.6),0 0 26px rgba(150,90,240,.3);backdrop-filter:blur(6px);}
  #rankToast.show{opacity:1;transform:translate(-50%,0);}
  #rankToast.is-rank{border-color:rgba(255,214,138,.75);box-shadow:0 14px 40px rgba(0,0,0,.65),0 0 34px rgba(255,196,90,.45);}
  #rankToast .rt-body{display:flex;flex-direction:column;line-height:1.25;}
  #rankToast .rt-body b{color:#f2ecff;font-size:14px;letter-spacing:.03em;}
  #rankToast.is-rank .rt-body b{color:#ffe9c4;}
  #rankToast .rt-body i{font-style:normal;font-size:11px;color:#a8b8d8;opacity:.85;}

  .rank-badge{display:inline-flex;align-items:center;justify-content:center;vertical-align:-3px;margin-right:6px;}

  #rankHero{display:flex;align-items:center;gap:12px;width:min(420px,88%);margin:18px auto 0;padding:10px 16px;
    border-radius:16px;cursor:pointer;position:relative;overflow:hidden;
    background:linear-gradient(180deg,rgba(20,16,36,.82),rgba(8,7,18,.82));
    border:1px solid rgba(150,110,255,.32);box-shadow:0 10px 28px rgba(0,0,0,.45),inset 0 0 18px rgba(120,180,255,.08);
    transition:transform .2s cubic-bezier(.22,1,.36,1),border-color .2s ease,box-shadow .25s ease;}
  #rankHero:hover{transform:translateY(-2px);border-color:rgba(180,130,255,.85);box-shadow:0 14px 34px rgba(0,0,0,.55),0 0 26px rgba(150,90,255,.4);}
  .rh-text{flex:1;min-width:0;text-align:left;display:block;}
  .rh-title{display:block;font-size:14px;font-weight:900;letter-spacing:.05em;color:#f2ecff;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .rh-track{display:block;position:relative;height:6px;border-radius:6px;margin-top:5px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.12);overflow:hidden;}
  .rh-fill{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#7ad0ff,#c066ff,#ffd27a);box-shadow:0 0 10px rgba(160,110,255,.8);transition:width .4s ease;}
  .rh-xp{display:block;font-size:10px;letter-spacing:.08em;color:#9fb6d8;margin-top:4px;text-transform:uppercase;}

  #mpRankChip{display:inline-flex;align-items:center;gap:9px;margin:2px 0 10px;padding:7px 14px;border-radius:999px;
    background:linear-gradient(180deg,rgba(20,16,36,.9),rgba(8,7,18,.9));border:1px solid rgba(150,110,255,.4);
    box-shadow:0 0 16px rgba(150,90,240,.25);color:#f2ecff;font-weight:800;font-size:12px;letter-spacing:.05em;max-width:100%;}
  #mpRankChip .rh-text{max-width:210px;}
  #mpRankChip .rh-title{font-size:12px;}
  #mpRankChip .rh-xp{font-size:9px;}

  #overlayPlayer{z-index:50;background:radial-gradient(1100px 600px at 50% -10%,rgba(120,80,220,.16),rgba(4,6,14,.96) 70%);}
  #plrCard{position:relative;width:min(760px,95vw);max-height:92vh;overflow-y:auto;padding:26px 28px 24px;border-radius:22px;
    background:linear-gradient(180deg,rgba(16,13,30,.96),rgba(7,7,16,.97));border:1px solid rgba(150,110,255,.28);
    box-shadow:0 24px 70px rgba(0,0,0,.72),0 0 44px rgba(130,90,220,.18);}
  #plrCard h2{margin:0;font-size:20px;letter-spacing:.08em;text-transform:uppercase;
    background:linear-gradient(90deg,#fff,#c9b6ff 55%,#8ff0ff);-webkit-background-clip:text;background-clip:text;color:transparent;}
  #plrHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;}
  #plrClose{padding:7px 14px;border-radius:10px;cursor:pointer;font-size:12px;font-weight:800;letter-spacing:.06em;color:#dfd6ff;
    background:rgba(255,255,255,.05);border:1px solid rgba(150,110,255,.4);}
  #plrClose:hover{background:rgba(255,255,255,.1);color:#fff;}
  .plr-top{display:flex;align-items:center;gap:18px;padding:16px;border-radius:16px;
    background:linear-gradient(180deg,rgba(26,20,46,.7),rgba(10,9,20,.7));border:1px solid rgba(150,110,255,.24);}
  .plr-top .plr-emblem{flex:0 0 auto;filter:drop-shadow(0 0 18px rgba(160,120,255,.5));}
  .plr-rankinfo{flex:1;min-width:0;}
  .plr-title{font-size:22px;font-weight:900;letter-spacing:.05em;color:#f6f0ff;text-transform:uppercase;text-shadow:0 0 18px rgba(160,120,255,.5);}
  .plr-sub{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9fb6d8;margin-top:2px;}
  .plr-track{position:relative;height:10px;border-radius:8px;margin-top:10px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.14);overflow:hidden;}
  .plr-track>span{display:block;height:100%;border-radius:8px;background:linear-gradient(90deg,#7ad0ff,#c066ff,#ffd27a);
    box-shadow:0 0 14px rgba(160,110,255,.85);transition:width .45s cubic-bezier(.22,1,.36,1);}
  .plr-xp{font-size:11px;letter-spacing:.08em;color:#9fb6d8;margin-top:6px;}
  .plr-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px;}
  .plr-name{margin-top:14px;padding:13px 15px;border-radius:14px;
    background:linear-gradient(180deg,rgba(22,18,38,.7),rgba(9,8,18,.7));border:1px solid rgba(150,110,255,.22);}
  .plr-name-head{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#9fb6d8;opacity:.9;margin-bottom:8px;}
  .plr-name-row{display:flex;gap:8px;}
  .plr-name-row input{flex:1;min-width:0;padding:9px 12px;border-radius:999px;color:#eaf4ff;font-size:13px;
    background:rgba(6,10,20,.9);border:1px solid rgba(130,95,220,.45);outline:none;transition:border-color .2s ease,box-shadow .2s ease;}
  .plr-name-row input:focus{border-color:rgba(120,215,255,.9);box-shadow:0 0 0 2px rgba(90,210,255,.14),0 0 18px rgba(90,210,255,.28);}
  .plr-name-row button{flex:0 0 auto;padding:9px 18px;border-radius:999px;cursor:pointer;font-size:11px;font-weight:900;
    letter-spacing:.1em;text-transform:uppercase;color:#eafcff;background:linear-gradient(180deg,rgba(46,80,150,.95),rgba(22,36,70,.95));
    border:1px solid rgba(120,210,255,.6);box-shadow:0 0 16px rgba(90,210,255,.25);transition:box-shadow .2s ease,transform .15s ease;}
  .plr-name-row button:hover{box-shadow:0 0 24px rgba(90,210,255,.5);transform:translateY(-1px);}
  .plr-name-hint{margin-top:8px;font-size:11px;line-height:1.45;color:#8f9dc0;}
  .plr-name-hint b{color:#e6f1ff;}
  .plr-tile{padding:12px 14px;border-radius:14px;background:linear-gradient(180deg,rgba(22,18,38,.7),rgba(9,8,18,.7));
    border:1px solid rgba(150,110,255,.2);transition:border-color .2s ease,box-shadow .2s ease;}
  .plr-tile:hover{border-color:rgba(170,120,255,.55);box-shadow:0 0 18px rgba(150,90,240,.25);}
  .plr-tile .pt-label{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#9fb6d8;opacity:.9;}
  .plr-tile .pt-val{font-size:19px;font-weight:900;color:#f2ecff;margin-top:3px;}
  .plr-veil{display:flex;align-items:center;gap:16px;margin-top:16px;padding:14px 18px;border-radius:16px;position:relative;overflow:hidden;
    background:radial-gradient(120% 140% at 50% 0%,rgba(120,90,200,.18),rgba(8,7,18,.9) 72%);
    border:1px solid rgba(150,110,255,.24);}
  .plr-veil::after{content:"";position:absolute;inset:0;pointer-events:none;
    background:linear-gradient(100deg,transparent 40%,rgba(180,150,255,.13) 50%,transparent 60%);animation:pvSweep 7s ease-in-out infinite;}
  @keyframes pvSweep{0%{transform:translateX(-72%)}55%,100%{transform:translateX(72%)}}
  .pv-emblem{flex:0 0 auto;display:flex;}
  .pv-text{display:flex;flex-direction:column;gap:4px;min-width:0;}
  .pv-text b{font-size:13px;letter-spacing:.07em;text-transform:uppercase;color:#cfc2f4;}
  .pv-text span{font-size:12px;line-height:1.45;color:#8f86b8;}
  .pv-text em{font-style:normal;color:#c9b6ff;}
  .plr-friends{margin-top:16px;padding:14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(150,110,255,.18);}
  .plr-friends-head{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#9fb6d8;margin-bottom:9px;}
  .plr-friend-row{display:flex;gap:8px;}
  .plr-friend-row input{flex:1;min-width:0;padding:9px 12px;border-radius:10px;color:#eaf4ff;font-size:13px;
    background:rgba(8,8,18,.9);border:1px solid rgba(150,110,255,.42);outline:none;}
  .plr-friend-row input:focus{border-color:rgba(180,140,255,.9);box-shadow:0 0 14px rgba(150,90,240,.35);}
  .plr-friend-row button{padding:9px 16px;border-radius:10px;cursor:pointer;font-size:12px;font-weight:800;letter-spacing:.06em;
    color:#eafcff;background:linear-gradient(180deg,#221a3a,#141026);border:1px solid rgba(160,120,255,.6);}
  .plr-friend-row button:hover{box-shadow:0 0 16px rgba(160,110,255,.5);}
  .plr-friend-list{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;}
  .plr-friend{display:inline-flex;align-items:center;gap:7px;padding:5px 8px 5px 12px;border-radius:999px;font-size:12px;
    color:#dfd6ff;background:rgba(30,24,52,.85);border:1px solid rgba(150,110,255,.35);}
  .plr-friend button{background:none;border:none;color:#8f86b8;cursor:pointer;font-size:13px;line-height:1;padding:0 2px;}
  .plr-friend button:hover{color:#ff8aa6;}
  .plr-empty{font-size:12px;color:#8f86b8;font-style:italic;}
  .plr-admin{margin-top:14px;padding:14px 16px;border-radius:14px;
    background:linear-gradient(180deg,rgba(52,30,12,.55),rgba(16,10,22,.6));border:1px solid rgba(255,196,90,.45);
    box-shadow:0 0 22px rgba(255,170,60,.16);}
  .plr-admin-head{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#ffd7a3;margin-bottom:9px;}
  .plr-admin-row{display:flex;gap:8px;}
  .plr-admin-row select{flex:1;min-width:0;padding:9px 12px;border-radius:10px;color:#ffe9c4;font-size:13px;
    background:rgba(12,8,18,.92);border:1px solid rgba(255,196,90,.5);outline:none;}
  .plr-admin-row select:focus{border-color:rgba(255,214,138,.95);box-shadow:0 0 14px rgba(255,180,80,.35);}
  .plr-admin-row button{padding:9px 16px;border-radius:10px;cursor:pointer;font-size:12px;font-weight:800;letter-spacing:.06em;
    color:#2a1a06;background:linear-gradient(180deg,#ffd992,#e0a44c);border:1px solid rgba(255,214,138,.9);}
  .plr-admin-row button:hover{box-shadow:0 0 16px rgba(255,190,90,.55);}
  @media (max-width:720px){
    .plr-tiles{grid-template-columns:repeat(2,minmax(0,1fr));}
    .plr-veil{gap:12px;padding:12px 14px;align-items:flex-start;}
    .plr-top{flex-direction:column;text-align:center;}
    .plr-rankinfo{width:100%;}
  }`;

  let injected = false;
  function inject() {
    if (injected) return;
    injected = true;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const ov = document.createElement('div');
    ov.id = 'overlayPlayer';
    ov.className = 'overlay';
    ov.innerHTML =
      '<div id="plrCard">' +
        '<div id="plrHead"><h2>🏅 Player</h2><button id="plrClose" type="button">Close</button></div>' +
        '<div class="plr-top">' +
          '<div class="plr-emblem" id="plrEmblem"></div>' +
          '<div class="plr-rankinfo">' +
            '<div class="plr-title" id="plrTitle">—</div>' +
            '<div class="plr-sub" id="plrSub"></div>' +
            '<div class="plr-track"><span id="plrFill" style="width:0%"></span></div>' +
            '<div class="plr-xp" id="plrXp"></div>' +
          '</div>' +
        '</div>' +
        '<div class="plr-name">' +
          '<div class="plr-name-head">Your username</div>' +
          '<div class="plr-name-row">' +
            '<input id="plrNameInput" maxlength="18" placeholder="Player" autocomplete="off" spellcheck="false" />' +
            '<button id="plrNameSave" type="button">⏎ Enter</button>' +
          '</div>' +
          '<div class="plr-name-hint" id="plrNameHint">Shown in chat and above your fighter.</div>' +
        '</div>' +
        '<div class="plr-tiles" id="plrTiles"></div>' +
        '<div class="plr-admin" id="plrAdmin" style="display:none;">' +
          '<div class="plr-admin-head">⚡ Admin · take any rank</div>' +
          '<div class="plr-admin-row">' +
            '<select id="plrAdminLevel" aria-label="Rank to take"></select>' +
            '<button id="plrAdminGo" type="button">Set rank</button>' +
          '</div>' +
        '</div>' +
        '<div class="plr-veil" id="plrVeil"></div>' +
        '<div class="plr-friends">' +
          '<div class="plr-friends-head">Friends · <span id="plrFriendCount">0</span></div>' +
          '<div class="plr-friend-row">' +
            '<input id="plrFriendInput" maxlength="18" placeholder="Add a friend by name" autocomplete="off" />' +
            '<button id="plrFriendAdd" type="button">Add</button>' +
          '</div>' +
          '<div class="plr-friend-list" id="plrFriendList"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    document.getElementById('plrClose').addEventListener('click', close);
    const addBtn = document.getElementById('plrFriendAdd');
    const input = document.getElementById('plrFriendInput');
    const doAdd = function () { addFriend(input.value); input.value = ''; };
    addBtn.addEventListener('click', doAdd);
    input.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); doAdd(); }
    });
    input.addEventListener('keyup', function (e) { e.stopPropagation(); });

    // Username lives here too: the same name the chat posts and the labels
    // above your fighter read.
    const nameIn = document.getElementById('plrNameInput');
    const nameSave = document.getElementById('plrNameSave');
    const doSave = function () {
      const v = nameIn ? nameIn.value : '';
      if (window.GlobalChat && GlobalChat.saveName) GlobalChat.saveName(v);
      else {
        const n = String(v || '').trim().slice(0, 18) || 'Player';
        try { localStorage.setItem('arenaNick', n); } catch (_) {}
        try { window.dispatchEvent(new CustomEvent('arena:nick', { detail: { name: n } })); } catch (_) {}
      }
      if (nameIn) nameIn.blur();
      paint();
    };
    const adminGo = document.getElementById('plrAdminGo');
    const adminSel = document.getElementById('plrAdminLevel');
    if (adminGo) adminGo.addEventListener('click', function () {
      if (adminSel) setLevel(parseInt(adminSel.value, 10));
    });
    if (nameSave) nameSave.addEventListener('click', doSave);
    if (nameIn) {
      nameIn.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); doSave(); }
      });
      nameIn.addEventListener('keyup', function (e) { e.stopPropagation(); });
      nameIn.addEventListener('keypress', function (e) { e.stopPropagation(); });
    }
  }

  function numStr(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function paint() {
    inject();
    const v = view();
    const emblemEl = document.getElementById('plrEmblem');
    if (emblemEl) emblemEl.innerHTML = emblemSVG(v.level, 92);
    document.getElementById('plrTitle').textContent = v.title;
    document.getElementById('plrSub').textContent = v.secret > 0
      ? 'Level ' + v.level + ' · Secret level ' + v.secret
      : 'Level ' + v.level + ' · ' + RANKS[v.rankIndex].name + ' · Stage ' + ROMAN[v.stage - 1];
    document.getElementById('plrFill').style.width = (v.pct * 100).toFixed(1) + '%';
    document.getElementById('plrXp').textContent = v.capped
      ? 'Sealed until you survive wave ' + v.gate + ' · ' + numStr(v.into) + ' / ' + numStr(v.need) + ' XP banked'
      : numStr(v.into) + ' / ' + numStr(v.need) + ' XP to next stage';

    const rs = (window.RS && window.RS.balance) ? window.RS.balance() : 0;
    const tiles = [
      { label: 'RuneStones', val: numStr(rs) },
      { label: 'Kills', val: numStr(kills()) },
      { label: 'Deaths', val: numStr(deaths()) },
      { label: 'Friends', val: numStr(friends().length) }
    ];
    document.getElementById('plrTiles').innerHTML = tiles.map(function (t) {
      return '<div class="plr-tile"><div class="pt-label">' + t.label + '</div><div class="pt-val">' + t.val + '</div></div>';
    }).join('');

    // The owner gets the ladder itself to pick from; anyone else never sees it.
    const adminEl = document.getElementById('plrAdmin');
    if (adminEl) {
      adminEl.style.display = isAdmin ? 'block' : 'none';
      const sel = document.getElementById('plrAdminLevel');
      if (isAdmin && sel) {
        const top = Math.max(ADMIN_TOP, v.level);
        if (sel.options.length !== top) sel.innerHTML = adminOptions(top);
        sel.value = String(v.level);
      }
    }

    // What lies ahead stays sealed: only the rank the player has earned is
    // ever named, and the next ascent shows as a locked medallion.
    const veilEl = document.getElementById('plrVeil');
    if (veilEl) {
      veilEl.innerHTML =
        '<span class="pv-emblem">' + EM.veiled(64) + '</span>' +
        '<span class="pv-text">' +
          '<b>What comes next is sealed</b>' +
          '<span>No record of the ranks above <em>' + esc(RANKS[v.rankIndex].name) +
          '</em> survives the archive. Climb, and the arena will reveal them.</span>' +
        '</span>';
    }

    // The username field mirrors what chat and the in-game labels use.
    const nameIn = document.getElementById('plrNameInput');
    let nick = '';
    try { nick = localStorage.getItem('arenaNick') || ''; } catch (_) {}
    if (nameIn && document.activeElement !== nameIn) nameIn.value = nick;
    const hint = document.getElementById('plrNameHint');
    if (hint) {
      hint.innerHTML = nick
        ? 'You are <b>' + esc(nick) + '</b> — in chat and above your fighter.'
        : 'Shown in chat and above your fighter.';
    }

    const list = friends();
    const countEl = document.getElementById('plrFriendCount');
    if (countEl) countEl.textContent = String(list.length);
    const listEl = document.getElementById('plrFriendList');
    listEl.innerHTML = list.length
      ? list.map(function (n) {
          return '<span class="plr-friend">' + esc(n) + '<button data-name="' + esc(n) + '" aria-label="Remove">✕</button></span>';
        }).join('')
      : '<span class="plr-empty">No friends added yet.</span>';
    Array.prototype.forEach.call(listEl.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { removeFriend(b.dataset.name); });
    });
  }

  const HUBS = ['overlayIntro', 'overlayHome', 'overlaySingle', 'overlayOffline'];
  let returnTo = 'overlayIntro';

  function open() {
    inject();
    refreshAdmin();
    paint();
    for (let i = 0; i < HUBS.length; i++) {
      const el = document.getElementById(HUBS[i]);
      if (el && el.style.display === 'grid') { returnTo = HUBS[i]; break; }
    }
    document.querySelectorAll('.overlay').forEach(function (o) { if (o.id !== 'overlayPlayer') o.style.display = 'none'; });
    document.getElementById('overlayPlayer').style.display = 'grid';
  }
  function close() {
    const ov = document.getElementById('overlayPlayer');
    if (ov) ov.style.display = 'none';
    const back = document.getElementById(returnTo) || document.getElementById('overlayIntro');
    if (back) back.style.display = 'grid';
  }

  function addFriend(name) {
    const n = String(name || '').trim().slice(0, 18);
    if (!n) return;
    const a = friends();
    if (a.some(function (x) { return x.toLowerCase() === n.toLowerCase(); })) return;
    a.push(n);
    saveFriends(a);
    paint();
    change();
  }
  function removeFriend(name) {
    saveFriends(friends().filter(function (x) { return x !== name; }));
    paint();
    change();
  }

  // ---- Admin: take any rank ---------------------------------------------
  // The game's owner alone may skip the climb — everyone else has to earn it.
  // Taking a rank writes the XP that rank costs and raises the survival
  // record to the wave it is gated behind, so the ladder never seals it.
  const KEY_AUTH_EMAIL = 'arenaAuthEmail';
  const OWNER_HANDLES = ['deathlyviper', 'clementwhat@gmail.com', 'marcuspop13@proton.me', 'theinternet731@gmail.com', '26howleyf@tonbridge-school.org'];
  let isAdmin = false;

  function isOwnerHandles(user) {
    if (!user) return false;
    const ids = [user.username, user.email].filter(Boolean).map(function (v) { return String(v).toLowerCase().trim(); });
    for (let i = 0; i < ids.length; i++) {
      if (OWNER_HANDLES.indexOf(ids[i]) >= 0) return true;
      if (OWNER_HANDLES.indexOf(ids[i].split('@')[0]) >= 0) return true;
    }
    return false;
  }

  // The account reaches the game two ways: the message the hosting page posts,
  // and the copy it leaves in storage. Reading both means admin status never
  // depends on that single message arriving after these scripts are ready.
  function signedIn() {
    if (window.__arenaAuth) return window.__arenaAuth;
    let email = '';
    try { email = localStorage.getItem(KEY_AUTH_EMAIL) || ''; } catch (_) {}
    return email ? { isAuthenticated: true, email: email } : null;
  }

  function refreshAdmin() {
    const on = isOwnerHandles(signedIn());
    if (on === isAdmin) return;
    isAdmin = on;
    const ov = document.getElementById('overlayPlayer');
    if (ov && ov.style.display === 'grid') paint();
  }

  window.addEventListener('message', function (e) {
    const d = e.data || {};
    if (d.type !== 'auth:user') return;
    window.__arenaAuth = d;
    refreshAdmin();
  });

  // ...and the secret levels past the last rank, which are otherwise only
  // reached by surviving deep into the arena.
  const ADMIN_SECRETS = 50;
  const ADMIN_TOP = MAX_LEVEL + ADMIN_SECRETS;

  function xpForLevel(l) {
    let total = 0;
    for (let i = 1; i < l; i++) total += levelCost(i);
    return total;
  }

  function setLevel(l) {
    const lv = Math.max(1, Math.min(999, Math.floor(Number(l) || 1)));
    writeNum(KEY_XP, xpForLevel(lv));
    const gate = waveGate(lv);
    if (gate > bestWave()) { try { localStorage.setItem('arenaBest', String(gate)); } catch (_) {} }
    change();
  }

  function adminOptions(top) {
    let html = '';
    for (let l = 1; l <= top; l++) {
      const p = parts(l);
      const label = p.secret > 0
        ? 'Lv ' + l + ' · Secret ' + p.secret
        : 'Lv ' + l + ' · ' + RANKS[p.rankIndex].name + ' · ' + ROMAN[p.stage - 1];
      html += '<option value="' + l + '">' + esc(label) + '</option>';
    }
    return html;
  }

  // ---- Main-page + multiplayer rank readouts ---------------------------
  let heroSig = '';
  function rankBarHTML(v, big) {
    return '<span class="rh-emblem">' + emblemSVG(v.level, big || 40) + '</span>' +
      '<span class="rh-text">' +
        '<span class="rh-title">' + esc(v.title) + '</span>' +
        '<span class="rh-track"><span class="rh-fill" style="width:' + (v.pct * 100).toFixed(1) + '%"></span></span>' +
        '<span class="rh-xp">' + xpLine(v) + '</span>' +
      '</span>';
  }

  // Refilling the bar in place keeps the medallion's 3D sway running instead
  // of restarting it on every kill.
  function paintBar(el, v, big) {
    const sig = v.level + '|' + (v.capped ? 'sealed' + v.gate : 'open');
    if (el.dataset.sig && el.dataset.sig === sig) {
      const fill = el.querySelector('.rh-fill');
      const xp = el.querySelector('.rh-xp');
      if (fill) fill.style.width = (v.pct * 100).toFixed(1) + '%';
      if (xp) xp.textContent = xpLine(v);
      return;
    }
    el.dataset.sig = sig;
    el.innerHTML = rankBarHTML(v, big);
  }

  function refreshHero() {
    const v = view();
    const sig = v.level + ':' + v.into + ':' + v.need;
    if (sig === heroSig) return;
    heroSig = sig;

    let hero = document.getElementById('rankHero');
    if (!hero) {
      const card = document.querySelector('#overlayIntro .arena-card');
      const sub = card && card.querySelector('.arena-subtitle');
      if (card && sub) {
        hero = document.createElement('div');
        hero.id = 'rankHero';
        hero.title = 'Open your player profile';
        hero.addEventListener('click', open);
        sub.insertAdjacentElement('afterend', hero);
      }
    }
    if (hero) paintBar(hero, v, 44);

    let chip = document.getElementById('mpRankChip');
    if (!chip) {
      const head = document.querySelector('#overlayHome .card h2');
      if (head) {
        chip = document.createElement('div');
        chip.id = 'mpRankChip';
        chip.style.cursor = 'pointer';
        chip.addEventListener('click', open);
        head.insertAdjacentElement('afterend', chip);
      }
    }
    if (chip) paintBar(chip, v, 30);
  }

  function change() {
    heroSig = '';
    refreshHero();
    const ov = document.getElementById('overlayPlayer');
    if (ov && ov.style.display === 'grid') paint();
    try { window.dispatchEvent(new CustomEvent('rank:changed')); } catch (_) {}
  }

  // ---- Init ------------------------------------------------------------
  function init() {
    inject();
    refreshAdmin();
    refreshHero();
    const navBtn = document.getElementById('introPlayer');
    if (navBtn) navBtn.addEventListener('click', open);
    window.addEventListener('resize', function () { heroSig = ''; refreshHero(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // The hubs are shown/hidden repeatedly; keep the readouts attached.
  setInterval(function () { heroSig = ''; refreshAdmin(); refreshHero(); }, 2500);
  setInterval(sampleGame, 120);

  // The ladder itself is deliberately not exported: nothing in the game can
  // enumerate the ranks a player has not reached yet.
  window.RankXP = {
    levelCost, levelFor, parts, view, emblemSVG, badgeHTML,
    xp, level, kills, deaths, friends,
    add, addKill, addWave, addDeath, addQuest,
    addFriend, removeFriend,
    open, close, paint,
    isAdmin: function () { return isAdmin; }
  };
})();
