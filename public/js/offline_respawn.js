// ============================================================
// Monster Arena — offline respawn screen.
//
// Offline Teams and Capture the Flag never spectate: a fallen player is out
// for five seconds, watching a team-coloured countdown, and then comes back
// on their own spawn. The mode modules (teams_mode.js / ctf_mode.js) own the
// revive itself — this file only owns that five-second moment on screen, and
// makes sure the camera is never left following somebody else's fighter.
//
// Online lobbies are untouched: their revive is server-run and shown by
// respawn_overlay.js.
// ============================================================
(function () {
  'use strict';

  const WAIT = 5;                       // seconds down before respawning
  const TEAM = {
    0: { name: 'BLUE TEAM', glow: '#3aa6ff' },
    1: { name: 'RED TEAM', glow: '#ff4a4a' }
  };

  let host = null, ring = null, countEl = null, teamLabel = null, subEl = null, flashEl = null;
  let dead = false, deadline = 0, team = 0, raf = 0;

  // A lobby runs its own revive and its own screen (respawn_overlay.js); this
  // one belongs to the offline modes only.
  const serverRun = () => !!(window.NetObjectives && window.NetObjectives.isRespawnMode && window.NetObjectives.isRespawnMode());

  function ensure() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'offlineRespawn';
    host.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:58', 'display:none',
      'align-items:center', 'justify-content:center', 'pointer-events:auto',
      'overscroll-behavior:none', 'backdrop-filter:blur(7px)',
      'background:radial-gradient(ellipse at 50% 45%, rgba(6,8,16,.6), rgba(3,4,8,.93) 72%)',
      'font-family:system-ui,-apple-system,"Segoe UI",sans-serif'
    ].join(';');

    host.innerHTML =
      '<div style="position:relative;text-align:center;padding:28px 24px;max-width:92vw">' +
        '<div id="orTeam" style="font:800 12px/1 system-ui,sans-serif;letter-spacing:.42em;text-transform:uppercase;opacity:.9"></div>' +
        '<h2 style="margin:14px 0 4px;font:900 clamp(30px,8vw,64px)/1 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#f2f7ff;text-shadow:0 0 34px rgba(90,160,255,.45)">You Are Down</h2>' +
        '<p id="orSub" style="margin:6px 0 22px;font:600 12px/1.5 system-ui,sans-serif;letter-spacing:.28em;text-transform:uppercase;opacity:.62;color:#cfe1ff">Returning to your spawn</p>' +
        '<div style="position:relative;width:min(210px,52vw);aspect-ratio:1;margin:0 auto">' +
          '<svg viewBox="0 0 120 120" style="position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)">' +
            '<circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="4"/>' +
            '<circle id="orRing" cx="60" cy="60" r="54" fill="none" stroke="#3aa6ff" stroke-width="4" stroke-linecap="round" stroke-dasharray="339.3" stroke-dashoffset="0" style="filter:drop-shadow(0 0 10px currentColor)"/>' +
          '</svg>' +
          '<div id="orCount" style="position:absolute;inset:0;display:grid;place-items:center;font:900 clamp(44px,13vw,76px)/1 system-ui,sans-serif;color:#fff;text-shadow:0 0 26px rgba(120,180,255,.6)">5</div>' +
        '</div>' +
      '</div>' +
      '<div id="orFlash" style="position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .45s ease"></div>';

    document.body.appendChild(host);
    ring = host.querySelector('#orRing');
    countEl = host.querySelector('#orCount');
    teamLabel = host.querySelector('#orTeam');
    subEl = host.querySelector('#orSub');
    flashEl = host.querySelector('#orFlash');
  }

  function paint(left) {
    if (countEl) countEl.textContent = left > 0 ? String(Math.ceil(left)) : 'GO';
    if (ring) ring.setAttribute('stroke-dashoffset', String(339.3 * (1 - Math.max(0, Math.min(1, left / WAIT)))));
  }

  // The mode's own revive timer is the authority — the countdown on screen is
  // the same clock the freeze runs on, so the two can never drift apart.
  function modeState() {
    const snap = (window.CTF_MODE && window.CTF && window.CTF.snapshot && window.CTF.snapshot())
      || (window.TEAMS_MODE && window.Teams && window.Teams.snapshot && window.Teams.snapshot());
    return snap && typeof snap.revive === 'number' ? snap : null;
  }

  function frame() {
    raf = 0;
    if (!dead) return;
    const snap = modeState();
    const left = snap ? Math.max(0, snap.revive) : Math.max(0, (deadline - Date.now()) / 1000);
    paint(left);
    // Back on the field the moment the mode's freeze lifts — and straight down
    // if the match ends while the player was down.
    if (left <= 0 || (snap && snap.over)) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }

  // A short team-coloured flash as the player lands back on the field.
  function finish() {
    dead = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (!host) return;
    flashEl.style.background = 'radial-gradient(circle at 50% 50%, ' + TEAM[team].glow + '55, transparent 62%)';
    flashEl.style.transition = 'none';
    flashEl.style.opacity = '1';
    requestAnimationFrame(function () {
      flashEl.style.transition = 'opacity .45s ease';
      flashEl.style.opacity = '0';
    });
    setTimeout(function () { if (!dead && host) host.style.display = 'none'; }, 470);
  }

  function start(teamIdx) {
    if (dead || serverRun()) return false;
    ensure();
    team = teamIdx === 1 ? 1 : 0;
    const look = TEAM[team];
    teamLabel.textContent = look.name;
    teamLabel.style.color = look.glow;
    ring.setAttribute('stroke', look.glow);
    ring.style.color = look.glow;
    subEl.textContent = 'Returning to your spawn';

    // Down means down: no spectating, and the camera stays with the player.
    if (window.hideSpectate) window.hideSpectate();
    const st = window.__dbg && window.__dbg.state;
    if (st) { st.spectating = false; st.specTarget = null; }

    dead = true;
    deadline = Date.now() + WAIT * 1000;
    paint(WAIT);
    host.style.display = 'flex';
    if (!raf) raf = requestAnimationFrame(frame);
    return true;
  }

  function hide() {
    dead = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (host) host.style.display = 'none';
  }

  window.OfflineRespawn = { start: start, hide: hide, get active() { return dead; } };
})();
