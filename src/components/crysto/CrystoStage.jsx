import { useEffect } from "react";
import CinematicShell from "@/components/realmCinematic/CinematicShell";
import FILMS from "./films";

/* Full-screen host for Crysto's cinematics — the arrival, the three lights,
   the Hollow Knight and the dawn. Escape or the Skip button hands control
   straight back to the world behind it. */
export default function CrystoStage({ filmKey, onDone }) {
  const film = FILMS[filmKey] || FILMS.arrival;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onDone?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
      <CinematicShell
        scenes={film.scenes}
        builders={film.builders}
        tint={film.tint}
        accent={film.accent}
        endHint={film.endHint}
        onDone={onDone}
      />
      <button
        type="button"
        onClick={() => onDone?.()}
        className="absolute right-5 top-5 z-20 rounded-md border border-white/25 bg-black/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/85 transition hover:bg-white/10"
      >
        Skip ▸
      </button>
    </div>
  );
}