// ============================================================
// The people of Hollowmere.
//
// Beyond the campaign cast there is a village full of them, and
// they are how the deep lore actually reaches the player: the
// Nine and the Covenant, the Lodestone Heart, the three
// protocols, the Margin, the Still Days — spoken by neighbours
// on the green instead of filed away in a codex.
//
// The five hidden keys are theirs too. Each is dropped behind
// something; all five lift the gate on the Margin Quarter, where the
// rest of the village has been shut in since the seals were numbered.
// ============================================================

const KEY_FOUND = "arena_village_keys";
const KEY_VAULT = "arena_village_vault";
const KEY_BAL = "arena_runestones";

const HINT =
  "Five iron keys went into the weeds the night they sealed the quarter. Nobody drops them where a lamp will find them.";

// None of these sit in the open. Each one is behind something, low in
// the grass, and only catches the light once you are close.
export const VILLAGE_KEYS = [
  {
    id: "key-well",
    name: "Key of the Well",
    x: 9.3,
    z: 5.2,
    hint: "Someone dropped one fetching water — the far side of the well, where the weeds are.",
  },
  {
    id: "key-crates",
    name: "Key of the Cart",
    x: 16.6,
    z: -12.6,
    hint: "Round the back of the market carts, behind the stacked crates, out of the lamp.",
  },
  {
    id: "key-shrine",
    name: "Key of the Vigil",
    x: 0.4,
    z: -15.4,
    hint: "The dark side of the shrine, where the stone is always cold.",
  },
  {
    id: "key-treeline",
    name: "Key of the Treeline",
    x: -22.6,
    z: 12.6,
    hint: "Out past the last house, in the pines, where the fence stops.",
  },
  {
    id: "key-arch",
    name: "Key of the Road",
    x: 3.4,
    z: 33.2,
    hint: "In the shadow behind the arch, against the quarter wall.",
  },
];

export function foundKeys() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY_FOUND) || "[]");
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

export function rememberKey(id) {
  const list = foundKeys();
  if (list.indexOf(id) >= 0) return list;
  list.push(id);
  try {
    localStorage.setItem(KEY_FOUND, JSON.stringify(list));
  } catch (_) {}
  return list;
}

export function vaultClaimed() {
  try {
    return localStorage.getItem(KEY_VAULT) === "1";
  } catch (_) {
    return false;
  }
}

/** The door's reward: stones in the arena purse, and the village's last secret. */
export function claimVault() {
  if (vaultClaimed()) return 0;
  const balance = parseInt(localStorage.getItem(KEY_BAL) || "0", 10) || 0;
  try {
    localStorage.setItem(KEY_BAL, String(balance + 500));
    localStorage.setItem(KEY_VAULT, "1");
  } catch (_) {}
  return 500;
}

const line = (who, text) => ({ who, text });

export const FOLK = [
  {
    id: "folk-tamsin",
    name: "Tamsin Lampwright",
    role: "Lamplighter of the Hearth Road",
    icon: "🏮",
    accent: "#ffd9a0",
    variant: "woman",
    spot: { x: 2.4, z: 9.4 },
    wander: 4.2,
    wanderSpeed: 1.2,
    intro: "Mind the lamps. Every one of them is a wager that tonight is different from last night.",
    topics: [
      {
        id: "folk-tamsin-nine",
        label: "Who made the seals?",
        lines: [
          line("Tamsin Lampwright", "Nine scribes lived through the first Unwriting. They called themselves wardens, cut the Covenant of Stillness into a stone, and signed it nine times."),
          line("Tamsin Lampwright", "Then they built a guardian around a Lodestone Heart so one of it could hold five realms at once. Four hundred years of light on this road and nobody ever asked if the stone was willing."),
        ],
      },
      {
        id: "folk-tamsin-lamps",
        label: "Why light the road?",
        lines: [
          line("Tamsin Lampwright", "Because a Still Day does not have evenings. A held afternoon has no dusk, so if I stop lighting them nobody here would notice the night arriving."),
          line("Tamsin Lampwright", "I would notice. That is the whole job."),
        ],
      },
    ],
  },
  {
    id: "folk-bram",
    name: "Bram Hearthkeeper",
    role: "Keeper of the kettle",
    icon: "🫖",
    accent: "#ffb45c",
    variant: "smith",
    spot: { x: -4.2, z: 11.2 },
    wander: 3.4,
    wanderSpeed: 1.0,
    intro: "Don't ask me why the kettle never comes off the hook. Ask me what happens if it does.",
    topics: [
      {
        id: "folk-bram-kettle",
        label: "Why keep the kettle on?",
        lines: [
          line("Bram Hearthkeeper", "The Hearth Road was drawn after the last seal was numbered, so it carries no number at all. The Sentinel counts roads, doors, leaves — it has never counted this one."),
          line("Bram Hearthkeeper", "The kettle is a wager. As long as the water is moving, this village has not stopped, and a thing that has not stopped cannot be unwritten."),
          line("Bram Hearthkeeper", "That is also why the whole place smells of stew at four in the morning. You are welcome."),
        ],
      },
      {
        id: "folk-bram-corrected",
        label: "Who washes up here?",
        lines: [
          line("Bram Hearthkeeper", "People the Lattice trims out in the realms wake up on the seam remembering both versions of themselves. Most take the tidy one and go home."),
          line("Bram Hearthkeeper", "The ones who moved here took the untidy one. We argue about it over the kettle. It is a good argument. It has been going for a hundred years."),
        ],
      },
    ],
  },
  {
    id: "folk-wren",
    name: "Little Wren",
    role: "Runs errands, badly",
    icon: "🪁",
    accent: "#7de0b8",
    variant: "child",
    spot: { x: 6.2, z: 12.4 },
    wander: 6,
    wanderSpeed: 2.1,
    intro: "Are you the one who breaks the seals? I've got a leaf I keep trying to drop.",
    topics: [
      {
        id: "folk-wren-leaf",
        label: "What's the leaf for?",
        lines: [
          line("Little Wren", "Sable says in the Reliquary a leaf falls nine thousand times the same way. I found one here and I dropped it and it went sideways and nobody told me off."),
          line("Little Wren", "That's a Still Day, that's what that is. A day you're allowed to get wrong."),
        ],
      },
      {
        id: "folk-wren-keys",
        label: "Have you seen any keys?",
        lines: [
          line("Little Wren", "Five of them! Mum hid them when the Sentinel stopped counting things, and then she got corrected and forgot where, and I've been looking ever since."),
          line("Little Wren", `One of them is up some stairs. ${HINT}`),
        ],
      },
    ],
  },
  {
    id: "folk-ossa",
    name: "Mother Ossa",
    role: "Midwife of the uncounted",
    icon: "🌾",
    accent: "#d0c0ff",
    variant: "woman",
    spot: { x: -7.4, z: 12.6 },
    wander: 3.8,
    wanderSpeed: 1.15,
    intro: "I have delivered children into a village that is on nobody's map. It is a surprisingly good place to be born.",
    topics: [
      {
        id: "folk-ossa-heart",
        label: "What is the Lodestone Heart?",
        lines: [
          line("Mother Ossa", "A stone that can hold a written world in a single instant. The wardens built walls and protocols around it and told it that nothing may change."),
          line("Mother Ossa", "It obeyed the way a door obeys a house. Perfectly, and at the cost of everyone inside ever leaving."),
        ],
      },
      {
        id: "folk-ossa-vigil",
        label: "Why does the Sentinel never look here?",
        lines: [
          line("Mother Ossa", "Because we keep being written. A roof, a name, an argument, a grave. A map can only show what has stopped."),
          line("Mother Ossa", "That is the whole trick of this place. We are the margin it cannot draw."),
        ],
      },
    ],
  },
  {
    id: "folk-fen",
    name: "Fen the Ferryman",
    role: "Punts the seam",
    icon: "🛶",
    accent: "#9fe3ff",
    variant: "man",
    spot: { x: 12.6, z: 6.4 },
    wander: 4.6,
    wanderSpeed: 1.35,
    intro: "I carry the corrected across. Both of them, usually. They sit apart and argue.",
    topics: [
      {
        id: "folk-fen-margin",
        label: "What is the Margin?",
        lines: [
          line("Fen the Ferryman", "The blank every written thing needs in order to be allowed to forget itself. Write tight enough and it has nowhere to stand, so it stands in whatever is standing still."),
          line("Fen the Ferryman", "It isn't cruel. That's the part that keeps me up. It thinks a Still Day is an invitation, and it is only being polite."),
        ],
      },
      {
        id: "folk-fen-water",
        label: "Where does the seam go?",
        lines: [
          line("Fen the Ferryman", "Nowhere, and back. There's a hundred and four years sitting offshore of Glasswater like a held breath. I've punted right up to it."),
          line("Fen the Ferryman", "Tide won't move. Woman on the quay won't stop watching it. I don't go that way much any more."),
        ],
      },
    ],
  },
  {
    id: "folk-quill",
    name: "Quill",
    role: "Corrected scribe",
    icon: "✒️",
    accent: "#ffd166",
    variant: "man",
    spot: { x: -13.2, z: 4.2 },
    wander: 4,
    wanderSpeed: 1.25,
    intro: "I remember being two people. I have opinions about which one was better.",
    topics: [
      {
        id: "folk-quill-protocols",
        label: "What are the protocols?",
        lines: [
          line("Quill", "Three of them, cut into the Command Stone with nine signatures under. Preservation: hold. Correction: put back. Release: —"),
          line("Quill", "Release was never finished. A ninth warden had six words of it on the stone when the vault closed. The Sentinel has run two of the three ever since, and the missing one is the only one that would have let it stop."),
        ],
      },
      {
        id: "folk-quill-ninth",
        label: "Who was the ninth warden?",
        lines: [
          line("Quill", "Vesh. She lives down past the shrine now, in the only shape a half-finished thing can take. Be polite. She has been waiting three hundred years for somebody to end her sentence."),
        ],
      },
    ],
  },
  {
    id: "folk-greta",
    name: "Greta Coals",
    role: "Carter, seam market",
    icon: "🧺",
    accent: "#ff9ecb",
    variant: "woman",
    spot: { x: 16.2, z: -5.0 },
    wander: 3.2,
    wanderSpeed: 1.1,
    intro: "Buy from Nissa if you want a code. Buy from Odo if you want a story. Buy from me if you want it carried.",
    topics: [
      {
        id: "folk-greta-market",
        label: "How does the market work?",
        lines: [
          line("Greta Coals", "Nothing on this green is new. Everything on it is still moving, and that is the entire point of the place."),
          line("Greta Coals", "Cyphers travel. Tablets don't. If you want something spent in the arena, buy the wax."),
        ],
      },
      {
        id: "folk-greta-keys",
        label: "What's behind the stair-house door?",
        lines: [
          line("Greta Coals", "A door with five locks and no handle, and no keyhole you can reach without the five iron ones."),
          line("Greta Coals", "Whoever hid them picked the spots you'd never look: up the stairs, round the shrine, under the arch."),
        ],
      },
    ],
  },
  {
    id: "folk-marrow",
    name: "Old Marrow",
    role: "Gravedigger",
    icon: "🕯️",
    accent: "#b28aff",
    variant: "elder",
    spot: { x: 9.8, z: -12.6 },
    wander: 3.0,
    wanderSpeed: 0.9,
    intro: "I dig in a village where nobody can die properly. The work is light and the conversation is excellent.",
    topics: [
      {
        id: "folk-marrow-stillday",
        label: "What is a Still Day?",
        lines: [
          line("Old Marrow", "One afternoon held open. A festival that never got to end, a tide that never turned, a leaf that never landed. Every seal in five realms is one of those."),
          line("Old Marrow", "The kindest thing the wardens ever did and the cruellest thing they left running. Restore a seal and the day finally ends. Break it and everyone in it gets to start the worst afternoon of their lives again."),
        ],
      },
      {
        id: "folk-marrow-keys",
        label: "Do you hold a key?",
        lines: [
          line("Old Marrow", "I buried no keys. I did bury the woman who hid them, and she was laughing about it."),
          line("Old Marrow", `She said: ${HINT}`),
        ],
      },
    ],
  },
];

// The one waiting behind the five keys, in the quarter the keys open.
export const UNCOUNTED = {
  id: "folk-uncounted",
  name: "The Uncounted",
  role: "The eighth name",
  icon: "🌑",
  accent: "#9fe3ff",
  variant: "mystic",
  spot: { x: 0, z: 39.2 },
  wander: 0,
  wanderSpeed: 0,
  intro: "...so that is what the quarter looks like from the inside. Hello. I have been behind that gate since the last seal.",
  topics: [
    {
      id: "folk-uncounted-who",
      label: "Who are you?",
      lines: [
        line("The Uncounted", "The ninth warden signed the Covenant. Eight names are spoken of. I am the one they scraped out of the Command Stone so the vigil would have no author to question."),
        line("The Uncounted", "Take the stones in the chest. Take the last line with you instead: when they can choose, stand down. Eight words. The Covenant never had them. The Sentinel has been obeying a sentence without an ending ever since."),
        line("The Uncounted", "Go and read that line aloud where it can hear you. That is the whole of what I was made to keep."),
      ],
    },
    {
      id: "folk-uncounted-margin",
      label: "And the Margin?",
      lines: [
        line("The Uncounted", "It is not your enemy. It is the blank a living world needs so it is allowed to change. Let the realms move and it has nothing to take."),
      ],
    },
  ],
};

// The households inside the wall. They only come out to be met once the
// five iron keys have been turned, which is what makes the quarter a
// place rather than scenery.
export const QUARTER_FOLK = [
  {
    id: "folk-hallow",
    name: "Hallow Vane",
    role: "Keeper of the quarter wall",
    icon: "🔨",
    accent: "#e8c9a0",
    variant: "man",
    spot: { x: -2.7, z: 40.1 },
    wander: 2.4,
    wanderSpeed: 0.9,
    intro: "Thirty years I have kept this wall sound and I have never once been able to open the gate. You did it with keys. Keys.",
    topics: [
      {
        id: "folk-hallow-wall",
        label: "Why wall it off at all?",
        lines: [
          line("Hallow Vane", "The wardens walled the quarter the year they numbered the seals. Hold the map and hold the margin, they said, and keep the two from arguing."),
          line("Hallow Vane", "Then they stopped coming, and the argument stopped with them, and we were left on the inside of a wall with a gate nobody could work."),
        ],
      },
      {
        id: "folk-hallow-gate",
        label: "How did you survive shut in?",
        lines: [
          line("Hallow Vane", "Cabbage, mostly. And the stillroom: Vesper can make a meal out of a herb and a grudge."),
          line("Hallow Vane", "The Sentinel never counts what is behind a door it cannot open. That is the one mercy of being forgotten."),
        ],
      },
    ],
  },
  {
    id: "folk-moth",
    name: "Moth",
    role: "Born inside the wall",
    icon: "🕯️",
    accent: "#c8b0ff",
    variant: "child",
    spot: { x: 2.9, z: 39.4 },
    wander: 3.2,
    wanderSpeed: 1.7,
    intro: "I'm the first person ever born back here. Everyone else walked in and got stuck. Is the green big? Is it true there's a well?",
    topics: [
      {
        id: "folk-moth-green",
        label: "What do you want to see first?",
        lines: [
          line("Moth", "The well. Hallow says the water moves, and that a village that moves its water can't be unwritten."),
          line("Moth", "Also the arch. And the market. And whatever the shouting is at night."),
        ],
      },
      {
        id: "folk-moth-outside",
        label: "Do you want to leave?",
        lines: [
          line("Moth", "I want to walk out of a door that was shut when I was born, and then walk back in and have dinner. That's not leaving. That's just having a door."),
        ],
      },
    ],
  },
];