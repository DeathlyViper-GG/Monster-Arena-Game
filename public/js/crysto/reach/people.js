/* Crysto — the Hollow Reach: its people and their work.
   Nine people across three towns, each with something to say and three of them
   with something that needs doing. Their work is kept apart from the vale's
   vigil: the Reach remembers its own. */
(function () {
  const C = (window.Crysto = window.Crysto || {});
  const R = (C.reach = C.reach || {});

  const Q = {
    active: null, camps: {}, campsBroken: 0,
    scout: 0, braziers: {}, braziersLit: 0, done: {}
  };

  const say = (n, lines, after) => C.hud.say(n.name, lines, after);

  /* ---- who is where ------------------------------------------------------ */
  const NPCS = [
    {
      id: 'isk', name: 'Warden Isk', x: 240, z: 31240, faceX: 0, faceZ: 30700,
      look: { height: 136, skin: 0xc08a5c, cloth: 0x4a5a76, trouser: 0x2f3a48, hair: 0x2c211a, hood: true, hoodColor: 0x39465c },
      talk: talkIsk
    },
    {
      id: 'marrow', name: 'Elder Marrow', x: -5785, z: 33165, faceX: -6000, faceZ: 33000,
      look: { height: 134, skin: 0xd9b189, cloth: 0x6a4a3a, trouser: 0x3a2f28, hair: 0xcfc6b4, hood: true, hoodColor: 0x5a4234 },
      talk: talkMarrow
    },
    {
      id: 'tamsin', name: 'Tamsin', x: -6300, z: 32880, faceX: -6000, faceZ: 33000,
      look: { height: 126, skin: 0xe6bd93, cloth: 0x556b4a, trouser: 0x3a3630, hair: 0x4a3423 },
      talk: talkTamsin
    },
    {
      id: 'orla', name: 'Orla the Woodcutter', x: -14770, z: 39850, faceX: -15000, faceZ: 40000,
      look: { height: 130, skin: 0xc08a5c, cloth: 0x3f6b58, trouser: 0x2b3a30, hair: 0x8a6a44 },
      talk: talkOrla
    },
    {
      id: 'brann', name: 'Brann the Hunter', x: -15240, z: 39800, faceX: -15000, faceZ: 40000,
      look: { height: 140, skin: 0x9a6b44, cloth: 0x4a3524, trouser: 0x2f2a24, hair: 0x1e1a18 },
      talk: talkBrann
    },
    {
      id: 'wren', name: 'Wren', x: -11940, z: 42080, faceX: -12000, faceZ: 42000,
      look: { height: 122, skin: 0xf0cfae, cloth: 0x7a5a3a, trouser: 0x3a3630, hair: 0xa8865a },
      talk: talkWren
    },
    {
      id: 'kaelen', name: 'Kaelen the Smith', x: 2250, z: 46140, faceX: 2000, faceZ: 46000,
      look: { height: 138, skin: 0x6f4a30, cloth: 0x8a4a4a, trouser: 0x2f2a24, hair: 0x1e1a18 },
      talk: talkKaelen
    },
    {
      id: 'vell', name: 'Sister Vell', x: 1760, z: 45900, faceX: 2000, faceZ: 46000,
      look: { height: 128, skin: 0xd9a877, cloth: 0x5a4a6b, trouser: 0x3a3648, hair: 0x6b4a2a, hood: true, hoodColor: 0x4a3d5c },
      talk: talkVell
    }
  ];

  const npcPos = (id) => {
    const n = NPCS.find((x) => x.id === id);
    return n ? { x: n.x, z: n.z } : { x: 0, z: 31000 };
  };

  /* ---- the three pieces of work ----------------------------------------- */
  function campTarget() {
    const list = R.camps || [];
    const next = list.find((c) => c.quest === 'camps' && !c.broken);
    return next ? { x: next.x, z: next.z } : npcPos('marrow');
  }

  function brazierTarget() {
    const list = (R.works && R.works.crown) || [];
    const next = list.find((b) => !b.lit);
    return next ? next.pos : npcPos('kaelen');
  }

  function lightBrazier(b) {
    if (!b.light()) return;
    Q.braziers[b.id] = true;
    Q.braziersLit = Object.keys(Q.braziers).length;
    C.reward(50);
    C.hud.banner('A fire on the crown', Q.braziersLit + ' of 3');
    if (Q.braziersLit >= 3) C.hud.banner('The crown is lit', 'Return to Kaelen in Cinderfall');
    R.save();
  }

  /* ---- what a villager will do for you ----------------------------------
     Rounds for runestones, and three carried elixirs turned into a stronger
     heart. Every villager in the Reach keeps the same small trade. */
  const AMMO_COST = 60, AMMO_ROUNDS = 40;

  function purse() { return window.RS && RS.balance ? RS.balance() : 0; }

  function buyAmmo(n) {
    if (!C.weapons || !C.weapons.hasGun || !C.weapons.hasGun()) {
      C.hud.banner('No gun to load', 'Earn one before you buy rounds');
      return;
    }
    if (!window.RS || !RS.spend) return;
    if (RS.balance() < AMMO_COST) {
      C.hud.banner('Not enough runestones', AMMO_COST + ' needed, ' + RS.balance() + ' held');
      return;
    }
    RS.spend(AMMO_COST);
    C.weapons.addAmmo(AMMO_ROUNDS);
    C.hud.banner(n.name, '+' + AMMO_ROUNDS + ' rounds');
    R.save();
  }

  function convertElixirs(n) {
    if (!C.quest || !C.quest.convertElixirs) return;
    if (C.quest.elixirCount() < 3) {
      C.hud.banner('Three are needed', C.quest.elixirCount() + ' of 3 elixirs carried');
      return;
    }
    if (C.quest.convertElixirs()) {
      C.hud.banner(n.name, 'Three elixirs spent — max health +50');
      R.save();
    }
  }

  function openTalk(n) {
    const armed = !!(C.weapons && C.weapons.hasGun && C.weapons.hasGun());
    const held = C.quest && C.quest.elixirCount ? C.quest.elixirCount() : 0;
    C.hud.choose(n.name, [
      { label: 'Talk', run: () => n.talk(n) },
      {
        label: (armed ? 'Buy ' + AMMO_ROUNDS + ' rounds — ' + AMMO_COST + ' runestones' : 'Buy rounds — you carry no gun')
          + ' (' + purse() + ' held)',
        run: () => buyAmmo(n)
      },
      {
        label: 'Three elixirs of energy — max health +50 (' + Math.min(held, 3) + '/3)',
        run: () => convertElixirs(n)
      }
    ]);
  }

  /* ---- what each of them says ------------------------------------------- */
  function talkIsk(n) {
    say(n, [
      'You came through the doorway. Then the vale has opened at last, and I am not the last one standing here.',
      'This is the Hollow Reach. Three towns still hold it: Ashfall up the shore road, Blackpine in the pines, and Cinderfall out on the crown.',
      'Follow the road south and they will find work for a pair of hands.'
    ], () => C.hud.banner('The Hollow Reach', 'Ashfall, Blackpine, Cinderfall'));
  }

  function talkTamsin(n) {
    say(n, [
      'The ash gets into the nets, into the bread, into the lungs. Still — it is our ash.',
      'If you are going south, keep off the open ground after dark. The fires out there are not ours.'
    ]);
  }

  function talkMarrow(n) {
    if (Q.done.matriarch) {
      say(n, ['The crown is quiet, and the Reach is ours again. Whatever you are, traveller, you have done more here than any of us could.']);
      return;
    }
    if (Q.active === 'matriarch') {
      say(n, ['She is up on the crown, where the old road ends. Nothing else out there will stand against you now — only her.']);
      return;
    }
    if (Q.done.broods) {
      Q.active = 'matriarch';
      say(n, [
        'Five broods broken. I did not think I would live to see the Reach with no nest left in it.',
        'But the nests were never the war — they were her brood. She has slept under the crown since before Ashfall had a name, and she is awake now.',
        'Go up the old road and finish it.'
      ], () => {
        C.hud.banner('The Hollow Matriarch', 'She waits on the Bone Crown');
        R.save();
      });
      return;
    }
    if (Q.active === 'broods') {
      const cleared = R.broodsCleared ? R.broodsCleared() : 0;
      if (cleared < 5) {
        const left = 5 - cleared;
        say(n, [
          left + ' brood' + (left === 1 ? '' : 's') + ' still hold the Reach.',
          'Rime on the shore, root in the pines, ember in the wastes, soul in the mire, storm on the crown. All of them are on your wayfinder.'
        ]);
        return;
      }
      Q.done.broods = true;
      Q.active = 'matriarch';
      say(n, [
        'Five broods broken. I did not think I would live to see the Reach with no nest left in it.',
        'But the nests were never the war — they were her brood. She has slept under the crown since before Ashfall had a name, and she is awake now.',
        'Go up the old road and finish it.'
      ], () => {
        C.hud.banner('The Hollow Matriarch', 'She waits on the Bone Crown');
        R.save();
      });
      return;
    }
    if (Q.done.camps) {
      Q.active = 'broods';
      say(n, [
        'The shore road is quiet, and Ashfall owes you a fire and a bed. But the fires were only the small ones.',
        'Five broods have woken in the Reach since the ice went — one to a country. Rime on the ashen shore, root in the black pine, ember in the wastes, soul in the drowned mire, storm on the bone crown.',
        'Break all five and there will be nothing left out there that hunts us. They are on your wayfinder.'
      ], () => {
        C.hud.banner('The Five Broods', 'Break the five nests of the Reach');
        R.save();
      });
      return;
    }
    if (Q.campsBroken >= 3) {
      say(n, [
        'Three fires out. I watched them go from the bell tower, one after another.',
        'Take this. It is all the ash has to give, and it is yours.'
      ], () => {
        Q.done.camps = true;
        C.reward(240);
        C.hud.banner('The Shore Road is clear', 'Ashfall will remember you');
        R.save();
      });
      return;
    }
    Q.active = 'camps';
    say(n, [
      'You came up the shore road, so you saw them: three raider fires between here and the water.',
      'Ashfall has no wall left to hide behind. Break those camps and the village will have a name for you.',
      'They are on your wayfinder. Go quietly, and come back.'
    ], () => {
      C.hud.banner('The Shore Road', 'Break the three raider camps');
      R.save();
    });
  }

  function talkOrla(n) {
    if (Q.done.scout) { say(n, ['Wren is home, and the reeds can rot. Thank you.']); return; }
    if (Q.scout === 1) {
      say(n, ['She is alive? Then the mire can keep its reeds and welcome.'], () => {
        Q.done.scout = true;
        C.reward(220);
        C.hud.banner('Wren is coming home', 'Blackpine breathes again');
        R.save();
      });
      return;
    }
    Q.active = 'scout';
    say(n, [
      'My Wren went out to the mire for reeds three days ago and has not come back.',
      'The cold water takes people quietly. Would you look? West and south, where the ground goes soft.',
      'She is tall, and she sings when she is frightened. You will hear her before you see her.'
    ], () => {
      C.hud.banner('Reeds and Cold Water', "Find Wren at the mire's edge");
      R.save();
    });
  }

  function talkBrann(n) {
    say(n, ['The pines are full of things that used to be men.', 'Do not go in without a light, and do not go in alone.']);
  }

  function talkWren(n) {
    if (Q.scout === 1) { say(n, ['Tell her I am coming. I just need to remember how to stand.']); return; }
    say(n, [
      'Oh — a person. A real one.',
      'I went out for reeds and the ground took my ankle, and then the mist came up and I could not find the way back.',
      'Tell Orla I am alive. I will crawl home if I have to.'
    ], () => {
      Q.scout = 1;
      C.hud.banner('Wren is found', 'Return to Orla in Blackpine');
      R.save();
    });
  }

  function talkKaelen(n) {
    if (Q.done.braziers) { say(n, ['Three fires on the crown. The old road is lit again, and it was you.']); return; }
    if (Q.braziersLit >= 3) {
      say(n, ['All three. I felt the warmth from here.'], () => {
        Q.done.braziers = true;
        C.reward(260);
        C.hud.banner('The Three Fires', 'Cinderfall keeps its watch');
        R.save();
      });
      return;
    }
    Q.active = 'braziers';
    say(n, [
      'This town was a watchtower once. Three braziers ringed the crown, and nothing crossed the plateau unseen.',
      'They have been cold since my grandmother was a girl. Light them and the Reach will know it has a keeper again.',
      'They stand out on the crown — west, south and east. Take a flame with you.'
    ], () => {
      C.hud.banner('The Three Fires', 'Light the braziers of the Crown');
      R.save();
    });
  }

  function talkVell(n) {
    say(n, [
      'The stone under this town is older than the town, and it is warm.',
      'Whatever the crown was built on, it is still down there. Dreaming.'
    ]);
  }

  /* ---- the Reach's own ledger ------------------------------------------- */
  R.people = {
    state: Q,
    NPCS: NPCS,

    build(scene) {
      NPCS.forEach((n) => {
        const who = C.npc.make(n.look);
        who.place(n.x, n.z);
        who.faceTo(n.faceX, n.faceZ);
        scene.add(who.group);
        n.npc = who;
      });
    },

    tick(dt, player) {
      const now = performance.now() / 1000;
      NPCS.forEach((n) => { if (n.npc) n.npc.update(dt, now, player); });
    },

    target(player) {
      let best = null, bd = 210 * 210;
      NPCS.forEach((n) => {
        const dx = player.x - n.x, dz = player.z - n.z;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = n; }
      });
      if (best) return { kind: 'talk', label: 'Speak with ' + best.name, run: () => openTalk(best) };

      if (Q.active === 'braziers' && !Q.done.braziers) {
        const list = (R.works && R.works.crown) || [];
        for (const b of list) {
          if (b.lit) continue;
          const dx = player.x - b.pos.x, dz = player.z - b.pos.z;
          if (dx * dx + dz * dz < 240 * 240) {
            return { kind: 'brazier', label: 'Light the brazier', run: () => lightBrazier(b) };
          }
        }
      }
      return null;
    },

    tracker() {
      if (Q.done.matriarch) {
        return {
          title: 'The Hollow Reach',
          objective: 'The Reach is quiet — walk it as you please',
          target: null
        };
      }
      if (Q.active === 'matriarch') {
        return {
          title: 'The Hollow Matriarch',
          objective: 'Put down the Matriarch on the Bone Crown',
          target: R.matriarchPos ? R.matriarchPos() : npcPos('marrow')
        };
      }
      if (Q.active === 'broods') {
        const n = R.broodsCleared ? R.broodsCleared() : 0;
        return {
          title: 'The Five Broods',
          objective: n >= 5
            ? 'Return to Elder Marrow in Ashfall'
            : 'Break the broods of the Reach (' + n + '/5)',
          target: n >= 5 ? npcPos('marrow') : (R.broodTarget ? R.broodTarget() : npcPos('marrow'))
        };
      }
      if (Q.active === 'camps') {
        return {
          title: 'The Shore Road',
          objective: Q.campsBroken >= 3
            ? 'Return to Elder Marrow in Ashfall'
            : 'Break the raider camps (' + Q.campsBroken + '/3)',
          target: Q.campsBroken >= 3 ? npcPos('marrow') : campTarget()
        };
      }
      if (Q.active === 'scout') {
        return {
          title: 'Reeds and Cold Water',
          objective: Q.scout ? 'Return to Orla in Blackpine' : "Find Wren at the mire's edge",
          target: Q.scout ? npcPos('orla') : npcPos('wren')
        };
      }
      if (Q.active === 'braziers') {
        return {
          title: 'The Three Fires',
          objective: Q.braziersLit >= 3
            ? 'Return to Kaelen in Cinderfall'
            : 'Light the braziers of the Crown (' + Q.braziersLit + '/3)',
          target: Q.braziersLit >= 3 ? npcPos('kaelen') : brazierTarget()
        };
      }
      if (Q.done.camps) {
        return {
          title: 'The Hollow Reach',
          objective: 'Return to Elder Marrow in Ashfall',
          target: npcPos('marrow')
        };
      }
      return {
        title: 'The Hollow Reach',
        objective: 'Seek the villages beyond the water',
        target: { x: -6000, z: 33000 }
      };
    },

    // One of the five nests is broken.
    broodCleared(id) {
      if (Q.done.broods) return;
      if ((R.broodsCleared ? R.broodsCleared() : 0) >= 5) {
        C.hud.banner('The Five Broods are broken', 'Return to Elder Marrow in Ashfall');
      }
    },

    campBroken(id) {
      Q.camps[id] = true;
      Q.campsBroken = Object.keys(Q.camps).length;
      if (Q.campsBroken >= 3 && !Q.done.camps) {
        C.hud.banner('The camps are broken', 'Return to Elder Marrow in Ashfall');
      }
    },

    snapshot() { return JSON.parse(JSON.stringify(Q)); },

    restore(q) {
      if (!q) return;
      Q.active = q.active || null;
      Q.camps = q.camps || {};
      Q.campsBroken = q.campsBroken || Object.keys(Q.camps).length;
      Q.scout = q.scout || 0;
      Q.braziers = q.braziers || {};
      Q.braziersLit = q.braziersLit || Object.keys(Q.braziers).length;
      Q.done = q.done || {};
      // the fires that were lit are lit again
      const list = (R.works && R.works.crown) || [];
      list.forEach((b) => { if (Q.braziers[b.id]) b.light(); });
    }
  };
})();
