import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Global duel ladder. The arena has no sign-in, so the game reports a duel
// result by name and this keeps one standing per name. Only the outcome is
// accepted — points are always worked out here.
const cleanName = (v) => String(v == null ? '' : v).replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'board');
    const service = base44.asServiceRole;

    if (action === 'record') {
      const name = cleanName(body?.name);
      if (!name) return Response.json({ error: 'name is required' }, { status: 400 });
      const won = !!body?.won;
      const found = await service.entities.DuelStanding.filter({ name }, { limit: 1 });
      const row = (found?.items || [])[0] || null;
      const patch = {
        name,
        wins: (row?.wins || 0) + (won ? 1 : 0),
        losses: (row?.losses || 0) + (won ? 0 : 1),
        points: (row?.points || 0) + (won ? 3 : 1),
        streak: won ? (row?.streak || 0) + 1 : 0
      };
      const saved = row
        ? await service.entities.DuelStanding.update(row.id, patch)
        : await service.entities.DuelStanding.create(patch);
      return Response.json({ ok: true, standing: saved });
    }

    // The board itself: the strongest duelists, plus this player's own line.
    const top = await service.entities.DuelStanding.list({ sort: '-points', limit: 20 });
    const rows = (top?.items || top || []).map((r) => ({
      name: r.name,
      points: r.points || 0,
      wins: r.wins || 0,
      losses: r.losses || 0,
      streak: r.streak || 0
    }));
    const me = cleanName(body?.name);
    let mine = rows.find((r) => r.name === me) || null;
    if (!mine && me) {
      const own = await service.entities.DuelStanding.filter({ name: me }, { limit: 1 });
      const r = (own?.items || [])[0];
      if (r) mine = { name: r.name, points: r.points || 0, wins: r.wins || 0, losses: r.losses || 0, streak: r.streak || 0 };
    }
    return Response.json({ rows, me: mine });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}