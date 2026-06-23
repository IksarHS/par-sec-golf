// ── Save backend (Vercel-style serverless) — deploy-ready, NOT deployed ──────────
// Stores one save blob per username, keyed by username (a NON-SECRET save key — see the
// security note in src/roguelike/profile.js; there is no auth here by design).
//
//   GET  /api/save?user=<name>     -> { ok:true, blob:<saveEnvelopeString>|null }
//   POST /api/save  {user, blob}   -> { ok:true }
//
// STORAGE is swappable via a tiny interface (get/set) so this can target Vercel KV / Upstash
// Redis in production, and falls back to a file (local dev) or in-memory (read-only FS) so the
// endpoint runs with zero config out of the box. The client (RG_SYNC) treats the backend as a
// convenience mirror — localStorage is always the source of truth — so any failure here is safe.
//
// HOW TO DEPLOY (later — do NOT do this now):
//   1. `vercel` (or push to a Vercel-linked repo). This file becomes the /api/save function.
//   2. Add a KV store: Vercel dashboard → Storage → create "Upstash KV" (or "Upstash Redis"),
//      connect it to the project. That injects KV_REST_API_URL + KV_REST_API_TOKEN env vars.
//   3. This file auto-detects those env vars and uses the KV store; no code change needed.
//   4. Point the game at it: set window.RG_SYNC_URL = 'https://<your-app>.vercel.app/api/save'
//      (or open the game with ?sync=<that url> once to persist it). Done.
//
// Env vars used (all optional; absence → file/memory fallback):
//   KV_REST_API_URL, KV_REST_API_TOKEN   (Upstash/Vercel KV REST API)

'use strict';

const fs = require('fs');
const path = require('path');

// ── Swappable storage interface: { get(user)->blob|null, set(user,blob) } ──────
function makeStore() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  // (a) Upstash / Vercel KV via the REST API (no SDK dependency — plain fetch).
  if (url && token && typeof fetch === 'function') {
    const key = (user) => 'parsec:save:' + user;
    return {
      kind: 'kv',
      async get(user) {
        const r = await fetch(`${url}/get/${encodeURIComponent(key(user))}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return null;
        const j = await r.json();
        return (j && j.result != null) ? j.result : null;
      },
      async set(user, blob) {
        // POST body = raw value; Upstash SET endpoint.
        const r = await fetch(`${url}/set/${encodeURIComponent(key(user))}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
          body: blob,
        });
        return r.ok;
      },
    };
  }

  // (b) File store (local dev): one JSON file under /tmp keyed by username.
  const dir = path.join(process.env.TMPDIR || '/tmp', 'parsec-saves');
  function fileFor(user) { return path.join(dir, encodeURIComponent(user) + '.json'); }
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  if (canWriteFiles(dir)) {
    return {
      kind: 'file',
      async get(user) { try { return fs.readFileSync(fileFor(user), 'utf8'); } catch (e) { return null; } },
      async set(user, blob) { try { fs.writeFileSync(fileFor(user), blob); return true; } catch (e) { return false; } },
    };
  }

  // (c) In-memory fallback (read-only FS / serverless cold-start): non-persistent, but the
  // endpoint still answers correctly within a warm instance. Last resort so it never 500s.
  const mem = (globalThis.__PARSEC_MEM = globalThis.__PARSEC_MEM || {});
  return {
    kind: 'memory',
    async get(user) { return mem[user] != null ? mem[user] : null; },
    async set(user, blob) { mem[user] = blob; return true; },
  };
}

function canWriteFiles(dir) {
  try { fs.accessSync(dir, fs.constants.W_OK); return true; } catch (e) { return false; }
}

const store = makeStore();

// Read a JSON body whether the platform pre-parsed it (req.body) or not (raw stream).
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return null; } }
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : null); } catch (e) { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

function sanitizeUser(u) {
  return String(u || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
}

// Vercel serverless handler (works for Node runtime; also fine under Express-style mounting).
module.exports = async function handler(req, res) {
  // CORS: the game may be served from a different origin (or file://). Permissive by design —
  // there is no secret here. Tighten to your domain in production if you wish.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const send = (code, obj) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
  };

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const user = sanitizeUser(url.searchParams.get('user'));
      if (!user) return send(400, { ok: false, error: 'missing user' });
      const blob = await store.get(user);
      return send(200, { ok: true, blob: blob || null, store: store.kind });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const user = sanitizeUser(body && body.user);
      const blob = body && body.blob;
      if (!user) return send(400, { ok: false, error: 'missing user' });
      if (typeof blob !== 'string' || blob.length > 512 * 1024) {
        return send(400, { ok: false, error: 'missing/oversized blob' });
      }
      const ok = await store.set(user, blob);
      return send(ok ? 200 : 500, { ok, store: store.kind });
    }

    return send(405, { ok: false, error: 'method not allowed' });
  } catch (e) {
    return send(500, { ok: false, error: String((e && e.message) || e) });
  }
};

// Allow `node api/save.js` to spin up a tiny standalone server for local testing / the harness.
if (require.main === module) {
  const http = require('http');
  const port = process.env.PORT || 8237;
  http.createServer(module.exports).listen(port, () => {
    console.log(`[parsec save] listening on :${port} (store=${store.kind})`);
  });
}
