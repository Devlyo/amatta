import {
  fmt12hrShort,
  fmtKoTime,
  formatKoreanDateLabel,
  formatKoreanShortDate,
  formatKoreanWeekRange,
  formatTodoDue,
  isDueOnDate,
  isToday,
  shiftIsoDate,
  todayIso,
  weekDatesIso,
  weekdayKo,
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
  // amatta-v1 weekly view anchors the week on Sunday
  // (app-weekly.jsx DAYS_KR = ['일','월','화','수','목','금','토']).
  // 2026-06-02 is a Tuesday → the preceding Sunday is 2026-05-31.
  test('Tuesday → previous Sunday', () => {
    expect(weekStartIso(iso('2026-06-02'))).toBe('2026-05-31');
  });
  test('Sunday → itself', () => {
    expect(weekStartIso(iso('2026-06-07'))).toBe('2026-06-07');
  });
  test('Saturday → previous Sunday (6 days back)', () => {
    expect(weekStartIso(iso('2026-06-06'))).toBe('2026-05-31');
  });
  test('crosses month boundary backward', () => {
    // 2026-07-01 is a Wednesday → previous Sunday is 2026-06-28.
    expect(weekStartIso(iso('2026-07-01'))).toBe('2026-06-28');
  });
});

describe('weekDatesIso', () => {
  test('returns 7 ISO dates Sun..Sat', () => {
    const days = weekDatesIso(iso('2026-06-02'));
    expect(days).toEqual([
      '2026-05-31',
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
      '2026-06-06',
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

describe('fmt12hrShort', () => {
  test('midnight on the hour drops minutes → 12AM', () => {
    expect(fmt12hrShort(0)).toBe('12AM');
  });
  test('9:00 on the hour → 9AM', () => {
    expect(fmt12hrShort(9 * 60)).toBe('9AM');
  });
  test('noon on the hour → 12PM', () => {
    expect(fmt12hrShort(12 * 60)).toBe('12PM');
  });
  test('15:30 → 3:30PM', () => {
    expect(fmt12hrShort(15 * 60 + 30)).toBe('3:30PM');
  });
  test('zero-pads single-digit minutes', () => {
    expect(fmt12hrShort(17 * 60 + 5)).toBe('5:05PM');
  });
});

describe('fmtKoTime', () => {
  test('midnight is 오전 12:00', () => {
    expect(fmtKoTime(0)).toBe('오전 12:00');
  });
  test('9:00 → 오전 9:00', () => {
    expect(fmtKoTime(9 * 60)).toBe('오전 9:00');
  });
  test('noon is 오후 12:00', () => {
    expect(fmtKoTime(12 * 60)).toBe('오후 12:00');
  });
  test('15:30 → 오후 3:30', () => {
    expect(fmtKoTime(15 * 60 + 30)).toBe('오후 3:30');
  });
});

describe('weekdayKo / formatKoreanShortDate', () => {
  test('weekdayKo for 2026-06-02 is 화', () => {
    expect(weekdayKo(iso('2026-06-02'))).toBe('화');
  });
  test('formatKoreanShortDate uses middle dot separator', () => {
    expect(formatKoreanShortDate(iso('2026-06-02'))).toBe('6월 2일 · 화');
  });
});

describe('isToday', () => {
  test('todayIso() round-trips as today', () => {
    expect(isToday(todayIso())).toBe(true);
  });
  test('a different ISO date is not today', () => {
    // Far-future date — guaranteed not today.
    expect(isToday(iso('2099-12-31'))).toBe(false);
  });
});

describe('formatTodoDue', () => {
  // currentDate = 2026-06-02 (Tuesday).
  const today = iso('2026-06-02');

  test('same calendar day → 오늘', () => {
    const dueAt = new Date(2026, 5, 2, 9, 30).getTime();
    expect(formatTodoDue(dueAt, today)).toBe('오늘');
  });

  test('next calendar day → 내일', () => {
    const dueAt = new Date(2026, 5, 3, 0, 1).getTime();
    expect(formatTodoDue(dueAt, today)).toBe('내일');
  });

  test('future date returns M/D form', () => {
    const dueAt = new Date(2026, 5, 8, 17, 0).getTime();
    expect(formatTodoDue(dueAt, today)).toBe('6/8');
  });

  test('past date also returns M/D form', () => {
    const dueAt = new Date(2026, 4, 28, 12, 0).getTime();
    expect(formatTodoDue(dueAt, today)).toBe('5/28');
  });
});

describe('isDueOnDate', () => {
  // A todo created on June 5 (noon anchor, as the app stores it).
  const jun5 = new Date(2026, 5, 5, 12, 0).getTime();

  test('same calendar day → true', () => {
    expect(isDueOnDate(jun5, iso('2026-06-05'))).toBe(true);
  });

  test('next day → false (June 5 todo must not show on June 6)', () => {
    expect(isDueOnDate(jun5, iso('2026-06-06'))).toBe(false);
  });

  test('previous day → false', () => {
    expect(isDueOnDate(jun5, iso('2026-06-04'))).toBe(false);
  });

  test('matches at the day boundaries (00:00 and 23:59)', () => {
    const startOfDay = new Date(2026, 5, 5, 0, 0).getTime();
    const endOfDay = new Date(2026, 5, 5, 23, 59).getTime();
    expect(isDueOnDate(startOfDay, iso('2026-06-05'))).toBe(true);
    expect(isDueOnDate(endOfDay, iso('2026-06-05'))).toBe(true);
  });
});
