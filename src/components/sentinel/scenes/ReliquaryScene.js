import * as THREE from "three";
import { clamp01, createSky, createGroundFog, rand, TAU } from "@/components/glacialArchive/Cutscene";
import { shotBy, shotFor, thinFog } from "../shots";
import {
  createMotes,
  createSealRune,
  createFrozenCrowd,
  createGodShafts,
  createSentinelGround,
  sentinelEnvironment,
} from "../SentinelKit";

/* ═════════════════════════════════════════════════════════════════
   CHAPTER THREE — THE VERDANT RELIQUARY
   A forest grown to a compass. Every tree repeats its neighbour, the
   same leaf falls on the same beat, and a lattice of pale light edits
   the canopy whenever anything begins to differ.
   ═════════════════════════════════════════════════════════════════ */

function createGeometryTree({ height = 26, radius = 4.6, material, trunkMaterial, seed = 0 }) {
  const group = new THREE.Group();

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.15, height * 0.5, 7), trunkMaterial);
  trunk.position.y = height * 0.25;
  group.add(trunk);

  /* stacked faceted crowns — a tree that was drawn, not grown */
  for (let i = 0; i < 3; i++) {
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(radius * (1 - i * 0.22), height * 0.34, 6),
      material,
    );
    crown.position.y = height * (0.42 + i * 0.19);
    crown.rotation.y = seed * 0.4 + i * 0.52;
    group.add(crown);
  }
  return group;
}

export default function createReliquaryScene({ renderer, phase = 0, shot = null }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a2016, 0.0055);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 2400);
  camera.position.set(0, 14, 78);

  scene.environment = sentinelEnvironment(renderer, 0x08201a, 0x2f7a52, 0x05120c);

  const sky = createSky({
    top: 0x04140f,
    horizon: 0x2f8058,
    glow: 0xc8ffd8,
    aurora: 0x7dffa3,
    auroraAmount: 0.55,
    moonDir: new THREE.Vector3(0.1, 0.4, -0.91),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x4f8a68, 0x06120c, 0.6));

  const key = new THREE.DirectionalLight(0xd6ffd9, 2.1);
  key.position.set(-90, 130, -120);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x7dffb0, 1.3);
  rim.position.set(110, 50, 90);
  scene.add(rim);

  const ground = createSentinelGround({
    size: 1900,
    base: 0x12261a,
    peak: 0x2f5d3d,
    amp: 24,
    ridge: 0.4,
    flat: 70,
  });
  scene.add(ground);

  /* the leaf-light itself: shafts falling on the count of nine */
  scene.add(
    createGodShafts({ count: 9, radius: 95, height: 340, color: 0xc4ffd8, opacity: 0.1 }),
  );

  /* foliage lit from inside: sheen and a faceted surface, so a canopy built
     from cones still reads as leaves rather than as painted card */
  const leafMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x2f6b45,
    roughness: 0.76,
    metalness: 0.1,
    clearcoat: 0.34,
    clearcoatRoughness: 0.62,
    sheen: 0.85,
    sheenColor: new THREE.Color(0x9fffc4),
    sheenRoughness: 0.6,
    emissive: 0x0d3a22,
    emissiveIntensity: 0.5,
    envMapIntensity: 1.15,
    flatShading: true,
  });
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3a2c,
    roughness: 0.94,
    metalness: 0.06,
    envMapIntensity: 0.6,
  });

  /* concentric rings of identical trees */
  const trees = [];
  for (let ringIndex = 0; ringIndex < 3; ringIndex++) {
    const ringRadius = 42 + ringIndex * 32;
    const count = 12 + ringIndex * 8;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + ringIndex * 0.12;
      const tree = createGeometryTree({
        height: 24 + ringIndex * 4,
        radius: 4.4 + ringIndex * 0.6,
        material: leafMaterial,
        trunkMaterial,
        seed: i + ringIndex,
      });
      tree.position.set(Math.cos(a) * ringRadius, 0, Math.sin(a) * ringRadius);
      tree.rotation.y = a;
      scene.add(tree);
      trees.push({ group: tree, phase: (i / count) * TAU, ring: ringIndex });
    }
  }

  const seal = createSealRune({ radius: 30, color: 0x9dffbe, opacity: 0.55 });
  scene.add(seal.mesh);

  /* the editing lattice: vertical blades of light that trim the canopy */
  const lattice = new THREE.Group();
  const bladeMaterial = new THREE.MeshBasicMaterial({
    color: 0xb9ffd2,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 90), bladeMaterial);
    blade.position.set(Math.cos(a) * 30, 45, Math.sin(a) * 30);
    blade.rotation.y = -a;
    lattice.add(blade);
  }
  scene.add(lattice);

  const pollen = createMotes({ count: 1700, area: 220, height: 90, rgb: "175,255,205", size: 2.1, rise: 2.2 });
  scene.add(pollen.points);

  const haze = createGroundFog({ size: 720, color: 0x8fd6ac, density: 0.32, y: 2.6 });
  scene.add(haze.mesh);

  const keepers = createFrozenCrowd({
    count: 10,
    radius: 30,
    material: new THREE.MeshStandardMaterial({ color: 0x7f8f7a, roughness: 0.92 }),
    seed: 7,
  });
  scene.add(keepers.group);

  /* No guardian statue in this realm. Its landmark is the Heartwood — the one
     tree the lattice never managed to edit, grown to the size of a tower. */
  const heartwood = createGeometryTree({
    height: 152,
    radius: 28,
    material: new THREE.MeshStandardMaterial({ color: 0x2d6b48, roughness: 0.82, emissive: 0x0e2c1d, emissiveIntensity: 0.8 }),
    trunkMaterial: new THREE.MeshStandardMaterial({ color: 0x1a2a20, roughness: 0.95 }),
    seed: 3,
  });
  heartwood.position.set(-70, 0, -300);
  scene.add(heartwood);

  /* the two extra vantage points this chapter's middle beats are shot on */
  const SHOTS = {
    close: { focus: [0, 32, -28], distance: 44, height: 26, swing: 0.6 },
    wide: { focus: [-70, 36, -230], distance: 290, height: 140, rise: 56, back: 76 },
  };

  /* the vantage points this chapter's beats are shot on */
  const ANCHORS = {
    primary: { focus: [0, 30, -26], distance: 44, height: 24, sway: 3 },
    lattice: { focus: [0, 34, 0], distance: 58, height: 46, sway: 4, angle: 0.9, rise: 70, radius: 72, travel: 140 },
    leaf: { focus: [0, 2, -10], distance: 22, height: 4, sway: 1.2, rise: 40, radius: 30, travel: 60 },
    heartwood: { focus: [-70, 38, -240], distance: 240, height: 120, sway: 8, rise: 80, radius: 92, travel: 210, back: 120 },
    blades: { focus: [0, 40, 0], distance: 70, height: 52, sway: 5, angle: 2.1, rise: 60, radius: 60, travel: 120 },
    roots: { focus: [0, 8, -40], distance: 34, height: 3, sway: 1.6, rise: 46, radius: 34, travel: 76 },
  };

  const update = (time, delta, pointer) => {
    sky.update(time);
    haze.update(time * 1.15);
    pollen.update(time, delta);
    seal.update(time);
    heartwood.rotation.y = Math.sin(time * 0.06) * 0.04;

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      // A synchronised sway: nothing in this forest moves alone.
      t.group.rotation.z = Math.sin(time * 0.6 + t.phase) * 0.018;
      t.group.position.y = Math.sin(time * 0.9 + t.phase) * 0.22;
    }

    lattice.rotation.y = time * 0.06;
    bladeMaterial.opacity = 0.1 + Math.sin(time * 1.1) * 0.06 + (phase === 1 ? 0.12 : 0);

    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;

    if (shot) {
      // This beat's own vantage: the anchor is what it looks at, the style how it moves.
      thinFog(scene, 0.0055, shot.style === "aerial" || shot.style === "survey" ? 3 : 4);
      shotBy(camera, ANCHORS[shot.anchor] || ANCHORS.primary, shot.style, time, pointer);
    } else if (phase === 0) {
      const t = clamp01(time / 15);
      const eased = t * t * (3 - 2 * t);
      camera.position.set(
        px * 8 + Math.sin(time * 0.11) * 3.4,
        10 + eased * 20 - py * 2,
        84 - eased * 44,
      );
      camera.lookAt(px * 6, 18 + eased * 16, -120);
    } else if (phase === 1) {
      const t = clamp01(time / 13);
      const eased = t * t * (3 - 2 * t);
      camera.position.set(px * 10, 30 + eased * 26, 34 + eased * 26);
      camera.lookAt(px * 4, 26 + eased * 10, -180);
    } else {
      // The same forest from two other vantages: the falling leaf close up, then the lattice.
      thinFog(scene, 0.0055, phase);
      shotFor(phase, camera, SHOTS, time, pointer);
    }
  };

  return { scene, camera, baseFov: 44, update, anchors: ANCHORS };
}