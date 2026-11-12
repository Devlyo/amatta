// Share link codec (ADR-016) — shared by the app (encode) and the web viewer
// (decode; bundled into web/share by esbuild, so the two never drift).
// Only depends on lz-string.
//
// Fragment = "#<version>.<lz-string URI-safe JSON>". The version sits outside
// the compressed part so an older viewer can say "update" without
// decompressing. Fragments over MAX_FRAGMENT are refused.
//
// v2 wire format = repeat RULES, not expanded occurrences, and no derivable
// text (repeat summary, type names, avatar keys are rebuilt here) — Korean
// text dominates the size, so the link stays short enough for chat apps.
//   { v: 2, f: "YYYY-MM-DD" (first day), d: days, c: created (offset from f),
//     k: [[name, avatarIdx]],
//     s: [[title, typeIdx, kidIdx[], flags, mask, start, end, from|null, until|null,
//          supplies: [[labelIdx, anchor|null, recurring]] , place?, notes?]],
//          flags: 1 = with guardian, 2 = pickup, 4 = all day
//          mask: Mon = bit 0 … Sun = bit 6; from/until/anchor = day offsets from f
//     x: [[sIdx, dayOffset, kind (0 cancel, 1 modify), start|null, end|null, title|null]],
//     l: [label] }
// decodeShare() expands it into the view shape below, which the viewer draws.

import LZString from 'lz-string';

export const SHARE_VERSION = 2;
export const MAX_FRAGMENT = 16000;

export const SHARE_TYPES = ['school', 'academy', 'activity', 'other'] as const;
export type ShareType = (typeof SHARE_TYPES)[number];
/** Index-aligned with the app's AVATAR_KEYS / kid palette (colorIndex = avatar index). */
export const SHARE_AVATARS = ['face-wink', 'face-dizzy', 'face-cool', 'face-sleep', 'face-surprise', 'face-calm'] as const;

// ── wire (what travels in the link) ──
export type WireKid = [name: string, avatar: number];
export type WireSupply = [label: number, anchor: number | null, recurring: 0 | 1];
export type WireSchedule =
  | [title: string, type: number, kids: number[], flags: number, mask: number, start: number, end: number, from: number | null, until: number | null, supplies: WireSupply[]]
  | [title: string, type: number, kids: number[], flags: number, mask: number, start: number, end: number, from: number | null, until: number | null, supplies: WireSupply[], place: string | null, notes: string | null];
export type WireException = [schedule: number, day: number, kind: 0 | 1, start: number | null, end: number | null, title: string | null];
export interface ShareWire {
  v: number;
  f: string;
  d: number;
  c: number;
  k: WireKid[];
  s: WireSchedule[];
  x: WireException[];
  l: string[];
}

// ── view (what the viewer draws) ──
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

export function encodeShare(w: ShareWire): string {
  return `${w.v}.${LZString.compressToEncodedURIComponent(JSON.stringify(w))}`;
}

/** Day-of-week (Mon = 0) of f + offset, DST-safe. */
function weekdayMon(f: string, off: number): number {
  const t = Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)) + off);
  return (new Date(t).getUTCDay() + 6) % 7;
}
function addDaysIso(f: string, off: number): string {
  const t = new Date(Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)) + off));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

const SUN_FIRST = ['일', '월', '화', '수', '목', '금', '토'];
const SUN_FIRST_BIT = [6, 0, 1, 2, 3, 4, 5];
/** Same wording as the app's repeatSummary; '' for a one-off (from === until). */
export function repeatText(mask: number, oneOff: boolean): string {
  if (oneOff || mask === 0) return '';
  if (mask === 0b1111111) return '매일';
  if (mask === 0b0011111) return '평일';
  if (mask === 0b1100000) return '주말';
  return `매주 ${SUN_FIRST.filter((_, i) => (mask & (1 << (SUN_FIRST_BIT[i] ?? 0))) !== 0).join(', ')}`;
}

/** Expand the rules into the view (same rules as the app's expandOccurrences). */
export function expandWire(w: ShareWire): SharePayload {
  const ex = new Map(w.x.map((e) => [`${e[0]}|${e[1]}`, e]));
  const o: ShareOccurrence[] = [];
  for (let day = 0; day < w.d; day++) {
    const wd = weekdayMon(w.f, day);
    w.s.forEach((s, si) => {
      const [, , , flags, mask, start, end, from, until, supplies] = s;
      if ((mask & (1 << wd)) === 0) return;
      if (from !== null && day < from) return;
      if (until !== null && day > until) return;
      const e = ex.get(`${si}|${day}`);
      if (e !== undefined && e[2] === 0) return;
      const allDay = (flags & 4) !== 0;
      let st = start;
      let en = end;
      let title: string | null = null;
      if (e !== undefined) {
        if (!allDay && e[3] !== null) st = e[3];
        if (!allDay && e[4] !== null) en = e[4];
        if (e[5] !== null) title = e[5];
      }
      const labels = supplies
        .filter(([, anchor, rec]) => anchor === null || (rec === 1 ? day >= anchor : day === anchor))
        .map(([li]) => li);
      o.push([day, st, en, si, allDay ? 1 : 0, title, labels]);
    });
  }
  o.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[3] - b[3]);
  return {
    v: w.v,
    c: addDaysIso(w.f, w.c),
    f: w.f,
    d: w.d,
    k: w.k.map(([name, av]) => [name, av, SHARE_AVATARS[av] ?? 'face-wink']),
    s: w.s.map((s) => {
      const [title, type, kids, flags, mask, , , from, until] = s;
      const oneOff = from !== null && until !== null && from === until;
      return [
        title,
        SHARE_TYPES[type] ?? 'other',
        kids,
        (flags & 1) !== 0 ? 1 : 0,
        repeatText(mask, oneOff),
        (flags & 2) !== 0 ? 1 : 0,
        s.length > 10 ? (s[10] ?? null) : null,
        s.length > 11 ? (s[11] ?? null) : null,
      ];
    }),
    o,
    l: w.l,
  };
}

export type DecodeResult = { kind: 'ok'; payload: SharePayload } | { kind: 'newer' } | { kind: 'invalid' };

const isStr = (x: unknown): x is string => typeof x === 'string';
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);
const isOff = (x: unknown): x is number | null => x === null || (isInt(x) && x >= -400 && x <= 400);

/** Shape check — every field the expander / viewer reads, with index bounds. */
function validWire(w: ShareWire): boolean {
  if (!isStr(w.f) || !/^\d{4}-\d{2}-\d{2}$/.test(w.f) || !isInt(w.d) || w.d < 1 || w.d > 31 || !isInt(w.c)) return false;
  if (!Array.isArray(w.k) || !Array.isArray(w.s) || !Array.isArray(w.x) || !Array.isArray(w.l)) return false;
  if (w.k.length > 6 || w.s.length > 300 || w.x.length > 500 || w.l.length > 500) return false;
  if (!w.k.every((k) => Array.isArray(k) && isStr(k[0]) && isInt(k[1]) && k[1] >= 0 && k[1] < SHARE_AVATARS.length)) return false;
  if (!w.l.every(isStr)) return false;
  const okS = w.s.every(
    (s) =>
      Array.isArray(s) && (s.length === 10 || s.length === 12) && isStr(s[0]) && isInt(s[1]) && s[1] >= 0 && s[1] < SHARE_TYPES.length &&
      Array.isArray(s[2]) && s[2].every((i) => isInt(i) && i >= 0 && i < w.k.length) && isInt(s[3]) && s[3] >= 0 && s[3] < 8 &&
      isInt(s[4]) && s[4] >= 0 && s[4] < 128 && isInt(s[5]) && isInt(s[6]) && s[5] >= 0 && s[6] <= 1440 && s[5] <= s[6] &&
      isOff(s[7]) && isOff(s[8]) && Array.isArray(s[9]) &&
      s[9].every((x) => Array.isArray(x) && isInt(x[0]) && x[0] >= 0 && x[0] < w.l.length && isOff(x[1]) && (x[2] === 0 || x[2] === 1)) &&
      (s.length === 10 || ((s[10] === null || isStr(s[10])) && (s[11] === null || isStr(s[11])))),
  );
  if (!okS) return false;
  return w.x.every(
    (e) =>
      Array.isArray(e) && isInt(e[0]) && e[0] >= 0 && e[0] < w.s.length && isInt(e[1]) && e[1] >= 0 && e[1] < w.d &&
      (e[2] === 0 || e[2] === 1) && (e[3] === null || (isInt(e[3]) && e[3] >= 0 && e[3] <= 1440)) &&
      (e[4] === null || (isInt(e[4]) && e[4] >= 0 && e[4] <= 1440)) && (e[5] === null || isStr(e[5])),
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
    if (v !== SHARE_VERSION) return { kind: 'invalid' };
    const json = LZString.decompressFromEncodedURIComponent(raw.slice(dot + 1));
    if (json === null || json === '' || json.length > MAX_FRAGMENT * 20) return { kind: 'invalid' };
    const w = JSON.parse(json) as ShareWire;
    if (typeof w !== 'object' || w === null || w.v !== v || !validWire(w)) return { kind: 'invalid' };
    return { kind: 'ok', payload: expandWire(w) };
  } catch {
    return { kind: 'invalid' };
  }
}

export const SHARE_BASE_URL = 'https://wemoa-share.vercel.app/s';

export function shareUrl(w: ShareWire, base = SHARE_BASE_URL): string {
  return `${base}#${encodeShare(w)}`;
}
