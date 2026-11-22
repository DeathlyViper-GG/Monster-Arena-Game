import CinematicShell from "@/components/realmCinematic/CinematicShell";
import createWakeScene from "./WakeScene";
import createSealScene from "./SealScene";
import createEmpireScene from "./EmpireScene";
import createShatterScene from "./ShatterScene";
import createHollowScene from "./HollowScene";

/* The prologue — the story's first breath, played once the first time a
   player opens Story. Five three.js beats, one for each line of the
   exchange between the Last Scribe and the Hollow, so the words are
   exactly what is on screen: the Scribe waking, the sealed door, the
   dust empire of Nhalori, the soul shattering into five, and the
   Hollow King opening his eye. */

const SCENES = [
  {
    numeral: "I",
    who: "The Last Scribe",
    caption:
      "I wake in a place I do not know, wearing a name I barely remember — the Last Scribe.",
  },
  {
    numeral: "II",
    who: "The Hollow",
    caption:
      "Another scribe wakes. Another soul to devour. Do you know how many ages I have waited behind these seals?",
  },
  {
    numeral: "III",
    who: "The Hollow",
    caption:
      "I am no creation of yours, little scribe. I am the Hollow King of Nhalori — an empire that crumbled to dust while I endured. I am the hunger that outlasts civilisations.",
  },
  {
    numeral: "IV",
    who: "The Last Scribe",
    caption:
      "The First Scribe sealed you centuries ago. Their soul was shattered into five — each shard bound to a Warden to hold your prison shut. I carry that soul now.",
  },
  {
    numeral: "V",
    who: "The Hollow",
    caption:
      "Then come. Slay my Wardens. Reclaim what was theirs. And when you are whole, I will show you the power that made me — and the price of refusing to die.",
  },
];

const BUILDERS = [
  createWakeScene,
  createSealScene,
  createEmpireScene,
  createShatterScene,
  createHollowScene,
];

export default function PrologueCutscene({ onDone }) {
  return (
    <CinematicShell
      scenes={SCENES}
      builders={BUILDERS}
      tint={0x8f5bd6}
      accent="#efe3ff"
      endHint="wake"
      autoAdvanceAfter={12000}
      onDone={onDone}
    />
  );
}