/* =====================================================================
   utilities.js — the utility collection: chests, drops and equipment.

   Lives in the Customize screen (a fourth tab beside Player / Guns /
   Melee). RuneStones buy one of six chests; each chest rolls a rarity,
   then hands over a random utility of that rarity the player does not
   own yet. Duplicates never happen — a fully-owned tier refunds part of
   the price instead.

   The utility itself is played by utility_game.js; this file owns the
   catalogue, the purse, the equip choice and the shop UI.
   ===================================================================== */
(function (G) {
  'use strict';

  const KEY_OWNS = 'arena_utility_owns';
  const KEY_EQUIP = 'arena_utility_equipped';

  /* ------------------------------------------------------------ rarities */
  const RARITY = {
    common:  { name: 'Common',  color: '#9fb4c9', glow: 'rgba(159,180,201,.55)' },
    ultra:   { name: 'Ultra',   color: '#4de6ff', glow: 'rgba(77,230,255,.55)' },
    monster: { name: 'Monster', color: '#b06bff', glow: 'rgba(176,107,255,.6)' },
    viper:   { name: 'Viper',   color: '#7dffa3', glow: 'rgba(125,255,163,.6)' }
  };

  /* ---------------------------------------------------------- catalogue
     kind decides the interaction in a match:
       throw  — lobbed, lands and bursts
       place  — dropped at your feet, arms itself
       drop   — left on the floor for anyone to pick up
       fire   — a directed shot from the hand
       deploy — planted where you stand, projects an area

     Every utility is reusable: `reload` is the seconds it takes to come
     back, set by what the utility DOES rather than by its rarity — a quick
     traversal tool returns in a few seconds, a field that shelters a whole
     team takes half a minute. A longer-lived effect always reloads slower
     than its own duration, so two of them can never be stacked.          */
  const UTILS = [
    /* ---- COMMON ---- */
    {
      id: 'smoke_grenade', name: 'Smoke Grenade', rarity: 'common', kind: 'throw',
      reload: 12, radius: 175, dur: 6.5, color: '#9fb4c9',
      desc: 'A canister that bursts into a rolling wall of smoke. Sight lines break for everyone inside, and enemy fire that crosses the cloud dies in it.',
      tag: 'Area concealment'
    },
    {
      id: 'flash_charge', name: 'Flash Charge', rarity: 'common', kind: 'throw',
      reload: 9, radius: 210, dur: 1.1, color: '#eaf6ff',
      desc: 'Detonates in a blinding pulse. Anyone looking at it is whited out for a heartbeat; monsters are left reeling.',
      tag: 'Blinding burst'
    },
    {
      id: 'ammo_pack', name: 'Ammo Pack', rarity: 'common', kind: 'drop',
      reload: 18, radius: 40, dur: 25, color: '#ffd27a',
      desc: 'Drops a supply crate that refills the magazine and reserve of whoever reaches it first — you or a teammate.',
      tag: 'Resupply'
    },
    {
      id: 'scrap_snare', name: 'Scrap Snare', rarity: 'common', kind: 'throw',
      reload: 8, radius: 90, dur: 2.6, color: '#b9c3d2',
      desc: 'A coil of jagged wire that bites into the first thing it touches and drags it to a crawl.',
      tag: 'Single snare'
    },
    {
      id: 'iron_ward', name: 'Iron Ward', rarity: 'common', kind: 'deploy',
      reload: 16, radius: 60, dur: 9, color: '#c9d6e6',
      desc: 'Plants a riveted plate that hardens your guard, soaking damage before it ever reaches your health.',
      tag: 'Personal shield'
    },

    /* ---- ULTRA ---- */
    {
      id: 'shock_mine', name: 'Shock Mine', rarity: 'ultra', kind: 'place',
      reload: 11, radius: 130, dur: 26, color: '#4de6ff',
      desc: 'Arms a disc on the floor. Whoever steps on it takes a jolt and loses their footing — visible, and it can be walked around.',
      tag: 'Proximity trap'
    },
    {
      id: 'decoy_beacon', name: 'Decoy Beacon', rarity: 'ultra', kind: 'throw',
      reload: 16, radius: 320, dur: 7, color: '#b06bff',
      desc: 'A tripod transmitter that draws fire: shots that reach the beacon are swallowed, and enemy radars light up where nothing stands.',
      tag: 'Misdirection'
    },
    {
      id: 'grapple_dart', name: 'Grapple Dart', rarity: 'ultra', kind: 'fire',
      reload: 5, radius: 330, dur: 0, color: '#cfe6ff',
      desc: 'Fires a hooked line and reels you toward it. Movement only — it never drags an opponent, so it cannot be used as a weapon.',
      tag: 'Traversal'
    },
    {
      id: 'tar_grenade', name: 'Tar Grenade', rarity: 'ultra', kind: 'throw',
      reload: 12, radius: 145, dur: 6, color: '#4a4a58',
      desc: 'Shatters into a pool of black tar. Everyone moving through it is slowed, friend or foe, so it cuts both ways.',
      tag: 'Slow field'
    },

    /* ---- MONSTER ---- */
    {
      id: 'breach_charge', name: 'Breach Charge', rarity: 'monster', kind: 'throw',
      reload: 20, radius: 190, dur: 2.0, color: '#ff8a3c',
      desc: 'Sticks where it lands, blinks a fuse, then blasts. Damage falls off with distance and the fuse gives everyone time to clear out.',
      tag: 'Explosive'
    },
    {
      id: 'rift_beacon', name: 'Rift Beacon', rarity: 'monster', kind: 'throw',
      reload: 16, radius: 60, dur: 1.7, color: '#b06bff',
      desc: 'Marks a spot with a visible tear, then folds you into it. Opponents see the landing marker the whole time it winds up.',
      tag: 'Teleport'
    },
    {
      id: 'aegis_projector', name: 'Aegis Projector', rarity: 'monster', kind: 'deploy',
      reload: 26, radius: 175, dur: 8, color: '#7fd8ff',
      desc: 'Raises a shimmering dome. Shots fired from either side stop at the shell — it shelters whoever is under it, including your enemies.',
      tag: 'Barrier'
    },

    /* ---- VIPER ---- */
    {
      id: 'viper_fang', name: 'Viper Fang', rarity: 'viper', kind: 'throw',
      reload: 22, radius: 155, dur: 7, color: '#7dffa3',
      desc: 'Shatters a venom gland into a creeping green cloud. Anything standing in it is eaten away — leaving the cloud stops the damage.',
      tag: 'Damage over time'
    },
    {
      id: 'void_anchor', name: 'Void Anchor', rarity: 'viper', kind: 'throw',
      reload: 24, radius: 210, dur: 2.6, color: '#a06bff',
      desc: 'Slams down a weight of nothing. Players and monsters alike are dragged toward the pit, but never held — they can still fight and shoot.',
      tag: 'Pull field'
    },
    {
      id: 'champion_standard', name: "Champion's Standard", rarity: 'viper', kind: 'deploy',
      reload: 28, radius: 240, dur: 11, color: '#ffd76a',
      desc: 'Plants a banner that lifts every ally inside it: faster feet and faster hands. Enemies can walk in and take it for themselves.',
      tag: 'Team aura'
    }
  ];

  const BY_ID = {};
  UTILS.forEach(u => { BY_ID[u.id] = u; });

  /* --------------------------------------------------------------- chests
     weights: relative chance of each rarity. dup: RuneStones refunded when
     every utility of the rolled rarity is already owned. */
  const CHESTS = [
    { id: 'scrap',    name: 'Scrap Chest',    price: 120,  metal: '#8d96a6', rim: '#c3ccd9', weights: { common: 88, ultra: 12, monster: 0,  viper: 0  } },
    { id: 'iron',     name: 'Iron Chest',     price: 300,  metal: '#6f7d95', rim: '#aab6c9', weights: { common: 60, ultra: 34, monster: 6,  viper: 0  } },
    { id: 'gold',     name: 'Gold Chest',     price: 600,  metal: '#c99a34', rim: '#ffe08a', weights: { common: 28, ultra: 52, monster: 18, viper: 2  } },
    { id: 'diamond',  name: 'Diamond Chest',  price: 1000, metal: '#4fa8d8', rim: '#bff1ff', weights: { common: 8,  ultra: 42, monster: 42, viper: 8  } },
    { id: 'viper',    name: 'Viper Chest',    price: 1600, metal: '#2f8f5c', rim: '#9dffc0', weights: { common: 0,  ultra: 20, monster: 54, viper: 26 } },
    { id: 'champion', name: 'Champion Chest', price: 2400, metal: '#8a3f2a', rim: '#ffc27a', weights: { common: 0,  ultra: 6,  monster: 40, viper: 54 } }
  ];
  const CHEST_BY_ID = {};
  CHESTS.forEach(c => { CHEST_BY_ID[c.id] = c; });

  /* ------------------------------------------------------------- storage */
  function readJSON(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return Array.isArray(v) ? v : fallback;
    } catch (e) { return fallback; }
  }
  function owns() { return readJSON(KEY_OWNS, []).filter(id => BY_ID[id]); }
  function hasOwned(id) { return owns().indexOf(id) >= 0; }
  function equipped() {
    const id = localStorage.getItem(KEY_EQUIP);
    return id && BY_ID[id] && hasOwned(id) ? id : null;
  }
  function equip(id) {
    if (id && !hasOwned(id)) return false;
    try { id ? localStorage.setItem(KEY_EQUIP, id) : localStorage.removeItem(KEY_EQUIP); } catch (e) {}
    G.dispatchEvent(new CustomEvent('utility:equipped', { detail: { id } }));
    return true;
  }
  function grant(id) {
    if (!BY_ID[id]) return false;
    const list = owns();
    if (list.indexOf(id) >= 0) return false;
    list.push(id);
    try { localStorage.setItem(KEY_OWNS, JSON.stringify(list)); } catch (e) {}
    G.dispatchEvent(new CustomEvent('utility:owned', { detail: { id } }));
    return true;
  }

  /* --------------------------------------------------------------- rolls */
  function rarityOf(chest) {
    const w = chest.weights;
    const order = ['common', 'ultra', 'monster', 'viper'];
    let total = 0;
    for (const k of order) total += Math.max(0, w[k] || 0);
    if (total <= 0) return 'common';
    let r = Math.random() * total;
    for (const k of order) {
      r -= Math.max(0, w[k] || 0);
      if (r <= 0) return k;
    }
    return order[order.length - 1];
  }
  // Rolls one chest. Returns { rarity, id|null, refund }.
  function roll(chestId) {
    const chest = CHEST_BY_ID[chestId];
    if (!chest) return null;
    const owned = owns();
    let rarity = rarityOf(chest);
    // if that rarity is exhausted, step to the nearest rarity that still has
    // something unowned — a chest never comes back empty while anything is left
    const pool = (rar) => UTILS.filter(u => u.rarity === rar && owned.indexOf(u.id) < 0);
    const order = ['common', 'ultra', 'monster', 'viper'];
    let idx = order.indexOf(rarity);
    let choices = pool(rarity);
    for (let step = 1; !choices.length && step < order.length; step++) {
      const up = order[idx + step], down = order[idx - step];
      choices = (up && pool(up)) || (down && pool(down)) || [];
      if (choices.length) rarity = up && pool(up).length ? up : down;
    }
    if (!choices.length) return { rarity, id: null, refund: Math.round(chest.price * 0.5) };
    const pick = choices[Math.floor(Math.random() * choices.length)];
    return { rarity: pick.rarity, id: pick.id, refund: 0 };
  }

  /* ---------------------------------------------------------------- CSS */
  let cssDone = false;
  function injectCSS() {
    if (cssDone) return;
    cssDone = true;
    const s = document.createElement('style');
    s.textContent = `
    #utilTab{font-family:inherit;}
    .utBar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;}
    .utWallet{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;font-weight:900;letter-spacing:.04em;
      background:linear-gradient(180deg,rgba(46,34,12,.7),rgba(20,15,6,.7));border:1px solid rgba(255,210,120,.5);
      color:#ffe6b0;text-shadow:0 0 10px rgba(255,200,120,.55);box-shadow:0 0 18px rgba(255,190,90,.18) inset;}
    .utWallet i{width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff8d6,#ffb43c 60%,#8a4c00);
      box-shadow:0 0 10px rgba(255,190,80,.9);display:block;}
    .utLoadout{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#9fd2ff;opacity:.9;}
    .utLoadout b{color:#eaf4ff;letter-spacing:.02em;}
    .utChestRail{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:10px;margin-bottom:16px;}
    .utChest{position:relative;border-radius:14px;padding:10px 10px 12px;cursor:pointer;overflow:hidden;text-align:center;
      background:linear-gradient(180deg,rgba(22,18,38,.9),rgba(10,8,18,.9));
      border:1px solid rgba(150,120,220,.3);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease;}
    .utChest:hover{transform:translateY(-3px);border-color:rgba(200,160,255,.7);box-shadow:0 12px 30px rgba(0,0,0,.5),0 0 22px rgba(160,110,255,.25);}
    .utChest.is-pending{border-color:#ffd27a;box-shadow:0 0 26px rgba(255,200,110,.45);}
    .utChestArt{position:relative;height:74px;margin:2px auto 6px;width:96px;perspective:400px;}
    .utChestBody{position:absolute;left:6px;right:6px;bottom:6px;height:38px;border-radius:6px 6px 9px 9px;
      background:linear-gradient(180deg,var(--cm) 0%,rgba(0,0,0,.55) 100%);
      box-shadow:inset 0 2px 0 var(--cr),inset 0 -6px 14px rgba(0,0,0,.6),0 8px 18px rgba(0,0,0,.55);}
    .utChestLid{position:absolute;left:4px;right:4px;bottom:36px;height:22px;border-radius:9px 9px 4px 4px;
      background:linear-gradient(180deg,var(--cr),var(--cm));
      box-shadow:inset 0 -2px 6px rgba(0,0,0,.45);transform-origin:bottom center;transition:transform .35s ease;}
    .utChest.is-pending .utChestLid{transform:rotateX(-38deg) translateY(-4px);}
    .utChestLock{position:absolute;left:50%;bottom:16px;width:14px;height:16px;margin-left:-7px;border-radius:3px;
      background:linear-gradient(180deg,#ffe9b0,var(--cr));box-shadow:0 0 12px var(--cr);}
    .utChestName{font-size:12.5px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:#f1e9ff;}
    .utChestPrice{font-size:12px;font-weight:800;color:#ffe6b0;margin-top:2px;}
    .utOdds{display:flex;height:5px;border-radius:4px;overflow:hidden;margin-top:7px;background:rgba(0,0,0,.5);}
    .utOdds span{display:block;height:100%;}
    .utOddsKey{font-size:9.5px;letter-spacing:.05em;color:#a9a2cf;margin-top:5px;opacity:.85;}
    .utConfirm{display:flex;gap:6px;margin-top:8px;}
    .utConfirm button{flex:1;padding:6px 4px;border-radius:8px;border:1px solid rgba(180,220,255,.4);cursor:pointer;
      font-weight:900;font-size:11px;letter-spacing:.04em;background:rgba(20,30,50,.9);color:#dff0ff;}
    .utConfirm button.yes{background:linear-gradient(180deg,#2a6a3a,#154022);border-color:#7dffa3;color:#dcffe8;}
    .utConfirm button.no{background:rgba(30,18,28,.9);border-color:rgba(255,120,120,.4);color:#ffd9d9;}

    .utShowcase{display:grid;grid-template-columns:minmax(200px,300px) 1fr;gap:18px;align-items:center;
      padding:16px;border-radius:18px;margin-bottom:18px;
      background:radial-gradient(120% 140% at 15% 0%,rgba(90,60,160,.28),rgba(8,6,16,.85) 60%);
      border:1px solid rgba(150,120,220,.28);}
    .utStageBox{position:relative;aspect-ratio:1/1;border-radius:16px;overflow:hidden;
      background:radial-gradient(circle at 50% 60%,rgba(120,170,255,.16),rgba(4,4,10,.9) 70%);
      border:1px solid rgba(180,220,255,.16);}
    #utStage{width:100%;height:100%;display:block;}
    .utStageGlow{position:absolute;inset:auto 0 6% 0;height:40%;pointer-events:none;
      background:radial-gradient(50% 100% at 50% 100%,var(--ug,rgba(120,170,255,.4)),transparent 70%);opacity:.7;}
    .utPanel h3{margin:4px 0 6px;font-family:var(--font-heading,Georgia,serif);font-size:24px;letter-spacing:.02em;color:#f4efff;}
    .utPanel p{margin:0 0 12px;font-size:13.5px;line-height:1.55;color:#c8d4ea;}
    .utRar{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;
      border:1px solid currentColor;box-shadow:0 0 16px currentColor inset;}
    .utMeta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;}
    .utMeta span{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#9fd2ff;
      padding:4px 9px;border-radius:999px;background:rgba(10,18,30,.7);border:1px solid rgba(120,160,220,.3);}
    .utGridHead{display:flex;align-items:baseline;justify-content:space-between;margin:0 0 10px;
      font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9fd2ff;}
    .utGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:10px;}
    .utCard{position:relative;border-radius:12px;padding:8px 6px 10px;cursor:pointer;text-align:center;overflow:hidden;
      background:linear-gradient(180deg,rgba(20,18,34,.85),rgba(8,8,16,.9));
      border:1px solid rgba(140,120,200,.22);transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease;}
    .utCard:hover{transform:translateY(-2px);}
    .utCard canvas{width:100%;aspect-ratio:1/1;display:block;border-radius:8px;}
    .utCard .utCName{font-size:11px;font-weight:800;letter-spacing:.02em;color:#e9e3ff;margin-top:4px;line-height:1.2;}
    .utCard.locked{opacity:.42;filter:saturate(.35);}
    .utCard.locked .utCName{color:#9a93bd;}
    .utCard.selected{border-color:var(--uc,#4de6ff);box-shadow:0 0 20px var(--ug,rgba(77,230,255,.35));}
    .utCard .utCEquip{position:absolute;top:5px;left:6px;font-size:8.5px;font-weight:900;letter-spacing:.1em;color:#0a1018;
      background:#7dffa3;padding:2px 5px;border-radius:4px;}
    .utCard .utCRar{position:absolute;top:5px;right:6px;font-size:8.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;}

    .utReveal{position:fixed;inset:0;z-index:80;display:none;place-items:center;
      background:radial-gradient(circle at 50% 45%,rgba(30,16,60,.86),rgba(2,2,8,.94));backdrop-filter:blur(6px);}
    .utReveal.on{display:grid;}
    .utRevealCard{width:min(420px,92vw);padding:26px 22px;border-radius:20px;text-align:center;position:relative;
      background:linear-gradient(180deg,rgba(24,18,44,.97),rgba(8,6,16,.98));
      border:1px solid var(--ug,rgba(180,150,255,.5));box-shadow:0 30px 80px rgba(0,0,0,.7),0 0 60px var(--ug,rgba(160,110,255,.3));
      animation:utPop .38s cubic-bezier(.2,1.2,.4,1);}
    @keyframes utPop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}
    .utRevealCard canvas{width:200px;height:200px;display:block;margin:0 auto 6px;}
    .utRevealCard h3{margin:2px 0 6px;font-family:var(--font-heading,Georgia,serif);font-size:24px;color:#fff;}
    .utRevealCard p{margin:0 0 16px;font-size:13px;line-height:1.5;color:#cbd6ea;}
    .utRevealCard .utSpin{width:96px;height:96px;margin:10px auto 14px;border-radius:14px;
      background:conic-gradient(from 0deg,var(--cr,#c3ccd9),transparent 40%,var(--cr,#c3ccd9));
      animation:utSpin 1.1s linear infinite;box-shadow:0 0 40px var(--cr,#c3ccd9);}
    @keyframes utSpin{to{transform:rotate(360deg)}}
    .utFlash{position:fixed;inset:0;pointer-events:none;z-index:70;background:#fff;opacity:0;transition:opacity .12s ease;}
    @media (max-width:700px){
      .utShowcase{grid-template-columns:1fr;}
      .utStageBox{max-width:240px;margin:0 auto;}
      .utChestRail{grid-template-columns:repeat(auto-fit,minmax(120px,1fr));}
    }`;
    document.head.appendChild(s);
  }

  /* ----------------------------------------------------------------- UI */
  let selId = null;         // utility shown on the stage
  let pending = null;       // chest awaiting confirmation
  let raf = 0, lastPaint = 0;
  let stageCtx = null, stageSize = 0;
  const thumbs = [];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function chestArt(chest) {
    const w = chest.weights;
    const total = w.common + w.ultra + w.monster + w.viper || 1;
    const seg = (k) => `<span style="width:${(w[k] / total * 100).toFixed(1)}%;background:${RARITY[k].color}"></span>`;
    return `<div class="utChestArt" style="--cm:${chest.metal};--cr:${chest.rim}">
        <div class="utChestLid"></div><div class="utChestBody"></div><div class="utChestLock"></div>
      </div>
      <div class="utChestName">${esc(chest.name)}</div>
      <div class="utChestPrice">✦ ${chest.price}</div>
      <div class="utOdds">${seg('common')}${seg('ultra')}${seg('monster')}${seg('viper')}</div>
      <div class="utOddsKey">${['common', 'ultra', 'monster', 'viper'].filter(k => w[k] > 0).map(k => RARITY[k].name + ' ' + Math.round(w[k] / total * 100) + '%').join(' · ')}</div>`;
  }

  function buildChests() {
    const rail = document.getElementById('utChests');
    if (!rail) return;
    rail.innerHTML = '';
    CHESTS.forEach(chest => {
      const card = document.createElement('div');
      card.className = 'utChest' + (pending === chest.id ? ' is-pending' : '');
      card.innerHTML = chestArt(chest);
      if (pending === chest.id) {
        const row = document.createElement('div');
        row.className = 'utConfirm';
        const yes = document.createElement('button');
        yes.className = 'yes';
        yes.textContent = 'Open · ' + chest.price;
        yes.onclick = (e) => { e.stopPropagation(); openChest(chest.id); };
        const no = document.createElement('button');
        no.className = 'no';
        no.textContent = 'Cancel';
        no.onclick = (e) => { e.stopPropagation(); pending = null; buildChests(); };
        row.appendChild(yes); row.appendChild(no);
        card.appendChild(row);
      }
      card.onclick = () => { pending = pending === chest.id ? null : chest.id; buildChests(); };
      rail.appendChild(card);
    });
  }

  function buildGrid() {
    const grid = document.getElementById('utGrid');
    if (!grid) return;
    const owned = owns();
    const equippedId = equipped();
    grid.innerHTML = '';
    thumbs.length = 0;
    UTILS.forEach(u => {
      const ownedIt = owned.indexOf(u.id) >= 0;
      const card = document.createElement('div');
      const rar = RARITY[u.rarity];
      card.className = 'utCard' + (ownedIt ? '' : ' locked') + (u.id === equippedId ? ' selected' : '');
      card.style.setProperty('--uc', rar.color);
      card.style.setProperty('--ug', rar.glow);
      const cv = document.createElement('canvas');
      cv.width = 132; cv.height = 132;
      card.appendChild(cv);
      if (u.id === equippedId) {
        const tag = document.createElement('div');
        tag.className = 'utCEquip';
        tag.textContent = 'EQUIPPED';
        card.appendChild(tag);
      }
      const rarTag = document.createElement('div');
      rarTag.className = 'utCRar';
      rarTag.style.color = rar.color;
      rarTag.textContent = rar.name;
      card.appendChild(rarTag);
      const nm = document.createElement('div');
      nm.className = 'utCName';
      nm.textContent = ownedIt ? u.name : '???';
      card.appendChild(nm);
      if (ownedIt) card.onclick = () => { selId = u.id; buildGrid(); buildStage(); };
      // Locked utilities still show their model, dimmed — a silhouette of what
      // is still out there, never its name.
      thumbs.push({ ctx: cv.getContext('2d'), id: u.id, size: 132, phase: Math.random() * 6.28 });
      grid.appendChild(card);
    });
    const count = document.getElementById('utCount');
    if (count) count.textContent = owned.length + ' / ' + UTILS.length + ' unlocked';
  }

  function buildStage() {
    if (!selId) {
      const owned = owns();
      selId = equipped() || owned[0] || UTILS[0].id;
    }
    const u = BY_ID[selId];
    if (!u) return;
    const ownedIt = hasOwned(u.id);
    const rar = RARITY[u.rarity];

    const rarEl = document.getElementById('utRar');
    if (rarEl) { rarEl.textContent = rar.name; rarEl.style.color = rar.color; }
    const nameEl = document.getElementById('utName');
    if (nameEl) nameEl.textContent = ownedIt ? u.name : 'Locked utility';
    const descEl = document.getElementById('utDesc');
    if (descEl) descEl.textContent = ownedIt ? u.desc : 'Open chests to unlock ' + rar.name + ' utilities like this one.';
    const meta = document.getElementById('utMeta');
    if (meta) {
      const kindLabel = { throw: 'Throwable', place: 'Placed', drop: 'Dropped', fire: 'Fired', deploy: 'Deployed' }[u.kind] || 'Utility';
      meta.innerHTML = `<span>${kindLabel}</span><span>${u.reload}s reload</span>` +
        (u.radius ? `<span>${Math.round(u.radius)} reach</span>` : '') +
        (u.dur ? `<span>${u.dur}s effect</span>` : '') + `<span>${u.tag}</span>`;
    }
    const glow = document.getElementById('utStageGlow');
    if (glow) glow.style.setProperty('--ug', rar.glow);

    const btn = document.getElementById('utEquip');
    if (btn) {
      const isOn = equipped() === u.id;
      btn.style.display = ownedIt ? '' : 'none';
      btn.textContent = isOn ? 'Equipped' : 'Equip utility';
      btn.disabled = isOn;
      btn.style.opacity = isOn ? '.55' : '1';
      btn.onclick = () => { equip(u.id); refresh(); };
    }

    const cv = document.getElementById('utStage');
    if (cv) {
      const w = cv.clientWidth || 260;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr);
      stageCtx = cv.getContext('2d');
      stageCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stageSize = w;
    }
    startLoop();
  }

  function tick(now) {
    const dt = now - lastPaint;
    if (dt < 33) { raf = requestAnimationFrame(tick); return; }
    lastPaint = now;
    const t = now / 1000;
    let alive = 0;
    if (stageCtx && stageSize && G.UtilityModels) {
      const cv = document.getElementById('utStage');
      if (cv && cv.isConnected && cv.clientWidth) {
        alive++;
        G.UtilityModels.paint(stageCtx, selId, t * .55, stageSize);
      }
    }
    for (let i = 0; i < thumbs.length; i++) {
      const th = thumbs[i];
      if (!th.ctx.canvas.isConnected || !th.ctx.canvas.clientWidth) continue;
      alive++;
      G.UtilityModels.paint(th.ctx, th.id, t * .5 + th.phase, th.size);
    }
    raf = alive ? requestAnimationFrame(tick) : 0;
  }
  function startLoop() { if (!raf) raf = requestAnimationFrame(tick); }

  function refresh() {
    injectCSS();
    const bal = document.getElementById('utBal');
    if (bal) bal.textContent = (G.RS && G.RS.balance) ? G.RS.balance() : '0';
    const eq = document.getElementById('utEquipped');
    const eqId = equipped();
    if (eq) eq.textContent = eqId ? BY_ID[eqId].name : 'nothing';
    buildChests();
    buildGrid();
    buildStage();
  }

  /* ------------------------------------------------------------ opening */
  function flashScreen() {
    const d = document.createElement('div');
    d.className = 'utFlash';
    document.body.appendChild(d);
    requestAnimationFrame(() => { d.style.opacity = '.85'; });
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 220); }, 90);
  }

  function openChest(chestId) {
    const chest = CHEST_BY_ID[chestId];
    if (!chest) return;
    const bal = G.RS && G.RS.balance ? G.RS.balance() : 0;
    if (bal < chest.price) {
      pending = null;
      buildChests();
      const w = document.getElementById('utBal');
      if (w) { w.textContent = bal; w.style.color = '#ff8a8a'; setTimeout(() => { w.style.color = ''; }, 900); }
      return;
    }
    if (G.RS && G.RS.spend && !G.RS.spend(chest.price)) return;

    const result = roll(chestId);
    pending = null;
    if (!result) return;
    if (result.refund) {
      if (G.RS && G.RS.add) G.RS.add(result.refund, 'Duplicate utility refund');
      refresh();
      return;
    }
    grant(result.id);
    refresh();
    reveal(result.id, chest);
  }

  function reveal(id, chest) {
    const u = BY_ID[id];
    if (!u) return;
    const rar = RARITY[u.rarity];
    const host = document.getElementById('utReveal');
    const card = document.getElementById('utRevealCard');
    if (!host || !card) return;
    // The chest spins its wheel first: it settles on the rarity that was
    // rolled, and only then is the utility itself shown.
    const show = () => {
      card.style.setProperty('--ug', rar.glow);
      card.style.setProperty('--cr', chest.rim);
      card.innerHTML =
        '<div class="utRar" style="color:' + rar.color + ';margin-bottom:8px">' + rar.name + '</div>' +
        '<canvas id="utRevealCv" width="200" height="200"></canvas>' +
        '<h3>' + esc(u.name) + '</h3>' +
        '<p>' + esc(u.desc) + '</p>' +
        '<button class="btn bigBtn" id="utRevealOk">Add to collection</button>';
      host.classList.add('on');
      flashScreen();
      const cv = document.getElementById('utRevealCv');
      const ctx = cv && cv.getContext('2d');
      let a = 0, spin = 0;
      (function anim() {
        if (!ctx || !host.classList.contains('on')) return;
        spin += 0.02;
        if (G.UtilityModels) G.UtilityModels.paint(ctx, id, spin, 200);
        a = requestAnimationFrame(anim);
      })();
      const ok = document.getElementById('utRevealOk');
      if (ok) ok.onclick = () => {
        host.classList.remove('on');
        selId = id;
        refresh();
      };
    };

    if (G.ChestWheel) {
      G.ChestWheel.play({
        kind: 'util', title: chest.name, accent: chest.rim,
        order: ['common', 'ultra', 'monster', 'viper'], weights: chest.weights,
        rarity: RARITY, winner: u.rarity, done: show
      });
    } else {
      setTimeout(show, 900);
    }
  }

  /* ------------------------------------------------------------- wiring */
  function hookTab() {
    const btn = document.getElementById('tabUtilBtn');
    if (btn && !btn._utHooked) {
      btn._utHooked = true;
      const orig = btn.onclick;
      btn.onclick = function () {
        if (typeof orig === 'function') orig.apply(this, arguments);
        refresh();
      };
    }
    const pane = document.getElementById('utilTab');
    if (pane && !pane.dataset.built) {
      pane.dataset.built = '1';
      pane.innerHTML = `
        <div class="utBar">
          <div class="utWallet"><i></i><span id="utBal">0</span> RuneStones</div>
          <div class="utLoadout">Equipped <b id="utEquipped">nothing</b></div>
        </div>
        <div class="utChestRail" id="utChests"></div>
        <div class="utShowcase">
          <div class="utStageBox"><canvas id="utStage"></canvas><div class="utStageGlow" id="utStageGlow"></div></div>
          <div class="utPanel">
            <div class="utRar" id="utRar">—</div>
            <h3 id="utName">Collection</h3>
            <p id="utDesc">Open a chest to begin your collection.</p>
            <div class="utMeta" id="utMeta"></div>
            <button class="btn bigBtn" id="utEquip" style="display:none">Equip utility</button>
          </div>
        </div>
        <div class="utGridHead"><span>Collection</span><span id="utCount"></span></div>
        <div class="utGrid" id="utGrid"></div>`;
    }
    const revealHost = document.getElementById('utReveal');
    if (!revealHost) {
      const d = document.createElement('div');
      d.id = 'utReveal';
      d.className = 'utReveal';
      d.innerHTML = '<div class="utRevealCard" id="utRevealCard"></div>';
      d.addEventListener('click', (e) => { if (e.target === d) d.classList.remove('on'); });
      document.body.appendChild(d);
    }
    refresh();
  }

  function init() {
    injectCSS();
    hookTab();
    G.addEventListener('utility:owned', () => { const b = document.getElementById('utBal'); if (b) b.textContent = G.RS && G.RS.balance ? G.RS.balance() : '0'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // The tab button and pane are created by pve16/game.html; re-hook shortly
  // after in case this file ran first.
  setTimeout(hookTab, 600);
  setTimeout(hookTab, 1600);

  G.Utilities = {
    UTILS, CHESTS, RARITY, BY_ID, CHEST_BY_ID,
    owns, hasOwned, equipped, equip, grant, roll, refresh, openChest
  };
})(window);
