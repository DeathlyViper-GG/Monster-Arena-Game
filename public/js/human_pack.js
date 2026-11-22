/* =====================================================================
   human_pack.js — the Human Model Pack.

   A secret key unlocks the pack, RuneStones buy it, and the Customise screen
   then offers the fifteen human characters (plus the hovering shell). The
   unlock, the purchase and the chosen skin live in localStorage like the rest
   of the offline-first save.

   avatar_human.js draws the chosen human in the arena; human_preview.js shows
   it live in Customise.
   ===================================================================== */
(function (G) {
  'use strict';

  const KEY = 'arena_human_pack';
  const SECRET = 'ARENA-HUMAN-9K2F';   // shared with players to unlock the pack
  const COST = 2000;                  // RuneStones once the key is redeemed

  // pal = [skin, shirt, pants, boot, hair]; the order matches the rig's look.
  const SKINS = [
    { n: 'Default',        tag: 'Human',        pal: { skin: '#d9a47f', shirt: '#2f6f7a', pants: '#3b4252', boot: '#20232b', hair: '#2a1d16' } },
    { n: 'Spikes Shell',   tag: 'Bone',         pal: { skin: '#7a8a4a', shirt: '#5a3d26', pants: '#3a2a1c', boot: '#1d1710', hair: '#1d1710' } },
    { n: 'Toothy Maw',     tag: 'Feral',        pal: { skin: '#6fae5a', shirt: '#5c2d7a', pants: '#2b2140', boot: '#14101c', hair: '#1a0f24' } },
    { n: 'Hex Armour',     tag: 'Plated',       pal: { skin: '#d9a47f', shirt: '#3d4a5c', pants: '#2a3340', boot: '#161b22', hair: '#111111' } },
    { n: 'Cyber Halo',     tag: 'Hard-light',   pal: { skin: '#e6e1da', shirt: '#1b2a40', pants: '#131c2b', boot: '#0b1018', hair: '#dff5ff' } },
    { n: 'Void Flame',     tag: 'Burning',      pal: { skin: '#4a3a66', shirt: '#15101f', pants: '#0e0a16', boot: '#07050c', hair: '#070510' } },
    { n: 'Crystal Shards', tag: 'Crystalline',  pal: { skin: '#cfe9f2', shirt: '#4a8ca8', pants: '#2f5870', boot: '#1c3445', hair: '#9ad0e6' } },
    { n: 'Nano Arms',      tag: 'Swarm',        pal: { skin: '#dadde2', shirt: '#3b3f47', pants: '#272a30', boot: '#16181c', hair: '#16181c' } },
    { n: 'Plasma Horns',   tag: 'Plasma',       pal: { skin: '#c95a4a', shirt: '#7a1d2b', pants: '#3a1018', boot: '#1c080c', hair: '#1c080c' } },
    { n: 'Tri-Blade Wheel',tag: 'Bladed',       pal: { skin: '#b9876a', shirt: '#8a6a22', pants: '#35302a', boot: '#1c1a16', hair: '#241a10' } },
    { n: 'Angel Wings',    tag: 'Feathered',    pal: { skin: '#f0d2bd', shirt: '#f4f1ea', pants: '#d8d2c4', boot: '#c9a74a', hair: '#f0d56a' } },
    { n: 'Cyber Wings',    tag: 'Hard-light',   pal: { skin: '#9fd6e8', shirt: '#13304a', pants: '#0d2236', boot: '#08141f', hair: '#2affe0' } },
    { n: 'Void Wings',     tag: 'Void',         pal: { skin: '#6a4a86', shirt: '#2a1744', pants: '#180c2a', boot: '#0b0615', hair: '#c23bff' } },
    { n: 'Fire Wings',     tag: 'Fire',         pal: { skin: '#e08a52', shirt: '#8a2310', pants: '#3a140c', boot: '#1c0a06', hair: '#ffb020' } },
    { n: 'Insect Wings',   tag: 'Chitin',       pal: { skin: '#9ac26b', shirt: '#4b6b2a', pants: '#2f4220', boot: '#1b2612', hair: '#1b2612' } }
  ];

  const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const CODE = norm(SECRET);

  // Cached: the arena asks for the pack state every frame.
  let cache = null;
  function read() {
    if (cache) return cache;
    let o = {};
    try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { o = {}; }
    const skin = Number.isInteger(o.skin) ? o.skin : -1;
    cache = { key: !!o.key, owned: !!o.owned, skin: skin >= 0 && skin < SKINS.length ? skin : -1 };
    return cache;
  }
  function write(o) {
    cache = o;
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (_) {}
  }

  const adminOn = () => !!(G.AdminMode && G.AdminMode.on && G.AdminMode.on());
  const owned = () => read().owned;
  const keyUnlocked = () => read().key || adminOn();
  const skin = () => read().skin;
  // A human only walks the arena when one is actually chosen — "Shell" puts
  // the hovering orb back.
  const equipped = () => { const st = read(); return st.owned && st.skin >= 0; };
  function skinData() {
    const st = read();
    return st.owned && st.skin >= 0 ? SKINS[st.skin].pal : null;
  }

  // ---- actions ----------------------------------------------------------
  function redeem(input) {
    const st = read();
    if (st.key) return 'already';
    if (norm(input) !== CODE) return 'bad';
    write(Object.assign({}, st, { key: true }));
    toast('Secret key accepted', 'The Human Model Pack is now for sale');
    refresh();
    return 'ok';
  }

  function buy() {
    const st = read();
    if (st.owned) return 'owned';
    if (!st.key && !adminOn()) return 'locked';
    if (!G.RS || !G.RS.spend(COST)) return 'poor';
    write({ key: true, owned: true, skin: 0 });
    toast('Human Model Pack', 'All fifteen human skins unlocked');
    refresh();
    return 'ok';
  }

  function select(i) {
    const st = read();
    if (!st.owned) return false;
    const n = Number.isInteger(i) ? i : -1;
    write(Object.assign({}, st, { skin: n >= 0 && n < SKINS.length ? n : -1 }));
    refresh();
    return true;
  }

  // ---- small toast (reuses the shop's look) ------------------------------
  function toast(title, sub) {
    let el = document.getElementById('humanToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'humanToast';
      el.style.cssText = 'position:fixed;left:50%;top:120px;transform:translateX(-50%);z-index:61;padding:11px 18px;' +
        'border-radius:14px;background:linear-gradient(180deg,rgba(20,12,30,.95),rgba(8,6,16,.92));' +
        'border:1px solid rgba(192,102,255,.65);box-shadow:0 10px 30px rgba(0,0,0,.55),0 0 22px rgba(192,102,255,.35);' +
        'color:#f2e9ff;font-weight:800;letter-spacing:.04em;text-align:center;pointer-events:none;transition:opacity .4s ease;';
      document.body.appendChild(el);
    }
    el.innerHTML = '<div>' + title + '</div><div style="font-size:11px;font-weight:500;opacity:.75;margin-top:2px">' + sub + '</div>';
    el.style.opacity = '1'; el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; setTimeout(() => { el.style.display = 'none'; }, 420); }, 2400);
  }

  // ---- shop card --------------------------------------------------------
  function shopCard() {
    const st = read();
    const bal = G.RS ? G.RS.balance() : 0;
    const card = document.createElement('div');
    card.className = 'shopItem ' + (st.owned ? 'owned' : (st.key && bal >= COST ? '' : 'locked'));
    let btn, note;
    if (st.owned) { btn = '✓ Owned'; note = 'Equip the human characters in Customise → Humans.'; }
    else if (!st.key) { btn = '🔑 Secret key needed'; note = 'A secret key unlocks this pack. Enter it in Customise → Humans.'; }
    else if (bal < COST) { btn = 'Need ' + COST; note = 'The key is redeemed — RuneStones short.'; }
    else { btn = 'Unlock'; note = 'Includes fifteen animated human characters.'; }
    card.innerHTML =
      '<div style="height:104px;display:grid;place-items:center;font-size:52px;text-shadow:0 0 22px rgba(192,102,255,.6)">🧍</div>' +
      '<div class="siName">Human Model Pack</div>' +
      '<div class="siDesc">Full 3D human fighters with their own walk, dash, jump and shooting animations. Fifteen skins — bone spikes, halos, wings, horns and more. Choose one in Customise → Humans.</div>' +
      '<div class="siStats">15 CHARACTERS · ANIMATED · COSMETIC</div>' +
      '<div class="siCost"><img src="' + (G.RS ? G.RS.SPRITE_URL : '') + '"/> ' + COST + ' RuneStones</div>' +
      '<button class="shopBuy ' + (st.owned ? 'owned' : (st.key && bal >= COST ? 'afford' : 'locked')) + '">' + btn + '</button>' +
      '<div style="font-size:11px;opacity:.65;margin-top:8px;position:relative;z-index:1">' + note + '</div>';
    const b = card.querySelector('.shopBuy');
    if (!st.owned && st.key && bal >= COST) {
      b.addEventListener('click', () => { if (buy() === 'ok') { if (G.RS) G.RS.buildShop(); } });
    } else if (!st.owned && !st.key) {
      b.addEventListener('click', () => { openCustomize(); });
    }
    return card;
  }
  function closeShop() {
    const s = document.getElementById('shopClose');
    if (s) { s.click(); return; }
    const ov = document.getElementById('overlayShop');
    if (ov) ov.style.display = 'none';
  }
  // Straight to the pack's own tab, through the Customise screen's own opener
  // so the rest of that screen is built the usual way.
  function openCustomize() {
    closeShop();
    const open = document.getElementById('introCustomize');
    const ov = document.getElementById('overlayCustomize');
    if (open) open.click();
    else if (ov) {
      document.querySelectorAll('.overlay').forEach((o) => { if (o.id !== 'overlayCustomize') o.style.display = 'none'; });
      ov.style.display = 'grid';
    }
    openTab();
  }

  // ---- Customise → Humans tab -------------------------------------------
  let built = false;
  function injectTab() {
    if (built) return true;
    const bar = document.querySelector('#overlayCustomize .tabBar');
    const playerTab = document.getElementById('playerTab');
    const card = bar && bar.closest('.card');
    if (!bar || !playerTab || !card) return false;
    built = true;

    const btn = document.createElement('button');
    btn.className = 'tabBtn';
    btn.id = 'tabHumansBtn';
    btn.type = 'button';
    btn.textContent = 'Humans';
    bar.appendChild(btn);

    const pane = document.createElement('div');
    pane.id = 'humanTab';
    pane.className = 'tabContent';
    pane.style.display = 'none';
    const saveRow = card.querySelector('.row');
    if (saveRow) saveRow.parentNode.insertBefore(pane, saveRow);
    else playerTab.parentNode.appendChild(pane);

    btn.onclick = () => { openTab(); };
    ['tabPlayerBtn', 'tabGunsBtn', 'tabMeleeBtn'].forEach((id) => {
      const other = document.getElementById(id);
      if (other) other.addEventListener('click', () => { pane.style.display = 'none'; btn.classList.remove('active'); });
    });
    return true;
  }

  function openTab() {
    if (!injectTab()) return;
    document.querySelectorAll('#overlayCustomize .tabContent').forEach((c) => { c.style.display = 'none'; });
    document.querySelectorAll('#overlayCustomize .tabBtn').forEach((b) => b.classList.remove('active'));
    const pane = document.getElementById('humanTab');
    const btn = document.getElementById('tabHumansBtn');
    if (pane) pane.style.display = 'block';
    if (btn) btn.classList.add('active');
    renderTab();
  }

  function renderTab() {
    const pane = document.getElementById('humanTab');
    if (!pane) return;
    const st = read();

    /* not bought yet: key entry, then the purchase */
    if (!st.owned) {
      pane.innerHTML =
        '<p>The <b>Human Model Pack</b> puts a full 3D human fighter on the field in place of the shell — ' +
        'fifteen skins, each with its own walk, dash, jump and shooting animations.</p>' +
        '<div class="glyph-info" style="margin-top:12px">' +
          '<h3>🔑 Unlock with a secret key</h3>' +
          (st.key
            ? '<p style="color:#9fe3ff">Key accepted — the pack is on sale for <b>' + COST + ' RuneStones</b>.</p>' +
              '<div class="glyph-row"><span class="chip small">Balance: ' + (G.RS ? G.RS.balance() : 0) + '</span>' +
              '<button class="btn bigBtn" id="humanBuy">BUY THE PACK — ' + COST + '</button>' +
              '<button class="btn" id="humanGoShop" type="button">Open shop</button></div>'
            : '<p>Enter the secret key to put the pack on sale.</p>' +
              '<div class="glyph-row"><input class="input" id="humanKey" placeholder="SECRET KEY" maxlength="24" autocomplete="off" ' +
              'style="text-transform:uppercase;letter-spacing:.16em;flex:1;min-width:160px" />' +
              '<button class="btn bigBtn" id="humanRedeem" type="button">Redeem</button></div>' +
              '<div id="humanKeyMsg" style="font-size:12px;margin-top:8px;opacity:.8"></div>') +
        '</div>';

      const keyBtn = document.getElementById('humanRedeem');
      if (keyBtn) keyBtn.onclick = () => {
        const input = document.getElementById('humanKey');
        const res = redeem(input ? input.value : '');
        if (res === 'bad') {
          const msg = document.getElementById('humanKeyMsg');
          if (msg) { msg.textContent = 'That key does not fit this pack.'; msg.style.color = '#ff8a8a'; }
        }
      };
      const keyInput = document.getElementById('humanKey');
      if (keyInput) keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') keyBtn.click(); });

      const buyBtn = document.getElementById('humanBuy');
      if (buyBtn) buyBtn.onclick = () => {
        const res = buy();
        if (res === 'poor') { buyBtn.textContent = 'NOT ENOUGH RUNESTONES'; return; }
        if (res === 'ok') renderTab();
      };
      const goShop = document.getElementById('humanGoShop');
      if (goShop) goShop.onclick = () => { if (G.RS) G.RS.openShop(); };
      return;
    }

    /* owned: the skins */
    const sel = read().skin;
    pane.innerHTML =
      '<p>Pick your fighter. <b>Shell</b> returns you to the hovering orb.</p>' +
      '<div class="avWrap">' +
        '<div class="avStage"><canvas id="humanPreview" aria-label="Human preview"></canvas>' +
          '<div class="avTag" id="humanPreviewTag">' + (sel >= 0 ? SKINS[sel].n : 'Shell') + '</div>' +
          '<div class="avHint">drag to turn</div>' +
          '<div class="avMeta" id="humanPreviewMeta">' + (sel >= 0 ? 'HUMAN · ' + SKINS[sel].tag : 'HOVERING SHELL') + '</div>' +
        '</div>' +
        '<div class="avSide"><div class="avSideTitle">Animation</div><div id="humanAnimRow" class="clothesRow"></div></div>' +
      '</div>' +
      '<div id="humanGrid" class="skinGrid"></div>';

    const grid = document.getElementById('humanGrid');
    SKINS.forEach((s, i) => {
      const c = document.createElement('div');
      c.className = 'skinCard' + (i === sel ? ' selected' : '');
      const icon = document.createElement('div');
      icon.className = 'skinIcon skinStage';
      const cv = document.createElement('canvas');
      cv.width = 120; cv.height = 120;
      if (G.HumanPreview) G.HumanPreview.icon(cv, i);
      icon.appendChild(cv);
      c.appendChild(icon);
      const nm = document.createElement('div');
      nm.className = 'skinName';
      nm.textContent = s.n;
      c.appendChild(nm);
      const th = document.createElement('div');
      th.className = 'skinTheme';
      th.textContent = s.tag;
      c.appendChild(th);
      c.onclick = () => select(i);
      grid.appendChild(c);
    });
    // back to the orb
    const shell = document.createElement('div');
    shell.className = 'skinCard' + (sel < 0 ? ' selected' : '');
    shell.innerHTML = '<div class="skinIcon skinStage" style="display:grid;place-items:center;font-size:34px">🔵</div>' +
      '<div class="skinName">Shell</div><div class="skinTheme">Original</div>';
    shell.onclick = () => select(-1);
    grid.insertBefore(shell, grid.firstChild);

    // animation rail + live stage
    const row = document.getElementById('humanAnimRow');
    if (row && G.HumanPreview) {
      G.HumanPreview.ANIMS.forEach((a, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'fitBtn' + (i === 0 ? ' is-active' : '');
        b.innerHTML = '<span class="fitName">' + a + '</span>';
        b.onclick = () => {
          row.querySelectorAll('.fitBtn').forEach((x) => x.classList.remove('is-active'));
          b.classList.add('is-active');
          showStage(i);
        };
        row.appendChild(b);
      });
    }
    showStage(0);
  }

  function showStage(anim) {
    const cv = document.getElementById('humanPreview');
    const sel = read().skin;
    if (!cv || !G.HumanPreview) return;
    if (sel < 0) { G.HumanPreview.hide(); cv.style.opacity = '.25'; return; }
    cv.style.opacity = '1';
    G.HumanPreview.show(cv, sel, anim);
  }

  function refresh() {
    const pane = document.getElementById('humanTab');
    if (pane && pane.style.display !== 'none') renderTab();
  }

  G.HumanPack = {
    SKINS, COST, SECRET,
    owned, equipped, keyUnlocked, skin, skinData, select, redeem, buy,
    shopCard, openTab, refresh, render: renderTab
  };

  // The shop asks for the pack card when it builds its grid.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { injectTab(); });
  else injectTab();
})(window);
