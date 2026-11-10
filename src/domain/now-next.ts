// "지금 · 다음" summary for the home screen — ADR-007 §6-1.
//
// For each kid, from that day's occurrences and the current minute:
//   current = an occurrence running now (start <= now < end; latest start wins
//             when several overlap — the one the kid most recently moved to)
//   next    = the earliest occurrence starting after now (excluding `current`)
// Pure: the caller passes today's occurrences (already expanded) and `now`.

import type { Occurrence } from './types';

export type NowNextStatus = 'inProgress' | 'upcoming' | 'doneForToday' | 'none';

export interface KidNowNext {
  childId: number;
  current: Occurrence | null;
  next: Occurrence | null;
  /** Minutes until `next` starts (null when there is no next). */
  minutesUntilNext: number | null;
  status: NowNextStatus;
}

export function nowAndNextByKid(
  occurrences: readonly Occurrence[],
  childIds: readonly number[],
  nowMinutes: number,
): KidNowNext[] {
  return childIds.map((childId) => {
    const mine = occurrences.filter((o) => o.childId === childId);

    let current: Occurrence | null = null;
    for (const o of mine) {
      if (o.startMinutes <= nowMinutes && nowMinutes < o.endMinutes) {
        if (current === null || o.startMinutes > current.startMinutes) current = o;
      }
    }

    let next: Occurrence | null = null;
    for (const o of mine) {
      if (o === current || o.startMinutes <= nowMinutes) continue;
      if (next === null || o.startMinutes < next.startMinutes) next = o;
    }

    const minutesUntilNext = next === null ? null : next.startMinutes - nowMinutes;
    let status: NowNextStatus;
    if (current !== null) status = 'inProgress';
    else if (next !== null) status = 'upcoming';
    else if (mine.length > 0) status = 'doneForToday';
    else status = 'none';

    return { childId, current, next, minutesUntilNext, status };
  });
}

/** "40분 후", "1시간 후", "1시간 40분 후". */
export function formatUntil(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}분 후`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}시간 후` : `${h}시간 ${r}분 후`;
}
