/* =====================================================================
   hub3d.js — the walking menu, in first person.

   The old intro card is gone: the menu is a building you stand inside.
   A domed rotunda opens onto four halls — the armoury, the hall of
   renown, the gateways and the training ring — and behind them the
   corridors go on: a vault the staff keep locked, a sanctum, and a crypt
   of sealed cells that open as your rank climbs.

   You walk with WASD, look by dragging, jump with space, and enter
   whatever you are standing in front of with E. Everyone else who is in
   the menu is in the same building, wearing the orb they actually play
   (hub_presence.js, hub_avatars.js).
   ===================================================================== */
(function (G) {
  'use strict';

  const T = G.THREE;
  const Rooms = G.HubRooms, World = G.HubWorld;
  if (!T || !Rooms || !World) return;

  const L = Rooms.LAYOUT;
  const EYE = L.EYE;
  const SPEED = 340;
  const BODY = L.BODY;
  const REACH = 300;
  const LOOK_K = 0.0026;
  const PITCH_MAX = 1.12;
  const GRAV = 1500;
  const JUMP_V = 600;
  const TAU = Math.PI * 2;
  const STEP = 72;        // how high a lip you can walk straight up
  const DASH_V = 1180;    // the hall dash
  const DASH_T = 0.17;
  const DASH_CD = 1.05;

  /* ---------- state ------------------------------------------------------ */
  let scene, camera, renderer, canvas, wrap;
  let promptEl, promptNameEl, promptSubEl, hintEl, crossEl, stickEl, stickNub;
  let quizEl, quizNameEl, quizQEl, quizAnsEl, quizHintEl;
  let built = false, active = false, raf = 0, lastT = 0, gateT = 0;
  let tickerClock = 0, frames = 0, fpsClock = 0, hintCount = -1;
  const items = [];
  const solids = [];
  const walls = [];
  const tickers = [];
  const sealed = [];
  const opened = {};
  const keys = {};
  const player = {
    x: 0, z: 330, y: 0, vy: 0, yaw: 0, pitch: 0, bob: 0,
    base: 0,            // the floor under the feet
    dashT: 0, dashCd: 0, dx: 0, dz: -1
  };
  const stick = { on: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0, moved: 0 };
  const look = { on: false, id: null, x: 0, y: 0, moved: 0 };
  let near = null, promptT = 0, quizOpen = false;
  const others = new Map();
  const gems = [];


  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* =====================================================================
     the building
     ===================================================================== */
  function buildWorld() {
    World.init({ scene, solids, walls, items, tickers });

    // the four ways out of the rotunda
    const mid = L.HALL_R - 45 + 265;
    const len = L.NEAR - L.HALL_R + 90;
    const w = L.CORR * 2;
    World.buildPassage({ x: 0, z: -mid, w: w, d: len });
    World.buildPassage({ x: 0, z: mid, w: w, d: len });
    World.buildPassage({ x: -mid, z: 0, w: len, d: w });
    World.buildPassage({ x: mid, z: 0, w: len, d: w });
    World.buildRotunda(L.HALL_R, L.CORR);

    for (const k in Rooms.ROOMS) World.buildHall(Rooms.ROOMS[k]);
    for (const g of Rooms.GEAR) World.buildHall(g);
    for (const l of Rooms.LINKS) World.buildPassage(l);

    // the upper deck, and the doorways that hang their rooms off it
    World.buildGallery(Rooms.GALLERY);
    for (const p of Rooms.GALLERY.portals) {
      World.portal(p.x, p.z, Rooms.GALLERY.y, p.accent);
      items.push({
        name: p.title, sub: p.sub, x: p.x, z: p.z, y: Rooms.GALLERY.y,
        act: () => (p.kind === 'page' ? goPage(p.to) : press(p.to))
      });
      const lb = World.label(p.title, { size: 38, scale: 0.22, color: '#f2f8ff' });
      lb.position.set(p.x, Rooms.GALLERY.y + 300, p.z);
      scene.add(lb);
    }

    // the sanctum, the gem-sealed secrets and the cells of the crypt
    for (const c of Rooms.CHAMBERS) {
      World.buildHall({ ...c, doorW: 220 });
      sealRoom(c);
    }
    for (const c of Rooms.CELLS) {
      World.buildCell(c);
      sealRoom(c);
    }

    // The old world the arena was built on: fire at the four corners of the
    // floor, warriors of the first games beside the doors, and the name
    // itself hanging overhead.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      World.brazier(Math.cos(a) * 300, Math.sin(a) * 300);
    }
    for (const s of [-1, 1]) {
      World.statue(s * 330, -240, 0, 0x66e0ff);
      World.statue(s * 330, 240, Math.PI, 0x6cffb0);
    }
    // Slightly under full width, so the ends of the banner never reach the wall.
    const name = World.buildLogo(0, 380, -330);
    name.scale.setScalar(0.82);

    dressArmory(Rooms.ROOMS.armory);
    dressRenown(Rooms.ROOMS.renown);
    dressGateways(Rooms.ROOMS.gateways);
    dressTraining(Rooms.ROOMS.training);
    dressGuns(Rooms.GEAR[0]);
    dressOrbs(Rooms.GEAR[1]);
    dressBlades(Rooms.GEAR[2]);
    dressFlesh(Rooms.GEAR[3]);
    for (const c of Rooms.CHAMBERS) if (c.gems) dressSecret(c);

    // the gems the old builders left lying about the hall
    for (const g of Rooms.GEMS) {
      if (Rooms.hasGem(g.id)) continue;
      gems.push({ id: g.id, x: g.x, z: g.z, mesh: World.gem(g.x, g.z, 0x7dffd0) });
    }

    // One lamp over the rotunda. Every other room is lit by its own emissive
    // stone, chandelier and glow sprites: sixteen point lights used to cost
    // more frames than the whole hall was worth.
    const hallLight = new T.PointLight(0x22e6ff, 1.8, 2600, 2);
    hallLight.position.set(0, 340, 0);
    scene.add(hallLight);
    const deckLight = new T.PointLight(0x8fd8ff, 1.1, 1400, 2);
    deckLight.position.set(0, Rooms.GALLERY.y + 200, -340);
    scene.add(deckLight);

    // dust in the light
    const n = 520, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 4600;
      pos[i * 3 + 1] = Math.random() * 440;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4600;
    }
    const dustGeo = new T.BufferGeometry();
    dustGeo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const dust = new T.Points(dustGeo, World.MAT.dust);
    scene.add(dust);
    tickers.push((t) => {
      dust.rotation.y = t * 0.012;
      dust.position.y = Math.sin(t * 0.25) * 14;
    });

    refreshGates(true);
  }

  /* ---------- the sealed rooms ------------------------------------------ */
  function sealRoom(c) {
    const seal = World.buildSeal(c);
    const open = Rooms.open(c) || !!opened[c.id];
    opened[c.id] = open;
    seal.setLocked(!open);

    if (c.kind === 'humans') {
      sealed.push({ c, seal, item: null });
      return;
    }

    const w = c.warden;
    if (!w) { sealed.push({ c, seal, item: null }); return; }
    World.warden(c);
    const item = {
      name: c.title,
      sub: open ? 'Answer the warden' : 'Sealed until ' + Rooms.sealText(c).toLowerCase(),
      x: c.x, z: c.z + (c.door === 'n' ? -80 : 80),
      act: () => askWarden(c),
      locked: !open,
      keepOpen: true            // the question is asked inside the hall
    };
    items.push(item);
    sealed.push({ c, seal, item });
  }

  function refreshGates(force) {
    for (const s of sealed) {
      if (opened[s.c.id]) continue;
      if (!Rooms.open(s.c)) continue;
      opened[s.c.id] = true;
      s.seal.setLocked(false);
      if (s.item) {
        s.item.locked = false;
        s.item.sub = 'Answer the warden';
      }
      if (!force && G.HubCutscene) {
        G.HubCutscene.play({
          kicker: 'A seal gives way',
          title: s.c.title,
          sub: 'The way is open',
          accent: World.hexOf(s.c.accent)
        });
      } else if (!force) {
        flash('The seal breaks — ' + s.c.title);
      }
    }
  }

  // A line of light across the middle of the hall, for a door giving way.
  function flash(text) {
    const el = document.getElementById('hubFlash');
    if (!el) return;
    el.textContent = text;
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 2600);
  }

  /* =====================================================================
     what stands in each hall
     ===================================================================== */
  // Open the Customize panel already on the tab a room is about.
  function openTab(id) {
    press('introCustomize');
    setTimeout(() => press(id), 80);
  }

  // The wing itself holds no gear: it is a crossing with a door on each wall,
  // each one leading to the room that keeps that part of the kit.
  function dressArmory(r) {
    const signs = [
      { side: -1, at: -340, t: 'GUNS', s: 'Firearms', c: 0x9fd8ff },
      { side: -1, at: 340, t: 'UTILITIES', s: 'Orbs and wards', c: 0x9f7bff },
      { side: 1, at: -340, t: 'MELEE', s: 'Blades and steel', c: 0xff9a8c },
      { side: 1, at: 340, t: 'HUMAN', s: 'Your fighter', c: 0xffd166 }
    ];
    signs.forEach((sg) => {
      const x = r.x + sg.side * (r.w / 2 - 40);
      const z = r.z + sg.at;
      const lb = World.label(sg.t, { size: 44, scale: 0.28, color: '#eaf6ff' });
      lb.position.set(x, r.h - 66, z);
      scene.add(lb);
      const sb = World.label(sg.s, { size: 24, scale: 0.17, color: '#a8c4e0' });
      sb.position.set(x, r.h - 104, z);
      scene.add(sb);
    });

    const t = World.label('THE QUARTERMASTER’S WING', { size: 52, scale: 0.34, color: '#dff2ff' });
    t.position.set(r.x, 330, r.z + 460);
    scene.add(t);
  }

  /* ---------- one room for each part of the kit -------------------------- */
  function roomTitle(r, text) {
    const t = World.label(text, { size: 44, scale: 0.3, color: '#eaf6ff' });
    t.position.set(r.x, r.h - 70, r.z + (r.d / 2 - 60) * (r.door === 'e' ? -1 : 1));
    scene.add(t);
  }

  function dressGuns(r) {
    roomTitle(r, 'THE GUNSMITH');
    ['PISTOL', 'RIFLE', 'SHOTGUN'].forEach((n, i) => {
      World.modelPlinth(r.x - 240, r.z - 180 + i * 180, 'guns', i, r.accent, n);
    });
    World.pad(r.x + 110, r.z, 'Guns', 'Pistols, rifles, shotguns — swap with Q / E',
      () => openTab('tabGunsBtn'), r.accent, 64);
  }

  function dressOrbs(r) {
    roomTitle(r, 'THE ORB CHAMBER');
    ['EMBER', 'RIME', 'VOID'].forEach((n, i) => {
      World.modelPlinth(r.x - 240, r.z - 180 + i * 180, 'orbs', i, r.accent, n + ' ORB');
    });
    World.pad(r.x + 110, r.z, 'Utilities', 'Orbs, wards and tricks — throw with G',
      () => openTab('tabUtilBtn'), r.accent, 64);
  }

  function dressBlades(r) {
    roomTitle(r, 'THE HALL OF BLADES');
    ['LONGSWORD', 'AXE', 'WARHAMMER', 'DAGGER'].forEach((n, i) => {
      World.modelPlinth(r.x + 240, r.z - 240 + i * 160, 'blades', i, r.accent, n);
    });
    World.pad(r.x - 110, r.z, 'Melee', 'Blades and blunt steel — swing with F',
      () => openTab('tabMeleeBtn'), r.accent, 64);
  }

  function dressFlesh(r) {
    roomTitle(r, 'THE HALL OF FLESH');
    const names = ['Warden', 'Scribe', 'Bailiff', 'Oracle'];
    names.forEach((n, i) => {
      const a = (i / names.length) * TAU + Math.PI / 4;
      World.human(r.x + Math.cos(a) * 210, r.z + Math.sin(a) * 210, n, r.accent);
    });

    const S = (G.ArenaCustomize && G.ArenaCustomize()) || null;
    const models = (S && S.designs) || [];
    const best = (S && S.best) || 0;
    let n = 0;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const d = models[n];
        if (!d) { n++; continue; }
        const x = r.x + (col - 1) * 150;
        const z = r.z + (row - 0.5) * 150 + (r.door === 'e' ? 60 : -60);
        const unlocked = best >= (d.unlock || 0);
        World.pedestal(x, z, d.id != null ? d.id : n, d.name || 'Model', unlocked, n,
          unlocked ? () => { try { S.setDesign(d.id); } catch (e) {} openTab('tabPlayerBtn'); } : null);
        n++;
      }
    }

    World.pad(r.x, r.z - (r.door === 'e' ? -170 : 170), 'Your fighter', 'Pick a model and a colour',
      () => openTab('tabPlayerBtn'), r.accent, 52);
  }

  // What the old builders left behind in the two sealed rooms.
  function dressSecret(c) {
    const key = 'arena_secret_' + c.id;
    const reward = c.id === 'vault'
      ? { xp: 500, stones: 150 }
      : { xp: 800, stones: 300 };
    World.pad(c.x, c.z, c.title, 'Take what the builders left', () => {
      let done = false;
      try { done = localStorage.getItem(key) === '1'; } catch (e) {}
      if (done) { flash('You have already taken what was here.'); return; }
      try { localStorage.setItem(key, '1'); } catch (e) {}
      if (reward.xp && G.RankXP) G.RankXP.add(reward.xp, 'Secret room');
      if (reward.stones && G.RS) G.RS.add(reward.stones, 'Secret room');
      flash('The ' + c.title.replace('THE ', '').toLowerCase() + ' gives up ' + Rooms.rewardText(reward));
    }, c.accent, 76);
  }

  function dressRenown(r) {
    const solved = Rooms.solved();
    const done = Object.keys(solved).length;
    const lvl = Rooms.level();

    // The rank itself, hanging in the air over the hall — the thing you came
    // to look at, not a button to another menu.
    World.rankEmblem(r.x, r.z - 230, lvl, 0xffd166);
    World.pad(r.x, r.z + 150, 'Your record', 'Every wave, every kill', () => press('introPlayer'), 0xffd166, 60);

    const tiles = [
      ['Duels', 'One against one', () => multi('modeDuel'), 0xc066ff],
      ['Ladder', 'Every duelist', () => { multi('modeDuel'); const b = document.getElementById('duelBoard'); if (b) b.click(); }, 0x66ccff],
      ['Secrets', done + ' of ' + Rooms.CELLS.length + ' answered', () => {
        flash(done >= Rooms.CELLS.length
          ? 'Every secret in the crypt is answered.'
          : 'The crypt lies beyond this hall — cells open as your rank climbs.');
      }, 0x7dffa3, true]
    ];
    tiles.forEach((t, i) => {
      const a = (i / tiles.length) * TAU + Math.PI / 2;
      const it = World.pad(r.x + Math.cos(a) * 340, r.z + Math.sin(a) * 340, t[0], t[1], t[2], t[3], 56);
      if (t[4] && it) it.keepOpen = true;
    });

    const t = World.label('HALL OF RENOWN', { size: 46, scale: 0.32, color: '#fff2d0' });
    t.position.set(r.x, 360, r.z - 520);
    scene.add(t);

    // The standings, hung in light: the deepest waves anyone has cleared and
    // the most monsters anyone has put down. Staff runs never reach the glass.
    const board = World.leaderboard(r.x + 330, r.z - 360, -0.55);
    const paintBoard = () => {
      const rows = (window.__arenaRecords || []).slice();
      if (!rows.length) {
        // Until the hall hears from the database, the fighter's own run is the
        // only standing there is to show.
        let best = 0, kills = 0;
        try { best = parseInt(localStorage.getItem('arenaBest') || '0', 10) || 0; } catch (_) {}
        try { kills = G.RankXP && G.RankXP.kills ? G.RankXP.kills() : 0; } catch (_) {}
        const name = window.__accountName || localStorage.getItem('arenaNick') || 'You';
        rows.push({ name: name, rank: lvl, wave: best, kills: kills, staff: false });
      }
      board.setRecords(rows);
    };
    paintBoard();
    window.addEventListener('arena:records', paintBoard);
  }

  function dressGateways(r) {
    const list = [
      ['Crysto', 'The Monster Universe', 'crysto', () => { if (window.Crysto && window.Crysto.start) window.Crysto.start(); }, 0xffd166],
      ['Singleplayer', 'Five cursed realms', 'single', () => press('btnIntroSingle'), 0x66ccff],
      ['Story', 'The Sentinel saga', 'story', () => press('introStory'), 0xffcf6a],
      ['Levels', 'Community maps', 'levels', () => press('introLevels'), 0x7dffa3],
      ['Parkour', 'Run the course', 'parkour', () => press('introParkour'), 0x4fe0ff],
      ['Offline', 'Bots, every mode', 'offline', () => press('btnIntroOffline'), 0xb46bff],
      ['Containment', 'Escape the lab', 'containment', () => press('introContainment'), 0xff7a5c]
    ];
    const R = 520;
    list.forEach((p, i) => {
      const a = Math.PI + (i / (list.length - 1) - 0.5) * (Math.PI * 1.14);
      const x = r.x + Math.cos(a) * R;
      const z = r.z + Math.sin(a) * R;
      const portal = G.HubPortal ? G.HubPortal.build(p[2], p[4]) : null;
      if (portal) {
        portal.group.position.set(x, 0, z);
        portal.group.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
        scene.add(portal.group);
        tickers.push((t, dt) => portal.update(t, dt));
        solids.push({ x, z, r: 92 });
      }
      const lb = World.label(p[0], { size: 42, scale: 0.27, color: '#f2f8ff' });
      lb.position.set(x, 330, z);
      scene.add(lb);
      const sb = World.label(p[1], { size: 24, scale: 0.2, color: '#a8c4e0', glow: 'rgba(120,180,255,0.6)' });
      sb.position.set(x, 296, z);
      scene.add(sb);
      items.push({ name: p[0], sub: p[1], x, z, act: p[3] });
    });

    const t = World.label('GATEWAYS', { size: 58, scale: 0.36, color: '#efe4ff' });
    t.position.set(r.x - 560, 360, r.z);
    scene.add(t);
  }

  function dressTraining(r) {
    const ring = new T.Mesh(
      new T.PlaneGeometry(700, 700),
      new T.MeshBasicMaterial({
        map: World.MAT.rune, transparent: true, opacity: 0.34,
        blending: T.AdditiveBlending, depthWrite: false
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(r.x, 1.6, r.z);
    scene.add(ring);
    tickers.push((t) => { ring.rotation.z = t * 0.05; });

    // Boards that hold still, and silhouettes pacing the far line.
    for (const t of Rooms.TARGETS.still) {
      World.targetBoard(t.x, t.z, Math.atan2(r.x - t.x, r.z - t.z), 0xff7a5c);
    }
    for (const m of Rooms.TARGETS.moving) {
      World.silhouette(m.x, m.z, { range: m.range, speed: m.speed, phase: m.phase, accent: 0xc066ff });
    }

    World.pad(r.x, r.z, 'Training ground', 'Every weapon unlocked', () => {
      if (G.TutorialTraining && G.TutorialTraining.start) G.TutorialTraining.start({ silent: true });
    }, 0x6cffb0, 84);
    World.pad(r.x - 250, r.z + 400, 'Tutorial', 'Learn the controls', () => press('introTutorial'), 0xffcf6a, 56);
    World.pad(r.x + 250, r.z + 400, 'Shop', 'RuneStones and gear', () => press('introShop'), 0xffd166, 56);

    const t = World.label('TRAINING RING', { size: 58, scale: 0.36, color: '#d8ffe9' });
    t.position.set(r.x, 340, r.z + 500);
    scene.add(t);
  }

  /* =====================================================================
     the wardens
     ===================================================================== */
  let quizPool = [], quizIdx = 0, quizLock = 0, quizTimer = 0;

  function askWarden(c) {
    if (!c.warden) return;
    if (Rooms.solved()[c.id]) {
      flash('The warden has nothing more to ask.');
      return;
    }
    const pool = Rooms.questions(c);
    if (!pool.length) return;
    quizPool = pool;
    quizIdx = 0;
    askQuestion(c, pool[0]);
  }

  function askQuestion(c, q) {
    quizOpen = true;
    quizLock = 0;
    clearInterval(quizTimer);
    quizNameEl.textContent = c.warden.name;
    quizQEl.textContent = q.q;
    quizHintEl.textContent = '';
    quizHintEl.classList.remove('good');
    quizHintEl.classList.remove('wait');
    quizAnsEl.innerHTML = '';
    q.a.forEach((text, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hq-answer';
      b.textContent = text;
      b.addEventListener('click', () => answer(c, i, b, q));
      quizAnsEl.appendChild(b);
    });
    quizEl.classList.add('on');
  }

  // Right: the seal is answered. Wrong: the warden turns away for a moment,
  // and when it turns back it is asking something else entirely.
  function answer(c, i, btn, q) {
    if (quizLock) return;
    const w = c.warden;
    if (i === q.r) {
      Rooms.markSolved(c.id);
      Rooms.grant(w.reward);
      quizAnsEl.innerHTML = '';
      quizHintEl.textContent = 'The warden bows. ' + Rooms.rewardText(w.reward);
      quizHintEl.classList.add('good');
      if (G.HubCutscene) {
        G.HubCutscene.play({
          kicker: 'The seal is answered',
          title: c.title,
          sub: Rooms.rewardText(w.reward),
          accent: World.hexOf(c.accent)
        });
      }
      setTimeout(() => { if (quizOpen) closeQuiz(); }, 1900);
      return;
    }

    btn.classList.add('wrong');
    quizIdx = (quizIdx + 1) % quizPool.length;
    quizLock = 5;
    const buttons = quizAnsEl.querySelectorAll('.hq-answer');
    for (const b of buttons) b.disabled = true;
    quizHintEl.classList.remove('good');
    quizHintEl.classList.add('wait');
    quizHintEl.textContent = 'Wrong. The warden turns away — ' + quizLock + 's';
    clearInterval(quizTimer);
    quizTimer = setInterval(() => {
      if (!quizOpen) { clearInterval(quizTimer); return; }
      quizLock -= 1;
      if (quizLock > 0) {
        quizHintEl.textContent = 'Wrong. The warden turns away — ' + quizLock + 's';
        return;
      }
      clearInterval(quizTimer);
      quizHintEl.classList.remove('wait');
      askQuestion(c, quizPool[quizIdx]);
    }, 1000);
  }

  function closeQuiz() {
    quizOpen = false;
    quizLock = 0;
    clearInterval(quizTimer);
    quizEl.classList.remove('on');
  }

  /* =====================================================================
     other players in the hall
     ===================================================================== */
  function addOther(u) {
    const av = G.HubAvatar ? G.HubAvatar.build(u.design, u.color, { r: 30 }) : null;
    const grp = av ? av.group : new T.Group();
    grp.position.set(u.tx, 0, u.tz);
    scene.add(grp);
    const plate = World.label(u.name || 'Player', { size: 30, scale: 0.19, color: '#eaf6ff' });
    plate.position.y = 116;
    grp.add(plate);
    const ring = new T.Mesh(new T.TorusGeometry(30, 3, 6, 22), new T.MeshBasicMaterial({ color: 0x66ccff }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 2;
    grp.add(ring);
    return { grp, av, plate, px: u.tx, pz: u.tz, pyaw: u.tyaw, design: u.design, color: u.color, name: u.name };
  }

  function syncOthers(dt, t) {
    const list = (G.HubPresence && G.HubPresence.others()) ? G.HubPresence.others() : null;
    if (!list) return;
    const seen = new Set();
    list.forEach((u, seat) => {
      seen.add(seat);
      let o = others.get(seat);
      if (!o) { o = addOther(u); others.set(seat, o); }
      if (o.design !== u.design || o.color !== u.color) {
        scene.remove(o.grp);
        o = addOther(u);
        others.set(seat, o);
      }
      if (o.name !== u.name) {
        o.name = u.name;
        o.grp.remove(o.plate);
        o.plate = World.label(u.name || 'Player', { size: 30, scale: 0.19, color: '#eaf6ff' });
        o.plate.position.y = 116;
        o.grp.add(o.plate);
      }
      const k = Math.min(1, dt * 7);
      o.px += (u.tx - o.px) * k;
      o.pz += (u.tz - o.pz) * k;
      o.pyaw += (u.tyaw - o.pyaw) * k;
      o.grp.position.set(o.px, 0, o.pz);
      o.grp.rotation.y = o.pyaw + Math.PI;
      if (o.av) o.av.update(t + seat);
    });
    for (const [seat, o] of [...others]) {
      if (seen.has(seat)) continue;
      scene.remove(o.grp);
      others.delete(seat);
    }
  }

  /* =====================================================================
     input
     ===================================================================== */
  function typing() {
    const a = document.activeElement;
    if (!a) return false;
    const tag = (a.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable;
  }

  function jump() {
    if (!active || quizOpen) return;
    if (player.y <= 0.5) player.vy = JUMP_V;
  }

  // A burst across the hall. Everyone gets one, on a short cooldown.
  function dash() {
    if (!active || quizOpen) return;
    if (player.dashT > 0 || player.dashCd > 0) return;
    let f = 0, s = 0;
    if (keys.w || keys.arrowup) f += 1;
    if (keys.s || keys.arrowdown) f -= 1;
    if (keys.d || keys.arrowright) s += 1;
    if (keys.a || keys.arrowleft) s -= 1;
    f += -stick.dy;
    s += stick.dx;
    const len = Math.hypot(f, s);
    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    if (len > 0.1) {
      player.dx = (-sy * f + cy * s) / len;
      player.dz = (-cy * f - sy * s) / len;
    } else {
      player.dx = -sy;
      player.dz = -cy;
    }
    player.dashT = DASH_T;
    player.dashCd = DASH_CD;
    if (wrap) {
      wrap.classList.add('dashing');
      setTimeout(() => { if (wrap) wrap.classList.remove('dashing'); }, 260);
    }
  }

  // Walking through a doorway leaves the hall for the page behind it; the
  // hosting page catches the link and routes it, so the frame never reloads.
  function goPage(path) {
    const a = document.createElement('a');
    a.href = path;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 0);
  }

  function onKey(e) {
    if (!active) return;
    if (quizOpen) {
      if (e.key === 'Escape') closeQuiz();
      return;
    }
    const k = (e.key || '').toLowerCase();
    keys[k] = true;
    if (k === ' ' || k === 'spacebar') { e.preventDefault(); jump(); }
    if (k === 'shift') { e.preventDefault(); dash(); }
    if (k === 'e' || k === 'enter') {
      if (!typing()) { e.preventDefault(); interact(); }
    }
  }

  function onKeyUp(e) {
    keys[(e.key || '').toLowerCase()] = false;
  }

  function onDown(e) {
    if (!active || quizOpen) return;
    const rect = canvas.getBoundingClientRect();
    const lx = e.clientX - rect.left, ly = e.clientY - rect.top;
    if (lx < rect.width * 0.34 && ly > rect.height * 0.4 && e.pointerType !== 'mouse') {
      stick.on = true; stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY;
      stick.dx = 0; stick.dy = 0; stick.moved = 0;
      if (stickEl) {
        stickEl.style.left = lx + 'px';
        stickEl.style.top = ly + 'px';
        stickEl.classList.add('on');
      }
    } else {
      look.on = true; look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; look.moved = 0;
    }
  }

  function onMove(e) {
    if (!active) return;
    if (stick.on && e.pointerId === stick.id) {
      const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
      stick.moved = Math.max(stick.moved, Math.hypot(dx, dy));
      const k = 1 / 52;
      stick.dx = clamp(dx * k, -1, 1);
      stick.dy = clamp(dy * k, -1, 1);
      if (Math.hypot(stick.dx, stick.dy) < 0.16) { stick.dx = 0; stick.dy = 0; }
      if (stickNub) stickNub.style.transform = 'translate(' + (stick.dx * 26) + 'px,' + (stick.dy * 26) + 'px)';
    } else if (look.on && e.pointerId === look.id) {
      const dx = e.clientX - look.x, dy = e.clientY - look.y;
      look.x = e.clientX; look.y = e.clientY;
      look.moved += Math.abs(dx) + Math.abs(dy);
      player.yaw -= dx * LOOK_K;
      player.pitch = clamp(player.pitch - dy * LOOK_K, -PITCH_MAX, PITCH_MAX);
    }
  }

  function onUp(e) {
    if (stick.on && e.pointerId === stick.id) {
      stick.on = false; stick.dx = 0; stick.dy = 0;
      if (stickEl) stickEl.classList.remove('on');
      if (stickNub) stickNub.style.transform = 'translate(0,0)';
    }
    if (look.on && e.pointerId === look.id) {
      const tapped = look.moved < 9;
      look.on = false;
      if (tapped) tapAt(e.clientX, e.clientY);
    }
  }

  function tapAt(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    const ndc = new T.Vector2(
      ((cx - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((cy - rect.top) / Math.max(1, rect.height)) * 2 + 1
    );
    const ray = new T.Raycaster();
    ray.setFromCamera(ndc, camera);

    if (strikeTarget(ray)) return;

    if (!near) return;
    if (ray.ray.direction.y > -0.05) return;
    interact();
  }

  // A tap on a board or a silhouette lights it up. There is no gun in the
  // hall, so the hit is the whole of it — something to aim at, at least.
  function strikeTarget(ray) {
    const list = World.hittables || [];
    if (!list.length) return false;
    let best = null, bestD = 2600;
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      if (!h.mesh || !h.mesh.parent) continue;
      const box = new T.Box3().setFromObject(h.mesh.parent);
      const p = ray.ray.intersectBox(box, new T.Vector3());
      if (!p) continue;
      const d = p.distanceTo(ray.ray.origin);
      if (d < bestD) { bestD = d; best = h; }
    }
    if (!best) return false;
    best.strike();
    if (G.HubCutscene) G.HubCutscene.toast('Hit', '#ffd166');
    return true;
  }

  function press(id) {
    const el = document.getElementById(id);
    if (el) el.click();
  }

  function multi(id) {
    const card = document.getElementById(id);
    if (!card) return;
    if (!(G.Net && G.Net.state && G.Net.state.lobbyId)) {
      const btn = document.getElementById('btnIntroMulti');
      if (btn) btn.click();
    }
    const again = document.getElementById(id);
    if (again) again.click();
  }

  function interact() {
    if (!near) return;
    if (near.locked) {
      flash(near.sub || 'That door is sealed.');
      return;
    }
    if (!near.act) return;
    const fn = near.act;
    if (!near.keepOpen) hide();
    fn();
  }

  /* =====================================================================
     walking
     ===================================================================== */
  function walkable(x, z) {
    const m = BODY;
    if (x * x + z * z <= (L.HALL_R - m) * (L.HALL_R - m)) return true;
    if (Math.abs(z) <= L.CORR - m && Math.abs(x) <= L.NEAR + 40) return true;
    if (Math.abs(x) <= L.CORR - m && Math.abs(z) <= L.NEAR + 40) return true;
    const sp = Rooms.SPACES;
    for (let i = 0; i < sp.length; i++) {
      const s = sp[i];
      if (Math.abs(x - s.x) <= s.w / 2 - m && Math.abs(z - s.z) <= s.d / 2 - m) return true;
    }
    return false;
  }

  // The floor under a point: the upper deck, a flight of steps, or the
  // ground. Only surfaces at most one step above the player's feet count, so
  // the hall can be walked under as well as walked on.
  function surfaceAt(x, z, base) {
    let best = 0;
    const list = Rooms.GALLERY.surfaces;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      let y;
      if (s.kind === 'cap') {
        if (z > s.zMax || x * x + z * z > s.r * s.r) continue;
        y = s.y;
      } else {
        if (Math.abs(x - s.x) > s.w / 2 || Math.abs(z - s.z) > s.d / 2) continue;
        const t = clamp((s.z + s.d / 2 - z) / s.d, 0, 1);
        y = s.y0 + (s.y1 - s.y0) * t;
      }
      if (y <= base + STEP && y > best) best = y;
    }
    return best;
  }

  function free(x, z) {
    if (!walkable(x, z)) return false;
    if (surfaceAt(x, z, player.base) - player.base > STEP) return false;
    for (let i = 0; i < solids.length; i++) {
      const o = solids[i];
      if (o.y != null && Math.abs(o.y - player.base) > 60) continue;
      const dx = x - o.x, dz = z - o.z;
      if (dx * dx + dz * dz < (o.r + BODY) * (o.r + BODY)) return false;
    }
    for (let i = 0; i < walls.length; i++) {
      const o = walls[i];
      if (Math.abs(x - o.x) < o.hw + BODY && Math.abs(z - o.z) < o.hd + BODY) return false;
    }
    return true;
  }

  function walk(dt) {
    if (quizOpen) {
      camera.position.set(player.x, EYE + player.base + player.y, player.z);
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;
      return;
    }
    let f = 0, s = 0;
    if (keys.w || keys.arrowup) f += 1;
    if (keys.s || keys.arrowdown) f -= 1;
    if (keys.d || keys.arrowright) s += 1;
    if (keys.a || keys.arrowleft) s -= 1;
    f += -stick.dy;
    s += stick.dx;
    const len = Math.hypot(f, s);
    let vx = 0, vz = 0;
    let moving = false;
    if (len > 0.08) {
      const k = Math.min(1, len) / len;
      const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
      vx = (-sy * (f * k) + cy * (s * k));
      vz = (-cy * (f * k) - sy * (s * k));
      moving = true;
    }
    if (player.dashT > 0) {
      player.dashT -= dt;
      vx = player.dx * (DASH_V / SPEED);
      vz = player.dz * (DASH_V / SPEED);
      moving = true;
    } else if (player.dashCd > 0) {
      player.dashCd = Math.max(0, player.dashCd - dt);
    }
    if (moving) {
      const dx = vx * SPEED * dt;
      const dz = vz * SPEED * dt;
      if (free(player.x + dx, player.z)) player.x += dx;
      if (free(player.x, player.z + dz)) player.z += dz;
    }

    // the floor rises under your feet — or drops away from them
    const gh = surfaceAt(player.x, player.z, player.base);
    if (gh < player.base - 8) player.y += player.base - gh;
    player.base = gh;

    // jumping: the hall never moves, only the eye does
    if (player.vy !== 0 || player.y > 0) {
      player.vy -= GRAV * dt;
      player.y += player.vy * dt;
      if (player.y <= 0) { player.y = 0; player.vy = 0; }
    }
    player.bob = (moving && player.y <= 0) ? player.bob + dt * 10 : player.bob * Math.max(0, 1 - dt * 8);
    camera.position.set(player.x, EYE + player.base + player.y + Math.sin(player.bob) * 2.4, player.z);
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;

    // the dash kicks the lens out and lets it settle again
    const fov = player.dashT > 0 ? 87 : 74;
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * Math.min(1, dt * 9);
      camera.updateProjectionMatrix();
    }
  }

  function nearest() {
    let best = null, bestD = REACH * REACH;
    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      // a doorway up on the deck is not in reach from the floor beneath it
      if (Math.abs((it.y || 0) - player.base) > 90) continue;
      const dx = it.x - player.x, dz = it.z - player.z;
      const d = dx * dx + dz * dz;
      if (d > bestD) continue;
      const dot = (-sy * dx - cy * dz) / (Math.sqrt(d) || 1);
      if (dot < -0.35) continue;
      bestD = d;
      best = it;
    }
    return best;
  }

  function paintPrompt() {
    if (!promptEl) return;
    if (!near) {
      promptEl.classList.remove('on');
      if (crossEl) crossEl.classList.remove('on');
      return;
    }
    promptEl.classList.add('on');
    if (crossEl) crossEl.classList.add('on');
    if (promptNameEl) promptNameEl.textContent = near.name || '';
    if (promptSubEl) promptSubEl.textContent = near.sub || '';
    promptEl.classList.toggle('is-locked', !!near.locked);
  }

  function paintHint() {
    if (!hintEl) return;
    const n = (G.HubPresence && G.HubPresence.online) ? G.HubPresence.online() : 1;
    if (n === hintCount) return;          // the line only changes with the crowd
    hintCount = n;
    hintEl.innerHTML =
      '<span class="hub-online">' + n + ' in the hall</span>' +
      'WASD walk · shift dash · drag look · space jump · E enter';
  }

  /* =====================================================================
     life cycle
     ===================================================================== */
  function resize() {
    if (!renderer || !wrap) return;
    const w = wrap.clientWidth || window.innerWidth;
    const h = wrap.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!active) return;
    const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016);
    lastT = now;
    const t = now * 0.001;

    walk(dt);
    // Tickers run at roughly half rate: banners, flames, portals and the kit
    // on its plinths all move slowly enough that nobody can tell, and it buys
    // back a lot of frames in a hall this size.
    tickerClock += dt;
    if (tickerClock > 0.032) {
      const tdt = tickerClock;
      tickerClock = 0;
      for (let i = 0; i < tickers.length; i++) {
        try { tickers[i](t, tdt); } catch (e) {}
      }
    }
    syncOthers(dt, t);

    if (!quizOpen && G.HubPresence && G.HubPresence.send) G.HubPresence.send(player.x, player.z, player.yaw);

    gateT += dt;
    if (gateT > 1.2) { gateT = 0; refreshGates(false); }

    collectGems();

    promptT += dt;
    if (promptT > 0.09) {
      promptT = 0;
      const n = nearest();
      if (n !== near) { near = n; paintPrompt(); }
      paintHint();
    }

    renderer.render(scene, camera);

    // If the machine cannot hold the frame rate, give up resolution before
    // giving up the hall.
    frames++;
    fpsClock += dt;
    if (fpsClock > 2.5) {
      if (frames / fpsClock < 38 && renderer.getPixelRatio() > 1.001) {
        renderer.setPixelRatio(1);
        resize();
      }
      frames = 0;
      fpsClock = 0;
    }
  }

  function ensure() {
    if (built) return;
    built = true;
    const intro = document.getElementById('overlayIntro');
    if (!intro || !T) return;

    wrap = document.createElement('div');
    wrap.id = 'hub3d';
    wrap.innerHTML =
      '<div class="hub-hud">' +
        '<div class="hub-cross" id="hubCross"></div>' +
        '<div class="hub-hint" id="hubHint"></div>' +
        '<div class="hub-flash" id="hubFlash"></div>' +
        '<div class="hub-stick" id="hubStick"><i></i></div>' +
        '<button class="hub-jump" id="hubJump" type="button" aria-label="Jump">JUMP</button>' +
        '<div class="hub-prompt" id="hubPrompt">' +
          '<div><span class="hub-prompt-name" id="hubPromptName"></span>' +
          '<span class="hub-prompt-sub" id="hubPromptSub"></span></div>' +
          '<span class="hub-key">E</span>' +
          '<button class="hub-enter" id="hubEnter" type="button">Enter</button>' +
        '</div>' +
      '</div>' +
      '<div class="hub-quiz" id="hubQuiz">' +
        '<div class="hq-card">' +
          '<div class="hq-name" id="hqName"></div>' +
          '<div class="hq-q" id="hqQ"></div>' +
          '<div class="hq-answers" id="hqAnswers"></div>' +
          '<div class="hq-foot"><span class="hq-hint" id="hqHint"></span>' +
          '<button class="hq-close" id="hqClose" type="button">Leave</button></div>' +
        '</div>' +
      '</div>';
    intro.insertBefore(wrap, intro.firstChild);

    promptEl = document.getElementById('hubPrompt');
    promptNameEl = document.getElementById('hubPromptName');
    promptSubEl = document.getElementById('hubPromptSub');
    hintEl = document.getElementById('hubHint');
    crossEl = document.getElementById('hubCross');
    stickEl = document.getElementById('hubStick');
    stickNub = stickEl ? stickEl.firstElementChild : null;
    quizEl = document.getElementById('hubQuiz');
    quizNameEl = document.getElementById('hqName');
    quizQEl = document.getElementById('hqQ');
    quizAnsEl = document.getElementById('hqAnswers');
    quizHintEl = document.getElementById('hqHint');
    document.getElementById('hubEnter').addEventListener('click', (e) => {
      e.preventDefault();
      interact();
    });
    document.getElementById('hqClose').addEventListener('click', (e) => {
      e.preventDefault();
      closeQuiz();
    });
    const jb = document.getElementById('hubJump');
    if (jb) {
      jb.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
    }

    scene = new T.Scene();
    scene.background = new T.Color(0x04060c);
    scene.fog = new T.Fog(0x04060c, 1600, 5400);

    camera = new T.PerspectiveCamera(74, 1, 1, 8000);
    camera.rotation.order = 'YXZ';

    try {
      renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      renderer = null;
      wrap.remove();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.15));
    renderer.outputEncoding = T.sRGBEncoding;
    canvas = renderer.domElement;
    wrap.appendChild(canvas);

    scene.add(new T.HemisphereLight(0x2f5c8f, 0x04060c, 0.95));
    const moon = new T.DirectionalLight(0x9fd0ff, 0.45);
    moon.position.set(700, 1600, -500);
    scene.add(moon);
    const fill = new T.DirectionalLight(0x5f8dff, 0.22);
    fill.position.set(-900, 700, 600);
    scene.add(fill);

    buildWorld();

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
  }

  function show() {
    ensure();
    if (!renderer) return;
    const intro = document.getElementById('overlayIntro');
    if (intro) intro.classList.add('hub-mode');
    active = true;
    lastT = 0;
    resize();
    paintHint();
    paintPrompt();
    refreshGates(true);
    if (G.HubPresence && G.HubPresence.start) G.HubPresence.start();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function hide() {
    active = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    stick.on = false; stick.dx = 0; stick.dy = 0;
    look.on = false;
    for (const k in keys) keys[k] = false;
    near = null;
    player.y = 0; player.vy = 0;
    player.dashT = 0; player.dashCd = 0;
    if (quizOpen) closeQuiz();
    if (promptEl) promptEl.classList.remove('on');
    if (crossEl) crossEl.classList.remove('on');
    if (stickEl) stickEl.classList.remove('on');
    if (G.HubPresence && G.HubPresence.stop) G.HubPresence.stop();
    for (const [seat, o] of [...others]) { scene.remove(o.grp); others.delete(seat); }
    const intro = document.getElementById('overlayIntro');
    if (intro) intro.classList.remove('hub-mode');
  }

  function wantHub() {
    const intro = document.getElementById('overlayIntro');
    if (!intro || intro.style.display === 'none') return false;
    const all = document.querySelectorAll('.overlay');
    for (let i = 0; i < all.length; i++) {
      const o = all[i];
      if (o === intro || o.id === 'overlayBoot') continue;
      if (window.getComputedStyle(o).display !== 'none') return false;
    }
    return true;
  }

  // The hall is built and lit the moment this file is parsed — behind the boot
  // screen — so the flat intro card is never the thing you see first.
  function boot() {
    ensure();
    if (renderer) show();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
  window.addEventListener('game:ready', boot);

  setInterval(function () {
    const want = wantHub();
    if (want && !active) show();
    else if (!want && active) hide();
  }, 90);

  // Gems are picked up simply by walking near them: no key, no prompt.
  function collectGems() {
    if (!gems.length) return;
    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i];
      const dx = g.x - player.x, dz = g.z - player.z;
      if (dx * dx + dz * dz > 90 * 90) continue;
      Rooms.collectGem(g.id);
      scene.remove(g.mesh);
      gems.splice(i, 1);
      if (G.HubCutscene) {
        G.HubCutscene.play({
          kicker: 'A gem of the old builders',
          title: Rooms.gems().length + ' OF ' + Rooms.GEMS.length,
          sub: 'Collected',
          accent: '#7dffd0'
        });
      } else {
        flash('Gem found — ' + Rooms.gems().length + ' of ' + Rooms.GEMS.length);
      }
      refreshGates(false);
    }
  }

  G.Hub3D = {
    active: () => active,
    show: show,
    hide: hide,
    interact: interact,
    pos: () => ({ x: player.x, z: player.z, yaw: player.yaw }),
    gems: () => Rooms.gems().length,
    canStand: (x, z) => free(x, z)
  };
})(window);
