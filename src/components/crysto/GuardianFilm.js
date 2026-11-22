import * as THREE from "three";
import { createStage, createGroundFog, rand } from "./CrystoKit";

const FORMS = {
  root: {
    color: 0x7dffa3,
    sky: { top: 0x101d19, horizon: 0x647b61, glow: 0xc6e6a8, aurora: 0x51785b },
    fog: 0x617261,
    sun: 0xc4d8a6,
  },
  ember: {
    color: 0xff9a5c,
    sky: { top: 0x251313, horizon: 0x9a5940, glow: 0xffc18a, aurora: 0xb54d2e },
    fog: 0x88513e,
    sun: 0xffb27a,
  },
  tide: {
    color: 0x6fd0ff,
    sky: { top: 0x101b2c, horizon: 0x6d8797, glow: 0xd8f4ff, aurora: 0x6898bd },
    fog: 0x748b9a,
    sun: 0xc4e4f2,
  },
  matriarch: {
    color: 0xc9a6ff,
    sky: { top: 0x171326, horizon: 0x675779, glow: 0xdac6ff, aurora: 0x876bb7 },
    fog: 0x665b75,
    sun: 0xbba6dd,
  },
};

function makeGuardian(kind, form, glow) {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: form.color,
    roughness: 0.72,
    metalness: kind === "ember" ? 0.28 : 0.08,
    emissive: form.color,
    emissiveIntensity: glow,
    flatShading: true,
  });
  const shadowMat = new THREE.MeshStandardMaterial({
    color: kind === "tide" ? 0x283b53 : kind === "matriarch" ? 0x241d35 : 0x302a27,
    roughness: 0.9,
    flatShading: true,
  });
  const add = (geometry, material, position, scale) => {
    const piece = new THREE.Mesh(geometry, material);
    piece.position.set(position[0], position[1], position[2]);
    piece.scale.set(scale[0], scale[1], scale[2]);
    piece.castShadow = true;
    root.add(piece);
    return piece;
  };
  const limb = (from, to, radius) => {
    const a = new THREE.Vector3(from[0], from[1], from[2]);
    const b = new THREE.Vector3(to[0], to[1], to[2]);
    const piece = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.7, radius, a.distanceTo(b), 6), shadowMat);
    piece.position.copy(a).add(b).multiplyScalar(0.5);
    piece.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    piece.castShadow = true;
    root.add(piece);
  };

  if (kind === "root") {
    add(new THREE.DodecahedronGeometry(2.7, 1), shadowMat, [0, 4.1, 0], [1.35, 1.15, 1]);
    add(new THREE.IcosahedronGeometry(1.05, 0), bodyMat, [0, 5.2, 0.3], [1, 1.1, 0.9]);
    for (const s of [-1, 1]) {
      add(new THREE.DodecahedronGeometry(1.05, 0), shadowMat, [s * 2.5, 4.9, 0], [1.15, 0.9, 1]);
      limb([s * 1.35, 3.8, 0], [s * 1.5, 1.1, 0.3], 0.52);
      add(new THREE.ConeGeometry(0.34, 2.1, 5), bodyMat, [s * 2.6, 6.05, -0.2], [1, 1, 1]);
    }
    for (let i = 0; i < 5; i++) {
      add(new THREE.ConeGeometry(0.24, 1.25, 5), bodyMat, [-1.6 + i * 0.8, 6.25, -0.85], [1, 1, 1]);
    }
  } else if (kind === "ember") {
    add(new THREE.BoxGeometry(2.7, 2.8, 1.7), shadowMat, [0, 4.15, 0], [1, 1, 1]);
    add(new THREE.IcosahedronGeometry(0.85, 0), bodyMat, [0, 6.1, 0.15], [1, 1.15, 1]);
    for (const s of [-1, 1]) {
      limb([s * 1.2, 4.9, 0], [s * 2.1, 3.0, 0.35], 0.34);
      limb([s * 0.72, 2.9, 0], [s * 0.8, 0.65, 0.1], 0.42);
      add(new THREE.ConeGeometry(0.28, 1.6, 5), bodyMat, [s * 0.6, 7.25, 0], [1, 1, 1]);
      const wing = add(new THREE.ConeGeometry(1.45, 3.2, 5), shadowMat, [s * 2.45, 4.9, -0.45], [1.15, 0.62, 0.22]);
      wing.rotation.z = s * -0.72;
    }
    add(new THREE.ConeGeometry(0.32, 1.9, 5), bodyMat, [0, 7.4, 0.1], [1, 1, 1]);
  } else if (kind === "tide") {
    add(new THREE.OctahedronGeometry(2.2, 1), shadowMat, [0, 4.45, 0], [0.95, 1.35, 0.76]);
    add(new THREE.OctahedronGeometry(0.9, 0), bodyMat, [0, 6.6, 0], [0.85, 1.1, 0.8]);
    for (const s of [-1, 1]) {
      limb([s * 1.2, 5.15, 0], [s * 1.75, 3.2, 0.2], 0.26);
      limb([s * 0.7, 3.2, 0], [s * 0.85, 0.55, 0.1], 0.32);
      for (let i = 0; i < 3; i++) {
        const shard = add(new THREE.ConeGeometry(0.32, 1.8 + i * 0.35, 5), bodyMat, [s * (1.55 + i * 0.48), 5.8 - i * 0.42, 0], [1, 1, 1]);
        shard.rotation.z = s * -0.55;
      }
    }
    add(new THREE.ConeGeometry(0.35, 1.8, 5), bodyMat, [0, 8.15, -0.1], [1, 1, 1]);
  } else {
    add(new THREE.SphereGeometry(2.45, 12, 9), shadowMat, [0, 4.6, 0], [1, 1.2, 0.85]);
    add(new THREE.SphereGeometry(1.1, 12, 9), bodyMat, [0, 6.3, 0.45], [1, 1, 1]);
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      const z = -1.6 + (i % 3) * 1.55;
      limb([side * 1.6, 4.0, z], [side * (2.8 + (i % 2) * 0.45), 0.3, z + 0.8], 0.2);
    }
    for (const s of [-1, 1]) {
      const wing = add(new THREE.ConeGeometry(1.8, 4.1, 5), bodyMat, [s * 2.25, 6.3, -0.7], [1.4, 0.5, 0.2]);
      wing.rotation.z = s * -0.8;
    }
    add(new THREE.ConeGeometry(0.36, 2.1, 5), bodyMat, [0, 8.0, 0.6], [1, 1, 1]);
  }
  return root;
}

export function createGuardianFilm(kind, beat) {
  const form = FORMS[kind] || FORMS.root;
  const stage = createStage({
    sky: form.sky,
    fog: form.fog,
    fogDensity: beat === 0 ? 0.014 : 0.008,
    sun: form.sun,
    sunStrength: beat === 2 ? 2 : 1.1,
  });
  const { scene, camera } = stage;
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(22, 56),
    new THREE.MeshStandardMaterial({ color: kind === "ember" ? 0x49332b : kind === "tide" ? 0x31414c : 0x343b34, roughness: 0.94 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  scene.add(floor);

  const sigil = new THREE.Mesh(
    new THREE.RingGeometry(9.8, 10.1, 64),
    new THREE.MeshBasicMaterial({ color: form.color, transparent: true, opacity: beat === 0 ? 0.16 : 0.62, side: THREE.DoubleSide }),
  );
  sigil.rotation.x = -Math.PI / 2;
  sigil.position.y = 0.05;
  scene.add(sigil);

  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const height = 2.2 + ((i * 13) % 18) / 10;
    const stone = new THREE.Mesh(
      new THREE.ConeGeometry(0.75 + (i % 3) * 0.18, height, 5),
      new THREE.MeshStandardMaterial({ color: kind === "tide" ? 0x607a8d : 0x55534c, roughness: 0.94, flatShading: true }),
    );
    stone.position.set(Math.cos(angle) * 16, height / 2, Math.sin(angle) * 16);
    stone.rotation.z = Math.cos(angle) * 0.12;
    stone.castShadow = true;
    scene.add(stone);
  }

  const guardian = makeGuardian(kind, form, beat === 0 ? 0.08 : 0.95);
  guardian.position.y = 0.2;
  scene.add(guardian);

  const aura = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 5.3, 15, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: form.color,
      transparent: true,
      opacity: beat === 0 ? 0.015 : beat === 1 ? 0.08 : 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  aura.position.y = 7.5;
  scene.add(aura);

  const motes = new THREE.Group();
  for (let i = 0; i < 46; i++) {
    const mote = new THREE.Mesh(
      new THREE.SphereGeometry(rand(0.025, 0.07), 6, 5),
      new THREE.MeshBasicMaterial({ color: form.color, transparent: true, opacity: rand(0.22, 0.65) }),
    );
    const angle = rand(0, Math.PI * 2);
    const radius = rand(2.8, 12);
    mote.position.set(Math.cos(angle) * radius, rand(0.2, 11), Math.sin(angle) * radius);
    motes.add(mote);
  }
  scene.add(motes);

  const lamp = new THREE.PointLight(form.color, beat === 0 ? 0.7 : 2.5, 34, 1.5);
  lamp.position.set(0, 8, 2);
  scene.add(lamp);
  const fog = createGroundFog({ size: 52, color: form.color, density: 0.35, y: 0.35 });
  scene.add(fog.mesh);

  const update = (t) => {
    stage.sky.update(t);
    fog.update(t * 0.45);
    guardian.rotation.y = Math.sin(t * 0.22) * 0.18;
    guardian.position.y = 0.2 + Math.sin(t * 0.8) * (kind === "matriarch" ? 0.3 : 0.08);
    sigil.rotation.z = t * (beat === 0 ? 0.02 : 0.12);
    aura.material.opacity = (beat === 0 ? 0.02 : 0.07) + (beat === 2 ? 0.08 : 0.025) * (0.5 + 0.5 * Math.sin(t * 1.8));
    lamp.intensity = (beat === 0 ? 0.7 : 1.8) + Math.max(0, Math.sin(t * 1.7)) * (beat === 2 ? 1.8 : 0.9);
    motes.children.forEach((m, i) => {
      m.position.y = 0.3 + ((m.position.y + t * (0.12 + (i % 4) * 0.025)) % 11);
    });
    const reveal = beat === 0 ? 0 : beat === 1 ? 1 : 2;
    const angle = t * 0.035 + reveal * 0.4;
    const distance = beat === 0 ? 28 : beat === 1 ? 23 : 19;
    camera.position.set(Math.sin(angle) * distance, (beat === 0 ? 13 : 10) + Math.sin(t * 0.16) * 0.5, Math.cos(angle) * distance);
    camera.lookAt(0, kind === "matriarch" ? 4.8 : 4.1, 0);
  };
  return { scene, camera, baseFov: 40, shadowExtent: 30, update };
}

export function guardianScenes(kind) {
  return [0, 1, 2].map((beat) => () => createGuardianFilm(kind, beat));
}
