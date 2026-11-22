/* =====================================================================
   hub_rooms.js — the map of the hall, and what is locked inside it.

   One file holds every room the menu is made of: the four great halls off
   the rotunda, the four gear rooms behind the Quartermaster's wing, the
   corridors that join them, the cells of the crypt, the gem-sealed
   secrets, and the level (or the gems) each sealed door answers to.
   Nothing here draws anything; hub3d.js builds what this describes.
   ===================================================================== */
(function (G) {
  'use strict';

  const LAYOUT = {
    HALL_R: 460,   // rotunda radius
    CORR: 165,     // corridor half-width
    NEAR: 900,     // middle of the rotunda to a hall's doorway
    BODY: 26,      // how wide the walker is against a wall
    EYE: 100       // eye height
  };

  /* ---------- the four halls -------------------------------------------- */
  // A hall's doors are given per side; `at` slides the opening along that
  // wall, so the Quartermaster's wing opens onto four rooms at once.
  const ROOMS = {
    armory: {
      id: 'armory', x: 0, z: -1440, w: 1120, d: 1080, h: 380, accent: 0x8fd8ff,
      title: 'THE QUARTERMASTER’S WING',
      doors: [
        { s: 's' }, { s: 'n' },
        { s: 'w', at: -340 }, { s: 'w', at: 340 },
        { s: 'e', at: -340 }, { s: 'e', at: 340 }
      ]
    },
    renown: {
      id: 'renown', x: 1440, z: 0, w: 1080, d: 1180, h: 400, accent: 0xffd166,
      title: 'HALL OF RENOWN', doors: [{ s: 'w' }, { s: 'e' }]
    },
    gateways: {
      id: 'gateways', x: -1600, z: 0, w: 1400, d: 1400, h: 440, accent: 0xb46bff,
      title: 'GATEWAYS', doors: [{ s: 'e' }]
    },
    training: {
      id: 'training', x: 0, z: 1440, w: 1120, d: 1080, h: 380, accent: 0x6cffb0,
      title: 'TRAINING RING', doors: [{ s: 'n' }, { s: 'w' }]
    }
  };

  /* ---------- four rooms of their own, one for each part of the kit ------
     Guns, utilities, melee and the fighter do not share a shelf: each has a
     room of its own, hung off the wing's side walls. */
  const GEAR = [
    {
      id: 'guns', x: -1330, z: -1780, w: 760, d: 660, h: 320, door: 'e',
      accent: 0x9fd8ff, title: 'THE GUNSMITH'
    },
    {
      id: 'orbs', x: -1330, z: -1100, w: 760, d: 660, h: 320, door: 'e',
      accent: 0x9f7bff, title: 'THE ORB CHAMBER'
    },
    {
      id: 'blades', x: 1330, z: -1780, w: 760, d: 660, h: 320, door: 'w',
      accent: 0xff9a8c, title: 'THE HALL OF BLADES'
    },
    {
      id: 'flesh', x: 1330, z: -1100, w: 760, d: 660, h: 320, door: 'w',
      accent: 0xffd166, title: 'THE HALL OF FLESH'
    }
  ];

  /* ---------- corridors -------------------------------------------------- */
  const CELL_X = [2260, 2680, 3100];

  const LINKS = [
    { x: 0, z: -2100, w: 320, d: 300, accent: 0xff9a3c },     // wing → the vault
    { x: 0, z: 2100, w: 320, d: 300, accent: 0x66e0ff },      // training → sanctum
    {                                                          // renown → the crypt
      x: 2600, z: 0, w: 1240, d: 400, accent: 0xffd166,
      openings: CELL_X.reduce((acc, cx) => acc.concat([
        { side: -1, at: cx, width: 240 },
        { side: 1, at: cx, width: 240 }
      ]), [])
    },
    { x: -755, z: -1780, w: 390, d: 240, accent: 0x9fd8ff },  // → gunsmith
    { x: -755, z: -1100, w: 390, d: 240, accent: 0x9f7bff },  // → orb chamber
    { x: 755, z: -1780, w: 390, d: 240, accent: 0xff9a8c },   // → hall of blades
    { x: 755, z: -1100, w: 390, d: 240, accent: 0xffd166 },   // → hall of flesh
    { x: -855, z: 1440, w: 590, d: 240, accent: 0xc9a0ff }    // training → reliquary
  ];

  /* ---------- the crypt: six cells, two rows ---------------------------- */
  const CELLS = [];
  const CELL_RIDDLES = [
    {
      name: 'The Ashen Scribe', level: 2, reward: { xp: 150 },
      q: 'Five realms were sealed away. What holds each one shut?',
      a: ['A warden and a gate', 'A river of glass', 'A spoken name'], r: 0,
      hint: 'Something guards each realm — and something opens it.',
      alt: {
        q: 'Who writes down every wave the arena has ever seen?',
        a: ['The Bailiff', 'The Scribe', 'The Oracle'], r: 1,
        hint: 'Ash is his ink and his name.'
      }
    },
    {
      name: 'The Pale Warden', level: 3, reward: { stones: 60 },
      q: 'What do you spend in the glyph hall between waves?',
      a: ['Health', 'Essence', 'Ammunition'], r: 1,
      hint: 'It drips from what you kill.',
      alt: {
        q: 'A warden never leaves its post. What does it guard?',
        a: ['A door', 'A purse', 'A crown'], r: 0,
        hint: 'You walked through one to stand here.'
      }
    },
    {
      name: 'The Locked Choir', level: 5, reward: { xp: 260 },
      q: 'The Sentinel watched the door for how long?',
      a: ['A season', 'An age', 'A night'], r: 1,
      hint: 'Long enough to forget the world outside.',
      alt: {
        q: 'What do the sealed sing, if you listen at the door?',
        a: ['A hymn', 'Nothing', 'A warning'], r: 1,
        hint: 'A locked choir has no voice left.'
      }
    },
    {
      name: 'The Gilded Bailiff', level: 6, reward: { stones: 120 },
      q: 'Who collects a debt the dead still owe?',
      a: ['The Bailiff', 'The Scribe', 'The Warden'], r: 0,
      hint: 'Gold buys his silence, never his mercy.',
      alt: {
        q: 'What does the Bailiff weigh in his hand?',
        a: ['A coin', 'A soul', 'A key'], r: 0,
        hint: 'He is gilded for a reason.'
      }
    },
    {
      name: 'The Rime Oracle', level: 8, reward: { xp: 400 },
      q: 'What melts the Glacial Archive?',
      a: ['Fire', 'Nothing', 'A true name'], r: 1,
      hint: 'It has stood since before flame.',
      alt: {
        q: 'What does the Oracle see in the ice?',
        a: ['What was', 'What comes', 'Nothing at all'], r: 1,
        hint: 'An oracle is never asked about the past.'
      }
    },
    {
      name: 'The Hollow Voice', level: 12, reward: { stones: 200 },
      q: 'What is left when the Hollow takes a fighter?',
      a: ['A shell', 'A song', 'A crown'], r: 0,
      hint: 'It keeps the shape and loses the soul.',
      alt: {
        q: 'How do you answer a Hollow that wears your face?',
        a: ['With steel', 'With silence', 'With your name'], r: 1,
        hint: 'It feeds on an answer.'
      }
    }
  ];
  CELL_X.forEach((cx) => {
    for (const side of [-1, 1]) {
      const riddle = CELL_RIDDLES[CELLS.length];
      if (!riddle) break;
      CELLS.push({
        id: 'cell' + CELLS.length,
        kind: 'cell',
        x: cx, z: side * 385, w: 420, d: 370, h: 300,
        accent: side > 0 ? 0x9f7bff : 0x66e0ff,
        level: riddle.level,
        title: riddle.name,
        warden: riddle,
        door: side > 0 ? 'n' : 's'
      });
    }
  });

  /* ---------- chambers hung off the halls --------------------------------
     The sanctum answers to rank. The vault and the reliquary answer to
     gems: they are found only by walking the hall and picking up what the
     old builders left lying about. */
  const CHAMBERS = [
    {
      id: 'vault', kind: 'secret', x: 0, z: -2620, w: 780, d: 780, h: 340,
      accent: 0xff9a3c, gems: 5, door: 's', title: 'THE SUNKEN VAULT',
      blurb: 'Five gems open the way'
    },
    {
      id: 'sanctum', kind: 'sealed', x: 0, z: 2620, w: 780, d: 780, h: 340,
      accent: 0x66e0ff, level: 4, door: 'n', title: 'THE SANCTUM',
      warden: {
        name: 'The Keeper of the Ring', level: 4, reward: { xp: 300, stones: 40 },
        q: 'You cannot win a wave you never started. What opens every match?',
        a: ['A key', 'A gate', 'A promise'], r: 1,
        hint: 'You walked through one to get here.',
        alt: {
          q: 'What do you leave at the door before a fight?',
          a: ['Your fear', 'Your purse', 'Your name'], r: 0,
          hint: 'The ring asks nothing of your pockets.'
        }
      }
    },
    {
      id: 'reliquary', kind: 'secret', x: -1500, z: 1440, w: 700, d: 700, h: 340,
      accent: 0xc9a0ff, gems: 10, door: 'e', title: 'THE RELIQUARY',
      blurb: 'Ten gems open the way'
    }
  ];

  /* ---------- gems, hidden about the hall --------------------------------
     One sits in each room and one in each of the far corners, so a player
     who explores finds them without ever being told where they are. */
  const GEMS = [
    { id: 'g1', x: 268, z: 268 },        // behind a rotunda pillar
    { id: 'g2', x: -300, z: -250 },      // under the wing's arch
    { id: 'g3', x: -1660, z: -2050 },    // gunsmith corner
    { id: 'g4', x: -1660, z: -830 },     // orb chamber corner
    { id: 'g5', x: 1660, z: -2050 },     // blades corner
    { id: 'g6', x: 1660, z: -830 },      // flesh corner
    { id: 'g7', x: -2110, z: -520 },     // gateways' far corner
    { id: 'g8', x: 1830, z: 520 },       // renown's far corner
    { id: 'g9', x: 3200, z: 340 },       // the last cell's end of the crypt
    { id: 'g10', x: 470, z: 1880 },      // training ring corner
    { id: 'g11', x: -320, z: 2900 },     // sanctum
    { id: 'g12', x: -300, z: -2900 }     // vault
  ];

  /* ---------- the floor you can stand on --------------------------------
     Every rectangle here is walkable. A doorway between two of them is a
     patch that spans the join, so there is never a lip to catch on. */
  const SPACES = [];
  const DOORS = [];

  for (const k in ROOMS) {
    const r = ROOMS[k];
    SPACES.push({ x: r.x, z: r.z, w: r.w, d: r.d });
  }
  for (const g of GEAR) SPACES.push({ x: g.x, z: g.z, w: g.w, d: g.d });
  for (const l of LINKS) SPACES.push({ x: l.x, z: l.z, w: l.w, d: l.d });
  for (const c of CHAMBERS) SPACES.push({ x: c.x, z: c.z, w: c.w, d: c.d });
  for (const c of CELLS) SPACES.push({ x: c.x, z: c.z, w: c.w, d: c.d });

  // a doorway patch: half the wall it crosses, half the floor beyond it
  const patch = (x, z, horiz, depth) => {
    const deep = depth || 150;
    DOORS.push({ x, z, w: horiz ? deep : 240, d: horiz ? 240 : deep });
  };

  // hall back wall → link corridor
  patch(0, -1980, false);
  patch(0, 1980, false);
  patch(1980, 0, true);
  patch(-560, 1440, true, 160);
  // link corridor → chamber
  patch(0, -2230, false);
  patch(0, 2230, false);
  patch(-1150, 1440, true, 160);
  // the wing → its four rooms
  for (const z of [-1780, -1100]) {
    patch(-560, z, true, 160);
    patch(560, z, true, 160);
    patch(-950, z, true, 160);
    patch(950, z, true, 160);
  }
  // crypt cells
  for (const c of CELLS) patch(c.x, c.z > 0 ? 210 : -210, false, 290);
  for (const d of DOORS) SPACES.push(d);

  /* ---------- who is allowed in ----------------------------------------- */
  const KEY = 'arena_hub_riddles';
  const GEM_KEY = 'arena_hub_gems';

  function level() {
    try { return (G.RankXP && G.RankXP.level()) || 1; } catch (_) { return 1; }
  }

  function isAdmin() {
    try {
      if (localStorage.getItem('arenaDevAccount') === '1') return true;
      return !!(G.RankXP && G.RankXP.isAdmin && G.RankXP.isAdmin());
    } catch (_) { return false; }
  }

  function solved() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; }
  }

  function markSolved(id) {
    const s = solved();
    s[id] = 1;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {}
  }

  /* ---------- gems ------------------------------------------------------- */
  function gems() {
    try {
      const a = JSON.parse(localStorage.getItem(GEM_KEY) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (_) { return []; }
  }

  function hasGem(id) {
    return gems().indexOf(id) >= 0;
  }

  function collectGem(id) {
    const a = gems();
    if (a.indexOf(id) >= 0) return false;
    a.push(id);
    try { localStorage.setItem(GEM_KEY, JSON.stringify(a)); } catch (_) {}
    return true;
  }

  // The reward a warden hands over, paid in the currencies the arena already
  // keeps, so a riddle won here shows up in the rank card and the purse.
  function grant(r) {
    if (!r) return;
    if (r.xp && G.RankXP && G.RankXP.add) G.RankXP.add(r.xp, 'Sealed chamber');
    if (r.stones && G.RS && G.RS.add) G.RS.add(r.stones, 'Sealed chamber');
  }

  function rewardText(r) {
    if (!r) return '';
    const bits = [];
    if (r.xp) bits.push('+' + r.xp + ' XP');
    if (r.stones) bits.push('+' + r.stones + ' RuneStones');
    return bits.join('  ·  ');
  }

  // A room is open when its level is reached, its gems are gathered, or (for
  // the staff vault) when the person standing in front of it is staff.
  function open(c) {
    if (!c) return true;
    if (c.admin) return isAdmin();
    if (c.gems) return gems().length >= c.gems;
    return level() >= (c.level || 1);
  }

  function sealText(c) {
    if (!c) return '';
    if (c.admin) return 'STAFF ONLY';
    if (c.gems) return c.gems + ' GEMS';
    return 'LEVEL ' + (c.level || 1);
  }

  /* ---------- what the wardens ask --------------------------------------
     Five questions each, so a wrong answer never leads straight back to
     the same one. hub3d walks the pool in order. */
  const POOLS = {
    'The Ashen Scribe': [
      { q: 'Five realms were sealed away. What holds each one shut?', a: ['A warden and a gate', 'A river of glass', 'A spoken name'], r: 0, hint: 'Something guards each realm — and something opens it.' },
      { q: 'Who writes down every wave the arena has ever seen?', a: ['The Bailiff', 'The Scribe', 'The Oracle'], r: 1, hint: 'Ash is his ink and his name.' },
      { q: 'What does the Scribe use for ink?', a: ['Tar', 'Ash', 'Blood'], r: 1, hint: 'It is in his name.' },
      { q: 'A record of a fight nobody watched is worth what?', a: ['A crown', 'Nothing', 'A soul'], r: 1, hint: 'Witnesses are the whole point.' },
      { q: 'Where does the Scribe keep the names of the dead?', a: ['In the Vault', 'In the fire', 'In the crypt'], r: 0, hint: 'Somewhere sealed, and low.' }
    ],
    'The Pale Warden': [
      { q: 'What do you spend in the glyph hall between waves?', a: ['Health', 'Essence', 'Ammunition'], r: 1, hint: 'It drips from what you kill.' },
      { q: 'A warden never leaves its post. What does it guard?', a: ['A door', 'A purse', 'A crown'], r: 0, hint: 'You walked through one to stand here.' },
      { q: 'What is a warden paid in?', a: ['Nothing', 'Gold', 'Years'], r: 0, hint: 'A post is its own reward.' },
      { q: 'How many waves must a realm survive to clear it?', a: ['Five', 'Twenty', 'A hundred'], r: 2, hint: 'The counter runs all the way up.' },
      { q: 'What breaks a warden’s patience first?', a: ['A blade', 'A riddle', 'A lie'], r: 1, hint: 'It would rather ask than fight.' }
    ],
    'The Locked Choir': [
      { q: 'The Sentinel watched the door for how long?', a: ['A season', 'An age', 'A night'], r: 1, hint: 'Long enough to forget the world outside.' },
      { q: 'What do the sealed sing, if you listen at the door?', a: ['A hymn', 'Nothing', 'A warning'], r: 1, hint: 'A locked choir has no voice left.' },
      { q: 'How does a choir get locked away?', a: ['By a broken note', 'By a closed gate', 'By a silence'], r: 0, hint: 'Something they sang went wrong.' },
      { q: 'What hangs over the doorway of the sealed?', a: ['A crown', 'A chain', 'A bell'], r: 1, hint: 'Iron, and heavy.' },
      { q: 'Who still hears them?', a: ['The Hollow', 'Nobody', 'The Scribe'], r: 0, hint: 'It wears what it takes.' }
    ],
    'The Gilded Bailiff': [
      { q: 'Who collects a debt the dead still owe?', a: ['The Bailiff', 'The Scribe', 'The Warden'], r: 0, hint: 'Gold buys his silence, never his mercy.' },
      { q: 'What does the Bailiff weigh in his hand?', a: ['A coin', 'A soul', 'A key'], r: 0, hint: 'He is gilded for a reason.' },
      { q: 'What is the Bailiff’s fee for letting you pass?', a: ['Your name', 'A RuneStone', 'Nothing at all'], r: 1, hint: 'The hall’s own coin.' },
      { q: 'A debt left unpaid is collected how?', a: ['In blood', 'In coin', 'Never'], r: 0, hint: 'He is patient, not kind.' },
      { q: 'What colour marks the Bailiff’s court?', a: ['Gold', 'Green', 'Grey'], r: 0, hint: 'It is in his name twice over.' }
    ],
    'The Rime Oracle': [
      { q: 'What melts the Glacial Archive?', a: ['Fire', 'Nothing', 'A true name'], r: 1, hint: 'It has stood since before flame.' },
      { q: 'What does the Oracle see in the ice?', a: ['What was', 'What comes', 'Nothing at all'], r: 1, hint: 'An oracle is never asked about the past.' },
      { q: 'How do you speak to something frozen?', a: ['Loudly', 'In silence', 'With fire'], r: 1, hint: 'Noise only cracks it.' },
      { q: 'What keeps the Archive standing?', a: ['The cold', 'A warden', 'A promise'], r: 0, hint: 'Nothing living is holding it up.' },
      { q: 'A prophecy read in ice is worth what?', a: ['Everything', 'What you paid', 'Nothing'], r: 2, hint: 'It only tells you what you already feared.' }
    ],
    'The Hollow Voice': [
      { q: 'What is left when the Hollow takes a fighter?', a: ['A shell', 'A song', 'A crown'], r: 0, hint: 'It keeps the shape and loses the soul.' },
      { q: 'How do you answer a Hollow that wears your face?', a: ['With steel', 'With silence', 'With your name'], r: 1, hint: 'It feeds on an answer.' },
      { q: 'What does the Hollow want most?', a: ['A body', 'A voice', 'A gate'], r: 1, hint: 'It already has bodies.' },
      { q: 'Where did the Hollow first come from?', a: ['The Void', 'The Meadow', 'The Dunes'], r: 0, hint: 'The last realm, and the emptiest.' },
      { q: 'Can a Hollow be killed?', a: ['Yes', 'Only broken', 'Never'], r: 1, hint: 'The ending you were given says so.' }
    ],
    'The Keeper of the Ring': [
      { q: 'You cannot win a wave you never started. What opens every match?', a: ['A key', 'A gate', 'A promise'], r: 1, hint: 'You walked through one to get here.' },
      { q: 'What do you leave at the door before a fight?', a: ['Your fear', 'Your purse', 'Your name'], r: 0, hint: 'The ring asks nothing of your pockets.' },
      { q: 'How many stand in the ring for a duel?', a: ['Two', 'Four', 'As many as fit'], r: 0, hint: 'One against one.' },
      { q: 'What is a duel won worth on the ladder?', a: ['One point', 'Three points', 'Nothing'], r: 1, hint: 'A loss still pays one.' },
      { q: 'What ends a match early?', a: ['A forfeit', 'A storm', 'A bell'], r: 0, hint: 'Walking away counts.' }
    ]
  };

  function questions(c) {
    const w = c && c.warden;
    if (!w) return [];
    const pool = POOLS[w.name];
    if (pool && pool.length) return pool.slice();
    const one = [];
    if (w.q) one.push({ q: w.q, a: w.a, r: w.r, hint: w.hint });
    if (w.alt && w.alt.q) one.push(w.alt);
    return one;
  }

  /* ---------- the upper deck -------------------------------------------
     A balcony over the north half of the rotunda, reached by two flights
     from the floor. The level editor and the community boards hang their
     doorways up here, above the arena's own name. */
  const GALLERY = {
    y: 190,
    surfaces: [
      { kind: 'cap', r: 434, zMax: -250, y: 190 },
      { kind: 'ramp', x: 280, z: -60, w: 130, d: 380, y0: 0, y1: 190 },
      { kind: 'ramp', x: -280, z: -60, w: 130, d: 380, y0: 0, y1: 190 }
    ],
    stairs: [{ x: 280 }, { x: -280 }],
    portals: [
      { id: 'scriptorium', title: 'THE SCRIPTORIUM', sub: 'Build a level of your own', accent: 0x9fd8ff, x: -260, z: -320, to: '/editor', kind: 'page' },
      { id: 'commons', title: 'THE COMMONS', sub: 'Play what others built', accent: 0x7dffa3, x: 260, z: -320, to: '/levels', kind: 'page' },
      { id: 'forge', title: 'THE FORGE', sub: 'Spend your RuneStones', accent: 0xffd166, x: 0, z: -370, to: 'introShop', kind: 'press' }
    ]
  };

  /* ---------- the practice range ----------------------------------------
     Boards that hold still and silhouettes that pace a line, so the ring
     has something to shoot at before the real thing arrives. */
  const TARGETS = {
    still: [
      { x: -360, z: 1120 }, { x: -360, z: 1400 },
      { x: 360, z: 1120 }, { x: 360, z: 1400 }
    ],
    moving: [
      { x: -150, z: 1770, range: 235, speed: 0.42, phase: 0 },
      { x: 150, z: 1770, range: 235, speed: 0.58, phase: 2.1 },
      { x: 0, z: 1010, range: 300, speed: 0.34, phase: 4.2 }
    ]
  };

  const ALL = [].concat(CHAMBERS, CELLS);

  G.HubRooms = {
    LAYOUT, ROOMS, GEAR, LINKS, CHAMBERS, CELLS, ALL, SPACES, GEMS,
    GALLERY, TARGETS,
    level, isAdmin, solved, markSolved, grant, rewardText, open, sealText,
    questions,
    gems, hasGem, collectGem
  };
})(window);
