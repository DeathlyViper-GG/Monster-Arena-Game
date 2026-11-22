// ============================================================
// Monster Arena — HELP HANDBOOK
// Fills the Help overlay with tabbed reference pages: every mode, the monster
// bestiary, the landmark guardians, the bosses, the glyph paths, gear/rules and
// the controls. Content only — the overlay, its Close button and the pause
// behaviour stay exactly where they were.
// ============================================================
(function () {
  'use strict';

  // ---------- styles ----------
  const CSS = `
  #overlayHelp .card{width:min(96vw,1120px);max-height:92vh;display:flex;flex-direction:column;}
  #helpBody{display:flex;flex-direction:column;flex:1;min-height:0;}
  .hh-tabs{display:flex;gap:7px;overflow-x:auto;padding-bottom:9px;margin:2px 0 12px;
    border-bottom:1px solid rgba(120,150,220,.16);scrollbar-width:thin;}
  .hh-tabs::-webkit-scrollbar{height:5px;}
  .hh-tabs::-webkit-scrollbar-thumb{background:rgba(140,110,230,.45);border-radius:5px;}
  .hh-tab{flex:0 0 auto;padding:7px 13px;border-radius:999px;cursor:pointer;font:inherit;font-size:12px;font-weight:800;
    letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;color:#bdb2e8;
    background:linear-gradient(180deg,rgba(26,21,44,.9),rgba(13,10,24,.9));
    border:1px solid rgba(120,90,200,.35);transition:color .18s ease,border-color .18s ease,box-shadow .18s ease;}
  .hh-tab:hover{color:#fff;border-color:rgba(160,110,255,.85);}
  .hh-tab.is-on{color:#fff;border-color:rgba(180,130,255,.95);box-shadow:0 0 16px rgba(160,90,255,.45),inset 0 0 12px rgba(120,180,255,.14);}
  .hh-body{overflow-y:auto;overscroll-behavior:contain;flex:1;min-height:0;padding-right:8px;}
  .hh-body::-webkit-scrollbar{width:7px;}
  .hh-body::-webkit-scrollbar-thumb{background:rgba(140,110,230,.4);border-radius:7px;}
  .hh-lead{margin:0 0 12px;font-size:13px;line-height:1.55;color:#c9d3ea;opacity:.95;}
  .hh-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(268px,1fr));gap:10px;}
  .hh-item{position:relative;padding:11px 13px 12px;border-radius:12px;
    background:linear-gradient(180deg,rgba(22,19,38,.72),rgba(11,9,20,.72));
    border:1px solid rgba(120,90,200,.26);border-left:3px solid var(--hh-accent,#7dffa3);}
  .hh-item h4{margin:0 0 3px;font-size:13.5px;letter-spacing:.03em;color:#f2ecff;
    display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
  .hh-item .hh-ico{font-size:15px;line-height:1;}
  .hh-tag{font-size:9.5px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;
    padding:2px 7px;border-radius:999px;color:var(--hh-accent,#7dffa3);
    border:1px solid currentColor;opacity:.9;}
  .hh-item p{margin:0;font-size:12px;line-height:1.5;color:#a9b6d0;}
  .hh-realm{margin:14px 0 8px;font-size:11px;font-weight:900;letter-spacing:.14em;
    text-transform:uppercase;color:#8fb4e8;opacity:.85;}
  .hh-realm:first-of-type{margin-top:4px;}
  .hh-keys{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px 18px;font-size:12px;
    line-height:1.9;color:#a9b6d0;}
  .hh-keys b{color:#eef4ff;}
  .hh-note{margin:12px 0 0;padding:10px 13px;border-radius:12px;font-size:12px;line-height:1.55;color:#cfe1ff;
    background:linear-gradient(180deg,rgba(20,32,50,.62),rgba(10,18,30,.62));border:1px solid rgba(90,210,255,.3);}
  `;

  // ---------- content ----------
  const REALMS = [
    { n: '1 · Meadow', c: '#7dffa3', d: 'No hazards. Baseline squads and buildings — the realm to learn the ropes in.' },
    { n: '2 · Desert', c: '#ffd166', d: 'Quicksand pits drag you in and hold you still while the squads close.' },
    { n: '3 · Ice Cavern', c: '#9fe3ff', d: 'Ice chasms shove you around, and ranged hits leave you slowed and frost-bitten.' },
    { n: '4 · Lava Pits', c: '#ff7a66', d: 'Lava pools erupt in phases, and monsters explode when they die.' },
    { n: '5 · Neon Void', c: '#d066ff', d: 'Void tiles swallow anything standing on them, and enemies phase-dash at will.' },
  ];

  const MODES = [
    { ico: '🖥', n: 'Offline', tag: 'You + bots', c: '#5ad2ff', d: 'Battles on your own machine. Four modes: PvE (co-op survival with bot allies), PvP (free-for-all, last one standing), Teams (two titans, two sides) and Capture the Flag (first to five captures). Bots fill every empty slot.' },
    { ico: '🧍', n: 'Singleplayer', tag: 'Waves', c: '#7dffa3', d: 'Five realms, escalating waves of smarter enemies. Bosses land on waves 5, 10 and 15. Collect essence, spend it on glyphs between waves, and push your best wave as far as it goes.' },
    { ico: '👥', n: 'Multiplayer', tag: 'Lobbies', c: '#c066ff', d: 'Create a lobby, share the code (or the invite link) and let the host pick a mode and map. PvE, PvP, Teams and CTF all run online, with lobby chat plus the shared global chat.' },
    { ico: '📖', n: 'Story', tag: 'Chapters', c: '#ffd7a3', d: 'One chapter per realm, each opening with a cinematic and closing on that realm\u2019s warden. The road ends in the Soul Doorway gauntlet and a ten-stage fight with the Hollow — and how it ends is your choice.' },
  ];

  const MONSTERS = [
    { n: 'Ravener', tag: 'Swarmer', c: '#9fe3ff', d: 'The fastest and most common monster. Charges in packs and tears at you on contact — keep moving.' },
    { n: 'Bulwark', tag: 'Tank', c: '#ffd166', d: 'A walking wall of health. Slow, but its contact damage is brutal. Wear it down from range.' },
    { n: 'Marksman', tag: 'Shooter', c: '#ff9f6a', d: 'Keeps its distance and strafes while laying down rapid fire. Break its line or close the gap.' },
    { n: 'Sniper', tag: 'Long range', c: '#ff6b6b', d: 'Hangs far back and leads your movement before it fires. Watch the muzzle flash and change direction.' },
    { n: 'Bomber', tag: 'Splash', c: '#ff8c42', d: 'Lobs bombs that burst in a radius. Backs off if you get close, so punish it mid-throw.' },
    { n: 'Mender', tag: 'Support', c: '#7dffa3', d: 'Heals every monster around it from the centre of the arena. Kill it first or the wave never ends.' },
  ];

  const ELEM = [
    { n: 'Magma Lurker', tag: 'Fire', c: '#ff6a2a', d: 'A bomber of living rock — its magma bursts and leaves a burning pool.' },
    { n: 'Storm Caller', tag: 'Lightning', c: '#9fe3ff', d: 'Every bolt it fires forks into three.' },
    { n: 'Rime Warden', tag: 'Water', c: '#5fc4ff', d: 'Hurls a slow, heavy surge of cold water that slows you to a crawl.' },
    { n: 'Quake Strider', tag: 'Earth', c: '#7dffa3', d: 'Stomps the ground into a ring of stone — mind the gaps.' },
    { n: 'Soul Mote', tag: 'Spirit', c: '#c066ff', d: 'Casts a wisp that follows you until it burns out.' },
  ];

  const GUARDIANS = [
    { realm: 'Meadow landmarks', c: '#7dffa3', list: [
      { n: 'Hearth Warden', tag: 'Heals', d: 'Mends itself as it fights, so burst it down instead of chipping away.' },
      { n: 'Hay Golem', tag: 'Slows', d: 'Heavy and slow itself, but every hit leaves you crawling.' },
      { n: 'Huntress Shade', tag: 'Piercing', d: 'Fast, fragile and firing shafts that pass straight through cover.' },
    ] },
    { realm: 'Desert landmarks', c: '#ffd166', list: [
      { n: 'Pharaoh Mummy', tag: 'Sand', d: 'A deep health pool and a blinding sand blast. The toughest of the desert wardens.' },
      { n: 'Sun Priest', tag: 'Sun bolts', d: 'Keeps its distance and hammers you with burning sunbolts.' },
      { n: 'Dune Rider', tag: 'Fast darts', d: 'Quickest of the desert wardens — darts in, fires, and is gone again.' },
      { n: 'Bone Revenant', tag: 'Summons', d: 'Calls reinforcements to the landmark, so cut it down before the yard fills up.' },
    ] },
    { realm: 'Ice Cavern landmarks', c: '#9fe3ff', list: [
      { n: 'Frost Sprite', tag: 'Freeze', d: 'Small, quick, and its touch freezes you in place.' },
      { n: 'Glacier Knight', tag: 'Ice shards', d: 'Armoured and slow, throwing fans of ice shards that punish standing still.' },
      { n: 'Rime Oracle', tag: 'Freeze', d: 'Keeps its distance and freezes you the moment you commit to a push.' },
    ] },
    { realm: 'Lava Pits landmarks', c: '#ff7a66', list: [
      { n: 'Forge Smith', tag: 'Fire bolts', d: 'Punishes a straight approach with a stream of firebolts.' },
      { n: 'Magma Titan', tag: 'Eruption', d: 'The heaviest warden in the game. Its eruption attack floods the ground around it.' },
      { n: 'Cinder Priest', tag: 'Fire bolts', d: 'Weaker than the Titan but rarely alone — clear the escort first.' },
    ] },
    { realm: 'Neon Void landmarks', c: '#d066ff', list: [
      { n: 'Void Cultist', tag: 'Phase', d: 'Blinks out of your line mid-fight, so track the ring it leaves behind.' },
      { n: 'Phase Sentinel', tag: 'Phase', d: 'Tanky, phased and relentless — it hunts rather than guards.' },
      { n: 'Sanctum Mind', tag: 'Phase', d: 'The strongest void warden. Phases constantly and hits hard when it reappears.' },
    ] },
  ];

  const BOSSES = [
    { ico: '💀', n: 'The Arena Boss', tag: 'Waves 5 · 10 · 15', c: '#ff5a3a', d: 'Every fifth wave belongs to the boss. Wave 5 fires rapid bolts, wave 10 charges you down at double speed, and wave 15 lobs telegraphed bombs with a wide blast.' },
    { ico: '🔥', n: 'The Hearth Warden', tag: 'Meadow', c: '#7dffa3', d: 'The first story warden. Heals itself through the fight and changes up its attacks as its health drops.' },
    { ico: '🏺', n: 'The Pharaoh of Glass', tag: 'Desert', c: '#e3b749', d: 'Fights in stages behind shifting glass, opening new attack patterns as each stage breaks.' },
    { ico: '❄️', n: 'The Rime Oracle', tag: 'Ice Cavern', c: '#9fe3ff', d: 'Controls the floor as much as it controls you — freezing ground, shards and volleys in stages.' },
    { ico: '🌋', n: 'The Magma Titan', tag: 'Lava Pits', c: '#ff6a2a', d: 'A staged colossus that turns the arena into a furnace. Keep moving and learn its eruption tells.' },
    { ico: '🌌', n: "The Hollow's Echo", tag: 'Neon Void', c: '#c88aff', d: 'The last Warden, wearing every power you have reclaimed. Rifts, beams, chains and shards in a full kit of telegraphed attacks that evolves as the fight goes on.' },
    { ico: '🕳', n: 'The Hollow', tag: 'Final · 10 stages', c: '#e0c6ff', d: 'The end of the story. Ten stages, a metamorphosis mid-fight, and more than one way for it to finish.' },
  ];

  const GLYPHS = [
    { n: 'Fire', tag: 'Burn', c: '#ff6a2a', d: 'Ignite, burning shots, explosive finishes and a phoenix rebirth at the top of the tree.' },
    { n: 'Lightning', tag: 'Chain', c: '#9fe3ff', d: 'Arcing and forked bolts, charged rounds, blink strikes and a roaming ball lightning.' },
    { n: 'Spirit', tag: 'Summons', c: '#c066ff', d: 'Orbiting wisps, guardian spirits, haunt and possession — power that fights for you.' },
    { n: 'Water', tag: 'Control', c: '#5fc4ff', d: 'Chill, shards, permafrost, mending mist and the sanctuary that washes the arena clean.' },
    { n: 'Earth', tag: 'Defence', c: '#7dffa3', d: 'Thornmail, barriers, bulwark, stone pillars and a golem that walks the arena for you.' },
  ];

  const GEAR = [
    { n: 'Buildings & chests', tag: 'Loot', c: '#ffd7a3', d: 'Enter buildings through their doorways. Chests stay hidden until you are inside, and their rarity (common → legendary) decides how much ammo, health, shields, speed and essence spills out.' },
    { n: 'Hazards', tag: 'Lethal', c: '#ff7a66', d: 'Quicksand holds you, ice chasms shove you, lava erupts in phases and void tiles teleport monsters onto you. Later realms are the arena fighting back.' },
    { n: 'RuneStones', tag: 'Currency', c: '#ffe6b0', d: 'Earned from waves and chests. Spend them in the Shop on new weapons and melee, then choose what you carry in the Loadout.' },
    { n: 'Ranks & quests', tag: 'Progress', c: '#9fd2ff', d: 'Surviving waves earns XP and climbs your rank — the emblem sits beside your name. Levels also gate on survival records, and quests pay out RuneStones.' },
    { n: 'Customise', tag: 'Skins', c: '#c066ff', d: 'Player designs and colours, gun skins and melee skins. The higher your best wave, the more of the rack unlocks.' },
    { n: 'Chat', tag: 'Community', c: '#7dffa3', d: 'Global chat sits on the home screen and reaches everyone in the game; each lobby also has its own chat, and matches have an in-game feed.' },
  ];

  const CONTROLS = [
    ['W A S D / Arrows', 'move'],
    ['Mouse', 'aim'],
    ['Click / hold', 'shoot'],
    ['Space', 'jump (you can fire mid-air)'],
    ['Shift', 'slide — third-person with a neon trail'],
    ['R', 'reload'],
    ['G', 'throw or plant your equipped utility'],
    ['Q', 'draw your melee weapon'],
    ['E', 'back to guns · press again to switch weapon'],
    ['F', 'melee swing'],
    ['V', 'cycle camera view'],
    ['Esc', 'pause'],
    ['H', 'this handbook'],
  ];

  const MOBILE = [
    ['Left stick', 'move'],
    ['Right stick', 'aim'],
    ['FIRE', 'shoot'],
    ['WPN', 'switch weapon'],
    ['RLD', 'reload'],
    ['SLIDE / JUMP / MELEE', 'action buttons'],
  ];

  const PAD = [
    ['Left stick', 'move'],
    ['Right stick', 'aim'],
    ['RT', 'shoot'],
    ['A', 'jump'],
    ['B', 'slide'],
    ['X', 'reload'],
    ['Y', 'melee swing'],
    ['LB / RB', 'draw melee · switch weapon'],
    ['D-pad up', 'cycle camera view'],
    ['Start / Back', 'pause · this handbook'],
  ];

  // ---------- render ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function item(o) {
    return `<div class="hh-item" style="--hh-accent:${o.c || '#7dffa3'}">` +
      `<h4>${o.ico ? `<span class="hh-ico">${o.ico}</span>` : ''}${esc(o.n)}` +
      (o.tag ? `<span class="hh-tag">${esc(o.tag)}</span>` : '') + `</h4>` +
      `<p>${esc(o.d)}</p></div>`;
  }
  const grid = (list) => `<div class="hh-grid">${list.map(item).join('')}</div>`;
  const lead = (t) => `<p class="hh-lead">${esc(t)}</p>`;

  function modesPage() {
    return lead('Four ways to play, one arena. Every mode shares the same weapons, glyphs and rank.') +
      grid(MODES) +
      `<div class="hh-realm">The five realms</div>` +
      grid(REALMS.map((r) => ({ n: r.n, c: r.c, d: r.d }))) +
      `<p class="hh-note">Bosses arrive on waves 5, 10 and 15 in survival modes. In Story, each realm ends on its own warden instead.</p>`;
  }

  function monstersPage() {
    return lead('Monsters fight in squads, not as a mob: leaders and flankers, shared alerts, and a real reaction to your gunfire.') +
      grid(MONSTERS) +
      `<div class="hh-realm">Elemental monsters — summoned by your own glyphs</div>` +
      grid(ELEM) +
      `<p class="hh-note">Enchanting the first glyph of an element teaches its creatures a new attack. Every elemental monster appears from its own wave onward, and only once that element is open — so the power you buy comes with a price.</p>`;
  }

  function guardiansPage() {
    let html = lead('Rare themed landmarks are defended. Wardens orbit their post, wake when you come close, then hunt you with ranged attacks and a special of their own. Their rarity raises their rank — Ascended, Exalted and Mythic wardens are bigger, tougher and arrive in greater numbers.');
    for (const g of GUARDIANS) {
      html += `<div class="hh-realm" style="color:${g.c}">${esc(g.realm)}</div>`;
      html += grid(g.list.map((i) => ({ ...i, c: g.c })));
    }
    html += `<p class="hh-note">A landmark's chest is the prize behind its wardens. Clear them, or slip past while they are still orbiting — but a woken warden will chase you a long way.</p>`;
    return html;
  }

  function bossesPage() {
    return lead('Bosses are fights of their own: telegraphed attacks, stages that change their patterns, and a health bar at the top of the screen that names what you are facing.') +
      grid(BOSSES) +
      `<p class="hh-note">Watch the health bar label — it reads SEALED, STAGE n or EVOLVED, telling you which phase the boss is in right now.</p>`;
  }

  function glyphsPage() {
    return lead('Essence is power. Between waves you pick a path and enchant its nodes: nine per element, each one stacking on the last. A path is a playstyle, not a stat.') +
      grid(GLYPHS) +
      `<p class="hh-note">Choosing a path grants its starter node free — Ignite, Static, Soul Tap, Drench or Stone Skin. Dying in an offline run strips your enchantments, so every life is a fresh build; co-op keeps what you earned, and the versus modes wipe the tree on respawn.</p>`;
  }

  function gearPage() {
    return lead('The rules of the arena, the currency and the things you keep between runs.') + grid(GEAR);
  }

  function controlsPage() {
    const rows = (list) => `<div class="hh-keys">${list.map(([k, v]) => `<div><b>${esc(k)}</b> — ${esc(v)}</div>`).join('')}</div>`;
    return lead('Keyboard and mouse on desktop, twin sticks on touch, any standard controller.') +
      `<div class="hh-realm">Keyboard</div>` + rows(CONTROLS) +
      `<div class="hh-realm">Touch</div>` + rows(MOBILE) +
      `<div class="hh-realm">Controller</div>` + rows(PAD) +
      `<p class="hh-note">The fullscreen button sits at the top of the screen — on phones that is the only way to get the whole arena on screen. If the browser blocks it, turn the device sideways first.</p>`;
  }

  const TABS = [
    { id: 'modes', label: '🎮 Modes', page: modesPage },
    { id: 'monsters', label: '👹 Monsters', page: monstersPage },
    { id: 'guardians', label: '🗿 Guardians', page: guardiansPage },
    { id: 'bosses', label: '💀 Bosses', page: bossesPage },
    { id: 'glyphs', label: '✦ Glyphs', page: glyphsPage },
    { id: 'gear', label: '💰 Gear & Rules', page: gearPage },
    { id: 'controls', label: '⌨️ Controls', page: controlsPage },
  ];

  let active = 'modes';
  let built = false;

  function paint() {
    const host = document.getElementById('helpBody');
    if (!host) return;
    host.innerHTML =
      `<div class="hh-tabs">` +
      TABS.map((t) => `<button type="button" class="hh-tab${t.id === active ? ' is-on' : ''}" data-hh="${t.id}">${t.label}</button>`).join('') +
      `</div><div class="hh-body" id="hhBody"></div>`;
    const body = host.querySelector('#hhBody');
    const tab = TABS.find((t) => t.id === active) || TABS[0];
    if (body) body.innerHTML = tab.page();
    host.querySelectorAll('.hh-tab').forEach((b) => {
      b.addEventListener('click', () => {
        active = b.dataset.hh;
        paint();
        host.scrollTop = 0;
      });
    });
  }

  function build() {
    if (built) return;
    const host = document.getElementById('helpBody');
    if (!host) return;
    built = true;
    if (!document.getElementById('helpHandbookCSS')) {
      const st = document.createElement('style');
      st.id = 'helpHandbookCSS';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    paint();
  }

  // Build on load (the overlay is already in the DOM) — re-painting later is
  // free, so the handbook also survives a script reload.
  build();

  window.HelpPanel = { build: build, show: function (tab) { if (tab) active = tab; build(); paint(); } };
})();
