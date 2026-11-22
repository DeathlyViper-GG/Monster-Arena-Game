/* Crysto — the world beyond the pod.
   A continent of its own: 80,000 units across, built as you walk it, lit by one
   warm sun, with a village, three shrines, a bridge, a keep and a quest that has
   nothing to do with the arena. */
(function () {
  const C = (window.Crysto = window.Crysto || {});

  const WALK = 300, GRAVITY = 1900, JUMP = 700;
  // First person, exactly as the arena plays it: no body of your own is ever
  // drawn — the only thing in view is the arm you are carrying.
  const EYE = 128;
  const DASH_SPEED = 1080, DASH_TIME = 0.34, DASH_CD = 1.15;
  // How wide the walker is to the world's walls. A body is pushed out of
  // whatever it overlaps rather than stopped dead, so no gap between two
  // houses — or between a house and the well — can ever swallow them.
  const PLAYER_R = 24;

  let renderer, scene, camera, canvas, terrain, town, cave, hurtEl;
  let raf = 0, last = 0, running = false;
  let camYaw = 0, camPitch = 0.05;
  // When the walker last took a blow: no single guardian tick can shred them.
  let lastHurt = 0;
  let lastPrompt = null, uiT = 0, wasHub = false, saveAcc = 0, frames = 0;
  let dashT = 0, dashCd = 0, dashDir = { x: 0, z: -1 };
  const trail = [];
  // A film the hosting page is drawing over the top of the world.
  let film = null, filmAfter = null, filmWait = null;
  let wokeUp = false;
  // A film played inside the world holds the walker still while the eye is
  // steered by the scene that is playing.
  let frozen = false;

  const P = {
    x: 0, z: 300, y: 0, vy: 0, yaw: 0, moved: 0, mx: 0, mz: 0,
    hp: 100, maxHp: 100, onGround: true, respawn: { x: 0, z: 300 }
  };

  const keys = {};
  const drag = { on: false, x: 0, y: 0, moved: 0 };

  // Somewhere the walker can actually stand: out of every wall, off the water.
  function safeSpot(x, z) {
    if (!blocked(x, z) && groundAt(x, z) > 8) return { x: x, z: z };
    for (let ring = 1; ring <= 16; ring++) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + ring * 0.4;
        const px = x + Math.cos(a) * ring * 55, pz = z + Math.sin(a) * ring * 55;
        if (!blocked(px, pz) && groundAt(px, pz) > 8) return { x: px, z: pz };
      }
    }
    return { x: x, z: z };
  }

  // The cave's floor is its own surface: while the walker is inside the rock,
  // this is what their feet stand on, and the land takes over again the moment
  // they step out of the mouth.
  function groundAt(x, z) {
    // inside a shrine's own room the floor is the room's, not the vale's
    if (C.interiorFloor) {
      const i = C.interiorFloor(x, z);
      if (i != null) return i;
    }
    const f = C.caveFloor ? C.caveFloor(x, z) : null;
    return f == null ? C.height(x, z) : f;
  }
  C.groundAt = groundAt;

  function blocked(x, z) {
    if (!town) return false;
    const need = PLAYER_R + 6;
    for (let i = 0; i < town.colliders.length; i++) {
      const c = town.colliders[i];
      const dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz < (c.r + need) * (c.r + need)) return true;
    }
    return false;
  }

  // Walls slide instead of stopping: a step that lands inside one is pushed
  // back out along the shortest line, so the walker keeps moving along the
  // wall and can never be wedged between two of them.
  function slide(x, z) {
    if (!town) return { x: x, z: z };
    const list = town.colliders;
    for (let pass = 0; pass < 3; pass++) {
      let hit = false;
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        const need = c.r + PLAYER_R;
        const dx = x - c.x, dz = z - c.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= need * need) continue;
        const d = Math.sqrt(d2);
        const ux = d > 0.001 ? dx / d : 1, uz = d > 0.001 ? dz / d : 0;
        x = c.x + ux * need;
        z = c.z + uz * need;
        hit = true;
      }
      if (!hit) break;
    }
    return { x: x, z: z };
  }

  // The arena's own slide, in first person: a hard burst along the ground with
  // a neon streak left behind it and the camera dropping low for the ride.
  function dash() {
    if (dashCd > 0 || dashT > 0) return;
    const m = Math.hypot(P.mx, P.mz);
    dashDir = m > 0.01 ? { x: P.mx, z: P.mz } : { x: -Math.sin(camYaw), z: -Math.cos(camYaw) };
    dashT = DASH_TIME;
    dashCd = DASH_CD;
    // the arms are thrown forward for the ride, the way the arena's are
    if (C.weapons) C.weapons.dash();
    if (C.hud) C.hud.prompt('');
  }

  function streak() {
    if (!scene) return;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(52, 9),
      new THREE.MeshBasicMaterial({
        color: 0x9fe3ff, transparent: true, opacity: 0.7,
        depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
      })
    );
    m.position.set(
      P.x + (Math.random() - 0.5) * 44,
      P.y + 34 + Math.random() * 74,
      P.z + (Math.random() - 0.5) * 44
    );
    m.rotation.y = camYaw;
    scene.add(m);
    trail.push({ m: m, t: 0.3 });
  }

  // The ring of dust a landing kicks up, so a hop reads the way it does in the
  // arena even with no body of your own on screen.
  function puff() {
    if (!scene) return;
    const m = new THREE.Mesh(
      new THREE.RingGeometry(14, 26, 18),
      new THREE.MeshBasicMaterial({ color: 0xd9cdb0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(P.x, P.y + 4, P.z);
    scene.add(m);
    trail.push({ m: m, t: 0.28, ring: true });
  }

  function movePlayer(dt) {
    if (frozen || (C.hud && C.hud.overlaysOpen)) { P.mx = 0; P.mz = 0; return; }
    let mx = 0, mz = 0;
    const f = { x: -Math.sin(camYaw), z: -Math.cos(camYaw) };
    const r = { x: Math.cos(camYaw), z: -Math.sin(camYaw) };

    if (keys.w || keys.arrowup) { mx += f.x; mz += f.z; }
    if (keys.s || keys.arrowdown) { mx -= f.x; mz -= f.z; }
    if (keys.a || keys.arrowleft) { mx -= r.x; mz -= r.z; }
    if (keys.d || keys.arrowright) { mx += r.x; mz += r.z; }

    if (C.hud && C.hud.stick && (C.hud.stick.x || C.hud.stick.y)) {
      mx += f.x * -C.hud.stick.y + r.x * C.hud.stick.x;
      mz += f.z * -C.hud.stick.y + r.z * C.hud.stick.x;
    }

    if (dashT > 0) {
      dashT -= dt;
      mx = dashDir.x;
      mz = dashDir.z;
      streak();
    }

    const len = Math.hypot(mx, mz);
    if (len > 0.001) {
      mx /= len; mz /= len;
      const wading = groundAt(P.x, P.z) < 4 ? 0.55 : 1;
      // a tar grenade under your boots drags you down (bossattacks.js), and the
      // sights slow the walk by the gun's own profile
      const sight = C.weapons && C.weapons.moveMul ? C.weapons.moveMul() : 1;
      const speed = (dashT > 0 ? DASH_SPEED : WALK) * wading * (C.slowFactor || 1) * sight;
      let to = slide(P.x + mx * speed * dt, P.z + mz * speed * dt);
      const run = Math.hypot(to.x - P.x, to.z - P.z);
      if (run > 0.01) {
        const grade = (groundAt(to.x, to.z) - groundAt(P.x, P.z)) / run;
        if (grade > 0.68) {
          const traction = grade > 1.05 ? 0.22 : Math.max(0.42, 1 - (grade - 0.2) * 0.72);
          to = slide(P.x + mx * speed * dt * traction, P.z + mz * speed * dt * traction);
        } else if (grade < -0.45 && dashT <= 0) {
          const downhill = Math.min(1.18, 1 + (-grade - 0.45) * 0.18);
          to = slide(P.x + mx * speed * dt * downhill, P.z + mz * speed * dt * downhill);
        }
      }
      P.moved += Math.hypot(to.x - P.x, to.z - P.z);
      P.x = to.x;
      P.z = to.z;
      // a shrine's hall is sealed: no step or dash can carry the walker out
      if (C.shrine && C.shrine.clamp) C.shrine.clamp(P);
      P.yaw = Math.atan2(mx, mz);
      P.mx = mx; P.mz = mz;
    } else {
      P.mx = 0; P.mz = 0;
    }

    // gravity and the ground under the boots
    const g = groundAt(P.x, P.z);
    P.vy -= GRAVITY * dt;
    P.y += P.vy * dt;
    if (P.y <= g) {
      if (!P.onGround && P.vy < -260) puff();
      P.y = g;
      P.vy = 0;
      P.onGround = true;
    } else {
      P.onGround = false;
    }
  }

  function placeCamera() {
    const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    const fx = -Math.sin(camYaw) * cp, fz = -Math.cos(camYaw) * cp;
    const moving = P.mx || P.mz;
    const bob = moving ? Math.sin(performance.now() * 0.0105) * 3.4 : 0;
    // the slide drops the eye low and throws the view out a touch, exactly as
    // the arena's slide does
    const dip = dashT > 0 ? 52 : 0;
    const ey = P.y + EYE - dip + bob;
    camera.position.set(P.x, ey, P.z);
    camera.lookAt(P.x + fx * 500, ey - sp * 500, P.z + fz * 500);
    // the sights magnify the vale exactly as they magnify the arena
    const zoom = C.weapons && C.weapons.zoom ? C.weapons.zoom() : 1;
    const wantFov = (58 + (dashT > 0 ? 10 : 0)) / zoom;
    if (Math.abs(camera.fov - wantFov) > 0.15) {
      camera.fov += (wantFov - camera.fov) * 0.28;
      camera.updateProjectionMatrix();
    }
  }

  function attack() {
    if (frozen) return;
    if (C.weapons) C.weapons.trigger();
  }

  function interact() {
    if (frozen) return;
    if (C.hud.advance()) return;
    if (C.shrine && C.shrine.use && C.shrine.use(P)) return;
    const t = (C.reach && C.reach.target(P)) || C.quest.target(P);
    if (t && t.run) t.run();
  }

  function hurtPlayer(n) {
    const now = performance.now() / 1000;
    if (now - lastHurt < 0.55 || P.hp <= 0) return;
    lastHurt = now;
    P.hp = Math.max(0, P.hp - n);
    if (hurtEl) {
      hurtEl.style.opacity = '0.55';
      setTimeout(() => { if (hurtEl) hurtEl.style.opacity = '0'; }, 220);
    }
    if (P.hp <= 0) {
      // Everything done since the last save is undone: the shrine's room is
      // left, the vale's monsters come back, and the vigil returns to exactly
      // the state the waystone remembers.
      if (C.shrine && C.shrine.active && C.shrine.active()) C.shrine.leave(true);
      if (C.bossroom && C.bossroom.active && C.bossroom.active()) C.bossroom.abandon();
      if (C.quest && C.quest.reloadFromSave) C.quest.reloadFromSave();
      P.hp = P.maxHp;
      const back = safeSpot(P.respawn.x, P.respawn.z);
      P.x = back.x;
      P.z = back.z;
      P.y = groundAt(P.x, P.z);
      P.vy = 0;
      if (C.hud) {
        C.hud.setHearts(P.hp, P.maxHp);
        C.hud.banner('The waystone pulls you back', 'You fall — the vale returns to your last save');
      }
    }
  }

  function teleport(x, z) {
    const spot = safeSpot(x, z);
    P.x = spot.x;
    P.z = spot.z;
    P.y = groundAt(P.x, P.z);
    P.vy = 0;
    dashT = 0;
    // the ground under the landing is laid at once; the rest of the ring
    // follows over the next few frames
    if (terrain) terrain.update(P.x, P.z, 24);
    if (camera) placeCamera();
  }

  function tick(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;

    // A film is on screen: the vale stands still behind it until the last beat.
    if (film) {
      raf = requestAnimationFrame(tick);
      return;
    }

    if (C.tickers) {
      for (let i = 0; i < C.tickers.length; i++) C.tickers[i](t / 1000);
    }

    if (dashCd > 0) dashCd -= dt;
    movePlayer(dt);
    placeCamera();

    if (C.weapons) C.weapons.update(dt, Math.hypot(P.mx, P.mz) > 0.01 || dashT > 0);

    for (let i = trail.length - 1; i >= 0; i--) {
      const s = trail[i];
      s.t -= dt;
      if (s.ring) s.m.scale.setScalar(1 + (1 - s.t / 0.28) * 2.4);
      s.m.material.opacity = Math.max(0, s.t / 0.3) * 0.7;
      if (s.t <= 0) {
        scene.remove(s.m);
        s.m.geometry.dispose();
        s.m.material.dispose();
        trail.splice(i, 1);
      }
    }

    // Ground that has not been built yet is streamed in over the next few
    // frames instead of in one long stall the moment a chunk line is crossed.
    terrain.update(P.x, P.z, 5);
    terrain.follow(P.x, P.y, P.z);
    terrain.tick(t / 1000);
    const worldPaused = C.hud && C.hud.overlaysOpen;
    if (!worldPaused) {
      if (C.damageTick) C.damageTick(dt);
      C.quest.tick(dt, P);
      if (C.reach) C.reach.tick(dt, P);
      if (C.herbs) C.herbs.tick(dt, P);
      if (C.shrine && C.shrine.tick) C.shrine.tick(dt, P);
    }

    // The vigil saves itself as you go: never back to the pod.
    if (!worldPaused) saveAcc += dt;
    if (saveAcc > 24) { saveAcc = 0; if (C.save) C.save.auto(); }

    uiT += dt;
    if (uiT > 0.15) {
      uiT = 0;
      const q = C.reach && C.reach.inside(P) ? C.reach.tracker() : C.quest.tracker();
      let dist = null, angle = null;
      if (q.target) {
        const dx = q.target.x - P.x, dz = q.target.z - P.z;
        dist = Math.hypot(dx, dz);
        const world = Math.atan2(dx, dz);
        const cam = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw));
        angle = -(world - cam) * 180 / Math.PI;
        if (angle > 180) angle -= 360;
        if (angle < -180) angle += 360;
      }
      C.hud.setQuest(q.title, q.objective, dist);
      C.hud.setCompass(angle, dist == null ? 0 : dist);
      C.hud.setHearts(P.hp, P.maxHp);
      C.hud.setFood(C.herbs ? C.herbs.food() : 0, C.herbs ? C.herbs.maxFood : 100);

      const t2 = (C.reach && C.reach.target(P)) || C.quest.target(P);
      let label = t2 && t2.run ? t2.label : null;
      if (C.shrine && C.shrine.prompt) label = C.shrine.prompt(P) || label;
      let gather = null;
      if (!label && C.herbs) {
        gather = C.herbs.target(P);
        if (gather) label = '[T] Collect ' + gather.name;
      }
      C.hud.updateWorld(P, q.target, !!gather);
      if (label !== lastPrompt) {
        lastPrompt = label;
        C.hud.prompt(label);
      }
    }

    // the pit's own reticle, for the arm actually in hand
    if (C.hud.crosshair && C.weapons && C.weapons.reticle) {
      const rt = C.weapons.reticle();
      C.hud.crosshair(locked() || !coarse(), rt.kind, rt.gap, rt.alpha, rt.r);
      if (C.hud.scope) C.hud.scope(rt.scope);
    }

    // The sun's shadow map is a second pass over the whole vale. It only has to
    // keep up with the walker's own step, so it is redrawn every third frame
    // instead of every one — the shadows land in exactly the same place.
    if (renderer.shadowMap.enabled && (frames++ % 3) === 0) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    // the arms, drawn over the world in their own pass
    if (C.weapons) {
      renderer.autoClear = false;
      C.weapons.render(renderer);
      renderer.autoClear = true;
    }
    raf = requestAnimationFrame(tick);
  }

  function onKey(e, down) {
    const k = String(e.key || '').toLowerCase();
    if (k === 'escape' && down) {
      if (C.hud.overlaysOpen) {
        C.hud.toggleMap(false);
        C.hud.toggleInventory(false);
        return;
      }
      // The browser lets the pointer go on Escape by itself; a press with the
      // cursor already free leaves the vale.
      if (document.pointerLockElement === canvas) return;
      C.stop();
      return;
    }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) >= 0) {
      keys[k] = down;
      if (down) e.preventDefault();
    }
    if (!down) return;
    if (C.hud.overlaysOpen && k !== 'm' && k !== 'i') return;
    if (k === 'shift') { e.preventDefault(); dash(); return; }
    if (k === 'q') { if (C.weapons) C.weapons.cycle(); return; }
    if (k === 'r') { if (C.weapons) C.weapons.reload(); return; }
    if (k === 'm') { e.preventDefault(); C.hud.toggleMap(); return; }
    if (k === 'i') { e.preventDefault(); C.hud.toggleInventory(); return; }
    if (k === 't') { e.preventDefault(); if (C.herbs) C.herbs.collect(P); return; }
    if (k === ' ') {
      e.preventDefault();
      if (C.hud.talking) { C.hud.advance(); return; }
      if (P.onGround) { P.vy = JUMP; P.onGround = false; }
    }
    if (k === 'e') interact();
  }

  const onKeyDown = (e) => onKey(e, true);
  const onKeyUp = (e) => onKey(e, false);

  const coarse = () => !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const locked = () => document.pointerLockElement === canvas;

  function paintCursor() {
    if (!canvas) return;
    const on = locked();
    canvas.style.cursor = on ? 'none' : 'crosshair';
    // the pointer is the game's while it is held: nothing else on the page
    // gets to show an arrow over the vale
    document.body.style.cursor = on ? 'none' : '';
  }

  function onLockChange() {
    if (locked()) drag.on = false;
    else if (C.weapons) C.weapons.aim(false);
    paintCursor();
  }

  // The browser's own menu has no place in the vale: the right button aims.
  function onMenu(e) { e.preventDefault(); }

  // A real control keeps its own press; everything else in the world takes it.
  function onControl(t) {
    return !!(t && t.closest && t.closest('button, input, textarea, select, a, .cy-dialogue.on, .cy-choose.on, .cy-map-panel.on, .cy-inventory-panel.on'));
  }

  // The arena's lock, made to stick: any lock another view left behind (the
  // pit, a cutscene) is let go first, and the request no longer depends on the
  // press landing on the bare canvas — anything over the world used to swallow
  // it, so the pointer was never taken at all.
  function grabPointer() {
    // Always asked for, even where the pointer claims to be coarse: a hybrid
    // machine with a touchscreen still has a mouse, and a browser that cannot
    // give the lock simply refuses it — the drag below still turns the eye.
    if (!canvas) return;
    if (document.pointerLockElement === canvas) return;
    if (document.pointerLockElement) {
      try { document.exitPointerLock(); } catch (_) {}
    }
    if (!canvas.requestPointerLock) return;
    try {
      const r = canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
    } catch (_) {}
  }

  // The arena's own input, word for word (pve16.js): a press takes the pointer,
  // and while the canvas holds it the eye turns on the mouse's raw movement —
  // the cursor is gone and the crosshair is all that is left.
  function onDown(e) {
    if (onControl(e.target)) return;
    grabPointer();
    // right mouse brings the sights up, exactly as the pit reads it
    if (e.button === 2) { if (C.weapons) C.weapons.aim(true); return; }
    if (locked()) { attack(); return; }
    drag.on = true;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.moved = 0;
  }
  function onMove(e) {
    // the sights damp the eye exactly as they damp the pit's
    const sens = C.weapons && C.weapons.sensMul ? C.weapons.sensMul() : 1;
    if (document.pointerLockElement === canvas) {
      const dx = e.movementX || 0, dy = e.movementY || 0;
      if (!dx && !dy) return;
      camYaw -= dx * 0.0024 * sens;
      camPitch = Math.max(-0.15, Math.min(0.95, camPitch + dy * 0.0020 * sens));
      if (C.weapons) C.weapons.look(-dx * 0.0024 * sens, dy * 0.0020 * sens);
      return;
    }
    if (!drag.on) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    camYaw -= dx * 0.005 * sens;
    camPitch = Math.max(-0.15, Math.min(0.95, camPitch + dy * 0.004 * sens));
    // the weapon lags a beat behind the eye as the view turns
    if (C.weapons) C.weapons.look(-dx * 0.005 * sens, dy * 0.004 * sens);
  }
  function onUp(e) {
    // letting go of the right button lowers the sights
    if (e.button === 2) { if (C.weapons) C.weapons.aim(false); return; }
    if (locked()) return;
    if (!drag.on) return;
    drag.on = false;
    if (drag.moved < 8 && e.target === canvas) attack();
  }
  function onWheel(e) {
    if (e.target !== canvas) return;
    e.preventDefault();
    if (C.weapons) C.weapons.cycle();
  }
  function onResize() {
    if (!renderer || !camera) return;
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (C.weapons) C.weapons.resize(aspect);
  }

  /* ---- the films -------------------------------------------------------
     The cutscenes are drawn by the app page around this frame (they are the
     same engine as the realm intros), so the world asks for one and waits.
     `after` runs the moment it ends, so a line of dialogue never fires behind
     a film nobody can see. */
  function playFilm(key, after) {
    if (film || !running) { if (after) after(); return; }
    if (window.parent === window) { if (after) after(); return; }
    film = key;
    filmAfter = after || null;
    C.hud.hide();
    try {
      window.parent.postMessage({ type: 'crysto-cutscene', key: key }, '*');
    } catch (_) {
      film = null;
      C.hud.show();
      if (filmAfter) { const a = filmAfter; filmAfter = null; a(); }
      return;
    }
    // A page that never answers (a bare game.html, a blocked message) must not
    // leave the vale frozen behind a film that never starts.
    filmWait = setTimeout(() => { if (film) C.cutsceneDone(); }, 2000);
  }

  C.playFilm = playFilm;

  C.cutsceneDone = function () {
    if (!film) return;
    clearTimeout(filmWait);
    filmWait = null;
    const after = filmAfter;
    film = null;
    filmAfter = null;
    C.hud.show();
    if (after) after();
  };

  window.addEventListener('message', function (e) {
    const d = e.data || {};
    if (d.type === 'crysto-cutscene-ack') {
      clearTimeout(filmWait);
      filmWait = null;
    } else if (d.type === 'crysto-cutscene-done') {
      C.cutsceneDone();
    }
  });

  C.hurtPlayer = hurtPlayer;
  C.teleport = teleport;

  // A fresh vigil: the waystone forgets everything the walker has done, the arms
  // go back to bare knuckles, and the walk begins again in the cave.
  C.resetProgress = function () {
    if (C.save) C.save.clear();
    if (C.reach && C.reach.clear) C.reach.clear();
    if (C.weapons && C.weapons.reset) C.weapons.reset();
    if (C.damageClear) C.damageClear();
    window.location.reload();
  };

  // Set down exactly where the scene asks, without hunting for open ground.
  C.place = function (x, z) {
    P.x = x;
    P.z = z;
    P.y = groundAt(x, z);
    P.vy = 0;
    dashT = 0;
    if (terrain) terrain.update(P.x, P.z, 24);
    if (camera) placeCamera();
  };

  // A film inside the world: the eye is steered, the body is held still.
  C.freeze = function (on) { frozen = !!on; };
  C.setLook = function (yaw, pitch) {
    camYaw = yaw;
    if (pitch != null) camPitch = Math.max(-0.85, Math.min(0.95, pitch));
  };
  C.getLook = function () { return { yaw: camYaw, pitch: camPitch }; };

  // Something out in the world that puts a little life back: a plant, a spring.
  C.heal = function (n) {
    if (P.hp <= 0) return 0;
    const before = P.hp;
    P.hp = Math.min(P.maxHp, P.hp + (n || 0));
    const gained = Math.round(P.hp - before);
    if (gained > 0 && C.hud) C.hud.setHearts(P.hp, P.maxHp);
    return gained;
  };

  // The elixirs' gift: a stronger heart, kept by the save.
  C.setMaxHp = function (n) {
    P.maxHp = Math.max(100, n || 100);
    P.hp = P.maxHp;
    if (C.hud) C.hud.setHearts(P.hp, P.maxHp);
  };
  C.upgradeHealth = function (n) {
    P.maxHp += n || 50;
    P.hp = P.maxHp;
    if (C.hud) C.hud.setHearts(P.hp, P.maxHp);
  };
  C.onAttack = attack;
  C.onUse = interact;
  C.onCollect = function () { if (C.herbs) C.herbs.collect(P); };
  C.onDash = dash;
  C.dashing = function () { return dashT > 0; };
  C.onJump = function () { if (P.onGround) { P.vy = JUMP; P.onGround = false; } };
  C.player = function () { return P; };

  C.start = function () {
    if (running) return;
    if (!window.THREE) { alert('Crysto needs the 3D engine, which has not finished loading.'); return; }

    document.querySelectorAll('.overlay').forEach((o) => { o.style.display = 'none'; });
    // Remember whether the walking hall was the door we came through, so the
    // right menu is behind us when we come back.
    wasHub = !!(window.Hub3D && window.Hub3D.active && window.Hub3D.active());
    if (window.Hub3D && window.Hub3D.hide) window.Hub3D.hide();
    document.body.classList.add('crysto-on');
    // A fresh visit rebuilds every animated prop: nothing from a previous walk
    // may keep ticking against meshes that were thrown away.
    C.tickers.length = 0;
    C.keepClear.length = 0;
    if (C.roadClear) C.roadClear.length = 0;
    if (C.shrine) C.shrine.reset();

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 5, 30000);
    camera.position.set(P.x + 200, P.y + 400, P.z + 500);
    C.camera = camera;

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    if (THREE.ACESFilmicToneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
    }
    renderer.shadowMap.enabled = !coarse();
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // redrawn on a beat of its own (see tick), not with every frame
    renderer.shadowMap.autoUpdate = false;
    frames = 0;

    canvas = renderer.domElement;
    canvas.id = 'crystoCanvas';
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:25000;display:block;touch-action:none';
    document.body.appendChild(canvas);

    hurtEl = document.createElement('div');
    hurtEl.style.cssText = 'position:fixed;inset:0;z-index:25500;pointer-events:none;opacity:0;transition:opacity .25s ease;background:radial-gradient(circle at 50% 50%, rgba(160,20,20,0) 40%, rgba(150,20,20,.85) 100%)';
    document.body.appendChild(hurtEl);

    terrain = C.buildTerrain(scene);
    // the Reach's weather is hung on the same sun and haze the vale uses
    C.terrain = terrain;
    town = C.buildTown(scene);
    // The continent beyond the water: its villages, its camps and its people,
    // built now so stepping through the doorway is a step, not a load.
    if (C.reach && C.reach.build) C.reach.build(scene, town.colliders);
    // what grows: stands of bloodroot, hearthcap and mireweed across both lands
    if (C.herbs && C.herbs.build) C.herbs.build(scene);
    // The walk begins inside the mountain, beside the cryo pod.
    cave = C.buildCave ? C.buildCave(scene) : null;
    if (cave && cave.colliders) town.colliders.push.apply(town.colliders, cave.colliders);

    const spot = cave ? cave.spawn : safeSpot(470, 250);
    P.x = spot.x;
    P.z = spot.z;
    P.y = groundAt(P.x, P.z);
    P.vy = 0;
    P.respawn = { x: P.x, z: P.z };
    // Facing the way out, so the vale is what they see when they wake.
    camYaw = cave ? cave.yaw : Math.atan2(P.x, P.z);
    camPitch = 0.05;
    dashT = 0;
    dashCd = 0;
    trail.length = 0;

    P.hp = P.maxHp;

    C.hud.build();
    C.hud.show();
    C.hud.toggleMap(false);
    C.hud.toggleInventory(false);
    if (C.herbs) C.hud.inventoryChanged(C.herbs.inventory, C.herbs.food(), C.herbs.maxFood);
    paintCursor();
    C.hud.setHearts(P.hp, P.maxHp);
    C.quest.init(scene, town);
    // the three sanctums stand ready, and the arms are in your hands
    if (C.bossroom) { C.bossroom.reset(); C.bossroom.build(scene, town.colliders); }
    if (C.weapons) C.weapons.init(scene, window.innerWidth / window.innerHeight);

    // The vigil remembers: walk back in at the last shrine you woke, not at the
    // pod, with the guns you had earned still on you.
    const saved = C.save ? C.save.read() : null;
    const resumed = !!(saved && C.quest.restore(saved));
    if (resumed) {
      // Once the vigil is under way the vale's waystone is where you come back
      // to; a brand-new run still begins in the mountain.
      if (C.quest.state.step >= 1) {
      const back = safeSpot(0, -150);
      P.x = back.x;
      P.z = back.z;
      P.y = groundAt(P.x, P.z);
      P.vy = 0;
      P.respawn = { x: P.x, z: P.z };
      camYaw = Math.atan2(-P.x, -P.z);
      C.hud.banner('The vigil remembers', C.quest.STEPS[C.quest.state.step] || '');
      }
      wokeUp = true;
    }
    if (C.herbs) C.hud.inventoryChanged(C.herbs.inventory, C.herbs.food(), C.herbs.maxFood);

    // The ring is streamed in nearest-first while the arrival plays, instead of
    // freezing the page while all twenty-five tiles are shaped at once.
    terrain.update(P.x, P.z, 10);
    terrain.follow(P.x, P.y, P.z);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    // The press is read on the window in the capture phase, so no layer drawn
    // over the vale can swallow the click that takes the pointer.
    window.addEventListener('mousedown', onDown, true);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onMenu);
    window.addEventListener('resize', onResize);
    document.addEventListener('pointerlockchange', onLockChange);

    running = true;
    last = performance.now();
    saveAcc = 0;
    raf = requestAnimationFrame(tick);

    const welcome = () => {
      C.hud.banner('Crysto', 'The vale of Drane');
      C.hud.say('', ['Crysto. A thousand years under the ice, and the sun still finds it.',
        'WASD to walk, drag to look, click to strike. Follow the light out of the cave.',
        'And when the vale is not enough: an arch of cold stone stands on the green. Step through it.'], () => {});
    };
    // The arrival is worth seeing once; after that the vale simply greets you.
    if (wokeUp) welcome();
    else { wokeUp = true; playFilm('cryo', welcome); }
  };

  C.stop = function () {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    // Leaving the world closes any film that was still on screen.
    if (film) {
      film = null;
      filmAfter = null;
      clearTimeout(filmWait);
      try { window.parent.postMessage({ type: 'crysto-cutscene-cancel' }, '*'); } catch (_) {}
    }

    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('mousedown', onDown, true);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('pointerlockchange', onLockChange);
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    if (C.hud.crosshair) C.hud.crosshair(false);
    if (C.hud.cinematic) C.hud.cinematic(false);
    if (C.damageClear) C.damageClear();
    if (C.shrine) C.shrine.reset();
    if (C.freeze) C.freeze(false);
    if (canvas) canvas.removeEventListener('wheel', onWheel);
    if (canvas) canvas.removeEventListener('contextmenu', onMenu);
    if (C.weapons) C.weapons.aim(false);

    if (C.weapons) C.weapons.dispose();
    trail.forEach((s) => { if (s.m.parent) s.m.parent.remove(s.m); });
    trail.length = 0;
    dashT = 0;

    if (scene) {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    if (renderer) {
      renderer.dispose();
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    if (hurtEl && hurtEl.parentNode) hurtEl.parentNode.removeChild(hurtEl);
    canvas = null;
    renderer = null;
    scene = null;
    C.camera = null;
    if (C.monsters) C.monsters.clear();

    C.hud.hide();
    C.hud.hideChoose();
    if (C.hud.setBoss) C.hud.setBoss(null);
    document.body.classList.remove('crysto-on');

    const intro = document.getElementById('overlayIntro');
    if (intro) intro.style.display = 'grid';
    if (wasHub && window.Hub3D && window.Hub3D.show) window.Hub3D.show();
  };

  C.active = function () { return running; };
})();
