// ============================================================
// Monster Arena — online glyph mirror.
// The live match runs on the server: it owns the essence a player earned and
// the glyph nodes they enchanted. This mirrors that authoritative state into
// the client's local run state, so the glyph picker shows real essence, the
// enchant button can afford what the server will accept, and every unlocked
// node (burn, arc jumps, drench, wisps, golem…) actually runs on screen in
// online PvE instead of only in offline play.
// ============================================================
(function () {
  'use strict';

  function treeFor(state, el) {
    state.unlocks = state.unlocks || {};
    if (!state.unlocks[el]) state.unlocks[el] = {};
    const u = state.unlocks[el];
    if (!Array.isArray(u.tree)) {
      u.tree = [[false, false, false], [false, false, false], [false, false, false]];
    }
    return u.tree;
  }

  // Additive only: a node the server has granted is lit locally, and a node the
  // client just bought optimistically is never yanked back out from under it.
  function apply(me, state, player, essenceEl) {
    if (!me || !state || !player) return;

    if (Number.isFinite(me.essence) && me.essence !== state.essence) {
      state.essence = me.essence;
      if (essenceEl) essenceEl.textContent = String(state.essence);
    }

    if (me.glyphPath !== undefined && me.glyphPath !== player.glyphPath) {
      player.glyphPath = me.glyphPath;
      state.path = me.glyphPath;
    }

    if (!me.glyph) return;
    if (!player.glyph) player.glyph = {};
    const keys = (window.GlyphUI && window.GlyphUI.keys) || null;

    for (const el in me.glyph) {
      const nodes = me.glyph[el] || {};
      if (!player.glyph[el]) player.glyph[el] = {};
      for (const key in nodes) {
        if (!nodes[key] || player.glyph[el][key]) continue;
        player.glyph[el][key] = true;
        const map = keys && keys[el];
        if (!map) continue;
        const tree = treeFor(state, el);
        for (let b = 0; b < map.length; b++) {
          const tier = map[b].indexOf(key);
          if (tier >= 0) tree[b][tier] = true;
        }
      }
    }
  }

  window.NetGlyphSync = { apply };
})();
