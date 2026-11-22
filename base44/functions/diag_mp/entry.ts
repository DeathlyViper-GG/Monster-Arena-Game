// Temporary diagnostic: drives the published game into a "Players only" PvP
// lobby and reports what the client actually has for walls and bots.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.56';
import { Stagehand } from 'npm:@browserbasehq/stagehand@3.7.3';

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try { await base44.auth.me(); } catch (e) { return Response.json({ error: 'unauthorized' }, { status: 401 }); }

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
    await page.goto('https://monster-arenaa.base44.app/', { waitUntil: 'domcontentloaded' });

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const frame = () => page.frames().find((f) => {
      const u = typeof f.url === 'function' ? f.url() : f.url;
      return String(u || '').includes('game.html');
    }) || page.mainFrame();

    const out = { steps: [] };
    const clickIn = async (sel) => {
      const ok = await frame().evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return false;
        el.scrollIntoView({ block: 'center' });
        el.click();
        return true;
      }, sel);
      out.steps.push({ sel, ok });
      return ok;
    };

    // wait for the game frame + boot screen to clear
    for (let i = 0; i < 40; i++) {
      const ready = await frame().evaluate(() => !!document.getElementById('overlayIntro'));
      if (ready) break;
      await sleep(1000);
    }
    await sleep(2000);

    await clickIn('#btnIntroMulti');
    await sleep(600);
    await clickIn('#modePvP');
    await sleep(600);
    await clickIn('[data-bots="0"]');
    await sleep(300);
    await clickIn('#modeOptsConfirm');
    await sleep(600);
    await clickIn('#createLobbyBtn');
    for (let i = 0; i < 20; i++) {
      const inLobby = await frame().evaluate(() => !!(window.Net && Net.state && Net.state.lobbyId));
      if (inLobby) break;
      await sleep(700);
    }
    await sleep(1500);
    await clickIn('#levelsGrid [data-level="1"]');
    await sleep(800);
    await clickIn('#mpStartBtn');

    // wait for the match to actually run
    for (let i = 0; i < 30; i++) {
      const playing = await frame().evaluate(() => {
        try { return !!(window.state && window.state.running); } catch (e) { return false; }
      });
      if (playing) break;
      await sleep(700);
    }
    await sleep(3000);

    out.state = await frame().evaluate(() => {
      const g = (fn, d) => { try { return fn(); } catch (e) { return d; } };
      return {
        lobbyId: g(() => window.Net.state.lobbyId, null),
        mpBotsFlag: g(() => window.MP_BOTS, 'unset'),
        botsEnabledFlag: g(() => window.BOTS_ENABLED, null),
        pvp: g(() => window.PVP_MODE, null),
        walls: g(() => window.world.walls.length, -1),
        solids: g(() => window.world.solids.length, -1),
        buildings: g(() => window.world.buildings.length, -1),
        spBots: g(() => (window.SPBOTS_LEN ?? (typeof SP_BOTS !== 'undefined' ? SP_BOTS.length : -1)), -1),
        snapBots: g(() => (window.Net.state.snapshot && window.Net.state.snapshot.bots) ? window.Net.state.snapshot.bots.length : -1, -1),
        snapPlayers: g(() => (window.Net.state.snapshot && window.Net.state.snapshot.players) ? window.Net.state.snapshot.players.length : -1, -1),
        running: g(() => !!window.state.running, null),
        playerPos: g(() => ({ x: Math.round(window.player.x), y: Math.round(window.player.y) }), null),
      };
    });

    return Response.json(out);
  } finally {
    await stagehand?.close().catch(() => {});
    await session.end();
  }
}