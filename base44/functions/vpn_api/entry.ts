import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

// Tailscale bridge.
//
// This app does not run a tunnel: it asks Tailscale's own API to mint a
// single-use device auth key for a player (the equivalent of "issue a profile")
// and to revoke that key again. A device enrols by running one `tailscale up`
// command, which is what the downloaded file contains.
//
//   GET    /tailnet/-/devices      -> reachability check
//   POST   /tailnet/-/keys         -> { id, key }
//   DELETE /tailnet/-/keys/{id}    -> revoke
//   Auth: Authorization: Bearer <api access token>
//
// `-` means "the tailnet this token belongs to", so no tailnet name is needed.
// Nothing secret is stored: the auth key is returned once, and only the key id
// is kept so it can be revoked later.

const API = 'https://api.tailscale.com/api/v2';

function readSecret(name) {
  try { return String(secrets.get(name) || ''); } catch (_) { return ''; }
}

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function tailscale(path, init) {
  const token = readSecret('TAILSCALE_API_TOKEN');
  if (!token) throw fail('No Tailscale API token is saved for this app yet.', 503);

  const res = await fetch(API + path, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...((init && init.headers) || {})
    },
    signal: AbortSignal.timeout(12000)
  });
  const text = await res.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch (_) { body = {}; }
  if (!res.ok) {
    const detail = body.message || body.error || `Tailscale responded with ${res.status}.`;
    throw fail(detail, res.status === 401 || res.status === 403 ? 502 : 502);
  }
  return body;
}

function ascii(value) {
  return String(value || '')
    .replace(/[^\x20-\x7E]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function enrolmentScript(key, hostname) {
  const safeHost = hostname.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  return [
    '# Monster Arena — device enrolment',
    '#',
    '# 1. Install Tailscale on this device: https://tailscale.com/download',
    '# 2. Open a terminal as administrator and run the command below.',
    '#',
    `tailscale up --authkey=${key} --hostname=${safeHost}`,
    '#',
    '# This key is single-use and expires in 24 hours. Revoke it from the',
    '# Network page at any time before then.',
    ''
  ].join('\n');
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Sign in to manage device profiles.' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || 'status');

    if (action === 'status') {
      if (!readSecret('TAILSCALE_API_TOKEN')) {
        return Response.json({
          configured: false,
          reachable: null,
          reason: 'No Tailscale API token is saved for this app yet.'
        });
      }
      try {
        await tailscale('/tailnet/-/devices?fields=id');
        return Response.json({ configured: true, reachable: true, reason: 'Tailscale API reachable.' });
      } catch (error) {
        return Response.json({ configured: true, reachable: false, reason: error.message });
      }
    }

    if (action === 'provision') {
      const locationId = String(payload.locationId || '');
      const label = String(payload.label || '').trim().slice(0, 60) || 'This device';
      if (!locationId) return Response.json({ error: 'Choose a server location first.' }, { status: 400 });

      const location = await base44.asServiceRole.entities.VpnLocation
        .get(locationId)
        .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!location) return Response.json({ error: 'That location is not available.' }, { status: 404 });
      if (location.status === 'offline') {
        return Response.json({ error: 'That location is offline right now. Pick another one.' }, { status: 409 });
      }

      // Optional ACL tag carried on the location record (e.g. "tag:players").
      const tags = String(location.serverId || '').startsWith('tag:') ? [location.serverId] : [];

      const created = await tailscale('/tailnet/-/keys', {
        method: 'POST',
        body: JSON.stringify({
          capabilities: {
            devices: {
              create: {
                reusable: false,
                ephemeral: false,
                preauthorized: true,
                ...(tags.length ? { tags } : {})
              }
            }
          },
          expirySeconds: 86400,
          // Tailscale rejects anything outside plain printable ASCII here.
          description: ascii(label).slice(0, 50) || 'Monster Arena device'
        })
      });

      if (!created.key || !created.id) {
        return Response.json({ error: 'Tailscale did not return a usable key.' }, { status: 502 });
      }

      const profile = await base44.asServiceRole.entities.VpnProfile.create({
        ownerId: user.id,
        label,
        locationId: location.id,
        locationName: location.name,
        protocol: 'wireguard',
        peerId: String(created.id),
        status: 'active'
      });

      const safeName = label.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'device';
      return Response.json({
        profile: { id: profile.id, label: profile.label, status: profile.status },
        filename: `${safeName}.txt`,
        config: enrolmentScript(String(created.key), label)
      });
    }

    if (action === 'revoke') {
      const profileId = String(payload.profileId || '');
      if (!profileId) return Response.json({ error: 'Missing profile.' }, { status: 400 });

      const profile = await base44.asServiceRole.entities.VpnProfile
        .get(profileId)
        .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
      if (!profile) return Response.json({ error: 'Profile not found.' }, { status: 404 });
      if (profile.ownerId !== user.id && user.role !== 'admin') {
        return Response.json({ error: 'That profile belongs to another account.' }, { status: 403 });
      }
      if (profile.status === 'revoked') {
        return Response.json({ ok: true, alreadyRevoked: true });
      }

      try {
        await tailscale(`/tailnet/-/keys/${encodeURIComponent(profile.peerId)}`, { method: 'DELETE' });
      } catch (error) {
        // A key that is already gone (used or expired) needs no second revoke;
        // any other failure means it may still work, so leave the record active.
        if (!/404|not found|already/i.test(error.message)) throw error;
      }

      await base44.asServiceRole.entities.VpnProfile.update(profile.id, {
        status: 'revoked',
        revokedReason: 'Revoked from the account dashboard'
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}