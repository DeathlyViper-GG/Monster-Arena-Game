import { useEffect, useMemo, useRef } from "react";
import { getScript, recordChoice, buildWorld } from "./sentinelCinematics";
import { createFilm } from "./film/FilmEngine";

/* ═════════════════════════════════════════════════════════════════
   Hosts an Age of the Sentinel film. The game frame asks for a script by
   key; the film engine (film/FilmEngine.js) stages it as a continuous 3D
   movie — actors who speak the lines, word-timed world cues, directed
   camera, and a camera the player can steer — and hands control back
   when the last beat ends or the player skips. Choices are written back
   through recordChoice exactly as before.
   ═════════════════════════════════════════════════════════════════ */

const CHAPTERS = ["The Verdant Reliquary", "The Sunken Archive", "Glasswater Reach", "March of Embers", "The Fractured Crown"];
const ROMAN = ["I", "II", "III", "IV", "V"];
const ENDINGS = { "end-keep": "Restore the Vigil", "end-rewrite": "Rewrite the Command", "end-release": "Release the Sentinel" };

function titleFor(key) {
  if (key === "prologue") return { kicker: "PROLOGUE", title: "AGE OF THE SENTINEL", sub: "Nothing may change" };
  const m = /^ch(\d)-(intro|outro)$/.exec(key);
  if (m) {
    const i = +m[1] - 1;
    return m[2] === "intro"
      ? { kicker: `CHAPTER ${ROMAN[i]}`, title: CHAPTERS[i], sub: "The seal awaits" }
      : { kicker: CHAPTERS[i].toUpperCase(), title: `SEAL ${ROMAN[i]} BROKEN`, sub: "One folio is bound" };
  }
  if (ENDINGS[key]) return { kicker: "THE VIGIL", title: ENDINGS[key].toUpperCase(), sub: "The last line is written" };
  return { kicker: "", title: "", sub: "" };
}

export default function SentinelCinematic({ scriptKey, onDone }) {
  const script = useMemo(() => getScript(scriptKey), [scriptKey]);
  const host = useRef(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!script || !host.current) return undefined;
    let film = null;
    try {
      film = createFilm({
        container: host.current,
        film: script,
        buildWorld,
        title: titleFor(scriptKey),
        accent: script.accent || "#e8fff2",
        onChoice: (value) => { if (script.choiceKey) recordChoice(script.choiceKey, value); },
        onDone: () => done.current && done.current(),
      });
    } catch (error) {
      console.warn("Film could not start", error);
      done.current && done.current();
    }
    return () => { film && film.dispose(); };
  }, [script, scriptKey]);

  if (!script) return null;
  return <div ref={host} className="fixed inset-0 z-[100] bg-black" />;
}
