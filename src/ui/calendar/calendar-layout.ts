// Pure layout rules for the week and month views — ADR-007 §4.

import type { ISODate, Occurrence } from '../../domain/types';
import { shiftIsoDate, weekDatesIso, weekStartIso } from '../utils/date';

/**
 * Week view zoom: days on screen, continuous between these bounds (pinch
 * changes the column width live, no levels). 7 = the whole week.
 */
export const WEEK_SPAN_MAX = 7;
export const WEEK_SPAN_MIN = 2;
export type WeekSpan = number;
/** At or under this many days the blocks have room for their time range. */
export const WEEK_SPAN_SHOW_TIME = 4.5;

export function clampWeekSpan(span: number): number {
  'worklet';
  return Math.min(WEEK_SPAN_MAX, Math.max(WEEK_SPAN_MIN, span));
}

/** Week view: Sun..Sat of the anchor's week, or `span` days from the anchor. */
export function visibleWeekDays(anchor: ISODate, span: number): ISODate[] {
  if (span === 7) return weekDatesIso(anchor);
  return Array.from({ length: Math.ceil(span) }, (_, i) => shiftIsoDate(anchor, i));
}

/**
 * Month view grid: whole weeks (Sun..Sat) covering the anchor's month —
 * 4 to 6 rows, leading/trailing days from the neighbouring months included.
 */
export function monthGridDates(anchor: ISODate): ISODate[] {
  const s = anchor as unknown as string;
  const first = `${s.slice(0, 7)}-01` as unknown as ISODate;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${s.slice(0, 7)}-${String(lastDay).padStart(2, '0')}` as unknown as ISODate;
  const start = weekStartIso(first);
  const end = shiftIsoDate(weekStartIso(last), 6);
  const out: ISODate[] = [];
  for (let d = start; (d as unknown as string) <= (end as unknown as string); d = shiftIsoDate(d, 1)) {
    out.push(d);
  }
  return out;
}

/** Fixed schedules (학교 · 어린이집 = type 'school') are hidden in the month view. */
export function showsInMonth(occ: Occurrence): boolean {
  return occ.type !== 'school';
}

export interface MonthCellChips<T> {
  shown: T[];
  /** Count for the trailing "+N" chip, 0 when everything fits. */
  more: number;
}

/**
 * Chips that fit in one month cell. When `items` exceeds `limit`, the last
 * slot becomes "+N" (so `limit - 1` items are shown).
 */
export function monthCellChips<T>(items: readonly T[], limit: number): MonthCellChips<T> {
  if (items.length <= limit) return { shown: [...items], more: 0 };
  const shown = items.slice(0, Math.max(0, limit - 1));
  return { shown, more: items.length - shown.length };
}
