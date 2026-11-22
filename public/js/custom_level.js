// ============================================================
// Monster Arena — COMMUNITY LEVELS (player-built arenas)
// ------------------------------------------------------------------
// A level built in the Level Editor is stored as plain data: a realm,
// a wave count, a list of waves (which monsters, which warden) and a
// designed map — obstacles, buildings, loose chests and random chest
// generators, all in arena coordinates.
//
// This file is the only place that data touches the engine:
//   * the designed map replaces the procedural scatter (via the
//     _onWorldBuilt hook the engine already calls after a rebuild),
//   * each wave asks this file which monsters it may spawn and whether
//     a warden arrives,
//   * the run ends on the level's last wave with its own result card.
// Nothing here runs unless a level has actually been launched.
// ============================================================
(function () {
  'use strict';

  const LEVELS = ['Meadow', 'Desert', 'Ice Cavern', 'Lava Pits', 'Neon Void'];
  const WALL = 18;     // building wall thickness, same as the generator
  const DOOR = 96;     // doorway carved out of every building's south wall
  const BOX = 400;     // radius searched for a free spot around a generator

  const CustomLevel = {
    def: null,

    set(def) {
      CustomLevel.def = (def && def.name) ? def : null;
      CustomLevel._watchWave();
    },

    // A run can never outlast the builder's last wave, whatever the arena's own
    // wave loop believes. This watches the live wave counter and ends the level
    // the moment it steps past the last wave the builder wrote.
    _watchWave() {
      window.clearInterval(CustomLevel._watch);
      CustomLevel._watch = window.setInterval(function () {
        const d = CustomLevel.def;
        if (!d || d.mode === 'pvp') return;
        const n = typeof window.__pveWave === 'function' ? Number(window.__pveWave()) || 0 : 0;
        if (n > CustomLevel.waveCount()) CustomLevel.complete();
      }, 500);
    },

    clear() {
      CustomLevel.def = null;
      window.clearTimeout(CustomLevel._spawnTimer);
      window.clearInterval(CustomLevel._watch);
      // The flags a level switches on belong to that level only: the arena's own
      // modes must come back with their intro and their own rules.
      window._SKIP_INTRO = false;
      CustomLevel._built = false;
    },

    active() {
      return !!CustomLevel.def;
    },

    waveCount() {
      const n = Number(CustomLevel.def && CustomLevel.def.wave_count);
      return Math.max(1, Math.min(60, n || 5));
    },

    waveDef(n) {
      const waves = (CustomLevel.def && Array.isArray(CustomLevel.def.waves)) ? CustomLevel.def.waves : [];
      for (let i = 0; i < waves.length; i++) {
        if (Number(waves[i] && waves[i].n) === Number(n)) return waves[i];
      }
      return null;
    },

    typesForWave(n) {
      const w = CustomLevel.waveDef(n);
      const t = (w && Array.isArray(w.types)) ? w.types.filter(Boolean) : [];
      return t.length ? t : null;
    },

    bossForWave(n) {
      const w = CustomLevel.waveDef(n);
      const b = w && w.boss;
      return (b && b !== 'none') ? b : null;
    },

    // ---- launching -------------------------------------------------------
    start(def) {
      if (!def || !def.name) return;
      // The host keeps offering the level until it hears back that this run is
      // under way; a repeat of the same level must never restart the match.
      if (CustomLevel.def && def.id && CustomLevel.def.id === def.id) return;
      CustomLevel.set(def);
      window.clearTimeout(CustomLevel._spawnTimer);
      // The arena drops back to its menu a few seconds after it boots; a level
      // that is already running must keep the screen.
      window._SKIP_INTRO = true;
      window.TRAINING_GROUND = false;
      window.DEBUG_NO_ENEMIES = false;
      // A PvP level is dressed in the same map but fought as a free-for-all,
      // with bots filling the empty slots; a survival level clears its waves.
      const pvp = def.mode === 'pvp';
      window.PVP_MODE = pvp;
      window.BOTS_ENABLED = pvp;
      window.OFFLINE_MODE_TYPE = pvp ? 'pvp' : 'pve';
      window.TEAMS_MODE = false;
      window.CTF_MODE = false;
      try { if (window.Teams && window.Teams.reset) window.Teams.reset(); } catch (_) {}
      try { if (window.CTF && window.CTF.reset) window.CTF.reset(); } catch (_) {}
      document.body.classList.toggle('mode-pvp', pvp);
      document.body.classList.toggle('mode-pve', !pvp);
      // The host page owns that stored copy and drops it on the hand-off ack.
      document.querySelectorAll('.overlay').forEach(function (o) { o.style.display = 'none'; });
      const themeId = Math.max(1, Math.min(5, Number(def.theme_id) || 1));
      try { if (window._Gauntlet && window._Gauntlet.setThemeById) window._Gauntlet.setThemeById(themeId); } catch (_) {}
      const btn = document.getElementById('btnRestart');
      if (btn) btn.click();
    },

    complete() {
      if (document.getElementById('ovCustomDone')) return;
      const d = CustomLevel.def || {};
      // A PvP arena has no waves to clear — the match itself ends it.
      if (d.mode === 'pvp') return;
      const el = document.createElement('div');
      el.id = 'ovCustomDone';
      el.className = 'overlay';
      el.style.display = 'grid';
      el.innerHTML =
        '<div class="card victory-card">' +
          '<h2 class="victory-title">\uD83C\uDFC6 LEVEL CLEARED</h2>' +
          '<p class="intro-text">' + escapeHtml(d.name || 'Custom level') + ' \u2014 all ' +
            CustomLevel.waveCount() + ' waves survived.</p>' +
          '<div class="row" style="justify-content:center; margin-top:16px;">' +
            '<button class="btn bigBtn" id="clAgain">\uD83D\uDD04 Play again</button>' +
            '<button class="btn" id="clBoard">\uD83C\uDF10 Community levels</button>' +
            '<button class="btn" id="clHome">\uD83C\uDFE0 Home</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(el);
      document.getElementById('clAgain').onclick = function () {
        el.remove();
        const btn = document.getElementById('btnRestart');
        if (btn) btn.click();
      };
      document.getElementById('clBoard').onclick = function () {
        CustomLevel.clear();
        window.top.location.href = '/levels';
      };
      document.getElementById('clHome').onclick = function () {
        el.remove();
        CustomLevel.clear();
        document.querySelectorAll('.overlay').forEach(function (o) { o.style.display = 'none'; });
        const intro = document.getElementById('overlayIntro');
        if (intro) intro.style.display = 'grid';
        try { if (window._hardStopGame) window._hardStopGame(); } catch (_) {}
      };
    }
  };

  // A block is one cube: { x, y, z, s, mat } — its lower corner, the height of
  // its underside, its edge length and its material. Columns written by an
  // older editor ({ x, y, l }) are rebuilt cube by cube, so maps built before
  // blocks could float still load exactly as they were saved.
  function blocksOf(list) {
    const out = [];
    (list || []).forEach(function (b) {
      if (!b) return;
      const s = Number(b.s);
      if (s > 0) {
        out.push({
          x: Number(b.x) || 0,
          y: Number(b.y) || 0,
          z: Math.max(0, Number(b.z) || 0),
          s: s,
          mat: b.mat || 'stone'
        });
        return;
      }
      const n = Math.max(1, Math.min(5, Number(b.l) || 1));
      for (let k = 0; k < n; k++) {
        out.push({ x: b.x, y: b.y, z: k * 100, s: 100, mat: b.mat || 'stone' });
      }
    });
    return out;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- the designed map ------------------------------------------------
  // The arena walls stay (the four border solids the generator lays down);
  // everything the generator scattered is cleared and the builder's map is
  // laid in its place, then hazards that would sit on top of it are dropped.
  function inject(world) {
    const def = CustomLevel.def;
    const layout = (def && def.layout) || {};
    if (!world) return;

    const borders = world.solids.filter(function (s) {
      return s.x <= 1 || s.y <= 1 || s.x + s.w >= world.w - 1 || s.y + s.h >= world.h - 1;
    });
    // The arena the builder designed stands alone: the realm's scattered grass,
    // bushes and wild rock are dropped so the map is exactly what was built.
    world.bare = true;
    // Flat ground: the arena has no hills of its own here, only the ones the
    // builder placed.
    world.flat = true;
    world.solids = borders.slice();
    world.buildings = [];
    world.chests = [];
    world.deathChests = [];
    world.walls = borders.map(function (s) { return { x: s.x, y: s.y, w: s.w, h: s.h }; });

    const placed = [];

    // obstacles — solid rock, blocks movement and bullets
    (layout.obstacles || []).forEach(function (o) {
      if (!o || !o.w || !o.h) return;
      const r = { x: o.x, y: o.y, w: o.w, h: o.h };
      world.solids.push(r);
      world.walls.push({ x: r.x, y: r.y, w: r.w, h: r.h });
      placed.push(r);
    });

    // blocks — every cube the builder laid, exactly as they laid it: its own
    // edge length, its own material and its own height above the floor. A cube
    // placed beside a stack stays up at that stack's height instead of filling
    // in the space beneath it.
    world.blocks = [];
    blocksOf(layout.blocks).forEach(function (c) {
      const top = c.z + c.s;
      world.blocks.push({ x: c.x, y: c.y, w: c.s, h: c.s, z0: c.z, z1: top, mat: c.mat });
      world.solids.push({ x: c.x, y: c.y, w: c.s, h: c.s, block: true });
      world.walls.push({ x: c.x, y: c.y, w: c.s, h: c.s, top: top, block: true });
      placed.push({ x: c.x, y: c.y, w: c.s, h: c.s });
    });

    // buildings — four walls with a doorway in the south side
    (layout.buildings || []).forEach(function (o) {
      if (!o || !o.w || !o.h) return;
      const x = o.x, y = o.y, w = o.w, h = o.h;
      const gap = Math.min(DOOR, Math.max(60, w * 0.4));
      const gapX = x + (w - gap) / 2;
      world.buildings.push({
        x: x, y: y, w: w, h: h, t: WALL,
        // The builder chose how tall this house is. The renderer builds one
        // floor, staircase and bridge per storey off this number.
        floors: Math.max(1, Math.min(3, Number(o.floors) || 2)),
        // The doorway is cut into the geometry as well as the colliders, so the
        // house is drawn with the opening the builder can actually walk through.
        doors: [{ side: 'bottom', x: gapX, y: y + h - WALL, w: gap, h: WALL }],
        inner: { x: x + WALL, y: y + WALL, w: w - 2 * WALL, h: h - 2 * WALL },
        hasChest: false, chestId: -1
      });
      world.walls.push({ x: x, y: y, w: w, h: WALL });                       // north
      world.walls.push({ x: x, y: y, w: WALL, h: h });                       // west
      world.walls.push({ x: x + w - WALL, y: y, w: WALL, h: h });            // east
      world.walls.push({ x: x, y: y + h - WALL, w: gapX - x, h: WALL });     // south, left of the door
      world.walls.push({ x: gapX + gap, y: y + h - WALL, w: x + w - (gapX + gap), h: WALL });
      placed.push({ x: x, y: y, w: w, h: h });
    });

    // hills the builder raised — these lift the terrain heightmap itself, so the
    // ground mesh, the player's feet and shots over the crest all follow it
    world.hills = (layout.hills || []).slice(0, 400).map(function (q) {
      return {
        x: q.x, y: q.y,
        r: Math.max(80, Math.min(420, Number(q.r) || 200)),
        h: Math.max(20, Math.min(320, Number(q.h) || 150))
      };
    });

    // trees the builder planted, drawn with the meadow's own conifer — the trunk
    // is a small wall, so you cannot walk through one
    world.trees = (layout.trees || []).slice(0, 500).map(function (t) { return { x: t.x, y: t.y }; });
    world.trees.forEach(function (t) {
      world.walls.push({ x: t.x - 14, y: t.y - 14, w: 28, h: 28 });
    });

    // loose chests — anywhere the builder wants them
    let id = 0;
    (layout.chests || []).forEach(function (c) {
      if (!c) return;
      world.chests.push({
        id: id++, x: c.x, y: c.y, z: 0, r: 16,
        opened: false, buildingIndex: -1,
        rarity: (c.rarity === 'epic' || c.rarity === 'legendary' || c.rarity === 'common') ? c.rarity : 'rare'
      });
    });

    // random chest generators — each one scatters its count of chests nearby
    (layout.generators || []).forEach(function (g) {
      if (!g) return;
      const want = Math.max(1, Math.min(8, Number(g.count) || 2));
      for (let made = 0, tries = 0; made < want && tries < want * 40; tries++) {
        const a = Math.random() * Math.PI * 2;
        const d = 40 + Math.random() * BOX;
        const x = g.x + Math.cos(a) * d, y = g.y + Math.sin(a) * d;
        if (x < 80 || y < 80 || x > world.w - 80 || y > world.h - 80) continue;
        if (world.isBlocked(x, y, 24) || world.collideHazard(x, y, 24)) continue;
        world.chests.push({
          id: id++, x: x, y: y, z: 0, r: 16, opened: false, buildingIndex: -1,
          rarity: ['common', 'common', 'rare', 'rare', 'epic', 'legendary'][Math.floor(Math.random() * 6)]
        });
        made++;
      }
    });

    // a hazard dropped on top of the builder's work would be unfair — remove it
    world.hazards = (world.hazards || []).filter(function (h) {
      for (let i = 0; i < placed.length; i++) {
        const p = placed[i];
        if (!(h.x + h.w + 20 < p.x || p.x + p.w + 20 < h.x || h.y + h.h + 20 < p.y || p.y + p.h + 20 < h.y)) return false;
      }
      return true;
    });

    // hazards the builder equipped and dropped in, on top of whatever the realm
    // kept — they behave exactly like the realm's own pits and rifts
    world.hazards = world.hazards || [];
    (layout.hazards || []).forEach(function (h) {
      if (!h) return;
      world.hazards.push({
        x: h.x - 90, y: h.y - 90, w: 180, h: 180,
        type: h.kind || 'sand'
      });
    });

    // monsters the builder stood in the arena sleep in place while the map is
    // built, then wake where they were placed once the match is running.
    // Every rebuild of the arena — the first launch, a restart, a rise again
    // after death — puts them back. A rebuild that happens in the same breath
    // as another (a theme change followed by the restart) replaces the pending
    // spawn instead of adding a second set, so they never double up.
    const sleepers = (layout.monsters || []).slice(0, 40);
    window.clearTimeout(CustomLevel._spawnTimer);
    if (sleepers.length) {
      CustomLevel._spawnTimer = window.setTimeout(function () {
        if (!CustomLevel.active()) return;
        const arena = window._Gauntlet;
        if (!arena || typeof arena.spawnEnemy !== 'function') return;
        sleepers.forEach(function (m) {
          if (!m || !m.type) return;
          try { arena.spawnEnemy(m.type, Number(m.x) || 0, Number(m.y) || 0); } catch (_) {}
        });
      }, 900);
    }
  }

  // A level writes its own blocks, planted trees, raised hills and the flags
  // that keep the realm's scenery out onto the world object. The realm's own
  // generator never touches those fields, so once a level has been played they
  // have to be cleared by hand — otherwise its walls stand in the next match.
  function stripCustom(world) {
    if (!world) return;
    world.blocks = [];
    world.trees = [];
    world.hills = [];
    world.bare = false;
    world.flat = false;
  }

  // Hook the engine's own post-build callback (chained, never replacing one).
  const prevHook = window._onWorldBuilt;
  window._onWorldBuilt = function (world, theme) {
    if (typeof prevHook === 'function') { try { prevHook(world, theme); } catch (_) {} }
    if (!CustomLevel.active()) {
      // Every standard map is built clean: the realm's generator never writes
      // these fields, so whatever a level left behind is wiped here — before the
      // renderer picks the map up.
      stripCustom(world);
      return;
    }
    try { inject(world); CustomLevel._built = true; } catch (e) { console.warn('[CustomLevel] layout failed', e); }
  };

  // Leaving a community level must not leave its rules switched on. Every way
  // out of a level — the home buttons, picking a realm or story card for a
  // normal match (which is how both singleplayer and offline modes start), and
  // the standard mode buttons — drops the level, so the next map is generated.
  document.addEventListener('click', function (e) {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#btnHome') || t.closest('#homeBtn2') || t.closest('#victoryHomeBtn') ||
        t.closest('[data-level]') || t.closest('#btnOfflinePVE') || t.closest('#btnOfflinePVP') ||
        t.closest('#btnOfflineTeams') || t.closest('#btnOfflineCTF')) CustomLevel.clear();
  }, true);

  // An online match takes its map from the lobby host, never from a build in
  // this browser.
  window.addEventListener('net:meta', function () {
    if (!CustomLevel.active()) return;
    // only a real lobby replaces the map; a menu handshake from the network
    // layer must never tear down a level that is already being played
    if (window.Net && window.Net.state && window.Net.state.lobbyId) CustomLevel.clear();
  });

  // ---- the Sentinel wardens, spawnable from a community level -----------
  // The engine only knows the five realm wardens by name; the four Age of the
  // Sentinel wardens are normally grafted onto a boss inside a live chapter.
  // A community level asks for them by name instead, so they are grafted here:
  // spawnEnemy hands every enemy to ElemMonsters.tune() just before it enters
  // the arena, which is the one place that sees a custom boss's own type.
  const SENTINEL_WARDENS = {
    sealwright: function () { return window.SealWright; },
    choir_ash: function () { return window.ChoirOfAsh; },
    hourglass_stag: function () { return window.HourglassStag; },
    gilded_bailiff: function () { return window.GildedBailiff; }
  };

  (function hookSentinelWardens() {
    const em = window.ElemMonsters;
    if (!em || typeof em.tune !== 'function') return;
    const prev = em.tune;
    em.tune = function (e) {
      const pick = e && SENTINEL_WARDENS[e.type] ? SENTINEL_WARDENS[e.type]() : null;
      if (pick && pick.initEnemy && CustomLevel.active()) {
        // Retyped so the engine drives it like any other warden: hazard
        // immunity, the boss bar and the per-enemy tick all key off that.
        e.type = 'boss';
        e.speed = 90; e.hp = e.maxhp = 9000; e.r = 44; e.cd = 99; e.detectR = 1300;
        pick.initEnemy(e);
        return e;
      }
      return prev.apply(em, arguments);
    };
  })();

  window.CustomLevel = CustomLevel;
  window.CustomLevel.LEVELS = LEVELS;
})();
