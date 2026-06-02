import {
  formatKoreanDateLabel,
  formatKoreanWeekRange,
  shiftIsoDate,
  todayIso,
  weekDatesIso,
  weekStartIso,
} from '../../../src/ui/utils/date';
import type { ISODate } from '../../../src/domain/types';

const iso = (s: string): ISODate => s as unknown as ISODate;

describe('formatKoreanDateLabel', () => {
  // 2026-06-02 = Tuesday (locally).
  test('formats 2026-06-02 as 6월 2일 (화)', () => {
    expect(formatKoreanDateLabel(iso('2026-06-02'))).toBe('6월 2일 (화)');
  });

  test('formats 2026-06-01 as 6월 1일 (월)', () => {
    expect(formatKoreanDateLabel(iso('2026-06-01'))).toBe('6월 1일 (월)');
  });

  test('formats a Sunday correctly', () => {
    // 2026-06-07 is a Sunday.
    expect(formatKoreanDateLabel(iso('2026-06-07'))).toBe('6월 7일 (일)');
  });
});

describe('shiftIsoDate', () => {
  test('shifts forward across month boundary', () => {
    expect(shiftIsoDate(iso('2026-06-30'), 1)).toBe('2026-07-01');
  });

  test('shifts backward across year boundary', () => {
    expect(shiftIsoDate(iso('2026-01-01'), -1)).toBe('2025-12-31');
  });

  test('zero delta is a no-op', () => {
    expect(shiftIsoDate(iso('2026-06-02'), 0)).toBe('2026-06-02');
  });
});

describe('todayIso', () => {
  test('returns a YYYY-MM-DD string', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('weekStartIso', () => {
  // 2026-06-02 is a Tuesday → Monday is 2026-06-01.
  test('Tuesday → previous Monday', () => {
    expect(weekStartIso(iso('2026-06-02'))).toBe('2026-06-01');
  });
  test('Monday → itself', () => {
    expect(weekStartIso(iso('2026-06-01'))).toBe('2026-06-01');
  });
  test('Sunday → previous Monday (6 days back)', () => {
    expect(weekStartIso(iso('2026-06-07'))).toBe('2026-06-01');
  });
  test('crosses month boundary backward', () => {
    expect(weekStartIso(iso('2026-07-01'))).toBe('2026-06-29');
  });
});

describe('weekDatesIso', () => {
  test('returns 7 ISO dates Mon..Sun', () => {
    const days = weekDatesIso(iso('2026-06-02'));
    expect(days).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
      '2026-06-06',
      '2026-06-07',
    ]);
  });
});

describe('formatKoreanWeekRange', () => {
  test('formats a Mon-anchored week as "M월 D일 — M월 D일"', () => {
    expect(formatKoreanWeekRange(iso('2026-05-25'))).toBe('5월 25일 — 5월 31일');
  });
  test('formats a week that crosses a month boundary', () => {
    expect(formatKoreanWeekRange(iso('2026-06-29'))).toBe('6월 29일 — 7월 5일');
  });
});
