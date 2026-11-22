/* Crysto — the people.
   Real bodies rather than stacked boxes: rounded limbs on real joints, a head
   that turns to whoever is talking, shoulders that rise with a breath and arms
   and legs that swing when they walk. Built from spheres and capsules so every
   silhouette reads as a person at a distance. */
(function () {
  const C = (window.Crysto = window.Crysto || {});

  const SKIN = [0xe6bd93, 0xd9a877, 0xc08a5c, 0x9a6b44, 0x6f4a30, 0xf0cfae];
  const CLOTH = [0x3f6b58, 0x6b4a3a, 0x4a5a76, 0x7a5a3a, 0x556b4a, 0x8a4a4a, 0x5a4a6b];
  const HAIR = [0x2c211a, 0x4a3423, 0x6b4a2a, 0x8a6a44, 0x1e1a18, 0xa8865a];

  function mat(color, rough, metal) {
    return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.85 : rough, metalness: metal || 0 });
  }

  // A limb segment: a cylinder with a ball at each end, so no edge is ever sharp.
  function bone(r, len, m) {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, len, 12), m);
    g.add(c);
    const a = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), m);
    a.position.y = len / 2;
    g.add(a);
    const b = new THREE.Mesh(new THREE.SphereGeometry(r * 0.92, 12, 9), m);
    b.position.y = -len / 2;
    g.add(b);
    return g;
  }

  function ball(r, m, sx, sy, sz) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
    s.scale.set(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz);
    return s;
  }

  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function make(o) {
    o = o || {};
    const H = o.height || 124;
    const skin = mat(o.skin || pick(SKIN), 0.72);
    const cloth = mat(o.cloth || pick(CLOTH), 0.93);
    const trouser = mat(o.trouser || 0x3a3630, 0.95);
    const hair = mat(o.hair || pick(HAIR), 0.95);
    const leather = mat(0x4a3524, 0.9);

    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    // ---- hips and torso: one rounded column, never a box ----
    const hips = ball(H * 0.105, cloth, 1.15, 0.9, 0.95);
    hips.position.y = H * 0.52;
    body.add(hips);

    const torso = new THREE.Group();
    torso.position.y = H * 0.62;
    body.add(torso);
    const trunk = bone(H * 0.105, H * 0.18, cloth);
    torso.add(trunk);
    const chest = ball(H * 0.125, cloth, 1.12, 0.95, 0.86);
    chest.position.y = H * 0.09;
    torso.add(chest);
    // a belt and a strap, so the body has a waist to read
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.108, H * 0.108, H * 0.032, 14), leather);
    belt.position.y = -H * 0.085;
    torso.add(belt);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.035, H * 0.042, H * 0.05, 10), skin);
    neck.position.y = H * 0.175;
    torso.add(neck);

    // ---- head ----
    const head = new THREE.Group();
    head.position.y = H * 0.245;
    torso.add(head);
    const skull = ball(H * 0.088, skin, 0.92, 1.04, 0.96);
    head.add(skull);
    const jaw = ball(H * 0.062, skin, 0.92, 0.82, 0.9);
    jaw.position.set(0, -H * 0.05, H * 0.012);
    head.add(jaw);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(H * 0.016, H * 0.036, 8), skin);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -H * 0.012, H * 0.085);
    head.add(nose);
    for (const s of [-1, 1]) {
      const eye = ball(H * 0.014, mat(0x2a2420, 0.5), 1, 1, 0.6);
      eye.position.set(s * H * 0.034, H * 0.014, H * 0.078);
      head.add(eye);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(H * 0.036, H * 0.008, H * 0.01), hair);
      brow.position.set(s * H * 0.034, H * 0.038, H * 0.08);
      brow.rotation.z = s * 0.12;
      head.add(brow);
      const ear = ball(H * 0.018, skin, 0.6, 1, 0.8);
      ear.position.set(s * H * 0.086, -H * 0.004, 0);
      head.add(ear);
    }
    // hair: a cap over the crown, longer at the back
    const cap = ball(H * 0.094, hair, 1, 0.95, 1);
    cap.position.y = H * 0.014;
    cap.scale.y = 0.86;
    head.add(cap);
    const back = ball(H * 0.078, hair, 1, 1.05, 0.7);
    back.position.set(0, -H * 0.03, -H * 0.03);
    head.add(back);
    if (o.hood) {
      const hood = ball(H * 0.135, mat(o.hoodColor || 0x27524a, 0.95), 1, 1.08, 1);
      hood.position.set(0, H * 0.01, -H * 0.012);
      head.add(hood);
      const brim = new THREE.Mesh(new THREE.TorusGeometry(H * 0.098, H * 0.016, 8, 18), mat(o.hoodColor || 0x27524a, 0.95));
      brim.rotation.x = 1.35;
      brim.position.set(0, H * 0.006, H * 0.05);
      head.add(brim);
    }

    // ---- arms, on real shoulder and elbow joints ----
    const arms = {};
    for (const s of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * H * 0.135, H * 0.145, 0);
      torso.add(shoulder);
      const deltoid = ball(H * 0.048, cloth, 1, 1, 1);
      shoulder.add(deltoid);
      const upper = bone(H * 0.038, H * 0.115, cloth);
      upper.position.y = -H * 0.07;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -H * 0.135;
      shoulder.add(elbow);
      const fore = bone(H * 0.032, H * 0.105, skin);
      fore.position.y = -H * 0.06;
      elbow.add(fore);
      const hand = ball(H * 0.037, skin, 1, 1.15, 0.9);
      hand.position.y = -H * 0.125;
      elbow.add(hand);
      shoulder.rotation.z = s * 0.13;
      elbow.rotation.x = -0.16;
      arms[s < 0 ? 'l' : 'r'] = { shoulder: shoulder, elbow: elbow };
    }

    // ---- legs ----
    const legs = {};
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * H * 0.062, H * 0.52, 0);
      body.add(hip);
      const thigh = bone(H * 0.05, H * 0.2, trouser);
      thigh.position.y = -H * 0.11;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -H * 0.235;
      hip.add(knee);
      const shin = bone(H * 0.04, H * 0.2, trouser);
      shin.position.y = -H * 0.105;
      knee.add(shin);
      const foot = ball(H * 0.05, leather, 0.9, 0.62, 1.5);
      foot.position.set(0, -H * 0.225, H * 0.018);
      knee.add(foot);
      legs[s < 0 ? 'l' : 'r'] = { hip: hip, knee: knee };
    }

    // ---- a robe for the warden: a lathed skirt that hides the legs ----
    if (o.robe) {
      const prof = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        prof.push(new THREE.Vector2(H * (0.105 + t * 0.1), -H * (0.02 + t * 0.5)));
      }
      const skirt = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), mat(o.cloth || 0x2f5f52, 0.95));
      skirt.position.y = H * 0.52;
      body.add(skirt);
      legs.l.hip.visible = false;
      legs.r.hip.visible = false;
    }

    root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

    const who = {
      group: root,
      height: H,
      pos: { x: 0, z: 0 },
      phase: Math.random() * 6.283,
      moving: false,
      target: null,
      speed: o.speed || 74,
      head: head,
      torso: torso,
      arms: arms,
      legs: legs,
      lookAt: 0,
      lookUp: 0
    };

    who.place = function (x, z) {
      who.pos.x = x;
      who.pos.z = z;
      root.position.set(x, C.height(x, z), z);
    };

    who.faceTo = function (x, z) {
      root.rotation.y = Math.atan2(x - who.pos.x, z - who.pos.z);
    };

    // Somewhere to be: walk to it, then idle until given another.
    who.walkTo = function (x, z) {
      who.target = { x: x, z: z };
    };

    who.update = function (dt, now, player) {
      let walking = false;
      if (who.target) {
        const dx = who.target.x - who.pos.x, dz = who.target.z - who.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 26) {
          who.target = null;
        } else {
          const step = Math.min(who.speed * dt, d);
          who.pos.x += (dx / d) * step;
          who.pos.z += (dz / d) * step;
          root.rotation.y = Math.atan2(dx, dz);
          walking = true;
        }
      }
      root.position.set(who.pos.x, C.height(who.pos.x, who.pos.z), who.pos.z);
      who.moving = walking;

      who.phase += dt * (walking ? 7.4 : 1.7);
      const sw = walking ? 0.62 : 0.05;
      arms.l.shoulder.rotation.x = Math.sin(who.phase) * sw;
      arms.r.shoulder.rotation.x = -Math.sin(who.phase) * sw;
      arms.l.elbow.rotation.x = -0.16 - Math.abs(Math.sin(who.phase)) * (walking ? 0.4 : 0.05);
      arms.r.elbow.rotation.x = -0.16 - Math.abs(Math.cos(who.phase)) * (walking ? 0.4 : 0.05);
      legs.l.hip.rotation.x = -Math.sin(who.phase) * sw * 1.15;
      legs.r.hip.rotation.x = Math.sin(who.phase) * sw * 1.15;
      legs.l.knee.rotation.x = Math.max(0, Math.sin(who.phase + 1.2)) * (walking ? 0.7 : 0.02);
      legs.r.knee.rotation.x = Math.max(0, Math.sin(who.phase + 1.2 + Math.PI)) * (walking ? 0.7 : 0.02);

      // breath
      const breath = 1 + Math.sin(now * 1.7 + who.phase * 0.2) * 0.022;
      torso.scale.set(1, breath, 1);

      // whoever is close gets looked at
      let wantYaw = 0, wantPitch = 0;
      if (player) {
        const dx = player.x - who.pos.x, dz = player.z - who.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 460) {
          const world = Math.atan2(dx, dz);
          wantYaw = world - root.rotation.y;
          while (wantYaw > Math.PI) wantYaw -= Math.PI * 2;
          while (wantYaw < -Math.PI) wantYaw += Math.PI * 2;
          wantYaw = Math.max(-0.85, Math.min(0.85, wantYaw));
          wantPitch = -0.06;
        }
      }
      who.lookAt += (wantYaw - who.lookAt) * Math.min(1, dt * 4);
      who.lookUp += (wantPitch - who.lookUp) * Math.min(1, dt * 4);
      head.rotation.y = who.lookAt;
      head.rotation.x = who.lookUp + Math.sin(now * 0.8 + who.phase) * 0.02;
    };

    return who;
  }

  /* ---- the vale's own people, walking its roads ------------------------ */
  function crowd(scene, paths, count) {
    const folk = [];
    const list = (paths && paths.length) ? paths : [{ x: 0, z: 0 }];
    for (let i = 0; i < (count || 8); i++) {
      const n = make({ height: 108 + Math.random() * 22, speed: 52 + Math.random() * 40 });
      const start = list[(Math.random() * list.length) | 0];
      n.place(start.x + (Math.random() - 0.5) * 90, start.z + (Math.random() - 0.5) * 90);
      n.idle = Math.random() * 4;
      scene.add(n.group);
      folk.push(n);
    }
    return {
      folk: folk,
      update(dt, now, player) {
        folk.forEach((n) => {
          if (!n.target) {
            n.idle -= dt;
            if (n.idle <= 0) {
              n.idle = 2 + Math.random() * 6;
              const t = list[(Math.random() * list.length) | 0];
              n.walkTo(t.x + (Math.random() - 0.5) * 120, t.z + (Math.random() - 0.5) * 120);
            }
          }
          n.update(dt, now, player);
        });
      }
    };
  }

  C.npc = { make: make, crowd: crowd };
})();
