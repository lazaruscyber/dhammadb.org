/**
 * Peer-review score API (Cloudflare Pages Function).
 *
 *   GET  /api/review?key=<page key>   ->  { count, reviewed }
 *   POST /api/review  { key, title }  ->  { count, reviewed: true }
 *
 * Needs a D1 database bound to the Pages project with the variable name REVIEWS_DB.
 * The table is created automatically on first use.
 *
 * Each reader can confirm a page once. Readers are told apart by a SHA-256 hash of
 * their IP address and a secret salt, so no IP address is ever stored.
 * Set a REVIEW_SALT environment variable in the Pages project to a long random string.
 */

const SCHEMA = `CREATE TABLE IF NOT EXISTS reviews (
  page_key   TEXT    NOT NULL,
  voter      TEXT    NOT NULL,
  title      TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (page_key, voter)
)`;

let schemaReady = false;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

// "v:" + SHA-256 page fingerprint, or "t:" + lower-case page title.
function validKey(key) {
  return typeof key === 'string' && /^(v:[0-9a-f]{64}|t:[^\n\r]{1,200})$/.test(key);
}

async function database(env) {
  const db = env.REVIEWS_DB;
  if (!db) return null;
  if (!schemaReady) {
    await db.prepare(SCHEMA).run();
    schemaReady = true;
  }
  return db;
}

async function voterId(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const salt = env.REVIEW_SALT || 'dhammadb-peer-review';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + '|' + ip));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function countFor(db, key) {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM reviews WHERE page_key = ?').bind(key).first();
  return row ? Number(row.n) : 0;
}

export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get('key');
  if (!validKey(key)) return json({ error: 'Invalid page key.' }, 400);
  const db = await database(env);
  if (!db) return json({ error: 'Peer review storage is not configured.' }, 503);

  const voter = await voterId(request, env);
  const mine = await db.prepare('SELECT 1 FROM reviews WHERE page_key = ? AND voter = ?').bind(key, voter).first();
  return json({ count: await countFor(db, key), reviewed: !!mine });
}

export async function onRequestPost({ request, env }) {
  // Only accept confirmations sent from this website.
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'Forbidden.' }, 403);

  let body;
  try {
    const text = await request.text();
    if (text.length > 2000) return json({ error: 'Request too large.' }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  if (!validKey(body.key)) return json({ error: 'Invalid page key.' }, 400);

  const db = await database(env);
  if (!db) return json({ error: 'Peer review storage is not configured.' }, 503);

  const voter = await voterId(request, env);
  const title = typeof body.title === 'string' ? body.title.slice(0, 200) : null;
  await db
    .prepare('INSERT OR IGNORE INTO reviews (page_key, voter, title, created_at) VALUES (?, ?, ?, ?)')
    .bind(body.key, voter, title, Date.now())
    .run();

  return json({ count: await countFor(db, body.key), reviewed: true });
}
