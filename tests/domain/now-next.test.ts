import { formatUntil, nowAndNextByKid } from '../../src/domain/now-next';
import type { ColorIndex, ISODate, Occurrence } from '../../src/domain/types';

const H = 60;

function occ(childId: number, start: number, end: number, title = 'x', scheduleId = start): Occurrence {
  return {
    scheduleId,
    childId,
    date: '2026-11-10' as unknown as ISODate,
    startMinutes: start,
    endMinutes: end,
    title,
    type: 'academy',
    colorIndex: 0 as ColorIndex,
    needsPickup: false,
  };
}

describe('nowAndNextByKid', () => {
  const day = [
    occ(1, 9 * H, 14 * H + 30, '학교'),
    occ(1, 16 * H, 17 * H + 30, '영어학원'),
    occ(2, 9 * H, 13 * H, '학교'),
    occ(2, 15 * H, 16 * H, '피아노'),
  ];

  test('in progress with a next one', () => {
    const [kid1] = nowAndNextByKid(day, [1], 13 * H + 20);
    expect(kid1?.status).toBe('inProgress');
    expect(kid1?.current?.title).toBe('학교');
    expect(kid1?.next?.title).toBe('영어학원');
    expect(kid1?.minutesUntilNext).toBe(160);
  });

  test('between events → upcoming', () => {
    const [kid2] = nowAndNextByKid(day, [2], 13 * H + 20);
    expect(kid2?.status).toBe('upcoming');
    expect(kid2?.current).toBeNull();
    expect(kid2?.next?.title).toBe('피아노');
    expect(kid2?.minutesUntilNext).toBe(100);
  });

  test('after the last event → doneForToday', () => {
    const [kid2] = nowAndNextByKid(day, [2], 18 * H);
    expect(kid2?.status).toBe('doneForToday');
    expect(kid2?.next).toBeNull();
    expect(kid2?.minutesUntilNext).toBeNull();
  });

  test('no events → none', () => {
    const [kid3] = nowAndNextByKid(day, [3], 12 * H);
    expect(kid3?.status).toBe('none');
  });

  test('end is exclusive: at 14:30 school is over', () => {
    const [kid1] = nowAndNextByKid(day, [1], 14 * H + 30);
    expect(kid1?.status).toBe('upcoming');
  });

  test('overlapping current events → the latest start wins', () => {
    const [k] = nowAndNextByKid(
      [occ(1, 9 * H, 15 * H, '학교'), occ(1, 13 * H, 14 * H, '체육')],
      [1],
      13 * H + 30,
    );
    expect(k?.current?.title).toBe('체육');
    expect(k?.next).toBeNull();
  });

  test('keeps the requested kid order', () => {
    expect(nowAndNextByKid(day, [2, 1], 12 * H).map((k) => k.childId)).toEqual([2, 1]);
  });
});

describe('formatUntil', () => {
  test.each([
    [0, '0분 후'],
    [40, '40분 후'],
    [60, '1시간 후'],
    [100, '1시간 40분 후'],
    [125, '2시간 5분 후'],
  ])('%i → %s', (m, label) => {
    expect(formatUntil(m)).toBe(label);
  });
});
