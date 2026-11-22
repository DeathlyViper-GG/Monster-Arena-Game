// ============================================================
// Monster Arena — PVP KILL LEADERBOARD
// PvP matches are won by eliminations, so the HUD keeps a running board of who
// has taken the most players out. The server credits the kill and ships the
// tally in its snapshot; this only draws it, and only in a live PvP match.
// ============================================================
(function () {
  'use strict';

  const statEl = () => document.getElementById('pvpKillsStat');
  const boardEl = () => document.getElementById('pvpKillsBoard');
  let sig = '';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function myId() {
    const N = window.Net;
    return (N && N.state && (N.state.peerId || N.state.myId)) || null;
  }

  function hide() {
    const s = statEl();
    if (s) s.style.display = 'none';
    sig = '';
  }

  function modeOf(snap) {
    const N = window.Net;
    return String(
      (snap && snap.mode) ||
      (snap && snap.meta && snap.meta.mode) ||
      (N && N.state && N.state.meta && N.state.meta.mode) || ''
    ).toLowerCase();
  }

  function render(snap) {
    const s = statEl(), b = boardEl();
    if (!s || !b) return;
    if (!snap || !Array.isArray(snap.players) || modeOf(snap) !== 'pvp') { hide(); return; }

    const kills = (snap.pvpKills && typeof snap.pvpKills === 'object') ? snap.pvpKills : {};
    const me = myId();
    const rows = snap.players
      .filter((p) => p && p.id)
      .map((p) => ({ id: p.id, name: p.name || 'Player', n: kills[p.id] || 0, me: p.id === me }))
      .sort((a, b2) => b2.n - a.n || String(a.name).localeCompare(String(b2.name)))
      .slice(0, 5);

    const next = rows.map((r) => r.name + ':' + r.n + (r.me ? '*' : '')).join('|');
    s.style.display = '';
    if (next === sig) return;
    sig = next;

    b.className = 'leaderboard leaderboard-horiz';
    b.innerHTML = rows.map((r, i) =>
      '<div class="row rank-' + (i + 1) + '">' +
        '<span class="rank">' + (i + 1) + '</span>' +
        '<span class="name">' + esc(r.name) + (r.me ? ' (you)' : '') + '</span>' +
        '<span class="score">' + r.n + '</span>' +
      '</div>'
    ).join('');
  }

  window.addEventListener('net:snapshot', (e) => render(e.detail));
  window.addEventListener('net:meta', (e) => { if (!e.detail || !e.detail.started) hide(); });
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'net:closed') hide();
  });

  window.PvPKills = { render: render, hide: hide };
})();
