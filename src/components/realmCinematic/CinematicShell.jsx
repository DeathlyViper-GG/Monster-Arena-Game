import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { CinematicShader } from "@/components/glacialArchive/Cutscene";
import { LensShader, enableShadows } from "./finish";

/* ═════════════════════════════════════════════════════════════════
   THE SHARED ENGINE — one renderer, a bloom + cinematic stack, and
   scene swaps. Every realm cinematic plugs its scene builders into
   this so they all share the same film finish, camera shake and
   hand-off behaviour.
   ═════════════════════════════════════════════════════════════════ */

function disposeScene(scene) {
  scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (!object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const key of Object.keys(material)) {
        const value = material[key];
        if (value && value.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}

function createCutsceneEngine(canvas, tint) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const bufferSize = renderer.getDrawingBufferSize(new THREE.Vector2());
  // No MSAA on the half-float target: multisampled float buffers fail to resolve
  // on a lot of GPUs and show up as black rectangles that flicker frame to frame.
  const renderTarget = new THREE.WebGLRenderTarget(Math.max(1, bufferSize.x), Math.max(1, bufferSize.y), {
    type: THREE.HalfFloatType,
  });

  const composer = new EffectComposer(renderer, renderTarget);
  const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  let bloom = null;
  try {
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.82, 0.92, 0.6);
  } catch (error) {
    console.warn("Bloom unavailable, rendering without it", error);
  }
  const cinematic = new ShaderPass(CinematicShader);
  cinematic.uniforms.uTint.value.setHex(tint);
  cinematic.uniforms.uGrain.value = 0.038;

  // Edge antialiasing as a pass: the MSAA route is off the table here (see the
  // render target above), and without this, silhouettes against the bright sky
  // strobe as the camera dollies.
  const fxaa = new ShaderPass(FXAAShader);

  const lens = new ShaderPass(LensShader);

  composer.addPass(renderPass);
  if (bloom) composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(fxaa);
  composer.addPass(lens);
  composer.addPass(cinematic);

  let current = null;
  let currentIndex = -1;
  let elapsed = 0;
  let frameId = 0;
  let flash = 0;
  let shake = 0;
  let pointer = { x: 0, y: 0 };
  const clock = new THREE.Clock();

  const resize = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    bloom?.setSize(width, height);
    fxaa.uniforms.resolution.value.set(1 / width, 1 / height);
    lens.uniforms.uRes.value.set(width * renderer.getPixelRatio(), height * renderer.getPixelRatio());
    if (current) {
      current.camera.aspect = width / height;
      current.camera.fov = width / height < 1.1 ? 60 : current.baseFov ?? 44;
      current.camera.updateProjectionMatrix();
    }
  };

  const renderFrame = () => {
    if (!current) return;
    renderPass.scene = current.scene;
    renderPass.camera = current.camera;
    composer.render();
  };

  const setScene = (index) => {
    if (index === currentIndex) return;
    if (current) {
      disposeScene(current.scene);
      current = null;
    }
    const build = BUILDERS_REF[index];
    const built = typeof build === "function" ? build({ renderer }) : null;
    // A builder that returns anything other than a scene + camera would take the
    // whole engine down on the next resize, so it is dropped instead.
    if (built && !built.scene) console.warn("Cutscene builder returned no scene", index);
    current = built && built.scene && built.camera ? built : null;
    if (current) { try { enableShadows(current.scene, { extent: current.shadowExtent || 120 }); } catch (error) { console.warn("Shadows unavailable", error); } }
    currentIndex = index;
    elapsed = 0;
    flash = 1;
    shake = 1;
    clock.getDelta();
    resize();
    current.update?.(0, 0, pointer);
    renderFrame();
  };

  // The scene builders are handed over on first use so the engine stays generic.
  let BUILDERS_REF = [];
  const bind = (list) => {
    BUILDERS_REF = list || [];
    return engine;
  };

  const frame = () => {
    frameId = requestAnimationFrame(frame);
    const delta = Math.min(clock.getDelta(), 0.05);
    elapsed += delta;
    if (!current) return;
    if (flash > 0) flash = Math.max(0, flash - delta * 1.15);
    if (shake > 0) shake = Math.max(0, shake - delta * 2.2);
    current.update(elapsed, delta, pointer);
    // A punch of camera shake on every advance, snapping back over ~0.45s.
    if (shake > 0.001) {
      const camera = current.camera;
      camera.position.x += (Math.random() - 0.5) * shake * 1.15;
      camera.position.y += (Math.random() - 0.5) * shake * 0.95;
      camera.position.z += (Math.random() - 0.5) * shake * 1.4;
      camera.rotation.z += (Math.random() - 0.5) * shake * 0.02;
    }
    cinematic.uniforms.uTime.value = elapsed;
    lens.uniforms.uTime.value = elapsed;
    lens.uniforms.uAberration.value = 0.0013 + flash * 0.003;
    cinematic.uniforms.uFlash.value = flash * 0.5;
    renderer.toneMappingExposure = 1.02 + flash * 0.16;
    renderFrame();
  };

  const onPointerMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer = {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
    };
  };

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointerMove);
  resize();
  frameId = requestAnimationFrame(frame);

  const pulse = (strength = 1) => {
    shake = Math.max(shake, strength);
    flash = Math.max(flash, 0.8 * strength);
  };

  const engine = {
    setScene,
    pulse,
    resize,
    bind,
    dispose() {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      if (current) disposeScene(current.scene);
      current = null;
      bloom?.dispose();
      cinematic.dispose();
      fxaa.dispose();
      lens.dispose();
      composer.dispose();
      renderTarget.dispose();
      renderer.dispose();
    },
  };

  return engine;
}

/* ── the canvas ───────────────────────────────────────────── */

function CinematicCanvas({ builders, sceneIndex, pulseRef, tint }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    let engine;
    try {
      engine = createCutsceneEngine(canvasRef.current, tint);
    } catch (error) {
      console.error("Cutscene renderer unavailable", error);
      setFailed(true);
      return undefined;
    }
    engineRef.current = engine;
    engine.bind(builders);
    if (pulseRef) pulseRef.current = engine.pulse;
    engine.setScene(0);
    return () => {
      engine.dispose();
      engineRef.current = null;
      if (pulseRef) pulseRef.current = null;
    };
  }, [builders, pulseRef, tint]);

  useEffect(() => {
    engineRef.current?.setScene(sceneIndex);
  }, [sceneIndex]);

  if (failed) {
    return <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,#2a1208,#050203_72%)]" />;
  }

  return <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />;
}

/* ═════════════════════════════════════════════════════════════════
   THE PLAYER — captions, letterbox, click / key advance, hand-off
   ═════════════════════════════════════════════════════════════════ */

export default function CinematicShell({
  scenes,
  builders,
  tint = 0xffffff,
  endHint = "continue",
  accent = "#fdeedc",
  autoAdvanceAfter = 0,
  onChoice,
  onDone,
}) {
  const [index, setIndex] = useState(0);
  const [veil, setVeil] = useState(false);
  // Beats the player earns by choosing: a picked option plays the consequence it
  // caused as the film's next beat, so each choice visibly leads somewhere else.
  const [extra, setExtra] = useState([]);
  const beats = useMemo(() => [...scenes, ...extra], [scenes, extra]);
  const timers = useRef([]);
  const pulseRef = useRef(null);
  const finished = useRef(false);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const goTo = (next) => {
    setVeil(true);
    timers.current.push(setTimeout(() => setIndex(next), 440));
    timers.current.push(setTimeout(() => setVeil(false), 640));
  };

  const advance = () => {
    if (veil || finished.current) return;
    pulseRef.current?.();
    if (index >= beats.length - 1) {
      // Past the final beat the cinematic ends and the realm begins.
      finished.current = true;
      setVeil(true);
      timers.current.push(setTimeout(() => onDone?.(), 620));
      return;
    }
    goTo(index + 1);
  };

  /* A beat may carry choices: picking one records it, then plays the beat that
     choice caused — a different line in a different world for each option.
     Clicking the scene itself still advances, so nothing ever blocks. */
  const choose = (event, choice) => {
    event.stopPropagation();
    if (veil || finished.current) return;
    onChoice?.(choice.value, choice);
    pulseRef.current?.();
    if (choice.follow) {
      setExtra((list) => [...list, choice.follow]);
      goTo(index + 1);
      return;
    }
    advance();
  };

  /* Optional auto-advance: a beat plays itself out after a set time, so a
     sequence can read like a film instead of waiting on a click. */
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  useEffect(() => {
    if (!autoAdvanceAfter || finished.current) return undefined;
    const id = setTimeout(() => advanceRef.current(), autoAdvanceAfter);
    return () => clearTimeout(id);
  }, [index, autoAdvanceAfter]);

  const scene = beats[index] ?? beats[beats.length - 1];

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Advance the cutscene"
      onClick={advance}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          advance();
        }
      }}
      className="relative h-full w-full cursor-pointer select-none overflow-hidden bg-[#050203] outline-none"
    >
      <CinematicCanvas builders={builders} sceneIndex={scene?.builder ?? index} pulseRef={pulseRef} tint={tint} />

      {/* letterbox */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/90 via-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black via-black/75 to-transparent" />

      <AnimatePresence mode="wait">
        <motion.span
          key={scene.numeral}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1 }}
          className="cutscene-display pointer-events-none absolute left-6 top-7 text-[11px] tracking-[0.7em] text-white/35 md:left-12 md:top-10"
        >
          {scene.numeral}
        </motion.span>
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-16 md:pb-24">
        {scene.who && (
          <motion.span
            key={`who-${index}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.2 }}
            className="cutscene-display mb-3 text-[10px] uppercase tracking-[0.52em] text-white/45 md:mb-4 md:text-[11px]"
          >
            {scene.who}
          </motion.span>
        )}
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(10px)" }}
            transition={{ duration: 1.3, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ color: accent }}
            className="cutscene-serif cutscene-caption max-w-3xl text-center text-[1.35rem] leading-relaxed sm:text-[1.7rem] md:text-[2.3rem] md:leading-[1.45]"
          >
            {scene.caption}
          </motion.p>
        </AnimatePresence>

        {scene.choices && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 flex w-full max-w-2xl flex-col items-stretch gap-2.5 md:mt-8"
          >
            {scene.choices.map((choice) => (
              <button
                key={choice.value + choice.label}
                type="button"
                onClick={(event) => choose(event, choice)}
                className="group rounded-xl border border-white/20 bg-white/[0.04] px-5 py-3 text-left backdrop-blur-sm transition hover:border-white/55 hover:bg-white/[0.1]"
              >
                <span className="cutscene-display block text-[0.82rem] uppercase tracking-[0.22em] text-white/90 md:text-[0.9rem]">
                  {choice.label}
                </span>
                {choice.sub && (
                  <span className="cutscene-serif mt-1 block text-[0.78rem] italic leading-snug text-white/50">
                    {choice.sub}
                  </span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {!scene.choices && (
        <motion.div
          animate={{ opacity: veil ? 0 : 1 }}
          transition={{ duration: 0.5 }}
          className="pointer-events-none absolute inset-x-0 bottom-7 flex justify-center md:bottom-9"
        >
          <motion.span
            animate={{ opacity: [0.22, 0.7, 0.22] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
            className="cutscene-display text-[9px] uppercase tracking-[0.55em] text-white/70 md:text-[10px]"
          >
            click to {index === beats.length - 1 ? endHint : "continue"}
          </motion.span>
        </motion.div>
      )}

      <motion.div
        className="pointer-events-none absolute inset-0 bg-black"
        animate={{ opacity: veil ? 1 : 0 }}
        transition={{ duration: veil ? 0.42 : 0.55, ease: "easeInOut" }}
      />

      <motion.div
        className="pointer-events-none absolute inset-0 bg-black"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 2.8, ease: "easeInOut" }}
      />
    </div>
  );
}