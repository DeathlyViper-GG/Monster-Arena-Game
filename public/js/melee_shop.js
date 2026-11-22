/* =====================================================================
   melee_shop.js — the melee chests in the Customize screen.

   Four chests sit above the melee grids: Bronze, Steel, Energy and God.
   Each costs RuneStones and rolls a rarity against its own odds, then
   hands over the weapon itself — a melee weapon of that rarity the player
   does not own yet, which is then theirs to wield. Nothing here upgrades a
   weapon already in the collection: the chests are simply how the weapons
   are found.

   The grids themselves are drawn by the game; this file only supplies
   the chests, the purse, the reveal and the "which chest drops this"
   hint a locked card shows.
   ===================================================================== */
(function (G) {
  'use strict';

  const C = () => G.MeleeCatalog;
  let pending = null;      // chest awaiting confirmation
  let cssDone = false;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------------------------------------------------------- CSS */
  function injectCSS() {
    if (cssDone) return;
    cssDone = true;
    const s = document.createElement('style');
    s.textContent = `
    #meleeShop{margin-bottom:16px;font-family:inherit;}
    .msBar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px;}
    .msWallet{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;font-weight:900;letter-spacing:.04em;
      background:linear-gradient(180deg,rgba(46,34,12,.7),rgba(20,15,6,.7));border:1px solid rgba(255,210,120,.5);
      color:#ffe6b0;text-shadow:0 0 10px rgba(255,200,120,.55);box-shadow:0 0 18px rgba(255,190,90,.18) inset;}
    .msWallet i{width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff8d6,#ffb43c 60%,#8a4c00);
      box-shadow:0 0 10px rgba(255,190,80,.9);display:block;}
    .msCount{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#9fd2ff;opacity:.9;}
    .msCount b{color:#eaf4ff;}
    .msRail{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;}
    .msChest{position:relative;border-radius:14px;padding:10px 10px 12px;cursor:pointer;overflow:hidden;text-align:center;
      background:linear-gradient(180deg,rgba(22,18,38,.9),rgba(10,8,18,.9));
      border:1px solid rgba(120,90,200,.34);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease;}
    .msChest:hover{transform:translateY(-2px);border-color:rgba(190,150,255,.8);box-shadow:0 12px 26px rgba(0,0,0,.5),0 0 20px rgba(140,90,240,.35);}
    .msChest.is-pending{border-color:rgba(255,210,120,.85);box-shadow:0 0 22px rgba(255,190,90,.4);}
    .msChest.flash{animation:msFlash .7s ease;}
    @keyframes msFlash{0%,100%{box-shadow:0 0 0 rgba(255,220,150,0)}45%{box-shadow:0 0 34px rgba(255,220,150,.85)}}
    .msArt{position:relative;height:58px;margin:2px auto 8px;width:78px;}
    .msLid{position:absolute;left:0;right:0;top:0;height:22px;border-radius:8px 8px 3px 3px;
      background:linear-gradient(180deg,var(--mr),var(--mm));border:1px solid rgba(255,255,255,.22);box-shadow:inset 0 -4px 8px rgba(0,0,0,.4);}
    .msBody{position:absolute;left:3px;right:3px;top:20px;bottom:0;border-radius:4px 4px 8px 8px;
      background:linear-gradient(180deg,var(--mm),rgba(10,8,16,.95));border:1px solid rgba(255,255,255,.16);}
    .msLock{position:absolute;left:50%;top:26px;transform:translateX(-50%);width:16px;height:16px;border-radius:3px;
      background:linear-gradient(180deg,#fff,var(--mr));box-shadow:0 0 12px var(--mr);}
    .msChestName{font-size:12px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:#f0e8ff;}
    .msPrice{margin-top:2px;font-size:13px;font-weight:900;color:#ffe6b0;}
    .msOdds{display:flex;height:6px;border-radius:4px;overflow:hidden;margin:8px 0 5px;background:rgba(0,0,0,.5);}
    .msOdds span{display:block;height:100%;}
    .msOddsKey{font-size:9px;line-height:1.35;letter-spacing:.02em;color:#a9a2cf;}
    .msPool{margin-top:5px;font-size:9.5px;line-height:1.3;letter-spacing:.04em;color:#c9b6ff;opacity:.9;}
    .msConfirm{display:flex;gap:6px;margin-top:8px;}
    .msConfirm button{flex:1;border-radius:9px;padding:6px 4px;font-size:11px;font-weight:900;cursor:pointer;
      border:1px solid rgba(255,210,120,.6);background:linear-gradient(180deg,#4a3410,#241804);color:#ffe6b0;}
    .msConfirm button.no{border-color:rgba(150,120,220,.5);background:linear-gradient(180deg,#241a3a,#120c22);color:#c9b6ff;}
    .msReveal{position:fixed;inset:0;z-index:120;display:none;place-items:center;background:rgba(4,3,10,.82);backdrop-filter:blur(3px);}
    .msReveal.on{display:grid;}
    .msRevealCard{width:min(400px,92vw);padding:24px 20px;border-radius:20px;text-align:center;position:relative;
      background:linear-gradient(180deg,rgba(24,18,44,.97),rgba(8,6,16,.98));
      border:1px solid var(--mg,rgba(180,150,255,.5));box-shadow:0 30px 80px rgba(0,0,0,.7),0 0 60px var(--mg,rgba(160,110,255,.3));
      animation:msPop .38s cubic-bezier(.2,1.2,.4,1);}
    @keyframes msPop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}
    .msRevealCard img{width:150px;height:150px;object-fit:contain;display:block;margin:4px auto 8px;
      filter:drop-shadow(0 0 22px var(--mg,rgba(160,110,255,.6)));}
    .msRevealCard h3{margin:2px 0 4px;font-family:var(--font-heading,Georgia,serif);font-size:23px;color:#fff;}
    .msRar{font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;}
    .msRevealCard p{margin:6px 0 12px;font-size:13px;line-height:1.5;color:#cbd6ea;}
    .msStats{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:14px;}
    .msStats span{font-size:10.5px;letter-spacing:.05em;padding:4px 9px;border-radius:999px;
      background:rgba(255,255,255,.06);border:1px solid rgba(180,220,255,.2);color:#cfe1ff;}
    .msSpin{width:96px;height:96px;margin:10px auto 14px;border-radius:14px;
      background:conic-gradient(from 0deg,var(--mr,#c3ccd9),transparent 40%,var(--mr,#c3ccd9));
      animation:msSpin 1.1s linear infinite;box-shadow:0 0 40px var(--mr,#c3ccd9);}
    @keyframes msSpin{to{transform:rotate(360deg)}}
    @media (max-width:700px){ .msRail{grid-template-columns:repeat(auto-fit,minmax(128px,1fr));} }`;
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------- markup */
  function ensureHost() {
    const tab = document.getElementById('meleeTab');
    if (!tab) return null;
    let wrap = document.getElementById('meleeShop');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'meleeShop';
      wrap.innerHTML =
        '<div class="msBar">' +
          '<div class="msWallet"><i></i><span id="msBal">0</span> RuneStones</div>' +
          '<div class="msCount" id="msCount"></div>' +
        '</div>' +
        '<div class="msRail" id="msChests"></div>';
      tab.insertBefore(wrap, tab.firstChild);
    }
    return wrap;
  }

  function chestArt(chest, RARITY, ORDER) {
    const w = chest.weights;
    const C4 = C();
    // what is actually in this chest, and how much of it is still missing
    const inside = (C4 ? C4.WEAPONS : []).filter(x => (w[x.rarity] || 0) > 0);
    const left = inside.filter(x => !(C4 && C4.hasOwned(x.id))).length;
    let total = 0;
    ORDER.forEach(k => { total += w[k] || 0; });
    total = total || 1;
    const seg = (k) => `<span style="width:${((w[k] || 0) / total * 100).toFixed(1)}%;background:${RARITY[k].color}"></span>`;
    const key = ORDER.filter(k => (w[k] || 0) > 0)
      .map(k => RARITY[k].name + ' ' + Math.round((w[k] || 0) / total * 100) + '%').join(' · ');
    return '<div class="msArt" style="--mm:' + chest.metal + ';--mr:' + chest.rim + '">' +
        '<div class="msLid"></div><div class="msBody"></div><div class="msLock"></div></div>' +
      '<div class="msChestName">' + esc(chest.name) + '</div>' +
      '<div class="msPrice">✦ ' + chest.price + '</div>' +
      '<div class="msOdds">' + ORDER.map(seg).join('') + '</div>' +
      '<div class="msOddsKey">' + key + '</div>' +
      '<div class="msPool">' + inside.length + ' weapons inside · ' +
        (left ? left + ' still to find' : 'all collected') + '</div>';
  }

  function buildChests() {
    const C4 = C();
    const rail = document.getElementById('msChests');
    if (!C4 || !rail) return;
    rail.innerHTML = '';
    C4.CHESTS.forEach(chest => {
      const card = document.createElement('div');
      card.className = 'msChest' + (pending === chest.id ? ' is-pending' : '');
      card.innerHTML = chestArt(chest, C4.RARITY, C4.ORDER);
      if (pending === chest.id) {
        const row = document.createElement('div');
        row.className = 'msConfirm';
        const yes = document.createElement('button');
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

  function refresh() {
    injectCSS();
    ensureHost();
    const C4 = C();
    if (!C4) return;
    const bal = document.getElementById('msBal');
    if (bal) bal.textContent = (G.RS && G.RS.balance) ? G.RS.balance() : '0';
    const count = document.getElementById('msCount');
    if (count) count.innerHTML = '<b>' + C4.owns().length + '</b> / ' + C4.WEAPONS.length + ' melee unlocked';
    buildChests();
    if (typeof G.buildMeleeUI === 'function') G.buildMeleeUI();
  }

  /* ------------------------------------------------------------ opening */
  function flash() {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:130;background:#fff;opacity:0;transition:opacity .12s ease;';
    document.body.appendChild(d);
    requestAnimationFrame(() => { d.style.opacity = '.8'; });
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 220); }, 90);
  }

  function openChest(chestId) {
    const C4 = C();
    if (!C4) return;
    const chest = C4.CHEST_BY_ID[chestId];
    if (!chest) return;
    const bal = G.RS && G.RS.balance ? G.RS.balance() : 0;
    if (bal < chest.price) {
      pending = null;
      buildChests();
      const w = document.getElementById('msBal');
      if (w) { w.style.color = '#ff8a8a'; setTimeout(() => { w.style.color = ''; }, 900); }
      return;
    }
    if (G.RS && G.RS.spend && !G.RS.spend(chest.price)) return;

    const result = C4.roll(chestId);
    pending = null;
    if (!result) return;
    if (result.refund) {
      if (G.RS && G.RS.add) G.RS.add(result.refund, 'Duplicate melee refund');
      refresh();
      return;
    }
    C4.grant(result.id);
    refresh();
    reveal(result.id, chest);
  }

  function spriteUrl(id) {
    const C4 = C();
    const w = C4 && C4.BY_ID[id];
    const files = G.Melee && G.Melee._files;
    if (!w || !files || !files[w.rarity]) return '';
    return files[w.rarity].basePath + id + '.png';
  }

  function reveal(id, chest) {
    const C4 = C();
    const w = C4 && C4.BY_ID[id];
    if (!w) return;
    const rar = C4.RARITY[w.rarity];
    let host = document.getElementById('msReveal');
    if (!host) {
      host = document.createElement('div');
      host.id = 'msReveal';
      host.className = 'msReveal';
      host.innerHTML = '<div class="msRevealCard" id="msRevealCard"></div>';
      host.addEventListener('click', (e) => { if (e.target === host) host.classList.remove('on'); });
      document.body.appendChild(host);
    }
    const card = document.getElementById('msRevealCard');
    // The wheel spins first and settles on the rarity that was rolled; the
    // weapon itself is only shown once it has come to rest.
    const show = () => {
      card.style.setProperty('--mg', rar.glow);
      host.classList.add('on');
      flash();
      card.innerHTML =
        '<div class="msRar" style="color:' + rar.color + '">New melee weapon · ' + rar.name + '</div>' +
        '<img src="' + spriteUrl(id) + '" alt="' + esc(w.name) + '" />' +
        '<h3>' + esc(w.name) + '</h3>' +
        '<p>' + esc(w.blurb) + '</p>' +
        '<div class="msStats"><span>×' + w.dmg.toFixed(2) + ' power</span>' +
          '<span>' + Math.round(w.reach) + ' reach</span>' +
          '<span>' + Math.round(w.arc) + '° arc</span>' +
          '<span>' + w.cd.toFixed(2) + 's swing</span></div>' +
        '<p style="margin:-4px 0 12px;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#9fd2ff">added to your collection</p>' +
        '<button class="btn bigBtn" id="msRevealOk">Wield it</button>';
      const ok = document.getElementById('msRevealOk');
      if (ok) ok.onclick = () => {
        host.classList.remove('on');
        if (typeof G.selectMelee === 'function') G.selectMelee(w.rarity, w.id);
        refresh();
      };
    };

    if (G.ChestWheel) {
      G.ChestWheel.play({
        kind: 'melee', title: chest.name, accent: chest.rim,
        order: C4.ORDER, weights: chest.weights,
        rarity: C4.RARITY, winner: w.rarity, done: show
      });
    } else {
      show();
    }
  }

  // Called when a locked grid card is clicked: bring the chests into view.
  function focusChests() {
    refresh();
    const host = document.getElementById('meleeShop');
    if (!host) return;
    host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    host.querySelectorAll('.msChest').forEach(c => {
      c.classList.remove('flash');
      void c.offsetWidth;
      c.classList.add('flash');
    });
  }

  /* ------------------------------------------------------------- wiring */
  function hookTab() {
    const btn = document.getElementById('tabMeleeBtn');
    if (btn && !btn._msHooked) {
      btn._msHooked = true;
      // additive, so the game's own tab handler is never replaced
      btn.addEventListener('click', () => setTimeout(refresh, 0));
    }
    refresh();
  }

  function init() {
    injectCSS();
    hookTab();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  setTimeout(hookTab, 700);
  setTimeout(hookTab, 1700);

  G.MeleeShop = { refresh, openChest, focus: focusChests, buildChests };
})(window);
