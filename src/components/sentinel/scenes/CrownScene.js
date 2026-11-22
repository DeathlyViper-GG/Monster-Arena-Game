import * as THREE from "three";
import { clamp01, createSky, rand, TAU } from "@/components/glacialArchive/Cutscene";
import { shotBy, shotFor, thinFog } from "../shots";
import {
  createFrozenCrowd,
  createMotes,
  createSealRune,
  createSentinel,
  createWardShards,
  createGodShafts,
  createSentinelGround,
  glowSprite,
  sentinelEnvironment,
} from "../SentinelKit";

/* ═════════════════════════════════════════════════════════════════
   CHAPTER FIVE — THE FRACTURED CROWN
   A kingdom held in the single instant before it chose to rebel.
   Frost here is not weather — it is stopped time: the air has gone
   to glass, the crown hangs above its throne, and the whole court is
   preserved mid-turn.
   ═════════════════════════════════════════════════════════════════ */

export default function createCrownScene({ renderer, phase = 0, shot = null }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x140428, 0.0046);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3000);
  camera.position.set(0, 22, 92);

  scene.environment = sentinelEnvironment(renderer, 0x0a0318, 0x5b1c8a, 0x060210);

  const sky = createSky({
    top: 0x06020f,
    horizon: 0x5b1c8a,
    glow: 0xf2d0ff,
    aurora: 0x59e0ff,
    auroraAmount: 1,
    moonDir: new THREE.Vector3(-0.18, 0.34, -0.92),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x5c2a92, 0x0a0414, 0.55));

  const key = new THREE.DirectionalLight(0xf0ceff, 2.1);
  key.position.set(-90, 110, -150);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x5ce0ff, 1.5);
  rim.position.set(120, 50, 110);
  scene.add(rim);

  /* the frozen air: a low lens of glass over the court */
  const floor = createSentinelGround({
    size: 1400,
    base: 0x120724,
    peak: 0x38165c,
    amp: 7,
    ridge: 0.26,
    flat: 170,
    roughness: 0.14,
    metalness: 0.84,
    envMapIntensity: 1.6,
    normalTiles: 26,
  });
  scene.add(floor);

  scene.add(createGodShafts({ count: 8, radius: 85, height: 320, color: 0xd9b8ff, opacity: 0.1 }));

  /* the court, stopped mid-turn */
  const court = createFrozenCrowd({
    count: 26,
    radius: 52,
    material: new THREE.MeshStandardMaterial({
      color: 0xb9a6d6,
      roughness: 0.28,
      metalness: 0.55,
      emissive: 0x2a1148,
      emissiveIntensity: 0.5,
    }),
    seed: 11,
  });
  scene.add(court.group);

  /* the crown itself, above an empty throne */
  const crown = new THREE.Group();
  const crownMaterial = new THREE.MeshStandardMaterial({
    color: 0xf0d18a,
    roughness: 0.24,
    metalness: 0.96,
    emissive: 0x6a3a08,
    emissiveIntensity: 0.9,
  });
  const band = new THREE.Mesh(new THREE.TorusGeometry(7, 0.7, 10, 60), crownMaterial);
  band.rotation.x = Math.PI / 2;
  crown.add(band);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.9, 5.4, 5), crownMaterial);
    spike.position.set(Math.cos(a) * 7, 2.4, Math.sin(a) * 7);
    crown.add(spike);
  }
  crown.position.set(0, 26, -60);
  scene.add(crown);

  const throne = new THREE.Mesh(
    new THREE.BoxGeometry(16, 22, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a1240, roughness: 0.5, metalness: 0.6 }),
  );
  throne.position.set(0, 11, -60);
  scene.add(throne);

  const crownHalo = glowSprite("240,208,255", 256, 0.6);
  crownHalo.position.copy(crown.position);
  crownHalo.scale.setScalar(64);
  scene.add(crownHalo);

  /* splinters of the instant, hanging where they stopped */
  const splinters = [];
  const splinterMaterial = new THREE.MeshBasicMaterial({
    color: 0xc9a8ff,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (let i = 0; i < 40; i++) {
    const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(rand(0.4, 1.7), 0), splinterMaterial.clone());
    const a = rand(0, TAU);
    const rad = rand(16, 120);
    shard.position.set(Math.cos(a) * rad, rand(2, 64), Math.sin(a) * rad - 20);
    shard.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
    shard.userData.spin = rand(0.1, 0.5);
    scene.add(shard);
    splinters.push(shard);
  }

  const seal = createSealRune({ radius: 34, color: 0xd0a8ff, opacity: 0.6 });
  seal.mesh.position.z = -56;
  scene.add(seal.mesh);

  const frost = createMotes({ count: 1800, area: 250, height: 100, rgb: "214,188,255", size: 2.2, rise: 0.9 });
  scene.add(frost.points);

  const wards = createWardShards({ count: 5, radius: 30, height: 40, color: 0xd6b0ff, size: 1.2 });
  wards.group.position.z = -56;
  scene.add(wards.group);

  const sentinel = createSentinel({ height: 78, accent: 0xe6c8ff, ringColor: 0xc9a8ff });
  sentinel.group.position.set(0, 0, -330);
  scene.add(sentinel.group);

  /* the two extra vantage points this chapter's middle beats are shot on */
  const SHOTS = {
    close: { focus: [0, 25, -60], distance: 46, height: 27, swing: 0.5 },
    wide: { focus: [0, 42, -280], distance: 300, height: 150, rise: 60, back: 80 },
  };

  /* the vantage points this chapter's beats are shot on */
  const ANCHORS = {
    primary: { focus: [0, 20, -60], distance: 44, height: 20, sway: 3 },
    throne: { focus: [0, 12, -60], distance: 30, height: 12, sway: 2, rise: 36, radius: 34, travel: 60 },
    crown: { focus: [0, 28, -60], distance: 24, height: 34, sway: 1.4, rise: 30, radius: 26, travel: 40 },
    hall: { focus: [0, 40, -270], distance: 300, height: 150, sway: 10, rise: 70, radius: 112, travel: 240, back: 150 },
    guardianSeat: { focus: [0, 46, -320], distance: 150, height: 60, sway: 6, angle: 1.2, rise: 60, radius: 84, travel: 180 },
    aisles: { focus: [0, 16, -56], distance: 56, height: 8, sway: 2, angle: 1.9, rise: 40, radius: 50, travel: 110 },
  };

  const update = (time, delta, pointer) => {
    sky.update(time);
    frost.update(time, delta);
    seal.update(time);
    wards.update(time);
    sentinel.update(time);

    crown.rotation.y = time * 0.14;
    crown.position.y = 26 + Math.sin(time * 0.6) * 1.1;
    crownHalo.material.opacity = 0.42 + Math.sin(time * 1.3) * 0.2;
    crownHalo.scale.setScalar(64 + Math.sin(time * 0.9) * 8);

    for (let i = 0; i < splinters.length; i++) {
      const s = splinters[i];
      s.rotation.x += delta * s.userData.spin * 0.35;
      s.rotation.y += delta * s.userData.spin * 0.5;
    }

    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;

    if (shot) {
      // This beat's own vantage: the anchor is what it looks at, the style how it moves.
      thinFog(scene, 0.0046, shot.style === "aerial" || shot.style === "survey" ? 3 : 4);
      shotBy(camera, ANCHORS[shot.anchor] || ANCHORS.primary, shot.style, time, pointer);
    } else if (phase === 0) {
      const t = clamp01(time / 15);
      const eased = t * t * (3 - 2 * t);
      camera.position.set(
        px * 9 + Math.sin(time * 0.1) * 3.4,
        16 + eased * 24 - py * 2,
        88 - eased * 40,
      );
      camera.lookAt(px * 6, 24 + eased * 8, -120);
    } else if (phase === 1) {
      const t = clamp01(time / 14);
      const eased = t * t * (3 - 2 * t);
      camera.position.set(px * 12, 30 + eased * 40, 46 + eased * 20);
      camera.lookAt(px * 4, 20 + eased * 6, -220);
    } else {
      // The same court from two other vantages: the frozen throne, then the whole hall.
      thinFog(scene, 0.0046, phase);
      shotFor(phase, camera, SHOTS, time, pointer);
    }
  };

  return { scene, camera, baseFov: 42, update, anchors: ANCHORS };
}