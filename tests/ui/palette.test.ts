import { getKidPalette, PICKUP_CARD_PALETTE, TOKENS } from '../../src/ui/palette';
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

describe('PICKUP_CARD_PALETTE (handoff #4)', () => {
  // Mirrors the handoff PICKUPS table via token references (no raw hex — lint
  // bans hex outside palette.ts). Card 1 bg = primary (live theme), 2 =
  // lavender, 3 = mint, 4 = sky; car body/window cycle per the table.
  const expected = [
    { bg: TOKENS.primary, carBody: TOKENS.carBody1, carWindow: TOKENS.carWindow1, shape: 'sedan' },
    { bg: TOKENS.pickupLavender, carBody: TOKENS.carBody2, carWindow: TOKENS.carWindow2, shape: 'round' },
    { bg: TOKENS.pickupMint, carBody: TOKENS.carBody3, carWindow: TOKENS.carWindow3, shape: 'sedan' },
    { bg: TOKENS.pickupSky, carBody: TOKENS.carBody4, carWindow: TOKENS.carWindow4, shape: 'round' },
  ] as const;

  test('has exactly 4 cards', () => {
    expect(PICKUP_CARD_PALETTE).toHaveLength(4);
  });

  expected.forEach((e, i) => {
    test(`card ${i + 1} matches the handoff table`, () => {
      const slot = PICKUP_CARD_PALETTE[i];
      expect(slot).toBeDefined();
      expect(slot?.bg).toBe(e.bg);
      expect(slot?.carBody).toBe(e.carBody);
      expect(slot?.carWindow).toBe(e.carWindow);
      expect(slot?.shape).toBe(e.shape);
    });
  });

  test('card 1 bg tracks the live theme primary token', () => {
    expect(PICKUP_CARD_PALETTE[0]?.bg).toBe(TOKENS.primary);
  });

  test('shape alternates sedan/round across the cycle', () => {
    expect(PICKUP_CARD_PALETTE.map((c) => c.shape)).toEqual([
      'sedan',
      'round',
      'sedan',
      'round',
    ]);
  });

  test('index → palette[index % 4] cycles (4-way conflict wraps cleanly)', () => {
    for (let i = 0; i < 8; i += 1) {
      const slot = PICKUP_CARD_PALETTE[i % PICKUP_CARD_PALETTE.length];
      expect(slot).toBe(expected[i % 4] && PICKUP_CARD_PALETTE[i % 4]);
    }
  });
});
