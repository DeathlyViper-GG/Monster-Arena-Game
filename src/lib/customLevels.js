// Shared vocabulary for player-built levels: realms, modes, monsters, wardens,
// the arena grid, and the hand-off that launches a level inside the game.

export const WORLD = { w: 4000, h: 2800, cell: 100 };

export const THEMES = [
  { id: 1, name: "Meadow", accent: "#7dffa3", hazard: "No hazards" },
  { id: 2, name: "Desert", accent: "#ffd166", hazard: "Quicksand" },
  { id: 3, name: "Ice Cavern", accent: "#9fe3ff", hazard: "Chasms + frost" },
  { id: 4, name: "Lava Pits", accent: "#ff7a66", hazard: "Lava + blasts" },
  { id: 5, name: "Neon Void", accent: "#d066ff", hazard: "Void + phase" },
];

export const MODES = [
  {
    id: "pve",
    label: "Survival (waves)",
    blurb: "Waves of monsters, ending with whatever wardens you place. Cleared on the last wave.",
  },
  {
    id: "pvp",
    label: "PvP arena",
    blurb: "A free-for-all arena dressed in your map — bots fill the empty slots.",
  },
];

export const MONSTERS = [
  { id: "chaser", label: "Chaser", group: "Bestiary", desc: "Runs straight at you." },
  { id: "tank", label: "Tank", group: "Bestiary", desc: "Slow, heavily armoured." },
  { id: "shooter", label: "Shooter", group: "Bestiary", desc: "Fires aimed shots." },
  { id: "sniper", label: "Sniper", group: "Bestiary", desc: "Long range, high damage." },
  { id: "bomber", label: "Bomber", group: "Bestiary", desc: "Charges in and detonates." },
  { id: "healer", label: "Healer", group: "Bestiary", desc: "Heals the monsters around it." },
  { id: "magmalurk", label: "Magma Lurker", group: "Elemental", desc: "Lobs magma that leaves a burning pool." },
  { id: "stormcaller", label: "Storm Caller", group: "Elemental", desc: "Every bolt forks into three." },
  { id: "rimewarden", label: "Rime Warden", group: "Elemental", desc: "A slow surge of water that chills you." },
  { id: "quakestrider", label: "Quake Strider", group: "Elemental", desc: "Stomps a ring of stone out of the floor." },
  { id: "soulmote", label: "Soul Mote", group: "Elemental", desc: "Casts a wisp that hunts you down." },
];

// Every warden fights with its own staged attack set in the engine.
export const BOSSES = [
  { id: "boss", label: "Realm Warden", desc: "The standard warden: seals, volleys, charges and a final rush." },
  { id: "hearth_warden", label: "Hearth Warden", desc: "Ember circles, hearth-fire walls and a burning stage sweep." },
  { id: "pharaoh_glass", label: "Pharaoh of Glass", desc: "Glass mirrors, shard storms and split reflections." },
  { id: "rime_oracle", label: "Rime Oracle", desc: "Frozen lanes, ice rings and a chilling blizzard." },
  { id: "magma_titan", label: "Magma Titan", desc: "Molten chains, fissures and reshaping the arena floor." },
  { id: "void", label: "Void Sovereign", desc: "Phase shifts, void rifts and collapsing space." },
  { id: "sealwright", label: "The Sealwright", desc: "Sentinel chapter I — law-corridors of seals stamped across the arena." },
  { id: "choir_ash", label: "Choir of Ashes", desc: "Sentinel chapter II — cinder drops and three-arm fire wakes." },
  { id: "hourglass_stag", label: "Hourglass Stag", desc: "Sentinel chapter III — time-split charges and sandglass rings." },
  { id: "gilded_bailiff", label: "The Gilded Bailiff", desc: "Sentinel chapter IV — molten writs, dockets and the Golden Verdict." },
];

export const CHEST_RARITIES = ["common", "rare", "epic", "legendary"];

export const OWNER_EMAIL = "akalexkar@outlook.com";

// DeathlyViper is the one account that may approve a level: the account signed
// in as akalexkar@outlook.com. Nothing else counts — no role, no display name,
// and nothing a player can set in their own browser.
export function isOwner(user) {
  if (!user) return false;
  return String(user.email || "").toLowerCase().trim() === OWNER_EMAIL;
}

// The game page mirrors the signed-in account into storage so the embedded
// arena knows who is playing. Reading that same mirror keeps the reviewer
// tools available on a page whose own auth check has not resolved an account
// (a resumed session has no token in the URL for AuthContext to check).
export function storedAccount() {
  try {
    return {
      email: String(localStorage.getItem("arenaAuthEmail") || ""),
      dev: localStorage.getItem("arenaDevAccount") === "1",
    };
  } catch (_) {
    return { email: "", dev: false };
  }
}

// DeathlyViper's tools: the signed-in owner account, and only that account.
export function isReviewer(user, me) {
  return isOwner(user) || isOwner(me);
}

export function themeOf(id) {
  return THEMES.find((t) => t.id === Number(id)) || THEMES[0];
}

export function bossOf(id) {
  return BOSSES.find((b) => b.id === id) || null;
}

// A fresh wave list: the engine's own opening composition, then a steady mix.
const OPENING = {
  1: ["chaser"],
  2: ["chaser", "tank"],
  3: ["chaser", "tank", "shooter"],
  4: ["tank", "shooter", "sniper", "chaser"],
  5: ["tank", "shooter", "sniper", "chaser"],
  6: ["chaser", "tank", "shooter", "sniper", "bomber"],
  7: ["tank", "shooter", "sniper", "bomber"],
  8: ["tank", "shooter", "sniper", "bomber"],
  9: ["shooter", "sniper", "bomber"],
  10: ["shooter", "sniper", "bomber", "healer"],
};

export function defaultWaves(count, bossWave = count) {
  const out = [];
  for (let n = 1; n <= count; n++) {
    out.push({
      n,
      types: (OPENING[n] || ["tank", "shooter", "sniper", "bomber", "healer"]).slice(),
      boss: n === bossWave && bossWave > 0 ? "boss" : null,
    });
  }
  return out;
}

export function resizeWaves(waves, count) {
  const out = [];
  for (let n = 1; n <= count; n++) {
    const prev = waves.find((w) => Number(w.n) === n);
    out.push(prev ? { ...prev, n } : { n, types: ["chaser", "tank"], boss: null });
  }
  return out;
}

export function emptyLayout() {
  return { obstacles: [], buildings: [], chests: [], generators: [] };
}

// Hands the level to the game page, which passes it into the arena.
export function playLevel(level) {
  const payload = {
    id: level.id,
    name: level.name,
    mode: level.mode === "pvp" ? "pvp" : "pve",
    theme_id: Number(level.theme_id) || 1,
    wave_count: Number(level.wave_count) || 5,
    layout: level.layout || emptyLayout(),
    waves: Array.isArray(level.waves) ? level.waves : [],
  };
  try { sessionStorage.setItem("arenaLaunchLevel", JSON.stringify(payload)); } catch (_) {}
  window.location.href = "/";
}