import { getKidPalette, TOKENS } from '../../src/ui/palette';
import type { ColorIndex } from '../../src/domain/types';

describe('getKidPalette', () => {
  const expected: { idx: ColorIndex; source: string; bg: string }[] = [
    { idx: 0, source: '#FFA9FF', bg: '#FFF2FF' },
    { idx: 1, source: '#C0F0AA', bg: '#F6FDF2' },
    { idx: 2, source: '#D8E6FF', bg: '#F9FBFF' },
    { idx: 3, source: '#FFE8D2', bg: '#FFFCF8' },
    { idx: 4, source: '#E0E446', bg: '#FAFBE3' },
    { idx: 5, source: '#C7B0FF', bg: '#F7F3FF' },
  ];

  for (const e of expected) {
    test(`returns correct entry for colorIndex ${e.idx}`, () => {
      const got = getKidPalette(e.idx);
      expect(got.source).toBe(e.source);
      expect(got.bg).toBe(e.bg);
    });
  }

  test('throws on out-of-range index (runtime drift defense)', () => {
    // Cast: TypeScript would reject `9 as ColorIndex` without a cast — this
    // models runtime data drift (e.g., a corrupted color_index in SQLite).
    expect(() => getKidPalette(9 as unknown as ColorIndex)).toThrow();
  });
});

describe('TOKENS', () => {
  test('exposes Sunset Orange as primary', () => {
    expect(TOKENS.primary).toBe('#FF7144');
    expect(TOKENS.primaryDeep).toBe('#D8501F');
  });

  test('ink scale opacity tokens are well-formed rgba', () => {
    expect(TOKENS.ink).toBe('#1D1D1B');
    expect(TOKENS.ink12).toMatch(/^rgba\(29,29,27,0\.12\)$/);
    expect(TOKENS.ink06).toMatch(/^rgba\(29,29,27,0\.06\)$/);
  });
});
