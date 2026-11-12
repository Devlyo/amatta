// Drag-to-move (ADR-015): what gets saved for each case.

import { isOneTime, moveOccurrence, rotateMask, weekdayBit, type MoveSteps } from '../../src/state/move-occurrence';
import { snapColumns, snapMinutes } from '../../src/ui/calendar/DraggableBlock';
import type { ChecklistItem, ISODate, Schedule } from '../../src/domain/types';

const ISO = (s: string) => s as unknown as ISODate;
const sched = (over: Partial<Schedule> = {}): Schedule =>
  ({
    id: 7, childId: 1, memberIds: [1, 2], withGuardian: true, title: '수학', type: 'academy', location: '학원', notes: null,
    daysOfWeek: 0b0001010, // Tue + Thu (Mon = bit 0)
    startMinutes: 14 * 60, endMinutes: 15 * 60, validFrom: ISO('2026-01-01'), validUntil: null,
    notifyMinutesBefore: 10, needsPickup: true, allDay: false, notifyEndMinutesBefore: 5, ...over,
  }) as Schedule;

function steps(scope: 'this' | 'all' | null = 'this') {
  const calls: { fn: string; args: unknown[] }[] = [];
  const s: MoveSteps = {
    ask: async () => {
      calls.push({ fn: 'ask', args: [] });
      return scope;
    },
    updateSchedule: async (...a) => void calls.push({ fn: 'update', args: a }),
    applyException: async (...a) => void calls.push({ fn: 'exception', args: a }),
    addSchedule: async (input) => {
      calls.push({ fn: 'add', args: [input] });
      return { ...sched(), ...input, id: 99 } as Schedule;
    },
    addChecklistItem: async (input) => void calls.push({ fn: 'item', args: [input] }),
  };
  return { s, calls };
}

const base = { date: ISO('2026-11-10'), startMinutes: 14 * 60, endMinutes: 15 * 60, exception: undefined, checklist: [] as ChecklistItem[] };

describe('moveOccurrence', () => {
  test('one-time: moves straight away, date and weekday follow', async () => {
    const one = sched({ validFrom: ISO('2026-11-10'), validUntil: ISO('2026-11-10'), daysOfWeek: weekdayBit(ISO('2026-11-10')) });
    const { s, calls } = steps();
    await expect(moveOccurrence({ ...base, schedule: one, deltaMinutes: 90, deltaDays: 1 }, s)).resolves.toBe(true);
    expect(calls.map((c) => c.fn)).toEqual(['update']);
    expect(calls[0]?.args[1]).toEqual({
      startMinutes: 15 * 60 + 30, endMinutes: 16 * 60 + 30,
      validFrom: ISO('2026-11-11'), validUntil: ISO('2026-11-11'), daysOfWeek: weekdayBit(ISO('2026-11-11')),
    });
  });

  test('repeating, 이 일정만, same day → a modify exception', async () => {
    const { s, calls } = steps('this');
    await moveOccurrence({ ...base, schedule: sched(), deltaMinutes: 30, deltaDays: 0 }, s);
    expect(calls.map((c) => c.fn)).toEqual(['ask', 'exception']);
    expect(calls[1]?.args).toEqual([7, ISO('2026-11-10'), { kind: 'modify', overrideStartMinutes: 14 * 60 + 30, overrideEndMinutes: 15 * 60 + 30, overrideTitle: null }]);
  });

  test('repeating, 이 일정만, other day → cancel here + one-time copy there (members, guardian, supplies of that day)', async () => {
    const { s, calls } = steps('this');
    const checklist = [
      { id: 1, scheduleId: 7, label: '교재', sortOrder: 0, occurrenceDate: null, recurring: true, isDone: false, doneAt: null },
      { id: 2, scheduleId: 7, label: '다른 날', sortOrder: 1, occurrenceDate: 20261112, recurring: false, isDone: false, doneAt: null },
    ] as ChecklistItem[];
    await moveOccurrence({ ...base, schedule: sched(), deltaMinutes: 0, deltaDays: 2, checklist }, s);
    expect(calls.map((c) => c.fn)).toEqual(['ask', 'exception', 'add', 'item']);
    expect(calls[1]?.args).toEqual([7, ISO('2026-11-10'), { kind: 'cancel' }]);
    expect(calls[2]?.args[0]).toMatchObject({ memberIds: [1, 2], withGuardian: true, validFrom: ISO('2026-11-12'), validUntil: ISO('2026-11-12'), needsPickup: true });
    expect(calls[3]?.args[0]).toMatchObject({ scheduleId: 99, label: '교재' });
  });

  test('repeating, 모든 일정 → base times move; a day move shifts the weekdays', async () => {
    const { s, calls } = steps('all');
    await moveOccurrence({ ...base, schedule: sched(), deltaMinutes: -60, deltaDays: 1 }, s);
    expect(calls[1]?.args).toEqual([7, { startMinutes: 13 * 60, endMinutes: 14 * 60, daysOfWeek: 0b0010100 }]);
  });

  // Owner's report 2026-11-12: dragged 8→9 with 모든 일정, next week started at 7.
  test('모든 일정 on a day that had its own time → everyone takes the dropped time', async () => {
    const { s, calls } = steps('all');
    const exception = { id: 3, scheduleId: 7, date: ISO('2026-11-10'), kind: 'modify', overrideStartMinutes: 8 * 60, overrideEndMinutes: 9 * 60, overrideTitle: null } as const;
    await moveOccurrence(
      { ...base, schedule: sched({ startMinutes: 6 * 60, endMinutes: 7 * 60 }), startMinutes: 8 * 60, endMinutes: 9 * 60, exception, deltaMinutes: 60, deltaDays: 0 },
      s,
    );
    expect(calls.map((c) => c.fn)).toEqual(['ask', 'update', 'exception']);
    expect(calls[1]?.args).toEqual([7, { startMinutes: 9 * 60, endMinutes: 10 * 60 }]);
    expect(calls[2]?.args).toEqual([7, ISO('2026-11-10'), { kind: 'modify', overrideStartMinutes: 9 * 60, overrideEndMinutes: 10 * 60, overrideTitle: null }]);
  });

  test('cancel / no move / off the day → nothing saved', async () => {
    const c1 = steps(null);
    await expect(moveOccurrence({ ...base, schedule: sched(), deltaMinutes: 15, deltaDays: 0 }, c1.s)).resolves.toBe(false);
    expect(c1.calls.map((c) => c.fn)).toEqual(['ask']);
    const c2 = steps();
    await expect(moveOccurrence({ ...base, schedule: sched(), deltaMinutes: 0, deltaDays: 0 }, c2.s)).resolves.toBe(false);
    await expect(moveOccurrence({ ...base, schedule: sched(), deltaMinutes: 10 * 60, deltaDays: 0 }, c2.s)).resolves.toBe(false);
    expect(c2.calls).toEqual([]);
  });
});

describe('helpers', () => {
  test('rotateMask wraps Sun → Mon', () => {
    expect(rotateMask(0b1000000, 1)).toBe(0b0000001);
    expect(rotateMask(0b0000001, -1)).toBe(0b1000000);
  });
  test('isOneTime', () => {
    expect(isOneTime({ validFrom: ISO('2026-11-10'), validUntil: ISO('2026-11-10') })).toBe(true);
    expect(isOneTime({ validFrom: ISO('2026-11-10'), validUntil: null })).toBe(false);
  });
  test('snapping: 15-minute steps inside the day; whole columns in range', () => {
    const pxPerMin = 46 / 60;
    expect(snapMinutes(20 * pxPerMin, pxPerMin, 600, 660)).toBe(15);
    expect(snapMinutes(-10000, pxPerMin, 600, 660)).toBe(-600);
    expect(snapMinutes(10000, pxPerMin, 600, 660)).toBe(24 * 60 - 660);
    expect(snapColumns(130, 50, -2, 1)).toBe(1);
    expect(snapColumns(-130, 50, -2, 1)).toBe(-2);
  });
});
