// Cascade ("stacked") overlap layout for time grids — ADR-007 §3.
//
// Within one column (a day in the week view, a kid in the day view), items
// whose time ranges overlap are stacked Google-Calendar style: each item takes
// the left-most LEVEL not already used by an earlier, overlapping item in the
// same column. The renderer indents an item by `level × indent` and draws it
// on top of lower levels, so both items and the overlapping span stay visible.
//
// Pure + order-independent: items are sorted (start ASC, longer first, then id)
// before assignment, so the same set always yields the same levels.
//
// Callers clip ranges to the visible day first (`clipToDay`) and leave all-day
// items out — they live in a separate all-day row, not on the time axis.

import type { Minutes } from './types';

export const DAY_START_MIN = 0;
export const DAY_END_MIN = 24 * 60;

export interface CascadeInput<K extends string | number> {
  /** Stable identity, unique within the input. */
  id: string;
  /** Column key — overlap is only checked within the same column. */
  column: K;
  start: Minutes;
  end: Minutes;
}

export interface CascadePlacement<K extends string | number> {
  id: string;
  column: K;
  start: Minutes;
  end: Minutes;
  /** 0 = flush left; n = indented n steps and drawn above levels < n. */
  level: number;
  /**
   * Number of levels used by this item's overlap group (items linked by
   * overlaps, transitively). Renderers size the indent step from it so a deep
   * stack in a narrow column still fans out instead of piling up.
   */
  depth: number;
}

/**
 * Indent step for a cascade: `base` px per level, shrunk so the deepest level
 * still leaves `minWidthRatio` of the column for its block.
 */
export function cascadeStep(
  columnWidth: number,
  depth: number,
  base: number,
  minWidthRatio = 0.45,
): number {
  if (depth <= 1) return 0;
  const room = columnWidth * (1 - minWidthRatio);
  return Math.min(base, room / (depth - 1));
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  // Half-open ranges: an item ending at 15:00 does not overlap one starting at 15:00.
  return aStart < bEnd && bStart < aEnd;
}

export function layoutCascade<K extends string | number>(
  items: readonly CascadeInput<K>[],
): CascadePlacement<K>[] {
  const sorted = [...items].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.end !== b.end) return b.end - a.end; // longer first → sits underneath
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const placedByColumn = new Map<K, CascadePlacement<K>[]>();
  const out: CascadePlacement<K>[] = [];

  for (const item of sorted) {
    const placed = placedByColumn.get(item.column) ?? [];
    const used = new Set<number>();
    for (const p of placed) {
      if (overlaps(p.start, p.end, item.start, item.end)) used.add(p.level);
    }
    let level = 0;
    while (used.has(level)) level += 1;

    const placement: CascadePlacement<K> = { ...item, level, depth: 1 };
    placed.push(placement);
    placedByColumn.set(item.column, placed);
    out.push(placement);
  }

  // Overlap groups per column: in start order, a new group begins when an item
  // starts at/after the latest end seen so far in the current group.
  for (const placed of placedByColumn.values()) {
    let group: CascadePlacement<K>[] = [];
    let groupEnd = -Infinity;
    const close = (): void => {
      const depth = group.reduce((m, p) => Math.max(m, p.level + 1), 1);
      for (const p of group) p.depth = depth;
    };
    for (const p of placed) {
      if (group.length > 0 && p.start >= groupEnd) {
        close();
        group = [];
        groupEnd = -Infinity;
      }
      group.push(p);
      groupEnd = Math.max(groupEnd, p.end);
    }
    if (group.length > 0) close();
  }
  return out;
}

/**
 * Clamp a range to one day's time axis. Returns null when nothing of the range
 * is visible that day (or the clamped range is empty), so the caller can skip
 * it. Use for multi-day guardian events and ranges past midnight.
 */
export function clipToDay(
  start: number,
  end: number,
  dayStart: number = DAY_START_MIN,
  dayEnd: number = DAY_END_MIN,
): { start: Minutes; end: Minutes } | null {
  const s = Math.max(start, dayStart);
  const e = Math.min(end, dayEnd);
  if (e <= s) return null;
  return { start: s, end: e };
}
