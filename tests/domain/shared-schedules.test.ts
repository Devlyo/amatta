// ADR-013 shared schedules — one occurrence per schedule, fan-out for the
// per-person views, joined names, home now/next, pickup.

import { nowAndNextByKid } from '../../src/domain/now-next';
import { expandOccurrences, fanOutByMember, memberNames, occurrenceKey } from '../../src/domain/occurrences';
import type { Child, ColorIndex, ISODate, Schedule } from '../../src/domain/types';
import { computePickupCards } from '../../src/ui/daily/pickup-data';
import { todayIso } from '../../src/ui/utils/date';
import { togglePerson } from '../../src/ui/sheets/edit-sheet-form';

const kid = (id: number, name: string, colorIndex: number): Child =>
  ({ id, name, colorIndex: colorIndex as ColorIndex, avatar: 'face-wink', createdAt: '2026-01-01' as ISODate }) as Child;
const A = kid(1, '민준', 0);
const B = kid(2, '서연', 1);
const C = kid(3, '도윤', 2);
const D = kid(4, '하린', 3);
const byId = new Map([A, B, C, D].map((k) => [k.id, k]));

function sched(over: Partial<Schedule>): Schedule {
  return {
    id: 1,
    childId: 1,
    memberIds: [1],
    withGuardian: false,
    title: '가족 모임',
    type: 'other',
    location: null,
    notes: null,
    daysOfWeek: 127,
    startMinutes: 18 * 60,
    endMinutes: 19 * 60,
    validFrom: '2020-01-01' as ISODate,
    validUntil: null,
    notifyMinutesBefore: null,
    needsPickup: false,
    allDay: false,
    notifyEndMinutesBefore: null,
    ...over,
  };
}

const day = '2026-11-12' as ISODate;

describe('expandOccurrences + fanOutByMember', () => {
  test('one occurrence per schedule+date carrying every member; fan-out = one copy per kid in their colour', () => {
    const occ = expandOccurrences([sched({ childId: 1, memberIds: [1, 2, 3], withGuardian: true })], [], { from: day, to: day }, byId);
    expect(occ).toHaveLength(1);
    expect(occ[0]).toMatchObject({ childId: 1, memberIds: [1, 2, 3], withGuardian: true });
    const copies = fanOutByMember(occ, byId);
    expect(copies.map((o) => [o.childId, o.colorIndex])).toEqual([[1, 0], [2, 1], [3, 2]]);
    expect(new Set(copies.map(occurrenceKey)).size).toBe(3);
  });

  test('a member that no longer exists is dropped; the next one becomes the main kid', () => {
    const only = new Map([[2, B], [3, C]]);
    const occ = expandOccurrences([sched({ childId: 1, memberIds: [1, 2, 3] })], [], { from: day, to: day }, only);
    expect(occ[0]).toMatchObject({ childId: 2, memberIds: [2, 3], colorIndex: 1 });
  });

  test('a legacy schedule without memberIds still expands (main kid only)', () => {
    const legacy = { ...sched({}), memberIds: undefined } as unknown as Schedule;
    const occ = expandOccurrences([legacy], [], { from: day, to: day }, byId);
    expect(occ[0]?.memberIds).toEqual([1]);
    expect(fanOutByMember(occ, byId)).toHaveLength(1);
  });
});

describe('memberNames', () => {
  test('1–2 names joined, 3+ = "첫째 외 N명"', () => {
    expect(memberNames([1], byId)).toBe('민준');
    expect(memberNames([1, 2], byId)).toBe('민준·서연');
    expect(memberNames([1, 2, 3], byId)).toBe('민준 외 2명');
    expect(memberNames([1, 2, 3, 4], byId, true)).toBe('민준 외 4명');
  });
});

describe('home now/next', () => {
  test('a shared schedule shows in every member row', () => {
    const occ = fanOutByMember(
      expandOccurrences([sched({ childId: 1, memberIds: [1, 2] })], [], { from: day, to: day }, byId),
      byId,
    );
    const rows = nowAndNextByKid(occ, [1, 2, 3], 18 * 60 + 10);
    expect(rows.find((r) => r.childId === 1)?.current?.scheduleId).toBe(1);
    expect(rows.find((r) => r.childId === 2)?.current?.scheduleId).toBe(1);
    expect(rows.find((r) => r.childId === 3)?.current ?? null).toBeNull();
  });
});

describe('pickup', () => {
  test('one card per shared occurrence naming everyone — no clash with itself', () => {
    const today = todayIso();
    const occ = expandOccurrences(
      [sched({ childId: 1, memberIds: [1, 2], needsPickup: true, startMinutes: 23 * 60, endMinutes: 23 * 60 + 59 })],
      [],
      { from: today, to: today },
      byId,
    );
    const cards = computePickupCards(occ, () => false, byId, 0, today);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.who).toBe('민준·서연');
  });
});

describe('togglePerson (자녀 multi-select)', () => {
  const none = { memberIds: [] as number[], withGuardian: false, guardianOnly: false };
  test('create: guardian alone = device calendar; adding a kid turns it into withGuardian', () => {
    const g = togglePerson(none, 'guardian', 'create');
    expect(g).toEqual({ memberIds: [], withGuardian: false, guardianOnly: true });
    const gk = togglePerson(g, 1, 'create');
    expect(gk).toEqual({ memberIds: [1], withGuardian: true, guardianOnly: false });
    // Removing the last kid falls back to guardian-only.
    expect(togglePerson(gk, 1, 'create')).toEqual({ memberIds: [], withGuardian: false, guardianOnly: true });
  });
  test('kids add in pick order and toggle off', () => {
    const s1 = togglePerson(none, 2, 'create');
    const s2 = togglePerson(s1, 1, 'create');
    expect(s2.memberIds).toEqual([2, 1]);
    expect(togglePerson(s2, 2, 'create').memberIds).toEqual([1]);
  });
  test('editAll: the last kid cannot be removed; guardian only flips withGuardian', () => {
    const one = { memberIds: [1], withGuardian: false, guardianOnly: false };
    expect(togglePerson(one, 1, 'editAll').memberIds).toEqual([1]);
    expect(togglePerson(one, 'guardian', 'editAll')).toEqual({ memberIds: [1], withGuardian: true, guardianOnly: false });
    expect(togglePerson({ memberIds: [], withGuardian: false, guardianOnly: false }, 'guardian', 'editAll').guardianOnly).toBe(false);
  });
});
