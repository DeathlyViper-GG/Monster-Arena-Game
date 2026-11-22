import * as THREE from "three";
import { clamp01, createSky, rand, TAU } from "@/components/glacialArchive/Cutscene";
import { shotBy, shotFor, thinFog } from "../shots";
import {
  createMotes,
  createSealRune,
  createSentinel,
  createWardShards,
  createGodShafts,
  glowSprite,
  sentinelEnvironment,
} from "../SentinelKit";

/* ═════════════════════════════════════════════════════════════════
   THE LAST VIGIL — the Sentinel's core.
   A dais beneath a construct taller than the hall. Three protocol
   rings turn around it, and the Unwritten arrives as an absence:
   flat dark planes and erasure rings that eat the light around the
   platform while it happens.
   ═════════════════════════════════════════════════════════════════ */

export default function createCoreScene({ renderer, phase = 0, shot = null }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x080211, 0.0048);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3200);
  camera.position.set(0, 26, 104);

  scene.environment = sentinelEnvironment(renderer, 0x08021a, 0x3a1060, 0x04010a);

  const sky = createSky({
    top: 0x04010c,
    horizon: 0x3a1060,
    glow: 0xe8ccff,
    aurora: 0x49d0ff,
    auroraAmount: 0.9,
    moonDir: new THREE.Vector3(0, 0.3, -1),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x4a2080, 0x06020e, 0.5));

  const key = new THREE.DirectionalLight(0xe2c2ff, 2.2);
  key.position.set(-80, 140, -160);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x4ad4ff, 1.6);
  rim.position.set(120, 60, 120);
  scene.add(rim);

  /* the dais */
  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(58, 66, 6, 72),
    new THREE.MeshStandardMaterial({ color: 0x1c1230, roughness: 0.42, metalness: 0.72 }),
  );
  dais.position.y = -3;
  scene.add(dais);

  const rimRing = new THREE.Mesh(
    new THREE.TorusGeometry(58, 1.1, 10, 96),
    new THREE.MeshBasicMaterial({ color: 0xd8b6ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  rimRing.rotation.x = Math.PI / 2;
  rimRing.position.y = 0.4;
  scene.add(rimRing);

  const seal = createSealRune({ radius: 46, color: 0xcaa8ff, opacity: 0.55 });
  scene.add(seal.mesh);

  const sentinel = createSentinel({ height: 96, accent: 0xffd9a8, ringColor: 0xe0c0ff });
  sentinel.group.position.set(0, 0, -72);
  scene.add(sentinel.group);

  const wards = createWardShards({ count: 5, radius: 40, height: 46, color: 0xffd9a8, size: 1.4 });
  wards.group.position.z = -60;
  scene.add(wards.group);

  /* protocol glyphs — three burning marks stacked behind the construct */
  const glyphMaterial = new THREE.MeshBasicMaterial({
    color: 0xe8ccff,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glyphs = [];
  for (let i = 0; i < 3; i++) {
    const glyph = new THREE.Mesh(new THREE.TorusGeometry(16 - i * 3.4, 0.7, 8, 6), glyphMaterial.clone());
    glyph.position.set((i - 1) * 34, 34 + i * 20, -150);
    glyph.rotation.z = (i * TAU) / 6;
    scene.add(glyph);
    glyphs.push(glyph);
  }

  /* the Unwritten — planes of nothing, and rings that erase the floor */
  const voidMaterial = new THREE.MeshBasicMaterial({ color: 0x03000a, transparent: true, opacity: 0.86, side: THREE.DoubleSide });
  const sheets = [];
  for (let i = 0; i < 16; i++) {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(rand(24, 70), rand(30, 90)), voidMaterial.clone());
    const a = rand(0, TAU);
    const rad = rand(70, 190);
    sheet.position.set(Math.cos(a) * rad, rand(10, 80), Math.sin(a) * rad - 40);
    sheet.rotation.set(0, -a, rand(-0.3, 0.3));
    sheet.userData.phase = rand(0, TAU);
    sheet.userData.origin = sheet.position.clone();
    scene.add(sheet);
    sheets.push(sheet);
  }

  const erasureMaterial = new THREE.MeshBasicMaterial({
    color: 0x1a0430,
    transparent: true,
    opacity: 0.7,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const erasures = [];
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(10, 26, 64), erasureMaterial.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.3;
    ring.userData.t = i * 0.6;
    scene.add(ring);
    erasures.push(ring);
  }

  const motes = createMotes({ count: 1600, area: 260, height: 110, rgb: "226,206,255", size: 2.1, rise: 1.4 });
  scene.add(motes.points);

  /* the core is a room with a ceiling, so its shafts are steep and close */
  scene.add(
    createGodShafts({ count: 9, radius: 70, height: 300, color: 0xe0ccff, opacity: 0.1, tilt: 0.28 }),
  );

  const coreLight = glowSprite("255,224,180", 256, 0.7);
  coreLight.position.set(0, 82, -72);
  coreLight.scale.setScalar(70);
  scene.add(coreLight);

  /* the two extra vantage points the final beats are shot on */
  const SHOTS = {
    close: { focus: [0, 58, -72], distance: 58, height: 48, swing: 0.55 },
    wide: { focus: [0, 62, -90], distance: 210, height: 110, rise: 54, back: 90 },
  };

  /* the vantage points this chapter's beats are shot on */
  const ANCHORS = {
    primary: { focus: [0, 50, -72], distance: 58, height: 44, sway: 4 },
    dais: { focus: [0, 44, -72], distance: 44, height: 36, sway: 3, rise: 40, radius: 44, travel: 84 },
    core: { focus: [0, 82, -72], distance: 60, height: 46, sway: 2, rise: 34, radius: 30, travel: 50 },
    glyphs: { focus: [0, 62, -150], distance: 84, height: 58, sway: 4, angle: 1.1, rise: 50, radius: 62, travel: 120 },
    horizon: { focus: [0, 62, -90], distance: 220, height: 118, sway: 9, rise: 60, radius: 104, travel: 220, back: 140 },
    erasure: { focus: [0, 6, -40], distance: 46, height: 2.4, sway: 1.6, rise: 40, radius: 34, travel: 70 },
  };

  const update = (time, delta, pointer) => {
    sky.update(time);
    motes.update(time, delta);
    seal.update(time);
    wards.update(time);
    sentinel.update(time);

    rimRing.material.opacity = 0.32 + Math.sin(time * 0.9) * 0.16;
    coreLight.material.opacity = 0.45 + Math.sin(time * 1.2) * 0.22;

    for (let i = 0; i < glyphs.length; i++) {
      glyphs[i].rotation.z += delta * (0.22 + i * 0.12);
      glyphs[i].material.opacity = 0.3 + Math.sin(time * 1.1 + i * 1.4) * 0.22;
    }

    for (let i = 0; i < sheets.length; i++) {
      const s = sheets[i];
      const o = s.userData.origin;
      s.position.set(
        o.x + Math.sin(time * 0.24 + s.userData.phase) * 6,
        o.y + Math.cos(time * 0.18 + s.userData.phase) * 4,
        o.z + Math.sin(time * 0.15 + s.userData.phase) * 5,
      );
      s.material.opacity = 0.5 + Math.sin(time * 0.6 + s.userData.phase) * 0.28;
    }

    for (let i = 0; i < erasures.length; i++) {
      const ring = erasures[i];
      ring.userData.t = (ring.userData.t + delta * 0.16) % 1;
      const t = ring.userData.t;
      ring.scale.setScalar(0.3 + t * 2.6);
      ring.material.opacity = 0.55 * (1 - t);
    }

    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;

    if (shot) {
      // This beat's own vantage: the anchor is what it looks at, the style how it moves.
      thinFog(scene, 0.0048, shot.style === "aerial" || shot.style === "survey" ? 3 : 4);
      shotBy(camera, ANCHORS[shot.anchor] || ANCHORS.primary, shot.style, time, pointer);
    } else if (phase === 0) {
      const t = clamp01(time / 16);
      const eased = t * t * (3 - 2 * t);
      camera.position.set(
        px * 9 + Math.sin(time * 0.08) * 3.2,
        22 + eased * 18 - py * 2,
        104 - eased * 44,
      );
      camera.lookAt(px * 6, 44 + eased * 14, -72);
    } else if (phase === 1) {
      // The construct opens: everything is allowed to fall apart.
      const t = clamp01(time / 15);
      const eased = t * t * (3 - 2 * t);
      camera.position.set(px * 12, 34 + eased * 46, 62 + eased * 24);
      camera.lookAt(px * 4, 50 + eased * 10, -140);
    } else {
      // The same dais from two other vantages: the protocol glyphs, then the core from above.
      thinFog(scene, 0.0048, phase);
      shotFor(phase, camera, SHOTS, time, pointer);
    }
  };

  return { scene, camera, baseFov: 42, update, anchors: ANCHORS };
}