// ============================================================
// The wanderer in Hollowmere is the same character you fight
// with: the design and colour picked in Customise (stored by the
// arena under arenaSettings / sessionStorage) drive the avatar's
// palette and its flourish.
// ============================================================

export const PLAYER_COLORS = [
  "#98d7ff", // Blue Core
  "#ff7666", // Red Inferno
  "#7dffa3", // Toxic Green
  "#ffdf66", // Golden Alloy
  "#c066ff", // Void Purple
  "#e8f7ff", // Ice White
  "#ff9a3c", // Magma Orange
];

function safeParse(raw) {
  try {
    return JSON.parse(raw || "{}") || {};
  } catch (_) {
    return {};
  }
}

export function readPlayerLook() {
  let color = 0;
  let design = 0;

  const saved = safeParse(localStorage.getItem("arenaSettings"));
  if (Number.isFinite(saved.color)) color = saved.color;
  if (Number.isFinite(saved.design)) design = saved.design;

  // sessionStorage is the live, per-tab choice the arena itself reads first.
  try {
    const liveColor = sessionStorage.getItem("color");
    const liveDesign = sessionStorage.getItem("design");
    if (liveColor !== null && liveColor !== "") color = parseInt(liveColor, 10) || 0;
    if (liveDesign !== null && liveDesign !== "") design = parseInt(liveDesign, 10) || 0;
  } catch (_) {}

  const hex = PLAYER_COLORS[((color % PLAYER_COLORS.length) + PLAYER_COLORS.length) % PLAYER_COLORS.length];
  return { color: hex, design };
}