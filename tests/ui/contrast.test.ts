// Contrast regression (report 2026-11-12): the fixed pairs stay at WCAG AA.
// Text 4.5:1, non-text (bars, borders) 3:1 — light and dark.
import { DARK_TOKENS, LIGHT_TOKENS, getKidPaletteFor } from '../../src/ui/palette';
import type { ColorIndex } from '../../src/domain/types';

const rgb = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const over = (fg: string, a: number, bg: string): string =>
  '#' + rgb(fg).map((x, i) => Math.round(a * x + (1 - a) * (rgb(bg)[i] as number)).toString(16).padStart(2, '0')).join('');
const lum = (h: string): number => {
  const c = rgb(h).map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
};
const ratio = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};
const ONLIGHT = '#1D1D1B';

describe.each([
  ['light', LIGHT_TOKENS, 0.45, 'light' as const],
  ['dark', DARK_TOKENS, 0.7, 'dark' as const],
])('%s', (_n, T, fill, scheme) => {
  test('text on surfaces', () => {
    expect(ratio(T.danger, T.surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(T.inkSub, T.groupedBg)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(T.inkSub, T.surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(T.primaryDeep, T.groupedBg)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(T.warnText, T.primaryTint)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(ONLIGHT, T.primary)).toBeGreaterThanOrEqual(4.5); // NOW pill
  });
  test('kid block bars ≥ 3:1 on their fill', () => {
    for (let i = 0; i < 6; i++) {
      const p = getKidPaletteFor(i as ColorIndex, scheme);
      expect(ratio(p.bar, over(p.source, fill, T.surface))).toBeGreaterThanOrEqual(3);
    }
  });
  test('home 지금 card secondary text ≥ 4.5:1', () => {
    for (let i = 0; i < 6; i++) {
      const p = getKidPaletteFor(i as ColorIndex, scheme);
      const card = scheme === 'dark' ? over(p.source, 0.7, T.surface) : over(p.deep, 0.18, p.source);
      const a = scheme === 'dark' ? 0.9 : 0.75;
      expect(ratio(over(ONLIGHT, a, card), card)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

test('light filter pill borders (bar) ≥ 3:1 on white', () => {
  for (let i = 0; i < 6; i++) {
    expect(ratio(getKidPaletteFor(i as ColorIndex, 'light').bar, LIGHT_TOKENS.surface)).toBeGreaterThanOrEqual(3);
  }
});
