// ============================================================
// Monster Arena — DUEL SCREENS.
// Everything the 1v1 room needs outside the arena itself:
//   · the setup table where both fighters pick rounds and map,
//   · the countdown, the round banner and the live score,
//   · the result card (and the ladder points it pays),
//   · matchmaking for a duel against a random player (or a bot after 10s),
//   · the shared duel leaderboard.
// Exposes window.DuelUI.
// ============================================================
(function () {
  'use strict';

  const MAPS = [
    { id: 1, name: 'Meadow', color: '#7dffa3' },
    { id: 2, name: 'Desert', color: '#ffd166' },
    { id: 3, name: 'Ice Cavern', color: '#9fe3ff' },
    { id: 4, name: 'Lava Pits', color: '#ff7a66' },
    { id: 5, name: 'Neon Void', color: '#c08bff' }
  ];
  const ROUND_CHOICES = [1, 3, 5, 7, 10];

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mapName = (id) => (MAPS.find((m) => m.id === Number(id)) || {}).name || '—';

  const CSS = `
  #duelOverlay { position:fixed; inset:0; z-index:75; display:none; align-items:center; justify-content:center;
    background:radial-gradient(60rem 40rem at 50% 30%, rgba(34,230,255,.12), transparent 70%), rgba(4,6,12,.9);
    font-family:'Cinzel',Georgia,serif; color:#dbeaf5; padding:18px; }
  #duelOverlay.on { display:flex; }
  .duel-card { width:min(680px,96vw); max-height:92vh; overflow:auto; padding:22px 22px 18px; border-radius:18px;
    background:linear-gradient(180deg,#101828,#0a0e18); border:1px solid #2a3a63;
    box-shadow:0 0 60px rgba(0,229,255,.16), inset 0 0 40px rgba(0,229,255,.05); text-align:center; }
  .duel-kicker { font-size:10px; letter-spacing:.42em; text-transform:uppercase; color:#7ce8ff; opacity:.85; }
  .duel-title { margin:6px 0 4px; font-size:clamp(22px,4.4vw,34px); letter-spacing:.14em; text-transform:uppercase;
    background:linear-gradient(180deg,#fff,#9fe8ff 60%,#3b8dff); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .duel-sub { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#8fa6c8; margin-bottom:14px; }
  .duel-row { margin:14px 0 4px; }
  .duel-label { display:block; font-size:10px; letter-spacing:.3em; text-transform:uppercase; color:#7f93b5; margin-bottom:8px; }
  .duel-picks { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
  .duel-pick { min-width:58px; padding:9px 14px; border-radius:10px; cursor:pointer; font-family:inherit;
    font-size:13px; letter-spacing:.1em; color:#cfe3f7; background:#111a2b; border:1px solid #2b3d66; transition:.16s; }
  .duel-pick:hover { border-color:#4b7fd6; color:#fff; }
  .duel-pick.on { background:linear-gradient(180deg,#0d3a4d,#0a2333); border-color:#22e6ff; color:#d9fbff;
    box-shadow:0 0 18px rgba(34,230,255,.35); }
  .duel-side { display:flex; gap:10px; margin-top:14px; text-align:left; }
  .duel-side > div { flex:1; padding:10px 12px; border-radius:12px; background:#0c1422; border:1px solid #22304f; }
  .duel-side b { display:block; font-size:10px; letter-spacing:.24em; text-transform:uppercase; color:#7f93b5; margin-bottom:4px; font-weight:400; }
  .duel-side span { font-size:13px; color:#e7f4ff; }
  .duel-note { margin-top:14px; font-size:11px; line-height:1.6; color:#7f93b5; }
  .duel-big { font-size:clamp(46px,11vw,92px); font-weight:900; line-height:1; letter-spacing:.06em; color:#eafcff;
    text-shadow:0 0 26px rgba(0,229,255,.7), 0 0 70px rgba(0,120,255,.35); }
  .duel-actions { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:16px; }
  .duel-btn { padding:11px 22px; border-radius:999px; cursor:pointer; font-family:inherit; font-size:11px;
    letter-spacing:.28em; text-transform:uppercase; color:#eafdff; background:linear-gradient(180deg,#123049,#0a1a2a);
    border:1px solid #22e6ff; box-shadow:0 0 20px rgba(34,230,255,.25); }
  .duel-btn.ghost { border-color:#2b3d66; color:#9fb4c9; box-shadow:none; background:#0c1422; }
  #duelHud { position:fixed; top:8px; left:50%; transform:translateX(-50%); z-index:64; display:none;
    padding:7px 16px; border-radius:999px; background:rgba(8,12,22,.82); border:1px solid #2b3d66;
    font-family:'Cinzel',Georgia,serif; font-size:11px; letter-spacing:.24em; text-transform:uppercase; color:#cfe3f7; }
  #duelHud.on { display:block; }
  #duelHud b { color:#22e6ff; }
  #duelHud .duel-score { margin-left:10px; color:#ffd76a; }
  #duelBanner { position:fixed; top:34%; left:50%; transform:translate(-50%,-50%); z-index:66; display:none;
    font-family:'Cinzel',Georgia,serif; font-size:clamp(26px,6vw,54px); font-weight:900; letter-spacing:.18em;
    text-transform:uppercase; color:#fff; text-shadow:0 0 30px rgba(0,229,255,.8); pointer-events:none; }
  #duelBanner.on { display:block; animation:duelPop .5s ease-out both; }
  @keyframes duelPop { from { opacity:0; transform:translate(-50%,-50%) scale(.8); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
  #duelQueueOv { position:fixed; inset:0; z-index:78; display:none; align-items:center; justify-content:center;
    background:rgba(4,6,12,.92); font-family:'Cinzel',Georgia,serif; color:#dbeaf5; text-align:center; padding:18px; }
  #duelQueueOv.on { display:flex; }
  .duel-spin { width:64px; height:64px; margin:0 auto 16px; border-radius:50%; border:3px solid #1d2b47;
    border-top-color:#22e6ff; animation:duelSpin 1s linear infinite; }
  @keyframes duelSpin { to { transform:rotate(360deg); } }
  .duel-board { width:100%; border-collapse:collapse; margin-top:10px; font-size:12px; }
  .duel-board th { font-size:9px; letter-spacing:.2em; text-transform:uppercase; color:#7f93b5; font-weight:400; padding:4px 6px; text-align:left; }
  .duel-board td { padding:5px 6px; border-top:1px solid #1b2740; color:#cfe3f7; }
  .duel-board tr.me td { color:#22e6ff; }
  .duel-board td.duel-rank { white-space:nowrap; color:#9fb4c9; font-size:11px; }
  .duel-board td.duel-rank img { width:19px; height:19px; vertical-align:-5px; margin-right:6px; }
  .duel-foe { display:block; margin-top:3px; font-size:10px; letter-spacing:.08em; color:#9fb4c9; }
  .duel-foe img { width:15px; height:15px; vertical-align:-3px; margin-right:5px; }
  `;

  let injected = false;
  let root = null;
  let card = null;
  let hud = null;
  let banner = null;
  let queueOv = null;

  let myPick = { rounds: null, levelId: null };
  let banked = false;
  let lastPhase = '';
  let bannerTimer = 0;

  function inject() {
    if (injected) return;
    injected = true;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    root = document.createElement('div');
    root.id = 'duelOverlay';
    root.innerHTML = '<div class="duel-card" id="duelCard"></div>';
    document.body.appendChild(root);
    card = document.getElementById('duelCard');

    hud = document.createElement('div');
    hud.id = 'duelHud';
    document.body.appendChild(hud);

    banner = document.createElement('div');
    banner.id = 'duelBanner';
    document.body.appendChild(banner);

    queueOv = document.createElement('div');
    queueOv.id = 'duelQueueOv';
    queueOv.innerHTML =
      '<div><div class="duel-spin"></div>' +
      '<div class="duel-kicker">Ranked duel</div>' +
      '<h2 class="duel-title" style="font-size:26px">Finding an opponent</h2>' +
      '<p class="duel-sub" id="duelQueueText">Searching the arena…</p>' +
      '<div class="duel-actions"><button class="duel-btn ghost" id="duelQueueCancel" type="button">Cancel</button></div></div>';
    document.body.appendChild(queueOv);
    document.getElementById('duelQueueCancel')?.addEventListener('click', cancelQueue);
  }

  const snap = () => (window.Net && Net.state ? Net.state.snapshot : null);
  const mode = () => {
    const s = snap();
    return String((s && s.meta && s.meta.mode) || (window.Net && Net.state.meta && Net.state.meta.mode) || '');
  };
  const duel = () => {
    const s = snap();
    return s && s.meta && s.meta.duel ? s.meta.duel : null;
  };
  const active = () => mode() === 'duel';
  const myId = () => (window.Net && Net.state ? Net.state.peerId : null);
  const players = () => {
    const s = snap();
    return s && Array.isArray(s.players) ? s.players : [];
  };
  const opponentName = () => {
    const me = myId();
    const other = players().find((p) => p.id !== me);
    if (other) return other.name || 'Opponent';
    const d = duel();
    if (d && d.bot) return 'Arena Wanderer';
    return 'Waiting…';
  };

  function voteOf(id) {
    const d = duel();
    return d && d.votes ? d.votes[id] : null;
  }
  function otherVote() {
    const d = duel();
    const me = myId();
    if (!d || !d.votes) return null;
    const key = Object.keys(d.votes).find((k) => k !== me);
    return key ? d.votes[key] : null;
  }

  function pick(rounds, levelId) {
    if (rounds != null) myPick.rounds = rounds;
    if (levelId != null) myPick.levelId = levelId;
    if (window.Net && Net.duelVote) Net.duelVote(myPick.rounds, myPick.levelId);
    paint(true);
  }

  function voteScreen(d) {
    const mine = voteOf(myId()) || myPick;
    const theirs = otherVote();
    const rounds = ROUND_CHOICES.map((n) =>
      `<button class="duel-pick${mine && mine.rounds === n ? ' on' : ''}" type="button" data-rounds="${n}">${n}</button>`
    ).join('');
    const maps = MAPS.map((m) =>
      `<button class="duel-pick${mine && mine.levelId === m.id ? ' on' : ''}" type="button" data-map="${m.id}"
        style="color:${m.color};border-color:${mine && mine.levelId === m.id ? m.color : '#2b3d66'}">${m.name}</button>`
    ).join('');
    const both = !!(mine && mine.rounds && mine.levelId) && !!(theirs && theirs.rounds && theirs.levelId);
    const head = d && d.bot ? 'Duel setup' : 'Duel setup';
    return `
      <div class="duel-kicker">Private duel · 1v1</div>
      <h2 class="duel-title">${head}</h2>
      <p class="duel-sub">${both ? 'Terms agreed — the arena is opening' : 'Agree the terms before the first shot'}</p>
      <div class="duel-row"><span class="duel-label">Rounds</span><div class="duel-picks">${rounds}</div></div>
      <div class="duel-row"><span class="duel-label">Map</span><div class="duel-picks">${maps}</div></div>
      <div class="duel-side">
        <div><b>You</b><span>${mine && mine.rounds ? mine.rounds + ' rounds' : '—'} · ${mine && mine.levelId ? mapName(mine.levelId) : '—'}</span></div>
        <div><b>${esc(opponentName())}</b><span>${theirs && theirs.rounds ? theirs.rounds + ' rounds' : '—'} · ${theirs && theirs.levelId ? mapName(theirs.levelId) : '—'}</span></div>
      </div>
      <p class="duel-note">
        Disagree? The rounds are averaged out to a whole number and a split map is rolled at random.
        Every round starts with full health and full ammo; most rounds won takes the duel.
      </p>
      <div class="duel-actions">
        <button class="duel-btn ghost" type="button" id="duelLeave">Leave</button>
      </div>`;
  }

  function countdownScreen(d) {
    const mine = (d.wins || {})[myId()] || 0;
    const theirs = Object.keys(d.wins || {}).filter((k) => k !== myId()).reduce((n, k) => n + (d.wins[k] || 0), 0);
    return `
      <div class="duel-kicker">${esc(mapName(d.levelId))} · ${d.rounds} round${d.rounds === 1 ? '' : 's'}</div>
      <h2 class="duel-title">Duel begins</h2>
      <div class="duel-big" style="margin:18px 0">${Math.max(1, d.in || 1)}</div>
      <p class="duel-sub">${esc(opponentName())} · ${theirs} — ${mine} · you</p>`;
  }

  function overScreen(d) {
    const me = myId();
    const won = d.winner === me;
    const draw = !d.winner;
    const mine = (d.wins || {})[me] || 0;
    const theirs = Object.keys(d.wins || {}).filter((k) => k !== me).reduce((n, k) => n + (d.wins[k] || 0), 0);
    const rank = window.DuelRanks ? DuelRanks.tier() : null;
    const next = window.DuelRanks ? DuelRanks.nextTier() : null;
    return `
      <div class="duel-kicker">Duel complete</div>
      <h2 class="duel-title">${draw ? 'Draw' : won ? 'Victory' : 'Defeat'}</h2>
      <p class="duel-sub">${esc(opponentName())} · ${theirs} — ${mine} · you</p>
      ${rank ? `<div class="duel-row"><span class="duel-label">Duel rank</span>
        <span style="font-size:15px;color:${rank.color};letter-spacing:.16em">${esc(rank.name)}</span>
        <p class="duel-note">${window.DuelRanks.points()} ladder points · ${window.DuelRanks.wins()}W ${window.DuelRanks.losses()}L${next ? ' · next rank at ' + next.at : ''}</p></div>` : ''}
      <div class="duel-actions">
        <button class="duel-btn" type="button" id="duelAgain">Back to lobby</button>
      </div>`;
  }

  function roundBanner(d) {
    const me = myId();
    if (d.phase === 'roundover') {
      const won = d.roundWinner === me;
      return { text: won ? 'Round won' : (d.roundWinner ? 'Round lost' : 'Round drawn'), color: won ? '#22e6ff' : '#ff5a6a' };
    }
    return null;
  }

  // A fresh round is a fresh fighter: health and every magazine refill the
  // moment the next round begins, exactly as the arena promises.
  let lastRound = 0;
  function resetLocalFight() {
    const p = window.__arenaPlayer;
    const guns = window.__arenaWeapons;
    if (!p) return;
    // Falling in one round used to leave the camera following the killer into
    // the next one — a body watching from above that could not move or shoot,
    // so the round never resolved. A new round hands the fighter back.
    try { if (window.__pveEndSpectate) window.__pveEndSpectate(); } catch (_) {}
    // The death screen is drawn by the page around the game: a round lost must
    // not leave it sitting over the next one.
    try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'player-respawned' }, '*'); } catch (_) {}
    if (Array.isArray(guns)) {
      p.wstats = {};
      guns.forEach((w, i) => {
        p.wstats[i] = { ammo: w.ammo, reserve: w.reserve, reloading: false, reloadT: 0, lastShot: 0 };
      });
      const cur = guns[p.weapon] || guns[0];
      if (cur) { p.ammo = cur.ammo; p.reserve = cur.reserve; }
    }
    p.reloading = false;
    p.reloadT = 0;
    p.hp = p.hpMax || 100;
    // Both fighters were just put back on their marks by the room: stand on
    // the mark the room picked instead of walking the old spot back to it.
    const st = window.Net && Net.state;
    const list = st && st.snapshot && Array.isArray(st.snapshot.players) ? st.snapshot.players : null;
    const me = list ? list.find((q) => q && q.id === st.peerId) : null;
    if (me) {
      p.x = me.x;
      p.y = me.y;
      p.z = 0;
      if (window.NetReconcile) { try { NetReconcile.reconcile(); } catch (_) {} }
    }
  }

  // Who you are fighting, with the rank they carry into the pit.
  function foeLine() {
    const snap = window.Net && Net.state && Net.state.snapshot;
    const foe = snap && Array.isArray(snap.bots) ? snap.bots[0] : null;
    const R = window.DuelRanks;
    if (!foe || foe.dp == null || !R) return '';
    const t = R.tierFor(foe.dp);
    return `<span class="duel-foe"><img src="${R.emblem(foe.dp)}" alt="" />${esc(foe.name)} · ${esc(t.name)}</span>`;
  }

  function paint(force) {
    inject();
    if (!active()) {
      root.classList.remove('on');
      hud.classList.remove('on');
      banner.classList.remove('on');
      lastPhase = '';
      return;
    }
    const d = duel();
    if (!d) { root.classList.remove('on'); hud.classList.remove('on'); return; }

    // The ladder is banked exactly once per finished duel.
    if (d.phase === 'over' && !banked) {
      banked = true;
      try { if (window.DuelRanks) DuelRanks.record(d.winner === myId()); } catch (_) {}
    }
    if (d.phase === 'vote') banked = false;

    if (d.phase === 'vote') {
      root.classList.add('on');
      hud.classList.remove('on');
      banner.classList.remove('on');
      // Both players' picks arrive on the snapshot: repaint only when one of
      // them actually changed, so the buttons never flicker under the finger.
      const mineNow = voteOf(myId()) || myPick;
      const theirsNow = otherVote();
      const sig = [mineNow && mineNow.rounds, mineNow && mineNow.levelId,
        theirsNow && theirsNow.rounds, theirsNow && theirsNow.levelId, opponentName()].join('|');
      if (force || lastPhase !== 'vote' || card.dataset.sig !== sig) {
        card.dataset.sig = sig;
        card.innerHTML = voteScreen(d);
        card.querySelectorAll('[data-rounds]').forEach((b) =>
          b.addEventListener('click', () => pick(Number(b.dataset.rounds), null)));
        card.querySelectorAll('[data-map]').forEach((b) =>
          b.addEventListener('click', () => pick(null, Number(b.dataset.map))));
        document.getElementById('duelLeave')?.addEventListener('click', leave);
      }
    } else if (d.phase === 'countdown') {
      root.classList.add('on');
      hud.classList.remove('on');
      const sig = 'cd' + (d.in || 0);
      if (card.dataset.sig !== sig) {
        card.dataset.sig = sig;
        card.innerHTML = countdownScreen(d);
      }
    } else if (d.phase === 'live' || d.phase === 'roundover') {
      root.classList.remove('on');
      // A duel starts on its own terms: the lobby's Start button has no say.
      const startBtn = document.getElementById('mpStartBtn');
      if (startBtn) startBtn.style.display = 'none';
      if (d.phase === 'live' && d.round !== lastRound) {
        lastRound = d.round;
        resetLocalFight();
      }
      const mine = (d.wins || {})[myId()] || 0;
      const theirs = Object.keys(d.wins || {}).filter((k) => k !== myId()).reduce((n, k) => n + (d.wins[k] || 0), 0);
      hud.innerHTML = `Duel · round <b>${Math.min(d.round, d.rounds)}</b>/${d.rounds}` +
        `<span class="duel-score">${mine} — ${theirs}</span>` +
        foeLine();
      hud.classList.add('on');
      const b = roundBanner(d);
      if (b && lastPhase !== 'roundover') {
        banner.textContent = b.text;
        banner.style.color = b.color;
        banner.classList.add('on');
        clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => banner.classList.remove('on'), 2600);
      }
      if (d.phase !== 'roundover') banner.classList.remove('on');
    } else if (d.phase === 'over') {
      root.classList.add('on');
      hud.classList.remove('on');
      banner.classList.remove('on');
      card.innerHTML = overScreen(d);
      document.getElementById('duelAgain')?.addEventListener('click', leave);
    }
    lastPhase = d.phase;
  }

  async function leave() {
    try { if (window.Net && Net.leave) await Net.leave(); } catch (_) {}
    root.classList.remove('on');
    hud.classList.remove('on');
    // Out of the pit and back to the menu the match came from.
    const home = document.getElementById('btnHome') || document.getElementById('homeBtn2');
    if (home) { try { home.click(); } catch (_) {} }
    try { window.dispatchEvent(new CustomEvent('duel:left')); } catch (_) {}
  }

  // ---- matchmaking -------------------------------------------------------
  let queueTimer = 0;
  let queued = false;

  function showQueue() {
    inject();
    queued = true;
    queueOv.classList.add('on');
    let left = 10;
    const txt = document.getElementById('duelQueueText');
    if (txt) txt.textContent = 'Searching the arena… a bot steps in after 10s';
    clearInterval(queueTimer);
    queueTimer = setInterval(() => {
      left -= 1;
      const t = document.getElementById('duelQueueText');
      if (t && left > 0) t.textContent = 'Searching the arena… ' + left + 's until a bot steps in';
      if (left <= 0) clearInterval(queueTimer);
    }, 1000);
  }

  function hideQueue() {
    queued = false;
    clearInterval(queueTimer);
    if (queueOv) queueOv.classList.remove('on');
  }

  function cancelQueue() {
    hideQueue();
    try { if (window.Net && Net.cancelDuel) Net.cancelDuel(); } catch (_) {}
  }

  async function findDuel() {
    if (!window.Net || !Net.findDuel) { alert('Networking is not ready yet — try again in a second.'); return; }
    showQueue();
    let res = null;
    try { res = await Net.findDuel(window.DuelRanks ? DuelRanks.nickname() : 'Player'); } catch (_) { res = null; }
    hideQueue();
    if (!res || !res.room) { alert('Matchmaking is unavailable right now. Try again.'); return; }
    // A fresh room: the queue seat is dropped so the duel room is a clean slate.
    try { await Net.leave(); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('net:meta', { detail: {} })); } catch (_) {}
    try {
      await Net.join('duel', (window.DuelRanks ? DuelRanks.nickname() : 'Player'), null, {
        lobbyId: res.room, duelBot: !!res.bot, fresh: true
      });
    } catch (err) {
      alert(err && err.message ? err.message : 'Could not open the duel.');
      return;
    }
    document.querySelectorAll('.overlay').forEach((o) => { o.style.display = 'none'; });
    // The room's own "started" signal boots the arena for both fighters.
  }

  // ---- the shared board --------------------------------------------------
  async function loadBoard() {
    const host = document.getElementById('duelBoard');
    if (!host) return;
    host.innerHTML = '<div class="mp-hint">Loading the duel ladder…</div>';
    const rows = (window.DuelRanks ? await DuelRanks.fetchBoard() : []) || [];
    if (!rows.length) {
      host.innerHTML = '<div class="mp-hint">No duels have been fought yet — be the first name on the board.</div>';
      return;
    }
    const me = window.DuelRanks ? DuelRanks.nickname() : '';
    const R = window.DuelRanks;
    host.innerHTML = '<table class="duel-board"><thead><tr><th>#</th><th>Duelist</th><th>Rank</th><th>Points</th><th>W</th><th>L</th><th>Streak</th></tr></thead><tbody>' +
      rows.map((r, i) => {
        const t = R ? R.tierFor(r.points) : null;
        const ico = R ? R.emblem(r.points) : '';
        return `<tr class="${r.name === me ? 'me' : ''}"><td>${i + 1}</td>` +
          `<td>${esc(r.name)}</td>` +
          `<td class="duel-rank"><img src="${ico}" alt="" />${t ? esc(t.name) : ''}</td>` +
          `<td>${r.points}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.streak || 0}</td></tr>`;
      }).join('') +
      '</tbody></table>';
  }

  window.addEventListener('net:snapshot', () => paint(false));
  window.addEventListener('net:meta', () => paint(false));
  window.addEventListener('duel:found', () => hideQueue());

  // The board lives on the multiplayer home: fill it the first time that home
  // is actually on screen, then leave refreshes to the tap on it.
  let boardLoaded = false;
  setInterval(() => {
    if (boardLoaded) return;
    const home = document.getElementById('overlayHome');
    if (!home || home.style.display === 'none') return;
    boardLoaded = true;
    loadBoard();
  }, 1200);

  window.DuelUI = { active, findDuel, loadBoard, leave, paint, cancelQueue };
})();
