/* =====================================================================
   net_reconcile.js — the body you stand in is the body everyone sees.

   The room accepts the position each client reports, but it also blocks
   walls and holds the arena edge, so now and then the two disagree: a
   shove, a stride into a wall, a respawn. Left alone that gap grows, and a
   shot fired from the local body leaves from a spot the rest of the match
   does not have you standing in.

   This eases the local body onto the room's answer. Small gaps are left
   alone (they are only the prediction running a little ahead, and pulling
   on those would rubber-band every step), a real gap is walked back, and a
   teleport is jumped.
   ===================================================================== */
(function (G) {
  'use strict';

  const state = () => (G.Net && G.Net.state && G.Net.state.lobbyId) ? G.Net.state : null;

  function mine(st, list) {
    for (let i = 0; i < list.length; i++) if (list[i] && list[i].id === st.peerId) return list[i];
    return null;
  }

  function reconcile() {
    const st = state();
    const p = G.__arenaPlayer;
    if (!st || !p || !st.snapshot || !st.peerId) return;
    if ((p.hp ?? 1) <= 0) return;
    if (G._CUTSCENE_ACTIVE || G.STAGE_CUTSCENE_ACTIVE || G._GAUNTLET_INTRO) return;
    const list = st.snapshot.players;
    if (!Array.isArray(list)) return;
    const me = mine(st, list);
    if (!me || (me.hp ?? 1) <= 0) return;
    // A slide covers ground faster than the room hears about it, so the two
    // positions disagree for a moment by design. Pulling on that is exactly
    // what made the dash feel like it was being dragged backwards: leave the
    // whole slide and its recovery alone.
    if ((p.dashI ?? 0) > 0) return;
    if ((p.dashCD ?? 0) > 0.85) return;
    // Mid-hop the body passes over walls and hazards the room still counts as
    // solid, so the two disagree by design until it lands. Pulling on that was
    // the yank backwards felt while jumping and running at the same time.
    const gz = (G.W3 && G.W3.enabled && G.W3.surfaceZ) ? G.W3.surfaceZ(p.x, p.y, p.z) : 0;
    if ((p.z ?? 0) - gz > 4) { airUntil = performance.now() + 260; return; }
    if (performance.now() < airUntil) return;
    const dx = me.x - p.x, dy = me.y - p.y;
    const d = Math.hypot(dx, dy);
    // Only a real disagreement is corrected: prediction lag alone is ~30-50px
    // while running, and chasing that would drag the player backwards.
    if (d < 80) return;
    const k = d > 240 ? 1 : 0.35;
    p.x += dx * k;
    p.y += dy * k;
  }

  // Time until which the body counts as still in the air (and just after).
  let airUntil = 0;

  let last = 0;
  function loop() {
    requestAnimationFrame(loop);
    const t = performance.now();
    if (t - last < 60) return;
    last = t;
    try { reconcile(); } catch (e) {}
  }
  requestAnimationFrame(loop);

  G.NetReconcile = { reconcile };
})(window);
