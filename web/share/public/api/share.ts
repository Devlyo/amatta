// POST /api/share  { c: "<base64url ciphertext>" } → { id, expiresInDays }
// Stores ciphertext only, private, deleted after 14 days.
import { put } from '@vercel/blob';

import { json, limited, MAX_BLOB, newId, pathOf, TTL_DAYS } from './_lib.js';

export async function POST(request: Request): Promise<Response> {
  const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0]?.trim() ?? 'unknown';
  if (limited(ip, 20)) return json({ error: 'rate_limited' }, 429);
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
  for (let i = 0; i < 3; i++) {
    const id = newId();
    try {
      await put(pathOf(id), c, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: 'text/plain',
        ttlDays: TTL_DAYS,
      });
      return json({ id, expiresInDays: TTL_DAYS }, 201);
    } catch (e) {
      // An id collision throws (allowOverwrite: false) — try another id.
      if (i === 2) {
        console.error('[share] put failed', e instanceof Error ? e.message : e);
        return json({ error: 'unavailable' }, 503);
      }
    }
  }
  return json({ error: 'unavailable' }, 503);
}
