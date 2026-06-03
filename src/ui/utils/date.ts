import type { ISODate } from '../../domain/types';

const KOREAN_DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * Parses an ISO `YYYY-MM-DD` string into the user's *local* calendar — never UTC.
 * The grid is anchored to wall-clock day-of-week (e.g., Wed schedules on Wed),
 * so timezone drift would silently mis-bucket schedules.
 */
export function formatKoreanDateLabel(iso: ISODate): string {
  const s = iso as unknown as string;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  // Local-time Date constructor — getDay() returns the device-local weekday.
  const date = new Date(y, m - 1, d);
  const dayLabel = KOREAN_DAY_LABELS[date.getDay()] ?? '';
  return `${m}월 ${d}일 (${dayLabel})`;
}

/**
 * Shifts an ISO date by `deltaDays` (positive or negative). Result is also
 * computed via local Date so DST/timezone boundaries are honored.
 */
export function shiftIsoDate(iso: ISODate, deltaDays: number): ISODate {
  const s = iso as unknown as string;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const date = new Date(y, m - 1, d + deltaDays);
  const yy = String(date.getFullYear()).padStart(4, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}` as unknown as ISODate;
}

export function todayIso(): ISODate {
  const now = new Date();
  const yy = String(now.getFullYear()).padStart(4, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}` as unknown as ISODate;
}

/**
 * Returns the Sunday-anchored start-of-week for the given ISO date — the
 * convention used by `docs/design/amatta-v1/app-weekly.jsx`'s week strip
 * (`DAYS_KR = ['일','월','화','수','목','금','토']`). Computed in local
 * time so DST boundaries don't silently shift the week.
 *
 * Note: the `daysOfWeek` bit-mask in `domain/days-of-week.ts` is still
 * Mon-bit-0..Sun-bit-6 — that mask is a storage concern, independent
 * of the display week's anchor day.
 */
export function weekStartIso(iso: ISODate): ISODate {
  const s = iso as unknown as string;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const date = new Date(y, m - 1, d);
  // getDay() returns Sun=0..Sat=6 — subtract that many days to reach Sun.
  date.setDate(date.getDate() - date.getDay());
  const yy = String(date.getFullYear()).padStart(4, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}` as unknown as ISODate;
}

/**
 * Returns the 7 ISO dates Sun..Sat for the week containing `iso`.
 */
export function weekDatesIso(iso: ISODate): ISODate[] {
  const start = weekStartIso(iso);
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => shiftIsoDate(start, offset));
}

/**
 * Formats a Korean week-range label like "5월 25일 — 5월 31일".
 */
export function formatKoreanWeekRange(weekStart: ISODate): string {
  const end = shiftIsoDate(weekStart, 6);
  const s = weekStart as unknown as string;
  const e = end as unknown as string;
  const sm = Number(s.slice(5, 7));
  const sd = Number(s.slice(8, 10));
  const em = Number(e.slice(5, 7));
  const ed = Number(e.slice(8, 10));
  return `${sm}월 ${sd}일 — ${em}월 ${ed}일`;
}

/**
 * Formats minutes-from-midnight as a compact 12-hour amatta-v1 block string:
 *   `9 * 60 + 0` → "9:00AM"
 *   `15 * 60 + 30` → "3:30PM"
 *   `0` → "12:00AM"
 *
 * Mirrors `fmt12hrShort(hhmm)` from docs/design/amatta-v1/app-tokens.jsx but
 * takes the domain's minute-of-day representation so we don't shuttle strings.
 */
export function fmt12hrShort(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ap = h < 12 ? 'AM' : 'PM';
  return `${h12}:${String(m).padStart(2, '0')}${ap}`;
}

/**
 * Formats minutes-from-midnight as a Korean hero-card string:
 *   `9 * 60` → "오전 9:00"
 *   `15 * 60 + 30` → "오후 3:30"
 *   `0` → "오전 12:00"
 *
 * Mirrors `fmtKo(hhmm)` from amatta-v1.
 */
export function fmtKoTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ap = h < 12 ? '오전' : '오후';
  return `${ap} ${h12}:${String(m).padStart(2, '0')}`;
}

/**
 * Korean weekday label for an ISO date (in local time). Mirrors the prototype's
 * `5월 5일 · 화` short-form — caller composes the month/day side.
 */
export function weekdayKo(iso: ISODate): string {
  const s = iso as unknown as string;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const date = new Date(y, m - 1, d);
  return KOREAN_DAY_LABELS[date.getDay()] ?? '';
}

/**
 * "5월 5일 · 화" short form for the top-bar caption next to the big "오늘".
 */
export function formatKoreanShortDate(iso: ISODate): string {
  const s = iso as unknown as string;
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  return `${m}월 ${d}일 · ${weekdayKo(iso)}`;
}

/**
 * `true` iff `iso` represents today's local-time date. Used to swap the
 * "오늘로" pill into a faint state when there's no jump to make.
 */
export function isToday(iso: ISODate): boolean {
  return (iso as unknown as string) === (todayIso() as unknown as string);
}

/**
 * Formats a Todo's `dueAt` epoch-ms relative to `currentDate` (the
 * day the daily-view is anchored to). Returns "오늘"/"내일"/"M/D".
 * Matches amatta-v1 TodoB caption convention.
 */
export function formatTodoDue(dueAt: number, currentDate: ISODate): string {
  const d = new Date(dueAt);
  const dueY = d.getFullYear();
  const dueM = d.getMonth() + 1;
  const dueD = d.getDate();
  const curS = currentDate as unknown as string;
  const curY = Number(curS.slice(0, 4));
  const curM = Number(curS.slice(5, 7));
  const curD = Number(curS.slice(8, 10));
  // Build local-time anchors for an exact day-diff in calendar days.
  const dueAnchor = new Date(dueY, dueM - 1, dueD).getTime();
  const curAnchor = new Date(curY, curM - 1, curD).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = Math.round((dueAnchor - curAnchor) / dayMs);
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  return `${dueM}/${dueD}`;
}
