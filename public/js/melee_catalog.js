/* =====================================================================
   melee_catalog.js — what every melee weapon actually does, and the
   chests that hand them out.

   Each weapon carries real stats, so a higher-rated weapon is genuinely
   better rather than just a different picture:

     dmg    multiplies the base melee hit (a third of the gun's shot)
     reach  how far the swing lands, in world units
     arc    how wide it sweeps, in degrees
     cd     seconds before the next swing

   and two looks of its own:
     fx     the swing effect drawn by melee_fx.js
     ward   the guard it raises while defending

   Ownership lives in localStorage and is seeded with the five common
   weapons (plus whatever the player already had equipped), so nobody
   loses the blade in their hands.
   ===================================================================== */
(function (G) {
  'use strict';

  // v2: the earlier key could hold weapons nobody ever opened, so the
  // collection starts clean — the five commons and nothing else.
  const KEY_OWNS = 'arena_melee_owns_v3';

  const RARITY = {
    common:    { name: 'Common',    color: '#9fb4c9', glow: 'rgba(159,180,201,.55)', rank: 0 },
    rare:      { name: 'Rare',      color: '#4de6ff', glow: 'rgba(77,230,255,.55)',  rank: 1 },
    epic:      { name: 'Epic',      color: '#b06bff', glow: 'rgba(176,107,255,.6)',  rank: 2 },
    legendary: { name: 'Legendary', color: '#ffb43c', glow: 'rgba(255,180,60,.6)',   rank: 3 },
    god:       { name: 'God',       color: '#ff6ad5', glow: 'rgba(255,106,213,.65)', rank: 4 }
  };
  const ORDER = ['common', 'rare', 'epic', 'legendary', 'god'];

  /* ------------------------------------------------------------ weapons
     id === the sprite name in melee_sprites.js, so the grid, the swing
     and the save file all agree on one key. */
  const WEAPONS = [
    /* ---- COMMON · 1.00x ---- */
    { id: 'common_punch1', name: 'Bare Knuckles', rarity: 'common', kind: 'punch', dmg: 1.00, reach: 96, arc: 74, cd: 0.40, fx: 'impact', ward: 'plank', col: [1.35, 1.4, 1.5], blurb: 'Raw fists. A flat, honest thud that lands exactly where you aim it.' },
    { id: 'common_punch2', name: 'Twin Jabs', rarity: 'common', kind: 'punch', dmg: 1.05, reach: 100, arc: 66, cd: 0.36, fx: 'double', ward: 'plank', col: [1.3, 1.45, 1.5], blurb: 'Two strikes in the space of one, tight and quick.' },
    { id: 'common_blade1', name: 'Cracked Shortblade', rarity: 'common', kind: 'blade', dmg: 1.00, reach: 128, arc: 96, cd: 0.50, fx: 'steel_arc', ward: 'plank', col: [1.35, 1.4, 1.5], blurb: 'A chipped edge on a worn grip. It still cuts.' },
    { id: 'common_blade2', name: 'Rusty Cleaver', rarity: 'common', kind: 'blade', dmg: 1.10, reach: 132, arc: 104, cd: 0.55, fx: 'cleave', ward: 'plank', col: [1.45, 1.3, 1.2], blurb: 'Heavy, wide and slow. Good for crowds, bad for duels.' },
    { id: 'common_kick', name: 'Boot Heel', rarity: 'common', kind: 'kick', dmg: 0.95, reach: 108, arc: 112, cd: 0.58, fx: 'shockring', ward: 'plank', col: [1.3, 1.3, 1.35], blurb: 'A heel driven into the floor. The ring it throws hits everything low.' },

    /* ---- RARE · 1.40x ---- */
    { id: 'rare_blade1', name: 'Frostedge', rarity: 'rare', kind: 'blade', dmg: 1.40, reach: 138, arc: 104, cd: 0.50, fx: 'frost', ward: 'cage', col: [.45, 1.35, 1.85], blurb: 'The cut comes with a sleet of ice that keeps travelling after the blade.' },
    { id: 'rare_blade2', name: 'Twin Cross', rarity: 'rare', kind: 'blade', dmg: 1.42, reach: 132, arc: 92, cd: 0.46, fx: 'cross', ward: 'cage', col: [.6, 1.4, 1.6], blurb: 'Two crossing cuts carved in one motion. Narrow, but they meet in the middle.' },
    { id: 'rare_blade3', name: 'Spiral Talon', rarity: 'rare', kind: 'blade', dmg: 1.38, reach: 126, arc: 88, cd: 0.44, fx: 'spiral', ward: 'cage', col: [.55, 1.25, 1.75], blurb: 'The swing curls, dragging a helix of force through whatever it catches.' },
    { id: 'rare_punch1', name: 'Shock Knuckle', rarity: 'rare', kind: 'punch', dmg: 1.45, reach: 106, arc: 80, cd: 0.40, fx: 'shock', ward: 'cage', col: [.6, 1.35, 1.9], blurb: 'Brass over the knuckles, current under them. The strike arcs to a second target.' },
    { id: 'rare_punch2', name: 'Quake Palm', rarity: 'rare', kind: 'punch', dmg: 1.40, reach: 112, arc: 96, cd: 0.48, fx: 'quake', ward: 'cage', col: [1.2, 1.1, .7], blurb: 'An open palm slammed down. The floor answers before the hand does.' },

    /* ---- EPIC · 1.90x ---- */
    { id: 'epic_punch1', name: 'Void Fists', rarity: 'epic', kind: 'punch', dmg: 1.90, reach: 110, arc: 84, cd: 0.40, fx: 'void', ward: 'aegis', col: [1.15, .55, 1.95], blurb: 'The knuckles open onto nothing. What they close on is dragged into it.' },
    { id: 'epic_punch2', name: 'Stormknuckle', rarity: 'epic', kind: 'punch', dmg: 1.95, reach: 112, arc: 86, cd: 0.42, fx: 'storm', ward: 'aegis', col: [.7, 1.3, 2.0], blurb: 'Every hit discharges. The air around the strike is left scorched white.' },
    { id: 'epic_punch3', name: 'Sonic Palm', rarity: 'epic', kind: 'punch', dmg: 1.85, reach: 118, arc: 100, cd: 0.46, fx: 'sonic', ward: 'aegis', col: [.9, 1.5, 1.7], blurb: 'A pressure wave instead of a blow. It keeps pushing after contact.' },
    { id: 'epic_blade1', name: 'Emberfang', rarity: 'epic', kind: 'blade', dmg: 1.95, reach: 146, arc: 108, cd: 0.48, fx: 'ember', ward: 'aegis', col: [1.9, .7, .2], blurb: 'The edge stays hot between swings. Every cut trails live embers.' },
    { id: 'epic_blade2', name: 'Crystal Shard', rarity: 'epic', kind: 'blade', dmg: 1.90, reach: 140, arc: 100, cd: 0.46, fx: 'crystal', ward: 'aegis', col: [1.0, .8, 1.9], blurb: 'A splinter of something grown, not forged. It sheds shards on impact.' },

    /* ---- LEGENDARY · 2.50x ---- */
    { id: 'legendary_punch1', name: 'Solar Knuckle', rarity: 'legendary', kind: 'punch', dmg: 2.50, reach: 118, arc: 92, cd: 0.40, fx: 'solar', ward: 'halo', col: [2.0, 1.35, .4], blurb: 'Each punch lands as a small sunrise. Nothing in front of it stays standing.' },
    { id: 'legendary_punch2', name: 'Gravity Palm', rarity: 'legendary', kind: 'punch', dmg: 2.45, reach: 124, arc: 104, cd: 0.46, fx: 'gravity', ward: 'halo', col: [1.2, .9, 1.8], blurb: 'A palm that pulls before it pushes. Everything close is drawn in, then flattened.' },
    { id: 'legendary_blade3', name: 'Stormrender', rarity: 'legendary', kind: 'blade', dmg: 2.60, reach: 156, arc: 112, cd: 0.46, fx: 'tempest', ward: 'halo', col: [.75, 1.4, 2.0], blurb: 'The blade is the lightning rod. What it splits follows the cut.' },
    { id: 'legendary_blade1', name: 'Soulreaver', rarity: 'legendary', kind: 'blade', dmg: 2.55, reach: 150, arc: 110, cd: 0.44, fx: 'soul', ward: 'halo', col: [.55, 1.6, .85], blurb: 'It takes a little of whatever it cuts, and keeps it.' },
    { id: 'legendary_blade2', name: 'Mirrorbite', rarity: 'legendary', kind: 'blade', dmg: 2.50, reach: 148, arc: 106, cd: 0.44, fx: 'mirror', ward: 'halo', col: [1.4, 1.5, 1.9], blurb: 'The cut appears twice, mirrored. One of them is always where you were not looking.' },

    /* ---- GOD · 3.30x ---- */
    { id: 'god_punch1', name: 'Starbreaker', rarity: 'god', kind: 'punch', dmg: 3.30, reach: 130, arc: 104, cd: 0.40, fx: 'star', ward: 'sigil', col: [2.0, 1.5, 1.2], blurb: 'A knuckle forged around a dying star. The strike goes off like one.' },
    { id: 'god_punch2', name: 'Singularity Fist', rarity: 'god', kind: 'punch', dmg: 3.35, reach: 134, arc: 108, cd: 0.44, fx: 'singularity', ward: 'sigil', col: [1.5, .6, 2.0], blurb: 'Contact collapses the space in front of the fist, then lets it back out.' },
    { id: 'god_blade3', name: 'Eclipse Edge', rarity: 'god', kind: 'blade', dmg: 3.40, reach: 168, arc: 118, cd: 0.44, fx: 'eclipse', ward: 'sigil', col: [1.9, 1.2, 2.0], blurb: 'A blade of shadow with a light for an edge. The swing swallows the light around it.' },
    { id: 'god_blade1', name: 'Divinity', rarity: 'god', kind: 'blade', dmg: 3.30, reach: 164, arc: 114, cd: 0.42, fx: 'divinity', ward: 'sigil', col: [2.0, 1.7, .8], blurb: 'Every swing leaves a sealed sigil in the air behind it.' },
    { id: 'god_blade2', name: 'Genesis Blade', rarity: 'god', kind: 'blade', dmg: 3.35, reach: 162, arc: 112, cd: 0.42, fx: 'genesis', ward: 'sigil', col: [1.9, 1.9, 2.0], blurb: 'It cuts a line and then fills it with light, as if something were being made.' }
  ];

  /* ------------------------------------------------- what a strike leaves
     `elem` decides how the hit reads (colour, particles, the burst on the
     target) and `status` is what the target actually suffers afterwards:
       burn [stacks, secs] · poison [dps, secs] · freeze secs · stun secs
       bleed secs · haunt secs · chain N extra targets · knock world units
       pull draws the target in · lifesteal / heal for the wielder */
  const EXTRA = {
    common_punch1: { elem: 'steel' },
    common_punch2: { elem: 'steel' },
    common_blade1: { elem: 'steel', status: { bleed: 2.4 } },
    common_blade2: { elem: 'poison', status: { poison: [3.2, 4.2] } },
    common_kick:   { elem: 'earth', status: { knock: 70, stun: .5 } },

    rare_blade1:   { elem: 'frost', status: { freeze: 1.1 } },
    rare_blade2:   { elem: 'steel', status: { bleed: 3.2 } },
    rare_blade3:   { elem: 'frost', status: { freeze: .8 } },
    rare_punch1:   { elem: 'shock', status: { chain: 2, stun: .35 } },
    rare_punch2:   { elem: 'earth', status: { knock: 110, stun: .8 } },

    epic_punch1:   { elem: 'void', status: { pull: 1, haunt: 3 } },
    epic_punch2:   { elem: 'shock', status: { chain: 3, stun: .45 } },
    epic_punch3:   { elem: 'air', status: { knock: 130, stun: .6 } },
    epic_blade1:   { elem: 'fire', status: { burn: [2, 4.2] } },
    epic_blade2:   { elem: 'frost', status: { freeze: 1.4 } },

    legendary_punch1: { elem: 'fire', status: { burn: [3, 4.6] } },
    legendary_punch2: { elem: 'void', status: { pull: 1, stun: .9 } },
    legendary_blade1: { elem: 'spirit', status: { lifesteal: .22, haunt: 3 } },
    legendary_blade2: { elem: 'frost', status: { bleed: 3.6, freeze: .6 } },
    legendary_blade3: { elem: 'shock', status: { chain: 3, stun: .5 } },

    god_punch1: { elem: 'fire', status: { burn: [3, 5], knock: 90 } },
    god_punch2: { elem: 'void', status: { pull: 1, stun: 1.1 } },
    god_blade1: { elem: 'holy', status: { burn: [2, 4], heal: 8 } },
    god_blade2: { elem: 'holy', status: { heal: 6, bleed: 3 } },
    god_blade3: { elem: 'void', status: { freeze: 1.6, lifesteal: .12 } }
  };

  /* --------------------------------------------------------------- guards
     Only the legendary and god weapons carry a guard, and each one has its
     own: dur is how long the ward stands, cd how long it then recharges.
     melee_fx.js gives every one its own look and its own job. */
  const GUARDS = {
    legendary_punch1: { name: 'Solar Aegis',   dur: 2.4, cd: 8 },
    legendary_punch2: { name: 'Gravity Well',  dur: 2.6, cd: 9 },
    legendary_blade1: { name: 'Soul Ward',     dur: 2.6, cd: 8 },
    legendary_blade2: { name: 'Mirror Ward',   dur: 1.8, cd: 7 },
    legendary_blade3: { name: 'Storm Cage',    dur: 2.2, cd: 8 },
    god_punch1:       { name: 'Star Bastion',  dur: 2.0, cd: 9 },
    god_punch2:       { name: 'Event Horizon', dur: 2.4, cd: 10 },
    god_blade1:       { name: 'Divine Seal',   dur: 2.6, cd: 9 },
    god_blade2:       { name: 'Genesis Bloom', dur: 2.2, cd: 8 },
    god_blade3:       { name: 'Eclipse Veil',  dur: 2.2, cd: 9 }
  };

  const BY_ID = {};
  WEAPONS.forEach(w => {
    const x = EXTRA[w.id] || {};
    w.elem = x.elem || 'steel';
    w.status = x.status || null;
    w.guard = GUARDS[w.id] || null;
    BY_ID[w.id] = w;
  });

  // Nobody starts with a collection: every weapon, commons included, comes
  // out of a chest. Until one is opened the fighter carries the bare-knuckle
  // default below, which is a freebie and never part of the collection.
  const DEFAULTS = [];
  const DEFAULT_MELEE = 'common_punch1';

  /* ------------------------------------------------------------- chests
     weights: relative chance of each rarity. Every chest costs RuneStones
     and always hands over something the player does not own yet. */
  const CHESTS = [
    { id: 'bronze', name: 'Bronze Chest', price: 140, metal: '#b0763a', rim: '#ffd7a0', weights: { common: 78, rare: 19, epic: 3, legendary: 0, god: 0 } },
    { id: 'steel',  name: 'Steel Chest',  price: 420, metal: '#7f8fa6', rim: '#d8e6f5', weights: { common: 40, rare: 44, epic: 14, legendary: 2, god: 0 } },
    { id: 'energy', name: 'Energy Chest', price: 1100, metal: '#2f9fd0', rim: '#b6f4ff', weights: { common: 0, rare: 26, epic: 48, legendary: 22, god: 4 } },
    { id: 'god',    name: 'God Chest',    price: 2600, metal: '#8a3f7a', rim: '#ffc2f2', weights: { common: 0, rare: 0, epic: 22, legendary: 52, god: 26 } }
  ];
  const CHEST_BY_ID = {};
  CHESTS.forEach(c => { CHEST_BY_ID[c.id] = c; });

  /* ------------------------------------------------------------ storage */
  function readOwns() {
    let list = null;
    try { const v = JSON.parse(localStorage.getItem(KEY_OWNS)); if (Array.isArray(v)) list = v.filter(id => BY_ID[id]); } catch (e) {}
    if (!list) {
      // first run: nothing at all — every weapon has to be opened out of a
      // chest, and until then the fighter uses the default punch
      list = DEFAULTS.slice();
      try { localStorage.setItem(KEY_OWNS, JSON.stringify(list)); } catch (e) {}
    }
    return list;
  }
  function owns() { return readOwns(); }
  function hasOwned(id) { return readOwns().indexOf(id) >= 0; }
  function grant(id) {
    if (!BY_ID[id]) return false;
    const list = readOwns();
    if (list.indexOf(id) >= 0) return false;
    list.push(id);
    try { localStorage.setItem(KEY_OWNS, JSON.stringify(list)); } catch (e) {}
    G.dispatchEvent(new CustomEvent('melee:owned', { detail: { id } }));
    return true;
  }

  /* --------------------------------------------------------------- rolls */
  function rarityOf(chest) {
    const w = chest.weights;
    let total = 0;
    ORDER.forEach(k => { total += Math.max(0, w[k] || 0); });
    if (total <= 0) return 'common';
    let r = Math.random() * total;
    for (const k of ORDER) {
      r -= Math.max(0, w[k] || 0);
      if (r <= 0) return k;
    }
    return 'god';
  }

  // Rolls one chest. Returns { rarity, id|null, refund }.
  function roll(chestId) {
    const chest = CHEST_BY_ID[chestId];
    if (!chest) return null;
    const owned = readOwns();
    const pool = (rar) => WEAPONS.filter(w => w.rarity === rar && owned.indexOf(w.id) < 0);
    let rarity = rarityOf(chest);
    let idx = ORDER.indexOf(rarity);
    let choices = pool(rarity);
    // an exhausted rarity steps to the nearest one that still has something
    for (let step = 1; !choices.length && step < ORDER.length; step++) {
      const up = ORDER[idx + step], down = ORDER[idx - step];
      const upPool = up ? pool(up) : [];
      const downPool = down ? pool(down) : [];
      if (upPool.length) { choices = upPool; rarity = up; }
      else if (downPool.length) { choices = downPool; rarity = down; }
    }
    if (!choices.length) return { rarity, id: null, refund: Math.round(chest.price * 0.5) };
    const pick = choices[Math.floor(Math.random() * choices.length)];
    return { rarity: pick.rarity, id: pick.id, refund: 0 };
  }

  /* -------------------------------------------------------------- lookup */
  // Safe stats for any id — an unknown one behaves like a plain shortblade.
  const FALLBACK = { dmg: 1, reach: 120, arc: 90, cd: 0.5, fx: 'steel_arc', ward: 'plank', col: [1.35, 1.4, 1.5], elem: 'steel', status: null };
  function stats(id) { return BY_ID[id] || FALLBACK; }
  function of(id) { return BY_ID[id] || null; }

  // The cheapest chest that can drop this weapon's rarity.
  function chestHint(id) {
    const w = BY_ID[id];
    if (!w) return '';
    const hit = CHESTS.find(c => (c.weights[w.rarity] || 0) > 0);
    return hit ? hit.name : '';
  }

  /* ------------------------------------------------------------ load fix
     A blade left in the save from before the chests cannot stay in hand.
     pve16 reads its equipped weapon from the same settings object a moment
     after this file loads, so the correction is written here. */
  (function sanitizeEquipped() {
    try {
      const all = JSON.parse(localStorage.getItem('arenaSettings') || '{}');
      if (!all || !all.meleeName || hasOwned(all.meleeName)) return;
      const w = BY_ID[DEFAULT_MELEE];
      all.meleeName = w.id;
      all.meleeRarity = w.rarity;
      localStorage.setItem('arenaSettings', JSON.stringify(all));
    } catch (e) {}
  })();

  G.MeleeCatalog = {
    WEAPONS, BY_ID, RARITY, ORDER, CHESTS, CHEST_BY_ID, DEFAULTS, DEFAULT_MELEE,
    owns, hasOwned, grant, roll, stats, of, chestHint, rarityOf
  };
})(window);
