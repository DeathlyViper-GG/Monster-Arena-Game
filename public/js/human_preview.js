/* =====================================================================
   human_preview.js — the Human Model Pack's live preview in Customise.

   A small self-contained three.js stage: the same humanoid the arena draws,
   built from the pack's rig, with the fifteen skins and the five animations
   (idle, walk, dash, jump, shoot). Drag to spin. Everything is disposed when
   the tab closes or the fighter changes, so no WebGL context leaks.
   ===================================================================== */
(function (G) {
  'use strict';

  const ANIMS = ['Idle', 'Walk', 'Dash', 'Jump', 'Shoot'];
  const T = () => G.THREE;

  const S = {
    renderer: null, canvas: null, scene: null, cam: null, root: null,
    raf: 0, last: 0, t: 0, skin: 0, anim: 0, yaw: .5, drag: null,
    rig: null, acc: [], anims: [], gun: null, flash: null
  };

  const pal = (i) => (G.HumanPack && G.HumanPack.SKINS[i] ? G.HumanPack.SKINS[i].pal
    : { skin: '#d9a47f', shirt: '#2f6f7a', pants: '#3b4252', boot: '#20232b', hair: '#2a1d16' });

  function dispose() {
    if (!S.root) return;
    S.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    S.scene.remove(S.root);
    S.root = null; S.rig = null; S.acc = []; S.anims = []; S.gun = null; S.flash = null;
  }

  /* ------------------------------------------------------------- the rig */
  function build(skinIdx) {
    const THREE = T();
    dispose();
    const c = pal(skinIdx);
    const M = (h, o) => new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(h), roughness: .72, metalness: .06 }, o || {}));
    const skin = M(c.skin), shirt = M(c.shirt), pants = M(c.pants), boot = M(c.boot), hair = M(c.hair);
    const metal = M('#15171c', { roughness: .35, metalness: .8 });
    const mk = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; return o; };
    const grp = (p, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); p.add(o); return o; };
    const seg = (len, r0, r1, m) => { const g = new THREE.CylinderGeometry(r0, r1, len, 12); g.translate(0, -len / 2, 0); const o = mk(g, m); o.scale.set(1.25, 1, 1.25); return o; };
    const ball = (r, m, sx = 1, sy = 1, sz = 1) => { const o = mk(new THREE.SphereGeometry(r, 14, 10), m); o.scale.set(sx * 1.25, sy, sz * 1.25); return o; };

    const root = new THREE.Group();
    root.scale.setScalar(.82);
    S.scene.add(root);
    S.root = root;

    root.add(ball(.17, pants, .9, .75, .65));                       // pelvis
    const spine = grp(root, 0, .08, 0);
    const tg = new THREE.CylinderGeometry(.2, .15, .5, 14); tg.translate(0, .25, 0);
    const torso = mk(tg, shirt); torso.scale.set(.95, 1, .7); spine.add(torso);
    const chest = ball(.2, shirt, .8, .7, .55); chest.position.y = .45; spine.add(chest);
    const neck = grp(spine, 0, .6, 0);
    neck.add(mk(new THREE.CylinderGeometry(.055, .06, .12, 10), skin, 0, .02, 0));
    const head = grp(neck, 0, .08, 0);
    head.add(ball(.115, skin, .75, 1.1, .9).translateY(.12));
    head.add(ball(.12, hair, .8, .8, .92).translateY(.17).translateZ(-.015));
    head.add(mk(new THREE.BoxGeometry(.03, .04, .04), skin, 0, .11, .14));
    [-.04, .04].forEach((x) => head.add(mk(new THREE.SphereGeometry(.014, 8, 8), metal, x, .14, .12)));

    function arm(side) {
      const sh = grp(spine, .27 * side, .52, 0); sh.add(ball(.065, shirt));
      sh.add(seg(.3, .055, .045, shirt));
      const el = grp(sh, 0, -.3, 0); el.add(ball(.045, skin)); el.add(seg(.28, .045, .035, skin));
      const hand = grp(el, 0, -.3, 0); hand.add(ball(.045, skin, 1.2, 1.2, .8));
      return { sh, el, hand };
    }
    function leg(side) {
      const hip = grp(root, .13 * side, -.04, 0); hip.add(seg(.45, .085, .06, pants));
      const kn = grp(hip, 0, -.45, 0); kn.add(ball(.06, pants)); kn.add(seg(.45, .06, .045, pants));
      const ft = grp(kn, 0, -.45, 0); const f = mk(new THREE.BoxGeometry(.1, .07, .27), boot, 0, -.025, .06); f.scale.x = 1.3; ft.add(f);
      return { hip, kn, ft, f };
    }
    const A = { L: arm(1), R: arm(-1) }, L = { L: leg(1), R: leg(-1) };

    // rifle held in the right hand
    const gun = new THREE.Group();
    gun.add(mk(new THREE.BoxGeometry(.06, .1, .42), metal, 0, 0, .12));
    gun.add(mk(new THREE.CylinderGeometry(.015, .015, .3, 8).rotateX(Math.PI / 2), metal, 0, .02, .46));
    gun.add(mk(new THREE.BoxGeometry(.05, .14, .06), metal, 0, -.1, .08));
    const flash = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc861 }));
    flash.position.set(0, .02, .64); gun.add(flash);
    gun.position.set(0, -.04, .04);
    A.R.hand.add(gun);
    S.gun = gun; S.flash = flash;

    S.rig = { spine, neck, head, A, L };
    S.acc = []; S.anims = [];
    decorate(skinIdx, { THREE, M, mk, grp, ball, spine, head, A, L, metal });
  }

  /* ------------------------------------------------------------ the skins */
  function decorate(i, R) {
    if (!i) return;
    const { THREE, M, mk, grp, ball, spine, head, A, L, metal } = R;
    const GM = (c, e = 0, op = 1) => {
      const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(c), emissive: new THREE.Color(c), emissiveIntensity: e, roughness: .42, metalness: .4, side: THREE.DoubleSide });
      if (op < 1) { m.transparent = true; m.opacity = op; }
      return m;
    };
    const put = (p, o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); p.add(o); S.acc.push(o); return o; };
    const cone = (r, h, m, s = 8) => new THREE.Mesh(new THREE.ConeGeometry(r, h, s), m);
    const Y = new THREE.Vector3(0, 1, 0);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const spike = (p, pos, dir, r, h, m, s = 8) => {
      const d = dir.clone().normalize(), c = cone(r, h, m, s);
      c.position.copy(pos).addScaledVector(d, h / 2);
      c.quaternion.setFromUnitVectors(Y, d);
      p.add(c); S.acc.push(c); return c;
    };
    const wings = (cfg) => {
      for (const s of [1, -1]) {
        const wg = new THREE.Group();
        wg.position.set(s * .08, .42, -.16); wg.scale.x = s;
        spine.add(wg); S.acc.push(wg);
        const m = GM(cfg.col, cfg.em, cfg.op || 1);
        if (cfg.insect) {
          [[.5, .8], [-.4, .55]].forEach(([a, l]) => {
            const g = new THREE.CircleGeometry(.5, 20); g.translate(.5, 0, 0);
            const f = new THREE.Mesh(g, m); f.scale.set(l, l * .42, 1); f.rotation.z = a; wg.add(f);
          });
        } else {
          for (let k = 0; k < cfg.n; k++) {
            const len = cfg.len * (.55 + .45 * Math.sin(Math.PI * (k + .5) / cfg.n)) * (cfg.rag && k % 2 ? .8 : 1);
            const g = cfg.cone ? new THREE.ConeGeometry(cfg.w, len, 4) : new THREE.BoxGeometry(len, .015, cfg.w);
            if (cfg.cone) g.rotateZ(-Math.PI / 2);
            g.translate(len / 2, 0, 0);
            const f = new THREE.Mesh(g, m);
            if (cfg.cone) f.scale.y = .3;
            f.rotation.z = -.25 + k * 1.55 / (cfg.n - 1);
            wg.add(f);
          }
        }
        S.anims.push((t) => { wg.rotation.y = s * (cfg.base + Math.sin(t * cfg.fl) * cfg.amp); });
      }
    };

    switch (i) {
      case 1: {                                                    // Spikes Shell
        const sh = GM('#6b4a2e'), bone = GM('#e8dcc0');
        const g = new THREE.SphereGeometry(.3, 18, 10, 0, 6.283, 0, 1.5708); g.rotateX(-1.5708);
        put(spine, new THREE.Mesh(g, sh), 0, .3, -.06).scale.set(.9, 1.1, .8);
        for (const a of [-.9, -.45, 0, .45, .9]) for (const e of [-.1, .5, 1]) {
          const d = V(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
          spike(spine, V(0, .3, -.06).addScaledVector(d, .3), d, .035, .17, bone);
        }
        [A.L, A.R].forEach((a, k) => { const s = k ? -1 : 1; spike(a.sh, V(s * .05, .05, 0), V(s, 1, 0), .04, .15, bone); });
        break;
      }
      case 2: {                                                    // Toothy Maw
        const d = GM('#3a0a14'), w = GM('#ffffff');
        put(head, new THREE.Mesh(new THREE.BoxGeometry(.15, .07, .03), d), 0, .06, .137);
        for (let k = 0; k < 6; k++) {
          const x = -.06 + k * .024;
          put(head, cone(.011, .035, w, 6), x, .085, .15).rotation.x = Math.PI;
          put(head, cone(.011, .03, w, 6), x, .036, .15);
        }
        break;
      }
      case 3: {                                                    // Hex Armour
        const g = GM('#e0a526', .25), st = GM('#8fa3b8');
        const hx = (p, x, y, z, r) => {
          put(p, new THREE.Mesh(new THREE.CylinderGeometry(r, r, .03, 6), g), x, y, z).rotation.x = Math.PI / 2;
          put(p, new THREE.Mesh(new THREE.CylinderGeometry(r * .6, r * .6, .04, 6), st), x, y, z).rotation.x = Math.PI / 2;
        };
        hx(spine, 0, .4, .11, .14); hx(spine, 0, .2, .1, .11); hx(spine, 0, .02, .1, .08);
        [A.L, A.R].forEach((a, k) => {
          put(a.sh, new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .04, 6), g), (k ? -1 : 1) * .04, .07, 0);
          hx(a.sh, 0, -.15, .075, .045); hx(a.el, 0, -.15, .065, .04);
        });
        [L.L, L.R].forEach((l) => { hx(l.hip, 0, -.2, .1, .065); hx(l.kn, 0, -.22, .075, .055); });
        break;
      }
      case 4: {                                                    // Cyber Halo
        const c = GM('#38e8ff', 1.2);
        const r1 = put(head, new THREE.Mesh(new THREE.TorusGeometry(.2, .012, 8, 36, 5), c), 0, .42, 0);
        const r2 = put(head, new THREE.Mesh(new THREE.TorusGeometry(.15, .008, 8, 36, 4), c), 0, .42, 0);
        r1.rotation.x = r2.rotation.x = Math.PI / 2;
        put(head, new THREE.Mesh(new THREE.BoxGeometry(.2, .04, .02), c), 0, .14, .15);
        S.anims.push((t) => { r1.rotation.z = t * 1.2; r2.rotation.z = -t * 2; });
        break;
      }
      case 5: {                                                    // Void Flame
        const m = GM('#b45cff', 1.2, .85), m2 = GM('#5a1cff', 1.5, .85), fl = [];
        const tuft = (p, x, y, z, s) => {
          [[-.04, .18, m2], [0, .28, m], [.04, .16, m2]].forEach(([dx, h, mm2]) => {
            fl.push(put(p, cone(.035 * s, h * s, mm2, 6), x + dx * s, y + h * s / 2, z));
          });
        };
        tuft(head, 0, .22, 0, 1); tuft(A.L.hand, 0, 0, 0, .6); tuft(A.R.hand, 0, 0, 0, .6);
        tuft(A.L.sh, 0, .07, 0, .8); tuft(A.R.sh, 0, .07, 0, .8);
        S.anims.push((t) => fl.forEach((c, k) => { c.scale.y = 1 + .35 * Math.sin(t * 12 + k * 1.7); }));
        break;
      }
      case 6: {                                                    // Crystal Shards
        const m = GM('#7be6ff', .55, .85);
        [A.L, A.R].forEach((a, k) => {
          const s = k ? -1 : 1;
          spike(a.sh, V(s * .05, .06, 0), V(s * .6, 1, 0), .05, .3, m, 5);
          spike(a.el, V(s * .05, -.1, 0), V(s * .9, .3, -.2), .035, .16, m, 5);
        });
        for (let k = -2; k <= 2; k++) { const q = 2 - Math.abs(k); spike(spine, V(k * .07, .3 + .1 * q, -.13), V(k * .25, 1, -.8), .04, .25 + .07 * q, m, 5); }
        spike(head, V(0, .22, 0), V(0, 1, -.2), .04, .2, m, 5);
        break;
      }
      case 7: {                                                    // Nano Arms
        const o = GM('#ff7a1a', 1), sv = GM('#c8ccd4'), cubes = [];
        [A.L, A.R].forEach((a) => {
          [a.sh, a.el].forEach((p) => {
            for (let k = 0; k < 12; k++) {
              const an = k * 2.4, y = -.03 - (k / 12) * .27;
              const cube = put(p, new THREE.Mesh(new THREE.BoxGeometry(.04, .04, .04), k % 4 ? sv : o), Math.cos(an) * .085, y, Math.sin(an) * .085);
              cubes.push([cube, an, y, k]);
            }
          });
          put(a.hand, new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), o), 0, -.04, 0);
        });
        S.anims.push((t) => cubes.forEach(([c2, an, y, k]) => {
          const aa = an + t * 2;
          c2.position.set(Math.cos(aa) * .085, y + Math.sin(t * 5 + k) * .012, Math.sin(aa) * .085);
          c2.rotation.set(t + k, t * 1.3, 0);
        }));
        break;
      }
      case 8: {                                                    // Plasma Horns
        const hm = GM('#3a0b10'), pl = GM('#ff4fd8', 1.3);
        [1, -1].forEach((s) => {
          const base = V(s * .07, .2, 0), d1 = V(s * .45, 1, -.25).normalize();
          spike(head, base, d1, .045, .2, hm);
          const p2 = base.clone().addScaledVector(d1, .2), d2 = V(s, .7, -.45).normalize();
          spike(head, p2, d2, .032, .17, pl);
          const p3 = p2.clone().addScaledVector(d2, .17);
          put(head, new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), pl), p3.x, p3.y, p3.z);
        });
        break;
      }
      case 9: {                                                    // Tri-Blade Wheel
        const g = GM('#d9b04a', .2), st = GM('#9aa6b5'), w = new THREE.Group();
        w.position.set(0, .42, -.26); spine.add(w); S.acc.push(w);
        w.add(new THREE.Mesh(new THREE.TorusGeometry(.34, .03, 8, 30), st));
        for (let k = 0; k < 3; k++) {
          const armG = new THREE.Group(); armG.rotation.z = k * 2.0944; w.add(armG);
          const sp = new THREE.Mesh(new THREE.BoxGeometry(.025, .34, .025), st); sp.position.y = .17; armG.add(sp);
          const bl = cone(.1, .28, g, 3); bl.position.y = .45; bl.scale.z = .25; armG.add(bl);
        }
        S.anims.push((t) => { w.rotation.z = -t * 3; });
        break;
      }
      default: {                                                   // wings
        const sets = [
          { col: '#ffffff', em: .12, n: 7, len: .8, w: .12, base: .45, amp: .2, fl: 2.5 },
          { col: '#28e8ff', em: .9, n: 5, len: .85, w: .07, cone: 1, base: .5, amp: .15, fl: 3 },
          { col: '#6a1fd0', em: .7, n: 6, len: .9, w: .09, cone: 1, rag: 1, base: .45, amp: .25, fl: 2 },
          { col: '#ff6a1a', em: 1.1, n: 7, len: .8, w: .08, cone: 1, base: .4, amp: .22, fl: 4 },
          { col: '#7fe3d0', em: .15, op: .5, insect: 1, base: .3, amp: .35, fl: 16 }
        ];
        wings(sets[i - 10] || sets[0]);
        break;
      }
    }
  }

  /* ---------------------------------------------------------- animation */
  const sm1 = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  function pose(m, t) {
    const P = { thL: 0, thR: 0, shL: .05, shR: .05, arL: 0, arR: 0, azL: 0, azR: 0, elL: -.15, elR: -.15, lean: 0, twist: 0, headX: 0, air: 0 };
    const cyc = (p, amp, k) => [-Math.sin(p) * amp, .08 + Math.max(0, Math.cos(p)) * k];
    if (m === 0) { P.arL = Math.sin(t * 1.6) * .03; P.lean = Math.sin(t * 1.6) * .015; P.azL = -.08; P.azR = .08; }
    if (m === 1 || m === 2) {
      const d = m === 2, p = t * (d ? 11 : 5.5), amp = d ? 1 : .55, k = d ? 1.5 : .9;
      [P.thL, P.shL] = cyc(p, amp, k);
      [P.thR, P.shR] = cyc(p + Math.PI, amp, k);
      P.arL = Math.sin(p) * (d ? .95 : .5); P.arR = -P.arL;
      if (m === 1) { P.arL = .35; P.arR = .35; }                 // the walk carries the gun low
      const eb = (a) => d ? -1.4 : -.15 + Math.min(0, a) * .8;
      P.elL = eb(P.arL); P.elR = eb(P.arR);
      P.twist = Math.sin(p) * (d ? .25 : .14); P.lean = d ? .5 : .05; P.headX = d ? -.35 : 0;
    }
    if (m === 3) {
      const u = t % 1.7;
      if (u < .3) { const c = sm1(u / .3); Object.assign(P, { thL: -.9 * c, thR: -.9 * c, shL: 1.5 * c, shR: 1.5 * c, arL: .9 * c, arR: .9 * c, lean: .35 * c }); }
      else if (u < 1) {
        const v = (u - .3) / .7, s = Math.sin(Math.PI * v);
        P.air = 1.1 * 4 * v * (1 - v);
        Object.assign(P, { thL: -.2 - .8 * s, thR: -.1 - .5 * s, shL: .3 + 1.0 * s, shR: .3 + .8 * s, arL: -2.3 * s, arR: -2.0 * s, azL: .3 * s, azR: -.3 * s, elL: -.3, elR: -.3 });
      } else if (u < 1.3) {
        const c = Math.sin(Math.PI * (u - 1) / .3);
        Object.assign(P, { thL: -.9 * c, thR: -.9 * c, shL: 1.5 * c, shR: 1.5 * c, arL: .5 * c, arR: .5 * c, lean: .35 * c });
      }
    }
    if (m === 4) {
      const c = t % .45, k = Math.exp(-c * 14);
      Object.assign(P, { thL: .15, shL: .1, thR: -.25, shR: .25, arR: -1.4 + .15 * k, azR: .12, elR: -.2, arL: -1.3, azL: -.4, elL: -.7, lean: -.06 - .08 * k, twist: .22, headX: .05 });
      if (S.flash) S.flash.visible = c < .05;
    } else if (S.flash) S.flash.visible = false;
    return P;
  }

  const box = () => new (T().Box3)();
  function apply(P) {
    if (!S.rig) return;
    const { spine, neck, A, L } = S.rig;
    for (const s of ['L', 'R']) {
      L[s].hip.rotation.x = P['th' + s]; L[s].kn.rotation.x = P['sh' + s];
      L[s].ft.rotation.x = -(P['th' + s] + P['sh' + s]) * .65;
      A[s].sh.rotation.set(P['ar' + s], 0, P['az' + s]); A[s].el.rotation.x = P['el' + s];
    }
    spine.rotation.set(P.lean, P.twist, 0);
    neck.rotation.set(P.headX - P.lean * .5, -P.twist * .6, 0);
    S.root.position.set(0, 1.1, 0);
    S.root.updateMatrixWorld(true);
    const b = box(); let lo = 1e9;
    for (const s of ['L', 'R']) { b.setFromObject(L[s].f); lo = Math.min(lo, b.min.y); }
    S.root.position.y = 1.1 - lo + P.air;
    if (S.gun) {
      S.gun.visible = S.anim === 4;
      if (S.gun.visible) S.gun.rotation.x = -(A.R.sh.rotation.x + A.R.el.rotation.x);
    }
  }

  /* ------------------------------------------------------------- stage */
  function init(canvas) {
    const THREE = T();
    if (S.canvas === canvas && S.renderer) return;
    destroy();
    S.canvas = canvas;
    S.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    S.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    S.renderer.outputEncoding = THREE.sRGBEncoding;
    S.scene = new THREE.Scene();
    S.cam = new THREE.PerspectiveCamera(34, 1, .1, 60);
    S.cam.position.set(0, 1.3, 4.2);
    S.cam.lookAt(0, .95, 0);
    S.scene.add(new THREE.HemisphereLight(0xdde8ff, 0x141020, 1.0));
    const key = new THREE.DirectionalLight(0xfff1dd, 1.5); key.position.set(-2.5, 4, 3); S.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fd0ff, 1.0); rim.position.set(2.4, 2, -2.4); S.scene.add(rim);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(.95, 36),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#111629'), roughness: .6, metalness: .3 }));
    disc.rotation.x = -Math.PI / 2; S.scene.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.46, .008, 8, 56),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#7fd0ff'), transparent: true, opacity: .35 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .004; S.scene.add(ring);
    resize();
  }

  function resize() {
    const cv = S.canvas;
    if (!cv || !S.renderer) return;
    const w = cv.clientWidth || 320, h = cv.clientHeight || 240;
    S.renderer.setSize(w, h, false);
    S.cam.aspect = w / Math.max(1, h); S.cam.updateProjectionMatrix();
  }

  function tick() {
    S.raf = requestAnimationFrame(tick);
    const cv = S.canvas;
    if (!cv || !S.renderer) return;
    if (!cv.isConnected) { stop(); return; }
    const now = performance.now();
    const w = cv.clientWidth || 0;
    if (!w) {
      S.hiddenSince = S.hiddenSince || now;
      if (now - S.hiddenSince > 1600) stop();
      S.last = now; return;
    }
    S.hiddenSince = 0;
    if (S.lastW !== w) { S.lastW = w; resize(); }
    const dt = Math.min(.05, (now - (S.last || now)) / 1000);
    S.last = now; S.t += dt;
    if (!S.drag) S.yaw += dt * .35;
    if (S.root) {
      S.root.rotation.y = S.yaw;
      const P = pose(S.anim, S.t);
      apply(P);
      S.anims.forEach((f) => f(S.t));
    }
    S.renderer.render(S.scene, S.cam);
  }

  function stop() { if (S.raf) cancelAnimationFrame(S.raf); S.raf = 0; }

  function destroy() {
    stop(); dispose();
    if (S.renderer) { S.renderer.dispose(); if (S.renderer.forceContextLoss) S.renderer.forceContextLoss(); }
    S.renderer = null; S.scene = null; S.cam = null; S.canvas = null;
  }

  function show(canvas, skinIdx, anim) {
    if (!canvas || !G.THREE) return;
    init(canvas);
    resize();
    S.anim = Math.max(0, Math.min(ANIMS.length - 1, anim | 0));
    if (S.skin !== skinIdx || !S.root) { S.skin = skinIdx; build(skinIdx); }
    S.yaw = .5;
    if (!S.raf) { S.last = performance.now(); S.raf = requestAnimationFrame(tick); }
  }

  function bindDrag(canvas) {
    if (!canvas || canvas.__humanDrag) return;
    canvas.__humanDrag = true;
    let lastX = 0;
    const down = (e) => { S.drag = true; lastX = (e.touches ? e.touches[0].clientX : e.clientX); };
    const move = (e) => {
      if (!S.drag) return;
      const px = (e.touches ? e.touches[0].clientX : e.clientX);
      S.yaw += (px - lastX) * .012; lastX = px;
      if (e.cancelable) e.preventDefault();
    };
    const up = () => { S.drag = false; };
    canvas.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down, { passive: true });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', up);
  }

  /* ------------------------------------------------- flat card portrait */
  function icon(cv, i) {
    if (!cv) return;
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const p = pal(i);
    g.clearRect(0, 0, W, H);
    const bg = g.createRadialGradient(W / 2, H * .45, 4, W / 2, H * .45, W * .72);
    bg.addColorStop(0, p.shirt + '55');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);

    const cx = W / 2, headR = W * .105, top = H * .18;
    // legs
    g.fillStyle = p.pants;
    g.fillRect(cx - W * .085, H * .62, W * .065, H * .24);
    g.fillRect(cx + W * .02, H * .62, W * .065, H * .24);
    g.fillStyle = p.boot;
    g.fillRect(cx - W * .095, H * .85, W * .085, H * .05);
    g.fillRect(cx + W * .012, H * .85, W * .085, H * .05);
    // torso + arms
    g.fillStyle = p.shirt;
    g.beginPath();
    g.moveTo(cx - W * .105, H * .33);
    g.lineTo(cx + W * .105, H * .33);
    g.lineTo(cx + W * .085, H * .66);
    g.lineTo(cx - W * .085, H * .66);
    g.closePath(); g.fill();
    g.fillRect(cx - W * .15, H * .35, W * .045, H * .26);
    g.fillRect(cx + W * .105, H * .35, W * .045, H * .26);
    g.fillStyle = p.skin;
    g.fillRect(cx - W * .145, H * .6, W * .038, H * .07);
    g.fillRect(cx + W * .11, H * .6, W * .038, H * .07);
    // head
    g.fillStyle = p.skin;
    g.beginPath(); g.arc(cx, top + headR, headR, 0, Math.PI * 2); g.fill();
    g.fillStyle = p.hair;
    g.beginPath(); g.arc(cx, top + headR * .72, headR * .96, Math.PI, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(10,16,26,.9)';
    g.beginPath(); g.arc(cx - headR * .38, top + headR, headR * .12, 0, Math.PI * 2);
    g.arc(cx + headR * .38, top + headR, headR * .12, 0, Math.PI * 2); g.fill();

    // the skin's signature glow
    const glow = ['#000000', '#e8dcc0', '#ffffff', '#e0a526', '#38e8ff', '#b45cff', '#7be6ff', '#ff7a1a', '#ff4fd8', '#d9b04a',
      '#ffffff', '#28e8ff', '#6a1fd0', '#ff6a1a', '#7fe3d0'][i] || '#000000';
    if (i) {
      g.globalAlpha = .8;
      g.strokeStyle = glow; g.lineWidth = 2;
      g.beginPath(); g.arc(cx, top + headR, headR * 1.5, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = .5;
      g.beginPath(); g.arc(cx, H * .5, W * .34, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      g.globalAlpha = 1;
    }
  }

  G.HumanPreview = {
    ANIMS,
    show: (canvas, skinIdx, anim) => { bindDrag(canvas); show(canvas, skinIdx, anim); },
    hide: () => stop(),
    icon
  };
})(window);
