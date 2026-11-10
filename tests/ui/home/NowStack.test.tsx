// Home 지금 stack (board H1/H2, ADR-014).

import { fireEvent, render, screen } from '@testing-library/react-native';

import { nowAndNextByKid } from '../../../src/domain/now-next';
import type { Child, ColorIndex, ISODate, Occurrence } from '../../../src/domain/types';
import { NowStack, orderForStack } from '../../../src/ui/home/NowStack';

const ISO = (s: string) => s as unknown as ISODate;
const kid = (id: number, name: string): Child =>
  ({ id, name, colorIndex: (id - 1) as ColorIndex, avatar: 'face-wink', createdAt: ISO('2026-01-01') }) as Child;
const kids = [kid(1, '민준'), kid(2, '서연'), kid(3, '도윤')];

const occ = (scheduleId: number, childId: number, start: number, end: number, title: string): Occurrence =>
  ({
    scheduleId,
    childId,
    memberIds: [childId],
    withGuardian: false,
    date: ISO('2026-11-11'),
    startMinutes: start,
    endMinutes: end,
    title,
    type: 'academy',
    colorIndex: (childId - 1) as ColorIndex,
    needsPickup: false,
    allDay: false,
  }) as Occurrence;

const NOW = 14 * 60 + 20;
const rows = nowAndNextByKid(
  [occ(1, 1, 14 * 60, 15 * 60, '수학'), occ(2, 1, 16 * 60 + 30, 17 * 60, '수영'), occ(3, 2, 15 * 60, 16 * 60, '피아노')],
  [3, 2, 1],
  NOW,
);

describe('orderForStack', () => {
  test('in progress → upcoming → nothing today', () => {
    expect(orderForStack(rows).map((r) => r.childId)).toEqual([1, 2, 3]);
  });
});

describe('NowStack', () => {
  test('collapsed: only the most pressing block; tap fans out every kid; 접기 folds', () => {
    render(<NowStack kids={kids} rows={rows} nowMinutes={NOW} />);
    expect(screen.getByTestId('now-stack')).toBeTruthy();
    // Folded: only the top card is reachable (the rest are hidden from a11y).
    expect(screen.getByText('수학')).toBeTruthy();
    expect(screen.getByText('진행 중 · 40분 남음')).toBeTruthy();
    expect(screen.getByText('다음 4:30PM 수영')).toBeTruthy();
    expect(screen.queryByLabelText(/^서연, 피아노/)).toBeNull();

    fireEvent.press(screen.getByTestId('now-stack-toggle'));
    expect(screen.getByTestId('now-stack-open')).toBeTruthy();
    expect(screen.getByLabelText(/^서연, 피아노/)).toBeTruthy();
    expect(screen.getByText('40분 후')).toBeTruthy();
    expect(screen.getByText('오늘 일정 없음')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('접기'));
    expect(screen.getByTestId('now-stack')).toBeTruthy();
    expect(screen.queryByLabelText(/^서연, 피아노/)).toBeNull();
  });

  test('one kid: a single block, no stack', () => {
    render(<NowStack kids={[kids[0]!]} rows={rows.filter((r) => r.childId === 1)} nowMinutes={NOW} />);
    expect(screen.queryByTestId('now-stack')).toBeNull();
    expect(screen.getByTestId('now-block-1')).toBeTruthy();
  });
});
