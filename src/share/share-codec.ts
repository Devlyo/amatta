// Share link codec (ADR-016) — shared by the app (encode) and the web viewer
// (decode; bundled into web/share by esbuild, so the two never drift).
// Only depends on lz-string.
//
// Fragment = "#<version>.<lz-string URI-safe payload>". The version sits
// outside the compressed part so an older viewer can say "update" without
// decompressing. Fragments over MAX_FRAGMENT are refused (a crafted link must
// not decompress into something huge).

import LZString from 'lz-string';

export const SHARE_VERSION = 1;

export type ShareType = 'school' | 'academy' | 'activity' | 'other';

export type ShareKid = [name: string, colorIndex: number, avatar: string];
export type ShareSchedule = [
  title: string,
  type: ShareType,
  kids: number[],
  withGuardian: 0 | 1,
  repeat: string,
  pickup: 0 | 1,
  place: string | null,
  notes: string | null,
];
export type ShareOccurrence = [
  dayOffset: number,
  start: number,
  end: number,
  schedule: number,
  allDay: 0 | 1,
  title: string | null,
  labels: number[],
];

export interface SharePayload {
  v: number;
  /** Local date the link was made (YYYY-MM-DD). */
  c: string;
  /** First day shown (YYYY-MM-DD) and how many days are included. */
  f: string;
  d: number;
  k: ShareKid[];
  s: ShareSchedule[];
  o: ShareOccurrence[];
  l: string[];
}


export const MAX_FRAGMENT = 16000;

export function encodeShare(p: SharePayload): string {
  return `${p.v}.${LZString.compressToEncodedURIComponent(JSON.stringify(p))}`;
}

export type DecodeResult = { kind: 'ok'; payload: SharePayload } | { kind: 'newer' } | { kind: 'invalid' };

const isStr = (x: unknown): x is string => typeof x === 'string';
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);

/** Shape check — every field the viewer reads, with index bounds. */
function valid(p: SharePayload): boolean {
  if (!isStr(p.c) || !isStr(p.f) || !/^\d{4}-\d{2}-\d{2}$/.test(p.f) || !isInt(p.d) || p.d < 1 || p.d > 62) return false;
  if (!Array.isArray(p.k) || !Array.isArray(p.s) || !Array.isArray(p.o) || !Array.isArray(p.l)) return false;
  if (p.k.length > 6 || p.s.length > 500 || p.o.length > 3000 || p.l.length > 2000) return false;
  if (!p.k.every((k) => Array.isArray(k) && isStr(k[0]) && isInt(k[1]) && k[1] >= 0 && k[1] <= 5 && isStr(k[2]))) return false;
  if (!p.l.every(isStr)) return false;
  const types = ['school', 'academy', 'activity', 'other'];
  const okSched = p.s.every(
    (s) =>
      Array.isArray(s) && isStr(s[0]) && types.includes(s[1]) && Array.isArray(s[2]) &&
      s[2].every((i) => isInt(i) && i >= 0 && i < p.k.length) && (s[3] === 0 || s[3] === 1) && isStr(s[4]) &&
      (s[5] === 0 || s[5] === 1) && (s[6] === null || isStr(s[6])) && (s[7] === null || isStr(s[7])),
  );
  if (!okSched) return false;
  return p.o.every(
    (o) =>
      Array.isArray(o) && isInt(o[0]) && o[0] >= 0 && o[0] < p.d && isInt(o[1]) && isInt(o[2]) &&
      o[1] >= 0 && o[2] <= 1440 && o[1] <= o[2] && isInt(o[3]) && o[3] >= 0 && o[3] < p.s.length &&
      (o[4] === 0 || o[4] === 1) && (o[5] === null || isStr(o[5])) && Array.isArray(o[6]) &&
      o[6].every((i) => isInt(i) && i >= 0 && i < p.l.length),
  );
}

export function decodeShare(fragment: string): DecodeResult {
  try {
    const raw = fragment.replace(/^#/, '');
    if (raw.length === 0 || raw.length > MAX_FRAGMENT) return { kind: 'invalid' };
    const dot = raw.indexOf('.');
    if (dot <= 0) return { kind: 'invalid' };
    const v = Number(raw.slice(0, dot));
    if (!Number.isInteger(v)) return { kind: 'invalid' };
    if (v > SHARE_VERSION) return { kind: 'newer' };
    const json = LZString.decompressFromEncodedURIComponent(raw.slice(dot + 1));
    if (json === null || json === '' || json.length > MAX_FRAGMENT * 20) return { kind: 'invalid' };
    const p = JSON.parse(json) as SharePayload;
    if (typeof p !== 'object' || p === null || p.v !== v || !valid(p)) return { kind: 'invalid' };
    return { kind: 'ok', payload: p };
  } catch {
    return { kind: 'invalid' };
  }
}

export const SHARE_BASE_URL = 'https://wemoa-share.vercel.app/s';

export function shareUrl(p: SharePayload, base = SHARE_BASE_URL): string {
  return `${base}#${encodeShare(p)}`;
}
