import CinematicShell from "@/components/realmCinematic/CinematicShell";
import createForgeGateScene from "./ForgeGateScene";
import createTitanScene from "./TitanScene";
import createCinderShardScene from "./CinderShardScene";

/* Realm 4 — The Cinder Below. A three-scene three.js cinematic:
   the forge gate, the chained Magma Titan, and the fourth shard. */

const SCENES = [
  {
    numeral: "I",
    caption:
      "The Cinder Below — the forge-temple where the First Scribe hammered the seals from the Hollow's own magic.",
  },
  {
    numeral: "II",
    caption: "My will was chained to the Magma Titan, and the Titan has burned ever since.",
  },
  {
    numeral: "III",
    caption: "Break the chains. Take back my will — and end what the First Scribe began.",
  },
];

const BUILDERS = [createForgeGateScene, createTitanScene, createCinderShardScene];

export default function CinderCutscene({ onDone }) {
  return (
    <CinematicShell
      scenes={SCENES}
      builders={BUILDERS}
      tint={0xd9642a}
      accent="#ffe0bd"
      endHint="enter the cinder"
      onDone={onDone}
    />
  );
}