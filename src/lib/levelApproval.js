import { base44 } from "@/api/base44Client";

// A level reaches the community board only when DeathlyViper has sealed it.
// The seal is its own record, and only the owner account may write one — so a
// builder flipping their own level's status to "approved" puts nothing on the
// board; it takes the owner's seal as well.
export async function sealedIds() {
  const page = await base44.entities.LevelApproval.filter({}, { limit: 500 });
  return new Set((page.items || []).map((seal) => seal.level_id));
}

export async function seal(level) {
  const existing = await base44.entities.LevelApproval.filter({ level_id: level.id }, { limit: 1 });
  if ((existing.items || []).length) return;
  await base44.entities.LevelApproval.create({
    level_id: level.id,
    level_name: level.name || "",
    verdict: "approved",
  });
}

export async function unseal(levelId) {
  await base44.entities.LevelApproval.deleteMany({ level_id: levelId });
}