import { base44 } from "@/api/base44Client";

// Cloud save for a player's whole Monster Arena profile: rank XP, kills and
// deaths, RuneStones and weapon unlocks, quests, story progress, skins, friends.
//
// The game iframe and this React parent share localStorage (same origin), so the
// parent reads/writes these keys directly to hydrate from the cloud or upload.
//
// Every progress key starts with "arena". The exceptions are session / identity
// state (lobby code, current level, global chat id), which stays on the device.
const PREFIX = "arena";
const SKIP = new Set(["arenaGlobalId", "arenaMode", "arenaLevel", "arenaMpTeam", "arenaCloudAccount", "arenaAuthEmail"]);
// Preferences, not progress: the device you are on keeps its own choice.
const LOCAL_WINS = new Set(["arenaSettings", "arena_loadout", "arenaNick"]);

// Which account the cloud save in this browser belongs to, so a second account
// signing in on the same device replaces the first one's data instead of
// merging two players' progress together.
const ACCOUNT_KEY = "arenaCloudAccount";

export function isProgressKey(key) {
  return typeof key === "string" && key.indexOf(PREFIX) === 0 && !SKIP.has(key);
}

export function cloudAccountId() {
  try { return localStorage.getItem(ACCOUNT_KEY) || ""; } catch (_) { return ""; }
}

export function setCloudAccountId(id) {
  try { localStorage.setItem(ACCOUNT_KEY, id || ""); } catch (_) {}
}

// Every progress key currently on this device (values are raw localStorage strings).
function localProgress() {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (isProgressKey(k)) out[k] = localStorage.getItem(k);
    }
  } catch (_) {}
  return out;
}

export function bundleProgress() {
  return localProgress();
}

// ---- merging ---------------------------------------------------------------
// Two saves of the same profile are combined rather than one replacing the
// other, so nothing is ever lost: counters take the higher value, flags are
// true if either says so, and lists (unlocks, friends, codex) are united.
function parse(v) {
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch (_) { return v; }
}

function mergeValues(local, cloud) {
  if (local === undefined || local === null) return cloud;
  if (cloud === undefined || cloud === null) return local;
  if (typeof local === "number" && typeof cloud === "number") return Math.max(local, cloud);
  if (typeof local === "boolean" && typeof cloud === "boolean") return local || cloud;
  if (Array.isArray(local) && Array.isArray(cloud)) {
    const seen = new Set(local.map((x) => JSON.stringify(x)));
    const out = local.slice();
    for (const x of cloud) {
      const s = JSON.stringify(x);
      if (!seen.has(s)) { seen.add(s); out.push(x); }
    }
    return out;
  }
  if (typeof local === "object" && typeof cloud === "object" && !Array.isArray(local) && !Array.isArray(cloud)) {
    const out = {};
    const all = new Set([...Object.keys(local), ...Object.keys(cloud)]);
    for (const k of all) out[k] = mergeValues(local[k], cloud[k]);
    return out;
  }
  return local; // plain values: this device is the fresher copy
}

function mergeKey(key, localStr, cloudStr) {
  if (LOCAL_WINS.has(key)) return localStr != null ? localStr : cloudStr;
  const merged = mergeValues(parse(localStr), parse(cloudStr));
  return typeof merged === "string" ? merged : JSON.stringify(merged);
}

// Write a cloud save back into shared localStorage, merged with what is already
// here. With { adopt: true } the cloud save replaces local progress instead,
// which is what a different account signing in on this device must do.
export function hydrateProgress(gp, opts) {
  if (!gp || typeof gp !== "object") return false;
  const adopt = !!(opts && opts.adopt);
  const here = localProgress();
  const all = new Set(Object.keys(gp));
  if (adopt) for (const k of Object.keys(here)) all.add(k);

  let wrote = false;
  for (const k of all) {
    if (!isProgressKey(k)) continue;
    const cloudStr = gp[k] == null ? null : String(gp[k]);
    const localStr = here[k] == null ? null : here[k];

    let next;
    if (adopt) next = cloudStr;
    else if (localStr == null) next = cloudStr;
    else if (cloudStr == null) next = localStr;
    else next = mergeKey(k, localStr, cloudStr);

    try {
      if (next == null) {
        if (localStr != null) { localStorage.removeItem(k); wrote = true; }
      } else if (next !== localStr) {
        localStorage.setItem(k, next);
        wrote = true;
      }
    } catch (_) {}
  }
  return wrote;
}

// Persist the current local progress onto the signed-in user's record.
// Non-fatal: if the call fails (network / credits) the next save retries, and
// local progress is untouched either way.
export async function uploadProgress() {
  try {
    await base44.auth.updateMe({ gameProgress: bundleProgress() });
    return true;
  } catch (_) {
    return false;
  }
}