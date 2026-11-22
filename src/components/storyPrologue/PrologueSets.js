import * as THREE from "three";
import {
  TAU,
  rand,
  glowTexture,
  createRock,
  createDeadTree,
} from "@/components/glacialArchive/Cutscene";
import { createChain } from "@/components/cinderIntro/CinderKit";
import { REALM_LIGHTS, rgbOf } from "./PrologueKit";

/* ═════════════════════════════════════════════════════════════════
   THE PROLOGUE — the three big sets:
     · the sealed vault of the Hollow  (beat II)
     · the dust empire of Nhalori      (beat III)
     · the Hollow King himself         (beat V)
   ═════════════════════════════════════════════════════════════════ */

const VIOLET = 0x9a4cff;

/* ── the vault: a colossal door held shut by five seals ───── */

export function createSealWall({ materials }) {
  const group = new THREE.Group();
  const stone = materials.stone({ color: 0x2b3243, roughness: 0.92, emissive: 0x070a14, emissiveIntensity: 1.1 });
  const trim = materials.stone({ color: 0x3d475c, roughness: 0.84, emissive: 0x080b16, emissiveIntensity: 1.1 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x252b38, roughness: 0.44, metalness: 0.92, emissive: 0x0a0714, emissiveIntensity: 0.8 });

  const door = new THREE.Mesh(new THREE.BoxGeometry(152, 176, 14), stone);
  door.position.set(0, 88, 0);
  group.add(door);

  for (const side of [-1, 1]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(48, 214, 48), stone);
    tower.position.set(side * 98, 107, -8);
    group.add(tower);

    const crown = new THREE.Mesh(new THREE.ConeGeometry(36, 48, 4), trim);
    crown.position.set(side * 98, 238, -8);
    crown.rotation.y = Math.PI / 4;
    group.add(crown);

    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(4.4, 158, 4.4), trim);
      rib.position.set(side * 98 + (i - 1.5) * 10, 96, 19);
      group.add(rib);
    }
  }

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(152, 32, 24), trim);
  lintel.position.set(0, 190, 4);
  group.add(lintel);

  /* the five seals, set in an arc across the door */
  const seals = [];
  REALM_LIGHTS.forEach((realm, i) => {
    const x = (i - 2) * 27;
    const y = 88 + Math.cos(((i - 2) / 2) * 0.85) * 13;
    const base = new THREE.Color(realm.color);

    const ringMaterial = new THREE.MeshBasicMaterial({ color: base.clone() });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(9.4, 1.3, 10, 44), ringMaterial);
    ring.position.set(x, y, 7.6);
    group.add(ring);

    const coreMaterial = new THREE.MeshBasicMaterial({ color: base.clone() });
    const core = new THREE.Mesh(new THREE.SphereGeometry(3.6, 20, 14), coreMaterial);
    core.position.set(x, y, 8.2);
    group.add(core);

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(128, rgbOf(realm.color)),
        color: realm.color,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    halo.scale.setScalar(38);
    halo.position.set(x, y, 10);
    group.add(halo);

    seals.push({ ring, core, halo, base, phase: i * 0.83 });
  });

  /* chains binding it shut */
  group.add(
    createChain({ from: new THREE.Vector3(-74, 158, 15), to: new THREE.Vector3(70, 26, 15), radius: 1.1, material: iron }),
    createChain({ from: new THREE.Vector3(74, 158, 15), to: new THREE.Vector3(-68, 24, 15), radius: 1.1, material: iron }),
    createChain({ from: new THREE.Vector3(-96, 210, 20), to: new THREE.Vector3(-96, 40, 20), radius: 0.9, material: iron }),
    createChain({ from: new THREE.Vector3(96, 210, 20), to: new THREE.Vector3(96, 40, 20), radius: 0.9, material: iron }),
  );

  /* what bleeds through the seams */
  const crackMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(VIOLET).multiplyScalar(2.4) });
  for (let i = 0; i < 10; i++) {
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(rand(0.7, 2.4), rand(28, 118)), crackMaterial);
    crack.position.set(rand(-64, 64), rand(22, 130), 7.3);
    crack.rotation.z = rand(-0.55, 0.55);
    group.add(crack);
  }

  const bleed = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, rgbOf(VIOLET)),
      color: VIOLET,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  bleed.scale.setScalar(420);
  bleed.position.set(0, 92, -24);
  group.add(bleed);

  const bleedLight = new THREE.PointLight(VIOLET, 90, 520, 2);
  bleedLight.position.set(0, 90, 34);
  group.add(bleedLight);

  group.userData.update = (time) => {
    for (const seal of seals) {
      const pulse = 1.5 + Math.sin(time * 1.6 + seal.phase) * 0.7;
      seal.ring.material.color.copy(seal.base).multiplyScalar(pulse);
      seal.core.material.color.copy(seal.base).multiplyScalar(pulse * 1.5);
      seal.halo.material.opacity = 0.3 + 0.2 * Math.sin(time * 1.4 + seal.phase);
    }
    // the door strains, a hair, against the seals
    door.position.x = Math.sin(time * 7.3) * 0.14;
    bleedLight.intensity = 72 + 26 * Math.sin(time * 2.1) + 14 * Math.sin(time * 5.7);
  };

  return group;
}

/* ── Nhalori: an empire that crumbled to dust ─────────────── */

export function createRuinedEmpire({ materials }) {
  const group = new THREE.Group();
  const stone = materials.stone({ color: 0x5b4a37, roughness: 0.96, emissive: 0x160d05, emissiveIntensity: 1.1 });
  const sand = materials.stone({ color: 0x866f4e, roughness: 1, emissive: 0x120a04, emissiveIntensity: 1 });

  for (const row of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const z = -36 - i * 40;
      const x = row * (52 + i * 4);
      const height = rand(26, 56) * (i > 4 ? 0.55 : 1);
      const column = new THREE.Mesh(
        new THREE.CylinderGeometry(rand(3.2, 4.4), rand(4.6, 5.8), height, 16, 4),
        stone,
      );
      column.position.set(x + rand(-4, 4), height / 2 - 1.2, z);
      column.rotation.z = rand(-0.12, 0.12);
      group.add(column);

      if (i % 2 === 0) {
        const capital = new THREE.Mesh(new THREE.CylinderGeometry(6, 4.6, 2.6, 12), sand);
        capital.position.set(column.position.x, height - 0.4, z);
        group.add(capital);
      }
      if (i === 2 || i === 5) {
        const fallen = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, rand(16, 30), 12, 2), stone);
        fallen.position.set(x + rand(10, 26) * row, 3.4, z + rand(6, 16));
        fallen.rotation.z = Math.PI / 2;
        fallen.rotation.y = rand(0, TAU);
        group.add(fallen);
      }
    }
  }

  const arch = new THREE.Mesh(new THREE.TorusGeometry(48, 5.6, 8, 30, Math.PI * 0.88), stone);
  arch.position.set(0, 48, -128);
  arch.rotation.z = 0.14;
  group.add(arch);

  for (let i = 0; i < 24; i++) {
    const rubble = createRock({ radius: rand(1.6, 6.4), detail: 1, material: sand, seed: i * 2.7 });
    rubble.position.set(rand(-72, 72), rand(-1.4, 1.4), rand(-230, 12));
    group.add(rubble);
  }

  for (let i = 0; i < 5; i++) {
    const tree = createDeadTree({ height: rand(11, 19), material: stone, detail: 2 });
    tree.position.set(rand(-84, 84), -1.6, rand(-190, -50));
    group.add(tree);
  }

  /* the King's throne-spire, far down the avenue */
  const monolith = new THREE.Mesh(
    new THREE.BoxGeometry(36, 136, 22),
    materials.stone({ color: 0x14121c, roughness: 0.62, metalness: 0.3, emissive: 0x22103c, emissiveIntensity: 1.3 }),
  );
  monolith.position.set(0, 66, -252);
  group.add(monolith);

  for (let i = 0; i < 7; i++) {
    const a = -0.92 + (i / 6) * 1.84;
    const horn = new THREE.Mesh(new THREE.ConeGeometry(2.8, rand(20, 36), 6), stone);
    horn.position.set(Math.sin(a) * 17, 136 + Math.cos(a) * 7, -252);
    horn.rotation.z = -a * 0.75;
    horn.rotation.x = 0.14;
    group.add(horn);
  }

  const crownGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, rgbOf(VIOLET)),
      color: VIOLET,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  crownGlow.scale.setScalar(150);
  crownGlow.position.set(0, 120, -246);
  group.add(crownGlow);

  return group;
}

/* ── the Hollow King: a darkness with one eye ─────────────── */

export function createHollowPresence({ materials }) {
  const group = new THREE.Group();
  const skin = materials.stone({
    color: 0x0a0811,
    roughness: 0.74,
    metalness: 0.26,
    emissive: 0x1b0b32,
    emissiveIntensity: 1.25,
  });

  const mass = new THREE.Mesh(new THREE.SphereGeometry(88, 52, 38), skin);
  mass.scale.set(1, 1.14, 0.92);
  group.add(mass);

  for (const side of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(58, 13, 17), skin);
    brow.position.set(side * 27, 24, 62);
    brow.rotation.z = side * -0.26;
    group.add(brow);
  }

  const iris = new THREE.Mesh(
    new THREE.TorusGeometry(26, 3.6, 12, 52),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(VIOLET).multiplyScalar(2.6) }),
  );
  iris.position.set(0, 0, 66);
  group.add(iris);

  const pupil = new THREE.Mesh(
    new THREE.SphereGeometry(15, 26, 20),
    new THREE.MeshBasicMaterial({ color: 0x02010a }),
  );
  pupil.position.set(0, 0, 62);
  pupil.scale.z = 0.42;
  group.add(pupil);

  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(6.6, 20, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xdcaaff).multiplyScalar(4) }),
  );
  spark.position.set(0, 0, 71);
  group.add(spark);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, rgbOf(VIOLET)),
      color: VIOLET,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.scale.setScalar(320);
  halo.position.set(0, 0, 84);
  group.add(halo);

  const eyeLight = new THREE.PointLight(0xa964ff, 120, 560, 2);
  eyeLight.position.set(0, 0, 96);
  group.add(eyeLight);

  for (let i = 0; i < 11; i++) {
    const a = -1.12 + (i / 10) * 2.24;
    const horn = new THREE.Mesh(new THREE.ConeGeometry(rand(4, 7.4), rand(32, 62), 6), skin);
    horn.position.set(Math.sin(a) * 54, 80 + Math.cos(a) * 11, 16 - Math.abs(Math.sin(a)) * 30);
    horn.rotation.z = -Math.sin(a) * 0.62;
    horn.rotation.x = -0.26;
    group.add(horn);
  }

  const iron = new THREE.MeshStandardMaterial({ color: 0x2b2434, roughness: 0.48, metalness: 0.92 });
  for (let i = 0; i < 5; i++) {
    const x = rand(-74, 74);
    group.add(
      createChain({
        from: new THREE.Vector3(x, 280, rand(-40, 40)),
        to: new THREE.Vector3(x * 0.45, 54, rand(-16, 34)),
        radius: 1.7,
        material: iron,
      }),
    );
  }

  return { group, iris, pupil, spark, eyeLight, halo, mass };
}