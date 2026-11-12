// GET /api/share/<id> → { c } (ciphertext), or 404 once it expired.
import { get } from '@vercel/blob';

import { ID_RE, json, pathOf, TTL_DAYS } from '../_lib.js';

export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).pathname.split('/').pop() ?? '';
  if (!ID_RE.test(id)) return json({ error: 'not_found' }, 404);
  try {
    const r = await get(pathOf(id), { access: 'private' });
    if (r === null || r.statusCode !== 200) return json({ error: 'not_found' }, 404);
    // ttlDays deletes on a daily sweep — never serve anything past 14 days.
    if (Date.now() - new Date(r.blob.uploadedAt).getTime() > TTL_DAYS * 86_400_000) {
      return json({ error: 'not_found' }, 404);
    }
    const c = await new Response(r.stream).text();
    return json({ c });
  } catch {
    return json({ error: 'not_found' }, 404);
  }
}
