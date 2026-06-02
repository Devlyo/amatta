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

      const child = childrenById.get(sch.childId);
      if (child === undefined) continue;

      const exKey = `${sch.id}|${date as unknown as string}`;
      const ex = exceptionIndex.get(exKey);

      let startMinutes = sch.startMinutes;
      let endMinutes = sch.endMinutes;
      let title = sch.title;

      if (ex !== undefined) {
        if (ex.kind === 'cancel') continue;
        if (ex.overrideStartMinutes !== null) startMinutes = ex.overrideStartMinutes;
        if (ex.overrideEndMinutes !== null) endMinutes = ex.overrideEndMinutes;
        if (ex.overrideTitle !== null) title = ex.overrideTitle;
      }

      out.push({
        scheduleId: sch.id,
        childId: sch.childId,
        date,
        startMinutes,
        endMinutes,
        title,
        type: sch.type,
        colorIndex: child.colorIndex,
      });
    }
  }

  out.sort((a, b) => {
    const dc = compareIsoDate(a.date, b.date);
    if (dc !== 0) return dc;
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
    return a.scheduleId - b.scheduleId;
  });

  return out;
}
