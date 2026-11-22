// ============================================================
// Hollowmere's trade: two carts, their stock, and the cypher
// codes they hand out. Everything persists in localStorage
// beside the game's own rune ledger, so a purchase made in the
// village is already in the purse when the arena opens.
// ============================================================

import { ownsPotion, POTIONS, stockPotion } from "./villagePotion";

const KEY_BAL = "arena_runestones";
const KEY_UNLOCK = "arena_rune_unlocks";
const KEY_SHOP = "arena_village_shop";

function readJson(key, fallback) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "null");
    return raw === null ? fallback : raw;
  } catch (_) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}

/* ── the purse ────────────────────────────────────────────── */

export function balanceStones() {
  const n = parseInt(localStorage.getItem(KEY_BAL) || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function spendStones(amount) {
  const balance = balanceStones();
  if (balance < amount) return false;
  try {
    localStorage.setItem(KEY_BAL, String(balance - amount));
  } catch (_) {
    return false;
  }
  return true;
}

function grantStones(amount) {
  try {
    localStorage.setItem(KEY_BAL, String(balanceStones() + amount));
  } catch (_) {}
}

function grantWeapon(kind) {
  const owned = readJson(KEY_UNLOCK, []);
  const list = Array.isArray(owned) ? owned : [];
  if (list.indexOf(kind) < 0) {
    list.push(kind);
    writeJson(KEY_UNLOCK, list);
  }
}

/* ── the ledger ───────────────────────────────────────────── */

function readLedger() {
  const raw = readJson(KEY_SHOP, {});
  return {
    bought: Array.isArray(raw.bought) ? raw.bought : [],
    codes: Array.isArray(raw.codes) ? raw.codes : [],
    redeemed: Array.isArray(raw.redeemed) ? raw.redeemed : [],
  };
}

function writeLedger(ledger) {
  writeJson(KEY_SHOP, ledger);
}

export function ownsGood(goodId) {
  return readLedger().bought.indexOf(goodId) >= 0;
}

export function ownedCodes() {
  return readLedger().codes;
}

/* ── lore ─────────────────────────────────────────────────── */

export const LORE = {
  "lore-road": {
    title: "The Hearth Road",
    body:
      "The Hearth Road was drawn after the last seal was numbered, so it carries no number. The Sentinel counts roads and doors and leaves; it has never counted this one, and it never will, because a map cannot show the page it was drawn on."
  },
  "lore-kettle": {
    title: "The Kettle at the End",
    body:
      "Hollowmere keeps one kettle on the go at all hours, on the green, under a hook nobody remembers hanging. It is not a custom. It is a wager: as long as the water is moving, the village has not stopped, and a thing that has not stopped cannot be unwritten."
  },
  "lore-corrected": {
    title: "What the Corrected Remember",
    body:
      "People the Lattice trims in the realms wake on the seam remembering both versions of themselves — the one that was, and the one that was put back. Most choose the tidy one. The ones who moved here chose the untidy one, and argue about it over the kettle."
  },
  "lore-market": {
    title: "The Seam Market",
    body:
      "Two carts trade on the green: Nissa's cyphers, sealed in wax and worth carrying to a friend, and Odo's tablets, which he copies by hand from a vault he can no longer reach. Nothing here is new. Everything here is still moving, which is the entire point of the place."
  }
};

/* ── the carts ────────────────────────────────────────────── */

export const SHOPS = [
  {
    id: "nissa",
    keeper: "Nissa the Cipher",
    role: "Sealed cyphers & keys",
    icon: "🗝️",
    accent: "#ffd166",
    stand: { x: 12.8, z: -8.7 },
    greeting:
      "Sealed cyphers. You buy the wax, you carry the word, somebody else gets to spend it. Mind the wind — the codes smudge.",
    goods: [
      {
        id: "cipher-smg",
        kind: "code",
        name: "Cypher: SMG pattern",
        cost: 40,
        code: "CIPHER-SMG",
        reward: { type: "weapon", kind: "smg", label: "SMG blueprint" },
        blurb: "Fast fire, light damage. A sealed pattern for the arena's shop."
      },
      {
        id: "cipher-mark",
        kind: "code",
        name: "Cypher: Marksman pattern",
        cost: 75,
        code: "CIPHER-MARK",
        reward: { type: "weapon", kind: "marksman", label: "Marksman blueprint" },
        blurb: "Two enemies through one shot, if you are patient."
      },
      {
        id: "cipher-lmg",
        kind: "code",
        name: "Cypher: LMG pattern",
        cost: 95,
        code: "CIPHER-LMG",
        reward: { type: "weapon", kind: "lmg", label: "LMG blueprint" },
        blurb: "A very large magazine and a very slow reload."
      },
      {
        id: "cipher-stones",
        kind: "code",
        name: "Cypher: Warden's tally",
        cost: 30,
        code: "CIPHER-TALLY",
        reward: { type: "stones", amount: 55, label: "55 RuneStones" },
        blurb: "A sealed tally from a chapter the Sentinel never signed. Worth more than the wax."
      }
    ]
  },
  {
    id: "odo",
    keeper: "Odo the Chronicler",
    role: "Lore tablets, copied by hand",
    icon: "📜",
    accent: "#9fe3ff",
    stand: { x: 7.4, z: -14.6 },
    greeting:
      "Every tablet here was copied from a vault I can't reach any more. Buy the copy, keep the words. Nobody else is going to remember them for you.",
    goods: [
      { id: "lore-road", kind: "lore", name: "Tablet I — The Hearth Road", cost: 12, blurb: "Why the Sentinel has never once looked here." },
      { id: "lore-kettle", kind: "lore", name: "Tablet II — The Kettle at the End", cost: 18, blurb: "The village's oldest wager, and why it is never won." },
      { id: "lore-corrected", kind: "lore", name: "Tablet III — What the Corrected Remember", cost: 24, blurb: "Two versions of the same person, arguing over tea." },
      { id: "lore-market", kind: "lore", name: "Tablet IV — The Seam Market", cost: 30, blurb: "The two carts, and what the wax is actually for." }
    ]
  },
  {
    id: "vesper",
    keeper: "Vesper of the Stillroom",
    role: "Potions · Sentinel chapters only",
    icon: "🧪",
    accent: "#ff9ecb",
    stand: { x: -4.4, z: 36.2 },
    about:
      "A bottle bought here is stoppered, not drunk. It is opened for you at the gate of the next Age of the Sentinel chapter, stays with you for that chapter, and is gone when the chapter ends. Nothing in this cart does anything in a standard match.",
    greeting:
      "Bottles for the seals, not for the arena. Buy one and it waits for you at the next chapter gate — then it is spent.",
    goods: POTIONS.map((potion) => ({
      id: potion.id,
      kind: "potion",
      name: potion.name,
      cost: potion.cost,
      icon: potion.icon,
      effect: potion.effect,
      blurb: `${potion.effect}. ${potion.blurb}`
    }))
  },
  {
    id: "cartographer",
    keeper: "Halloran the Cartographer",
    role: "Explains what everything is",
    icon: "🗺️",
    accent: "#a9ffd6",
    stand: { x: 4.4, z: 36.2 },
    about:
      "No stock and no prices. Halloran draws the quarter's maps and answers questions, so that nobody spends a RuneStone on a thing they do not understand.",
    greeting: "I sell nothing. I draw maps and I answer questions, in that order. Ask.",
    goods: [
      {
        id: "info-stones",
        kind: "info",
        name: "What are RuneStones?",
        cost: 0,
        body:
          "The arena's currency. You earn them in runs, and every cart in Hollowmere takes them: cyphers from Nissa, tablets from Odo, bottles from Vesper. They are kept in your purse between sessions, so a long afternoon of waves pays for a potion the next day."
      },
      {
        id: "info-potions",
        kind: "info",
        name: "What does a potion actually do?",
        cost: 0,
        body:
          "A potion is one chapter and no more. It is drunk at the gate when you begin a chapter of Age of the Sentinel: more health, a longer stride, or a ward already up. Finish or fail the chapter and the bottle is spent. It never applies to a standard match, a PvP run or a team game."
      },
      {
        id: "info-keys",
        kind: "info",
        name: "What are the five iron keys?",
        cost: 0,
        body:
          "The quarter behind the arch was walled the year the seals were numbered. Five iron keys fit its gate: one behind the well, one behind the market carts, one on the dark side of the shrine, one in the pines, one in the shadow of the arch. All five lift the gate — and there are people living in there who have not been out since."
      },
      {
        id: "info-glyphs",
        kind: "info",
        name: "What are glyphs?",
        cost: 0,
        body:
          "Glyphs are the arena's upgrades, offered as a choice after a wave. Each belongs to one path — fire, lightning, spirit, water, earth — and the deeper unlocks in a path only appear once you have committed to it. In a Sentinel chapter a glyph choice is also the moment the chapter notices the warden is down."
      },
      {
        id: "info-ranks",
        kind: "info",
        name: "What are ranks and quests for?",
        cost: 0,
        body:
          "Ranks come from waves held and errands finished; a rank is shown beside your name wherever it can be seen. Side quests are the small jobs the villagers ask for — half are done here in the village, half out in the story — and each one pays RuneStones when you come back and tell them."
      }
    ]
  }
];

export function getShop(id) {
  return SHOPS.find((shop) => shop.id === id) || null;
}

/* ── codes from outside the carts ─────────────────────────── */

export const PROMO_CODES = {
  HOLLOWMERE: { label: "25 RuneStones", reward: { type: "stones", amount: 25 } },
  HEARTHROAD: { label: "Tablet I — The Hearth Road", reward: { type: "lore", id: "lore-road" } }
};

/* ── buying ───────────────────────────────────────────────── */

export function buy(shop, good) {
  // A map and an answer cost nothing: the cartographer is a teacher, not a stall.
  if (good.kind === "info") return { ok: true, message: good.body || "Nothing to add." };

  // A bottle is bought once, and waits at the chapter gate until it is drunk.
  if (good.kind === "potion") {
    if (ownsPotion(good.id)) return { ok: false, message: "One bottle of that is already stoppered in your satchel." };
    if (!spendStones(good.cost)) return { ok: false, message: `Not enough RuneStones — you need ${good.cost}.` };
    stockPotion(good.id);
    return { ok: true, message: `${good.name} is stoppered. It will be drunk for you at the next chapter gate.` };
  }

  const ledger = readLedger();
  if (ledger.bought.indexOf(good.id) >= 0) return { ok: false, message: "Already yours." };
  if (balanceStones() < good.cost) {
    return { ok: false, message: `Not enough RuneStones — you need ${good.cost}.` };
  }
  if (!spendStones(good.cost)) return { ok: false, message: "The purse came up short." };

  ledger.bought.push(good.id);
  if (good.kind === "code") {
    ledger.codes.push({
      code: good.code,
      name: good.name,
      label: good.reward.label || good.name,
      reward: good.reward,
      redeemed: false
    });
  }
  writeLedger(ledger);

  if (good.kind === "lore") return { ok: true, message: `Copied: ${LORE[good.id]?.title || good.name}.` };
  return { ok: true, message: `Sealed cypher ${good.code} is in your satchel.`, code: good.code };
}

/* ── redeeming ────────────────────────────────────────────── */

function applyReward(reward) {
  if (!reward) return "Nothing happens.";
  if (reward.type === "stones") {
    grantStones(reward.amount || 0);
    return `+${reward.amount} RuneStones.`;
  }
  if (reward.type === "weapon") {
    grantWeapon(reward.kind);
    return `${reward.label || reward.kind} unlocked in the arena shop.`;
  }
  if (reward.type === "lore") {
    const ledger = readLedger();
    if (ledger.bought.indexOf(reward.id) < 0) {
      ledger.bought.push(reward.id);
      writeLedger(ledger);
    }
    return `Tablet added: ${LORE[reward.id]?.title || reward.id}.`;
  }
  return "Nothing happens.";
}

export function redeem(rawCode) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { ok: false, message: "Write a cypher first." };

  const ledger = readLedger();
  if (ledger.redeemed.indexOf(code) >= 0) {
    return { ok: false, message: "That cypher has already been spent." };
  }

  const held = ledger.codes.find((entry) => entry.code === code);
  const promo = PROMO_CODES[code];
  const reward = held?.reward || promo?.reward;

  if (!reward) return { ok: false, message: `"${code}" is not a cypher anyone here has seen.` };

  const result = applyReward(reward);
  ledger.redeemed.push(code);
  if (held) held.redeemed = true;
  writeLedger(ledger);
  return { ok: true, message: result };
}