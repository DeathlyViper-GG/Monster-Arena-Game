/* Crysto — the Hollow Reach: the continent beyond the water.
   Its own doorways, its own weather and its own ledger. Everything here is
   built when the vale is, so stepping through the doorway is a step, not a
   load. */
(function () {
  const C = (window.Crysto = window.Crysto || {});
  const R = (C.reach = C.reach || {});

  const KEY = 'crysto_reach_v1';
  // The far side of the doorway: the landing on the Reach's northern shore.
  const LANDING = { x: 0, z: 31120 };
  const DOOR_FAR = { x: 0, z: 30700 };
  // The near side: an arch on the green in Drane Vale.
  const DOOR_HOME = { x: 430, z: -450 };

  let built = false, doorHome = null, doorFar = null;
  let inside = false, activeRegion = null, fog0 = null, sun0 = null;

  const LANDSCAPES = {
    shore: { name: 'The Ashen Shore', fog: 0xa8896f, sun: 0xffb489, power: 1.02, line: 'Where the old road meets the sea' },
    pine: { name: 'Blackpine', fog: 0x66745f, sun: 0xd8d5a5, power: 0.82, line: 'The pines keep their own dark' },
    ember: { name: 'The Ember Wastes', fog: 0x956b59, sun: 0xffa05d, power: 1.08, line: 'Ash still glows beneath the stone' },
    mire: { name: 'The Drowned Mire', fog: 0x766c7d, sun: 0xd8b9b0, power: 0.72, line: 'The drowned road remembers every name' },
    crown: { name: 'The Bone Crown', fog: 0xa6a7a5, sun: 0xffe1b5, power: 1.16, line: 'Something old is stirring above the Reach' }
  };

  R.LANDING = LANDING;
  R.inside = (p) => !!p && p.z > 27000;

  R.build = function (scene, colliders) {
    built = true;
    // a fresh world: the weather of the last visit is not carried over
    inside = false;
    activeRegion = null;
    fog0 = null;
    sun0 = null;
    R.buildVillages(scene, colliders || []);
    R.buildPaths(scene);
    R.buildCamps(scene);
    R.buildBroods(scene);
    R.people.build(scene);
    doorHome = R.props.doorway(DOOR_HOME.x, DOOR_HOME.z, Math.atan2(DOOR_HOME.x, DOOR_HOME.z), 0x6fd0ff);
    doorFar = R.props.doorway(DOOR_FAR.x, DOOR_FAR.z, 0, 0xff9a5c);
    scene.add(doorHome.group);
    scene.add(doorFar.group);
    R.restore();
  };

  /* ---- the weather of the Reach -----------------------------------------
     The vale's sky is a pale cold haze; the Reach is ash and low red light.
     Only the two things that read across the whole view are changed, and only
     while the walker is actually over there. */
  function atmosphere(on, player) {
    const fog = C.scene && C.scene.fog;
    if (fog) {
      if (on) {
        if (!fog0) fog0 = { color: fog.color.getHex(), near: fog.near, far: fog.far };
        fog.color.setHex(LANDSCAPES.shore.fog);
        fog.near = 470;
        fog.far = 3400;
      } else if (fog0) {
        fog.color.setHex(fog0.color);
        fog.near = fog0.near;
        fog.far = fog0.far;
      }
    }
    const sun = C.terrain && C.terrain.sun;
    if (sun) {
      if (on) {
        if (!sun0) sun0 = { color: sun.color.getHex(), power: sun.intensity };
        sun.color.setHex(LANDSCAPES.shore.sun);
        sun.intensity = LANDSCAPES.shore.power;
      } else if (sun0) {
        sun.color.setHex(sun0.color);
        sun.intensity = sun0.power;
      }
    }
    if (C.terrain && C.terrain.setMood) C.terrain.setMood(on ? 'shore' : 'vale');
    activeRegion = on ? 'shore' : null;
    if (!player) return;
    if (on) {
      C.hud.banner('The Hollow Reach', 'The land under the ice');
      if (C.save) C.save.auto();
    } else {
      C.hud.banner('Drane Vale', 'The vale of the Sunstone');
    }

  }

  function applyLandscape(region) {
    const mood = LANDSCAPES[region];
    if (!mood) return;
    if (C.scene && C.scene.fog) {
      C.scene.fog.color.setHex(mood.fog);
      C.scene.fog.near = region === 'mire' ? 360 : 470;
      C.scene.fog.far = region === 'crown' ? 4200 : 3400;
    }
    if (C.terrain && C.terrain.sun) {
      C.terrain.sun.color.setHex(mood.sun);
      C.terrain.sun.intensity = mood.power;
    }
    if (C.terrain && C.terrain.setMood) C.terrain.setMood(region);
    if (C.hud) C.hud.banner(mood.name, mood.line);
  }

  R.enter = function () {
    if (!built) return;
    C.teleport(LANDING.x, LANDING.z);
    C.setLook(Math.PI, 0.04);
    const p = C.player();
    p.respawn = { x: LANDING.x, z: LANDING.z };
    inside = true;
    atmosphere(true, p);
  };

  R.leave = function () {
    if (!built) return;
    C.teleport(DOOR_HOME.x, DOOR_HOME.z + 260);
    C.setLook(0, 0.04);
    const p = C.player();
    p.respawn = { x: 0, z: -150 };
    inside = false;
    atmosphere(false, p);
  };

  /* ---- what the walker could do right here ------------------------------ */
  R.target = function (player) {
    if (!built) return null;
    const near = (p, r) => {
      const dx = player.x - p.x, dz = player.z - p.z;
      return dx * dx + dz * dz < r * r;
    };
    if (R.inside(player)) {
      if (doorFar && near(doorFar.pos, 250)) {
        return { kind: 'door', label: 'Step back to Drane Vale', run: () => R.leave() };
      }
      return R.people.target(player);
    }
    if (doorHome && near(doorHome.pos, 250)) {
      return { kind: 'door', label: 'Step into the Hollow Doorway', run: () => R.enter() };
    }
    return null;
  };

  R.tracker = function () { return R.people.tracker(); };

  R.tick = function (dt, player) {
    if (!built) return;
    R.people.tick(dt, player);
    R.tickCamps(dt, player);
    if (R.tickBroods) R.tickBroods(dt, player);
    const now = R.inside(player);
    if (now !== inside) {
      inside = now;
      atmosphere(now, player);
    }
    if (now && C.region) {
      const region = C.region(player.x, player.z);
      if (region !== activeRegion) {
        activeRegion = region;
        applyLandscape(region);
      }
    }
  };

  /* ---- the Reach remembers its own -------------------------------------- */
  R.save = function () {
    const broken = {};
    const discovered = [];
    (R.camps || []).forEach((c) => {
      if (c.broken) broken[c.id] = true;
      if (c.discovered) discovered.push(c.id);
    });
    try {
      localStorage.setItem(KEY, JSON.stringify({
        broken: broken,
        discovered: discovered,
        broods: (R.broods || []).filter((b) => b.cleared).map((b) => b.id),
        q: R.people.snapshot(), at: Date.now()
      }));
    } catch (_) {}
  };

  R.restore = function () {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
    if (!data) return;
    R.people.restore(data.q);
    Object.keys(data.broken || {}).forEach((id) => R.markBroken(id));
    (data.discovered || []).forEach((id) => R.markDiscovered(id));
    (data.broods || []).forEach((id) => R.markBrood(id));
  };

  R.clear = function () { try { localStorage.removeItem(KEY); } catch (_) {} };
})();
