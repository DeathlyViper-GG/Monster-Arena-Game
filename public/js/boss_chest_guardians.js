// ============================================================
// Monster Arena — BOSS REWARD CACHES
// When a PvE boss falls it leaves caches in random corners of the arena, and
// every cache is circled by a ring of guards that orbits it:
//
//   common / rare  → raveners (the fast swarming chasers)
//   epic           → raveners with a few elemental monsters mixed in
//   legendary      → nothing but elemental monsters
//
// A ring holds formation until the cache is opened or someone steps into it,
// then the guards break off and fight like any other monster.
// Exposes window.BossGuardians.
// ============================================================
(function () {
  'use strict';

  const RING_SPD = 0.5;         // radians per second
  const AGGRO = 180;            // stepping this close breaks the ring
  const ELEMENTS = ['magmalurk', 'stormcaller', 'rimewarden', 'quakestrider', 'soulmote'];

  // Who guards a cache of each rarity: how many, how many of them elemental, and
  // how wide the ring sits (the elementals are big, so they need the room).
  const GUARDS = {
    common:    { n: 5, elem: 0, ring: 96 },
    rare:      { n: 6, elem: 1, ring: 106 },
    epic:      { n: 6, elem: 3, ring: 134 },
    legendary: { n: 7, elem: 7, ring: 152 },
  };
  const MAX_RING = 152;

  let cacheN = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rand(a, b + 1));

  function env() {
    const G = window._Gauntlet;
    if (!G || !G.world || !G.player || !G.enemies) return null;
    return { G, world: G.world, player: G.player, enemies: G.enemies };
  }
  function netActive() { return !!(window.Net && window.Net.state && window.Net.state.lobbyId); }

  // Open ground, away from the player and from the caches already placed, with
  // the whole orbit walkable — otherwise the guards would circle through walls.
  function spawnSpot(world, player, taken, ringR) {
    for (let tries = 0; tries < 140; tries++) {
      const x = rand(150, world.w - 150), y = rand(150, world.h - 150);
      if ((x - player.x) ** 2 + (y - player.y) ** 2 < 380 * 380) continue;
      if (world.isBlocked(x, y, 26) || world.collideHazard(x, y, 26)) continue;
      if (taken.some((p) => (x - p.x) ** 2 + (y - p.y) ** 2 < 320 * 320)) continue;
      let ringOk = true;
      for (let k = 0; k < 10 && ringOk; k++) {
        const a = (k / 10) * Math.PI * 2;
        if (world.isBlocked(x + Math.cos(a) * (ringR || MAX_RING), y + Math.sin(a) * (ringR || MAX_RING), 16)) ringOk = false;
      }
      if (ringOk) return { x, y };
    }
    return null;
  }

  function spawnRing(cx, cy, chest, rarity) {
    const E = env();
    if (!E) return;
    const cfg = GUARDS[rarity] || GUARDS.common;
    const step = (Math.PI * 2) / cfg.n;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const R = cfg.ring;
    const before = E.enemies.length;

    for (let i = 0; i < cfg.n; i++) {
      const type = i < cfg.elem ? ELEMENTS[rint(0, ELEMENTS.length - 1)] : 'chaser';
      const a = i * step;
      E.G.spawnEnemy(type, cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    }

    // Tag the monsters that actually made it into the world with their orbit.
    const added = E.enemies.slice(before);
    added.forEach((e, i) => {
      e._ringChest = chest;
      e._ringAng = i * step;
      e._ringR = R;
      e._ringSpd = dir * (RING_SPD + rand(-0.06, 0.06));
    });
  }

  // A boss has fallen: place its reward caches and set the guards circling.
  function onBossDeath(x, y) {
    if (window.STORY_ACTIVE || window.HOLLOW_GAUNTLET_ACTIVE || window._GAUNTLET_INTRO) return;
    if (netActive()) return;
    const E = env();
    if (!E) return;

    // Caches from an earlier boss would pile up untouched — clear them first,
    // and let their guards off the leash so none of them circle a ghost.
    const stale = [];
    for (let i = E.world.deathChests.length - 1; i >= 0; i--) {
      const c = E.world.deathChests[i];
      if (c && c.from === 'Boss') { stale.push(c); E.world.deathChests.splice(i, 1); }
    }
    if (stale.length) for (const e of E.enemies) if (stale.indexOf(e._ringChest) >= 0) e._ringChest = null;

    if (!Array.isArray(E.world.deathChests)) E.world.deathChests = [];
    const taken = [];
    for (let i = 0; i < 2; i++) {
      const rarity = (E.G.bossChestRarity && E.G.bossChestRarity()) || 'common';
      const spot = spawnSpot(E.world, E.player, taken, (GUARDS[rarity] || GUARDS.common).ring);
      if (!spot) continue;
      taken.push(spot);

      const chest = {
        id: 'boss' + (++cacheN), x: spot.x, y: spot.y, z: 0, floor: 0,
        r: 22, opened: false, buildingIndex: -1, rarity, from: 'Boss', t: 0
      };
      E.world.deathChests.push(chest);
      spawnRing(chest.x, chest.y, chest, rarity);
      if (E.G.addEffect) E.G.addEffect(chest.x, chest.y, 'pop', 0.6, '#ffd166');
    }
  }

  // Called from the engine's enemy AI for every monster: returns true while the
  // guard holds its orbit (which this moves it along), so the normal chase never
  // starts. Nothing is returned true once the cache is taken.
  function hold(e, dt) {
    const ch = e._ringChest;
    if (!ch) return false;
    if (ch.opened) { e._ringChest = null; return false; }
    const E = env();
    if (!E) return false;
    const px = E.player.x, py = E.player.y;
    if ((px - ch.x) ** 2 + (py - ch.y) ** 2 < AGGRO * AGGRO) { e._ringChest = null; return false; }

    e._ringAng += e._ringSpd * dt;
    e.x = ch.x + Math.cos(e._ringAng) * e._ringR;
    e.y = ch.y + Math.sin(e._ringAng) * e._ringR;
    e.vx = 0; e.vy = 0;
    return true;
  }

  window.BossGuardians = { onBossDeath, hold };
})();
