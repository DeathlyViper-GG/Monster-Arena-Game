// ============================================================
// Monster Arena — MELEE IN A LIVE MATCH
// ------------------------------------------------------------
// Offline the blade sweeps the local monster list. In a room the other
// fighters live in the snapshot instead: the players opposite you and the
// bots filling the seats. This finds whoever the swing actually reached and
// hands the hit to the room, which is the only place damage may land online.
//
// The engine calls MeleeNet.sweep() from its own melee step, so the cone,
// reach and per-swing hit set are the same ones the offline game uses.
// ============================================================
(function () {
  'use strict';

  function sweep(snap, melee, DMG, RANGE, ARC, ang, player) {
    const Net = window.Net;
    if (!snap || !melee || !player || !Net || typeof Net.sendHit !== 'function') return;
    const myId = Net.state && Net.state.peerId;
    const mine = (snap.players || []).find(function (p) { return p.id === myId; });
    const myTeam = mine ? mine.team : null;
    if (!melee._hitSet) melee._hitSet = new Set();

    function swing(o, kind) {
      if (!o || o.id == null || melee._hitSet.has(o.id)) return;
      if (kind === 'player' && (o.hp == null ? 1 : o.hp) <= 0) return;
      const dx = o.x - player.x, dy = o.y - player.y;
      if (Math.hypot(dx, dy) > RANGE + (o.r || 16)) return;
      const dir = Math.atan2(dy, dx);
      const diff = Math.abs(((dir - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff > ARC / 2) return;
      // Team-mates are not cut by their own side's blade.
      if (window.TEAMS_MODE && myTeam != null && o.team === myTeam) return;
      if (typeof window.DN === 'function') { try { window.DN(o.x, o.y, DMG, kind); } catch (_) {} }
      Net.sendHit(o.id, o.x, o.y, DMG, 'melee');
      melee._hitSet.add(o.id);
    }

    (snap.players || []).forEach(function (p) { if (p.id !== myId) swing(p, 'player'); });
    (snap.bots || []).forEach(function (b) { swing(b, 'bot'); });
  }

  window.MeleeNet = { sweep: sweep };
})();
