import * as THREE from "three";
import { clamp01, createSky, createGroundFog, rand } from "@/components/glacialArchive/Cutscene";
import { shotBy, shotFor, thinFog } from "../shots";
import {
  createBraziers,
  createFrozenCrowd,
  createMotes,
  createSealRune,
  glowSprite,
  sentinelEnvironment,
  createStoneCity,
  createRuinField,
  createGodShafts,
  createSentinelGround,
} from "../SentinelKit";

/* ═════════════════════════════════════════════════════════════════
   CHAPTER ONE — THE MARCH OF EMBERS
   A festival city under a dusk that will not end. Braziers burn the
   same flame, the crowd holds the same pose, and the Sentinel stands
   beyond the wall with its eye turned toward the square.
   ═════════════════════════════════════════════════════════════════ */

export default function createMarchScene({ renderer, phase = 0, shot = null }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x2a140a, 0.0034);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 3200);
  camera.position.set(0, 12, 96);

  scene.environment = sentinelEnvironment(renderer, 0x160a24, 0x7a3212, 0x0a0503);

  const sky = createSky({
    top: 0x120820,
    horizon: 0x8a3a16,
    glow: 0xffd2a4,
    aurora: 0xff7a3c,
    auroraAmount: 0.4,
    moonDir: new THREE.Vector3(0.22, 0.1, -1),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x6a3a52, 0x2a1408, 0.5));

  const key = new THREE.DirectionalLight(0xffb070, 2.5);
  key.position.set(-120, 90, -140);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8fa8cc, 0.5);
  fill.position.set(140, 70, 180);
  scene.add(fill);

  const ground = createSentinelGround({
    size: 2600,
    base: 0x281c14,
    peak: 0x54341f,
    amp: 16,
    ridge: 0.45,
    flat: 130,
    roughness: 0.95,
    metalness: 0.12,
  });
  scene.add(ground);

  /* dusk light coming down the road in bars */
  scene.add(
    createGodShafts({ count: 7, radius: 120, height: 300, color: 0xffb27a, opacity: 0.1 }),
  );

  const ruins = createRuinField({ count: 14, radius: 150 });
  scene.add(ruins.group);

  const city = createStoneCity({ rows: 4, perRow: 8, spacing: 38, height: 50, startZ: -70 });
  scene.add(city.group);

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(560, 22, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a3d31, roughness: 0.92, metalness: 0.16 }),
  );
  wall.position.set(0, 11, -250);
  scene.add(wall);

  const braziers = createBraziers({ count: 6, radius: 30 });
  scene.add(braziers.group);

  const crowd = createFrozenCrowd({ count: 18, radius: 40 });
  scene.add(crowd.group);

  const seal = createSealRune({ radius: 27, color: 0xffb45c, opacity: 0.5 });
  scene.add(seal.mesh);

  const embers = createMotes({ count: 1500, area: 250, height: 110, rgb: "255,170,100", size: 2.6, rise: 6 });
  scene.add(embers.points);

  const haze = createGroundFog({ size: 900, color: 0xc4825a, density: 0.34, y: 3.4 });
  scene.add(haze.mesh);

  /* No statue over the square. The landmark is the festival's great brazier
     tower, still burning the same flame it has burned for two hundred years. */
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 13, 96, 10),
    new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.9, metalness: 0.15 }),
  );
  tower.position.set(-18, 48, -370);
  scene.add(tower);

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(11, 30, 8),
    new THREE.MeshBasicMaterial({ color: 0xffb45c, transparent: true, opacity: 0.9 }),
  );
  flame.position.set(-18, 106, -370);
  scene.add(flame);

  const flameGlow = glowSprite("255,180,92", 256, 0.7);
  flameGlow.position.set(-18, 108, -370);
  flameGlow.scale.setScalar(120);
  scene.add(flameGlow);

  /* shards of the seal, thrown outward once the chapter is paid for */
  const shardMaterial = new THREE.MeshBasicMaterial({
    color: 0xffcf8a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shards = [];
  for (let i = 0; i < 26; i++) {
    const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(rand(0.5, 1.5), 0), shardMaterial.clone());
    const a = rand(0, Math.PI * 2);
    mesh.position.set(Math.cos(a) * rand(2, 20), rand(0.4, 2), Math.sin(a) * rand(2, 20));
    mesh.userData.dir = new THREE.Vector3(Math.cos(a), rand(0.2, 1.1), Math.sin(a)).normalize();
    scene.add(mesh);
    shards.push(mesh);
  }

  /* the two extra vantage points this chapter's middle beats are shot on */
  const SHOTS = {
    close: { focus: [0, 12, -22], distance: 46, height: 15, swing: 0.5 },
    wide: { focus: [-18, 72, -320], distance: 260, height: 118, rise: 46, back: 70 },
  };

  /* the vantage points this chapter's beats are shot on */
  const ANCHORS = {
    primary: { focus: [0, 14, -40], distance: 46, height: 14, sway: 3 },
    square: { focus: [0, 6, -18], distance: 34, height: 5, sway: 1.8, rise: 40, radius: 40, travel: 84 },
    wall: { focus: [0, 22, -240], distance: 140, height: 34, sway: 6, rise: 60, radius: 70, travel: 180 },
    brazier: { focus: [-18, 104, -360], distance: 210, height: 120, sway: 8, rise: 60, radius: 84, travel: 160, back: 120 },
    gate: { focus: [0, 18, -240], distance: 96, height: 22, sway: 4, angle: 0.6, rise: 50, radius: 60, travel: 140 },
    street: { focus: [0, 9, -60], distance: 40, height: 2.2, sway: 1.6, rise: 36, radius: 30, travel: 70 },
  };

  const update = (time, delta, pointer) => {
    sky.update(time);
    haze.update(time * 1.2);
    braziers.update(time);
    embers.update(time, delta);
    seal.update(time);
    flame.scale.setScalar(0.9 + Math.sin(time * 3.1) * 0.08 + Math.sin(time * 7.3) * 0.04);
    flameGlow.material.opacity = 0.55 + Math.sin(time * 2.3) * 0.12;
    city.update(time);

    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;

    if (shot) {
      // This beat's own vantage: the anchor is what it looks at, the style how it moves.
      thinFog(scene, 0.0034, shot.style === "aerial" || shot.style === "survey" ? 3 : 4);
      shotBy(camera, ANCHORS[shot.anchor] || ANCHORS.primary, shot.style, time, pointer);
    } else if (phase === 0) {
      // Ground-level approach, then the eye is revealed above the wall.
      const t = clamp01(time / 16);
      const eased = t * t * (3 - 2 * t);
      camera.position.set(
        px * 8 + Math.sin(time * 0.09) * 3.2,
        9 + eased * 26 + Math.sin(time * 0.2) * 0.5 - py * 2,
        92 - eased * 46,
      );
      camera.lookAt(px * 6, 16 + eased * 34, -340);
    } else if (phase === 1) {
      // The seal breaks: the camera lifts and the world lets go of the day.
      const t = clamp01(time / 14);
      const eased = t * t * (3 - 2 * t);
      camera.position.set(
        px * 10 + Math.sin(time * 0.12) * 4,
        14 + eased * 44,
        44 + eased * 34,
      );
      camera.lookAt(px * 5, 20 + eased * 30, -320);
    } else {
      // The same square from two other vantages: the crowd close up, then the city from above.
      thinFog(scene, 0.0034, phase);
      shotFor(phase, camera, SHOTS, time, pointer);
    }

    const burst = clamp01((time - 1.6) / 9);
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i];
      const d = s.userData.dir;
      s.position.x += d.x * delta * (6 + burst * 22);
      s.position.y += (d.y * 12 - burst * 4) * delta;
      s.position.z += d.z * delta * (6 + burst * 22);
      s.rotation.x += delta * 1.6;
      s.rotation.y += delta * 1.1;
      s.material.opacity = phase === 1 ? Math.max(0, burst * 0.9 - clamp01(burst - 0.55) * 1.5) : 0;
    }
  };

  return { scene, camera, baseFov: 44, update, anchors: ANCHORS };
}