// ============================================================
// Monster Arena — RECORD BEACON
// ------------------------------------------------------------
// The hall's leaderboard lives on the host page (it is the only side with the
// database). This reports the fighter's own standing up to it now and then,
// and keeps the board it sends back in one place every module can read:
// window.__arenaRecords.
//
// A record carries the name, the rank, the highest wave cleared and the kills
// banked on this device. The developer account is flagged so its admin runs
// never sit at the top of the board.
// ============================================================
(function () {
  'use strict';

  window.__arenaRecords = window.__arenaRecords || [];

  function stat() {
    const rank = window.RankXP || null;
    let best = 0, kills = 0, level = 1, staff = false;
    try { best = parseInt(localStorage.getItem('arenaBest') || '0', 10) || 0; } catch (_) {}
    try { kills = rank && rank.kills ? rank.kills() : 0; } catch (_) {}
    try { level = rank && rank.level ? rank.level() : 1; } catch (_) {}
    try { staff = localStorage.getItem('arenaDevAccount') === '1'; } catch (_) {}
    return { best: best, kills: kills, rank: level, staff: staff };
  }

  let lastSent = '';
  function post() {
    const s = stat();
    if (!s.best && !s.kills) return;
    const key = s.best + ':' + s.kills + ':' + s.rank + ':' + s.staff;
    if (key === lastSent) return;
    lastSent = key;
    try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'arena:progress', best: s.best, kills: s.kills, rank: s.rank, staff: s.staff }, '*'); } catch (_) {}
  }

  window.addEventListener('message', function (e) {
    const d = e.data;
    if (!d || d.type !== 'arena:records') return;
    window.__arenaRecords = Array.isArray(d.rows) ? d.rows : [];
    try { window.dispatchEvent(new CustomEvent('arena:records', { detail: window.__arenaRecords })); } catch (_) {}
  });

  setInterval(post, 20000);
  window.addEventListener('pagehide', post);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') post();
  });

  // The hall wants the board the moment it can draw it.
  setTimeout(function () {
    try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'arena:records-request' }, '*'); } catch (_) {}
  }, 2200);

  window.RecordBeacon = { refresh: post, stat: stat };
})();
