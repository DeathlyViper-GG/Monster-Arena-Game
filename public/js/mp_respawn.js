// ============================================================
// Monster Arena — host-controlled respawn for online matches.
//
// The host decides whether a fallen player may come back into the SAME match.
// With it on, the death screen's "Rise Again" asks the lobby to revive them at
// their spawn; everyone stays in the same lobby, on the same map, with the
// same people. With it off, death ends that player's match.
//
// It also owns the clean exit: Exit and the death screen's Home leave the
// lobby and reboot the game frame, so nothing stale (lobby code, chosen map,
// match flags) survives — exactly like the player refreshed the game.
// ============================================================
(() => {
  'use strict';
  const KEY = 'arenaMpRespawn';
  const $ = (id) => document.getElementById(id);
  const st = () => (window.Net && window.Net.state) || null;
  const online = () => !!(st() && st().lobbyId);
  const meta = () => (st() && st().meta) || {};
  const isHost = () => !!(st() && (st().isHost || meta().isHost));
  // On by default: a lobby starts with respawns allowed unless the host says no.
  const pref = () => { try { return localStorage.getItem(KEY) !== '0'; } catch (_) { return true; } };

  // ---- the host's switch, inside the lobby ----------------------------
  let row = null, seen = '';

  function paint() {
    if (!row) return;
    const live = online();
    // Outside a lobby the switch just records your choice, which travels with
    // you when you create or join — so it is always on screen and usable.
    const value = live ? !!meta().respawn : pref();
    const host = live ? isHost() : true;
    const sig = (live ? 1 : 0) + ':' + (value ? 1 : 0) + ':' + (host ? 1 : 0);
    if (sig === seen) return;
    seen = sig;

    row.style.display = 'flex';
    row.querySelectorAll('[data-respawn]').forEach((b) => {
      b.classList.toggle('is-active', (b.dataset.respawn === '1') === value);
      b.disabled = !host;
      b.style.opacity = host ? '1' : '.5';
      b.style.cursor = host ? 'pointer' : 'default';
    });
    const note = row.querySelector('#mpRespawnNote');
    if (note) {
      note.textContent = !live
        ? (value ? 'On — fallen players can rejoin. Set by the lobby host.'
                 : 'Off — one life, no rejoin. Set by the lobby host.')
        : value
          ? (host ? 'On — a fallen player presses Rise Again to rejoin this match.'
                  : 'On — the host lets fallen players rejoin.')
          : (host ? 'Off — one life: death ends your match.'
                  : 'Off — one life.');
    }
  }

  function build() {
    const card = $('overlayHome') && $('overlayHome').querySelector('.card');
    if (row || !card) return;
    row = document.createElement('div');
    row.id = 'mpRespawnRow';
    row.className = 'mp-team-row';
    row.style.marginTop = '10px';
    row.innerHTML =
      '<span class="mp-label">Respawn</span>' +
      '<button class="mp-team-btn" type="button" data-respawn="1">On</button>' +
      '<button class="mp-team-btn" type="button" data-respawn="0">Off</button>' +
      '<span class="mp-hint" id="mpRespawnNote">On — fallen players press Rise Again to rejoin.</span>';
    // Sits high in the card, right under the lobby panel, so it is on screen
    // without scrolling.
    const anchor = $('mpLobbyPanel') || $('mpTeamRow');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(row, anchor.nextSibling);
    else card.insertBefore(row, card.firstChild);

    row.addEventListener('click', (e) => {
      const b = e.target.closest('[data-respawn]');
      if (!b || b.disabled) return;
      const on = b.dataset.respawn === '1';
      try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) {}
      seen = '';
      // The lobby is the authority — every client follows its snapshot.
      if (online() && isHost() && window.Net.setRespawn) window.Net.setRespawn(on);
      paint();
    });
    paint();
  }

  // ---- death screen ---------------------------------------------------
  // Teams and Capture the Flag always bring their fallen back; every other
  // mode follows the host's switch.
  function allowed() {
    // Offline keeps its own rule: PvE may rise again, practice PvP may not.
    if (!online()) return !window.PVP_MODE;
    const mode = meta().mode;
    if (mode === 'teams' || mode === 'ctf') return true;
    return !!meta().respawn;
  }

  function meNow() {
    const s = st() && st().snapshot;
    if (!s || !Array.isArray(s.players)) return null;
    return s.players.find((p) => p && p.id === st().peerId) || null;
  }

  // Back into the running match the same way the host's Start puts everyone
  // in: the lobby keeps simulating, this client only rebuilds its view of it.
  function enterMatch() {
    const p = window.__pvePlayer ? window.__pvePlayer() : null;
    if (p) p.hp = p.hpMax || 100;
    window.NET_DEAD = false;
    const restart = $('btnRestart');
    if (restart) restart.click();
  }

  function onRise() {
    if (!online() || !allowed()) return false;
    if (window.Net.respawn) window.Net.respawn();
    const t0 = Date.now();
    (function wait() {
      const me = meNow();
      if (me && (me.hp || 0) > 0) { enterMatch(); return; }
      // No confirmation from the lobby: fall back to the clean restart rather
      // than leave the player staring at a dead screen.
      if (Date.now() - t0 > 1600) { fullReset(); return; }
      setTimeout(wait, 90);
    })();
    return true;
  }

  // ---- clean exit -----------------------------------------------------
  // Leave the lobby for real and come back up on a fresh menu: no lobby code,
  // no chosen map, no match flags left behind.
  function fullReset() {
    // The match is over for this player: stop it before anything is torn down,
    // so no revive or restart timer is left running behind the reload.
    try { if (window._hardStopGame) window._hardStopGame(); } catch (_) {}
    try { if (window.Net && window.Net.leave) window.Net.leave(); } catch (_) {}
    try {
      if (window.Net && window.Net.state) {
        window.Net.state.stopped = true;
        window.Net.state.lobbyId = null;
        window.Net.state.peerId = null;
        window.Net.state.snapshot = null;
        window.Net.state.meta = null;
      }
    } catch (_) {}
    ['arenaLevel', 'level', 'arenaMode', 'arenaLobby', 'arenaMpTeam'].forEach((k) => {
      try { localStorage.removeItem(k); } catch (_) {}
    });
    try { sessionStorage.removeItem('arenaConnId'); } catch (_) {}
    window.TEAMS_MODE = false;
    window.CTF_MODE = false;
    window.PVP_MODE = false;
    window.BOTS_ENABLED = false;
    window.MP_MODE_PICKED = false;
    window.MP_MAP_ID = null;
    window.MENU_CONTEXT = 'intro';
    // A fresh boot of the game frame, without a ?lobby= code that would walk
    // straight back into the match that was just left.
    try { location.replace(location.pathname); } catch (_) { location.reload(); }
  }

  function onHome() {
    fullReset();
    return true;
  }

  // ---- wiring ---------------------------------------------------------
  const ready = () => { build(); paint(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
  window.addEventListener('net:meta', () => { seen = ''; paint(); });
  window.addEventListener('net:snapshot', paint);
  $('btnIntroMulti')?.addEventListener('click', () => setTimeout(ready, 0));

  const exitBtn = $('btnExit');
  if (exitBtn) exitBtn.onclick = () => fullReset();

  window.MPRespawn = { allowed, onRise, onHome, fullReset, paint };
})();
