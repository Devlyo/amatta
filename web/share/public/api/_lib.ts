// Shared bits for the share-link API (ADR-016). The server only ever sees
// ciphertext — the key stays in the link's # part on the clients.
// Storage: a PRIVATE Vercel Blob store; each link expires via ttlDays, and
// reads also refuse anything older than TTL_DAYS (deletion runs daily).

export const TTL_DAYS = 14;
/** base64url( nonce || ciphertext+tag ); a week of schedules is a few KB. */
export const MAX_BLOB = 32_000;
export const ID_RE = /^[A-Za-z0-9]{10}$/;
export const pathOf = (id: string): string => `s/${id}.txt`;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export function newId(): string {
  // 62 is not a power of two — draw from 0..247 and reject the rest (no bias).
  let id = '';
  while (id.length < 10) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < 248 && id.length < 10) id += ALPHABET[b % 62];
    }
  }
  return id;
}

// Best-effort per-instance rate limit (no shared store on the free plan).
const hits = new Map<string, { n: number; t: number }>();
export function limited(ip: string, perMinute: number): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (h === undefined || now - h.t > 60_000) {
    hits.set(ip, { n: 1, t: now });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  h.n += 1;
  return h.n > perMinute;
}
