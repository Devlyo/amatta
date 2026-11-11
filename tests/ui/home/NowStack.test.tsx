// Home 지금 stack (board H1/H2, ADR-014).

import { fireEvent, render, screen } from '@testing-library/react-native';

import { nowAndNextByKid } from '../../../src/domain/now-next';
import type { Child, ColorIndex, ISODate, Occurrence } from '../../../src/domain/types';
import { NowStack, cardGeometry, foldedHeight, orderForStack } from '../../../src/ui/home/NowStack';

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
  test('folded: in-progress listed, the rest stacked (top one readable); tap fans out; 접기 folds', () => {
    render(<NowStack kids={kids} rows={rows} nowMinutes={NOW} />);
    expect(screen.getByTestId('now-stack')).toBeTruthy();
    // 민준 is in progress → always listed.
    expect(screen.getByText('진행 중')).toBeTruthy();
    expect(screen.getByText('다음 4:30PM 수영')).toBeTruthy();
    // 서연 tops the stack; 도윤 is folded behind (hidden from a11y).
    expect(screen.getByLabelText(/^서연, 피아노/)).toBeTruthy();
    expect(screen.queryByText('오늘 일정 없음')).toBeNull();

    fireEvent.press(screen.getByTestId('now-stack-toggle'));
    expect(screen.getByTestId('now-stack-open')).toBeTruthy();
    expect(screen.getByText('오늘 일정 없음')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('접기'));
    expect(screen.getByTestId('now-stack')).toBeTruthy();
    expect(screen.queryByText('오늘 일정 없음')).toBeNull();
  });

  test('all in progress (or only one left to stack) → starts opened; can still fold everything into one stack', () => {
    const two = nowAndNextByKid(
      [occ(1, 1, 14 * 60, 15 * 60, '수학'), occ(3, 2, 14 * 60, 16 * 60, '피아노')],
      [1, 2],
      NOW,
    );
    render(<NowStack kids={kids.slice(0, 2)} rows={two} nowMinutes={NOW} />);
    expect(screen.getByTestId('now-stack-open')).toBeTruthy();
    expect(screen.getByLabelText(/^서연, 피아노/)).toBeTruthy();
    fireEvent(screen.getByTestId('now-stack-hold'), 'longPress');
    expect(screen.getByTestId('now-stack')).toBeTruthy();
    expect(screen.queryByLabelText(/^서연, 피아노/)).toBeNull();
    fireEvent.press(screen.getByTestId('now-stack-toggle'));
    expect(screen.getByTestId('now-stack-open')).toBeTruthy();
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
    expect(cardGeometry(hs, 0, 1)).toMatchObject({ y: 0, scale: 1, opacity: 1, height: 110, wash: 0 });
    expect(cardGeometry(hs, 1, 1).height).toBe(62);
    expect(cardGeometry(hs, 1, 1).y).toBeCloseTo(116);
    expect(cardGeometry(hs, 2, 1).y).toBeCloseTo(184);
    expect(cardGeometry(hs, 3, 1).y).toBeCloseTo(252);
  });
  test('folded: cards 1–2 peek 11 / 22pt under the top card, narrower, a light fade per level; the rest hidden', () => {
    const bottom = (i: number) => {
      const g = cardGeometry(hs, i, 0);
      return g.y + (g.height * (1 + g.scale)) / 2;
    };
    expect(bottom(1)).toBeCloseTo(110 + 11);
    expect(bottom(2)).toBeCloseTo(110 + 22);
    expect(cardGeometry(hs, 1, 0).opacity).toBeCloseTo(0.97);
    expect(cardGeometry(hs, 2, 0).opacity).toBeCloseTo(0.94);
    expect(cardGeometry(hs, 0, 0).lift).toBe(1);
    expect(cardGeometry(hs, 2, 0).lift).toBe(1);
    expect(cardGeometry(hs, 3, 0).lift).toBe(0);
    expect(cardGeometry(hs, 1, 1).lift).toBe(0);
    expect(cardGeometry(hs, 1, 0).radius).toBeLessThan(22);
    expect(cardGeometry(hs, 1, 0).scale).toBeCloseTo(0.95);
    expect(cardGeometry(hs, 2, 0).scale).toBeCloseTo(0.9);
    expect(cardGeometry(hs, 3, 0).opacity).toBe(0);
  });
  test('with live cards: they stay listed; the stack starts right under them', () => {
    const g0 = cardGeometry(hs, 0, 0, 1);
    expect(g0).toMatchObject({ y: 0, scale: 1, opacity: 1, height: 110, lift: 0 });
    expect(cardGeometry(hs, 1, 0, 1).y).toBeCloseTo(116); // stack top
    const g2 = cardGeometry(hs, 2, 0, 1);
    expect(g2.y + (g2.height * (1 + g2.scale)) / 2).toBeCloseTo(116 + 62 + 11);
    expect(foldedHeight(hs, 4, 1)).toBeCloseTo(116 + 62 + 22);
    expect(cardGeometry(hs, 3, 1, 1).y).toBeCloseTo(252);
  });
  test('folded: a card taller than the top one never pokes out above it', () => {
    const tall = [62, 110, 62];
    const g = cardGeometry(tall, 1, 0);
    expect(g.height).toBe(62);
    const top = g.y + (g.height * (1 - g.scale)) / 2;
    expect(top).toBeGreaterThan(0);
    expect(g.y + (g.height * (1 + g.scale)) / 2).toBeCloseTo(62 + 11);
  });
});

describe('nowCardColor (board H5 D1.5)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { nowCardColor } = require('../../../src/ui/home/NowStack') as typeof import('../../../src/ui/home/NowStack');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mixHex } = require('../../../src/ui/palette') as typeof import('../../../src/ui/palette');
  test('light: solid, 18% toward deep; dark: 70% kid colour over the surface', () => {
    const p = { source: '#C0F0AA', deep: '#5E9E40' };
    expect(nowCardColor({ scheme: 'light', t: { surface: '#FFFFFF' } }, p)).toBe(mixHex('#C0F0AA', '#5E9E40', 0.18));
    expect(nowCardColor({ scheme: 'dark', t: { surface: '#272523' } }, p)).toBe(mixHex('#272523', '#C0F0AA', 0.7));
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});

describe('NowStack hold to fold', () => {
  test('opened: holding anywhere on the stack folds it', () => {
    render(<NowStack kids={kids} rows={rows} nowMinutes={NOW} />);
    fireEvent.press(screen.getByTestId('now-stack-toggle'));
    expect(screen.getByTestId('now-stack-open')).toBeTruthy();
    expect(screen.getByTestId('now-stack-hold').props.delayLongPress ?? 200).toBe(200);
    fireEvent(screen.getByTestId('now-stack-hold'), 'longPress');
    expect(screen.getByTestId('now-stack')).toBeTruthy();
    expect(screen.queryByTestId('now-stack-hold')).toBeNull();
  });
});
