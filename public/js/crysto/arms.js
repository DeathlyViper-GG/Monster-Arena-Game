/* Crysto — the arena's own first-person rig, moved across unchanged.

   Nothing here is drawn from imagination: the guns are the pit's own
   procedural viewmodel shapes (render3d_fx.js -> defGun, one silhouette per
   kind), the hands are the pit's own wrapped grip (render3d_fx.js ->
   vmHands), and the resting poses are the pit's own HIP table. The numbers,
   the frames and the part sizes are copied straight over, so the arms that
   come through the pod are the arms from the arena — same hands, same guns,
   same perspective.

   Frame, exactly as the pit builds it:
     outer  rotation (rx, ry, rz), order Y * Z * X, at (px, py, pz)
       inner  rotation about y by -yaw
         gun parts and hand parts, both in this one frame
   Forward is -z, up is +y, the grip pivot sits at the origin. */
(function () {
  const C = (window.Crysto = window.Crysto || {});

  // The pit's hip-fire poses (render3d_fx.js, HIP): len = gun length, x/y/z =
  // grip position in camera space, yaw = barrel angle toward the crosshair.
  const HIP = {
    pistol: { len: 9.5, x: 6.6, y: -5.6, z: -17.5, yaw: 0.26 },
    rifle: { len: 19, x: 7.4, y: -6.4, z: -19.0, yaw: 0.24 },
    shotgun: { len: 20, x: 7.4, y: -6.6, z: -19.0, yaw: 0.24 },
    smg: { len: 13, x: 6.8, y: -5.8, z: -17.8, yaw: 0.25 },
    burst: { len: 16, x: 7.2, y: -6.2, z: -18.6, yaw: 0.24 },
    marksman: { len: 19, x: 7.4, y: -6.4, z: -19.0, yaw: 0.24 },
    crossbow: { len: 15, x: 7.2, y: -6.2, z: -18.4, yaw: 0.24 },
    lmg: { len: 20, x: 7.4, y: -6.6, z: -19.0, yaw: 0.24 },
    flamethrower: { len: 16, x: 7.4, y: -6.4, z: -18.8, yaw: 0.24 }
  };

  // The pit draws its viewmodel through a 62° camera; Crysto's arm camera is
  // narrower, so the whole rig is scaled to land on screen at the same size.
  const FIT = Math.tan(62 * Math.PI / 360) / Math.tan(52 * Math.PI / 360);

  let boxGeo = null, cylGeo = null, sphGeo = null;
  function geo() {
    if (!boxGeo) {
      boxGeo = new THREE.BoxGeometry(1, 1, 1);
      cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
      sphGeo = new THREE.SphereGeometry(1, 12, 10);
    }
  }

  function mat(c, metal, rough, emis) {
    const col = new THREE.Color(Math.min(1, c[0]), Math.min(1, c[1]), Math.min(1, c[2]));
    const e = emis ? new THREE.Color(Math.min(1, emis[0]), Math.min(1, emis[1]), Math.min(1, emis[2])) : new THREE.Color(0, 0, 0);
    return new THREE.MeshStandardMaterial({ color: col, metalness: metal || 0, roughness: rough == null ? 0.6 : rough, emissive: e });
  }

  /* ---- the pit's procedural gun, kind by kind (defGun) ----------------- */
  function gunParts(kind, len) {
    geo();
    const g = new THREE.Group();
    const mt = mat([0.2, 0.22, 0.32], 0.7, 0.3, [0.03, 0.06, 0.1]);
    const pl = mat([0.13, 0.14, 0.19], 0.35, 0.6);
    const st = mat([0.66, 0.71, 0.78], 0.9, 0.2);
    const gl = mat([0.35, 0.95, 1.5], 0.2, 0.4, [0.25, 1.1, 1.6]);

    const part = (y, z, sx, sy, sz, m) => {
      const o = new THREE.Mesh(boxGeo, m);
      o.position.set(0, y, z);
      o.scale.set(sx, sy, sz);
      g.add(o);
    };
    const cylF = (y, z, lenZ, rad, m) => {
      const o = new THREE.Mesh(cylGeo, m);
      o.position.set(0, y, z);
      o.rotation.x = Math.PI / 2;
      o.scale.set(rad, lenZ, rad);
      g.add(o);
    };

    // grip, shared by every kind: slight rearward rake, sized to the hands' wrap
    part(-0.6, 0.2, 1.15, 1.3, 1.45, pl);
    part(-1.7, 0.4, 1.1, 1.4, 1.35, pl);
    part(-2.8, 0.6, 1, 1.3, 1.25, pl);

    if (kind === 'shotgun') {
      part(0.55, len * -0.05, 1.9, 1.7, len * 0.22, mt);
      part(0.85, len * -0.34, 1.8, 1.9, len * 0.62, mt);
      part(0.05, len * -0.50, 2.1, 2.1, len * 0.26, pl);
      part(-0.45, len * -0.30, 1, 1, len * 0.30, mt);
      part(0.35, len * 0.32, 1.6, 2.6, len * 0.32, pl);
      part(2.05, len * -0.62, 0.35, 0.35, 0.35, gl);
    } else if (kind === 'rifle') {
      part(0.75, len * -0.28, 1.3, 1.6, len * 0.80, mt);
      part(0.15, len * -0.50, 1.7, 1.8, len * 0.30, pl);
      part(-0.5, len * -0.30, 0.95, 1.6, len * 1.20, pl);
      part(-1.75, len * -0.62, 0.9, 1.5, len * 1.15, pl);
      part(0.75, len * 0.30, 1.15, 1.9, len * 0.30, pl);
      part(2.05, len * -0.16, 0.75, 0.85, len * 2.40, mt);
      part(1.45, len * -0.28, 1.4, 0.2, len * 0.50, gl);
    } else if (kind === 'smg') {
      part(0.4, len * -0.05, 1.5, 0.9, len * 0.4, mt);
      cylF(0.35, len * -0.32, len * 0.5, 0.32, mt);
      cylF(0.35, len * -0.58, len * 0.12, 0.42, mt);
      part(-0.55, len * -0.12, 0.7, 1.3, 0.85, pl);
      part(0.2, len * 0.18, 0.7, 0.8, len * 0.28, pl);
      part(0.7, len * -0.52, 0.3, 0.3, 0.3, st);
      part(0.4, len * -0.1, 1.0, 0.15, len * 0.3, gl);
    } else if (kind === 'burst') {
      part(0.45, len * -0.1, 1.6, 1.0, len * 0.45, mt);
      cylF(0.4, len * -0.35, len * 0.6, 0.36, mt);
      cylF(0.4, len * -0.68, len * 0.14, 0.46, mt);
      part(-0.1, len * -0.3, 1.4, 0.8, len * 0.4, pl);
      part(-0.6, len * -0.15, 0.8, 1.4, 0.9, pl);
      part(0.2, len * 0.25, 0.8, 0.9, len * 0.3, pl);
      cylF(0.95, len * -0.2, len * 0.42, 0.4, st);
      part(0.95, len * -0.42, 0.5, 0.5, 0.5, gl);
      part(0.5, len * 0.15, len * 0.12, 0.2, 0.5, mt);
      part(0.4, len * -0.05, len * 0.25, 0.12, 0.3, gl);
    } else if (kind === 'marksman') {
      part(0.5, len * -0.05, 1.5, 1.0, len * 0.5, mt);
      cylF(0.35, len * -0.4, len * 0.8, 0.3, mt);
      cylF(0.35, len * -0.82, len * 0.14, 0.5, mt);
      part(-0.55, len * -0.15, 0.8, 1.3, 0.8, pl);
      part(0.2, len * 0.3, 0.9, 1.0, len * 0.35, pl);
      cylF(1.0, len * -0.2, len * 0.5, 0.42, st);
      part(1.0, len * -0.46, 0.5, 0.5, 0.5, gl);
      part(0.5, len * 0.1, len * 0.12, 0.2, 0.5, mt);
      part(0.6, len * -0.7, 0.3, 0.4, 0.3, st);
    } else if (kind === 'crossbow') {
      part(0.25, len * 0.15, 0.9, 0.9, len * 0.4, pl);
      part(0.35, len * -0.05, 0.32, 0.28, len * 0.45, mt);
      part(0.5, len * -0.48, len * 0.7, 0.22, 0.26, pl);
      cylF(0.45, len * -0.55, len * 0.24, 0.28, st);
      part(0.5, len * -0.40, 0.14, 1.5, 0.1, st);
      part(0.5, len * -0.3, 0.5, 0.3, 0.5, gl);
    } else if (kind === 'lmg') {
      part(0.55, len * -0.05, 1.8, 1.2, len * 0.5, mt);
      cylF(0.4, len * -0.4, len * 0.6, 0.45, mt);
      cylF(0.4, len * -0.75, len * 0.14, 0.55, mt);
      part(-0.1, len * -0.3, 1.5, 0.9, len * 0.35, pl);
      part(-0.7, len * -0.2, 1.3, 1.4, 1.3, pl);
      part(0.2, len * 0.25, 0.9, 1.0, len * 0.3, pl);
      part(0.7, len * -0.7, 0.3, 0.4, 0.3, st);
      part(0.45, len * -0.05, len * 0.25, 0.12, 0.34, gl);
    } else if (kind === 'flamethrower') {
      part(0.5, len * -0.05, 1.8, 1.2, len * 0.45, mt);
      cylF(0.85, len * -0.1, len * 0.5, 0.6, st);
      cylF(0.0, len * -0.1, len * 0.45, 0.5, mt);
      cylF(0.4, len * -0.45, len * 0.3, 0.5, mt);
      cylF(0.4, len * -0.65, len * 0.12, 0.55, mt);
      cylF(0.4, len * -0.75, len * 0.1, 0.2, gl);
      part(-0.7, len * -0.1, 0.8, 1.2, 0.8, pl);
      part(0.6, len * -0.05, len * 0.2, 0.12, 0.34, gl);
    } else {
      part(0.6, len * -0.26, 1.25, 1.5, len * 0.56, mt);
      part(0.6, len * -0.58, 0.8, 0.9, len * 1.40, mt);
      part(1.3, len * -0.24, 0.9, 0.22, len * 0.34, gl);
    }
    return g;
  }

  /* ---- the pit's own grip (vmHands) ------------------------------------ */
  function handRig(kind, len, colour) {
    geo();
    const g = new THREE.Group();
    const skinCol = new THREE.Color(colour || '#aef');
    const skin = new THREE.MeshStandardMaterial({
      color: skinCol, metalness: 0.45, roughness: 0.3,
      emissive: skinCol.clone().multiplyScalar(0.12)
    });
    const cuff = mat([0.1, 0.11, 0.15], 0.8, 0.3, [0.01, 0.03, 0.06]);

    const right = new THREE.Group();
    const left = new THREE.Group();
    g.add(right, left);

    const ell = (into, x, y, z, sx, sy, sz, m) => {
      const o = new THREE.Mesh(sphGeo, m);
      o.position.set(x, y, z);
      o.scale.set(sx, sy, sz);
      into.add(o);
      return o;
    };
    const A = new THREE.Vector3(), B = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    const seg = (into, a, b, r, m) => {
      A.set(a[0], a[1], a[2]);
      B.set(b[0], b[1], b[2]);
      const d = B.clone().sub(A);
      const Ln = d.length() || 1;
      const o = new THREE.Mesh(cylGeo, m);
      o.position.copy(A).add(B).multiplyScalar(0.5);
      o.quaternion.setFromUnitVectors(UP, d.divideScalar(Ln));
      o.scale.set(r, Ln, r);
      into.add(o);
    };

    const th = 0.6, xl = -th - 0.45;

    // right (trigger) hand: the back of the hand behind the grip, three
    // fingers wrapped round the front, thumb over the top, index along the frame
    ell(right, 0.55, -0.60, 1.00, 0.60, 1.15, 1.00, skin);
    ell(right, 0.50, -2.05, 1.15, 0.58, 1.20, 0.95, skin);
    ell(right, 0.42, 0.30, 0.70, 0.56, 0.62, 0.80, skin);
    for (let i = 0; i < 3; i++) {
      const y = -0.45 - i * 0.95, rr = 0.50 - i * 0.02, t = Math.max(xl, -1.7) - 0.12 + i * 0.13;
      seg(right, [0.95, y, 0.35], [0.62, y - 0.06, -0.60], rr, skin);
      seg(right, [0.62, y - 0.06, -0.60], [0.10, y - 0.12, -1.00], rr - 0.03, skin);
      seg(right, [0.10, y - 0.12, -1.00], [t, y - 0.14, -0.62], rr - 0.06, skin);
      ell(right, t, y - 0.14, -0.62, rr - 0.06, rr - 0.06, rr - 0.06, skin);
    }
    seg(right, [0.55, 0.50, 0.55], [-0.12, 0.86, 0.05], 0.54, skin);
    seg(right, [-0.12, 0.86, 0.05], [xl + 0.10, 0.76, -1.20], 0.48, skin);
    ell(right, xl + 0.10, 0.76, -1.20, 0.45, 0.45, 0.45, skin);
    seg(right, [0.80, 0.36, 0.30], [0.02, 0.42, -0.85], 0.49, skin);
    seg(right, [0.02, 0.42, -0.85], [xl + 0.06, 0.56, -2.10], 0.44, skin);
    ell(right, xl + 0.06, 0.56, -2.10, 0.42, 0.42, 0.42, skin);
    seg(right, [0.60, -2.00, 1.40], [5, -8.5, 11], 1.25, skin);      // forearm
    seg(right, [0.62, -2.45, 2.00], [0.95, -3.5, 4.1], 1.55, cuff);  // sleeve

    // left (support) hand: wraps the handguard, four fingers over the top.
    // Reloading drops it away from the gun: it lives in its own group so the
    // pit's own -3.5y / +2z shift can be applied without rebuilding anything.
    const barY = 0.8;
    const zf = -len * 0.5, yb = barY - 1.7, xm = -th * 0.5 - 0.1, x0 = xm + 0.55;
    ell(left, x0, yb, zf + 0.35, 0.60, 1.05, 1.15, skin);
    ell(left, x0 - 0.05, yb + 0.35, zf - 1.05, 0.56, 0.85, 1.05, skin);
    for (let i = 0; i < 4; i++) {
      const z = zf + 1.05 - i * 0.70, rr = 0.46 - i * 0.015;
      seg(left, [x0 + 0.30, yb - 0.30, z], [xl - 0.10, yb + 0.15, z], rr, skin);
      seg(left, [xl - 0.10, yb + 0.15, z], [xl - 0.20, yb + 1.05, z - 0.18], rr - 0.03, skin);
      seg(left, [xl - 0.20, yb + 1.05, z - 0.18], [xl + 0.55, yb + 1.25, z - 0.35], rr - 0.06, skin);
      ell(left, xl + 0.55, yb + 1.25, z - 0.35, rr - 0.06, rr - 0.06, rr - 0.06, skin);
    }
    seg(left, [x0 + 0.35, yb + 0.35, zf + 0.95], [xl - 0.15, yb + 0.95, zf + 0.35], 0.50, skin);
    seg(left, [xl - 0.15, yb + 0.95, zf + 0.35], [xl - 0.25, yb + 1.10, zf - 0.95], 0.44, skin);
    ell(left, xl - 0.25, yb + 1.10, zf - 0.95, 0.42, 0.42, 0.42, skin);
    seg(left, [xm - 0.3, yb - 0.3, zf + 1.7], [-8, yb - 8, zf + 12], 1.2, skin);
    seg(left, [xm - 0.35, yb - 0.5, zf + 2.2], [xm - 1.1, yb - 1.6, zf + 4.4], 1.5, cuff);

    return {
      group: g,
      setReload(rel) { left.position.set(0, -rel * 3.5, rel * 2); }
    };
  }

  // The whole rig, in camera space, exactly as the pit assembles it.
  function build(kind, colour) {
    const hip = HIP[kind] || HIP.smg;
    const root = new THREE.Group();
    root.scale.setScalar(FIT);

    const outer = new THREE.Group();
    outer.rotation.order = 'YZX';
    const inner = new THREE.Group();
    outer.add(inner);
    root.add(outer);

    inner.add(gunParts(kind, hip.len));
    const hands = handRig(kind, hip.len, colour);
    inner.add(hands.group);

    // the muzzle flash sits at the barrel's tip
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.45, -hip.len * 0.86);
    inner.add(muzzle);

    return {
      group: root,
      muzzle: muzzle,
      pose(px, py, pz, yaw, rx, ry, rz, rel) {
        outer.position.set(px, py, pz);
        outer.rotation.set(rx, ry, rz);
        inner.rotation.y = -yaw;
        hands.setReload(rel || 0);
      }
    };
  }

  C.arms = { HIP: HIP, build: build };
})();
