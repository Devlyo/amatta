// Alert wording (owner, 2026-11-12): no dots, no middle dot, no full stop.

import { fmtKoClock, formatScheduleEndNotification, formatScheduleNotification, withSubject } from '../../src/notifications/body';
import type { Schedule } from '../../src/domain/types';

const sched = (over: Partial<Schedule> = {}): Schedule =>
  ({
    id: 1, childId: 1, memberIds: [1], withGuardian: false, title: '수학학원', type: 'academy', location: null, notes: null,
    daysOfWeek: 127, startMinutes: 13 * 60, endMinutes: 15 * 60, validFrom: '2026-01-01', validUntil: null,
    notifyMinutesBefore: 10, needsPickup: false, allDay: false, notifyEndMinutesBefore: 10, ...over,
  }) as Schedule;

describe('start alert', () => {
  test('"민준 수학학원 1시 시작" — no supplies → empty body', () => {
    expect(formatScheduleNotification({ schedule: sched(), startMinutes: 13 * 60, endMinutes: 15 * 60, kidName: '민준', pendingLabels: [] }))
      .toEqual({ title: '민준 수학학원 1시 시작', body: '' });
  });
  test('supplies: "스케치북, 앞치마를 챙겨주세요🎒" / 도복을', () => {
    const r = formatScheduleNotification({ schedule: sched({ title: '미술' }), startMinutes: 15 * 60, endMinutes: 16 * 60, kidName: '서연', pendingLabels: ['스케치북', '앞치마'] });
    expect(r).toEqual({ title: '서연 미술 3시 시작', body: '스케치북, 앞치마를 챙겨주세요🎒' });
    expect(formatScheduleNotification({ schedule: sched(), startMinutes: 16 * 60 + 30, endMinutes: 17 * 60, kidName: '민준', pendingLabels: ['도복'] }))
      .toEqual({ title: '민준 수학학원 4시 30분 시작', body: '도복을 챙겨주세요🎒' });
  });
  test('long supply lists stay ≤ 80 chars', () => {
    const r = formatScheduleNotification({ schedule: sched(), startMinutes: 60, endMinutes: 120, kidName: '민준', pendingLabels: Array(30).fill('수영가방') });
    expect(r.body.length).toBeLessThanOrEqual(80);
    expect(r.body).toContain('…');
    expect(r.body.endsWith('챙겨주세요🎒')).toBe(true);
  });
  test('all-day', () => {
    expect(formatScheduleNotification({ schedule: sched({ allDay: true, title: '현장학습' }), startMinutes: 0, endMinutes: 1440, kidName: '도윤', pendingLabels: [] }).title)
      .toBe('도윤 현장학습 오늘 하루 종일');
  });
  test('no dots anywhere', () => {
    const r = formatScheduleNotification({ schedule: sched(), startMinutes: 60, endMinutes: 120, kidName: '민준', pendingLabels: ['수영가방'] });
    expect(`${r.title}${r.body}`).not.toMatch(/[.·]/);
  });
});

describe('end alert', () => {
  test('"서연 미술 4시 종료" + 픽업해주세요🚙 only when it needs a pickup', () => {
    expect(formatScheduleEndNotification({ schedule: sched({ title: '미술' }), endMinutes: 16 * 60, kidName: '서연' }))
      .toEqual({ title: '서연 미술 4시 종료', body: '' });
    expect(formatScheduleEndNotification({ schedule: sched({ needsPickup: true }), endMinutes: 15 * 60, kidName: '민준' }).body)
      .toBe('픽업해주세요🚙');
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
