// Short share link (ADR-016 amendment): encrypt on the phone, upload ciphertext only.

import { randomBytes } from 'node:crypto';

import { decryptShare, encryptShare, fromB64url, toB64url, uploadShare } from '../../src/share/share-crypto';

const random = (n: number): Uint8Array => new Uint8Array(randomBytes(n));
const json = JSON.stringify({ v: 2, title: '민준 수학학원 🙂', many: 'x'.repeat(3000) });

describe('encryptShare', () => {
  test('round trip; the ciphertext does not contain the text; fresh key each time', () => {
    const a = encryptShare(json, random);
    expect(decryptShare(a.blob, a.key)).toBe(json);
    expect(a.blob).not.toContain('민준');
    expect(Buffer.from(fromB64url(a.blob)).toString('utf8')).not.toContain('수학학원');
    const b = encryptShare(json, random);
    expect(b.key).not.toBe(a.key);
    expect(a.key).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  test('wrong key fails', () => {
    const a = encryptShare(json, random);
    const other = encryptShare(json, random);
    expect(() => decryptShare(a.blob, other.key)).toThrow();
  });
  test('base64url helpers', () => {
    const bytes = random(100);
    expect(Array.from(fromB64url(toB64url(bytes)))).toEqual(Array.from(bytes));
  });
});

describe('uploadShare', () => {
  test('sends only ciphertext; returns a short /s/<id>#<key> link', async () => {
    let sent = '';
    const fetchMock = jest.fn(async (_url: string, init?: { body?: string }) => {
      sent = init?.body ?? '';
      return { ok: true, json: async () => ({ id: 'AbCdEf1234' }) } as Response;
    });
    const r = await uploadShare(json, { random, fetch: fetchMock as unknown as typeof fetch, origin: 'https://x.test' });
    expect(fetchMock).toHaveBeenCalledWith('https://x.test/api/share', expect.objectContaining({ method: 'POST' }));
    expect(sent).not.toContain('민준');
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.url).toMatch(/^https:\/\/x\.test\/s\/AbCdEf1234#[A-Za-z0-9_-]{43}$/);
    expect(r.url.length).toBeLessThan(100);
    // The key in the link decrypts what was sent.
    const key = r.url.split('#')[1] as string;
    expect(decryptShare((JSON.parse(sent) as { c: string }).c, key)).toBe(json);
  });
  test('offline / server error / bad id', async () => {
    const throwing = jest.fn(async () => {
      throw new Error('net');
    });
    expect((await uploadShare(json, { random, fetch: throwing as unknown as typeof fetch })).kind).toBe('offline');
    const failing = jest.fn(async () => ({ ok: false }) as Response);
    expect((await uploadShare(json, { random, fetch: failing as unknown as typeof fetch })).kind).toBe('failed');
    const badId = jest.fn(async () => ({ ok: true, json: async () => ({ id: '../x' }) }) as unknown as Response);
    expect((await uploadShare(json, { random, fetch: badId as unknown as typeof fetch })).kind).toBe('failed');
  });
});
