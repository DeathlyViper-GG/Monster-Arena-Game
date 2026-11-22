import * as THREE from "three";
import { clamp01, createSky, rand } from "@/components/glacialArchive/Cutscene";
import { shotBy, shotFor, thinFog } from "../shots";
import {
  createGlassSea,
  createMotes,
  createSealRune,
  createWardShards,
  createGodShafts,
  glowSprite,
  sentinelEnvironment,
} from "../SentinelKit";

/* ═════════════════════════════════════════════════════════════════
   CHAPTER TWO — GLASSWATER REACH
   A tide that never turns. Ships hold their exact position on a sea
   like poured glass, and beneath the hulls a seal glows through the
   water, counting a moment that will not pass.
   ═════════════════════════════════════════════════════════════════ */

function createShip({ scale = 1, seed = 0 } = {}) {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x1d2a30, roughness: 0.62, metalness: 0.4 });
  const sailMat = new THREE.MeshStandardMaterial({
    color: 0xcfd9dd,
    roughness: 0.72,
    metalness: 0.1,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
  });

  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(2.4, 14, 6, 14), hullMat);
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(1, 1, 0.55);
  group.add(hull);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 18, 8), hullMat);
  mast.position.y = 9;
  group.add(mast);

  const sail = new THREE.Mesh(new THREE.PlaneGeometry(9, 12, 6, 6), sailMat);
  sail.position.set(0, 10.5, 0);
  const position = sail.geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    position.setZ(i, Math.sin((position.getX(i) / 9) * Math.PI) * 1.5);
  }
  sail.geometry.computeVertexNormals();
  group.add(sail);

  const lantern = glowSprite("190,230,255", 64, 0.7);
  lantern.position.set(0, 17, 0);
  lantern.scale.setScalar(5);
  group.add(lantern);

  group.scale.setScalar(scale);
  group.rotation.y = rand(0, Math.PI * 2);
  group.position.y = 1.4 + seed * 0.01;
  return { group, sail, lantern };
}

export default function createGlasswaterScene({ renderer, phase = 0, shot = null }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a1c26, 0.0042);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3200);
  camera.position.set(0, 16, 88);

  scene.environment = sentinelEnvironment(renderer, 0x061420, 0x2e6a7c, 0x04121a);

  const sky = createSky({
    top: 0x05101c,
    horizon: 0x2f6f84,
    glow: 0xd8f4ff,
    aurora: 0x3ae0ff,
    auroraAmount: 0.75,
    moonDir: new THREE.Vector3(-0.4, 0.28, -0.86),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x3d6b84, 0x04121a, 0.62));

  const moon = new THREE.DirectionalLight(0xd8f2ff, 2.3);
  moon.position.set(-140, 120, -200);
  scene.add(moon);

  const rim = new THREE.DirectionalLight(0x59e0ff, 1.2);
  rim.position.set(120, 40, 140);
  scene.add(rim);

  const sea = createGlassSea({ size: 3000, color: 0x0b2530 });
  sea.mesh.position.y = -1.2;
  scene.add(sea.mesh);

  const ships = [];
  for (let i = 0; i < 7; i++) {
    const ship = createShip({ scale: rand(0.8, 1.5), seed: i });
    const a = (i / 7) * Math.PI * 2 + rand(-0.4, 0.4);
    const rad = rand(70, 210);
    ship.group.position.set(Math.cos(a) * rad, 1.4, Math.sin(a) * rad - 60);
    scene.add(ship.group);
    ships.push(ship);
  }

  const seal = createSealRune({ radius: 40, color: 0x9fe9ff, opacity: 0.65, y: -0.6 });
  seal.mesh.position.z = -30;
  scene.add(seal.mesh);

  const lightShaft = glowSprite("160,235,255", 256, 0.35);
  lightShaft.position.set(0, 6, -30);
  lightShaft.scale.set(120, 120, 1);
  scene.add(lightShaft);

  /* cold daylight dropping through the lid of the ice */
  scene.add(
    createGodShafts({ count: 8, radius: 95, height: 330, color: 0xa8e6ff, opacity: 0.11 }),
  );

  const spray = createMotes({ count: 1100, area: 280, height: 60, rgb: "180,235,255", size: 1.8, rise: 1.6 });
  scene.add(spray.points);

  const wards = createWardShards({ count: 5, radius: 34, height: 34, color: 0xa8ecff, size: 1.1 });
  wards.group.position.z = -30;
  scene.add(wards.group);

  /* The landmark is the frozen wave: spires of ice thrown up where the tide
     stopped, taller than the ships and lit from inside. */
  const spireMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xa9dcef,
    roughness: 0.12,
    metalness: 0.1,
    clearcoat: 1,
    transparent: true,
    opacity: 0.9,
    emissive: 0x16607a,
    emissiveIntensity: 0.9,
  });
  const spires = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const height = 92 + i * 22;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(16 + i * 3, height, 6), spireMaterial);
    spire.position.set((i - 2.5) * 26, height / 2 - 8, -Math.abs(i - 2.5) * 18);
    spire.rotation.z = (i - 2.5) * 0.05;
    spires.add(spire);
  }
  spires.position.set(96, 0, -330);
  scene.add(spires);

  /* the two extra vantage points this chapter's middle beats are shot on */
  const SHOTS = {
    close: { focus: [0, 9, -62], distance: 50, height: 13, swing: 0.42, angle: 0.5 },
    wide: { focus: [96, 76, -300], distance: 300, height: 128, rise: 52, back: 80 },
  };

  /* the vantage points this chapter's beats are shot on */
  const ANCHORS = {
    primary: { focus: [0, 8, -60], distance: 48, height: 12, sway: 3 },
    fleet: { focus: [0, 7, -60], distance: 40, height: 8, sway: 2, angle: 0.5, rise: 30, radius: 48, travel: 92 },
    shaft: { focus: [0, 9, -30], distance: 30, height: 6, sway: 1.4, rise: 30, radius: 26, travel: 44 },
    spires: { focus: [96, 70, -300], distance: 290, height: 130, sway: 10, rise: 70, radius: 100, travel: 240, back: 140 },
    ward: { focus: [0, 12, -30], distance: 62, height: 34, sway: 4, angle: 1.7, rise: 40, radius: 60, travel: 120 },
    ice: { focus: [0, 2, -46], distance: 26, height: 1.6, sway: 1.2, rise: 34, radius: 24, travel: 50 },
  };

  const update = (time, delta, pointer) => {
    sky.update(time);
    sea.update(time);
    spray.update(time, delta);
    seal.update(time);
    wards.update(time);
    spires.rotation.y = Math.sin(time * 0.05) * 0.05;

    for (let i = 0; i < ships.length; i++) {
      const s = ships[i];
      s.group.position.y = 1.4 + Math.sin(time * 0.5 + i) * 0.16;
      s.group.rotation.z = Math.sin(time * 0.42 + i * 1.3) * 0.014;
      s.lantern.material.opacity = 0.5 + Math.sin(time * 2.2 + i) * 0.24;
    }

    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;

    if (shot) {
      // This beat's own vantage: the anchor is what it looks at, the style how it moves.
      thinFog(scene, 0.0042, shot.style === "aerial" || shot.style === "survey" ? 3 : 4);
      shotBy(camera, ANCHORS[shot.anchor] || ANCHORS.primary, shot.style, time, pointer);
    } else if (phase === 0) {
      const t = clamp01(time / 15);
      const eased = t * t * (3 - 2 * t);
      camera.position.set(
        px * 9 + Math.sin(time * 0.1) * 3,
        6 + eased * 12 - py * 2,
        96 - eased * 40,
      );
      camera.lookAt(px * 5, 8 + eased * 8, -180);
    } else if (phase === 1) {
      const t = clamp01(time / 13);
      const eased = t * t * (3 - 2 * t);
      camera.position.set(px * 11, 24 + eased * 30, 52 - eased * 16);
      camera.lookAt(px * 4, 10 + eased * 12, -230);
    } else {
      // The same reach from two other vantages: the held ships close up, then the whole sea.
      thinFog(scene, 0.0042, phase);
      shotFor(phase, camera, SHOTS, time, pointer);
    }

    const flare = clamp01((time - 2) / 8);
    lightShaft.material.opacity = 0.2 + flare * 0.5 * (0.7 + Math.sin(time * 1.7) * 0.3);
    lightShaft.scale.set(120 + flare * 90, 120 + flare * 90, 1);
  };

  return { scene, camera, baseFov: 42, update, anchors: ANCHORS };
}