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
  let inside = false, fog0 = null, sun0 = null;

  R.LANDING = LANDING;
  R.inside = (p) => !!p && p.z > 27000;

  R.build = function (scene, colliders) {
    built = true;
    // a fresh world: the weather of the last visit is not carried over
    inside = false;
    fog0 = null;
    sun0 = null;
    R.buildVillages(scene, colliders || []);
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
        fog.color.setHex(0xa8896f);
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
        sun.color.setHex(0xffb489);
        sun.intensity = 1.02;
      } else if (sun0) {
        sun.color.setHex(sun0.color);
        sun.intensity = sun0.power;
      }
    }
    if (C.terrain && C.terrain.setMood) C.terrain.setMood(on ? 'reach' : 'vale');
    if (!player) return;
    if (on) {
      C.hud.banner('The Hollow Reach', 'The land under the ice');
      if (C.save) C.save.auto();
    } else {
      C.hud.banner('Drane Vale', 'The vale of the Sunstone');
    }
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
  };

  /* ---- the Reach remembers its own -------------------------------------- */
  R.save = function () {
    const broken = {};
    (R.camps || []).forEach((c) => { if (c.broken) broken[c.id] = true; });
    try {
      localStorage.setItem(KEY, JSON.stringify({
        broken: broken,
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
    (data.broods || []).forEach((id) => R.markBrood(id));
  };

  R.clear = function () { try { localStorage.removeItem(KEY); } catch (_) {} };
})();
