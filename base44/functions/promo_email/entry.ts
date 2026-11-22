import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// The promotional email for Monster Arena.
//
//   GET  /functions/promo_email  → renders the mail as a web page (no send)
//   POST /functions/promo_email  → { to, preview?, siteUrl? }
//
// The play link is resolved at call time from the request itself, so the mail
// always points at wherever the app is currently served (preview, published
// link or a custom domain) instead of a URL baked in months ago. The three
// images sit in the app's own /promo folder and are fetched from that same
// address, so they follow the link.

const FALLBACK_SITE = 'https://monsterarena5.base44.app';

function cleanUrl(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?(\/.*)?$/i.test(trimmed)) return '';
  return trimmed;
}

function siteFromRequest(req, override) {
  const given = cleanUrl(override);
  if (given) return given;

  const header = (name) => req.headers.get(name) || '';
  const appUrl = cleanUrl(header('x-base44-app-url'));
  if (appUrl) return appUrl;

  for (const name of ['origin', 'referer']) {
    const raw = header(name);
    if (!raw) continue;
    try {
      const url = new URL(raw);
      if (url.hostname.endsWith('base44.app') || url.hostname.includes('.')) return cleanUrl(url.origin);
    } catch (_) { /* not a URL — keep looking */ }
  }

  const host = header('host');
  if (host && !host.startsWith('localhost')) return 'https://' + host.replace(/\/+$/, '');

  return FALLBACK_SITE;
}

const SHOTS = [
  { file: 'waves.png', title: 'The waves never stop', copy: 'Every fifth wave brings a warden with its own attack pattern — and its own way of refusing to die.' },
  { file: 'arsenal.png', title: 'Build the run your way', copy: 'Rifles, shotguns, sidearms and melee, unlocked and levelled between runs. Take three weapons, leave the rest.' },
  { file: 'glyphs.png', title: 'Glyphs rewrite the fight', copy: 'Five elements, dozens of enchantments. Chain them and a wave seven deep becomes a place you want to be.' },
];

function renderPromo(site) {
  const host = site.replace(/^https?:\/\//, '');
  const shots = SHOTS.map((shot) => `
              <tr>
                <td style="padding:0 0 22px 0;">
                  <a href="${site}" style="text-decoration:none;">
                    <img src="${site}/promo/${shot.file}" width="544" alt="${shot.title}" style="display:block;width:100%;max-width:544px;height:auto;border-radius:14px;border:1px solid #222b3d;" />
                  </a>
                  <div style="font:700 17px/1.3 'Helvetica Neue',Helvetica,Arial,sans-serif;color:#f3f7ff;margin:14px 0 6px 0;">${shot.title}</div>
                  <div style="font:400 14px/1.6 'Helvetica Neue',Helvetica,Arial,sans-serif;color:#9fb0c8;">${shot.copy}</div>
                </td>
              </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark light" />
<title>Monster Arena</title>
</head>
<body style="margin:0;padding:0;background:#05070d;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Five realms, 100 waves, one Sentinel. Play free in your browser — no download.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05070d;padding:28px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:linear-gradient(180deg,#0c1120 0%,#080b14 100%);border:1px solid #1d2436;border-radius:20px;overflow:hidden;">

        <tr>
          <td style="padding:34px 28px 10px 28px;text-align:center;">
            <div style="font:800 12px/1 'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:.32em;color:#ffc25c;text-transform:uppercase;">Monster Arena</div>
            <div style="font:800 34px/1.15 'Helvetica Neue',Helvetica,Arial,sans-serif;color:#ffffff;margin:16px 0 10px 0;">Survive the waves.<br />Break the seals.</div>
            <div style="font:400 15px/1.6 'Helvetica Neue',Helvetica,Arial,sans-serif;color:#9fb0c8;max-width:440px;margin:0 auto;">
              A neon arena shooter with 100-wave runs, a five-realm story campaign and glyph loadouts that change how you fight.
              Free to play in your browser &mdash; no download, no install.
            </div>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:22px 28px 8px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" bgcolor="#ffc25c" style="border-radius:999px;">
                  <a href="${site}" style="display:inline-block;padding:15px 34px;font:800 15px/1 'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:.04em;color:#10131b;text-decoration:none;border-radius:999px;">Play Monster Arena &rarr;</a>
                </td>
              </tr>
            </table>
            <div style="font:400 12px/1.5 'Helvetica Neue',Helvetica,Arial,sans-serif;color:#6f7f96;margin:12px 0 26px 0;">${host}</div>
          </td>
        </tr>

        <tr>
          <td style="padding:0 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${shots}
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:6px 28px 4px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1d2436;">
              <tr><td style="padding:22px 0 4px 0;font:800 12px/1 'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:.22em;color:#9fe3ff;text-transform:uppercase;">What is in there</td></tr>
              <tr><td style="padding:12px 0 0 0;font:400 14px/1.75 'Helvetica Neue',Helvetica,Arial,sans-serif;color:#c3cfe0;">
                &bull; <strong style="color:#f3f7ff;">Five realms, one campaign</strong> &mdash; the Age of the Sentinel, played out in a walkable village between chapters.<br />
                &bull; <strong style="color:#f3f7ff;">100-wave gauntlet</strong> &mdash; a rune every ten waves, and a rank that sticks.<br />
                &bull; <strong style="color:#f3f7ff;">Teams &amp; CTF online</strong> &mdash; shareable lobbies, bots to fill the gaps, one global chat.<br />
                &bull; <strong style="color:#f3f7ff;">Loadouts and glyphs</strong> &mdash; weapons, enchantments and elementals you keep between runs.
              </td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:26px 28px 30px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="border:1px solid #2b3548;border-radius:999px;">
                  <a href="${site}" style="display:inline-block;padding:13px 28px;font:800 14px/1 'Helvetica Neue',Helvetica,Arial,sans-serif;color:#eaf2ff;text-decoration:none;border-radius:999px;">Enter the arena &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:18px 28px 26px 28px;border-top:1px solid #1d2436;text-align:center;">
            <div style="font:400 11.5px/1.6 'Helvetica Neue',Helvetica,Arial,sans-serif;color:#5f6e84;">
              You are receiving this because someone thought you would enjoy it. You can ignore it &mdash; nothing is signed up.<br />
              <a href="${site}" style="color:#7f93ad;text-decoration:underline;">${host}</a>
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = req.method === 'GET' ? {} : await req.json().catch(() => ({}));
    const siteUrl = siteFromRequest(req, body.siteUrl);
    const html = renderPromo(siteUrl);
    const subject = 'Monster Arena — five realms, 100 waves, one Sentinel';

    if (req.method === 'GET') {
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (body.preview) {
      return Response.json({ siteUrl, subject, html });
    }

    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const to = String(body.to || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return Response.json({ error: 'A valid recipient email is required' }, { status: 400 });
    }

    await base44.asServiceRole.integrations.Core.SendEmail({
      to,
      subject,
      html,
      from_name: 'Monster Arena',
      category: 'marketing',
    });

    return Response.json({ ok: true, siteUrl, to });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}