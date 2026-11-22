// ============================================================
// Vesper's stillroom — potions that only mean anything in Age of
// the Sentinel. A bottle is bought here and drunk at the chapter
// gate: `arena_sentinel_buffs` is what the campaign reads when a
// chapter starts, and it empties itself as it hands the buff over,
// so one bottle is one chapter and never a standard match.
// ============================================================

const KEY = "arena_sentinel_buffs";

export const POTIONS = [
  {
    id: "potion-draught",
    name: "Warden's Draught",
    cost: 45,
    icon: "🧪",
    effect: "Health +30% for one chapter",
    blurb:
      "Bitter, and warm all the way down. A chapter opened with a warden's constitution — more health, and the health you walk in with filled.",
  },
  {
    id: "potion-seamwalk",
    name: "Seamwalk Tonic",
    cost: 35,
    icon: "🫧",
    effect: "Pace +18% for one chapter",
    blurb:
      "Fizzy as a tide that has finally been let go. Your feet stop arguing with the ground for the length of one chapter.",
  },
  {
    id: "potion-ward",
    name: "Vigil Ward",
    cost: 55,
    icon: "🛡️",
    effect: "Starts a chapter behind 120 shield",
    blurb:
      "Ground salt and something that was once a seal. You begin the chapter already warded, before the first warder looks up.",
  },
];

const BY_ID = {};
POTIONS.forEach((potion) => {
  BY_ID[potion.id] = potion;
});

export function readStash() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch (_) {
    return {};
  }
}

export function ownsPotion(id) {
  return !!readStash()[id];
}

export function stockPotion(id) {
  if (!BY_ID[id]) return;
  const stash = readStash();
  stash[id] = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(stash));
  } catch (_) {}
}

export function potionName(id) {
  return BY_ID[id]?.name || "A potion";
}