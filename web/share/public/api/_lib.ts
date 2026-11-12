// Shared bits for the share-link API (ADR-016). The server only ever sees
// ciphertext — the key stays in the link's # part on the clients.
import { Redis } from '@upstash/redis';

export const TTL_SECONDS = 14 * 24 * 60 * 60;
/** base64url( nonce || ciphertext+tag ); a week of schedules is a few KB. */
export const MAX_BLOB = 32_000;
export const ID_RE = /^[A-Za-z0-9]{10}$/;

let redis: Redis | null = null;
export function db(): Redis {
  if (redis === null) {
    // Marketplace env names (KV_REST_API_*) or Upstash's own.
    const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error('storage not configured');
    redis = new Redis({ url, token, automaticDeserialization: false });
  }
  return redis;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let id = '';
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
  return id;
}
