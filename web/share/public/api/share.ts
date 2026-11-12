// POST /api/share  { c: "<base64url ciphertext>" } → { id, expiresInDays }
// Stores ciphertext only, for 14 days. Small rate limit per client IP.
import { db, json, MAX_BLOB, newId, TTL_SECONDS } from './_lib.js';

const PER_MINUTE = 20;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BLOB + 64) return json({ error: 'too_large' }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const c = (body as { c?: unknown } | null)?.c;
  if (typeof c !== 'string' || c.length < 40 || c.length > MAX_BLOB || !/^[A-Za-z0-9_-]+$/.test(c)) {
    return json({ error: 'bad_request' }, 400);
  }
  try {
    const redis = db();
    const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0]?.trim() ?? 'unknown';
    const bucket = `rl:${ip}:${Math.floor(Date.now() / 60000)}`;
    const n = await redis.incr(bucket);
    if (n === 1) await redis.expire(bucket, 70);
    if (n > PER_MINUTE) return json({ error: 'rate_limited' }, 429);
    for (let i = 0; i < 3; i++) {
      const id = newId();
      const ok = await redis.set(`s:${id}`, c, { ex: TTL_SECONDS, nx: true });
      if (ok === 'OK') return json({ id, expiresInDays: TTL_SECONDS / 86400 }, 201);
    }
    return json({ error: 'busy' }, 503);
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
}
