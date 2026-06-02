import { render } from '@testing-library/react-native';

import { PickupCarousel } from '../../../src/ui/daily/PickupCarousel';
import type {
  Child,
  ColorIndex,
  ISODate,
  Occurrence,
} from '../../../src/domain/types';

const ISO = (s: string): ISODate => s as unknown as ISODate;

function todayIso(): ISODate {
  const now = new Date();
  const y = String(now.getFullYear()).padStart(4, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return ISO(`${y}-${m}-${d}`);
}

const TODAY = todayIso();

const kidA: Child = {
  id: 1,
  name: '민준',
  colorIndex: 0 as ColorIndex,
  createdAt: ISO('2026-01-01'),
};
const kidB: Child = {
  id: 2,
  name: '서연',
  colorIndex: 5 as ColorIndex,
  createdAt: ISO('2026-01-01'),
};
const kidC: Child = {
  id: 3,
  name: '도윤',
  colorIndex: 1 as ColorIndex,
  createdAt: ISO('2026-01-01'),
};
const kidsById = new Map<number, Child>([
  [1, kidA],
  [2, kidB],
  [3, kidC],
]);

function makeOccurrence(
  scheduleId: number,
  childId: number,
  endMinutes: number,
  needsPickup: boolean,
  title = '학원',
): Occurrence {
  return {
    scheduleId,
    childId,
    date: TODAY,
    startMinutes: endMinutes - 60,
    endMinutes,
    title,
    type: 'academy',
    colorIndex: 0 as ColorIndex,
    needsPickup,
  };
}

const NEVER_COMPLETE = (): boolean => false;

describe('PickupCarousel', () => {
  test('0 cards → renders null (no carousel block)', () => {
    const { toJSON } = render(
      <PickupCarousel
        occurrences={[]}
        childrenById={kidsById}
        nowMinutes={9 * 60}
        currentDate={TODAY}
        pickupLogIsComplete={NEVER_COMPLETE}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  test('1 card → renders 1 PickupCard, no dots', () => {
    const occs = [makeOccurrence(11, 1, 16 * 60, true, '수영')];
    const { getAllByText, queryByText } = render(
      <PickupCarousel
        occurrences={occs}
        childrenById={kidsById}
        nowMinutes={9 * 60}
        currentDate={TODAY}
        pickupLogIsComplete={NEVER_COMPLETE}
      />,
    );
    // The single card title row contains "민준 · 수영".
    expect(getAllByText(/민준 · 수영/).length).toBeGreaterThan(0);
    // Eyebrow renders once for the only card.
    expect(getAllByText(/NEXT PICKUP/).length).toBe(1);
    // No second card → no extra "NEXT PICKUP" eyebrow.
    expect(queryByText(/서연/)).toBeNull();
  });

  test('3 cards → renders 3 PickupCards, 3 dots', () => {
    const occs = [
      makeOccurrence(11, 1, 15 * 60, true, '수영'),
      makeOccurrence(12, 2, 16 * 60, true, '미술'),
      makeOccurrence(13, 3, 17 * 60, true, '발레'),
    ];
    const { getAllByText } = render(
      <PickupCarousel
        occurrences={occs}
        childrenById={kidsById}
        nowMinutes={9 * 60}
        currentDate={TODAY}
        pickupLogIsComplete={NEVER_COMPLETE}
      />,
    );
    // Three eyebrows = three cards rendered.
    expect(getAllByText(/NEXT PICKUP/).length).toBe(3);
    expect(getAllByText(/민준 · 수영/).length).toBe(1);
    expect(getAllByText(/서연 · 미술/).length).toBe(1);
    expect(getAllByText(/도윤 · 발레/).length).toBe(1);
  });
});
