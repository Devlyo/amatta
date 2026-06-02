import { DOW } from '../../src/domain/days-of-week';
import {
  expandOccurrences,
  ymdToIsoDate,
  type DateRange,
} from '../../src/domain/occurrences';
import type {
  Child,
  ColorIndex,
  ISODate,
  Schedule,
  ScheduleException,
} from '../../src/domain/types';

// June 2026 starts on Monday — keeps day-of-week math trivial to reason about:
//   Mon=Jun 1, Tue=Jun 2, Wed=Jun 3, Thu=Jun 4, Fri=Jun 5, Sat=Jun 6, Sun=Jun 7
const D = (y: number, m: number, d: number): ISODate => ymdToIsoDate({ y, m, d });

const child1: Child = {
  id: 1,
  name: 'A',
  colorIndex: 0 as ColorIndex,
  createdAt: D(2026, 1, 1),
};
const child2: Child = {
  id: 2,
  name: 'B',
  colorIndex: 3 as ColorIndex,
  createdAt: D(2026, 1, 1),
};
const childrenById = new Map<number, Child>([
  [1, child1],
  [2, child2],
]);

function schedule(partial: Partial<Schedule> & { id: number; childId: number; daysOfWeek: number }): Schedule {
  return {
    id: partial.id,
    childId: partial.childId,
    title: partial.title ?? 'Title',
    type: partial.type ?? 'academy',
    location: partial.location ?? null,
    notes: partial.notes ?? null,
    daysOfWeek: partial.daysOfWeek,
    startMinutes: partial.startMinutes ?? 540,
    endMinutes: partial.endMinutes ?? 600,
    validFrom: partial.validFrom ?? D(2020, 1, 1),
    validUntil: partial.validUntil ?? null,
    notifyMinutesBefore: partial.notifyMinutesBefore ?? null,
  };
}

const RANGE_TWO_WEEKS: DateRange = { from: D(2026, 6, 1), to: D(2026, 6, 14) };

describe('expandOccurrences', () => {
  test('single Mon-only schedule over 2 weeks → 2 occurrences (Jun 1, Jun 8)', () => {
    const sched = schedule({ id: 1, childId: 1, daysOfWeek: DOW.MON });
    const occs = expandOccurrences([sched], [], RANGE_TWO_WEEKS, childrenById);
    expect(occs).toHaveLength(2);
    expect(occs[0]?.date).toBe(D(2026, 6, 1));
    expect(occs[1]?.date).toBe(D(2026, 6, 8));
  });

  test('multi-day schedule (Mon+Wed+Fri) over 2 weeks → 6 occurrences', () => {
    const sched = schedule({ id: 1, childId: 1, daysOfWeek: DOW.MON | DOW.WED | DOW.FRI });
    const occs = expandOccurrences([sched], [], RANGE_TWO_WEEKS, childrenById);
    expect(occs.map((o) => o.date)).toEqual([
      D(2026, 6, 1),
      D(2026, 6, 3),
      D(2026, 6, 5),
      D(2026, 6, 8),
      D(2026, 6, 10),
      D(2026, 6, 12),
    ]);
  });

  test('validFrom truncates earlier dates', () => {
    const sched = schedule({
      id: 1,
      childId: 1,
      daysOfWeek: DOW.MON,
      validFrom: D(2026, 6, 5),
    });
    const occs = expandOccurrences([sched], [], RANGE_TWO_WEEKS, childrenById);
    expect(occs).toHaveLength(1);
    expect(occs[0]?.date).toBe(D(2026, 6, 8));
  });

  test('validUntil truncates later dates', () => {
    const sched = schedule({
      id: 1,
      childId: 1,
      daysOfWeek: DOW.MON,
      validUntil: D(2026, 6, 7),
    });
    const occs = expandOccurrences([sched], [], RANGE_TWO_WEEKS, childrenById);
    expect(occs).toHaveLength(1);
    expect(occs[0]?.date).toBe(D(2026, 6, 1));
  });

  test("exception kind='cancel' removes that date only", () => {
    const sched = schedule({ id: 1, childId: 1, daysOfWeek: DOW.MON });
    const ex: ScheduleException = {
      id: 100,
      scheduleId: 1,
      date: D(2026, 6, 1),
      kind: 'cancel',
      overrideStartMinutes: null,
      overrideEndMinutes: null,
      overrideTitle: null,
    };
    const occs = expandOccurrences([sched], [ex], RANGE_TWO_WEEKS, childrenById);
    expect(occs).toHaveLength(1);
    expect(occs[0]?.date).toBe(D(2026, 6, 8));
  });

  test("exception kind='modify' shifts startMinutes", () => {
    const sched = schedule({
      id: 1,
      childId: 1,
      daysOfWeek: DOW.MON,
      startMinutes: 540,
      endMinutes: 600,
    });
    const ex: ScheduleException = {
      id: 1,
      scheduleId: 1,
      date: D(2026, 6, 1),
      kind: 'modify',
      overrideStartMinutes: 600,
      overrideEndMinutes: null,
      overrideTitle: null,
    };
    const occs = expandOccurrences([sched], [ex], { from: D(2026, 6, 1), to: D(2026, 6, 1) }, childrenById);
    expect(occs).toHaveLength(1);
    expect(occs[0]?.startMinutes).toBe(600);
    expect(occs[0]?.endMinutes).toBe(600);
  });

  test("exception kind='modify' shifts title", () => {
    const sched = schedule({ id: 1, childId: 1, daysOfWeek: DOW.MON, title: 'Original' });
    const ex: ScheduleException = {
      id: 1,
      scheduleId: 1,
      date: D(2026, 6, 1),
      kind: 'modify',
      overrideStartMinutes: null,
      overrideEndMinutes: null,
      overrideTitle: 'Holiday Make-up',
    };
    const occs = expandOccurrences([sched], [ex], { from: D(2026, 6, 1), to: D(2026, 6, 1) }, childrenById);
    expect(occs[0]?.title).toBe('Holiday Make-up');
  });

  test('exception with all overrides null is a no-op modify (keeps original)', () => {
    const sched = schedule({
      id: 1,
      childId: 1,
      daysOfWeek: DOW.MON,
      title: 'Keep',
      startMinutes: 540,
      endMinutes: 600,
    });
    const ex: ScheduleException = {
      id: 1,
      scheduleId: 1,
      date: D(2026, 6, 1),
      kind: 'modify',
      overrideStartMinutes: null,
      overrideEndMinutes: null,
      overrideTitle: null,
    };
    const occs = expandOccurrences([sched], [ex], { from: D(2026, 6, 1), to: D(2026, 6, 1) }, childrenById);
    expect(occs).toHaveLength(1);
    expect(occs[0]).toMatchObject({ title: 'Keep', startMinutes: 540, endMinutes: 600 });
  });

  test('sort order: by (date asc, startMinutes asc, scheduleId asc)', () => {
    // Mix scheduleIds out of order, intersperse dates and times.
    const s1 = schedule({ id: 2, childId: 1, daysOfWeek: DOW.MON, startMinutes: 540, endMinutes: 600 });
    const s2 = schedule({ id: 1, childId: 1, daysOfWeek: DOW.MON, startMinutes: 540, endMinutes: 600 });
    const s3 = schedule({ id: 3, childId: 2, daysOfWeek: DOW.MON, startMinutes: 420, endMinutes: 480 });
    const occs = expandOccurrences(
      [s1, s2, s3],
      [],
      { from: D(2026, 6, 1), to: D(2026, 6, 8) },
      childrenById,
    );
    // Jun 1: (start 420, id 3), (start 540, id 1), (start 540, id 2), then Jun 8 same.
    expect(occs.map((o) => [o.date, o.startMinutes, o.scheduleId])).toEqual([
      [D(2026, 6, 1), 420, 3],
      [D(2026, 6, 1), 540, 1],
      [D(2026, 6, 1), 540, 2],
      [D(2026, 6, 8), 420, 3],
      [D(2026, 6, 8), 540, 1],
      [D(2026, 6, 8), 540, 2],
    ]);
  });

  test('empty schedules → []', () => {
    expect(expandOccurrences([], [], RANGE_TWO_WEEKS, childrenById)).toEqual([]);
  });

  test('empty range (from > to) → []', () => {
    const sched = schedule({ id: 1, childId: 1, daysOfWeek: DOW.MON });
    const occs = expandOccurrences(
      [sched],
      [],
      { from: D(2026, 6, 14), to: D(2026, 6, 1) },
      childrenById,
    );
    expect(occs).toEqual([]);
  });

  test('schedule with daysOfWeek=0 → no occurrences', () => {
    const sched = schedule({ id: 1, childId: 1, daysOfWeek: 0 });
    expect(expandOccurrences([sched], [], RANGE_TWO_WEEKS, childrenById)).toEqual([]);
  });

  test('multiple schedules cross-product across multiple days', () => {
    const sA = schedule({ id: 1, childId: 1, daysOfWeek: DOW.MON | DOW.WED });
    const sB = schedule({ id: 2, childId: 2, daysOfWeek: DOW.WED | DOW.FRI });
    const occs = expandOccurrences([sA, sB], [], { from: D(2026, 6, 1), to: D(2026, 6, 7) }, childrenById);
    // Jun 1 Mon: A only. Jun 3 Wed: A + B. Jun 5 Fri: B only.
    expect(occs.length).toBe(4);
    expect(occs.map((o) => [o.date, o.scheduleId])).toEqual([
      [D(2026, 6, 1), 1],
      [D(2026, 6, 3), 1],
      [D(2026, 6, 3), 2],
      [D(2026, 6, 5), 2],
    ]);
  });

  test('childrenById missing child → that schedule is silently skipped', () => {
    // Decision (mirrors src/domain/occurrences.ts): occurrences whose owning
    // child cannot be resolved are dropped rather than emitted with placeholders.
    const sched = schedule({ id: 1, childId: 999, daysOfWeek: DOW.MON });
    const occs = expandOccurrences([sched], [], RANGE_TWO_WEEKS, childrenById);
    expect(occs).toEqual([]);
  });

  test('month-boundary iteration: range crossing end-of-June stays correct', () => {
    const sched = schedule({ id: 1, childId: 1, daysOfWeek: DOW.MON | DOW.TUE });
    const occs = expandOccurrences(
      [sched],
      [],
      { from: D(2026, 6, 29), to: D(2026, 7, 7) },
      childrenById,
    );
    // Jun 29 Mon, Jun 30 Tue, Jul 6 Mon, Jul 7 Tue.
    expect(occs.map((o) => o.date)).toEqual([
      D(2026, 6, 29),
      D(2026, 6, 30),
      D(2026, 7, 6),
      D(2026, 7, 7),
    ]);
  });

  test('occurrence carries colorIndex from the owning child', () => {
    const sched = schedule({ id: 1, childId: 2, daysOfWeek: DOW.MON });
    const occs = expandOccurrences([sched], [], { from: D(2026, 6, 1), to: D(2026, 6, 1) }, childrenById);
    expect(occs[0]?.colorIndex).toBe(3);
  });

  test('cancel exception only affects the matching schedule, not siblings on same date', () => {
    const sA = schedule({ id: 1, childId: 1, daysOfWeek: DOW.MON });
    const sB = schedule({ id: 2, childId: 1, daysOfWeek: DOW.MON, startMinutes: 600, endMinutes: 660 });
    const ex: ScheduleException = {
      id: 9,
      scheduleId: 1,
      date: D(2026, 6, 1),
      kind: 'cancel',
      overrideStartMinutes: null,
      overrideEndMinutes: null,
      overrideTitle: null,
    };
    const occs = expandOccurrences([sA, sB], [ex], { from: D(2026, 6, 1), to: D(2026, 6, 1) }, childrenById);
    expect(occs).toHaveLength(1);
    expect(occs[0]?.scheduleId).toBe(2);
  });
});
