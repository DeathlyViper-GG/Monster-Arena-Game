// ============================================================
// Monster Arena — DUEL LADDER (local record + global board).
// Every duel played is banked on this device: wins, losses, streak and ladder
// points. The same result is reported to the app, which keeps the one shared
// leaderboard every player appears on.
// Exposes window.DuelRanks.
// ============================================================
(function () {
  'use strict';

  const K_WINS = 'arena_duel_wins';
  const K_LOSSES = 'arena_duel_losses';
  const K_STREAK = 'arena_duel_streak';

  const read = (k) => { try { return parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch (_) { return 0; } };
  const write = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (_) {} };

  // The ladder a duelist climbs. Points are the same ones the shared board
  // counts: three for a duel won, one for a duel lost.
  const TIERS = [
    { at: 0, name: 'Ashborn', color: '#9fb4c9' },
    { at: 9, name: 'Iron Duelist', color: '#c9d6e6' },
    { at: 27, name: 'Bronze Duelist', color: '#d9a066' },
    { at: 54, name: 'Silver Duelist', color: '#d8e6f2' },
    { at: 90, name: 'Gold Duelist', color: '#ffce5a' },
    { at: 135, name: 'Platinum Duelist', color: '#8ff3e0' },
    { at: 195, name: 'Diamond Duelist', color: '#8fd3ff' },
    { at: 270, name: 'Arena Legend', color: '#ff8ae0' }
  ];

  const wins = () => read(K_WINS);
  const losses = () => read(K_LOSSES);
  const streak = () => read(K_STREAK);
  const points = () => wins() * 3 + losses();

  function tier() {
    let out = TIERS[0];
    for (const t of TIERS) if (points() >= t.at) out = t;
    return out;
  }

  function nextTier() {
    for (const t of TIERS) if (points() < t.at) return t;
    return null;
  }

  // ---- rank emblems ------------------------------------------------------
  // Every rung of the ladder gets its own badge image: a shield in the tier's
  // colour, a star that grows as the ladder climbs and one pip per rung, so a
  // name on the board reads as a rank before its number does.
  const EMBLEMS = {};
  function tierIndex(pts) {
    const p = Number(pts) || 0;
    let idx = 0;
    for (let i = 0; i < TIERS.length; i++) if (p >= TIERS[i].at) idx = i;
    return idx;
  }
  function tierFor(pts) { return TIERS[tierIndex(pts)]; }
  function emblem(pts) {
    const idx = tierIndex(pts);
    if (EMBLEMS[idx]) return EMBLEMS[idx];
    const col = TIERS[idx].color;
    const R1 = 6 + idx * 0.7, R2 = R1 * 0.44;
    const star = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? R2 : R1;
      star.push((32 + Math.cos(a) * r).toFixed(1) + ',' + (26 + Math.sin(a) * r).toFixed(1));
    }
    const n = idx + 1;
    let pips = '';
    for (let i = 0; i < n; i++) {
      const x = 32 - (n - 1) * 3.1 + i * 6.2;
      pips += '<circle cx="' + x.toFixed(1) + '" cy="50" r="1.9" fill="' + col + '"/>';
    }
    const wings = idx >= 4
      ? '<path d="M7 27 L17 23 M57 27 L47 23" stroke="' + col + '" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>'
      : '';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<path d="M32 3 L57 13 V34 C57 47 46 57 32 61 C18 57 7 47 7 34 V13 Z" fill="#0b1220" stroke="' + col + '" stroke-width="3"/>' +
      wings +
      '<polygon points="' + star.join(' ') + '" fill="' + col + '"/>' +
      pips +
      '</svg>';
    EMBLEMS[idx] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return EMBLEMS[idx];
  }

  function record(won) {
    if (won) {
      write(K_WINS, wins() + 1);
      write(K_STREAK, streak() + 1);
    } else {
      write(K_LOSSES, losses() + 1);
      write(K_STREAK, 0);
    }
    const row = { wins: wins(), losses: losses(), streak: streak(), points: points(), tier: tier().name };
    // The shared board only knows a name; the game reports the outcome and the
    // app works out the points itself.
    try {
      window.parent.postMessage({ type: 'duel:result', name: nickname(), won: !!won }, '*');
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('arena:duel', { detail: { won: !!won } }));
    } catch (_) {}
    // Duels feed the same XP ladder the rest of the arena does.
    try {
      if (window.RankXP && window.RankXP.add) {
        window.RankXP.add(won ? 120 : 45, won ? 'Duel won' : 'Duel fought');
      }
    } catch (_) {}
    return row;
  }

  function nickname() {
    try { return localStorage.getItem('arenaNick') || 'Player'; } catch (_) { return 'Player'; }
  }

  let boardCache = null;
  function fetchBoard() {
    return new Promise((resolve) => {
      const done = (rows) => { boardCache = rows; resolve(rows); };
      const onData = (e) => {
        const d = e && e.data;
        if (!d || d.type !== 'duel:board:data') return;
        window.removeEventListener('message', onData);
        clearTimeout(timer);
        done(Array.isArray(d.rows) ? d.rows : []);
      };
      const timer = setTimeout(() => {
        window.removeEventListener('message', onData);
        done(boardCache || []);
      }, 6000);
      window.addEventListener('message', onData);
      try {
        window.parent.postMessage({ type: 'duel:board', name: nickname() }, '*');
      } catch (_) {
        clearTimeout(timer);
        window.removeEventListener('message', onData);
        done(boardCache || []);
      }
    });
  }

  window.DuelRanks = { wins, losses, streak, points, tier, nextTier, record, fetchBoard, TIERS, nickname, tierFor, tierIndex, emblem };
})();
