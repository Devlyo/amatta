// GET /api/share/<id> → { c } (ciphertext) or 404 once it expired.
import { db, ID_RE, json } from '../_lib.js';

export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).pathname.split('/').pop() ?? '';
  if (!ID_RE.test(id)) return json({ error: 'not_found' }, 404);
  try {
    const c = await db().get<string>(`s:${id}`);
    if (typeof c !== 'string') return json({ error: 'not_found' }, 404);
    return json({ c });
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
}
