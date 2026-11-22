import * as THREE from "three";
import { buildVillage, QUARTER, TAU } from "./villageKit";
import { createNpc, createWanderer } from "./villagePeople";
import { VILLAGE_KEYS, foundKeys } from "./villageFolk";
import { readPlayerLook } from "./villageLook";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { LensShader, enableShadows, followShadow, createFireflies } from "@/components/realmCinematic/finish";

/* ═════════════════════════════════════════════════════════════════
   The walkable engine.

   Third-person movement (WASD / arrows / on-screen stick), a camera
   that follows behind and can be swung by dragging, proximity talk
   prompts, and a two-shot camera that eases in when a conversation
   opens. Nothing here knows the story — it only knows villagers.
   ═════════════════════════════════════════════════════════════════ */

const TALK_RANGE = 3.6;

export function createVillageEngine(canvas, plateLayer, handlers = {}) {
  // Antialiasing is done by an FXAA pass: the bloom stack renders into a half-float target.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;

  const world = buildVillage(renderer, VILLAGE_KEYS);
  const { scene } = world;
  const taken = new Set(handlers.foundKeys || foundKeys());
  world.keys.forEach((key) => {
    key.group.visible = !taken.has(key.id);
  });
  const gateKeys = VILLAGE_KEYS.length;
  let quarterOpen = false;
  let quarterGlow = 0;
  let zoneId = null;

  // The five keys turn in the gate, and the shut half of the village opens.
  const setQuarterOpen = (open) => {
    const next = !!open;
    if (quarterOpen === next) return;
    quarterOpen = next;
    if (quarterOpen) handlers.onQuarterOpen?.();
  };

  // The sky dome is a 620-unit sphere: the far plane has to clear it or the
  // whole sky is clipped away and the village floats on black.
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 2200);
  /* ── film finish: soft shadows from the moon, bloom on every lantern, lens grade ── */
  const moonKey = enableShadows(scene, { extent: 52, mapSize: 2048 });
  const moonOffset = moonKey ? moonKey.position.clone() : new THREE.Vector3(-30, 42, -22);
  const fireflies = createFireflies({ count: 180, radius: 48, height: 10 });
  scene.add(fireflies.points);

  let composer = null;
  let bloom = null;
  let fxaa = null;
  let lens = null;
  try {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.78, 0.85, 0.62);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    fxaa = new ShaderPass(FXAAShader);
    composer.addPass(fxaa);
    lens = new ShaderPass(LensShader);
    lens.uniforms.uVignette.value = 0.4;
    composer.addPass(lens);
  } catch (error) {
    console.warn("Village post-processing unavailable, drawing directly", error);
    composer = null;
  }

  // The wanderer is the character you fight with: same design, same colour.
  const player = createWanderer(readPlayerLook());
  player.group.position.set(0, 0, 22);
  scene.add(player.group);

  const npcs = new Map();
  const keys = new Set();
  const stick = { x: 0, y: 0 };
  let camYaw = 0;
  let camDist = 11.5;
  let nearId = null;
  let focusId = null;
  let frozen = false;
  let dragging = false;
  let lastPointer = null;
  let elapsed = 0;
  let frameId = 0;
  let disposed = false;

  const clock = new THREE.Clock();
  const camLook = new THREE.Vector3(0, 1.7, 0);
  const camPos = new THREE.Vector3(0, 6, 34);
  camPos.set(0, 6, 34);
  camera.position.copy(camPos);
  camera.lookAt(0, 1.7, 0);

  /* ── solid village furniture ───────────────────────────── */

  const obstacles = [];
  world.houses.forEach((house) =>
    obstacles.push({ x: house.x, z: house.z, r: house.blockR ?? house.radius + 0.9 }),
  );
  // The carts stop the player at the counter edge, but a keeper has to be able to
  // stand in front of their own stall, so villagers only clear the counter itself.
  (world.stalls || []).forEach((stall) =>
    obstacles.push({ x: stall.x, z: stall.z, r: 3.0, npcR: 1.5 }),
  );
  obstacles.push({ x: 7.6, z: 3.4, r: 2.8 }, { x: 0, z: -10.5, r: 4.2 }, { x: 0, z: 33, r: 3.2 });

  /* A villager picks somewhere near their haunt to be next. Anything that
     lands inside a cart, a house or the shrine is simply re-rolled. */
  const pickWanderTarget = (entry) => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = Math.random() * TAU;
      const radius = 1.4 + Math.random() * entry.wander;
      const x = entry.home.x + Math.sin(angle) * radius;
      const z = entry.home.z + Math.cos(angle) * radius;
      if (Math.hypot(x, z) > 42) continue;
      if (obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < (o.npcR ?? o.r) + 0.8)) continue;
      entry.target.x = x;
      entry.target.z = z;
      return;
    }
    entry.target.x = entry.home.x;
    entry.target.z = entry.home.z;
  };

  /* ── villagers ─────────────────────────────────────────── */

  const setNpcs = (list = []) => {
    const keep = new Set(list.map((n) => n.id));
    for (const [id, entry] of npcs) {
      if (keep.has(id)) continue;
      scene.remove(entry.fig.group);
      entry.plate?.remove();
      npcs.delete(id);
    }

    list.forEach((data) => {
      const existing = npcs.get(data.id);
      if (existing) {
        existing.data = data;
        existing.plate.innerHTML = `<span>${data.icon || "✦"}</span>${data.name}`;
        existing.plate.style.setProperty("--plate", data.accent || "#9fe3ff");
        return;
      }
      const fig = createNpc({
        accent: data.accent || "#9fe3ff",
        height: data.height || 3.4,
        seed: (data.seed || 1) * 1.7,
        variant: data.variant || "hooded",
      });
      fig.group.position.set(data.x, 0, data.z);
      fig.group.rotation.y = Math.atan2(-data.x, -data.z);
      scene.add(fig.group);

      const plate = document.createElement("div");
      plate.className = "vf-plate";
      plate.style.setProperty("--plate", data.accent || "#9fe3ff");
      plate.innerHTML = `<span>${data.icon || "✦"}</span>${data.name}`;
      plateLayer?.appendChild(plate);

      npcs.set(data.id, {
        data,
        fig,
        plate,
        home: { x: data.x, z: data.z },
        target: { x: data.x, z: data.z },
        wander: data.wander ?? 5,
        speed: data.wanderSpeed ?? 1.5,
        pause: 1.5 + Math.random() * 3.5,
        moving: 0,
        react: 0,
        greet: 1 + Math.random() * 2.5
      });
    });
  };

  /* ── input ─────────────────────────────────────────────── */

  // Typing in a shop field (cyphers, names) must never move the avatar or have
  // its letters cancelled — WASD are ordinary characters there.
  const isTyping = (event) => {
    const el = event.target;
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
  };

  const onKey = (event, down) => {
    const key = event.key?.toLowerCase();
    if (!key) return;
    if (isTyping(event)) {
      keys.clear();
      return;
    }
    if (key === "shift") {
      if (down) keys.add("shift");
      else keys.delete("shift");
      return;
    }
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
      event.preventDefault();
      if (down) keys.add(key);
      else keys.delete(key);
    }
    if (down && (key === "e" || key === "enter") && nearId && !focusId) handlers.onTalk?.(nearId);
  };
  const keyDown = (event) => onKey(event, true);
  const keyUp = (event) => onKey(event, false);
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);

  const onPointerDown = (event) => {
    dragging = true;
    lastPointer = { x: event.clientX, y: event.clientY };
  };
  const onPointerMove = (event) => {
    if (!dragging || !lastPointer) return;
    camYaw -= (event.clientX - lastPointer.x) * 0.006;
    lastPointer = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = () => {
    dragging = false;
    lastPointer = null;
  };
  const onWheel = (event) => {
    event.preventDefault();
    camDist = Math.min(17, Math.max(6.5, camDist + event.deltaY * 0.012));
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  /* ── resize ────────────────────────────────────────────── */

  const resize = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    if (composer) {
      composer.setSize(width, height);
      bloom?.setSize(width, height);
      fxaa.uniforms.resolution.value.set(1 / width, 1 / height);
      lens.uniforms.uRes.value.set(width * renderer.getPixelRatio(), height * renderer.getPixelRatio());
    }
    camera.aspect = width / height;
    camera.fov = width / height < 1.05 ? 66 : 52;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  const observer = new ResizeObserver(resize);
  if (canvas.parentElement) observer.observe(canvas.parentElement);
  resize();

  /* ── the loop ──────────────────────────────────────────── */

  const moveVector = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const desiredCam = new THREE.Vector3();
  const desiredLook = new THREE.Vector3();

  const frame = () => {
    if (disposed) return;
    frameId = requestAnimationFrame(frame);
    const delta = Math.min(clock.getDelta(), 0.05);
    elapsed += delta;
    world.sky.update(elapsed);

    /* movement — camera-relative */
    moveVector.set(0, 0, 0);
    if (!frozen) {
      if (keys.has("w") || keys.has("arrowup")) moveVector.z -= 1;
      if (keys.has("s") || keys.has("arrowdown")) moveVector.z += 1;
      if (keys.has("a") || keys.has("arrowleft")) moveVector.x -= 1;
      if (keys.has("d") || keys.has("arrowright")) moveVector.x += 1;
      moveVector.x += stick.x;
      moveVector.z += stick.y;
    }

    const beforeZ = player.group.position.z;
    const speed = moveVector.length();
    if (speed > 0.05) {
      moveVector.normalize();
      forward.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
      right.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
      const dir = forward.clone().multiplyScalar(-moveVector.z).add(right.multiplyScalar(moveVector.x)).normalize();
      const pace = 6.4 * (keys.has("shift") ? 1.45 : 1);
      player.group.position.addScaledVector(dir, pace * delta);
      const facing = Math.atan2(dir.x, dir.z);
      let diff = ((facing - player.group.rotation.y + Math.PI * 3) % TAU) - Math.PI;
      player.group.rotation.y += diff * Math.min(1, delta * 12);
    }

    /* keep the wanderer on the green and out of the village furniture */
    const pos = player.group.position;
    const radial = Math.hypot(pos.x, pos.z);
    if (radial > 45) {
      pos.x = (pos.x / radial) * 45;
      pos.z = (pos.z / radial) * 45;
    }
    world.houses.forEach((house) => pushOut(pos, house.x, house.z, house.blockR ?? house.radius + 0.9));
    pos.y += (world.heightAt(pos.x, pos.z) - pos.y) * Math.min(1, delta * 12);
    (world.stalls || []).forEach((stall) => pushOut(pos, stall.x, stall.z, 3.0));
    pushOut(pos, 7.6, 3.4, 2.6);
    pushOut(pos, 0, -10.5, 3.8);
    npcs.forEach((entry) => pushOut(pos, entry.fig.group.position.x, entry.fig.group.position.z, 1.25));

    /* the quarter wall is solid — except through a gate that has been opened */
    const band = 0.7;
    const atGate = Math.abs(pos.x) <= QUARTER.gateHalf && quarterOpen;
    if (Math.abs(pos.z - QUARTER.wallZ) < band && !atGate) {
      pos.z = beforeZ <= QUARTER.wallZ ? QUARTER.wallZ - band : QUARTER.wallZ + band;
    }
    if (pos.z > QUARTER.wallZ + band) {
      const inner = QUARTER.half - 0.9;
      if (Math.abs(pos.x) > inner) pos.x = Math.sign(pos.x) * inner;
      if (pos.z > QUARTER.backZ - 0.9) pos.z = QUARTER.backZ - 0.9;
    }

    /* where you are standing, for the villagers' errands */
    const zone = pos.y > 1.7 ? "porch" : pos.z > QUARTER.wallZ + 1.4 ? "quarter" : null;
    if (zone !== zoneId) {
      zoneId = zone;
      if (zone) handlers.onZone?.(zone);
    }

    player.update(elapsed, speed);

    /* nearest villager */
    let best = null;
    let bestDist = TALK_RANGE;
    npcs.forEach((entry, id) => {
      const x = entry.fig.group.position.x;
      const z = entry.fig.group.position.z;
      const d = Math.hypot(pos.x - x, pos.z - z);
      if (d < bestDist) {
        bestDist = d;
        best = id;
      }
    });
    if (best !== nearId) {
      nearId = best;
      handlers.onNear?.(nearId);
    }

    /* hidden keys: a small catch of light in the weeds, and then yours */
    world.keys.forEach((key) => {
      if (!key.group.visible) return;
      key.group.rotation.y = elapsed * 0.7;
      key.group.position.y = key.baseY + Math.sin(elapsed * 1.6 + key.baseY) * 0.08;
      key.halo.material.opacity = 0.2 + Math.sin(elapsed * 2.2) * 0.09;
      if (pos.y < key.minY) return;
      const reach = Math.hypot(pos.x - key.group.position.x, pos.z - key.group.position.z);
      if (reach > 1.6) return;
      key.group.visible = false;
      taken.add(key.id);
      handlers.onKey?.(key.id, taken.size);
      if (taken.size >= gateKeys) setQuarterOpen(true);
    });

    /* the five-lock gate into the Margin Quarter */
    const quarter = world.quarter;
    if (quarter?.gate) {
      const target = quarterOpen ? 1 : 0;
      quarterGlow += (target - quarterGlow) * Math.min(1, delta * 2.2);
      quarter.gateGlow.material.opacity = 0.1 + quarterGlow * 0.45 + Math.sin(elapsed * 1.5) * 0.03;
      quarter.gate.position.y = QUARTER.height * 0.46 - quarterGlow * QUARTER.height * 0.98;
      quarter.locks.forEach((lock, i) => {
        lock.material.emissiveIntensity = 0.22 + quarterGlow * (1.2 + Math.sin(elapsed * 3 + i) * 0.3);
      });
      (quarter.lanterns || []).forEach((lantern, i) => {
        if (lantern.halo) lantern.halo.material.opacity = 0.42 + Math.sin(elapsed * 1.6 + i) * 0.1;
      });
    }

    /* villagers go about the village until someone stops them to talk */
    npcs.forEach((entry, id) => {
      const group = entry.fig.group;
      const nearDist = Math.hypot(pos.x - group.position.x, pos.z - group.position.z);

      /* walk past somebody and they turn, wave, and let you by */
      if (!frozen && entry.react <= 0 && entry.greet <= 0 && nearDist < 4.6 && id !== focusId) {
        entry.react = 1.6;
        entry.greet = 10;
        entry.target.x = group.position.x;
        entry.target.z = group.position.z;
        entry.pause = 1.6;
      }
      if (entry.greet > 0) entry.greet -= delta;
      if (entry.react > 0) entry.react = Math.max(0, entry.react - delta);

      const held = frozen || id === focusId || entry.react > 0;

      if (!held && entry.pause > 0) entry.pause -= delta;
      else if (!held) {
        const dx = entry.target.x - group.position.x;
        const dz = entry.target.z - group.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 0.25) {
          entry.pause = 2.5 + Math.random() * 4.5;
          pickWanderTarget(entry);
        } else {
          const step = Math.min(distance, entry.speed * delta);
          group.position.x += (dx / distance) * step;
          group.position.z += (dz / distance) * step;
          const facing = Math.atan2(dx, dz);
          const turn = ((facing - group.rotation.y + Math.PI * 3) % TAU) - Math.PI;
          group.rotation.y += turn * Math.min(1, delta * 7);
          entry.moving = entry.speed > 0.01 ? Math.min(1, entry.moving + delta * 5) : 0;
        }
      }
      if (held || entry.pause > 0) entry.moving = Math.max(0, entry.moving - delta * 5);

      obstacles.forEach((o) => pushOut(group.position, o.x, o.z, (o.npcR ?? o.r) + 0.5));
      npcs.forEach((other, otherId) => {
        if (otherId === id) return;
        pushOut(group.position, other.fig.group.position.x, other.fig.group.position.z, 1.1);
      });

      if (id === focusId || entry.react > 0) {
        const target = Math.atan2(pos.x - group.position.x, pos.z - group.position.z);
        const diff = ((target - group.rotation.y + Math.PI * 3) % TAU) - Math.PI;
        group.rotation.y += diff * Math.min(1, delta * 6);
      }
      entry.fig.update(elapsed, id === focusId, entry.moving, Math.min(1, entry.react / 0.45));
    });

    world.shrine.shard.rotation.y = elapsed * 0.4;
    world.shrine.shard.position.y = 4.9 + Math.sin(elapsed * 0.9) * 0.14;
    world.shrine.halo.material.opacity = 0.42 + Math.sin(elapsed * 1.3) * 0.1;
    world.arch.veil.material.opacity = 0.12 + Math.sin(elapsed * 0.8) * 0.05;
    world.lanterns.forEach((lantern, i) => {
      lantern.halo.material.opacity = 0.42 + Math.sin(elapsed * 1.8 + i) * 0.1;
    });
    (world.festoons || []).forEach((festoon, i) => {
      festoon.halos.forEach((halo, b) => {
        halo.material.opacity = 0.3 + Math.sin(elapsed * 2.1 + i * 1.3 + b * 0.7) * 0.13;
      });
    });
    (world.stalls || []).forEach((stall, i) => {
      if (stall.halo) stall.halo.material.opacity = 0.45 + Math.sin(elapsed * 1.5 + i) * 0.12;
      if (stall.sigil) stall.sigil.rotation.y = elapsed * 0.8 + i;
    });
    world.houses.forEach((house, i) => {
      if (!house.smoke) return;
      house.smoke.material.opacity = 0.1 + Math.sin(elapsed * 0.7 + i) * 0.04;
      house.smoke.position.y = house.chimney.position.y + 1.1 + ((elapsed * 0.25 + i) % 1.6);
    });

    /* camera: over the shoulder, or a two-shot when talking */
    if (focusId && npcs.has(focusId)) {
      const npcPos = npcs.get(focusId).fig.group.position;
      const mid = npcPos.clone().add(pos).multiplyScalar(0.5);
      const axis = npcPos.clone().sub(pos).setY(0);
      if (axis.lengthSq() < 0.01) axis.set(0, 0, 1);
      axis.normalize();
      const side = new THREE.Vector3(-axis.z, 0, axis.x);
      desiredCam.copy(mid).addScaledVector(side, 7.4).addScaledVector(axis, 1.1);
      desiredCam.y = 3.4;
      desiredLook.copy(mid).add(new THREE.Vector3(0, 1.75, 0));
    } else {
      desiredCam.set(
        pos.x + Math.sin(camYaw) * camDist,
        5.4 + camDist * 0.22,
        pos.z + Math.cos(camYaw) * camDist,
      );
      desiredLook.set(pos.x, pos.y + 1.75, pos.z);
    }
    camPos.lerp(desiredCam, 1 - Math.pow(0.0016, delta));
    camLook.lerp(desiredLook, 1 - Math.pow(0.0009, delta));
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    /* nameplates */
    const rect = canvas.getBoundingClientRect();
    npcs.forEach((entry) => {
      const plate = entry.plate;
      if (!plate) return;
      const world3 = new THREE.Vector3(
        entry.fig.group.position.x,
        entry.fig.height * 1.06,
        entry.fig.group.position.z,
      ).project(camera);
      const dist = Math.hypot(pos.x - entry.fig.group.position.x, pos.z - entry.fig.group.position.z);
      const visible = world3.z < 1 && dist < 22;
      plate.style.opacity = visible ? String(Math.max(0, 1 - (dist - 8) / 16)) : "0";
      if (!visible) return;
      const sx = (world3.x * 0.5 + 0.5) * rect.width;
      const sy = (-world3.y * 0.5 + 0.5) * rect.height;
      plate.style.transform = `translate(-50%,-100%) translate(${sx}px,${sy}px)`;
    });

    fireflies.update(elapsed);
    followShadow(moonKey, player.group.position, moonOffset);
    if (composer) {
      lens.uniforms.uTime.value = elapsed;
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  };

  frameId = requestAnimationFrame(frame);

  /* ── public surface ────────────────────────────────────── */

  return {
    setNpcs,
    setQuarterOpen,
    getKeysTaken: () => taken.size,
    focus(id) {
      focusId = id || null;
      if (!focusId || !npcs.has(focusId)) return;
      const npcPos = npcs.get(focusId).fig.group.position;
      const pos = player.group.position;
      if (Math.hypot(pos.x - npcPos.x, pos.z - npcPos.z) < 4) return;
      // Opened from a card: step up to the villager instead of talking across the green.
      const inward = new THREE.Vector3(-npcPos.x, 0, -npcPos.z);
      if (inward.lengthSq() < 0.01) inward.set(0, 0, 1);
      inward.normalize();
      pos.set(npcPos.x + inward.x * 2.7, 0, npcPos.z + inward.z * 2.7);
      player.group.rotation.y = Math.atan2(-inward.x, -inward.z);
    },
    setFrozen(value) {
      frozen = !!value;
      if (frozen) keys.clear();
    },
    setMove(x, y) {
      stick.x = x;
      stick.y = y;
    },
    talkNearby() {
      if (nearId && !focusId) handlers.onTalk?.(nearId);
    },
    getNear: () => nearId,
    resize,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("wheel", onWheel);
      observer.disconnect();
      npcs.forEach((entry) => entry.plate?.remove());
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (!object.material) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          Object.keys(material).forEach((key) => {
            const value = material[key];
            if (value && value.isTexture) value.dispose();
          });
          material.dispose();
        });
      });
      composer?.dispose();
      renderer.dispose();
    },
  };
}

function pushOut(pos, x, z, radius) {
  const dx = pos.x - x;
  const dz = pos.z - z;
  const dist = Math.hypot(dx, dz);
  if (dist >= radius || dist === 0) return;
  pos.x = x + (dx / dist) * radius;
  pos.z = z + (dz / dist) * radius;
}