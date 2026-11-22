/* Crysto — inside the shrines.
   A shrine is not simply touched awake. Its stone opens, the eye is held on the
   orb while it wakes — the same first-person eye the walker always has — and
   then the walker is set down inside the shrine's own hall: a long sealed room
   of old pillars where the vale's dead still walk. Fight through them to the
   far end and the altar gives up an Elixir of Energy. Three of them open the
   vale's last gift: a stronger heart. */
(function () {
  const C = (window.Crysto = window.Crysto || {});

  const HALLS = {
    root: { name: 'The Root Hall', stone: 0x3d463a, colour: 0x7dffa3, air: 0x0a1410,
      waves: [['ravener', 'ravener'], ['gorgon-x', 'ravener', 'elem-quake'], ['bone-warden', 'elem-quake']] },
    ember: { name: 'The Ember Hall', stone: 0x453a30, colour: 0xff9a5c, air: 0x140b06,
      waves: [['hellforged', 'ravener'], ['elem-fire', 'hellforged', 'ravener'], ['elem-fire', 'noctilith']] },
    tide: { name: 'The Tide Hall', stone: 0x323f47, colour: 0x6fd0ff, air: 0x060f14,
      waves: [['noctilith', 'ravener'], ['elem-rime', 'elem-soul', 'noctilith'], ['elem-rime', 'bone-warden']] }
  };

  const HALF_W = 520, LEN = 3200, CEIL = 440;
  const HALL_Y = 4000;          // the halls sit in their own sky, far from the vale
  // The walker is kept this far inside the stone — clear of the colonnade, and
  // close enough to the altar to take what it holds. The hall is sealed: no
  // step, no dash and no shove can put them outside its walls or under its floor.
  const IN_X = HALF_W - 220, IN_BACK = 150, IN_FRONT = 220;
  const DAIS_R = 250;

  let halls = {};               // built rooms, by shrine id
  let inside = null;            // the hall the walker is standing in
  let cine = null;              // the waking film
  let flashEl = null;

  function glowSprite(colour, size, opacity) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(32, 32, 1, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), color: colour, transparent: true,
      opacity: opacity == null ? 0.7 : opacity, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    sp.scale.setScalar(size);
    return sp;
  }

  // Old stone with carved seams, mottling and a faint inlaid sigil — the hall's
  // walls are read close up, so a flat colour would give it away at once.
  function stoneTex(base, line, repeat) {
    const s = 256, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const x = cv.getContext('2d');
    x.fillStyle = base;
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 1200; i++) {
      const r = 1.5 + Math.random() * 8;
      x.fillStyle = 'rgba(0,0,0,' + (0.02 + Math.random() * 0.08).toFixed(3) + ')';
      x.beginPath(); x.arc(Math.random() * s, Math.random() * s, r, 0, 6.283); x.fill();
    }
    for (let i = 0; i < 260; i++) {
      x.fillStyle = 'rgba(255,255,255,' + (0.01 + Math.random() * 0.03).toFixed(3) + ')';
      x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 4, 0, 6.283); x.fill();
    }
    x.strokeStyle = 'rgba(0,0,0,0.5)';
    x.lineWidth = 3;
    x.strokeRect(0, 0, s, s);
    x.beginPath();
    x.moveTo(s / 2, 0); x.lineTo(s / 2, s);
    x.moveTo(0, s / 2); x.lineTo(s, s / 2);
    x.stroke();
    x.strokeStyle = line;
    x.globalAlpha = 0.55;
    x.lineWidth = 2.5;
    x.beginPath(); x.arc(s / 2, s / 2, s * 0.3, 0, 6.283); x.stroke();
    x.beginPath(); x.arc(s / 2, s / 2, s * 0.17, 0, 6.283); x.stroke();
    x.globalAlpha = 1;
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    return t;
  }

  function buildHall(id, def) {
    const plan = HALLS[id] || HALLS.root;
    const x0 = def.x + 30000, z0 = def.z;
    const g = new THREE.Group();
    const hexLine = '#' + plan.colour.toString(16).padStart(6, '0');

    const stone = new THREE.MeshStandardMaterial({
      color: plan.stone, roughness: 0.95, metalness: 0.04, flatShading: false
    });
    const floorMat = new THREE.MeshStandardMaterial({
      map: stoneTex('#2b2f2c', hexLine, [7, 20]), color: 0x8f9a92, roughness: 0.9, metalness: 0.06
    });
    const wallMat = new THREE.MeshStandardMaterial({
      map: stoneTex('#22261f', hexLine, [3, 14]), color: 0x8a938c, roughness: 0.96, metalness: 0.03
    });
    const trim = new THREE.MeshBasicMaterial({
      color: plan.colour, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false
    });

    // the floor, the walls and the dark above
    const floor = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2 + 120, 60, LEN + 200), floorMat);
    floor.position.set(x0, HALL_Y - 30, z0 - LEN / 2);
    floor.receiveShadow = true;
    g.add(floor);

    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(70, CEIL + 120, LEN + 200), wallMat);
      wall.position.set(x0 + s * (HALF_W + 35), HALL_Y + CEIL / 2, z0 - LEN / 2);
      g.add(wall);
      // a rune band running the length of the hall, and a low plinth under it
      const band = new THREE.Mesh(new THREE.BoxGeometry(10, 16, LEN + 40), trim);
      band.position.set(x0 + s * (HALF_W - 6), HALL_Y + 150, z0 - LEN / 2);
      g.add(band);
      const band2 = new THREE.Mesh(new THREE.BoxGeometry(6, 6, LEN + 40), trim);
      band2.position.set(x0 + s * (HALF_W - 6), HALL_Y + 268, z0 - LEN / 2);
      g.add(band2);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(46, 44, LEN + 60), stone);
      plinth.position.set(x0 + s * (HALF_W - 30), HALL_Y + 22, z0 - LEN / 2);
      g.add(plinth);
    }

    // the far wall, and the door wall the walker came in through — the hall is
    // sealed on every side, so nothing can step out of it
    const back = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2 + 140, CEIL + 120, 80), wallMat);
    back.position.set(x0, HALL_Y + CEIL / 2, z0 - LEN - 40);
    g.add(back);
    const front = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2 + 140, CEIL + 120, 80), wallMat);
    front.position.set(x0, HALL_Y + CEIL / 2, z0 + 40);
    g.add(front);
    const door = new THREE.Mesh(new THREE.BoxGeometry(360, 330, 26), stone);
    door.position.set(x0, HALL_Y + 165, z0 - 4);
    g.add(door);
    const doorSeal = new THREE.Mesh(new THREE.RingGeometry(70, 132, 6), trim);
    doorSeal.position.set(x0, HALL_Y + 165, z0 - 20);
    doorSeal.rotation.z = Math.PI / 6;
    g.add(doorSeal);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2 + 140, 60, LEN + 200), stone);
    roof.position.set(x0, HALL_Y + CEIL + 30, z0 - LEN / 2);
    g.add(roof);

    // the hall's own light: cold and close, so the stone keeps its shadows
    const amb = new THREE.AmbientLight(plan.colour, 0.16);
    amb.position.set(x0, HALL_Y + 200, z0 - LEN / 2);
    g.add(amb);

    // the colonnade, and a burning bowl every fourth pillar
    const lights = [];
    const flames = [];
    for (let z = z0 - 380; z > z0 - LEN + 120; z -= 460) {
      for (const s of [-1, 1]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(46, 54, CEIL, 10), stone);
        col.position.set(x0 + s * (HALF_W - 130), HALL_Y + CEIL / 2, z);
        g.add(col);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(130, 30, 130), stone);
        cap.position.set(x0 + s * (HALF_W - 130), HALL_Y + CEIL - 10, z);
        g.add(cap);
        const base = new THREE.Mesh(new THREE.BoxGeometry(140, 34, 140), stone);
        base.position.set(x0 + s * (HALF_W - 130), HALL_Y + 17, z);
        g.add(base);
        // a rune ring cut into the shaft
        const ring = new THREE.Mesh(new THREE.TorusGeometry(48, 4, 6, 24), trim);
        ring.position.set(x0 + s * (HALF_W - 130), HALL_Y + 150, z);
        ring.rotation.x = Math.PI / 2;
        g.add(ring);
      }

      // a brazier between the pillars: bowl, coals, flame, and its own light
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(56, 34, 60, 10), stone);
      bowl.position.set(x0, HALL_Y + 30, z);
      g.add(bowl);
      const fire = glowSprite(plan.colour, 300, 0.5);
      fire.position.set(x0, HALL_Y + 96, z);
      g.add(fire);
      const core = glowSprite(0xfff2cf, 110, 0.85);
      core.position.set(x0, HALL_Y + 84, z);
      g.add(core);
      const lamp = new THREE.PointLight(plan.colour, 1.5, 1600, 1.7);
      lamp.position.set(x0, HALL_Y + 150, z);
      g.add(lamp);
      lights.push({ mesh: fire, phase: lights.length, core: core });
      flames.push(core);
    }

    // dust and embers hanging in the air — the hall is never quite still
    const motes = new THREE.Group();
    for (let i = 0; i < 46; i++) {
      const m = glowSprite(plan.colour, 12 + Math.random() * 16, 0.22 + Math.random() * 0.3);
      m.position.set(
        x0 + (Math.random() - 0.5) * (HALF_W * 1.8),
        HALL_Y + 20 + Math.random() * (CEIL - 60),
        z0 - 200 - Math.random() * (LEN - 400)
      );
      motes.add(m);
    }
    g.add(motes);

    // the altar at the far end, and the elixir standing on it
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(250, 280, 60, 18), stone);
    dais.position.set(x0, HALL_Y + 30, z0 - LEN + 380);
    g.add(dais);
    const step = new THREE.Mesh(new THREE.CylinderGeometry(320, 340, 24, 20), stone);
    step.position.set(x0, HALL_Y + 12, z0 - LEN + 380);
    g.add(step);

    // the seal carved into the floor around the dais
    const seal = new THREE.Mesh(new THREE.RingGeometry(330, 380, 40, 1), trim);
    seal.position.set(x0, HALL_Y + 2, z0 - LEN + 380);
    seal.rotation.x = -Math.PI / 2;
    g.add(seal);
    const seal2 = new THREE.Mesh(new THREE.RingGeometry(300, 316, 6, 1), trim);
    seal2.position.set(x0, HALL_Y + 3, z0 - LEN + 380);
    seal2.rotation.x = -Math.PI / 2;
    g.add(seal2);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(54, 76, 130, 8), stone);
    pedestal.position.set(x0, HALL_Y + 125, z0 - LEN + 380);
    g.add(pedestal);
    const vial = new THREE.Mesh(new THREE.OctahedronGeometry(46, 1),
      new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffd27a, emissiveIntensity: 2.2, roughness: 0.2 }));
    vial.position.set(x0, HALL_Y + 260, z0 - LEN + 380);
    g.add(vial);
    const vialGlow = glowSprite(0xffd27a, 340, 0.75);
    vialGlow.position.copy(vial.position);
    g.add(vialGlow);
    const altarLight = new THREE.PointLight(0xffd27a, 2.4, 1500, 1.6);
    altarLight.position.set(x0, HALL_Y + 300, z0 - LEN + 380);
    g.add(altarLight);
    const altarHalo = glowSprite(0xffd27a, 620, 0.22);
    altarHalo.position.set(x0, HALL_Y + 190, z0 - LEN + 380);
    g.add(altarHalo);

    C.scene.add(g);

    // the walls stop the walker the way the vale's own walls do
    const colliders = (C.quest && C.quest.state && C.quest.state.town && C.quest.state.town.colliders) || null;
    if (colliders) {
      for (let z = z0; z > z0 - LEN - 60; z -= 130) {
        for (const s of [-1, 1]) colliders.push({ x: x0 + s * (HALF_W + 30), z: z, r: 90 });
      }
      colliders.push({ x: x0, z: z0 - LEN - 40, r: 90 });
      colliders.push({ x: x0, z: z0 + 40, r: 90 });
      // the colonnade is solid too
      for (let z = z0 - 380; z > z0 - LEN + 120; z -= 460) {
        for (const s of [-1, 1]) colliders.push({ x: x0 + s * (HALF_W - 130), z: z, r: 60 });
      }
    }

    const hall = {
      id: id, def: def, plan: plan, group: g, x0: x0, z0: z0, lights: lights,
      motes: motes, seal: seal, seal2: seal2, flames: flames,
      vial: vial, vialGlow: vialGlow, altar: { x: x0, z: z0 - LEN + 380 },
      gates: [z0 - 780, z0 - 1600, z0 - 2400], next: 0, taken: false, mobs: [],
      savedFog: null
    };
    halls[id] = hall;
    return hall;
  }

  C.interiorFloor = function (x, z) {
    if (!inside) return null;
    if (Math.abs(x - inside.x0) > HALF_W + 60) return null;
    if (z > inside.z0 + 40 || z < inside.z0 - LEN - 80) return null;
    // the dais is a step up, so the altar can be walked to rather than stood in
    const dx = x - inside.altar.x, dz = z - inside.altar.z;
    if (dx * dx + dz * dz < DAIS_R * DAIS_R) return HALL_Y + 60;
    return HALL_Y;
  };

  /* ---- the waking film ------------------------------------------------ */
  function flash() {
    if (!flashEl) {
      flashEl = document.createElement('div');
      flashEl.style.cssText = 'position:fixed;inset:0;z-index:26500;pointer-events:none;opacity:0;' +
        'transition:opacity .5s ease;background:radial-gradient(circle at 50% 45%, #fffdf2, #ffe9b0 60%, #f4d489 100%)';
      document.body.appendChild(flashEl);
    }
    flashEl.style.opacity = '1';
    setTimeout(() => { if (flashEl) flashEl.style.opacity = '0'; }, 420);
  }

  function wake(def) {
    if (cine || inside) return;
    const s = C.quest.state.town && C.quest.state.town.shrines[def.id];
    const eye = C.player();
    const look = C.getLook ? C.getLook() : { yaw: 0, pitch: 0.05 };
    const dx = def.x - eye.x, dz = def.z - eye.z;
    const dist = Math.hypot(dx, dz) || 1;
    const yaw1 = Math.atan2(-dx, -dz);
    // the orb hangs 250 units up: the eye rises to it
    const pitch1 = -Math.atan2(250 - 128, Math.max(160, dist));

    let beam = null;
    if (C.scene && s) {
      beam = new THREE.Mesh(
        new THREE.CylinderGeometry(70, 150, 1200, 14, 1, true),
        new THREE.MeshBasicMaterial({
          color: def.color, transparent: true, opacity: 0, depthWrite: false,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide
        })
      );
      beam.position.set(def.x, C.groundAt ? C.groundAt(def.x, def.z) + 250 + 600 : 850, def.z);
      C.scene.add(beam);
    }

    cine = {
      t: 0, def: def, shrine: s, beam: beam, flashed: false,
      yaw0: look.yaw, yaw1: yaw1, pitch0: look.pitch, pitch1: pitch1
    };
    if (C.freeze) C.freeze(true);
    if (C.hud) C.hud.cinematic(true);
  }

  function endCine() {
    const def = cine.def;
    if (cine.beam && cine.beam.parent) {
      cine.beam.parent.remove(cine.beam);
      cine.beam.geometry.dispose();
      cine.beam.material.dispose();
    }
    cine = null;
    if (C.hud) C.hud.cinematic(false);
    enter(def);
    if (C.freeze) C.freeze(false);
  }

  /* ---- the hall itself ------------------------------------------------ */
  function enter(def) {
    const hall = halls[def.id] || buildHall(def.id, def);
    inside = hall;
    hall.next = 0;
    hall.taken = false;
    hall.vial.visible = true;
    hall.vialGlow.visible = true;
    hall.mobs.length = 0;

    // the vale's pale daylight would wash the hall flat: it gets its own air
    if (C.scene) {
      hall.savedFog = C.scene.fog || null;
      C.scene.fog = new THREE.Fog(hall.plan.air, 1400, 5600);
    }

    // set down just inside the door, facing the altar
    if (C.place) C.place(hall.x0, hall.z0 - 220);
    // facing the altar at the far end of the hall
    if (C.setLook) C.setLook(0, 0.05);
    if (C.hud) {
      C.hud.banner(hall.plan.name, 'Something still walks these stones');
      C.hud.prompt('');
    }
    spawnWave(hall);
  }

  function spawnWave(hall) {
    const kinds = hall.plan.waves[hall.next] || [];
    hall.next++;
    kinds.forEach((kind, i) => {
      const z = hall.z0 - 700 - hall.next * 320 - i * 90;
      const x = hall.x0 + (i % 2 === 0 ? -240 : 240) + (i - 1) * 40;
      const e = C.monsters.make(kind, x, z, { x: x, z: z });
      e.hall = true;
      e.y = HALL_Y;
      e.mesh.position.set(x, HALL_Y, z);
      hall.mobs.push(e);
      C.quest.state.enemies.push(e);
      C.scene.add(e.mesh);
    });
    if (kinds.length && hall.next > 1) C.hud.banner('The hall stirs', hall.plan.name);
  }

  function clearMobs(hall) {
    hall.mobs.forEach((e) => {
      if (!e.dead) {
        e.dead = true;
        C.scene.remove(e.mesh);
      }
      const i = C.quest.state.enemies.indexOf(e);
      if (i >= 0) C.quest.state.enemies.splice(i, 1);
    });
    hall.mobs.length = 0;
  }

  function leave(died) {
    if (!inside) return;
    const hall = inside;
    clearMobs(hall);
    inside = null;
    if (C.scene) {
      C.scene.fog = hall.savedFog;
      hall.savedFog = null;
    }
    const def = hall.def;
    if (C.teleport) C.teleport(def.x + 210, def.z + 210);
    if (C.hud) {
      C.hud.prompt('');
      if (!died) C.hud.banner('The shrine lets you out', def.name);
    }
  }

  function takeElixir() {
    const hall = inside;
    if (!hall || hall.taken) return;
    hall.taken = true;
    hall.vial.visible = false;
    hall.vialGlow.visible = false;
    const def = hall.def;
    leave(false);
    if (C.quest && C.quest.elixir) C.quest.elixir(def.id);
  }

  function tick(dt, player) {
    if (cine) {
      const c = cine;
      c.t += dt;
      const u = Math.min(1, c.t / 1.1);
      const e = u * u * (3 - 2 * u);
      if (C.setLook) C.setLook(c.yaw0 + (c.yaw1 - c.yaw0) * e, c.pitch0 + (c.pitch1 - c.pitch0) * e);

      const w = Math.min(1, Math.max(0, (c.t - 0.6) / 1.9));
      if (c.shrine) {
        c.shrine.orb.material.emissiveIntensity = 0.1 + w * 2.4;
        c.shrine.rune.material.emissiveIntensity = 0.45 + w * 1.7;
        if (c.shrine.halo) c.shrine.halo.material.opacity = 0.16 + w * 0.8;
        c.shrine.orb.rotation.y += dt * (0.35 + w * 4);
      }
      if (c.beam) {
        c.beam.scale.y = 0.08 + w;
        c.beam.position.y = (C.groundAt ? C.groundAt(c.def.x, c.def.z) : 0) + 250 + 600 * (0.08 + w);
        c.beam.material.opacity = w * 0.5;
      }
      if (c.t > 3.1 && !c.flashed) { c.flashed = true; flash(); }
      if (c.t > 3.9) endCine();
      return;
    }

    if (!inside) return;
    const hall = inside;
    const now = performance.now() / 1000;

    // the elixir turns on its pedestal
    if (hall.vial.visible) {
      hall.vial.rotation.y += dt * 1.4;
      hall.vial.position.y = HALL_Y + 260 + Math.sin(performance.now() / 620) * 14;
      hall.vialGlow.position.copy(hall.vial.position);
    }
    hall.lights.forEach((l) => {
      const k = 0.8 + 0.2 * Math.sin(now * 2.4 + l.phase * 1.7) * Math.sin(now * 0.9 + l.phase);
      l.mesh.material.opacity = 0.42 * k + 0.16;
      if (l.core) l.core.material.opacity = 0.7 + 0.3 * k;
    });
    // dust drifting up through the lamp light
    hall.motes.children.forEach((m, i) => {
      m.position.y += dt * (7 + (i % 5) * 3);
      if (m.position.y > HALL_Y + CEIL - 40) m.position.y = HALL_Y + 20;
    });
    hall.seal.rotation.z += dt * 0.22;
    hall.seal2.rotation.z -= dt * 0.4;

    // the hall answers the walker's advance with more of its dead
    const z = player.z;
    if (hall.next < hall.plan.waves.length && z < hall.gates[hall.next]) spawnWave(hall);
  }

  C.shrine = {
    activate: wake,
    tick: tick,
    active: () => !!inside,
    leave: leave,
    // Keeps the walker inside the stone. Called on every step, before the eye
    // is placed, so nothing can carry them through a wall or off the floor.
    clamp(P) {
      if (!inside) return;
      const h = inside;
      if (P.x < h.x0 - IN_X) P.x = h.x0 - IN_X;
      if (P.x > h.x0 + IN_X) P.x = h.x0 + IN_X;
      if (P.z > h.z0 - IN_BACK) P.z = h.z0 - IN_BACK;
      if (P.z < h.z0 - LEN + IN_FRONT) P.z = h.z0 - LEN + IN_FRONT;
      if (P.y < HALL_Y - 2) { P.y = HALL_Y; P.vy = 0; P.onGround = true; }
    },
    prompt(player) {
      if (!inside || inside.taken) return null;
      const dx = player.x - inside.altar.x, dz = player.z - inside.altar.z;
      return dx * dx + dz * dz < 240 * 240 ? 'Take the Elixir of Energy' : null;
    },
    use(player) {
      if (!inside || inside.taken) return false;
      const dx = player.x - inside.altar.x, dz = player.z - inside.altar.z;
      if (dx * dx + dz * dz > 240 * 240) return false;
      takeElixir();
      return true;
    },
    reset() {
      Object.keys(halls).forEach((k) => {
        const h = halls[k];
        if (h.group && h.group.parent) h.group.parent.remove(h.group);
        delete halls[k];
      });
      inside = null;
      cine = null;
      if (flashEl && flashEl.parentNode) flashEl.parentNode.removeChild(flashEl);
      flashEl = null;
    }
  };
})();
