import { GRID_SLOTS } from '../../src/domain/constants';
import { layoutDay } from '../../src/domain/grid';
import type { ColorIndex, ISODate, Occurrence } from '../../src/domain/types';

const DATE = '2026-06-01' as unknown as ISODate;

function occ(partial: Partial<Occurrence> & { childId: number; startMinutes: number; endMinutes: number }): Occurrence {
  return {
    scheduleId: partial.scheduleId ?? 1,
    childId: partial.childId,
    date: partial.date ?? DATE,
    startMinutes: partial.startMinutes,
    endMinutes: partial.endMinutes,
    title: partial.title ?? 'Block',
    type: partial.type ?? 'academy',
    colorIndex: (partial.colorIndex ?? 0) as ColorIndex,
    needsPickup: partial.needsPickup ?? false,
  };
}

describe('layoutDay', () => {
  test('09:00–10:00 occurrence → topSlot=6, heightSlots=2', () => {
    const blocks = layoutDay([occ({ childId: 1, startMinutes: 540, endMinutes: 600 })], [1]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.topSlot).toBe(6);
    expect(blocks[0]?.heightSlots).toBe(2);
    expect(blocks[0]?.childIdx).toBe(0);
  });

  test('sub-30-min occurrence (09:00–09:15) → heightSlots=1 (min preserved)', () => {
    const blocks = layoutDay([occ({ childId: 1, startMinutes: 540, endMinutes: 555 })], [1]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.heightSlots).toBe(1);
  });

  test('start before grid start clamps topSlot to 0', () => {
    const blocks = layoutDay(
      [occ({ childId: 1, startMinutes: 5 * 60, endMinutes: 7 * 60 })],
      [1],
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.topSlot).toBe(0);
  });

  test('end past grid end (24:30–26:00) clamps height to fit GRID_SLOTS', () => {
    // GRID now covers 06:00–25:00 (38 slots @ 30min). A block starting at
    // 24:30 sits in the last slot; an end at 26:00 (= 2 AM next-next-day in
    // raw minutes) would overflow → clamp.
    const blocks = layoutDay(
      [occ({ childId: 1, startMinutes: 24 * 60 + 30, endMinutes: 26 * 60 })],
      [1],
    );
    expect(blocks).toHaveLength(1);
    const b = blocks[0]!;
    expect(b.topSlot).toBe(37);
    expect(b.heightSlots).toBe(1);
    expect(b.topSlot + b.heightSlots).toBeLessThanOrEqual(GRID_SLOTS);
  });

  test('childIdx maps via childrenOrder', () => {
    const blocks = layoutDay(
      [
        occ({ scheduleId: 10, childId: 2, startMinutes: 540, endMinutes: 600 }),
        occ({ scheduleId: 20, childId: 4, startMinutes: 540, endMinutes: 600 }),
      ],
      [1, 2, 3, 4],
    );
    const byId = new Map(blocks.map((b) => [b.scheduleId, b.childIdx]));
    expect(byId.get(10)).toBe(1);
    expect(byId.get(20)).toBe(3);
  });

  test('unknown child is skipped (no block emitted)', () => {
    const blocks = layoutDay(
      [
        occ({ scheduleId: 10, childId: 1, startMinutes: 540, endMinutes: 600 }),
        occ({ scheduleId: 20, childId: 99, startMinutes: 540, endMinutes: 600 }),
      ],
      [1],
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.scheduleId).toBe(10);
  });

  test('empty inputs return empty array', () => {
    expect(layoutDay([], [1, 2])).toEqual([]);
    expect(layoutDay([occ({ childId: 1, startMinutes: 540, endMinutes: 600 })], [])).toEqual([]);
  });

  test('block fully past grid end is dropped (zero-height after clamp)', () => {
    // GRID_SLOTS = 38 (06:00–25:00). 26:00–26:30 has rawTop = (26*60 -
    // 6*60)/30 = 40 > 38 so heightSlots would be ≤ 0 → drop.
    const blocks = layoutDay(
      [occ({ childId: 1, startMinutes: 26 * 60, endMinutes: 26 * 60 + 30 })],
      [1],
    );
    expect(blocks).toEqual([]);
  });

  test('block carries title, colorIndex and start/end minutes through', () => {
    const blocks = layoutDay(
      [
        occ({
          scheduleId: 7,
          childId: 1,
          startMinutes: 540,
          endMinutes: 600,
          title: '수학학원',
          colorIndex: 4 as ColorIndex,
        }),
      ],
      [1],
    );
    expect(blocks[0]).toMatchObject({
      scheduleId: 7,
      title: '수학학원',
      colorIndex: 4,
      startMinutes: 540,
      endMinutes: 600,
    });
  });
});
