// Home 지금 stack (board H1/H2, ADR-014).

import { fireEvent, render, screen } from '@testing-library/react-native';

import { nowAndNextByKid } from '../../../src/domain/now-next';
import type { Child, ColorIndex, ISODate, Occurrence } from '../../../src/domain/types';
import { NowStack, cardGeometry, orderForStack } from '../../../src/ui/home/NowStack';

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

describe('cardGeometry', () => {
  const hs = [110, 62, 62, 62];
  test('open: each card right under the one above, 6pt apart, full size', () => {
    expect(cardGeometry(hs, 0, 1)).toEqual({ y: 0, scale: 1, opacity: 1, height: 110 });
    expect(cardGeometry(hs, 1, 1).height).toBe(62);
    expect(cardGeometry(hs, 1, 1).y).toBeCloseTo(116);
    expect(cardGeometry(hs, 2, 1).y).toBeCloseTo(184);
    expect(cardGeometry(hs, 3, 1).y).toBeCloseTo(252);
  });
  test('folded: cards 1–2 peek 9 / 18pt under the top card, narrower; the rest hidden', () => {
    const bottom = (i: number) => {
      const g = cardGeometry(hs, i, 0);
      return g.y + (g.height * (1 + g.scale)) / 2;
    };
    expect(bottom(1)).toBeCloseTo(110 + 9);
    expect(bottom(2)).toBeCloseTo(110 + 18);
    expect(cardGeometry(hs, 1, 0).scale).toBeCloseTo(0.95);
    expect(cardGeometry(hs, 2, 0).scale).toBeCloseTo(0.9);
    expect(cardGeometry(hs, 3, 0).opacity).toBe(0);
  });
  test('folded: a card taller than the top one never pokes out above it', () => {
    const tall = [62, 110, 62];
    const g = cardGeometry(tall, 1, 0);
    expect(g.height).toBe(62);
    const top = g.y + (g.height * (1 - g.scale)) / 2;
    expect(top).toBeGreaterThan(0);
    expect(g.y + (g.height * (1 + g.scale)) / 2).toBeCloseTo(62 + 9);
  });
});
