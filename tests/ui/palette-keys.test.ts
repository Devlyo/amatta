import type { ColorIndex } from '../../src/domain/types';
import {
  getKidPaletteByKey,
  indexForPaletteKey,
  paletteKeyForIndex,
  type KidPaletteKey,
} from '../../src/ui/palette';

describe('paletteKeyForIndex', () => {
  test('maps 0 → peach (Petunia Pink)', () => {
    expect(paletteKeyForIndex(0)).toBe('peach');
  });

  test('maps each index to its named slot', () => {
    const expected: readonly [ColorIndex, KidPaletteKey][] = [
      [0, 'peach'],
      [1, 'mint'],
      [2, 'sky'],
      [3, 'butter'],
      [4, 'citrus'],
      [5, 'lavender'],
    ];
    for (const [i, k] of expected) {
      expect(paletteKeyForIndex(i)).toBe(k);
    }
  });
});

describe('round-trip indexForPaletteKey ∘ paletteKeyForIndex', () => {
  test('is identity for all 6 indices', () => {
    for (let i = 0 as ColorIndex; i <= 5; i = (i + 1) as ColorIndex) {
      expect(indexForPaletteKey(paletteKeyForIndex(i))).toBe(i);
      if (i === 5) break;
    }
  });
});

describe('getKidPaletteByKey', () => {
  test('peach → source #FFA9FF', () => {
    expect(getKidPaletteByKey('peach').source).toBe('#FFA9FF');
  });

  test('lavender → source #C7B0FF', () => {
    expect(getKidPaletteByKey('lavender').source).toBe('#C7B0FF');
  });

  test('mint → bg #F6FDF2', () => {
    expect(getKidPaletteByKey('mint').bg).toBe('#F6FDF2');
  });
});
