import * as THREE from "three";
import {
  clamp01,
  createCracks,
  createHoodedFigure,
  createRuneCircle,
  createSky,
  glowTexture,
  rand,
} from "@/components/glacialArchive/Cutscene";
import {
  REALM_LIGHTS,
  createEmbers,
  createPrologueEnvMap,
  createPrologueMaterials,
  createSoulShard,
  rgbOf,
} from "./PrologueKit";

/* ═════════════════════════════════════════════════════════════════
   BEAT IV — THE SHATTERING
   "Their soul was shattered into five — each shard bound to a Warden
    to hold your prison shut. I carry that soul now."
   The First Scribe's soul cracks above a ritual dais and its five
   shards streak away to five distant wardens.
   ═════════════════════════════════════════════════════════════════ */

const ORB_Y = 13;

export default function createShatterScene({ renderer }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x080611, 0.011);
  scene.background = new THREE.Color(0x080611);

  const camera = new THREE.PerspectiveCamera(44, 1, 1, 2000);
  camera.position.set(0, 20, 46);

  scene.environment = createPrologueEnvMap(renderer, { top: 0x06040e, horizon: 0x241a3c, ground: 0x04030a });
  const lib = createPrologueMaterials();

  const sky = createSky({
    top: 0x010208,
    horizon: 0x1c1436,
    glow: 0xcdb4ff,
    aurora: 0x3f2a70,
    auroraAmount: 0.45,
    moonDir: new THREE.Vector3(0, 0.3, -0.95),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x30305c, 0x04030a, 0.7));

  const key = new THREE.DirectionalLight(0xd8ccff, 1.2);
  key.position.set(-40, 80, 60);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9a86ff, 1.5);
  rim.position.set(20, 40, -110);
  scene.add(rim);

  /* the dais */
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(150, 72),
    lib.stone({ color: 0x1a1a2c, roughness: 0.5, metalness: 0.35 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.2;
  scene.add(floor);

  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(7.6, 8.4, 1.6, 8),
    lib.stone({ color: 0x2a2a42, roughness: 0.45, metalness: 0.5 }),
  );
  dais.position.y = 0.8;
  scene.add(dais);

  scene.add(createRuneCircle({ radius: 11, color: 0xbfa8ff, opacity: 0.42, y: 0.12, rings: 2, glyphs: 40 }));
  scene.add(createCracks({ count: 26, start: 4, radius: 90, color: 0xa08cff, y: 0.06 }));

  /* the ring of standing stones that held the ritual */
  const runeStrip = lib.emissive(0xbfa8ff, 1.9);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + 0.2;
    const height = rand(16, 26);
    const radius = 24 + rand(-1.6, 1.6);
    const stone = new THREE.Mesh(
      new THREE.BoxGeometry(rand(4, 6), height, rand(2.4, 3.6)),
      lib.stone({ color: 0x242438, roughness: 0.8, emissive: 0x0c0a1a, emissiveIntensity: 1.2 }),
    );
    stone.position.set(Math.cos(angle) * radius, height / 2 - 0.4, Math.sin(angle) * radius);
    stone.rotation.y = -angle;
    stone.rotation.z = rand(-0.05, 0.05);
    scene.add(stone);

    const glyph = new THREE.Mesh(new THREE.PlaneGeometry(1.5, height * 0.5), runeStrip);
    glyph.position.set(Math.cos(angle) * (radius - 1.9), height * 0.46, Math.sin(angle) * (radius - 1.9));
    glyph.lookAt(0, glyph.position.y, 0);
    scene.add(glyph);
  }

  /* loose soul-light drifting around the dais */
  const motes = [];
  for (let i = 0; i < 18; i++) {
    const mote = new THREE.Mesh(
      new THREE.OctahedronGeometry(rand(0.2, 0.5), 0),
      lib.emissive(0xd8c8ff, 2.6),
    );
    mote.scale.set(1, rand(1.6, 3), 1);
    scene.add(mote);
    motes.push({ mesh: mote, radius: rand(9, 20), speed: rand(0.1, 0.3), y: rand(4, 22), phase: rand(0, Math.PI * 2) });
  }

  /* the Scribe, holding the soul up */
  const scribe = createHoodedFigure({
    height: 4.6,
    material: lib.cloth({
      color: 0x0f1420,
      sheenColor: new THREE.Color(0xbcd0ff),
      sheen: 1,
      roughness: 0.9,
      emissive: 0x0b1a2c,
      emissiveIntensity: 0.9,
    }),
    seed: 1.7,
  });
  scribe.position.set(0, 1.6, -5);
  scene.add(scribe);

  /* the whole soul, before it breaks */
  const orbMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf3e9ff).multiplyScalar(2.4) });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(3.1, 32, 24), orbMaterial);
  orb.position.set(0, ORB_Y, 0);
  scene.add(orb);

  const orbHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "232,220,255"),
      color: 0xe8dcff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  orbHalo.scale.setScalar(34);
  orbHalo.position.copy(orb.position);
  scene.add(orbHalo);

  const orbLight = new THREE.PointLight(0xdcd0ff, 90, 130, 2);
  orbLight.position.copy(orb.position);
  scene.add(orbLight);

  /* the five shards, aimed at the five wardens */
  const shards = REALM_LIGHTS.map((realm, i) => {
    const angle = -0.95 + (i / (REALM_LIGHTS.length - 1)) * 1.9;
    const target = new THREE.Vector3(
      Math.sin(angle) * 420,
      70 + Math.cos(angle * 1.7) * 26,
      -Math.cos(angle) * 420,
    );
    const mesh = createSoulShard({ color: realm.color, size: 1.5 });
    mesh.position.copy(orb.position);
    scene.add(mesh);

    const gate = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(128, rgbOf(realm.color)),
        color: realm.color,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    gate.scale.setScalar(80);
    gate.position.copy(target);
    scene.add(gate);

    return { mesh, gate, target, delay: 2.6 + i * 0.12, travel: 5.4 };
  });

  const dust = createEmbers({ count: 1700, area: 120, height: 70, size: 1.5, color: 0xcfc0ff });
  scene.add(dust.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    dust.update(time);

    /* the soul strains, then cracks and lets go */
    const strain = clamp01(time / 2.6);
    const broken = clamp01((time - 2.4) / 2);
    orb.visible = broken < 0.98;
    orb.scale.setScalar(1 + strain * 0.16 - broken * 0.55);
    orbMaterial.color.setHex(0xf3e9ff).multiplyScalar(2.4 + Math.sin(time * 6.2) * 0.5 + strain * 1.4);
    orbHalo.material.opacity = 0.55 + 0.2 * Math.sin(time * 4.1) + strain * 0.25;
    orbLight.intensity = 90 + Math.sin(time * 5.4) * 14 + strain * 40 + broken * 60;
    orb.rotation.y = time * 0.6;

    scribe.rotation.y = Math.sin(time * 0.25) * 0.05;
    scribe.position.y = 1.6 + Math.sin(time * 0.8) * 0.06;

    for (const mote of motes) {
      const a = time * mote.speed + mote.phase;
      mote.mesh.position.set(
        Math.cos(a) * mote.radius,
        mote.y + Math.sin(time * 0.8 + mote.phase) * 1.6,
        Math.sin(a) * mote.radius,
      );
      mote.mesh.rotation.set(time * 1.1 + mote.phase, time * 1.5, time * 0.8);
    }

    for (const shard of shards) {
      const p = clamp01((time - shard.delay) / shard.travel);
      const eased = p * p * (3 - 2 * p);
      shard.mesh.position.lerpVectors(orb.position, shard.target, eased);
      shard.mesh.position.y += Math.sin(time * 2 + shard.delay) * 2.2 * (1 - eased);
      shard.mesh.rotation.set(time * 1.6, time * 2.1, time * 0.9);
      shard.mesh.scale.setScalar(1 - eased * 0.45);
      shard.mesh.visible = p > 0;
      shard.gate.material.opacity = 0.2 + 0.35 * clamp01(p);
    }

    const intro = clamp01(time / 14);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;
    const orbit = Math.sin(time * 0.13) * 0.5;

    camera.position.set(
      px * 8 + Math.sin(orbit) * 30,
      18 + eased * 8 - (pointer?.y ?? 0) * 6,
      46 + Math.cos(orbit) * 24 - eased * 14,
    );
    camera.lookAt(px * 4, ORB_Y - 1 + eased * 2, 0);
  };

  return { scene, camera, baseFov: 44, update };
}