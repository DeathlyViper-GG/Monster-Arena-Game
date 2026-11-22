import { useEffect } from "react";
import PrologueCutscene from "./PrologueCutscene";

// Full-screen host for the story prologue — the 3D cinematic that plays the
// first time a player opens Story. Owns its exits (final click, Continue,
// Escape) and hands the flow back to the game's story hub.
export default function StoryPrologueStage({ onDone }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onDone?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
      <PrologueCutscene onDone={onDone} />
      <button
        type="button"
        onClick={() => onDone?.()}
        className="absolute right-5 top-5 z-20 rounded-md border border-white/25 bg-black/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/85 transition hover:bg-white/10"
      >
        Continue ▸
      </button>
    </div>
  );
}