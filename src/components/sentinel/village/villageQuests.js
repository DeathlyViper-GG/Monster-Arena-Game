// ============================================================
// Side quests — the errands the people of Hollowmere actually ask
// you for. Half are finished inside the village (find the keys,
// stand on the porch, walk through the gate) and half are finished
// out in Age of the Sentinel (break a seal, hold a wave).
//
// Village work is ticked off here. Story work is ticked off by the
// campaign itself, which writes the same ledger from inside the
// game frame — both sides share `arena_village_quests`, so a seal
// broken in the arena is already counted when you walk back in.
// ============================================================

const KEY = "arena_village_quests";
const KEY_BAL = "arena_runestones";

export const QUESTS = [
  {
    id: "q-wren-leaf",
    giver: "folk-wren",
    title: "A Leaf, Dropped",
    scope: "village",
    event: "zone:porch",
    goal: 1,
    brief:
      "Wren has a leaf she keeps trying to drop. In the Reliquary a leaf falls the same way nine thousand times; she wants to see one let go somewhere it was never told to land.",
    objective: "Drop the leaf from the stair-house porch.",
    reward: 30,
  },
  {
    id: "q-marrow-keys",
    giver: "folk-marrow",
    title: "The Five Iron Keys",
    scope: "village",
    event: "keys",
    goal: 5,
    brief:
      "Old Marrow buried the woman who hid the five iron keys, and she was laughing when she did it. He would like to see all five in one hand before he digs for her.",
    objective: "Find all five iron keys.",
    reward: 60,
  },
  {
    id: "q-quill-quarter",
    giver: "folk-quill",
    title: "Through the Wall",
    scope: "village",
    event: "zone:quarter",
    goal: 1,
    brief:
      "Quill remembers two versions of the street behind the quarter gate — the tidy one and the real one. He has never been able to walk down either, and asks you to tell him which is true.",
    objective: "Walk through the Margin Door into the quarter.",
    reward: 80,
  },
  {
    id: "q-bram-seal",
    giver: "folk-bram",
    title: "Break One Seal",
    scope: "story",
    event: "seal",
    goal: 1,
    brief:
      "Bram keeps the kettle on because a thing that has not stopped cannot be unwritten. He wants proof of it: break a seal in the story and come back still moving.",
    objective: "Break any seal in Age of the Sentinel.",
    reward: 50,
  },
  {
    id: "q-tamsin-wave",
    giver: "folk-tamsin",
    title: "Hold to the Fifth Wave",
    scope: "story",
    event: "wave5",
    goal: 1,
    brief:
      "Tamsin lights a road against a night nobody here has ever seen arrive. Reach the fifth wave of a chapter and she will call the lamps paid for.",
    objective: "Reach wave 5 in any Sentinel chapter.",
    reward: 40,
  },
  {
    id: "q-ossa-third",
    giver: "folk-ossa",
    title: "The Third Seal",
    scope: "story",
    event: "seal3",
    goal: 1,
    brief:
      "Mother Ossa delivered children into a village on nobody's map. She asks after the third seal in particular: the tide, the seven ships, the woman on the quay.",
    objective: "Break the third seal — Glasswater Reach.",
    reward: 90,
  },
];

const BY_ID = {};
QUESTS.forEach((quest) => {
  BY_ID[quest.id] = quest;
});

const BLANK = { p: 0, done: false, claimed: false, accepted: false };

function readLedger() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch (_) {
    return {};
  }
}

function writeLedger(ledger) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ledger));
  } catch (_) {}
}

export function questState(id) {
  const entry = readLedger()[id] || {};
  return { ...BLANK, ...entry };
}

/** Every quest ledger entry, so the tracker can list what is open. */
export function allQuestStates() {
  return readLedger();
}

export function questFor(giverId) {
  const def = QUESTS.find((quest) => quest.giver === giverId);
  if (!def) return null;
  return { def, state: questState(def.id) };
}

export function acceptQuest(id) {
  const def = BY_ID[id];
  const ledger = readLedger();
  const entry = { ...BLANK, ...(ledger[id] || {}) };
  entry.accepted = true;

  // Taking the key errand with the keys already in the satchel should not
  // mean going and finding them twice.
  if (def && def.event === "keys") {
    let held = 0;
    try {
      const list = JSON.parse(localStorage.getItem("arena_village_keys") || "[]");
      held = Array.isArray(list) ? list.length : 0;
    } catch (_) {
      held = 0;
    }
    entry.p = Math.min(def.goal, Math.max(entry.p, held));
    if (entry.p >= def.goal) entry.done = true;
  }

  ledger[id] = entry;
  writeLedger(ledger);
  return entry;
}

function bump(id, amount) {
  const def = BY_ID[id];
  if (!def) return;
  const ledger = readLedger();
  const entry = { ...BLANK, ...(ledger[id] || {}) };
  if (!entry.accepted || entry.done) return;
  entry.p = Math.min(def.goal, Math.max(entry.p, 0) + amount);
  if (entry.p >= def.goal) entry.done = true;
  ledger[id] = entry;
  writeLedger(ledger);
}

/** Walking onto a landmark: "porch", "quarter". */
export function noteZone(zone) {
  if (!zone) return;
  QUESTS.forEach((quest) => {
    if (quest.event === `zone:${zone}`) bump(quest.id, 1);
  });
}

/** How many keys are in the satchel right now (not how many were just picked up). */
export function noteKeys(count) {
  QUESTS.forEach((quest) => {
    if (quest.event !== "keys") return;
    const ledger = readLedger();
    const entry = { ...BLANK, ...(ledger[quest.id] || {}) };
    if (!entry.accepted || entry.done) return;
    entry.p = Math.min(quest.goal, Math.max(entry.p, Number(count) || 0));
    if (entry.p >= quest.goal) entry.done = true;
    ledger[quest.id] = entry;
    writeLedger(ledger);
  });
}

export function claimQuest(id) {
  const def = BY_ID[id];
  if (!def) return { ok: false, message: "No such errand." };
  const ledger = readLedger();
  const entry = { ...BLANK, ...(ledger[id] || {}) };
  if (!entry.done) return { ok: false, message: "Not finished yet." };
  if (entry.claimed) return { ok: false, message: "Already paid." };

  entry.claimed = true;
  ledger[id] = entry;
  writeLedger(ledger);

  const balance = parseInt(localStorage.getItem(KEY_BAL) || "0", 10) || 0;
  try {
    localStorage.setItem(KEY_BAL, String(balance + def.reward));
  } catch (_) {}

  return { ok: true, message: `✦ ${def.reward} RuneStones — the errand is done.` };
}

/** The open errands, for the tracker in the corner of the village. */
export function trackedQuests() {
  const ledger = readLedger();
  return QUESTS.filter((quest) => {
    const entry = ledger[quest.id];
    return entry && entry.accepted && !entry.claimed;
  }).map((quest) => ({ def: quest, state: { ...BLANK, ...(ledger[quest.id] || {}) } }));
}

export function storyEventQuestIds(event) {
  return QUESTS.filter((quest) => quest.scope === "story" && quest.event === event).map((quest) => quest.id);
}