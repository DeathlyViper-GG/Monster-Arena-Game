/* Crysto — the sanctums.
   Waking a shrine no longer just lights it: the stone opens and puts you in a
   sealed room built for the thing that guards it, with its own floor, its own
   light and its own boss. Break the guardian and the room sends you back to the
   shrine it belongs to, awake, with the gun it was carrying. */
(function () {
  const C = (window.Crysto = window.Crysto || {});

  const ROOMS = {
    root: {
      name: 'The Root Sanctum', boss: 'elem-quake', bossName: 'The Rootbound Colossus',
      colour: 0x7dffa3, glow: 0x9cffc0, stone: 0x4a5442, hp: 820, gun: 'rifle',
      floorText: 'Root'
    },
    ember: {
      name: 'The Ember Sanctum', boss: 'elem-fire', bossName: 'The Cinder Sovereign',
      colour: 0xff9a5c, glow: 0xffb070, stone: 0x54463a, hp: 1300, gun: 'scatter',
      floorText: 'Ember'
    },
    tide: {
      name: 'The Tide Sanctum', boss: 'elem-rime', bossName: 'The Rime Warden',
      colour: 0x6fd0ff, glow: 0x9fe3ff, stone: 0x3a4a52, hp: 1600, gun: 'storm',
      floorText: 'Tide'
    }
  };

  const R_FLOOR = 560, R_WALL = 640;
  let built = null;         // { id: {group, site, braziers[]} }
  let active = null;        // the room being fought in
  let bossRef = null;
  let onWin = null;
  let backTo = null;
  let winT = 0;

  function glowRing(r, colour, opacity) {
    return new THREE.Mesh(
      new THREE.RingGeometry(r * 0.86, r, 64, 1),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: opacity || 0.5, side: THREE.DoubleSide, depthWrite: false })
    );
  }

  function buildRoom(def, site, colliders) {
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: def.stone, roughness: 0.94, metalness: 0.04, flatShading: true });

    const floor = new THREE.Mesh(new THREE.CircleGeometry(R_FLOOR, 56), stone);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(site.x, site.y + 1, site.z);
    floor.receiveShadow = true;
    g.add(floor);

    // the sigil of the shrine, inlaid in the floor
    const sigil = glowRing(R_FLOOR * 0.62, def.colour, 0.34);
    sigil.rotation.x = -Math.PI / 2;
    sigil.position.set(site.x, site.y + 3, site.z);
    g.add(sigil);
    const inner = glowRing(R_FLOOR * 0.3, def.glow, 0.5);
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(site.x, site.y + 3.4, site.z);
    g.add(inner);

    // a wall of standing stones right round the room
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const x = site.x + Math.cos(a) * R_WALL;
      const z = site.z + Math.sin(a) * R_WALL;
      const h = 190 + ((i * 47) % 120);
      const block = new THREE.Mesh(new THREE.BoxGeometry(150, h, 90), stone);
      block.position.set(x, site.y + h / 2 - 20, z);
      block.rotation.y = -a + Math.PI / 2;
      block.castShadow = true;
      g.add(block);
      colliders.push({ x: x, z: z, r: 78 });
    }

    // pillars inside, each with a burning crown
    const lights = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const x = site.x + Math.cos(a) * R_FLOOR * 0.78;
      const z = site.z + Math.sin(a) * R_FLOOR * 0.78;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(34, 40, 300, 10), stone);
      col.position.set(x, site.y + 150, z);
      col.castShadow = true;
      g.add(col);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(96, 26, 96), stone);
      cap.position.set(x, site.y + 310, z);
      g.add(cap);
      const fire = new THREE.Mesh(
        new THREE.SphereGeometry(20, 10, 8),
        new THREE.MeshBasicMaterial({ color: def.glow, transparent: true, opacity: 0.9 })
      );
      fire.position.set(x, site.y + 340, z);
      g.add(fire);
      lights.push({ mesh: fire, base: site.y + 340, phase: i });
      colliders.push({ x: x, z: z, r: 46 });
    }

    // one light for the whole room: the element's own colour
    const lamp = new THREE.PointLight(def.colour, 1.5, 2400, 1.6);
    lamp.position.set(site.x, site.y + 420, site.z);
    g.add(lamp);

    g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    return { group: g, site: site, def: def, lights: lights, sigil: sigil };
  }

  const room = {
    build(scene, colliders) {
      if (built) return built;
      built = {};
      const sites = C.sanctums || {};
      Object.keys(ROOMS).forEach((id) => {
        const site = sites[id];
        if (!site) return;
        built[id] = buildRoom(ROOMS[id], site, colliders);
        scene.add(built[id].group);
        if (C.keepClear) C.keepClear.push({ x: site.x, z: site.z, r: 1000 });
      });
      return built;
    },

    ready(id) { return !!(built && built[id]); },

    // Leaving Crysto (or coming back in) throws the rooms away: the next visit
    // builds them into the new scene.
    reset() {
      if (C.bossattacks) C.bossattacks.clear();
      active = null;
      bossRef = null;
      onWin = null;
      winT = 0;
      built = null;
      if (C.hud && C.hud.setBoss) C.hud.setBoss(null);
    },

    active() { return active; },

    enter(id, done) {
      if (!built || !built[id]) return false;
      if (active) return false;
      const r = built[id];
      const def = r.def;
      const site = r.site;
      active = id;
      onWin = done || null;
      bossRef = null;
      winT = 0;

      const shrine = (C.places.shrines || []).find((s) => s.id === id);
      backTo = shrine ? { x: shrine.x, z: shrine.z } : { x: 0, z: -150 };

      C.teleport(site.x, site.z - R_FLOOR * 0.42);
      C.hud.banner(def.name, 'The guardian of ' + def.floorText + ' wakes');
      if (C.hud.setBoss) C.hud.setBoss(def.bossName, 1);

      const e = C.monsters.make(def.boss, site.x, site.z + 240, { x: site.x, z: site.z }, {
        boss: true, big: 1.9, hp: def.hp
      });
      e.shrineBoss = id;
      bossRef = e;
      C.quest.state.enemies.push(e);
      C.scene.add(e.mesh);
      // its own fighting pattern, not the generic elemental shot
      if (C.bossattacks) C.bossattacks.start(id, e, site);
      if (C.playFilm) {
        C.playFilm('guardian-' + id, () => C.hud.banner(def.bossName, 'The fight begins'));
      }
      if (C.save) C.save.auto();
      return true;
    },

    // Called from the quest the moment its guardian falls.
    won(id) {
      if (!active || active !== id) return false;
      const r = built[id];
      winT = 2.4;
      if (C.bossattacks) C.bossattacks.clear();
      if (C.hud.setBoss) C.hud.setBoss(r.def.bossName, 0);
      C.hud.banner(r.def.bossName + ' falls', 'The sanctum opens');
      C.weapons.give(r.def.gun);
      C.reward(220);
      if (C.save) C.save.auto();
      return true;
    },

    // Thrown out of the room without winning it: the guardian stays where it is.
    abandon() {
      if (!active) return;
      if (C.bossattacks) C.bossattacks.clear();
      active = null;
      onWin = null;
      winT = 0;
      if (bossRef) {
        bossRef.dead = true;
        if (bossRef.mesh && bossRef.mesh.parent) bossRef.mesh.parent.remove(bossRef.mesh);
      }
      bossRef = null;
      if (C.hud.setBoss) C.hud.setBoss(null);
      if (backTo) C.teleport(backTo.x, backTo.z);
      backTo = null;
    },

    leave() {
      if (!active) return;
      if (C.bossattacks) C.bossattacks.clear();
      const id = active;
      active = null;
      bossRef = null;
      if (C.hud.setBoss) C.hud.setBoss(null);
      if (backTo) C.teleport(backTo.x, backTo.z);
      backTo = null;
      const done = onWin;
      onWin = null;
      if (done) done(id);
    },

    update(dt, now) {
      if (!built) return;
      Object.keys(built).forEach((k) => {
        built[k].lights.forEach((l) => {
          l.mesh.scale.setScalar(0.85 + Math.sin(now * 3 + l.phase) * 0.18);
        });
      });
      if (!active) return;
      if (C.bossattacks) C.bossattacks.update(dt);
      if (bossRef && !bossRef.dead) {
        if (C.hud.setBoss) {
          C.hud.setBoss(
            built[active].def.bossName,
            Math.max(0, bossRef.hp / bossRef.maxHp),
            C.bossattacks ? C.bossattacks.move() : ''
          );
        }
      } else if (winT > 0) {
        winT -= dt;
        if (winT <= 0) room.leave();
      }
    }
  };

  C.bossroom = room;
})();
