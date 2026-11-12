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
/** Opening zoom: the whole week (owner 2026-11-12 — the week opens on one
 *  kid, so 7 days still read as titled blocks; was 3.2). Pinches are
 *  remembered while the app runs. */
export const WEEK_SPAN_DEFAULT = 7;
/** More days than this → every event is a lane bar + type icon (no titles). */
export const WEEK_SPAN_BARS_FROM = 4;
/** Blocks (≤ 4 days) always have room for their time range. */
export const WEEK_SPAN_SHOW_TIME = WEEK_SPAN_BARS_FROM;

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
 * Month view zoom: week-row height (px), continuous between these bounds.
 * From MONTH_ROW_TWO_LINE up, chips get a second line with the start time.
 */
export const MONTH_ROW_MIN = 104;
export const MONTH_ROW_MAX = 150;
export const MONTH_ROW_TWO_LINE = 120;
export const MONTH_CHIP_H = 16;
export const MONTH_CHIP_H_TWO_LINE = 30;
/** Space above the chips (date circle + padding). */
const MONTH_CELL_HEAD = 32;

export function clampMonthRow(h: number): number {
  'worklet';
  return Math.min(MONTH_ROW_MAX, Math.max(MONTH_ROW_MIN, h));
}

/** Chip slots that fit a cell of this row height ("+N" takes the last one). */
export function monthChipLimit(rowHeight: number): number {
  const chip = rowHeight >= MONTH_ROW_TWO_LINE ? MONTH_CHIP_H_TWO_LINE : MONTH_CHIP_H;
  return Math.max(1, Math.floor((rowHeight - MONTH_CELL_HEAD) / (chip + 2)));
}

/** Whole months from `a`'s month to `b`'s month. */
export function monthsBetween(a: ISODate, b: ISODate): number {
  const s = a as unknown as string;
  const t = b as unknown as string;
  return (Number(t.slice(0, 4)) - Number(s.slice(0, 4))) * 12 + Number(t.slice(5, 7)) - Number(s.slice(5, 7));
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
