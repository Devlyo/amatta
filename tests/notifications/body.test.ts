// Alert wording (owner, 2026-11-11).

import { fmtKoClock, formatScheduleEndNotification, formatScheduleNotification, withSubject } from '../../src/notifications/body';
import type { Schedule } from '../../src/domain/types';

const sched = (over: Partial<Schedule> = {}): Schedule =>
  ({
    id: 1, childId: 1, memberIds: [1], withGuardian: false, title: '수학학원', type: 'academy', location: null, notes: null,
    daysOfWeek: 127, startMinutes: 13 * 60, endMinutes: 15 * 60, validFrom: '2026-01-01', validUntil: null,
    notifyMinutesBefore: 10, needsPickup: false, allDay: false, notifyEndMinutesBefore: 10, ...over,
  }) as Schedule;

describe('start alert', () => {
  test('"민준 · 수학학원이 1시에 시작합니다." — no supplies → empty body', () => {
    expect(formatScheduleNotification({ schedule: sched(), startMinutes: 13 * 60, endMinutes: 15 * 60, kidName: '민준', pendingLabels: [] }))
      .toEqual({ title: '민준 · 수학학원이 1시에 시작합니다.', body: '' });
  });
  test('supplies: "준비물은 연습장, 필통이에요." / 악보예요', () => {
    const r = formatScheduleNotification({ schedule: sched({ title: '피아노' }), startMinutes: 16 * 60 + 30, endMinutes: 17 * 60, kidName: '서연', pendingLabels: ['연습장', '필통'] });
    expect(r).toEqual({ title: '서연 · 피아노가 4시 30분에 시작합니다.', body: '준비물은 연습장, 필통이에요.' });
    expect(formatScheduleNotification({ schedule: sched(), startMinutes: 0, endMinutes: 60, kidName: '민준', pendingLabels: ['악보'] }).body).toBe('준비물은 악보예요.');
  });
  test('long supply lists stay ≤ 80 chars', () => {
    const r = formatScheduleNotification({ schedule: sched(), startMinutes: 60, endMinutes: 120, kidName: '민준', pendingLabels: Array(30).fill('수영가방') });
    expect(r.body.length).toBeLessThanOrEqual(80);
    expect(r.body).toContain('…');
  });
  test('all-day', () => {
    expect(formatScheduleNotification({ schedule: sched({ allDay: true, title: '현장학습' }), startMinutes: 0, endMinutes: 1440, kidName: '도윤', pendingLabels: [] }).title)
      .toBe('도윤 · 현장학습이 오늘 하루 종일 있어요.');
  });
});

describe('end alert', () => {
  test('"민준 · 수학학원이 3시에 끝나요." + 픽업해주세요. only when it needs a pickup', () => {
    expect(formatScheduleEndNotification({ schedule: sched(), endMinutes: 15 * 60, kidName: '민준' }))
      .toEqual({ title: '민준 · 수학학원이 3시에 끝나요.', body: '' });
    expect(formatScheduleEndNotification({ schedule: sched({ needsPickup: true }), endMinutes: 15 * 60, kidName: '민준' }).body)
      .toBe('픽업해주세요.');
  });
});

describe('helpers', () => {
  test('조사 + 시각', () => {
    expect(withSubject('수학학원')).toBe('수학학원이');
    expect(withSubject('피아노')).toBe('피아노가');
    expect(withSubject('영어 (2)')).toBe('영어 (2)가');
    expect(fmtKoClock(0)).toBe('12시');
    expect(fmtKoClock(12 * 60)).toBe('12시');
    expect(fmtKoClock(9 * 60 + 5)).toBe('9시 5분');
  });
});
