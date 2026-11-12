// Short share link (ADR-016 amendment, 2026-11-12): the week is encrypted on
// the phone (AES-256-GCM, fresh random key per link) and only the ciphertext
// is uploaded. The key travels in the link's # part, which browsers never send
// to the server — the server can't read what it stores, and deletes it after
// SHARE_TTL_DAYS.
//
//   link = https://<host>/s/<id>#<key, base64url>
//   blob = base64url( nonce(12) || ciphertext+tag )

import { gcm } from '@noble/ciphers/aes';

export const SHARE_TTL_DAYS = 14;
export const SHARE_ORIGIN = 'https://wemoa-share.vercel.app';
const NONCE = 12;
const KEY = 32;

export function toB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa exists in Hermes (RN 0.74+), browsers and Node 16+.
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

export function encryptShare(json: string, random: (n: number) => Uint8Array): { blob: string; key: string } {
  const key = random(KEY);
  const nonce = random(NONCE);
  const ct = gcm(key, nonce).encrypt(utf8(json));
  const out = new Uint8Array(NONCE + ct.length);
  out.set(nonce, 0);
  out.set(ct, NONCE);
  return { blob: toB64url(out), key: toB64url(key) };
}

/** Same as the web viewer's WebCrypto path — used by tests. */
export function decryptShare(blob: string, key: string): string {
  const all = fromB64url(blob);
  const pt = gcm(fromB64url(key), all.slice(0, NONCE)).decrypt(all.slice(NONCE));
  return new TextDecoder().decode(pt);
}

export type UploadResult = { kind: 'ok'; url: string } | { kind: 'offline' } | { kind: 'failed' };

/** Encrypt, upload the ciphertext, return the short link. */
export async function uploadShare(
  json: string,
  deps: { random: (n: number) => Uint8Array; fetch: typeof fetch; origin?: string },
): Promise<UploadResult> {
  const origin = deps.origin ?? SHARE_ORIGIN;
  const { blob, key } = encryptShare(json, deps.random);
  let res: Response;
  try {
    res = await deps.fetch(`${origin}/api/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ c: blob }),
    });
  } catch {
    return { kind: 'offline' };
  }
  if (!res.ok) return { kind: 'failed' };
  const body = (await res.json().catch(() => null)) as { id?: unknown } | null;
  if (body === null || typeof body.id !== 'string' || !/^[A-Za-z0-9]{10}$/.test(body.id)) return { kind: 'failed' };
  return { kind: 'ok', url: `${origin}/s/${body.id}#${key}` };
}
