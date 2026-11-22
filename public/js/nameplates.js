// ============================================================
// Monster Arena — NAMEPLATES.
// A thin DOM layer above the game canvas that floats a name over every
// avatar: your own (from arenaNick, set in the global chat's Username
// tab), the other players in a lobby, and the bots.
//
// Bots have no name on the server, so each one gets a believable name
// derived from its id — stable for the whole match, and unique among the
// bots on the field.
//
// Positions come from Render3D.w2s (world → CSS pixels), and the layer
// stays hidden whenever the 3D scene is not actually drawing.
// ============================================================
(function () {
  'use strict';

  // ---- bot names --------------------------------------------------------
  const FIRST = ['Kael', 'Mira', 'Rook', 'Sable', 'Torvin', 'Bex', 'Corvin', 'Wren', 'Dax',
    'Marek', 'Pell', 'Rhea', 'Soren', 'Tamsin', 'Vesper', 'Yara', 'Bram', 'Nyx', 'Hollis',
    'Cassia', 'Orin', 'Zia', 'Fen', 'Ilsa', 'Kade', 'Marlow'];
  const TAG = ['', '', '', '', '', '77', '91', 'XO', 'IV', '98', 'ZR', 'XII'];

  function hashOf(s) {
    let h = 2166136261;
    s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  const botNames = new Map();
  const taken = new Set();

  function botKey(b) {
    if (!b) return 'x';
    if (b.id != null) return String(b.id);
    return 'x' + Math.round((b.x || 0) / 8) + 'y' + Math.round((b.y || 0) / 8);
  }

  function botName(b) {
    // A name that travelled from the match room is the bot's real identity:
    // the same seat is a different person every match, so the id is not a name.
    const given = b && typeof b.name === 'string' ? b.name.trim() : '';
    if (given && !/^bot_\d+$/i.test(given)) return given.slice(0, 18);
    const id = botKey(b);
    const have = botNames.get(id);
    if (have) return have;
    const h = hashOf('bot:' + id);
    let name = '';
    for (let i = 0; i < 80 && !name; i++) {
      const cand = FIRST[(h + i * 7) % FIRST.length] + TAG[((h >>> 5) + i) % TAG.length];
      if (!taken.has(cand)) name = cand;
    }
    if (!name) name = 'Wanderer' + (taken.size + 1);
    taken.add(name);
    botNames.set(id, name);
    return name;
  }

  // ---- layer -----------------------------------------------------------
  const layer = document.createElement('div');
  layer.id = 'npLayer';
  document.body.appendChild(layer);
  injectCSS();

  const plates = new Map();
  let nick = '';
  let nickAt = 0;

  function myName() {
    const now = performance.now();
    if (now - nickAt > 700) {
      nickAt = now;
      try { nick = (localStorage.getItem('arenaNick') || 'Player').slice(0, 18); } catch (_) { nick = 'Player'; }
    }
    return nick;
  }

  function hideAll() {
    plates.forEach(function (el) { el.style.opacity = 0; });
  }

  function show(key, cls, text, x, z, h, proj) {
    let el = plates.get(key);
    if (!el) {
      el = document.createElement('div');
      el.className = 'np ' + cls;
      layer.appendChild(el);
      plates.set(key, el);
    }
    if (el._text !== text) { el.textContent = text; el._text = text; }

    const p = proj ? proj(x, z, h) : null;
    if (!p || !isFinite(p.x) || !isFinite(p.y)) { el.style.opacity = 0; return; }
    const cw = window.innerWidth, ch = window.innerHeight;
    if (p.x < -160 || p.y < -80 || p.x > cw + 160 || p.y > ch + 80) { el.style.opacity = 0; return; }

    // Depth fade: crisp near the camera, dissolving into the distance.
    const fade = p.w > 1500 ? 0 : p.w > 950 ? (1500 - p.w) / 550 : 1;
    if (fade <= 0.03) { el.style.opacity = 0; return; }
    el.style.opacity = fade;
    el.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + (p.y - 14).toFixed(1) + 'px,0) translate(-50%,-100%)';
  }

  // A match draws either through the 3D scene (Render3D projects world → CSS
  // pixels) or through the 2D fallback, whose top-down camera rides the player.
  // Both are supported here, so the names never depend on WebGL being alive.
  function isThree() {
    const R = window.Render3D;
    if (!R || !R.ok || !R.F) return null;
    const c3 = document.getElementById('game3d');
    if (c3 && c3.style.display === 'none') return null;
    return R;
  }

  function others(three, snap) {
    const list = [];
    if (three) {
      // Their height comes from the lobby snapshot, so a name rides with a
      // fighter who is flying instead of staying down on the floor.
      const zById = new Map();
      if (snap && Array.isArray(snap.players)) for (const sp of snap.players) if (sp) zById.set(sp.id, typeof sp.z === 'number' ? sp.z : 0);
      for (const r of (three.F.remotes || [])) if (r) list.push({ x: r.x, y: r.y, name: r.name, z: zById.get(r.id) || 0 });
      for (const b of (three.F.bots || [])) if (b && !b.dead && !(b.hp <= 0)) list.push({ x: b.x, y: b.y, bot: b });
      return list;
    }
    if (snap && Array.isArray(snap.players)) {
      const myId = window.Net && window.Net.state ? window.Net.state.peerId : null;
      for (const rp of snap.players) if (rp && rp.id !== myId) list.push({ x: rp.x, y: rp.y, name: rp.name });
    }
    const bots = window.BOTS_ENABLED
      ? (typeof SP_BOTS !== 'undefined' ? SP_BOTS : [])
      : ((snap && Array.isArray(snap.bots)) ? snap.bots : []);
    for (const b of bots) if (b && !(b.hp <= 0)) list.push({ x: b.x, y: b.y, bot: b });
    return list;
  }

  function tick() {
    requestAnimationFrame(tick);

    if (!window.__pveMatchRunning || !window.__pveMatchRunning()) { hideAll(); return; }

    const me = window.__pvePlayer ? window.__pvePlayer() : null;
    if (!me) { hideAll(); return; }

    const three = isThree();
    const snap = (window.Net && window.Net.state && window.Net.state.snapshot) || null;
    const px = me.x, pz = me.y;
    const proj = three
      ? function (x, z, h) { return three.w2s(x, z, (h || 0) + three.groundY(x, z)); }
      : function (x, z, h) {
          return { x: x - px + window.innerWidth / 2, y: z - pz + window.innerHeight / 2 - (h || 0), w: 800 };
        };

    const used = new Set();

    // Your own name — skipped in first person, where your head is the camera.
    const fp = !!(three && three.cam && three.cam.mode === 'tps' && three.cam.fp);
    if (me.hp > 0 && !fp) {
      used.add('me');
      show('me', 'np--you', myName(), me.x, me.y, 54, proj);
    }

    const list = others(three, snap);
    for (let i = 0; i < list.length && i < 10; i++) {
      const o = list[i];
      if (!o) continue;
      const bot = !!o.bot;
      const key = bot ? 'b' + botKey(o.bot) : 'p' + i + ':' + (o.name || '');
      used.add(key);
      show(key, bot ? 'np--bot' : '', bot ? botName(o.bot) : (o.name || 'Player'), o.x, o.y, (bot ? 58 : 54) + (o.z || 0), proj);
    }

    plates.forEach(function (el, key) { if (!used.has(key)) el.style.opacity = 0; });
  }

  // ---- styles ----------------------------------------------------------
  function injectCSS() {
    const st = document.createElement('style');
    st.id = 'nameplateCSS';
    st.textContent = `
    #npLayer{position:fixed;inset:0;pointer-events:none;z-index:4;overflow:hidden;}
    .np{position:absolute;left:0;top:0;opacity:0;padding:3px 10px 4px;border-radius:999px;white-space:nowrap;
      font:800 11px/1.25 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.05em;
      color:#eef6ff;background:linear-gradient(180deg,rgba(20,16,38,.78),rgba(6,8,18,.72));
      border:1px solid rgba(160,120,255,.5);
      text-shadow:0 1px 4px rgba(0,0,0,.95);
      box-shadow:0 4px 16px rgba(0,0,0,.5),0 0 14px rgba(140,90,240,.22),inset 0 1px 0 rgba(255,255,255,.07);
      backdrop-filter:blur(3px);
      transition:opacity .18s linear;will-change:transform;}
    .np::after{content:"";position:absolute;left:50%;top:100%;width:1px;height:7px;
      background:linear-gradient(180deg,rgba(160,120,255,.75),rgba(160,120,255,0));}
    .np--you{color:#eafcff;border-color:rgba(110,220,255,.85);
      background:linear-gradient(180deg,rgba(16,34,58,.86),rgba(6,14,26,.8));
      box-shadow:0 4px 18px rgba(0,0,0,.55),0 0 20px rgba(90,210,255,.42),inset 0 1px 0 rgba(255,255,255,.1);}
    .np--you::after{background:linear-gradient(180deg,rgba(110,220,255,.85),rgba(110,220,255,0));}
    .np--bot{color:#ffe9c9;border-color:rgba(255,190,110,.55);
      background:linear-gradient(180deg,rgba(38,26,14,.8),rgba(14,10,8,.75));
      box-shadow:0 4px 16px rgba(0,0,0,.5),0 0 14px rgba(255,170,80,.24),inset 0 1px 0 rgba(255,255,255,.06);}
    .np--bot::after{background:linear-gradient(180deg,rgba(255,190,110,.7),rgba(255,190,110,0));}`;
    document.head.appendChild(st);
  }

  requestAnimationFrame(tick);
  window.Nameplates = { botName: botName, myName: myName };
})();
