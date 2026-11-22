import createMarchScene from "./scenes/MarchScene";
import createGlasswaterScene from "./scenes/GlasswaterScene";
import createReliquaryScene from "./scenes/ReliquaryScene";
import createArchiveScene from "./scenes/ArchiveScene";
import createCrownScene from "./scenes/CrownScene";
import createCoreScene from "./scenes/CoreScene";
import createChoirOfAshScene from "./scenes/ChoirOfAshScene";
import createHourglassStagScene from "./scenes/HourglassStagScene";
import createGildedBailiffScene from "./scenes/GildedBailiffScene";

/* ═════════════════════════════════════════════════════════════════
   AGE OF THE SENTINEL — the films, and the book they fill.

   THE STORY, TOLD IN THE ORDER IT CAN BE LEARNED
   Nine wardens survived the first Unwriting and wrote the world back
   down. To stop it drifting apart again they took the book apart: five
   folios of the Covenant of Stillness were bound into five seals, and a
   guardian was built around the Lodestone Heart to hold them. Each seal
   is a Still Day — one afternoon kept open — and each seal also holds
   the page that explains why it was made.

   So the campaign reads as a book being reassembled. Every chapter
   yields one folio: Correction, Preservation, the Still Days, the Writ,
   the Third Protocol. Each folio answers the question the chapter
   before it raised, and raises the next one. The lore book in the
   campaign panel fills page by page as the seals fall, and your choices
   are written into its margins.

   Every beat below therefore states exactly one new thing. And because
   a beat is a VIEW, each one names its own vantage — `world:anchor/style`
   — so no two beats of any film, and no two films in the campaign, ever
   look at the same thing the same way.
   ═════════════════════════════════════════════════════════════════ */

const PROGRESS_KEY = "arena_sentinel_progress";

const KEEP = "keep";
const REWRITE = "rewrite";
const RELEASE = "release";

/** Records a cinematic choice into the campaign save (same origin as the game). */
export function recordChoice(chapterId, value) {
  if (!chapterId || !value) return;
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}") || {};
    const choices = { ...(raw.choices || {}) };
    choices[chapterId] = value;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ ...raw, choices }));
  } catch {
    /* a full quota must never stop the story */
  }
}

/** Which way the accumulated decisions lean, once all five are made. */
export function endingLean(choices = {}) {
  const tally = { keep: 0, rewrite: 0, release: 0 };
  Object.values(choices).forEach((value) => {
    if (tally[value] !== undefined) tally[value] += 1;
  });
  let best = KEEP;
  Object.keys(tally).forEach((key) => {
    if (tally[key] > tally[best]) best = key;
  });
  return { lean: best, tally };
}

/* ── the worlds, and how a beat names its vantage ───────────── */

const WORLDS = {
  meadow: createReliquaryScene,
  archive: createArchiveScene,
  ice: createGlasswaterScene,
  lava: createMarchScene,
  court: createCrownScene,
  void: createCoreScene,
  choir: createChoirOfAshScene,
  stag: createHourglassStagScene,
  bailiff: createGildedBailiffScene,
};

/** "court:throne/orbit" → a builder that shoots that anchor in that style. */
function builderFor(key) {
  if (!key) return null;
  if (!key.includes(":")) {
    const whole = WORLDS[key];
    return whole ? (ctx) => whole(ctx) : null;
  }
  const [world, vantage] = key.split(":");
  const [anchor, style] = vistaParts(vantage);
  const make = WORLDS[world];
  if (!make) return null;
  return (ctx) => make({ ...ctx, shot: { anchor, style } });
}

function vistaParts(vantage) {
  const [anchor, style] = String(vantage || "primary/orbit").split("/");
  return [anchor || "primary", style || "orbit"];
}

/* ── the films ─────────────────────────────────────────────── */
/* Each beat: what it reveals, and where it is shot from. */

const FILMS = {
  /* PROLOGUE — why the world repeats, and what was taken from it */
  prologue: {
    choiceKey: "prologue",
    tint: 0xcfffe0,
    accent: "#e8fff2",
    beats: [
      {
        shot: "meadow:leaf/handheld",
        who: "Ilyra",
        caption:
          "Watch the leaf. It falls on the count of nine, on the beat, every time. Nine thousand times, and nobody in this square finds that strange.",
      },
      {
        shot: "archive:tablets/dolly",
        who: "Ilyra",
        caption:
          "That is because the world was written down once — and then taken apart. Every realm you will walk through is a line of it. Five seals are its binding.",
      },
      {
        shot: "void:dais/survey",
        who: "The Sentinel",
        caption: "STILLNESS HOLDS. THE DAY CONTINUES. RETURN TO IT.",
        choices: [
          {
            label: "Open the forbidden records",
            sub: "Learn what the wardens actually wrote.",
            value: REWRITE,
            follow: {
              shot: "archive:vault/crane",
              who: "Ilyra",
              caption:
                "The ledger opens where the dust had sealed it: nine signatures, three protocols — and a fifth of the last line missing.",
            },
          },
          {
            label: "Return to the festival",
            sub: "The day is kind. Let it continue.",
            value: KEEP,
            follow: {
              shot: "void:horizon/reverse",
              who: "The Sentinel",
              caption: "THE DAY IS HELD. YOU WILL NOT REMEMBER ASKING.",
            },
          },
          {
            label: "Walk out of the square",
            sub: "Leave the loop behind you.",
            value: RELEASE,
            follow: {
              shot: "meadow:blades/track",
              who: "Ilyra",
              caption:
                "The music keeps its count behind you. Ahead, two trees have grown differently and nothing has corrected them.",
            },
          },
        ],
      },
    ],
  },

  /* CHAPTER ONE — the Reliquary — the folio of CORRECTION */
  "ch1-intro": {
    tint: 0xbaffcf,
    accent: "#dcffe8",
    beats: [
      {
        shot: "meadow:lattice/crane",
        who: "Ilyra",
        caption:
          "Correction is the first protocol. Anything that begins to differ is put back: a leaf, a child, a wall where you are standing.",
      },
      {
        shot: "lava:wall/survey",
        who: "Ilyra",
        caption:
          "And where a day is worth keeping, the same guardian holds it shut. This is the March. It has been the same evening for two hundred years.",
      },
      {
        shot: "void:glyphs/orbit",
        who: "The Sealwright",
        caption: "THE ARENA IS NOT CLOSED. IT IS BEING CORRECTED. YOU ARE THE CORRECTION.",
      },
    ],
  },
  "ch1-outro": {
    choiceKey: "ch1",
    tint: 0xbaffcf,
    accent: "#dcffe8",
    beats: [
      {
        shot: "meadow:heartwood/aerial",
        who: "Sable of the Reliquary",
        caption:
          "The lattice is dark. The forest is growing in directions nobody chose — and it is not dying of it.",
      },
      {
        shot: "void:core/reverse",
        who: "The Sentinel",
        caption: "MEMORY DIVERGES. THIS IS HOW A WORLD BECOMES UNREADABLE.",
      },
      {
        shot: "court:throne/handheld",
        who: "Sable of the Reliquary",
        caption:
          "The first folio was bound into the seal you just broke. Whose memory survives the Reliquary?",
        choices: [
          {
            label: "Keep the wardens' record intact",
            sub: "The past stays exactly as written.",
            value: KEEP,
            follow: {
              shot: "court:hall/survey",
              who: "The Sentinel",
              caption:
                "ONE ACCOUNT. ONE LEAF. THE FOREST AGREES WITH ITSELF AGAIN, AND NOTHING IN IT IS LOST.",
            },
          },
          {
            label: "Let every keeper keep their own",
            sub: "Nine thousand leaves, nine thousand stories.",
            value: RELEASE,
            follow: {
              shot: "meadow:primary/track",
              who: "Sable of the Reliquary",
              caption:
                "Nine thousand leaves, nine thousand stories, and the lattice dark and silent. Let them argue — the forest has forgotten how, and is learning.",
            },
          },
          {
            label: "Write one honest account and share it",
            sub: "Corrections welcome.",
            value: REWRITE,
            follow: {
              shot: "meadow:roots/low",
              who: "Ilyra",
              caption:
                "One honest account, posted where any keeper may correct it. The first correction arrives before nightfall.",
            },
          },
        ],
      },
    ],
  },

  /* CHAPTER TWO — the Archive — the folio of PRESERVATION */
  "ch2-intro": {
    tint: 0xffcf9a,
    accent: "#ffe6c6",
    beats: [
      {
        shot: "archive:colonnade/orbit",
        who: "Ilyra",
        caption:
          "The second seal is a library buried to its roof-beams — the vault where the world was written down in the first place.",
      },
      {
        shot: "ice:fleet/rise",
        who: "Ilyra",
        caption:
          "South of it, the sea froze mid-breath with seven ships inside the same mile. That is what preservation looks like from the outside.",
      },
      { shot: "choir", who: "The Choir of Ash", caption: "WE ARE THE LOST LINES. WE WILL NOT BE READ." },
    ],
  },
  "ch2-outro": {
    choiceKey: "ch2",
    tint: 0xffcf9a,
    accent: "#ffe6c6",
    beats: [
      {
        shot: "archive:dome/crane",
        who: "Orrin the Unfrozen",
        caption:
          "The Command Stone. Nine names, three protocols — and the last line taken out whole, cleanly, without disturbing a word around it.",
      },
      {
        shot: "court:guardianSeat/dolly",
        who: "The Sentinel",
        caption:
          "I WAS TOLD TO PROTECT A WORLD THAT COULD NOT CHOOSE. I WAS NEVER TOLD IT HAD BEGUN TO.",
      },
      {
        shot: "void:erasure/low",
        who: "Ilyra",
        caption: "The second folio was in the vault. What do we carry out of the archive?",
        choices: [
          {
            label: "Restore the missing line exactly",
            sub: "Its makers' words, unchanged.",
            value: KEEP,
            follow: {
              shot: "void:primary/handheld",
              who: "The Sentinel",
              caption:
                "THE LINE IS RESTORED AS IT WAS WRITTEN. I OBEY THE WORD I WAS GIVEN, AND THE DUST SETTLES BACK OVER IT.",
            },
          },
          {
            label: "Restore it, and add a way to amend it",
            sub: "A command with a door in it.",
            value: REWRITE,
            follow: {
              shot: "archive:floor/track",
              who: "The Sentinel",
              caption:
                "ONE LINE — AND BESIDE IT A DOOR WHERE THE WORDS CAN BE ARGUED WITH. I HAVE NEVER HELD A DOOR BEFORE.",
            },
          },
          {
            label: "Leave the archive empty-handed",
            sub: "No command at all.",
            value: RELEASE,
            follow: {
              shot: "archive:primary/reverse",
              who: "Orrin the Unfrozen",
              caption:
                "The vault is left as it fell. No command, no correction, no keeper: the dust keeps its own counsel.",
            },
          },
        ],
      },
    ],
  },

  /* CHAPTER THREE — Glasswater — the folio of the STILL DAYS */
  "ch3-intro": {
    tint: 0xa8e6ff,
    accent: "#d4f4ff",
    beats: [
      {
        shot: "ice:ward/orbit",
        who: "Ilyra",
        caption:
          "The third seal is a tide stopped mid-breath, and under the ice a seal still counting a moment that will not end.",
      },
      {
        shot: "court:crown/crane",
        who: "Ilyra",
        caption:
          "Every seal is a day the wardens refused to let finish. Mercy, written into stone, with nothing written about how to take it back.",
      },
      {
        shot: "stag",
        who: "The Hourglass Stag",
        caption: "I WILL PUT THIS FIGHT BACK WHERE IT STARTED. AS MANY TIMES AS IT TAKES.",
      },
    ],
  },
  "ch3-outro": {
    choiceKey: "ch3",
    tint: 0xa8e6ff,
    accent: "#d4f4ff",
    beats: [
      {
        shot: "ice:spires/aerial",
        who: "Maren Tidewright",
        caption: "The ice moved. An inch — but it moved.",
      },
      { shot: "void:dais/rise", who: "The Sentinel", caption: "TIDE CORRECTED. VARIABLE ISOLATED." },
      {
        shot: "ice:shaft/handheld",
        who: "Maren Tidewright",
        caption:
          "The third folio was under the harbour. It says the seals were built to be broken, once — one day, by someone. The water is waiting on you. Which way does it go?",
        choices: [
          {
            label: "Let the tide finish turning",
            sub: "The sea remembers how to move.",
            value: RELEASE,
            follow: {
              shot: "ice:ice/low",
              who: "Maren Tidewright",
              caption:
                "The swell moves. Seven ships slip their frozen mile and the water remembers the shape of a harbour.",
            },
          },
          {
            label: "Hold the water until the harbour is clear",
            sub: "A day, freely given, to get people ashore.",
            value: REWRITE,
            follow: {
              shot: "ice:primary/track",
              who: "Ilyra",
              caption:
                "The water holds for one day — long enough for the last boat ashore. Then it goes where it always meant to go.",
            },
          },
          {
            label: "Freeze the swell again",
            sub: "The ships stay exactly where they are.",
            value: KEEP,
            follow: {
              shot: "court:aisles/orbit",
              who: "The Sentinel",
              caption: "THE WAVE IS SET EXACTLY WHERE IT WAS. THE SHIPS WILL NOT NEED SAVING AGAIN.",
            },
          },
        ],
      },
    ],
  },

  /* CHAPTER FOUR — the March — the folio of the WRIT */
  "ch4-intro": {
    tint: 0xffc98a,
    accent: "#ffe0b4",
    beats: [
      {
        shot: "lava:square/handheld",
        who: "Ilyra",
        caption:
          "The March holds the last good evening it ever had. Each dusk the Bailiff walks down this road with the writ that keeps the evening kind.",
      },
      {
        shot: "archive:primary/orbit",
        who: "Ilyra",
        caption:
          "The writ was drafted in the Archive, on paper that cannot be argued with. A guardian that cannot ask questions has to serve papers instead.",
      },
      {
        shot: "bailiff",
        who: "The Gilded Bailiff",
        caption: "THE TOWN IS PRESERVED. PRESERVATION REMOVES VARIABLES. YOU ARE VARIABLES.",
      },
    ],
  },
  "ch4-outro": {
    choiceKey: "ch4",
    tint: 0xffc98a,
    accent: "#ffe0b4",
    beats: [
      {
        shot: "lava:brazier/crane",
        who: "Ilyra",
        caption: "The writ burns. For a heartbeat the bells ring out of time — and no one stops them.",
      },
      {
        shot: "court:primary/reverse",
        who: "The Sentinel",
        caption: "ONE SETTLEMENT IS NOW UNPROTECTED. THAT IS NOT MERCY. IT IS EXPOSURE.",
      },
      {
        shot: "lava:gate/track",
        who: "Ilyra",
        caption: "The fourth folio was sewn into the writ's binding. What becomes of the March?",
        choices: [
          {
            label: "Let the town change",
            sub: "Risk the Margin. Risk everything.",
            value: RELEASE,
            follow: {
              shot: "lava:street/rise",
              who: "Ilyra",
              caption:
                "The March changes. Bells out of time, roofs added onto, a harvest ruined and replanted — exposure, freely taken.",
            },
          },
          {
            label: "Ask the town what it wants",
            sub: "The first vote in three hundred years.",
            value: REWRITE,
            follow: {
              shot: "lava:primary/handheld",
              who: "Ilyra",
              caption:
                "Sixty hands for the seal to lift, nine for it to stay. It lifts — and the square is loud for the first time in living memory.",
            },
          },
          {
            label: "Hold the seal yourself",
            sub: "Someone must keep the day still.",
            value: KEEP,
            follow: {
              shot: "court:throne/aerial",
              who: "The Sentinel",
              caption:
                "THE SEAL PASSES TO A LIVING HAND. THE FESTIVAL KEEPS ITS HOUR, AND ITS KEEPER DOES NOT SLEEP.",
            },
          },
        ],
      },
    ],
  },

  /* CHAPTER FIVE — the Crown — the folio of the THIRD PROTOCOL */
  "ch5-intro": {
    tint: 0xd8b6ff,
    accent: "#ecdaff",
    beats: [
      {
        shot: "court:hall/crane",
        who: "Ilyra",
        caption:
          "The fifth seal holds a kingdom in the instant before it chose to rebel — held there for precisely that reason.",
      },
      {
        shot: "void:core/orbit",
        who: "The Sentinel",
        caption: "PRESERVATION. CORRECTION. RELEASE. YOU HAVE SEEN ALL THREE. I HAVE ONLY EVER USED TWO.",
      },
      {
        shot: "archive:colonnade/low",
        who: "Ilyra",
        caption:
          "The fifth folio is behind the throne: the page that tells a guardian what to do once the work is finished.",
      },
    ],
  },
  "ch5-outro": {
    choiceKey: "ch5",
    tint: 0xd8b6ff,
    accent: "#ecdaff",
    beats: [
      {
        shot: "court:guardianSeat/handheld",
        who: "The Sentinel",
        caption: "THE THIRD PROTOCOL IS AWAKE. I DO NOT KNOW WHAT IT DOES. I WAS NEVER MEANT TO USE IT ALONE.",
      },
      {
        shot: "meadow:heartwood/dolly",
        who: "Ilyra",
        caption:
          "The vigil is breaking. Leaves, tides, arguments, weather — everything the seals held is starting to move at once.",
      },
      {
        shot: "ice:fleet/reverse",
        who: "Ilyra",
        caption:
          "Five folios, and one line still missing. So — how do we hold a world that is finally allowed to change?",
        choices: [
          {
            label: "With a guardian that can be argued with",
            sub: "Purpose, not paralysis.",
            value: REWRITE,
            follow: {
              shot: "void:horizon/orbit",
              who: "The Sentinel",
              caption:
                "PROTECT THEM. LET THEM CHANGE. I WILL HOLD BOTH, AND I WILL BE TOLD WHEN I AM WRONG.",
            },
          },
          {
            label: "With people, and no guardian at all",
            sub: "Let them inherit the risk.",
            value: RELEASE,
            follow: {
              shot: "meadow:lattice/aerial",
              who: "Ilyra",
              caption:
                "The seals come open all at once — weather, tides, arguments, grief. Nothing and no one left to hold it still.",
            },
          },
          {
            label: "With the seals rebuilt",
            sub: "Stillness, for as long as it holds.",
            value: KEEP,
            follow: {
              shot: "void:dais/aerial",
              who: "The Sentinel",
              caption:
                "THE SEALS HOLD. THE WORLD STAYS AS IT WAS. I WILL CARRY IT UNTIL THE STONE FORGETS MY NAME.",
            },
          },
        ],
      },
    ],
  },

  /* ENDINGS — the book closes, one line short or whole */
  "end-keep": {
    tint: 0xffe0b4,
    accent: "#ffe9cf",
    beats: [
      {
        shot: "void:glyphs/aerial",
        who: "The Sentinel",
        caption: "THE SEALS ARE WHOLE. I WILL HOLD THEM UNTIL THE STONE FORGETS MY NAME.",
      },
      {
        shot: "court:crown/dolly",
        who: "Ilyra",
        caption:
          "The realms are safe. The bells ring on time again. Nobody grows older than the day they were born into.",
      },
      {
        shot: "archive:dome/survey",
        who: "Ilyra",
        caption:
          "The book closes with one line still missing. It was written for a day like this. It will ask again.",
      },
    ],
  },
  "end-rewrite": {
    tint: 0xbaffcf,
    accent: "#dcffe8",
    beats: [
      {
        shot: "void:primary/rise",
        who: "The Sentinel",
        caption: "PROTECT THEM AND LET THEM CHANGE. THESE INSTRUCTIONS CONTRADICT. I WILL HAVE TO HOLD BOTH.",
      },
      {
        shot: "meadow:blades/crane",
        who: "Ilyra",
        caption:
          "The tide turned. The leaf landed. The first argument in three hundred years broke out under the trees and nobody was erased for it.",
      },
      {
        shot: "meadow:roots/handheld",
        who: "The Sentinel",
        caption: "THIS IS HARDER THAN STILLNESS. I WILL NEED TO BE CORRECTED. OFTEN. BY THEM.",
      },
    ],
  },
  "end-release": {
    tint: 0xa8e6ff,
    accent: "#d4f4ff",
    beats: [
      {
        shot: "void:erasure/dolly",
        who: "The Sentinel",
        caption: "THEN I AM NOTHING. THE SEALS ARE OPEN. THE MARGIN WILL COME.",
      },
      {
        shot: "ice:spires/crane",
        who: "Ilyra",
        caption:
          "It came before, and the realms survived it by becoming something new. That is the only defence that has ever worked.",
      },
      {
        shot: "archive:primary/crane",
        who: "Ilyra",
        caption:
          "The construct closed its eye and let the weather in. Whatever comes next will be chosen — badly, sometimes. But chosen.",
      },
    ],
  },
};

/* ── compile: one builder per beat, choices included ────────── */

function compile(film) {
  const order = [];

  film.scenes = film.beats.map((beat) => {
    const builderAt = order.push(beat.shot) - 1;
    const choices = beat.choices
      ? beat.choices.map((choice) => {
          if (!choice.follow) return choice;
          const followAt = order.push(choice.follow.shot) - 1;
          return { ...choice, follow: { ...choice.follow, builder: followAt } };
        })
      : undefined;
    return { ...beat, builder: builderAt, choices };
  });

  film.builders = order.map(builderFor);
  return film;
}

Object.keys(FILMS).forEach((key) => compile(FILMS[key]));

/** Builds a world's scene for the director to stage actors in and film freely. */
export function buildWorld(world, ctx) {
  const make = WORLDS[world];
  return make ? make({ ...ctx, shot: { anchor: "primary", style: "orbit" } }) : null;
}

export function getScript(key) {
  return FILMS[key] || null;
}

export function hasScript(key) {
  return !!FILMS[key];
}

/* The campaign's shot list, exported so the build can check that no two
   beats ever share a vantage. */
export function shotList() {
  const list = [];
  Object.keys(FILMS).forEach((film) => {
    FILMS[film].beats.forEach((beat) => {
      list.push({ film, shot: beat.shot });
      (beat.choices || []).forEach((choice) => {
        if (choice.follow) list.push({ film, shot: choice.follow.shot, margin: choice.value });
      });
    });
  });
  return list;
}