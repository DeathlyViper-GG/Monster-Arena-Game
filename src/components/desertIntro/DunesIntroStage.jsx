import { useEffect } from "react";
import DesertCutscene from "./DesertCutscene";

// Full-screen host for the Realm 2 (Sunken Dunes) intro cutscene.
// The scene itself is a three-part three.js cinematic; after the last scene it
// hands straight off into the realm match. This stage owns the exits
// (final click / Continue button / Escape).
export default function DunesIntroStage({ onDone }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onDone?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
      <DesertCutscene onDone={onDone} />
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