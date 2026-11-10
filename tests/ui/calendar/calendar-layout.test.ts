import type { ColorIndex, ISODate, Occurrence } from '../../../src/domain/types';
import {
  monthCellChips,
  monthGridDates,
  showsInMonth,
  clampMonthRow,
  clampWeekSpan,
  monthChipLimit,
  monthsBetween,
  visibleWeekDays,
} from '../../../src/ui/calendar/calendar-layout';
import { daysBetweenIso, shiftIsoMonth } from '../../../src/ui/utils/date';

const ISO = (s: string) => s as unknown as ISODate;
const str = (d: ISODate) => d as unknown as string;

describe('visibleWeekDays / zoom levels', () => {
  test('7: Sun..Sat of the anchor week', () => {
    expect(visibleWeekDays(ISO('2026-11-10'), 7).map(str)).toEqual([
      '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14',
    ]);
  });
  test('4 / 3 / 2: that many days from the anchor', () => {
    expect(visibleWeekDays(ISO('2026-11-10'), 4).map(str)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
    expect(visibleWeekDays(ISO('2026-11-10'), 3).map(str)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
    expect(visibleWeekDays(ISO('2026-11-10'), 2).map(str)).toEqual(['2026-11-10', '2026-11-11']);
  });
  test('pinch zoom is continuous between 2 and 7 days', () => {
    expect(clampWeekSpan(9)).toBe(7);
    expect(clampWeekSpan(3.4)).toBe(3.4);
    expect(clampWeekSpan(1)).toBe(2);
  });
});

describe('monthGridDates', () => {
  test('Nov 2026: starts Sun Nov 1, 5 rows', () => {
    const days = monthGridDates(ISO('2026-11-10')).map(str);
    expect(days[0]).toBe('2026-11-01');
    expect(days).toHaveLength(35);
    expect(days[34]).toBe('2026-12-05');
  });
  test('Aug 2026: leading days from July, 6 rows', () => {
    const days = monthGridDates(ISO('2026-08-15')).map(str);
    expect(days[0]).toBe('2026-07-26');
    expect(days).toHaveLength(42);
    expect(days[41]).toBe('2026-09-05');
  });
  test('Feb 2026: exactly 4 rows', () => {
    expect(monthGridDates(ISO('2026-02-10'))).toHaveLength(28);
  });
});

describe('shiftIsoMonth', () => {
  test('keeps the day when it exists', () => {
    expect(str(shiftIsoMonth(ISO('2026-11-10'), 1))).toBe('2026-12-10');
    expect(str(shiftIsoMonth(ISO('2026-11-10'), -11))).toBe('2025-12-10');
  });
  test('clamps to the last day of shorter months', () => {
    expect(str(shiftIsoMonth(ISO('2026-01-31'), 1))).toBe('2026-02-28');
    expect(str(shiftIsoMonth(ISO('2028-01-31'), 1))).toBe('2028-02-29');
  });
});

describe('monthCellChips', () => {
  test('everything fits', () => {
    expect(monthCellChips([1, 2, 3], 4)).toEqual({ shown: [1, 2, 3], more: 0 });
    expect(monthCellChips([1, 2, 3, 4], 4)).toEqual({ shown: [1, 2, 3, 4], more: 0 });
  });
  test('overflow → last slot is +N', () => {
    expect(monthCellChips([1, 2, 3, 4, 5], 4)).toEqual({ shown: [1, 2, 3], more: 2 });
    expect(monthCellChips([1, 2, 3, 4, 5], 3)).toEqual({ shown: [1, 2], more: 3 });
  });
});

describe('showsInMonth', () => {
  const occ = (type: Occurrence['type']): Occurrence => ({
    scheduleId: 1,
    childId: 1,
    date: ISO('2026-11-10'),
    startMinutes: 540,
    endMinutes: 600,
    title: 'x',
    type,
    colorIndex: 0 as ColorIndex,
    needsPickup: false,
  });
  test('school (fixed) hidden, others shown', () => {
    expect(showsInMonth(occ('school'))).toBe(false);
    expect(showsInMonth(occ('academy'))).toBe(true);
    expect(showsInMonth(occ('other'))).toBe(true);
  });
});

describe('daysBetweenIso', () => {
  test('signed whole days, across months / DST-free', () => {
    expect(daysBetweenIso(ISO('2026-11-08'), ISO('2026-11-10'))).toBe(2);
    expect(daysBetweenIso(ISO('2026-11-10'), ISO('2026-10-31'))).toBe(-10);
    expect(daysBetweenIso(ISO('2026-03-01'), ISO('2026-03-31'))).toBe(30);
  });
});

describe('month zoom', () => {
  test('row height is continuous between the bounds', () => {
    expect(clampMonthRow(90)).toBe(104);
    expect(clampMonthRow(121.5)).toBe(121.5);
    expect(clampMonthRow(400)).toBe(150);
  });
  test('chip slots follow the row height (one line → two lines at 120)', () => {
    expect(monthChipLimit(104)).toBe(4);
    expect(monthChipLimit(119)).toBe(4);
    expect(monthChipLimit(120)).toBe(2);
    expect(monthChipLimit(136)).toBe(3);
  });
  test('monthsBetween', () => {
    expect(monthsBetween(ISO('2026-11-10'), ISO('2027-02-01'))).toBe(3);
    expect(monthsBetween(ISO('2026-11-30'), ISO('2026-10-01'))).toBe(-1);
  });
});
