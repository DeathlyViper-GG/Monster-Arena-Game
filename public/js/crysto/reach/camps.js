/* Crysto — the Hollow Reach: the camps.
   Six fires in the wilds beyond the towns, each with its own tents, its own
   banner and its own band. Nothing is spawned until the walker comes near, so
   the Reach costs nothing while they are elsewhere; and every monster raised
   here lives in the same list the vale's own do, so the guns and the fists hit
   them without knowing the difference. */
(function () {
  const C = (window.Crysto = window.Crysto || {});
  const R = (C.reach = C.reach || {});

  R.camps = [
    { id: 'camp-shore', name: 'The Shore Raiders', x: -2000, z: 37000, quest: 'camps', colour: 0x8a3a2a, kinds: ['ravener', 'hellforged', 'ravener'] },
    { id: 'camp-gully', name: 'The Gully Raiders', x: -10000, z: 36000, quest: 'camps', colour: 0x7a3020, kinds: ['gorgon-x', 'ravener', 'hellforged'] },
    { id: 'camp-mire', name: 'The Mire Raiders', x: -14000, z: 44000, quest: 'camps', colour: 0x5a2a20, kinds: ['noctilith', 'gorgon-x', 'ravener'] },
    { id: 'camp-mesa', name: 'The Ember Warband', x: 9000, z: 40000, colour: 0x9a4a22, kinds: ['elem-fire', 'hellforged', 'ravener', 'ravener'] },
    { id: 'camp-crown', name: 'The Crown Beasts', x: 12000, z: 48000, colour: 0x4a4a5a, kinds: ['elem-quake', 'gorgon-x', 'noctilith'] },
    { id: 'camp-pine', name: 'The Pine Stalkers', x: -18000, z: 35000, colour: 0x3a4a34, kinds: ['ravener', 'ravener', 'hellforged'] }
  ];

  R.buildCamps = function (scene) {
    const P = R.props;
    R.camps.forEach((c, i) => {
      const g = new THREE.Group();
      const n = 2 + (i % 2);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + i;
        g.add(P.tent(c.x + Math.cos(a) * 195, c.z + Math.sin(a) * 195, a + Math.PI, c.colour));
      }
      const ban = P.banner(c.x + 95, c.z - 140, c.colour);
      g.add(ban.group);
      const fire = C.build.flame(c.x, C.height(c.x, c.z) + 44, c.z, 0xff8a3a, 96);
      g.add(fire.sprite);
      C.tickers.push(fire.tick);
      const sm = C.build.smoke(c.x, C.height(c.x, c.z) + 70, c.z, 4);
      sm.add(g);
      C.tickers.push(sm.tick);
      g.add(P.crate(c.x - 160, c.z + 95));
      g.add(P.crate(c.x - 215, c.z + 150));
      g.add(P.spikes(c.x + 250, c.z + 40));
      scene.add(g);

      c.fire = fire;
      c.flag = ban.cloth;
      c.broken = false;
      c.spawned = false;
      c.members = [];
    });
  };

  function spawnCamp(c) {
    const list = C.quest && C.quest.state ? C.quest.state.enemies : null;
    if (!list) return;
    c.spawned = true;
    c.members = [];
    c.kinds.forEach((kind, i) => {
      const a = (i / c.kinds.length) * Math.PI * 2 + 0.7;
      const x = c.x + Math.cos(a) * (120 + i * 34);
      const z = c.z + Math.sin(a) * (120 + i * 34);
      const e = C.monsters.make(kind, x, z, { x: c.x, z: c.z });
      e.camp = c.id;
      C.scene.add(e.mesh);
      list.push(e);
      c.members.push(e);
    });
    if (C.hud) C.hud.banner(c.name, 'They have seen you');
  }

  function breakCamp(c, reward) {
    if (c.broken) return;
    c.broken = true;
    c.members = [];
    if (c.fire) c.fire.sprite.visible = false;
    if (c.flag) c.flag.rotation.z = 1.25;
    if (!reward) return;
    C.reward(60);
    if (C.hud) C.hud.banner('The camp is broken', c.name);
    if (c.quest === 'camps' && R.people && R.people.campBroken) R.people.campBroken(c.id);
    if (R.save) R.save();
  }

  R.tickCamps = function (dt, player) {
    const list = C.quest && C.quest.state ? C.quest.state.enemies : null;
    if (!list) return;
    R.camps.forEach((c) => {
      if (c.broken) return;
      if (!c.spawned) {
        const dx = player.x - c.x, dz = player.z - c.z;
        if (dx * dx + dz * dz < 3000 * 3000) spawnCamp(c);
        return;
      }
      // A death in the vale empties the shared list: the band goes back to the
      // wilds and the camp is ready to be walked into again.
      const here = c.members.filter((e) => list.indexOf(e) >= 0);
      if (!here.length) { c.spawned = false; c.members = []; return; }
      if (!here.some((e) => !e.dead)) breakCamp(c, true);
    });
  };

  // A camp already broken when the vigil was last saved: quiet, no reward again.
  R.markBroken = function (id) {
    const c = R.camps.find((x) => x.id === id);
    if (c) breakCamp(c, false);
  };
})();
