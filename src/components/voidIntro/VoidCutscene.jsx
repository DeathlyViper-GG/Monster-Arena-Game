import CinematicShell from "@/components/realmCinematic/CinematicShell";
import createFractureScene from "./FractureScene";
import createEchoScene from "./EchoScene";
import createVoidShardScene from "./VoidShardScene";
import createVoidCrackScene from "./VoidCrackScene";
import createVoidDoorScene from "./VoidDoorScene";

/* Realm 5 — The Neon Void. A five-beat three.js cinematic:
   the fracture, the Hollow's Echo, the last shard, the shard tearing
   open, and the doorway it leaves behind. Each beat advances on its own
   so the realm intro plays like a film; a click skips ahead. */

const SCENES = [
  {
    numeral: "I",
    caption: "This is the fracture — the place where every memory I have taken back overlaps at once.",
  },
  {
    numeral: "II",
    caption: "The Hollow's Echo is a Warden, not the Hollow. It wears the power of every shard I reclaimed.",
  },
  {
    numeral: "III",
    caption: "The last piece of my soul hangs in the dark, and five realms pour back into it.",
  },
  {
    numeral: "IV",
    caption: "Then the seam gives. Cinder and frost and sand tear through the glass at once.",
  },
  {
    numeral: "V",
    caption: "And the shard does not break. It opens — a door, and he is waiting on the far side of the light.",
  },
];

const BUILDERS = [
  createFractureScene,
  createEchoScene,
  createVoidShardScene,
  createVoidCrackScene,
  createVoidDoorScene,
];

export default function VoidCutscene({ onDone }) {
  return (
    <CinematicShell
      scenes={SCENES}
      builders={BUILDERS}
      tint={0x9c4ec4}
      accent="#efe0ff"
      endHint="step through"
      autoAdvanceAfter={12000}
      onDone={onDone}
    />
  );
}