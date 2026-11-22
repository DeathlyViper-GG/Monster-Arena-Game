// Temporary diagnostic (fast): loads the published game into an OFF-LINE Teams
// match, walks into the nearest border wall and reports the collision numbers.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.56';
import { Stagehand } from 'npm:@browserbasehq/stagehand@3.7.3';
import { z } from 'npm:zod@4.4.1';

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try { await base44.auth.me(); } catch (e) { return Response.json({ error: 'unauthorized' }, { status: 401 }); }

  const started = Date.now();
  const session = await base44.asServiceRole.browser.getSession();
  let stagehand;
  try {
    const { baseURL, token, headers } = base44.asServiceRole.aiGateway.connection();
    stagehand = new Stagehand({
      env: 'LOCAL',
      localBrowserLaunchOptions: { cdpUrl: session.connectionUrl },
      model: { modelName: 'openai/gpt_6_luna', apiKey: token, baseURL, headers, openaiEndpointFormat: 'chat' },
      disablePino: true,
    });
    await stagehand.init();
    const page = stagehand.context.pages()[0];
    await page.goto('https://monsterarenagame.base44.app/', { waitUntil: 'domcontentloaded' });

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const frame = () => page.frames().find((f) => {
      const u = typeof f.url === 'function' ? f.url() : f.url;
      return String(u || '').includes('game.html');
    }) || page.mainFrame();

    const out = { ms: 0, steps: [] };
    const click = async (s) => {
      const ok = await frame().evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; el.click(); return true; }, s);
      out.steps.push([s, ok]);
      return ok;
    };

    for (let i = 0; i < 25; i++) {
      if (await frame().evaluate(() => !!document.getElementById('overlayIntro'))) break;
      await sleep(800);
    }
    await sleep(1200);

    await click('#btnIntroOffline');
    await sleep(400);
    await click('#btnOfflineTeams');
    await sleep(400);
    await click('#levelsGrid [data-level="1"]');

    for (let i = 0; i < 20; i++) {
      if (await frame().evaluate(() => { try { return !!(window.state && window.state.running); } catch (e) { return false; } })) break;
      await sleep(600);
    }
    await sleep(1800);

    const probe = () => frame().evaluate(() => {
      const g = (fn, d) => { try { return fn(); } catch (e) { return d; } };
      const P = g(() => window.player, null), W = g(() => window.world, null);
      if (!P || !W) return { missing: true };
      const isBorder = (s) => s.x <= 1 || s.y <= 1 || s.x + s.w >= W.w - 1 || s.y + s.h >= W.h - 1;
      const borders = (W.walls || []).filter(isBorder).map((s) => [s.x, s.y, s.w, s.h]);
      const snap = g(() => window.Net && window.Net.state && window.Net.state.snapshot, null);
      const me = snap && Array.isArray(snap.players) ? snap.players.find((p) => p.id === window.Net.state.peerId) : null;
      const blk = (x, y) => g(() => W.isBlocked(x, y, P.r || 16, P.z), null);
      return {
        w: W.w, h: W.h, x: Math.round(P.x), y: Math.round(P.y), r: P.r,
        insetLeft: Math.round(P.x), insetRight: Math.round(W.w - P.x), insetTop: Math.round(P.y), insetBottom: Math.round(W.h - P.y),
        walls: W.walls.length, solids: W.solids.length, borders,
        blk: { left: blk(P.x - 2, P.y), right: blk(P.x + 2, P.y), up: blk(P.x, P.y - 2), down: blk(P.x, P.y + 2) },
        me: me ? [Math.round(me.x), Math.round(me.y)] : null,
        net: g(() => !!(window.Net && Net.state && Net.state.lobbyId), null),
        running: g(() => !!window.state.running, null)
      };
    });

    out.before = await probe();
    const b = out.before || {};
    const gaps = [['a', b.insetLeft], ['d', b.insetRight], ['w', b.insetTop], ['s', b.insetBottom]]
      .filter((p) => Number.isFinite(p[1])).sort((p, q) => p[1] - q[1]);
    const key = gaps.length ? gaps[0][0] : 'd';
    out.key = key;

    await frame().evaluate((k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })), key);
    await sleep(2600);
    await frame().evaluate((k) => window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true })), key);
    await sleep(300);
    out.after = await probe();
    out.ms = Date.now() - started;
    return Response.json(out);
  } finally {
    await stagehand?.close().catch(() => {});
    await session.end();
  }
}