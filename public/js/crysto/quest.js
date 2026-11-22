/* Crysto — the vigil of the Sunstone.
   A real quest with its own places, its own cast and its own ending: wake the
   three shrines, march on the Sunken Keep, break the Hollow Knight and give the
   Sunstone its light back. */
(function () {
  const C = (window.Crysto = window.Crysto || {});

  const state = {
    step: 0,
    lit: {},
    guardians: {},
    bossDead: false,
    done: false,
    enemies: [],
    elixirs: {},
    healthUpgraded: false,
    maera: null
  };

  const STEPS = [
    'Speak with Warden Maera',
    'Wake the three shrines',
    'Return to Warden Maera',
    'March on the Sunken Keep',
    'Break the Hollow Knight',
    'Restore the Sunstone',
    'The Sunstone burns again'
  ];

  // A beat of the story that is worth a film. Without the engine's film player
  // (a headless check, a bare page) the beat simply plays straight away.
  function film(key, after) {
    if (C.playFilm) C.playFilm(key, after);
    else if (after) after();
  }

  // The monsters of Crysto are the arena's own: same sprite art, same attacks.
  const MON = () => C.monsters;

  // What stands guard over each shrine — and what you meet on the road there.
  const GUARDS = {
    root: ['elem-quake', 'ravener', 'gorgon-x'],
    ember: ['elem-fire', 'hellforged', 'ravener'],
    tide: ['elem-rime', 'noctilith', 'elem-soul']
  };

  function wisp(x, z, home) { return MON().make('elem-soul', x, z, home); }

  function knight(x, z) {
    return MON().make('void-seraph', x, z, { x: x, z: z }, { boss: true, hp: 900 });
  }

  function spawn(list) {
    list.forEach((e) => { state.enemies.push(e); C.scene.add(e.mesh); });
  }

  function clearShrine(id) {
    const def = C.places.shrines.find((s) => s.id === id);
    const alive = state.enemies.filter((e) => !e.dead && e.home && e.home.id === id);
    if (alive.length) return;
    state.guardians[id] = true;
    const home = { id: id };
    const kinds = GUARDS[id] || GUARDS.root;
    const ring = [
      { a: 0.4, r: 260 }, { a: 2.5, r: 300 }, { a: 4.5, r: 280 }
    ];
    spawn(ring.map((p, i) => MON().make(
      kinds[i % kinds.length],
      def.x + Math.cos(p.a) * p.r,
      def.z + Math.sin(p.a) * p.r,
      home
    )));
    C.hud.banner('Guardians wake', def.name);
  }

  function trackTarget() {
    const s = state.step;
    if (s === 0 || s === 2) return C.places.village;
    if (s === 1) {
      const next = C.places.shrines.find((d) => !state.lit[d.id]);
      return next ? { x: next.x, z: next.z } : C.places.village;
    }
    if (s === 3 || s === 4) return C.places.keep;
    if (s === 5) return C.places.keep;
    return null;
  }

  const quest = {
    state: state,
    STEPS: STEPS,

    init(scene, town) {
      C.scene = scene;
      state.town = town;
      state.step = 0;
      state.lit = {};
      state.guardians = {};
      state.enemies.forEach((e) => scene.remove(e.mesh));
      state.enemies = [];
      if (C.monsters) C.monsters.clear();
      // A few of the vale's own monsters out on the roads, so the first thing
      // met beyond the village is one of them rather than an empty meadow.
      [['ravener', 1500, 900], ['gorgon-x', -1300, 1500], ['hellforged', 1750, -900]]
        .forEach((r) => spawn([C.monsters.make(r[0], r[1], r[2], { x: r[1], z: r[2] })]));
      state.bossDead = false;
      state.bossSpawned = false;
      state.done = false;
      state.elixirs = {};
      state.healthUpgraded = false;

      // Warden Maera, at the well in Drane Vale — a whole person, not a stack
      // of boxes: rounded limbs on real joints, hooded, and breathing.
      const warden = C.npc.make({
        height: 138, skin: 0xe3bd95, cloth: 0x2f5f52, trouser: 0x2b4038,
        hair: 0x9a8a72, hood: true, hoodColor: 0x27524a
      });
      warden.place(210, 130);
      warden.faceTo(0, 0);
      scene.add(warden.group);
      state.maera = { mesh: warden.group, npc: warden, pos: { x: 210, z: 130 } };
    },

    // Picking the vigil back up exactly where the last save left it.
    restore(data) {
      if (!data) return false;
      state.step = data.step || 0;
      state.lit = data.lit || {};
      state.guardians = data.guardians || {};
      state.bossDead = !!data.bossDead;
      state.bossSpawned = !!data.bossSpawned;
      state.done = !!data.done;
      state.elixirs = data.elixirs || {};
      state.healthUpgraded = !!data.healthUpgraded;
      if (data.maxHp && C.setMaxHp) C.setMaxHp(data.maxHp);
      if (C.herbs && C.herbs.restore) C.herbs.restore(data.provisions);
      Object.keys(state.lit).forEach((id) => {
        const s = state.town.shrines[id];
        if (s) {
          s.orb.material.emissiveIntensity = 1.8;
          s.rune.material.emissiveIntensity = 1.6;
          if (s.halo) s.halo.material.opacity = 0.8;
        }
        const st = state.town.stones[id];
        if (st) { st.lit = true; st.glow.material.emissiveIntensity = 1.5; }
      });
      if (state.done && state.town.sunMat) {
        state.town.sunMat.emissiveIntensity = 2.2;
        state.town.sunMat.color.setHex(0xffd27a);
      }
      if (C.weapons && data.arms) C.weapons.restore(data.arms);
      return true;
    },

    tracker() {
      return {
        title: 'The Sunstone Vigil',
        objective: STEPS[state.step],
        target: trackTarget()
      };
    },

    // What the walker could do right here, if anything.
    target(player) {
      const near = (p, r) => {
        const dx = player.x - p.x, dz = player.z - p.z;
        return dx * dx + dz * dz < r * r;
      };
      if (state.maera && near(state.maera.pos, 190)) {
        return { kind: 'talk', label: 'Speak with Warden Maera', run: () => talkMaera() };
      }
      const stones = Object.values(state.town.stones);
      for (const s of stones) {
        if (s.lit && near(s.pos, 200)) {
          return { kind: 'waystone', label: 'Waystone — travel', run: () => openTravel(s) };
        }
      }
      for (const def of C.places.shrines) {
        if (state.lit[def.id]) continue;
        if (!near({ x: def.x, z: def.z }, 260)) continue;
        const alive = state.enemies.some((e) => !e.dead && e.home && e.home.id === def.id);
        if (alive) return { kind: 'shrine', label: 'The guardians still stand', run: null };
        return { kind: 'shrine', label: 'Attune to the ' + def.name, run: () => attune(def) };
      }
      if (state.bossDead && !state.done && near(C.places.keep, 260)) {
        return { kind: 'sun', label: 'Restore the Sunstone', run: () => restore() };
      }
      return null;
    },

    attack(player, facing, dmg) {
      const power = dmg || 70;
      let hits = 0;
      state.enemies.forEach((e) => {
        if (e.dead) return;
        const dx = e.pos.x - player.x, dz = e.pos.z - player.z;
        const d = Math.hypot(dx, dz);
        if (d > 320) return;
        const dot = (dx / (d || 1)) * facing.x + (dz / (d || 1)) * facing.z;
        if (dot < 0.1) return;
        hits++;
        if (MON().hit(e, power)) kill(e);
      });
      return hits;
    },

    // Something the walker shot down, from any arm.
    kill: kill,

    // the shrines' gift, taken at the far end of a hall
    elixir: elixir,

    // Three carried elixirs, spent at a village, buy a stronger heart.
    elixirCount() { return Object.keys(state.elixirs).length; },
    convertElixirs() {
      const keys = Object.keys(state.elixirs);
      if (keys.length < 3) return false;
      keys.slice(0, 3).forEach((k) => { delete state.elixirs[k]; });
      if (C.upgradeHealth) C.upgradeHealth(50);
      if (C.save) C.save.auto();
      return true;
    },

    // A death undoes everything done since the last save: every monster called
    // up since then goes back where it came from, and the vigil returns to the
    // state the waystone remembers.
    reloadFromSave() {
      state.enemies.forEach((e) => { if (!e.dead && C.scene) C.scene.remove(e.mesh); });
      state.enemies = [];
      if (C.monsters) C.monsters.clear();
      state.guardians = {};
      state.bossSpawned = false;
      [['ravener', 1500, 900], ['gorgon-x', -1300, 1500], ['hellforged', 1750, -900]]
        .forEach((r) => spawn([C.monsters.make(r[0], r[1], r[2], { x: r[1], z: r[2] })]));
      const data = C.save ? C.save.read() : null;
      if (data) { this.restore(data); return; }
      state.step = 0;
      state.lit = {};
      state.bossDead = false;
      state.done = false;
      state.elixirs = {};
    },

    tick(dt, player) {
      const now = performance.now() / 1000;
      const cam = C.camera || null;
      state.enemies.forEach((e) => {
        if (e.dead) return;
        MON().update(e, dt, now, player, cam);
      });
      MON().tickShots(dt, player);

      // guardians wake as the walker nears an unlit shrine
      C.places.shrines.forEach((def) => {
        if (state.lit[def.id] || state.guardians[def.id]) return;
        const dx = player.x - def.x, dz = player.z - def.z;
        if (dx * dx + dz * dz < 620 * 620) clearShrine(def.id);
      });

      // the knight holds the keep
      if (state.step >= 3 && !state.bossDead && !state.bossSpawned) {
        const dx = player.x - C.places.keep.x, dz = player.z - C.places.keep.z;
        if (dx * dx + dz * dz < 1000 * 1000) {
          state.bossSpawned = true;
          state.step = 4;
          spawn([knight(C.places.keep.x, C.places.keep.z - 420)]);
          film('keep', () => C.hud.banner('The Hollow Knight', 'Keeper of the Sunken Keep'));
        }
      }

      // waystones light as their shrine wakes
      Object.values(state.town.stones).forEach((s) => {
        if (!s.lit && state.lit[s.id]) {
          s.lit = true;
          s.glow.material.emissiveIntensity = 1.5;
        }
      });

      // the vale's own people go about their day, and the warden keeps watch
      if (state.town && state.town.crowd) state.town.crowd.update(dt, now, player);
      if (state.maera && state.maera.npc) state.maera.npc.update(dt, now, player);
      if (C.bossroom) C.bossroom.update(dt, now);
    }
  };

  // Crysto pays in RuneStones and rank, through the game's own purses.
  C.reward = function (n) {
    try { if (window.RS && window.RS.add) window.RS.add(n, 'Crysto'); } catch (_) {}
    try { if (window.RankXP && window.RankXP.add) window.RankXP.add(n * 8, 'Crysto'); } catch (_) {}
  };

  function kill(e) {
    e.dead = true;
    C.scene.remove(e.mesh);
    // A sanctum's guardian is its own fight: the room closes it out and hands
    // over the gun it was carrying.
    if (e.shrineBoss) {
      if (C.bossroom) C.bossroom.won(e.shrineBoss);
      return;
    }
    // the mother of the broods is the Reach's own ending, not the vale's
    if (e.matriarch) {
      if (C.reach && C.reach.matriarchDown) C.reach.matriarchDown();
      return;
    }
    if (e.boss) {
      state.bossDead = true;
      state.step = 5;
      C.hud.banner('The Hollow Knight falls', 'Restore the Sunstone');
      C.reward(300);
      if (C.weapons) C.weapons.give('dawn');
      if (C.save) C.save.auto();
    } else {
      C.reward(25);
      // what it was carrying: a few rounds for whoever is holding a gun
      if (C.weapons && C.weapons.addAmmo) C.weapons.addAmmo(3 + Math.floor(Math.random() * 4));
    }
  }

  // A shrine is not simply touched awake: its stone opens, the eye is held on
  // the orb while it wakes, and the walker is set down inside the shrine's own
  // hall — where the elixir waits at the far end (shrine.js).
  function attune(def) {
    if (state.lit[def.id]) return;
    if (C.shrine && C.shrine.activate) { C.shrine.activate(def); return; }
    lightShrine(def);
  }

  // The shrines' gift: an elixir of energy from each hall, and three of them
  // strengthen the heart that carried them.
  // An elixir is carried, not drunk: three of them, taken to any village, buy a
  // stronger heart there (reach/people.js).
  function elixir(id) {
    if (state.elixirs[id]) return;
    state.elixirs[id] = true;
    const n = Object.keys(state.elixirs).length;
    const shrine = C.places.shrines.find((d) => d.id === id);
    if (shrine) lightShrine(shrine);
    C.hud.banner('Elixir of Energy', n + ' carried — three make a stronger heart');
    C.reward(120);
    if (C.save) C.save.auto();
  }

  function lightShrine(def) {
    if (!def || state.lit[def.id]) return;
    state.lit[def.id] = true;
    const s = state.town.shrines[def.id];
    if (s) {
      s.orb.material.emissiveIntensity = 1.8;
      s.rune.material.emissiveIntensity = 1.6;
      if (s.halo) s.halo.material.opacity = 0.8;
    }
    C.hud.banner('Shrine woken', def.name);
    C.reward(60);
    const all = C.places.shrines.every((d) => state.lit[d.id]);
    if (all) {
      state.step = 2;
      film('shrine', () => {
        C.hud.say('Warden Maera', [
          'Three lights in the dark. The vale breathes again.',
          'But the Sunstone itself is still cold — it lies in the Sunken Keep, east of the river.',
          'Go. I will keep the lantern burning for you.'
        ], () => {});
      });
    }
    if (C.save) C.save.auto();
  }

  function restore() {
    state.done = true;
    state.step = 6;
    const k = state.town;
    if (k.sunMat) {
      k.sunMat.emissiveIntensity = 2.2;
      k.sunMat.color.setHex(0xffd27a);
    }
    C.reward(500);
    try { if (window.RankXP && window.RankXP.addQuest) window.RankXP.addQuest(); } catch (_) {}
    film('dawn', () => {
      C.hud.banner('Crysto remembers', 'The Sunstone burns again');
      C.hud.say('Warden Maera', [
        'You brought the light home. The vale, the river, the far shore — all of it wakes.',
        'Whatever you are, wanderer, Crysto will not forget you.'
      ], () => {});
    });
  }

  function talkMaera() {
    if (state.step === 0) {
      C.hud.say('Warden Maera', [
        'You came through the pod, didn\'t you. I felt it open.',
        'Crysto is sick. The Sunstone that kept the vale warm has gone dark, and three shrines have fallen asleep.',
        'Wake them — Root, Ember and Tide. Their stones will show you the way.'
      ], () => {
        state.step = 1;
        // She does not send anyone out there with bare hands.
        if (C.weapons) C.weapons.give('pistol');
        C.hud.banner('Maera\'s gift', 'The Wayfarer pistol. Q swaps arms, R reloads');
        if (C.save) C.save.auto();
      });
      return;
    }
    if (state.step === 1) {
      const left = C.places.shrines.filter((d) => !state.lit[d.id]);
      C.hud.say('Warden Maera', [
        left.length + ' shrine' + (left.length === 1 ? '' : 's') + ' still sleep. Follow the light on the horizon.',
        left.map((d) => d.name).join(' · ')
      ], () => {});
      return;
    }
    if (state.step === 2) {
      state.step = 3;
      C.hud.say('Warden Maera', [
        'All three are awake. Then the Keep has opened — the Hollow Knight has been waiting for exactly this.',
        'Cross the Weeping Bridge and end it. Take the Sunstone back.'
      ], () => {});
      return;
    }
    if (state.step === 6) {
      C.hud.say('Warden Maera', ['The vale is yours to walk, wanderer. Go and see what we saved.'], () => {});
      return;
    }
    C.hud.say('Warden Maera', ['The Keep lies east, past the river. Do not stop until the Knight is down.'], () => {});
  }

  function openTravel(from) {
    const list = Object.values(state.town.stones)
      .filter((s) => s.lit && s.id !== from.id)
      .map((s) => ({ label: s.name, run: () => C.teleport(s.pos.x, s.pos.z) }));
    if (!list.length) { C.hud.banner('No other waystone', 'Wake a shrine to open the road'); return; }
    C.hud.choose('Travel by waystone', list);
  }

  C.quest = quest;
})();
