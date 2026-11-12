import { dayOfWeekIndex, maskHasDay, type DayIndex } from './days-of-week';
import type {
  Child,
  ISODate,
  Occurrence,
  Schedule,
  ScheduleException,
} from './types';

export interface DateRange {
  from: ISODate;
  to: ISODate;
}

export interface Ymd {
  y: number;
  m: number;
  d: number;
}

export function isoDateToYmd(iso: ISODate): Ymd {
  const s = iso as unknown as string;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  return { y, m, d };
}

export function ymdToIsoDate(ymd: Ymd): ISODate {
  const y = String(ymd.y).padStart(4, '0');
  const m = String(ymd.m).padStart(2, '0');
  const d = String(ymd.d).padStart(2, '0');
  return `${y}-${m}-${d}` as unknown as ISODate;
}

export function* dateRangeIter(range: DateRange): IterableIterator<ISODate> {
  const start = isoDateToYmd(range.from);
  const end = isoDateToYmd(range.to);
  const cur = new Date(start.y, start.m - 1, start.d);
  const stop = new Date(end.y, end.m - 1, end.d);
  while (cur.getTime() <= stop.getTime()) {
    yield ymdToIsoDate({
      y: cur.getFullYear(),
      m: cur.getMonth() + 1,
      d: cur.getDate(),
    });
    cur.setDate(cur.getDate() + 1);
  }
}

function compareIsoDate(a: ISODate, b: ISODate): number {
  const as = a as unknown as string;
  const bs = b as unknown as string;
  if (as < bs) return -1;
  if (as > bs) return 1;
  return 0;
}

// Skip occurrences whose childId is not in childrenById map. Decision:
// occurrences whose owning child has been deleted or is unavailable are
// silently dropped rather than emitted with placeholder data, so callers
// can rely on `colorIndex` and child references always being valid.
export function expandOccurrences(
  schedules: Schedule[],
  exceptions: ScheduleException[],
  range: DateRange,
  childrenById: Map<number, Child>,
): Occurrence[] {
  const exceptionIndex = new Map<string, ScheduleException>();
  for (let i = 0; i < exceptions.length; i++) {
    const ex = exceptions[i];
    if (ex === undefined) continue;
    const key = `${ex.scheduleId}|${ex.date as unknown as string}`;
    exceptionIndex.set(key, ex);
  }

  const out: Occurrence[] = [];

  for (const date of dateRangeIter(range)) {
    const ymd = isoDateToYmd(date);
    const dow = dayOfWeekIndex(new Date(ymd.y, ymd.m - 1, ymd.d)) as DayIndex;

    for (let i = 0; i < schedules.length; i++) {
      const sch = schedules[i];
      if (sch === undefined) continue;

      if (!maskHasDay(sch.daysOfWeek, dow)) continue;

      if (compareIsoDate(date, sch.validFrom) < 0) continue;
      if (sch.validUntil !== null && compareIsoDate(date, sch.validUntil) > 0) {
        continue;
      }

      // ADR-013: one occurrence per schedule+date; members that no longer
      // exist are dropped (main kid first, so `child` is the first survivor).
      const memberIds = (sch.memberIds ?? [sch.childId]).filter((id) => childrenById.has(id));
      const mainId = memberIds[0];
      const child = mainId === undefined ? undefined : childrenById.get(mainId);
      if (mainId === undefined || child === undefined) continue;

      const exKey = `${sch.id}|${date as unknown as string}`;
      const ex = exceptionIndex.get(exKey);

      let startMinutes = sch.startMinutes;
      let endMinutes = sch.endMinutes;
      let title = sch.title;

      if (ex !== undefined) {
        if (ex.kind === 'cancel') continue;
        // All-day events have no times to override (ADR-007 §8) — only the title.
        const allDay = sch.allDay === true;
        if (!allDay && ex.overrideStartMinutes !== null) startMinutes = ex.overrideStartMinutes;
        if (!allDay && ex.overrideEndMinutes !== null) endMinutes = ex.overrideEndMinutes;
        if (ex.overrideTitle !== null) title = ex.overrideTitle;
      }

      out.push({
        scheduleId: sch.id,
        childId: mainId,
        memberIds,
        withGuardian: sch.withGuardian === true,
        date,
        startMinutes,
        endMinutes,
        title,
        type: sch.type,
        colorIndex: child.colorIndex,
        needsPickup: sch.needsPickup,
        allDay: sch.allDay === true,
      });
    }
  }

  out.sort((a, b) => {
    const dc = compareIsoDate(a.date, b.date);
    if (dc !== 0) return dc;
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
    if (a.scheduleId !== b.scheduleId) return a.scheduleId - b.scheduleId;
    return a.childId - b.childId;
  });

  return out;
}

/**
 * ADR-013 view A: one copy per kid member, for the per-person grids (일·주·월)
 * and the home "지금/다음" rows. Everything else (pickup, checklist, search,
 * notifications) keeps one occurrence per schedule+date.
 */
export function fanOutByMember(occurrences: readonly Occurrence[], childrenById: Map<number, Child>): Occurrence[] {
  const out: Occurrence[] = [];
  for (const o of occurrences) {
    const ids = o.memberIds ?? [o.childId];
    if (ids.length <= 1) {
      out.push(o);
      continue;
    }
    for (const id of ids) {
      const kid = childrenById.get(id);
      if (kid === undefined) continue;
      out.push({ ...o, childId: id, colorIndex: kid.colorIndex });
    }
  }
  return out;
}

/** Stable key for one drawn copy (schedule · date · person). */
export function occurrenceKey(o: Pick<Occurrence, 'scheduleId' | 'date' | 'childId'>): string {
  return `${o.scheduleId}|${o.date as unknown as string}|${o.childId}`;
}

/** "민준·서연" for 2, "민준 외 2명" for 3+ (ADR-013). */
export function memberNames(ids: readonly number[], childrenById: Map<number, Child>, withGuardian = false, sep = '·'): string {
  const names = ids.map((id) => childrenById.get(id)?.name).filter((n): n is string => n !== undefined);
  if (withGuardian) names.push('보호자');
  if (names.length <= 2) return names.join(sep);
  return `${names[0]} 외 ${names.length - 1}명`;
}
