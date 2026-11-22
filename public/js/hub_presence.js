/* =====================================================================
   hub_presence.js — everyone in the hall is in the same hall.

   The walking menu runs inside the game frame, which has no SDK, so the
   shell page owns the room and relays it (see Game.jsx). This side keeps
   a list of the other orbs in the building and reports where mine is
   standing, a few times a second.
   ===================================================================== */
(function (G) {
  'use strict';

  const st = {
    joined: false,
    seat: null,
    connId: null,
    others: new Map(), // seat -> { seat, name, tx, tz, tyaw, design, color, seen }
    lastSend: 0
  };

  function post(msg) {
    try {
      if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*');
    } catch (_) {}
  }

  function skin() {
    const S = G.ArenaCustomize && G.ArenaCustomize();
    return { design: S ? (S.design | 0) : 0, color: S ? (S.outfit | 0) : 0 };
  }

  function nick() {
    const n = (localStorage.getItem('arenaNick') || '').trim();
    if (n) return n.slice(0, 18);
    const a = (G.__accountName || '').trim();
    return (a || 'Player').slice(0, 18);
  }

  function start() {
    if (st.joined) return;
    st.joined = true;
    st.connId = sessionStorage.getItem('hubConn');
    if (!st.connId) {
      st.connId = 'hub-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('hubConn', st.connId);
    }
    post({ type: 'hub:join', connId: st.connId });
  }

  function stop() {
    if (!st.joined) return;
    st.joined = false;
    st.seat = null;
    st.others.clear();
    post({ type: 'hub:leave' });
  }

  function absorb(u) {
    if (!u || u.seat == null || u.seat === st.seat) return;
    const had = st.others.get(u.seat) || {};
    st.others.set(u.seat, {
      seat: u.seat,
      name: u.name || had.name || 'Player',
      design: u.design != null ? u.design : (had.design | 0),
      color: u.color != null ? u.color : (had.color | 0),
      tx: u.x != null ? u.x : (had.tx || 0),
      tz: u.z != null ? u.z : (had.tz || 0),
      tyaw: u.yaw != null ? u.yaw : (had.tyaw || 0),
      seen: performance.now()
    });
  }

  window.addEventListener('message', function (e) {
    const d = e.data;
    if (!d || d.type !== 'hub:msg') return;
    const m = d.data || {};
    if (m.type === 'you') {
      st.seat = m.seat;
      // My own seat arriving means the list must drop me from the others.
      st.others.delete(m.seat);
    } else if (m.type === 'hall') {
      const keep = new Set();
      for (const u of m.users || []) {
        if (u && u.seat != null) keep.add(u.seat);
        absorb(u);
      }
      for (const seat of [...st.others.keys()]) if (!keep.has(seat)) st.others.delete(seat);
    } else if (m.type === 'move') {
      absorb(m.u);
    } else if (m.type === 'left') {
      st.others.delete(m.seat);
    }
  });

  // Called from the hall as it moves: ~9 updates a second is plenty for a walk.
  function send(x, z, yaw) {
    if (!st.joined) return;
    const now = performance.now();
    if (now - st.lastSend < 110) return;
    st.lastSend = now;
    const s = skin();
    post({
      type: 'hub:send',
      data: {
        type: 'move',
        name: nick(),
        x: Math.round(x),
        z: Math.round(z),
        yaw: Math.round(yaw * 100) / 100,
        design: s.design,
        color: s.color
      }
    });
  }

  G.HubPresence = {
    start,
    stop,
    send,
    others: () => st.others,
    seat: () => st.seat,
    online: () => st.others.size + (st.joined ? 1 : 0)
  };
})(window);
