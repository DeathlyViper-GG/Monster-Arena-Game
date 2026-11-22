import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { CinematicShader } from "@/components/glacialArchive/Cutscene";
import createDunesScene from "./DunesScene";
import createPharaohScene from "./PharaohScene";
import createPyramidScene from "./PyramidScene";

/* ═════════════════════════════════════════════════════════════════
   THE ENGINE — one renderer, a bloom + cinematic stack, scene swaps
   ═════════════════════════════════════════════════════════════════ */

const BUILDERS = [createDunesScene, createPharaohScene, createPyramidScene];

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

function createCutsceneEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const bufferSize = renderer.getDrawingBufferSize(new THREE.Vector2());
  const renderTarget = new THREE.WebGLRenderTarget(Math.max(1, bufferSize.x), Math.max(1, bufferSize.y), {
    type: THREE.HalfFloatType,
    samples: 4,
  });

  const composer = new EffectComposer(renderer, renderTarget);
  const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  let bloom = null;
  try {
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.62, 0.85, 0.7);
  } catch (error) {
    console.warn("Bloom unavailable, rendering without it", error);
  }
  const cinematic = new ShaderPass(CinematicShader);
  // Warm the finishing pass to the desert's amber grade.
  cinematic.uniforms.uTint.value.setHex(0xc9772f);
  cinematic.uniforms.uGrain.value = 0.038;

  composer.addPass(renderPass);
  if (bloom) composer.addPass(bloom);
  composer.addPass(new OutputPass());
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
    current = BUILDERS[index]({ renderer });
    currentIndex = index;
    elapsed = 0;
    flash = 1;
    shake = 1;
    clock.getDelta();
    resize();
    current.update?.(0, 0, pointer);
    renderFrame();
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

  return {
    setScene,
    pulse,
    resize,
    dispose() {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      if (current) disposeScene(current.scene);
      current = null;
      bloom?.dispose();
      cinematic.dispose();
      composer.dispose();
      renderTarget.dispose();
      renderer.dispose();
    },
  };
}

/* ── the canvas ───────────────────────────────────────────── */

function CutsceneCanvas({ sceneIndex, pulseRef }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    let engine;
    try {
      engine = createCutsceneEngine(canvasRef.current);
    } catch (error) {
      console.error("Cutscene renderer unavailable", error);
      setFailed(true);
      return undefined;
    }
    engineRef.current = engine;
    if (pulseRef) pulseRef.current = engine.pulse;
    engine.setScene(0);
    return () => {
      engine.dispose();
      engineRef.current = null;
      if (pulseRef) pulseRef.current = null;
    };
  }, [pulseRef]);

  useEffect(() => {
    engineRef.current?.setScene(sceneIndex);
  }, [sceneIndex]);

  if (failed) {
    return <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,#5a3016,#150a05_72%)]" />;
  }

  return <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />;
}

/* ═════════════════════════════════════════════════════════════════
   THE PLAYER
   ═════════════════════════════════════════════════════════════════ */

const SCENES = [
  {
    numeral: "I",
    caption:
      "The Sunken Dunes bury a Nhalori city that cages the second shard — my memory.",
  },
  {
    numeral: "II",
    caption: "The Pharaoh of Glass wears my own face and conjures sandstorms to guard it.",
  },
  {
    numeral: "III",
    caption: "Shatter the Pharaoh. Take back the part of me that remembers.",
  },
];

export default function DesertCutscene({ onDone }) {
  const [index, setIndex] = useState(0);
  const [veil, setVeil] = useState(false);
  const timers = useRef([]);
  const pulseRef = useRef(null);
  const finished = useRef(false);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const advance = () => {
    if (veil || finished.current) return;
    pulseRef.current?.();
    const isLast = index === SCENES.length - 1;
    if (isLast) {
      // Past the final scene the cinematic ends and the realm begins.
      finished.current = true;
      setVeil(true);
      timers.current.push(setTimeout(() => onDone?.(), 620));
      return;
    }
    setVeil(true);
    timers.current.push(setTimeout(() => setIndex(index + 1), 440));
    timers.current.push(setTimeout(() => setVeil(false), 640));
  };

  const scene = SCENES[index];

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
      className="relative h-full w-full cursor-pointer select-none overflow-hidden bg-[#0b0503] outline-none"
    >
      <CutsceneCanvas sceneIndex={index} pulseRef={pulseRef} />

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
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(10px)" }}
            transition={{ duration: 1.3, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="cutscene-serif cutscene-caption max-w-3xl text-center text-[1.35rem] leading-relaxed text-[#fdeedc] sm:text-[1.7rem] md:text-[2.3rem] md:leading-[1.45]"
          >
            {scene.caption}
          </motion.p>
        </AnimatePresence>
      </div>

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
          click to {index === SCENES.length - 1 ? "enter the dunes" : "continue"}
        </motion.span>
      </motion.div>

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