import { dateAt, guardianOccurrences, type GuardianRawEvent } from '../../src/domain/guardian';
import type { ISODate } from '../../src/domain/types';

const ISO = (s: string) => s as unknown as ISODate;
const at = (iso: string, h: number, m = 0) => dateAt(ISO(iso), h * 60 + m);
const ev = (p: Partial<GuardianRawEvent> & Pick<GuardianRawEvent, 'startDate' | 'endDate'>): GuardianRawEvent => ({
  id: 'e1',
  calendarId: 'c1',
  title: '회의',
  allDay: false,
  ...p,
});

describe('guardianOccurrences', () => {
  test('a timed event inside one day → one piece in minutes', () => {
    const out = guardianOccurrences([ev({ startDate: at('2026-11-10', 9, 30), endDate: at('2026-11-10', 11) })], ISO('2026-11-08'), ISO('2026-11-14'));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ date: '2026-11-10', startMinutes: 570, endMinutes: 660, allDay: false });
    expect(out[0]?.key).toMatch(/^e1@\d+\|2026-11-10$/);
  });

  // Owner's device, 2026-11-12: "Encountered two children with the same key"
  // — iOS repeats share an id, and an event can be listed twice.
  test('keys stay unique: same event twice is dropped; two instances of a repeat on one day both stay', () => {
    const a = ev({ startDate: at('2026-11-10', 9), endDate: at('2026-11-10', 10) });
    const b = ev({ startDate: at('2026-11-10', 15), endDate: at('2026-11-10', 16) });
    const out = guardianOccurrences([a, { ...a }, b], ISO('2026-11-08'), ISO('2026-11-14'));
    expect(out).toHaveLength(2);
    expect(new Set(out.map((o) => o.key)).size).toBe(2);
  });

  test('crossing midnight → clipped piece on each day', () => {
    const out = guardianOccurrences([ev({ startDate: at('2026-11-10', 22), endDate: at('2026-11-11', 1) })], ISO('2026-11-01'), ISO('2026-11-30'));
    expect(out.map((o) => [o.date, o.startMinutes, o.endMinutes])).toEqual([
      ['2026-11-10', 1320, 1440],
      ['2026-11-11', 0, 60],
    ]);
  });

  test('all-day over two days (end = following midnight) → two all-day pieces', () => {
    const out = guardianOccurrences(
      [ev({ allDay: true, startDate: at('2026-11-10', 0), endDate: at('2026-11-12', 0) })],
      ISO('2026-11-01'),
      ISO('2026-11-30'),
    );
    expect(out.map((o) => [o.date, o.allDay, o.startMinutes, o.endMinutes])).toEqual([
      ['2026-11-10', true, 0, 1440],
      ['2026-11-11', true, 0, 1440],
    ]);
  });

  test('all-day ending 23:59:59 of its day → that day only', () => {
    const out = guardianOccurrences(
      [ev({ allDay: true, startDate: at('2026-11-10', 0), endDate: new Date(2026, 10, 10, 23, 59, 59) })],
      ISO('2026-11-01'),
      ISO('2026-11-30'),
    );
    expect(out.map((o) => o.date)).toEqual(['2026-11-10']);
  });

  test('clipped to the range, zero-length dropped, blank title named, sorted', () => {
    const out = guardianOccurrences(
      [
        ev({ id: 'late', title: '', startDate: at('2026-11-12', 15), endDate: at('2026-11-12', 16) }),
        ev({ id: 'zero', startDate: at('2026-11-12', 9), endDate: at('2026-11-12', 9) }),
        ev({ id: 'out', startDate: at('2026-12-01', 9), endDate: at('2026-12-01', 10) }),
        ev({ id: 'early', startDate: at('2026-11-12', 8), endDate: at('2026-11-12', 9) }),
      ],
      ISO('2026-11-08'),
      ISO('2026-11-14'),
    );
    expect(out.map((o) => o.eventId)).toEqual(['early', 'late']);
    expect(out[1]?.title).toBe('(제목 없음)');
  });
});
