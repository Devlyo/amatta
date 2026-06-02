// Tests for layoutWeek — extends the Phase 1 grid tests for the weekly view.

import { GRID_SLOTS } from '../../src/domain/constants';
import { layoutWeek } from '../../src/domain/grid';
import type { ColorIndex, ISODate, Occurrence } from '../../src/domain/types';

const iso = (s: string): ISODate => s as unknown as ISODate;

function occ(
  partial: Partial<Occurrence> & {
    childId: number;
    date: ISODate;
    startMinutes: number;
    endMinutes: number;
  },
): Occurrence {
  return {
    scheduleId: partial.scheduleId ?? 1,
    childId: partial.childId,
    date: partial.date,
    startMinutes: partial.startMinutes,
    endMinutes: partial.endMinutes,
    title: partial.title ?? 'Block',
    type: partial.type ?? 'academy',
    colorIndex: (partial.colorIndex ?? 0) as ColorIndex,
    needsPickup: partial.needsPickup ?? false,
  };
}

// Mon..Sun: 2026-06-01 .. 2026-06-07
const WEEK = [
  iso('2026-06-01'),
  iso('2026-06-02'),
  iso('2026-06-03'),
  iso('2026-06-04'),
  iso('2026-06-05'),
  iso('2026-06-06'),
  iso('2026-06-07'),
];

describe('layoutWeek', () => {
  test('empty inputs return empty array', () => {
    expect(layoutWeek([], WEEK)).toEqual([]);
  });

  test('places block on the correct dayIdx', () => {
    const blocks = layoutWeek(
      [
        occ({ scheduleId: 1, childId: 10, date: iso('2026-06-03'), startMinutes: 540, endMinutes: 600 }),
      ],
      WEEK,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.dayIdx).toBe(2); // Wed
    expect(blocks[0]?.topSlot).toBe(6);
    expect(blocks[0]?.heightSlots).toBe(2);
  });

  test('drops occurrences whose date is not in weekDates', () => {
    const blocks = layoutWeek(
      [
        occ({ childId: 10, date: iso('2026-05-30'), startMinutes: 540, endMinutes: 600 }),
        occ({ childId: 10, date: iso('2026-06-08'), startMinutes: 540, endMinutes: 600 }),
        occ({ scheduleId: 9, childId: 10, date: iso('2026-06-02'), startMinutes: 540, endMinutes: 600 }),
      ],
      WEEK,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.scheduleId).toBe(9);
  });

  test('multiple occurrences span 7 columns', () => {
    const blocks = layoutWeek(
      WEEK.map((d, i) =>
        occ({
          scheduleId: i + 1,
          childId: 1,
          date: d,
          startMinutes: 9 * 60,
          endMinutes: 10 * 60,
        }),
      ),
      WEEK,
    );
    expect(blocks.map((b) => b.dayIdx).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test('clamps overflow past GRID_SLOTS', () => {
    // GRID now covers 06:00–25:00 (38 slots). Use a block well past 25:00
    // (24:30–26:00) so the overflow clamp still fires under the new range.
    const blocks = layoutWeek(
      [
        occ({
          childId: 1,
          date: iso('2026-06-04'),
          startMinutes: 24 * 60 + 30,
          endMinutes: 26 * 60,
        }),
      ],
      WEEK,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.topSlot).toBe(37);
    expect(blocks[0]?.heightSlots).toBe(1);
    expect((blocks[0]?.topSlot ?? 0) + (blocks[0]?.heightSlots ?? 0)).toBeLessThanOrEqual(
      GRID_SLOTS,
    );
  });

  test('preserves sub-30min slivers at heightSlots=1', () => {
    const blocks = layoutWeek(
      [occ({ childId: 1, date: iso('2026-06-02'), startMinutes: 540, endMinutes: 555 })],
      WEEK,
    );
    expect(blocks[0]?.heightSlots).toBe(1);
  });

  test('preserves title and colorIndex through the layout', () => {
    const blocks = layoutWeek(
      [
        occ({
          scheduleId: 7,
          childId: 1,
          date: iso('2026-06-02'),
          startMinutes: 540,
          endMinutes: 600,
          title: '수학',
          colorIndex: 4 as ColorIndex,
        }),
      ],
      WEEK,
    );
    expect(blocks[0]).toMatchObject({
      scheduleId: 7,
      title: '수학',
      colorIndex: 4,
      date: iso('2026-06-02'),
    });
  });
});
