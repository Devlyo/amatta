import {
  DOW,
  clearDay,
  dayOfWeekIndex,
  daysToMask,
  maskHasDay,
  maskToDays,
  setDay,
  type DayIndex,
} from '../../src/domain/days-of-week';

describe('days-of-week bitmask helpers', () => {
  test('maskToDays(daysToMask([0,3,5])) round-trips to [0,3,5]', () => {
    const indices: DayIndex[] = [0, 3, 5];
    const mask = daysToMask(indices);
    expect(maskToDays(mask)).toEqual(indices);
  });

  test('daysToMask matches DOW named constants for Mon+Thu+Sat', () => {
    expect(daysToMask([0, 3, 5])).toBe(DOW.MON | DOW.THU | DOW.SAT);
  });

  test('round-trips for the empty set', () => {
    expect(maskToDays(daysToMask([]))).toEqual([]);
  });

  test('round-trips for the full week', () => {
    const full: DayIndex[] = [0, 1, 2, 3, 4, 5, 6];
    expect(maskToDays(daysToMask(full))).toEqual(full);
  });

  test('daysToMask ignores duplicate indices', () => {
    expect(daysToMask([2, 2, 2] as DayIndex[])).toBe(1 << 2);
  });

  describe('maskHasDay truth table', () => {
    test('returns true for set days and false for clear days', () => {
      const mask = DOW.MON | DOW.WED | DOW.FRI;
      expect(maskHasDay(mask, 0)).toBe(true);
      expect(maskHasDay(mask, 1)).toBe(false);
      expect(maskHasDay(mask, 2)).toBe(true);
      expect(maskHasDay(mask, 3)).toBe(false);
      expect(maskHasDay(mask, 4)).toBe(true);
      expect(maskHasDay(mask, 5)).toBe(false);
      expect(maskHasDay(mask, 6)).toBe(false);
    });

    test('empty mask returns false for every day', () => {
      for (let i = 0 as DayIndex; i < 7; i = (i + 1) as DayIndex) {
        expect(maskHasDay(0, i)).toBe(false);
      }
    });

    test('full mask returns true for every day', () => {
      const all = daysToMask([0, 1, 2, 3, 4, 5, 6]);
      for (let i = 0 as DayIndex; i < 7; i = (i + 1) as DayIndex) {
        expect(maskHasDay(all, i)).toBe(true);
      }
    });
  });

  describe('setDay / clearDay', () => {
    test('setDay on empty mask sets only that bit', () => {
      expect(setDay(0, 3)).toBe(1 << 3);
    });

    test('setDay is idempotent', () => {
      const m = setDay(0, 4);
      expect(setDay(m, 4)).toBe(m);
    });

    test('clearDay on empty mask is no-op', () => {
      expect(clearDay(0, 2)).toBe(0);
    });

    test('clearDay only removes the requested bit', () => {
      const mask = DOW.MON | DOW.WED | DOW.FRI;
      const cleared = clearDay(mask, 2);
      expect(maskHasDay(cleared, 0)).toBe(true);
      expect(maskHasDay(cleared, 2)).toBe(false);
      expect(maskHasDay(cleared, 4)).toBe(true);
    });

    test('setDay then clearDay round-trips', () => {
      const after = clearDay(setDay(0, 5), 5);
      expect(after).toBe(0);
    });
  });

  describe('dayOfWeekIndex (Mon=0..Sun=6)', () => {
    test('June 1 2026 is Monday → index 0', () => {
      expect(dayOfWeekIndex(new Date(2026, 5, 1))).toBe(0);
    });

    test('June 2 2026 is Tuesday → index 1', () => {
      expect(dayOfWeekIndex(new Date(2026, 5, 2))).toBe(1);
    });

    test('June 7 2026 is Sunday → index 6', () => {
      expect(dayOfWeekIndex(new Date(2026, 5, 7))).toBe(6);
    });

    test('full week walk Mon→Sun maps to 0..6', () => {
      const got: number[] = [];
      for (let d = 1; d <= 7; d++) {
        got.push(dayOfWeekIndex(new Date(2026, 5, d)));
      }
      expect(got).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
  });
});
