import {
  computePickupCards,
  isoToYyyymmdd,
  type PickupCardData,
} from '../../../src/ui/daily/pickup-data';
import type {
  Child,
  ColorIndex,
  ISODate,
  Occurrence,
} from '../../../src/domain/types';

const ISO = (s: string): ISODate => s as unknown as ISODate;

function makeOccurrence(partial: Partial<Occurrence> & {
  scheduleId: number;
  childId: number;
  date: ISODate;
  startMinutes: number;
  endMinutes: number;
  needsPickup: boolean;
}): Occurrence {
  return {
    scheduleId: partial.scheduleId,
    childId: partial.childId,
    date: partial.date,
    startMinutes: partial.startMinutes,
    endMinutes: partial.endMinutes,
    title: partial.title ?? '학원',
    type: partial.type ?? 'academy',
    colorIndex: partial.colorIndex ?? (0 as ColorIndex),
    needsPickup: partial.needsPickup,
  };
}

const kidA: Child = {
  id: 1,
  name: '민준',
  colorIndex: 0 as ColorIndex,
  createdAt: ISO('2026-01-01'),
};
const kidB: Child = {
  id: 2,
  name: '서연',
  colorIndex: 5 as ColorIndex,
  createdAt: ISO('2026-01-01'),
};
const kidsById = new Map<number, Child>([
  [1, kidA],
  [2, kidB],
]);

const NEVER_COMPLETE = (): boolean => false;

const TODAY_ISO = ISO(realTodayIso());

function realTodayIso(): string {
  const now = new Date();
  const y = String(now.getFullYear()).padStart(4, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d + days);
  const yy = String(dt.getFullYear()).padStart(4, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

describe('computePickupCards', () => {
  test('empty occurrences → empty cards', () => {
    const cards = computePickupCards([], NEVER_COMPLETE, kidsById, 9 * 60, TODAY_ISO);
    expect(cards).toEqual([]);
  });

  test('1 occurrence needsPickup, not in log → 1 card', () => {
    const occs: Occurrence[] = [
      makeOccurrence({
        scheduleId: 11,
        childId: 1,
        date: TODAY_ISO,
        startMinutes: 15 * 60,
        endMinutes: 16 * 60,
        needsPickup: true,
        title: '수영',
      }),
    ];
    const cards = computePickupCards(occs, NEVER_COMPLETE, kidsById, 9 * 60, TODAY_ISO);
    expect(cards).toHaveLength(1);
    const card = cards[0] as PickupCardData;
    expect(card.scheduleId).toBe(11);
    expect(card.who).toBe('민준');
    expect(card.what).toBe('수영');
    expect(card.timeShort).toBe('16:00');
    expect(card.childColorIndex).toBe(0);
  });

  test('1 occurrence needsPickup, completed in log → 0 cards', () => {
    const occs: Occurrence[] = [
      makeOccurrence({
        scheduleId: 11,
        childId: 1,
        date: TODAY_ISO,
        startMinutes: 15 * 60,
        endMinutes: 16 * 60,
        needsPickup: true,
      }),
    ];
    const isComplete = (sid: number, occDateInt: number): boolean =>
      sid === 11 && occDateInt === isoToYyyymmdd(TODAY_ISO);
    const cards = computePickupCards(occs, isComplete, kidsById, 9 * 60, TODAY_ISO);
    expect(cards).toEqual([]);
  });

  test('2 occurrences same end time, both needsPickup → 2 cards sorted by scheduleId', () => {
    const occs: Occurrence[] = [
      makeOccurrence({
        scheduleId: 22,
        childId: 2,
        date: TODAY_ISO,
        startMinutes: 14 * 60,
        endMinutes: 15 * 60,
        needsPickup: true,
        title: '미술',
      }),
      makeOccurrence({
        scheduleId: 11,
        childId: 1,
        date: TODAY_ISO,
        startMinutes: 14 * 60,
        endMinutes: 15 * 60,
        needsPickup: true,
        title: '수영',
      }),
    ];
    const cards = computePickupCards(occs, NEVER_COMPLETE, kidsById, 9 * 60, TODAY_ISO);
    expect(cards.map((c) => c.scheduleId)).toEqual([11, 22]);
  });

  test('past occurrence on today → dropped (NEXT-PICKUP is future-only)', () => {
    const occs: Occurrence[] = [
      makeOccurrence({
        scheduleId: 11,
        childId: 1,
        date: TODAY_ISO,
        startMinutes: 8 * 60,
        endMinutes: 9 * 60,
        needsPickup: true,
      }),
      makeOccurrence({
        scheduleId: 12,
        childId: 1,
        date: TODAY_ISO,
        startMinutes: 15 * 60,
        endMinutes: 16 * 60,
        needsPickup: true,
      }),
    ];
    const cards = computePickupCards(occs, NEVER_COMPLETE, kidsById, 10 * 60, TODAY_ISO);
    // Only the future one — the past 9:00 pickup is excluded.
    expect(cards.map((c) => c.scheduleId)).toEqual([12]);
  });

  test('multiple pickups at different times → only the soonest is shown', () => {
    const occs: Occurrence[] = [
      makeOccurrence({
        scheduleId: 11,
        childId: 1,
        date: TODAY_ISO,
        startMinutes: 13 * 60,
        endMinutes: 14 * 60,
        needsPickup: true,
      }),
      makeOccurrence({
        scheduleId: 12,
        childId: 1,
        date: TODAY_ISO,
        startMinutes: 17 * 60,
        endMinutes: 18 * 60,
        needsPickup: true,
      }),
    ];
    const cards = computePickupCards(occs, NEVER_COMPLETE, kidsById, 9 * 60, TODAY_ISO);
    // 14:00 + 18:00 isn't a conflict — only the 14:00 surfaces.
    expect(cards.map((c) => c.scheduleId)).toEqual([11]);
  });

  test('non-today date → empty (banner only renders for today)', () => {
    const tomorrow = ISO(shiftDate(TODAY_ISO as unknown as string, 1));
    const occs: Occurrence[] = [
      makeOccurrence({
        scheduleId: 11,
        childId: 1,
        date: tomorrow,
        startMinutes: 14 * 60,
        endMinutes: 15 * 60,
        needsPickup: true,
      }),
    ];
    const cards = computePickupCards(occs, NEVER_COMPLETE, kidsById, 9 * 60, tomorrow);
    expect(cards).toEqual([]);
  });

  test('defensive: missing needsPickup field → treated as false', () => {
    // Simulate an Occurrence shape that drifted to omit needsPickup.
    const occ = {
      scheduleId: 11,
      childId: 1,
      date: TODAY_ISO,
      startMinutes: 15 * 60,
      endMinutes: 16 * 60,
      title: '수영',
      type: 'academy',
      colorIndex: 0,
    } as unknown as Occurrence;
    const cards = computePickupCards([occ], NEVER_COMPLETE, kidsById, 9 * 60, TODAY_ISO);
    expect(cards).toEqual([]);
  });
});

describe('isoToYyyymmdd', () => {
  test('2026-06-03 → 20260603', () => {
    expect(isoToYyyymmdd(ISO('2026-06-03'))).toBe(20260603);
  });
});
