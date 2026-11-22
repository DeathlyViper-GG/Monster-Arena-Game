/* Crysto — how the three sanctum guardians actually fight.
   Each one borrows the arsenal the walker carries, so the fight reads as a
   duel against someone with your own kit:

     The Rootbound Colossus  — melee. A telegraphed cleave, a triple Quake
                               Palm, and a charge that slams the floor.
     The Cinder Sovereign    — guns. Pistol volley, a reload window, a scatter
                               blast, a rifle burst, and a lobbed grenade.
     The Rime Warden         — utilities. Shock mines, a tar grenade, a smoke
                               step, and an iron ward that dulls your hits.

   Everything is telegraphed on the floor before it lands, and every effect is
   drawn from the same vocabulary the rest of Crysto uses (ground rings, orbs,
   bursts, tracers), so a sanctum never looks like a different game. */
(function () {
  const C = (window.Crysto = window.Crysto || {});
  const TAU = Math.PI * 2;

  let room = null;      // { id, boss, site, cycle }
  let queue = [];
  let move = null;      // the move playing right now
  let t = 0;
  let sub = 0;
  let aim = { x: 0, z: 1, a: 0 };
  let name = '';

  const fx = [];        // transient meshes
  const zones = [];     // telegraphed strikes
  const waves = [];     // expanding shock rings
  const bolts = [];     // tracers and lobbed grenades
  const mines = [];     // armed shock mines
  const pools = [];     // tar

  const rnd = (a, b) => a + Math.random() * (b - a);
  const P = () => (C.player ? C.player() : { x: 0, y: 0, z: 0 });
  const boss = () => (room ? room.boss : null);
  const ground = (x, z) => C.height(x, z);

  /* ------------------------------------------------------------ drawing */
  function mat(colour, opacity) {
    return new THREE.MeshBasicMaterial({
      color: colour, transparent: true, opacity: opacity == null ? 0.5 : opacity,
      side: THREE.DoubleSide, depthWrite: false
    });
  }

  function put(mesh, life, kind) {
    if (!C.scene) return mesh;
    C.scene.add(mesh);
    fx.push({ m: mesh, t: life, max: life, kind: kind || 'fade' });
    return mesh;
  }

  function flash(x, y, z, colour, size) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(size || 16, 8, 6), mat(colour, 0.95));
    m.position.set(x, y, z);
    put(m, 0.16, 'burst');
  }

  function burstAt(x, y, z, colour, size) {
    if (C.monsters && C.monsters.burst) { C.monsters.burst(x, y, z, colour, size || 30); return; }
    flash(x, y, z, colour, size || 30);
  }

  // Stone torn out of the floor by a heavy blow.
  function debris(x, z, colour, n, power) {
    if (!C.scene) return;
    const count = n || 8;
    const gy = ground(x, z);
    for (let i = 0; i < count; i++) {
      const size = 4 + Math.random() * 9;
      const m = new THREE.Mesh(
        new THREE.TetrahedronGeometry(size, 0),
        new THREE.MeshStandardMaterial({
          color: colour || 0x6d6a60, roughness: 0.95, flatShading: true, transparent: true, opacity: 1
        })
      );
      m.position.set(x + rnd(-26, 26), gy + 8, z + rnd(-26, 26));
      m.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
      C.scene.add(m);
      fx.push({
        m: m, t: 1.1, max: 1.1, kind: 'debris', gy: gy, spin: rnd(-9, 9),
        vx: rnd(-190, 190), vy: rnd(180, 430) * (power || 1), vz: rnd(-190, 190)
      });
    }
  }

  function puff(x, z) {
    const m = new THREE.Mesh(new THREE.RingGeometry(12, 24, 16), mat(0xd9cdb0, 0.5));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, ground(x, z) + 4, z);
    put(m, 0.3, 'fade');
  }

  function tickFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.t -= dt;
      const k = 1 - Math.max(0, f.t) / f.max;
      if (f.kind === 'debris') {
        // stone thrown by the blow: it arcs, bounces once, and fades
        f.vy -= 1400 * dt;
        f.m.position.x += f.vx * dt;
        f.m.position.y += f.vy * dt;
        f.m.position.z += f.vz * dt;
        f.m.rotation.x += f.spin * dt;
        f.m.rotation.z += f.spin * 0.7 * dt;
        if (f.m.position.y < f.gy + 3) {
          f.m.position.y = f.gy + 3;
          f.vy *= -0.34; f.vx *= 0.6; f.vz *= 0.6;
        }
        f.m.material.opacity = Math.max(0, f.t / f.max);
      }
      else if (f.kind === 'burst') { f.m.scale.setScalar(0.6 + k * 2.4); f.m.material.opacity = 0.95 * (1 - k); }
      else if (f.kind === 'smoke') { f.m.scale.setScalar(1 + k * 1.6); f.m.material.opacity = 0.3 * (1 - k); }
      else { f.m.material.opacity = (f.m.userData.o0 || 0.55) * (1 - k); }
      if (f.t <= 0) {
        if (C.scene) C.scene.remove(f.m);
        if (f.m.geometry) f.m.geometry.dispose();
        if (f.m.material) f.m.material.dispose();
        fx.splice(i, 1);
      }
    }
  }

  /* --------------------------------------------------- telegraphed strikes */
  function zone(o) {
    if (!C.scene) return;
    let geo;
    if (o.shape === 'sector') geo = new THREE.CircleGeometry(o.r, 28, o.a - Math.PI / 2 - o.half, o.half * 2);
    else if (o.shape === 'ring') geo = new THREE.RingGeometry(o.r * 0.78, o.r, 44, 1);
    else geo = new THREE.CircleGeometry(o.r, 40);
    const op = o.opacity || 0.34;
    const m = new THREE.Mesh(geo, mat(o.colour, op));
    m.userData.o0 = op;
    m.rotation.x = -Math.PI / 2;
    m.position.set(o.x, ground(o.x, o.z) + 5, o.z);
    C.scene.add(m);
    // the rim: the edge of the blow, drawn bright so the shape reads at a glance
    let rimGeo;
    if (o.shape === 'sector') rimGeo = new THREE.RingGeometry(o.r * 0.9, o.r, 44, 1, o.a - Math.PI / 2 - o.half, o.half * 2);
    else if (o.shape === 'ring') rimGeo = new THREE.RingGeometry(o.r * 0.96, o.r * 1.03, 52, 1);
    else rimGeo = new THREE.RingGeometry(o.r * 0.92, o.r, 52, 1);
    const rim = new THREE.Mesh(rimGeo, mat(o.colour, 0.85));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(o.x, ground(o.x, o.z) + 7, o.z);
    C.scene.add(rim);
    const warn = o.warn == null ? 0.7 : o.warn;
    zones.push({
      m: m, rim: rim, x: o.x, z: o.z, r: o.r, shape: o.shape || 'disc', a: o.a || 0, half: o.half || 0,
      warn: warn, dmg: o.dmg || 0, t: 0, life: warn + (o.after == null ? 0.4 : o.after),
      o0: op, done: false, onHit: o.onHit || null
    });
  }

  function inZone(z, p) {
    const dx = p.x - z.x, dz = p.z - z.z;
    const d = Math.hypot(dx, dz);
    if (z.shape === 'ring') return Math.abs(d - z.r) < 110;
    if (z.shape === 'sector') {
      if (d > z.r) return false;
      let diff = Math.atan2(dx, dz) - z.a;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      return Math.abs(diff) <= z.half;
    }
    return d <= z.r;
  }

  function tickZones(dt) {
    const p = P();
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      z.t += dt;
      const k = Math.min(1, z.t / z.warn);
      const out = z.t > z.warn ? Math.max(0, 1 - (z.t - z.warn) / Math.max(0.01, z.life - z.warn)) : 1;
      z.m.material.opacity = z.o0 * (0.35 + 0.65 * k) * out;
      // the fill breathes, and hammers as the blow lands
      const pulse = 0.74 + 0.26 * Math.sin(z.t * 22);
      const soon = z.t > z.warn - 0.28 ? 1 + 0.6 * Math.sin(z.t * 62) : 1;
      z.rim.material.opacity = Math.min(1, 0.9 * pulse * soon) * out;
      z.m.material.opacity = z.o0 * (0.35 + 0.65 * k) * out * soon;
      if (!z.done && z.t >= z.warn) {
        z.done = true;
        const inside = inZone(z, p);
        if (inside && z.dmg) C.hurtPlayer(z.dmg);
        // the ground breaks where the blow lands
        debris(z.x, z.z, 0x6d6a60, z.shape === 'ring' ? 10 : 7, 1);
        if (z.onHit) z.onHit(z, inside);
      }
      if (z.t >= z.life) {
        C.scene.remove(z.m);
        C.scene.remove(z.rim);
        z.m.geometry.dispose();
        z.m.material.dispose();
        z.rim.geometry.dispose();
        z.rim.material.dispose();
        zones.splice(i, 1);
      }
    }
  }

  function crescent(z) {
    const geo = new THREE.CircleGeometry(z.r, 28, z.a - Math.PI / 2 - z.half, z.half * 2);
    const m = new THREE.Mesh(geo, mat(0xfff0c0, 0.55));
    m.userData.o0 = 0.55;
    m.rotation.x = -Math.PI / 2;
    m.position.set(z.x, ground(z.x, z.z) + 9, z.z);
    put(m, 0.3, 'fade');
  }

  /* ------------------------------------------------------- shock rings */
  function wave(x, z, colour, dmg, speed, maxR) {
    if (!C.scene) return;
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 44, 1), mat(colour, 0.8));
    m.userData.o0 = 0.8;
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, ground(x, z) + 7, z);
    C.scene.add(m);
    waves.push({ m: m, x: x, z: z, r: 24, speed: speed || 640, maxR: maxR || 640, dmg: dmg, hit: false });
  }

  function tickWaves(dt) {
    const p = P();
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.r += w.speed * dt;
      w.m.scale.setScalar(w.r);
      w.m.material.opacity = Math.max(0, 0.8 * (1 - w.r / w.maxR));
      const d = Math.hypot(p.x - w.x, p.z - w.z);
      if (!w.hit && w.dmg && Math.abs(d - w.r) < 80) { w.hit = true; C.hurtPlayer(w.dmg); }
      if (w.r >= w.maxR) {
        C.scene.remove(w.m);
        w.m.geometry.dispose();
        w.m.material.dispose();
        waves.splice(i, 1);
      }
    }
  }

  /* ------------------------------------------------------------ tracers */
  function tracer(dmg, colour, speed, width) {
    const b = boss();
    if (!b || !C.scene) return;
    const p = P();
    // aimed at the walker's chest, not flat: a tall guardian's muzzle sits well
    // above a person, and a shot that never comes down can never land
    const sx = b.pos.x, sy = b.y + b.height * 0.62, sz = b.pos.z;
    const ty = p.y + 90;
    const dx = p.x - sx, dz = p.z - sz, dy = ty - sy;
    const len = Math.hypot(dx, dz, dy) || 1;
    const sp = speed || 1500;
    const w = width || 7;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, w, 130), mat(colour, 1));
    m.position.set(sx, sy, sz);
    m.lookAt(p.x, ty, p.z);
    C.scene.add(m);
    bolts.push({
      m: m, x: sx, y: sy, z: sz,
      vx: (dx / len) * sp, vy: (dy / len) * sp, vz: (dz / len) * sp, grav: false,
      dmg: dmg, life: 1.3, colour: colour
    });
    flash(sx, sy, sz, colour, 15);
  }

  function lobTar() {
    const b = boss(), p = P();
    if (!b || !C.scene) return;
    const sx = b.pos.x, sy = b.y + b.height * 0.6, sz = b.pos.z;
    const dx = p.x - sx, dz = p.z - sz;
    const d = Math.hypot(dx, dz) || 1;
    const m = new THREE.Mesh(new THREE.SphereGeometry(22, 10, 8), mat(0x2a2036, 0.95));
    m.position.set(sx, sy, sz);
    C.scene.add(m);
    bolts.push({
      m: m, x: sx, y: sy, z: sz, vx: (dx / d) * 560, vz: (dz / d) * 560, vy: 190, grav: true,
      dmg: 0, life: 3, colour: 0x2a2036, tar: true
    });
  }

  function tickBolts(dt) {
    const p = P();
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life -= dt;
      if (b.vy) { if (b.grav) b.vy -= 320 * dt; b.y += b.vy * dt; }
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.m.position.set(b.x, b.y, b.z);
      const dd = Math.hypot(p.x - b.x, p.z - b.z);
      let gone = false;
      if (b.dmg && dd < 74 && Math.abs(b.y - (p.y + 90)) < 110) {
        C.hurtPlayer(b.dmg);
        burstAt(b.x, b.y, b.z, b.colour, 26);
        gone = true;
      } else if (b.life <= 0 || b.y < ground(b.x, b.z) || (room && Math.hypot(b.x - room.site.x, b.z - room.site.z) > 760)) {
        if (b.tar) { tar(b.x, b.z); }
        burstAt(b.x, Math.max(b.y, ground(b.x, b.z) + 10), b.z, b.colour, 24);
        gone = true;
      }
      if (gone) {
        C.scene.remove(b.m);
        b.m.geometry.dispose();
        b.m.material.dispose();
        bolts.splice(i, 1);
      }
    }
  }

  /* -------------------------------------------------------------- mines */
  function mine(x, z, dmg) {
    if (!C.scene) return;
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(26, 30, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x2b3a44, roughness: 0.72, metalness: 0.35 })
    );
    body.position.y = 6;
    const led = new THREE.Mesh(new THREE.SphereGeometry(9, 8, 6), mat(0x9fe3ff, 0.95));
    led.position.y = 17;
    g.add(body, led);
    g.position.set(x, ground(x, z) + 2, z);
    C.scene.add(g);
    const ringM = new THREE.Mesh(new THREE.RingGeometry(74, 92, 32, 1), mat(0x9fe3ff, 0.3));
    ringM.userData.o0 = 0.3;
    ringM.rotation.x = -Math.PI / 2;
    ringM.position.set(x, ground(x, z) + 5, z);
    C.scene.add(ringM);
    mines.push({ g: g, led: led, ring: ringM, x: x, z: z, dmg: dmg || 22, arm: 0.7, t: 0 });
  }

  function tickMines(dt) {
    const p = P();
    for (let i = mines.length - 1; i >= 0; i--) {
      const m = mines[i];
      m.t += dt;
      if (m.t < m.arm) { m.ring.material.opacity = 0.1 + 0.1 * Math.sin(m.t * 24); continue; }
      m.ring.material.opacity = 0.3 + 0.2 * Math.sin(m.t * 7);
      m.led.material.opacity = 0.6 + 0.4 * Math.sin(m.t * 12);
      if (Math.hypot(p.x - m.x, p.z - m.z) < 110) {
        wave(m.x, m.z, 0x9fe3ff, 0, 900, 220);
        burstAt(m.x, ground(m.x, m.z) + 34, m.z, 0x9fe3ff, 40);
        if (Math.hypot(p.x - m.x, p.z - m.z) < 190) C.hurtPlayer(m.dmg);
        C.scene.remove(m.g);
        C.scene.remove(m.ring);
        mines.splice(i, 1);
      }
    }
  }

  /* ---------------------------------------------------------------- tar */
  function tar(x, z) {
    if (!C.scene) return;
    const m = new THREE.Mesh(new THREE.CircleGeometry(170, 32), mat(0x1b1420, 0.72));
    m.userData.o0 = 0.72;
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, ground(x, z) + 5, z);
    C.scene.add(m);
    pools.push({ m: m, x: x, z: z, r: 170, t: 0, life: 7, next: 0 });
  }

  function tickPools(dt, now) {
    const p = P();
    for (let i = pools.length - 1; i >= 0; i--) {
      const s = pools[i];
      s.t += dt;
      s.m.material.opacity = 0.72 * Math.min(1, (s.life - s.t) / 1.2);
      const inside = Math.hypot(p.x - s.x, p.z - s.z) < s.r;
      if (inside && s.t > 0.3) {
        C.slowFactor = 0.55;
        if (now > s.next) { s.next = now + 1.1; C.hurtPlayer(7); }
      }
      if (s.t >= s.life) {
        C.scene.remove(s.m);
        s.m.geometry.dispose();
        s.m.material.dispose();
        pools.splice(i, 1);
      }
    }
  }

  /* -------------------------------------------------------------- smoke */
  function smoke(x, z) {
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(rnd(50, 105), 8, 6), mat(0xbcd8e6, 0.3));
      m.position.set(x + rnd(-90, 90), ground(x, z) + rnd(40, 210), z + rnd(-90, 90));
      put(m, rnd(1.6, 2.6), 'smoke');
    }
  }

  /* ---------------------------------------------------------- the moves */
  function aimAt() {
    const b = boss(), p = P();
    const dx = p.x - b.pos.x, dz = p.z - b.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    aim = { x: dx / d, z: dz / d, a: Math.atan2(dx, dz) };
    return aim;
  }

  function play(list) {
    queue = (list || []).slice();
    move = null;
    name = '';
    next();
  }

  function next() {
    if (!queue.length) { move = null; name = ''; return; }
    move = queue.shift();
    t = 0;
    sub = 0;
    name = move.name || '';
    if (move.enter) move.enter();
  }

  /* ---- The Rootbound Colossus: melee, one slow swing at a time ---- */
  function rootCycle() {
    const b = boss();
    const list = [
      { name: 'Cleave', dur: 1.5, enter: function () {
          const a = aimAt();
          zone({
            shape: 'sector', x: b.pos.x, z: b.pos.z, r: 370, a: a.a, half: 0.6,
            warn: 0.8, dmg: 26, colour: 0xd8c48a, opacity: 0.3, onHit: crescent
          });
        } },
      { name: 'Quake Palm', dur: 2.0, enter: function () { this.n = 0; this.at = 0.55; },
        tick: function (dt) {
          this.at -= dt;
          if (this.n < 3 && this.at <= 0) {
            this.n++;
            this.at = 0.42;
            wave(b.pos.x, b.pos.z, 0xd8c48a, 22, 700, 640);
            puff(b.pos.x, b.pos.z);
          }
        } },
      { name: 'Charge', dur: 1.5, enter: function () { aimAt(); this.hit = false; this.ran = 0; },
        tick: function (dt) {
          if (this.ran < 0.55) {
            b.pos.x += aim.x * 880 * dt;
            b.pos.z += aim.z * 880 * dt;
            this.ran += dt;
            if (Math.random() < 0.55) puff(b.pos.x, b.pos.z);
          }
          const p = P();
          if (!this.hit && Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < 175) {
            this.hit = true;
            C.hurtPlayer(30);
            burstAt(b.pos.x, b.y + 40, b.pos.z, 0xd8c48a, 46);
          }
        } },
      { name: '', dur: 0.6 }
    ];
    if (b.hp / b.maxHp < 0.5) {
      list.splice(3, 0, { name: 'Spike Nova', dur: 2.1, enter: function () {
        const s = room.site;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + rnd(-0.22, 0.22);
          const r = rnd(170, 470);
          const x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
          zone({
            x: x, z: z, r: 125, warn: 1.1, dmg: 20, colour: 0xd8c48a, opacity: 0.32,
            onHit: function (zz) {
              for (let k = 0; k < 3; k++) {
                flash(zz.x + rnd(-40, 40), ground(zz.x, zz.z) + rnd(24, 96), zz.z + rnd(-40, 40), 0xd8c48a, 20);
              }
            }
          });
        }
      } });
    }
    return list;
  }

  /* ---- The Cinder Sovereign: the guns, one barrel at a time ---- */
  function scatter() {
    const b = boss(), p = P();
    if (!C.monsters || !C.monsters.launch) return;
    const sx = b.pos.x, sy = b.y + b.height * 0.6, sz = b.pos.z;
    const dx = p.x - sx, dz = p.z - sz;
    const d = Math.hypot(dx, dz) || 1;
    const nx = dx / d, nz = dz / d;
    // the pellets leave the guardian's chest and drop to the walker's own
    const vy = ((p.y + 90) - sy) / Math.max(0.2, d / 780);
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.1;
      const cs = Math.cos(a), sn = Math.sin(a);
      C.monsters.launch({
        kind: 'fire', x: sx, y: sy, z: sz, r: 16, dmg: 12, life: 0.8, vy: vy,
        vx: (nx * cs - nz * sn) * 780, vz: (nx * sn + nz * cs) * 780
      });
    }
    flash(sx, sy, sz, 0xffb070, 28);
  }

  function lobGrenade() {
    const b = boss(), p = P();
    if (!C.monsters || !C.monsters.launch) return;
    const sx = b.pos.x, sy = b.y + b.height * 0.6, sz = b.pos.z;
    const dx = p.x - sx, dz = p.z - sz;
    const d = Math.hypot(dx, dz) || 1;
    C.monsters.launch({
      kind: 'fire', x: sx, y: sy + 40, z: sz, r: 26, dmg: 20, life: 2.6,
      vx: (dx / d) * 520, vz: (dz / d) * 520, vy: 160, pool: true
    });
  }

  function muzzleRing(colour) {
    const b = boss();
    if (!C.scene) return null;
    const m = new THREE.Mesh(new THREE.RingGeometry(42, 58, 28, 1), mat(colour, 0.75));
    m.userData.o0 = 0.75;
    m.position.set(b.pos.x, b.y + b.height * 0.62, b.pos.z);
    m.lookAt(P().x, m.position.y, P().z);
    C.scene.add(m);
    return m;
  }

  function emberCycle() {
    const b = boss();
    const list = [
      { name: 'Pistol', dur: 1.5, enter: function () { this.n = 0; this.at = 0.18; },
        tick: function (dt) {
          this.at -= dt;
          if (this.n < 3 && this.at <= 0) { this.n++; this.at = 0.34; aimAt(); tracer(11, 0xffd08a, 1600, 8); }
        } },
      { name: 'Reloading', dur: 0.95,
        enter: function () { this.ring = muzzleRing(0xffd08a); },
        tick: function (dt) { if (this.ring) this.ring.rotation.z += dt * 7; },
        exit: function () { if (this.ring && C.scene) C.scene.remove(this.ring); } },
      { name: 'Scatter', dur: 1.25, enter: function () { scatter(); } },
      { name: 'Rifle Burst', dur: 1.75, enter: function () { this.n = 0; this.at = 0.1; },
        tick: function (dt) {
          this.at -= dt;
          if (this.n < 6 && this.at <= 0) { this.n++; this.at = 0.15; aimAt(); tracer(9, 0xffb070, 1800, 6); }
        } },
      { name: '', dur: 0.5 }
    ];
    if (b.hp / b.maxHp < 0.5) {
      list.splice(4, 0, { name: 'Grenade', dur: 1.4, enter: function () { lobGrenade(); } });
    }
    return list;
  }

  /* ---- The Rime Warden: the utilities, spent like ammunition ---- */
  function minesAround() {
    const p = P();
    const base = rnd(0, TAU);
    for (let i = 0; i < 3; i++) {
      const a = base + (i / 3) * TAU;
      mine(p.x + Math.cos(a) * 190, p.z + Math.sin(a) * 190, 22);
    }
  }

  function smokeStep() {
    const b = boss(), s = room.site;
    smoke(b.pos.x, b.pos.z);
    this.done = false;
    const to = { x: s.x + rnd(-360, 360), z: s.z + rnd(-360, 360) };
    b.pos.x = to.x;
    b.pos.z = to.z;
    b.y = ground(to.x, to.z);
    smoke(to.x, to.z);
    flash(to.x, b.y + b.height * 0.5, to.z, 0x9fe3ff, 34);
  }

  function ward() {
    const b = boss();
    if (!C.scene) return;
    const m = new THREE.Mesh(new THREE.SphereGeometry(230, 18, 12), mat(0x9fe3ff, 0.2));
    m.userData.o0 = 0.2;
    m.position.set(b.pos.x, b.y + b.height * 0.45, b.pos.z);
    put(m, 2.2, 'fade');
    b.wardUntil = performance.now() / 1000 + 2.2;
    if (C.monsters && C.monsters.launch) {
      C.monsters.launch({
        kind: 'soul', x: b.pos.x, y: b.y + 90, z: b.pos.z,
        r: 20, dmg: 12, life: 5.5, vx: aim.x * 300, vz: aim.z * 300, homing: true
      });
    }
  }

  function tideCycle() {
    const b = boss();
    const list = [
      { name: 'Shock Mines', dur: 1.9, enter: function () { minesAround(); } },
      { name: 'Tar Grenade', dur: 1.35, enter: function () { aimAt(); lobTar(); } },
      { name: 'Smoke Step', dur: 2.2, enter: smokeStep },
      { name: 'Iron Ward', dur: 2.0, enter: function () { aimAt(); ward(); } },
      { name: '', dur: 0.5 }
    ];
    if (b.hp / b.maxHp < 0.5) {
      list.splice(1, 0, { name: 'Shock Mines', dur: 1.9, enter: function () { minesAround(); } });
    }
    return list;
  }

  /* ---- The Hollow Matriarch: a roaming, two-phase Reach boss ------------ */
  function matriarchCycle() {
    const b = boss();
    const list = [
      { name: 'Veil Sweep', dur: 1.55, enter: function () {
        const a = aimAt();
        zone({
          shape: 'sector', x: b.pos.x, z: b.pos.z, r: 620, a: a.a, half: 0.72,
          warn: 0.9, dmg: 28, colour: 0xc9a8ff, opacity: 0.32, onHit: crescent
        });
      } },
      { name: 'Riftfall', dur: 1.8, enter: function () {
        const p = P();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + 0.4;
          const x = p.x + Math.cos(a) * (90 + i * 24);
          const z = p.z + Math.sin(a) * (90 + i * 24);
          zone({ x: x, z: z, r: 145, warn: 0.92, dmg: 22, colour: 0xb99aff, opacity: 0.3 });
        }
      } },
      { name: 'Soul Seekers', dur: 1.7, enter: function () {
        this.fired = 0;
        this.at = 0.25;
      }, tick: function (dt) {
        this.at -= dt;
        if (this.fired >= 2 || this.at > 0) return;
        this.fired++;
        this.at = 0.48;
        const a = aimAt();
        if (C.monsters && C.monsters.launch) {
          C.monsters.launch({
            kind: 'soul', x: b.pos.x, y: b.y + b.height * 0.55, z: b.pos.z,
            r: 22, dmg: 16, life: 4.8, vx: a.x * 310, vz: a.z * 310, homing: true
          });
        }
      } },
      { name: 'Crown Pulse', dur: 2.0, enter: function () {
        wave(room.site.x, room.site.z, 0xc9a8ff, 20, 650, 930);
      } },
      { name: '', dur: 0.45 }
    ];
    if (b.hp / b.maxHp < 0.5) {
      list.splice(1, 0, { name: 'Shattered Crown', dur: 2.0, enter: function () {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + rnd(-0.2, 0.2);
          const r = 220 + (i % 3) * 105;
          zone({
            x: room.site.x + Math.cos(a) * r,
            z: room.site.z + Math.sin(a) * r,
            r: 132, warn: 0.85, dmg: 19, colour: 0xe0d5ff, opacity: 0.3
          });
        }
      } });
    }
    return list;
  }

  /* --------------------------------------------------------------- frame */
  function update(dt) {
    if (!room) return;
    const now = performance.now() / 1000;
    C.slowFactor = 1;
    tickFx(dt);
    tickZones(dt);
    tickWaves(dt);
    tickBolts(dt);
    tickMines(dt);
    tickPools(dt, now);

    const b = room.boss;
    if (b && !b.dead) {
      // a gunner keeps its distance; everyone stays inside the sanctum
      if (room.id === 'ember') {
        const p = P();
        const px = b.pos.x - p.x, pz = b.pos.z - p.z;
        const pd = Math.hypot(px, pz) || 1;
        if (pd < 320) {
          b.pos.x += (px / pd) * 210 * dt;
          b.pos.z += (pz / pd) * 210 * dt;
        }
      }
      const s = room.site;
      const dx = b.pos.x - s.x, dz = b.pos.z - s.z;
      const d = Math.hypot(dx, dz);
      const lim = room.id === 'matriarch' ? 760 : 560 * 0.76;
      if (d > lim) { b.pos.x = s.x + (dx / d) * lim; b.pos.z = s.z + (dz / d) * lim; }
    }

    if (!move) { play(room.cycle()); return; }
    t += dt;
    if (move.tick) move.tick(dt);
    if (t >= move.dur) {
      if (move.exit) move.exit();
      next();
    }
  }

  function clear() {
    const wipe = (arr) => {
      arr.forEach((o) => {
        const m = o.m || o.g;
        if (m && C.scene) C.scene.remove(m);
        if (o.ring && C.scene) C.scene.remove(o.ring);
      });
      arr.length = 0;
    };
    wipe(fx); wipe(zones); wipe(waves); wipe(bolts); wipe(mines); wipe(pools);
    room = null;
    queue = [];
    move = null;
    name = '';
    C.slowFactor = 1;
  }

  function start(id, b, site) {
    clear();
    if (!b) return;
    room = {
      id: id, boss: b, site: site,
      cycle: id === 'root' ? rootCycle : id === 'ember' ? emberCycle : id === 'matriarch' ? matriarchCycle : tideCycle
    };
    // the guardian's own pattern replaces the generic elemental attack
    b.el = null;
    b.range = 0;
    b.noTouch = true;
    b.keep = id === 'root' ? 140 : 430;
    if (id === 'ember') b.speed = 200;
    if (id === 'tide') b.speed = 130;
    if (id === 'matriarch') { b.speed = 170; b.keep = 340; }
    play(room.cycle());
  }

  C.bossattacks = {
    start: start,
    update: update,
    clear: clear,
    move: function () { return name; }
  };
})();
