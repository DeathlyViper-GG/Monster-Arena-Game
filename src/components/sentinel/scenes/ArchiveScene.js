import * as THREE from "three";
import { clamp01, createSky, createGroundFog, rand } from "@/components/glacialArchive/Cutscene";
import { shotBy, shotFor, thinFog } from "../shots";
import {
  createMotes,
  createRuinField,
  createSealRune,
  createTabletField,
  createGodShafts,
  glowSprite,
  sentinelEnvironment,
} from "../SentinelKit";

/* ═════════════════════════════════════════════════════════════════
   CHAPTER FOUR — THE SUNKEN ARCHIVE
   A library buried to the roof-beams. Tablets drift in the dust of a
   collapsed reading hall, and one vault at the centre still holds the
   Sentinel's original command — with its final line missing.
   ═════════════════════════════════════════════════════════════════ */

function createDuneField({ material }) {
  const geometry = new THREE.PlaneGeometry(2800, 2800, 180, 180);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const h =
      Math.sin(x * 0.0042) * 9 +
      Math.cos(y * 0.0036) * 7 +
      Math.sin((x + y) * 0.0021) * 12;
    position.setZ(i, h);
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

export default function createArchiveScene({ renderer, phase = 0, shot = null }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x2a1c10, 0.0044);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 3200);
  camera.position.set(0, 20, 92);

  scene.environment = sentinelEnvironment(renderer, 0x1a1020, 0x8a5a2a, 0x0b0805);

  const sky = createSky({
    top: 0x160c1e,
    horizon: 0xd09858,
    glow: 0xffe6bc,
    aurora: 0xffb070,
    auroraAmount: 0.3,
    moonDir: new THREE.Vector3(0.3, 0.16, -0.94),
  });
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(0x8a6a4a, 0x1a1208, 0.55));

  const key = new THREE.DirectionalLight(0xffc890, 2.6);
  key.position.set(-110, 80, -160);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9fb6d2, 0.5);
  fill.position.set(150, 60, 160);
  scene.add(fill);

  const sand = createDuneField({
    material: new THREE.MeshStandardMaterial({ color: 0x8a6236, roughness: 0.97, metalness: 0.03 }),
  });
  scene.add(sand);

  /* amber light coming through the roof of dust */
  scene.add(
    createGodShafts({ count: 7, radius: 110, height: 320, color: 0xffd7a0, opacity: 0.1 }),
  );

  const ruins = createRuinField({ count: 12, radius: 160, material: new THREE.MeshStandardMaterial({ color: 0x6a5236, roughness: 0.95 }) });
  scene.add(ruins.group);

  /* the reading hall: a ring of broken columns holding up nothing */
  const columnMaterial = new THREE.MeshStandardMaterial({ color: 0x8a7454, roughness: 0.9, metalness: 0.1 });
  const columns = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const h = rand(26, 44);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(rand(1.6, 2.4), 2.1, h, 12), columnMaterial);
    column.position.set(Math.cos(a) * 46, h / 2 - 4, Math.sin(a) * 46 - 30);
    column.rotation.z = rand(-0.04, 0.04);
    scene.add(column);
    columns.push(column);
  }

  const tablets = createTabletField({ count: 30, radius: 60, height: 34 });
  scene.add(tablets.group);

  const seal = createSealRune({ radius: 32, color: 0xffd79a, opacity: 0.6 });
  seal.mesh.position.z = -30;
  scene.add(seal.mesh);

  const vaultGlow = glowSprite("255,225,170", 256, 0.5);
  vaultGlow.position.set(0, 16, -30);
  vaultGlow.scale.setScalar(70);
  scene.add(vaultGlow);

  const dust = createMotes({ count: 1900, area: 240, height: 90, rgb: "255,214,160", size: 2.2, rise: 1.8 });
  scene.add(dust.points);

  const haze = createGroundFog({ size: 820, color: 0xcf9c62, density: 0.4, y: 4.2 });
  scene.add(haze.mesh);

  /* The realm's landmark is the library itself: a colossal half-buried dome,
     its crown split open and still lit from inside. */
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(94, 30, 20),
    new THREE.MeshStandardMaterial({ color: 0x6a5133, roughness: 0.92, metalness: 0.06 }),
  );
  dome.scale.y = 0.58;
  dome.position.set(60, -22, -320);
  scene.add(dome);

  const domeLight = glowSprite("255,224,168", 256, 0.6);
  domeLight.position.set(60, 34, -320);
  domeLight.scale.setScalar(150);
  scene.add(domeLight);

  /* the two extra vantage points this chapter's middle beats are shot on */
  const SHOTS = {
    close: { focus: [0, 16, -30], distance: 40, height: 15, swing: 0.46, angle: -0.4 },
    wide: { focus: [60, 40, -250], distance: 280, height: 132, rise: 50, back: 74 },
  };

  /* the vantage points this chapter's beats are shot on */
  const ANCHORS = {
    primary: { focus: [0, 14, -30], distance: 40, height: 14, sway: 2.5 },
    vault: { focus: [0, 18, -30], distance: 26, height: 18, sway: 1.6, rise: 34, radius: 30, travel: 60 },
    tablets: { focus: [0, 10, -30], distance: 54, height: 6, sway: 2, angle: -0.4, rise: 26, radius: 40, travel: 90 },
    dome: { focus: [60, 30, -290], distance: 250, height: 120, sway: 9, rise: 70, radius: 92, travel: 220, back: 130 },
    colonnade: { focus: [0, 20, -30], distance: 66, height: 30, sway: 4, angle: 1.4, rise: 50, radius: 60, travel: 130 },
    floor: { focus: [0, 4, -34], distance: 30, height: 2.5, sway: 1.4, rise: 40, radius: 26, travel: 60 },
  };

  const update = (time, delta, pointer) => {
    sky.update(time);
    haze.update(time * 1.3);
    dust.update(time, delta);
    tablets.update(time);
    seal.update(time);
    domeLight.material.opacity = 0.45 + Math.sin(time * 0.9) * 0.12;

    for (let i = 0; i < columns.length; i++) {
      columns[i].material.emissiveIntensity = 0;
    }

    const px = pointer?.x ?? 0;
    const py = pointer?.y ?? 0;

    if (shot) {
      // This beat's own vantage: the anchor is what it looks at, the style how it moves.
      thinFog(scene, 0.0044, shot.style === "aerial" || shot.style === "survey" ? 3 : 4);
      shotBy(camera, ANCHORS[shot.anchor] || ANCHORS.primary, shot.style, time, pointer);
    } else if (phase === 0) {
      const t = clamp01(time / 16);
      const eased = t * t * (3 - 2 * t);
      camera.position.set(
        px * 9 + Math.sin(time * 0.09) * 3.6,
        16 + eased * 22 - py * 2,
        94 - eased * 50,
      );
      camera.lookAt(px * 6, 16 + eased * 10, -140);
    } else if (phase === 1) {
      // The missing line surfaces: the vault opens and the dust lifts.
      const t = clamp01(time / 13);
      const eased = t * t * (3 - 2 * t);
      camera.position.set(px * 10, 26 + eased * 34, 40 + eased * 22);
      camera.lookAt(px * 4, 14 + eased * 16, -200);
    } else {
      // The same vault from two other vantages: the fallen tablets, then the buried hall.
      thinFog(scene, 0.0044, phase);
      shotFor(phase, camera, SHOTS, time, pointer);
    }

    const open = clamp01((time - 2.2) / 7);
    vaultGlow.material.opacity = 0.32 + open * 0.55 * (0.75 + Math.sin(time * 1.4) * 0.25);
    vaultGlow.scale.setScalar(70 + open * 60);
  };

  return { scene, camera, baseFov: 44, update, anchors: ANCHORS };
}