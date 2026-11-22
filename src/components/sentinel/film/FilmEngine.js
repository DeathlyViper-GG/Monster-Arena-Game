import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { LensShader, enableShadows } from "@/components/realmCinematic/finish";
import { shotBy } from "../shots";
import { createActorFor } from "./actors";
import { createFx, RUN, scanCues } from "./cues";
import { createVoice } from "./voice";

/* ═════════════════════════════════════════════════════════════════
   THE FILM ENGINE — Age of the Sentinel as a directed, playable movie.

   • One live 3D world at a time, with real actors standing in it. The people
     who speak the lines are on screen, turn to face you, move their hands and
     heads on their own words, and are heard (a voice per character).
   • A shot plan per line: an establishing move over the thing the line is
     about, a medium on the speaker, then an insert or close — the camera
     flies between them, it does not cut to a fresh scene.
   • Word cues: when the speaker reaches "the leaf falls", "nine signatures",
     "the seal breaks", the world does it (see cues.js).
   • You are in the movie: drag to look around, WASD / arrows to drift the
     camera, wheel or pinch to zoom, F to fly a free camera anywhere while the
     scene plays on, Space to speed a line up, A to toggle autoplay, P to pause.
   Everything the player chooses goes back through onChoice, exactly as before.
   ═════════════════════════════════════════════════════════════════ */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const ease = (t) => t * t * (3 - 2 * t);

const EXPO = { archive: 0.62, meadow: 0.88, ice: 0.82, lava: 0.86, court: 0.92, void: 0.9 };
const VOICE_OF = { "Ilyra": 0, "Sable of the Reliquary": 1, "Orrin the Unfrozen": 2, "Maren Tidewright": 3, "Vesh, the Ninth": 4, "The Sentinel": 5 };

function parseShot(shot) {
  const [world, vantage] = String(shot || "meadow:primary/orbit").split(":");
  const [anchor, style] = String(vantage || "primary/orbit").split("/");
  return { world, anchor: anchor || "primary", style: style || "orbit" };
}

export function createFilm({ container, film, buildWorld, title, onChoice, onDone, accent = "#e8fff2", autoplay = true }) {
  /* ── renderer & post stack ── */
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.78;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const root = document.createElement("div");
  root.className = "sfilm";
  root.tabIndex = 0;
  root.innerHTML = `
    <style>${CSS}</style>
    <div class="sf-bar sf-top"></div><div class="sf-bar sf-bot"></div>
    <div class="sf-flash"></div><div class="sf-fade"></div>
    <div class="sf-title"><div class="k"></div><div class="t"></div><div class="rule"></div><div class="s"></div></div>
    <div class="sf-sub"><div class="who"><i></i><span></span></div><div class="txt"></div><div class="next">click · space</div></div>
    <div class="sf-choices"></div>
    <div class="sf-ui">
      <button data-a="auto">Auto ▶</button><button data-a="free">Free camera</button><button data-a="sound">Sound on</button><button data-a="skip">Skip ▸▸</button>
    </div>
    <div class="sf-hint"></div><div class="sf-paused">PAUSED</div>`;
  root.insertBefore(renderer.domElement, root.firstChild);
  container.appendChild(root);
  root.style.setProperty("--ac", accent);
  const $ = (s) => root.querySelector(s);
  const el = { sub: $(".sf-sub"), who: $(".sf-sub .who span"), icon: $(".sf-sub .who i"), txt: $(".sf-sub .txt"), next: $(".sf-sub .next"), choices: $(".sf-choices"), flash: $(".sf-flash"), fade: $(".sf-fade"), title: $(".sf-title"), hint: $(".sf-hint"), paused: $(".sf-paused"), ui: $(".sf-ui") };

  const voice = createVoice();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3000);
  const dummy = new THREE.PerspectiveCamera(42, 1, 0.1, 3000);
  let composer = null, renderPass = null, bloom = null, fxaa = null, lens = null;
  const setupPost = (scene) => {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(Math.max(2, size.x), Math.max(2, size.y), { type: THREE.HalfFloatType }));
    renderPass = new RenderPass(scene, camera);
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.8, 0.82);
    fxaa = new ShaderPass(FXAAShader); lens = new ShaderPass(LensShader);
    composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(fxaa); composer.addPass(lens);
  };

  /* ── beats ── */
  const normalise = (b) => ({ ...parseShot(b.shot), who: b.who || "", text: b.caption || "", choices: b.choices || null });
  const queue = film.beats.map(normalise);
  let index = -1, beat = null;

  /* ── worlds ── */
  const worlds = {};
  let W = null;                                     // active world
  const ray = new THREE.Raycaster();
  function world(name) {
    if (worlds[name]) return worlds[name];
    const built = buildWorld(name, { renderer });
    if (!built || !built.scene) return null;
    const w = { name, built, scene: built.scene, anchors: built.anchors || {}, time: Math.random() * 6, fx: createFx(built.scene), actors: {}, cast: new THREE.Group(), key: null };
    w.cast.userData.film = true; w.scene.add(w.cast);
    try { w.key = enableShadows(w.scene, { extent: 110, mapSize: 2048 }); } catch (_) {}
    w.meshes = []; w.scene.traverse((o) => { if (o.isMesh && !o.isSprite && o.geometry) w.meshes.push(o); });
    worlds[name] = w; return w;
  }
  const groundAt = (w, x, z) => {
    ray.set(new THREE.Vector3(x, 400, z), new THREE.Vector3(0, -1, 0));
    const hits = ray.intersectObjects(w.meshes, false).filter((h) => {
      let o = h.object, skip = false;
      while (o) { if (o.userData && o.userData.film) skip = true; o = o.parent; }
      const m = h.object.material;
      return !skip && h.object.isMesh && m && !m.transparent && m.side !== THREE.BackSide && h.face && h.face.normal.y > 0.55 && h.point.y > -6 && h.point.y < 24;
    });
    return hits.length ? hits[hits.length - 1].point.y : 0;
  };

  /* ── stage & cast for the current beat ── */
  const stage = new THREE.Vector3(), focus = new THREE.Vector3();
  let speaker = null, companion = null, ground = 0, shotPlan = [], beatT = 0, beatDur = 8, camStart = false;
  const actorOf = (w, name) => {
    if (!w.actors[name]) { const a = createActorFor(name); a.group.visible = false; w.cast.add(a.group); w.actors[name] = a; }
    return w.actors[name];
  };
  function stageBeat() {
    const a = W.anchors[beat.anchor] || W.anchors.primary || { focus: [0, 10, -30], distance: 40, height: 14 };
    focus.set(a.focus[0], a.focus[1], a.focus[2]);
    const d = a.distance || 40, stand = clamp(d * 0.4, 6, 30);
    const sx = clamp(focus.x * 0.5, -22, 22), sz = focus.z > -70 ? focus.z + stand : -26;
    const sScale = clamp(d * 0.045, 1.0, 4.0);
    ground = groundAt(W, sx, sz); stage.set(sx, ground, sz);
    Object.values(W.actors).forEach((x) => { x.group.visible = false; x.setSpeaking(false); });
    speaker = beat.who ? actorOf(W, beat.who) : null;
    companion = null;
    if (speaker && speaker.kind === "colossus") {
      speaker.group.position.set(stage.x * 0.4, groundAt(W, stage.x * 0.4, stage.z - 74), stage.z - 74);
      speaker.group.scale.setScalar(1.1); speaker.group.visible = true;
    } else if (speaker) {
      const s = sScale;
      speaker.group.scale.setScalar(s * (speaker.height / 1.9));
      speaker.group.position.copy(stage); speaker.group.visible = true;
      speaker.group.userData.walk = { from: new THREE.Vector3(stage.x + 1.4 * s, ground, stage.z - 2.6 * s), t: 0 };
      if (beat.who !== "Ilyra") {
        companion = actorOf(W, "Ilyra");
        companion.group.scale.setScalar(s * (companion.height / 1.9));
        const off = 2.1 * s, cg = groundAt(W, stage.x - off, stage.z + 0.3 * off);
        companion.group.position.set(stage.x - off, cg, stage.z + 0.3 * off); companion.group.visible = true;
      }
    } else { speaker = null; }
  }

  /* ── camera shot plan ── */
  const eye = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const shake = { v: 0 };
  function planShots() {
    const len = beat.text.length, big = speaker && speaker.kind === "colossus";
    const side = (index % 2 ? 1 : -1) * (0.35 + 0.25 * ((index * 7) % 3) / 2);
    const cueHint = beat.text.length > 60;
    shotPlan = big
      ? [{ k: 0, type: "estab" }, { k: 0.3, type: "low", side }, { k: 0.7, type: "eye", side: -side }]
      : speaker
        ? [{ k: 0, type: "estab" }, { k: 0.28, type: "medium", side }, { k: 0.66, type: cueHint ? "insert" : "close", side: -side }]
        : [{ k: 0, type: "estab" }, { k: 0.5, type: "insert", side }];
  }
  function poseFor(type, side, bt, out) {
    const a = W.anchors[beat ? beat.anchor : "primary"] || W.anchors.primary;
    const style = beat ? beat.style : "orbit";
    let fov = 42;
    if (type === "estab" || !speaker) {
      dummy.position.set(0, 0, 0); shotBy(dummy, a, style, bt, { x: 0, y: 0 });
      out.pos.copy(dummy.position); dummy.getWorldDirection(tmp); out.tgt.copy(dummy.position).addScaledVector(tmp, 80); fov = 44;
      if (type === "insert" || type === "close") { out.pos.copy(focus).add(tmp2.set(Math.sin(side * 2 + bt * 0.05) * a.distance * 0.5, a.height * 0.3, Math.cos(side * 2 + bt * 0.05) * a.distance * 0.5)); out.tgt.copy(focus); fov = 36; }
    } else {
      speaker.eye(eye);
      const h = speaker.kind === "colossus" ? 24 : speaker.height * speaker.group.scale.x;
      const baseYaw = Math.atan2(camera.position.x - speaker.group.position.x, camera.position.z - speaker.group.position.z);
      const front = (yaw, d, up) => out.pos.set(speaker.group.position.x + Math.sin(yaw) * d, speaker.group.position.y + up, speaker.group.position.z + Math.cos(yaw) * d);
      const push = ease(clamp(bt / 7, 0, 1));
      if (type === "medium") { front(side + (companion ? 0.15 : 0), h * (3.6 - push * 0.7), h * 0.82); out.tgt.copy(eye).add(tmp.set(-side * h * 0.35, -h * 0.12, 0)); fov = 40; }
      else if (type === "close") { front(side, h * (2.5 - push * 0.4), h * 0.92); out.tgt.copy(eye).add(tmp.set(-side * h * 0.1, -h * 0.04, 0)); fov = 32; }
      else if (type === "low") { front(side * 0.7, h * 1.35, 2.5); out.tgt.set(speaker.group.position.x, speaker.group.position.y + h * 0.62, speaker.group.position.z); fov = 52; }
      else if (type === "eye") { front(side * 0.4, h * 0.62, h * 0.76); out.tgt.copy(eye); fov = 34; }
      else if (type === "insert") { out.pos.copy(focus).add(tmp2.set(Math.sin(side * 2 + bt * 0.06) * a.distance * 0.45, a.height * 0.28 + 2, Math.cos(side * 2 + bt * 0.06) * a.distance * 0.45 + 4)); out.tgt.copy(focus); fov = 38; }
      void baseYaw;
    }
    out.fov = fov; return out;
  }

  /* ── player control state ── */
  const ctl = { yaw: 0, pitch: 0, idle: 9, mx: 0, my: 0, mz: 0, zoom: 1, free: false, fpos: new THREE.Vector3(), fyaw: 0, fpitch: 0, keys: {}, down: false, moved: 0, last: null };
  const cur = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), fov: 42, init: false };
  const want = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), fov: 42 };

  /* ── dialogue state ── */
  let typed = 0, pause = 0, holdT = 0, auto = autoplay, paused = false, phase = "title", phaseT = 0, dead = false, firedCues = new Set(), lastWord = 0, wordCount = 0, awaitingChoice = false, dim = { v: 1, target: 1, hold: 0 }, flashV = 0, fadeV = 1;
  let pendingFollow = null;

  const setHint = () => { el.hint.textContent = ctl.free ? "FREE CAMERA — drag to look · WASD fly · Q/E down/up · Shift fast · F or R returns to the film" : "Drag to look · WASD drift · wheel zoom · F free camera · Space continue · V autoplay · P pause"; };
  setHint();

  function startBeat(i) {
    index = i; beat = queue[i];
    const w = world(beat.world); if (!w) { advance(true); return; }
    if (W !== w) {
      W = w; fadeV = 1; if (!composer) setupPost(W.scene); else renderPass.scene = W.scene;
      cur.init = false; ctl.mx = ctl.my = ctl.mz = 0;
    }
    stageBeat(); planShots();
    typed = 0; pause = 0.35; holdT = 0; beatT = 0; firedCues = new Set(); wordCount = 0; lastWord = 0; awaitingChoice = false;
    beatDur = Math.max(4.5, beat.text.length / 24 + 2);
    const sp = beat.who || "";
    el.who.textContent = sp || "—"; el.sub.classList.toggle("nar", !sp); el.sub.classList.toggle("big", /sentinel/i.test(sp));
    el.icon.textContent = /sentinel/i.test(sp) ? "◈" : sp ? sp[0] : "·";
    el.txt.textContent = ""; el.choices.classList.remove("show"); el.choices.innerHTML = ""; el.next.style.opacity = 0;
    el.sub.style.opacity = 1;
    if (!ctl.free) { ctl.idle = 9; }
  }

  function advance(force) {
    if (phase === "out") return;
    if (awaitingChoice) return;
    const next = index + 1;
    if (next >= queue.length) { endFilm(); return; }
    // short dip between lines of the same world, a proper fade when the world changes
    const nb = queue[next], same = W && nb.world === W.name;
    if (same) { startBeat(next); fadeV = Math.max(fadeV, same ? 0.0 : 1); flashV = Math.max(flashV, 0); }
    else startBeat(next);
  }

  function endFilm() { phase = "out"; phaseT = 0; el.sub.style.opacity = 0; el.choices.classList.remove("show"); }
  function finish() { if (dead) return; const cb = onDone; dispose(); cb && cb(); }

  function showChoices() {
    awaitingChoice = true; voice.thump(0.7);
    el.choices.innerHTML = beat.choices.map((c, i) => `<button data-i="${i}"><b>${i + 1}</b><span>${esc(c.label)}</span><small>${esc(c.sub || "")}</small></button>`).join("");
    el.choices.classList.add("show");
    el.choices.querySelectorAll("button").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); pick(+b.dataset.i); }));
  }
  function pick(i) {
    const c = beat.choices && beat.choices[i]; if (!c) return;
    awaitingChoice = false; el.choices.classList.remove("show");
    try { onChoice && onChoice(c.value); } catch (_) {}
    if (c.follow) { const f = normalise(c.follow); queue.splice(index + 1, 0, f); }
    // the chosen branch may not be in the queue order of the authored beats: skip sibling follow-ups
    advance(true);
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ── effects context ── */
  const accentCol = new THREE.Color(accent);
  const cueCtx = () => ({ fx: W.fx, stage, focus, ground, accent: accentCol, speaker, shake: (a) => { shake.v = Math.max(shake.v, a); }, dim: (a, s) => { dim.target = a; dim.hold = s; }, flash: (a) => { flashV = Math.max(flashV, a); } });

  /* ── per-frame ── */
  let last = performance.now(), raf = 0, tAll = 0;
  function frame(now) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const rdt = Math.min(window.__FILM_DT_CAP || 0.05, (now - last) / 1000); last = now;
    const dt = paused ? 0 : rdt; tAll += dt; phaseT += dt;

    if (phase === "title") {
      if (!W) { const w = world(queue[0].world); if (w) { W = w; if (!composer) setupPost(W.scene); } }
      if (phaseT > 0.6) el.title.classList.add("show");
      if (phaseT > 3.6) { el.title.classList.remove("show"); }
      if (phaseT > 4.4) { phase = "beats"; startBeat(0); fadeV = 1; }
    } else if (phase === "out") {
      fadeV = Math.min(1, phaseT / 1.2); if (fadeV >= 1) { finish(); return; }
    }

    if (W) {
      W.time += dt;
      // typing / speaking
      if (phase === "beats" && beat) {
        const rate = beat.who && /sentinel/i.test(beat.who) ? 20 : 34;
        const full = beat.text.length;
        if (!awaitingChoice && typed < full) {
          if (pause > 0) pause -= dt; else {
            const before = typed; typed = Math.min(full, typed + dt * rate);
            const upto = Math.floor(typed), from = Math.floor(before);
            for (let i = from; i < upto; i++) {
              const ch = beat.text[i];
              if (ch === " " || i === full - 1) {
                wordCount++; const nxt = beat.text[i - 1];
                const emph = /[.?!]/.test(nxt || "") ? 1 : /[,;—:]/.test(nxt || "") ? 0.5 : 0;
                voice.say(VOICE_OF[beat.who] ?? 0, emph, /[?]/.test(nxt || "") ? 1 : emph ? -0.6 : Math.sin(wordCount * 0.9) * 0.4);
                if (speaker && (wordCount % 5 === 0 || emph)) speaker.gesture(emph ? 1 : 0.55);
                if (speaker && emph >= 1) speaker.nod();
              }
              if (/[,.;?!—]/.test(ch)) pause = ch === "," || ch === ";" ? 0.16 : ch === "—" ? 0.22 : 0.38;
            }
            scanCues(beat.text, from, upto + 1, firedCues).slice(0, 2).forEach((n) => { try { RUN[n](cueCtx()); voice.thump(n === "heart" || n === "crack" ? 1 : 0.5); } catch (e) { console.warn("cue", n, e); } });
          }
          el.txt.textContent = beat.text.slice(0, Math.floor(typed));
          if (speaker) speaker.setSpeaking(pause <= 0);
        } else {
          if (speaker) speaker.setSpeaking(false);
          el.txt.textContent = beat.text; el.next.style.opacity = beat.choices ? 0 : 0.8;
          if (beat.choices && !awaitingChoice) showChoices();
          else if (!awaitingChoice) { holdT += dt; if (auto && holdT > 1.4 + beat.text.length * 0.03) advance(); }
        }
        beatT += dt;
      }

      // actors
      const camPos = camera.position;
      Object.values(W.actors).forEach((a) => {
        if (!a.group.visible) return;
        const w = a.group.userData.walk;
        if (w && a.kind !== "colossus") { w.t = Math.min(1, w.t + dt / 1.4); const e = ease(w.t); const target = a === speaker ? stage : null; if (target) a.group.position.set(w.from.x + (target.x - w.from.x) * e, w.from.y + (target.y - w.from.y) * e, w.from.z + (target.z - w.from.z) * e); }
        // body turns toward the viewer's camera, slowly
        const yaw = Math.atan2(camPos.x - a.group.position.x, camPos.z - a.group.position.z);
        let d = yaw - a.group.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        a.group.rotation.y += d * Math.min(1, dt * (a.kind === "colossus" ? 0.8 : 2.4));
        a.lookAt(camPos); a.update(tAll, dt);
        if (a === companion || (a !== speaker && a.kind === "person")) a.mood(0.2);
      });
      W.fx.update(dt);
      W.built.update(W.time, dt, { x: 0, y: 0 });                         // the world's own motion (sky, motes, lights)

      // camera
      const bt = phase === "title" ? tAll : beatT; let seg = shotPlan[0] || { k: 0, type: "estab", side: 0 };
      const k = clamp(bt / beatDur, 0, 1); for (const s of shotPlan) if (k >= s.k) seg = s;
      if (!ctl.free) {
        poseFor(seg.type, seg.side || 0, bt, want);
        if (!cur.init) { cur.pos.copy(want.pos); cur.tgt.copy(want.tgt); cur.fov = want.fov; cur.init = true; }
        const rate = awaitingChoice ? 1.2 : 2.3;
        cur.pos.x = damp(cur.pos.x, want.pos.x, rate, rdt); cur.pos.y = damp(cur.pos.y, want.pos.y, rate, rdt); cur.pos.z = damp(cur.pos.z, want.pos.z, rate, rdt);
        cur.tgt.x = damp(cur.tgt.x, want.tgt.x, rate * 1.3, rdt); cur.tgt.y = damp(cur.tgt.y, want.tgt.y, rate * 1.3, rdt); cur.tgt.z = damp(cur.tgt.z, want.tgt.z, rate * 1.3, rdt);
        cur.fov = damp(cur.fov, want.fov, rate, rdt);
        ctl.idle += rdt; if (ctl.idle > 1.6 && !ctl.down) { ctl.yaw = damp(ctl.yaw, 0, 1.4, rdt); ctl.pitch = damp(ctl.pitch, 0, 1.4, rdt); }
        const mv = 14 * rdt, kk = ctl.keys;
        // drift the camera in its own frame (left/right, forward/back); the offsets ease home slowly
        dummy.position.copy(cur.pos); dummy.lookAt(cur.tgt);
        const fwd = tmp.set(0, 0, -1).applyQuaternion(dummy.quaternion).setY(0).normalize(), right = tmp2.set(1, 0, 0).applyQuaternion(dummy.quaternion).setY(0).normalize();
        const ax = (kk.d || kk.arrowright ? 1 : 0) - (kk.a || kk.arrowleft ? 1 : 0), az = (kk.w || kk.arrowup ? 1 : 0) - (kk.s || kk.arrowdown ? 1 : 0);
        ctl.mx = clamp(ctl.mx + ax * 11 * rdt, -22, 22); ctl.mz = clamp(ctl.mz + az * 11 * rdt, -22, 22); if (!ax) ctl.mx = damp(ctl.mx, 0, 0.35, rdt); if (!az) ctl.mz = damp(ctl.mz, 0, 0.35, rdt); void mv;
        camera.position.copy(cur.pos).addScaledVector(right, ctl.mx).addScaledVector(fwd, ctl.mz);
        tmp.copy(cur.tgt).sub(cur.pos);                                   // look direction, then yawed/pitched by the player's drag
        const dist = tmp.length(); const yaw0 = Math.atan2(tmp.x, tmp.z) + ctl.yaw, pit0 = Math.asin(clamp(tmp.y / dist, -1, 1)) + ctl.pitch;
        camera.lookAt(camera.position.x + Math.sin(yaw0) * Math.cos(pit0) * dist, camera.position.y + Math.sin(pit0) * dist, camera.position.z + Math.cos(yaw0) * Math.cos(pit0) * dist);
        camera.fov = cur.fov * ctl.zoom;
      } else {
        const kk = ctl.keys, sp = (kk.shift ? 70 : 22) * rdt;
        dummy.rotation.set(ctl.fpitch, ctl.fyaw, 0, "YXZ");
        const fw = tmp.set(0, 0, -1).applyQuaternion(dummy.quaternion), rt = tmp2.set(1, 0, 0).applyQuaternion(dummy.quaternion);
        if (kk.w || kk.arrowup) ctl.fpos.addScaledVector(fw, sp); if (kk.s || kk.arrowdown) ctl.fpos.addScaledVector(fw, -sp);
        if (kk.d || kk.arrowright) ctl.fpos.addScaledVector(rt, sp); if (kk.a || kk.arrowleft) ctl.fpos.addScaledVector(rt, -sp);
        if (kk.e) ctl.fpos.y += sp; if (kk.q) ctl.fpos.y -= sp;
        camera.position.copy(ctl.fpos); camera.rotation.set(ctl.fpitch, ctl.fyaw, 0, "YXZ"); camera.fov = 52 * ctl.zoom;
      }
      // handheld breath + shake
      shake.v = Math.max(0, shake.v - rdt * 1.6);
      camera.position.x += Math.sin(tAll * 1.7) * 0.05 + (Math.random() - 0.5) * shake.v * 0.9; camera.position.y += Math.sin(tAll * 1.3) * 0.04 + (Math.random() - 0.5) * shake.v * 0.9;
      camera.updateProjectionMatrix();
      // keep the world's own camera in step (sky domes and fog read it)
      W.built.camera.position.copy(camera.position); W.built.camera.quaternion.copy(camera.quaternion);

      // dimming / flash / fade
      if (dim.hold > 0) dim.hold -= dt; else dim.target = 1;
      dim.v = damp(dim.v, dim.target, 3, rdt); renderer.toneMappingExposure = 0.74 * (EXPO[W.name] || 1) * dim.v;
      flashV = Math.max(0, flashV - rdt * 1.8); el.flash.style.opacity = flashV;
      if (phase !== "out") fadeV = Math.max(0, fadeV - rdt * 1.3);
      el.fade.style.opacity = phase === "title" ? 1 : fadeV;
      if (lens) { lens.uniforms.uTime.value = tAll; lens.uniforms.uAberration.value = 0.0013 + flashV * 0.004 + shake.v * 0.002; }
      if (composer) composer.render(); else renderer.render(W.scene, camera);
    }
  }

  /* ── input ── */
  const onKey = (e) => {
    const k = e.key.toLowerCase(), dn = e.type === "keydown";
    if (["w", "a", "s", "d", "q", "e", "shift", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { ctl.keys[k] = dn; if (k.startsWith("arrow") || k === " ") e.preventDefault(); return; }
    if (!dn) return;
    voice.resume();
    if (k === " " || k === "enter") { e.preventDefault(); userAdvance(); }
    else if (k === "v") toggleAuto();
    else if (k === "f") toggleFree(); else if (k === "r" && ctl.free) toggleFree();
    else if (k === "p") togglePause(); else if (k === "m") toggleSound();
    else if (k === "escape") { e.preventDefault(); endFilm(); }
    else if (["1", "2", "3"].includes(k) && awaitingChoice) pick(+k - 1);
  };
  window.addEventListener("keydown", onKey, true); window.addEventListener("keyup", onKey, true);
  function userAdvance() {
    if (phase === "title") { phaseT = Math.max(phaseT, 4.4); return; }
    if (!beat || awaitingChoice) return;
    if (typed < beat.text.length) { typed = beat.text.length; pause = 0; } else advance();
  }
  const toggleAuto = () => { auto = !auto; root.querySelector('[data-a="auto"]').textContent = auto ? "Auto ▶" : "Auto ❚❚"; };
  const togglePause = () => { paused = !paused; el.paused.style.opacity = paused ? 1 : 0; };
  const toggleSound = () => { voice.setMuted(!voice.muted); root.querySelector('[data-a="sound"]').textContent = voice.muted ? "Sound off" : "Sound on"; };
  function toggleFree() {
    ctl.free = !ctl.free;
    if (ctl.free) { ctl.fpos.copy(camera.position); const e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ"); ctl.fyaw = e.y; ctl.fpitch = e.x; }
    root.querySelector('[data-a="free"]').textContent = ctl.free ? "Back to film" : "Free camera"; root.classList.toggle("free", ctl.free); setHint();
  }
  root.querySelectorAll(".sf-ui button").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); voice.resume(); const a = b.dataset.a; if (a === "auto") toggleAuto(); else if (a === "free") toggleFree(); else if (a === "sound") toggleSound(); else if (a === "skip") endFilm(); }));
  const ptr = (e) => ({ x: e.clientX, y: e.clientY });
  root.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; voice.resume(); ctl.down = true; ctl.moved = 0; ctl.last = ptr(e); try { root.setPointerCapture(e.pointerId); } catch (_) {} });
  root.addEventListener("pointermove", (e) => {
    if (!ctl.down) return; const p = ptr(e), dx = p.x - ctl.last.x, dy = p.y - ctl.last.y; ctl.last = p; ctl.moved += Math.abs(dx) + Math.abs(dy); ctl.idle = 0;
    if (ctl.free) { ctl.fyaw -= dx * 0.0042; ctl.fpitch = clamp(ctl.fpitch - dy * 0.0042, -1.5, 1.5); }
    else { ctl.yaw = clamp(ctl.yaw - dx * 0.0042, -1.0, 1.0); ctl.pitch = clamp(ctl.pitch - dy * 0.0036, -0.55, 0.55); }
  });
  root.addEventListener("pointerup", (e) => { const wasClick = ctl.moved < 6; ctl.down = false; try { root.releasePointerCapture(e.pointerId); } catch (_) {} if (wasClick && !e.target.closest("button")) userAdvance(); });
  root.addEventListener("wheel", (e) => { e.preventDefault(); ctl.zoom = clamp(ctl.zoom * (1 + Math.sign(e.deltaY) * 0.07), 0.45, 1.6); }, { passive: false });
  let pinch = 0;
  root.addEventListener("touchmove", (e) => { if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pinch) ctl.zoom = clamp(ctl.zoom * (pinch / d), 0.45, 1.6); pinch = d; } }, { passive: true });
  root.addEventListener("touchend", () => { pinch = 0; });

  function resize() {
    const w = container.clientWidth || window.innerWidth, h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%";
    camera.aspect = w / h; camera.updateProjectionMatrix();
    Object.values(worlds).forEach((x) => { x.built.camera.aspect = w / h; x.built.camera.updateProjectionMatrix(); });
    if (composer) { composer.setSize(w, h); bloom.setSize(w, h); const pr = renderer.getPixelRatio(); fxaa.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr)); lens.uniforms.uRes.value.set(w * pr, h * pr); }
  }
  window.addEventListener("resize", resize);
  const ro = new ResizeObserver(resize); ro.observe(container);
  // the pass objects are created lazily with the first world, so re-fit once they exist
  const poll = setInterval(() => { if (composer) { resize(); clearInterval(poll); } }, 100);

  // title card
  $(".sf-title .k").textContent = (title && title.kicker) || ""; $(".sf-title .t").textContent = (title && title.title) || ""; $(".sf-title .s").textContent = (title && title.sub) || "";
  $(".sf-title").style.color = accent;
  resize(); raf = requestAnimationFrame(frame);

  function dispose() {
    if (dead) return; dead = true; cancelAnimationFrame(raf); clearInterval(poll); ro.disconnect();
    window.removeEventListener("keydown", onKey, true); window.removeEventListener("keyup", onKey, true); window.removeEventListener("resize", resize);
    voice.dispose();
    Object.values(worlds).forEach((w) => { try { w.built.dispose && w.built.dispose(); } catch (_) {} });
    try { composer && composer.dispose(); renderer.dispose(); } catch (_) {}
    root.remove();
  }
  const debug = () => ({ cam: camera.position.toArray().map((v) => +v.toFixed(1)), spk: speaker ? speaker.group.position.toArray().map((v) => +v.toFixed(1)) : null, rotY: speaker ? +speaker.group.rotation.y.toFixed(2) : null, scale: speaker ? +speaker.group.scale.x.toFixed(2) : null, stage: stage.toArray().map((v) => +v.toFixed(1)), focus: focus.toArray(), ground, seg: shotPlan.map((x) => x.type), bt: +beatT.toFixed(1), want: want.pos.toArray().map((v) => +v.toFixed(1)) });
  return { dispose, root, debug, get state()  { return { phase, index, free: ctl.free, typed, who: beat && beat.who, world: W && W.name, cues: W ? W.fx.count : 0, auto }; }, pick, skip: endFilm, advance: userAdvance, toggleFree, toggleAuto };
}

const CSS = `
.sfilm{position:absolute;inset:0;background:#000;overflow:hidden;color:#fff;font-family:ui-serif,Georgia,serif;user-select:none;-webkit-user-select:none;touch-action:none;outline:none;cursor:grab}
.sfilm.free{cursor:crosshair}.sfilm canvas{position:absolute;inset:0;display:block}
.sf-bar{position:absolute;left:0;right:0;height:8.5vh;background:#000;z-index:3}.sf-top{top:0}.sf-bot{bottom:0}
.sf-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:4;mix-blend-mode:screen}.sf-fade{position:absolute;inset:0;background:#000;pointer-events:none;z-index:5;opacity:1}
.sf-title{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:none;opacity:0;transition:opacity 1s}.sf-title.show{opacity:1}
.sf-title .k{font:800 clamp(10px,1.2vw,14px)/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.5em;opacity:.85;margin-bottom:20px}
.sf-title .t{font:700 clamp(30px,6vw,86px)/1.05 ui-serif,Georgia,serif;letter-spacing:.06em;text-shadow:0 0 50px currentColor,0 4px 30px #000;padding:0 6vw}
.sf-title .rule{width:min(46vw,520px);height:2px;margin-top:22px;background:linear-gradient(90deg,transparent,currentColor,transparent)}
.sf-title .s{margin-top:22px;font:600 clamp(12px,1.6vw,20px)/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.26em;text-transform:uppercase;opacity:.8;color:#eee}
.sf-sub{position:absolute;left:0;right:0;bottom:calc(8.5vh + 14px);padding:0 9vw;text-align:center;z-index:7;pointer-events:none;transition:opacity .4s}
.sf-sub .who{display:inline-flex;align-items:center;gap:10px;font:800 clamp(11px,1.2vw,14px)/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:var(--ac);text-shadow:0 0 18px var(--ac);margin-bottom:10px}
.sf-sub .who i{font-style:normal;width:26px;height:26px;border-radius:50%;display:inline-grid;place-items:center;border:1px solid var(--ac);background:rgba(0,0,0,.55);font-size:13px}
.sf-sub.nar .who{display:none}
.sf-sub .txt{display:inline-block;max-width:1020px;font-size:clamp(17px,2.2vw,29px);line-height:1.5;color:#f6f1e7;text-shadow:0 2px 16px #000,0 0 36px rgba(0,0,0,.95);padding:6px 20px;border-radius:10px;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.28));min-height:1.5em}
.sf-sub.nar .txt{font-style:italic;color:#e6dfd2}.sf-sub.big .txt{font-family:ui-sans-serif,system-ui,sans-serif;font-weight:700;letter-spacing:.07em;font-size:clamp(15px,1.9vw,25px);color:#ffe3b0;text-shadow:0 0 22px #ff9a2a,0 2px 14px #000}
.sf-sub .next{margin-top:8px;font:700 10px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.55);transition:opacity .4s}
.sf-choices{position:absolute;left:0;right:0;bottom:calc(8.5vh + 112px);z-index:8;display:flex;gap:14px;justify-content:center;padding:0 6vw;opacity:0;pointer-events:none;transition:opacity .5s;flex-wrap:wrap}.sf-choices.show{opacity:1;pointer-events:auto}
.sf-choices button{cursor:pointer;min-width:230px;max-width:420px;text-align:left;padding:14px 18px;border-radius:14px;border:1px solid var(--ac);background:linear-gradient(180deg,rgba(12,14,22,.9),rgba(4,5,10,.92));color:#fff;box-shadow:0 0 28px color-mix(in srgb,var(--ac) 35%,transparent);transition:transform .15s,background .15s;font-family:inherit}
.sf-choices button:hover{transform:translateY(-3px);background:rgba(30,34,52,.95)}.sf-choices b{display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:50%;background:var(--ac);color:#000;font:800 12px/22px ui-sans-serif,sans-serif;margin-right:10px}
.sf-choices span{font:700 16px/1.3 ui-sans-serif,system-ui,sans-serif}.sf-choices small{display:block;margin:6px 0 0 32px;font:500 12.5px/1.35 ui-sans-serif,system-ui,sans-serif;opacity:.7}
.sf-ui{position:absolute;top:calc(8.5vh + 12px);right:18px;z-index:9;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.sf-ui button{cursor:pointer;border:1px solid rgba(255,255,255,.28);background:rgba(8,8,14,.6);color:#eee;padding:8px 14px;border-radius:999px;font:700 11px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;backdrop-filter:blur(6px)}
.sf-ui button:hover{background:rgba(40,40,60,.85)}
.sf-hint{position:absolute;left:18px;bottom:calc(8.5vh + 8px);z-index:9;font:600 10px/1.3 ui-sans-serif,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.4);pointer-events:none;max-width:44vw}
.sf-paused{position:absolute;inset:0;display:grid;place-items:center;z-index:10;font:800 28px/1 ui-sans-serif,sans-serif;letter-spacing:.5em;color:#fff;opacity:0;pointer-events:none;text-shadow:0 0 30px #000}
@media (max-width:900px){.sf-hint{display:none}.sf-sub{padding:0 4vw}.sf-choices{flex-direction:column;align-items:center;gap:8px;bottom:calc(8.5vh + 96px)}.sf-choices button{min-width:0;width:min(86vw,420px);padding:9px 14px}.sf-choices small{display:none}.sf-ui{top:calc(8.5vh + 6px)}}
`;
