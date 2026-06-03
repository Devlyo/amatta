// TODO: Pretendard font is not loaded yet — UI falls back to system font.
// Wire `expo-font` Pretendard load in a follow-up (see docs/design/README.md §4).
import type { ColorIndex } from '../domain/types';

export interface KidPalette {
  source: string; // saturated hex — dot, border, ring
  bg: string;     // block background — color-mix(in srgb, source 15%, #FFFFFF)
}

// Pre-computed 6×2 table from docs/design/README.md §3.
// Out-of-range indices throw — `colorIndex` is constrained to `ColorIndex`
// (0..5) at the type system level, so this only fires on cast/runtime drift.
const KID_PALETTE: readonly KidPalette[] = [
  { source: '#FFA9FF', bg: '#FFF2FF' }, // 0 Petunia Pink
  { source: '#C0F0AA', bg: '#F6FDF2' }, // 1 Vibrant Mint
  { source: '#D8E6FF', bg: '#F9FBFF' }, // 2 Glacier Blue
  { source: '#FFE8D2', bg: '#FFFCF8' }, // 3 Soft Peach
  { source: '#E0E446', bg: '#FAFBE3' }, // 4 Citrus Green
  { source: '#C7B0FF', bg: '#F7F3FF' }, // 5 French Lavender
] as const;

export function getKidPalette(colorIndex: ColorIndex): KidPalette {
  const entry = KID_PALETTE[colorIndex];
  if (entry === undefined) {
    throw new Error(`getKidPalette: invalid colorIndex ${String(colorIndex)}`);
  }
  return entry;
}

// amatta-v1 (docs/design/amatta-v1/app-tokens.jsx) refers to palette slots by
// named keys (peach/mint/sky/butter/citrus/lavender). Our domain uses the
// numeric ColorIndex. These helpers bridge the two without breaking the
// existing index-based API used by Phase 3/4 consumers.

export type KidPaletteKey = 'peach' | 'mint' | 'sky' | 'butter' | 'citrus' | 'lavender';

// Order matches the spec table (Petunia Pink = 0, Vibrant Mint = 1, …).
const INDEX_TO_KEY: readonly KidPaletteKey[] = [
  'peach',    // 0 Petunia Pink    #FFA9FF
  'mint',     // 1 Vibrant Mint    #C0F0AA
  'sky',      // 2 Glacier Blue    #D8E6FF
  'butter',   // 3 Soft Peach      #FFE8D2
  'citrus',   // 4 Citrus Green    #E0E446
  'lavender', // 5 French Lavender #C7B0FF
] as const;

export function paletteKeyForIndex(i: ColorIndex): KidPaletteKey {
  return INDEX_TO_KEY[i] ?? 'peach';
}

export function indexForPaletteKey(k: KidPaletteKey): ColorIndex {
  const idx = INDEX_TO_KEY.indexOf(k);
  return (idx >= 0 ? idx : 0) as ColorIndex;
}

export function getKidPaletteByKey(k: KidPaletteKey): KidPalette {
  return getKidPalette(indexForPaletteKey(k));
}

// Brand + neutral tokens. Source of truth: docs/design/README.md §2.
export const TOKENS = {
  primary: '#FF7144',
  primaryDeep: '#D8501F',
  primaryTint: '#FFE2D0',

  ink: '#1D1D1B',
  inkSub: '#7A756E',
  ink70: 'rgba(29,29,27,0.70)',
  ink50: 'rgba(29,29,27,0.50)',
  ink30: 'rgba(29,29,27,0.30)',
  ink12: 'rgba(29,29,27,0.12)',
  ink06: 'rgba(29,29,27,0.06)',
  ink04: 'rgba(29,29,27,0.04)',
  hair: '#ECEAE4',

  surface: '#FFFFFF',
  surfaceWarm: '#FAF8F2',
  surfaceSoft: '#F7F6F5',

  success: '#00C951',
  danger: '#FF4444',
  warningDot: '#FFB000',
} as const;
