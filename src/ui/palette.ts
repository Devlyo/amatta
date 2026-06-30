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

  // Control surfaces — from the shipping new-schedule form (ScheduleEditSheet)
  // + BottomDock. These near-neutral grays were inline literals; promoted to
  // tokens so selectable chips / toggles / day-circles share one source.
  // NOTE: `controlActive` (#2A2A29) is a hair lighter than `ink` (#1D1D1B) —
  // the app uses BOTH as "near-black". Flagged for possible unification.
  controlIdle: '#EBEAE9', // chip / day-circle idle background
  controlActive: '#2A2A29', // selected chip / toggle-on / day-circle active
  switchOff: '#D6D8DD', // toggle track when off

  // NOW line (ADR-003) — distinct lime indicator. Near but NOT citrus (#E0E446);
  // kept as its own semantic so the two don't drift into each other.
  nowLine: '#E0E345',
  // Saturday tint in calendar / weekly day headers (Sunday uses `danger`).
  saturday: '#3F66D8',
  // Pickup carousel alternate card background (lavender), pairs with `primary`.
  pickupLavender: '#D4B4FA',
  // Pickup carousel cards 3 & 4 backgrounds (handoff #4 PICKUPS table). Cards 1
  // & 2 reuse `primary` / `pickupLavender`; these two complete the 4-color cycle.
  pickupMint: '#A5DC85', // card 3 bg
  pickupSky: '#A9C8F5', // card 4 bg

  // CartoonCar fill colors per pickup card (handoff #4). Each card threads a
  // body/window pair into the SVG; wheel is shared `ink`, hub = body, shine =
  // `carShine`. Literal hexes live here (token group) so call sites stay clean.
  carBody1: '#FFF4E5', // card 1 (primary/orange) body
  carWindow1: '#FFD8C2', // card 1 window
  carBody2: '#FFFFFF', // card 2 (lavender) body
  carWindow2: '#E8F2C9', // card 2 window
  carBody3: '#FFFFFF', // card 3 (mint) body
  carWindow3: '#FFE2D0', // card 3 window
  carBody4: '#FFFFFF', // card 4 (sky) body
  carWindow4: '#FFF0C2', // card 4 window
  carWheel: '#1D1D1B', // shared tire color (= ink)
  carShine: 'rgba(255,255,255,0.92)', // headlight glint (handoff 0.9~0.95)

  // Pure black — drop-shadow color ONLY (never a UI surface/text color).
  shadow: '#000000',
} as const;

// Pickup carousel card spec (handoff #4). Index → palette[index % 4]; shape
// alternates sedan/round. Card 1 follows the live app theme `primary` at the
// call site (PickupCard substitutes TOKENS.primary), the rest keep their bg.
// Colors are token references — no raw literals here or at the call site.
export interface PickupCardPalette {
  bg: string;
  carBody: string;
  carWindow: string;
  shape: 'sedan' | 'round';
}

export const PICKUP_CARD_PALETTE: readonly PickupCardPalette[] = [
  { bg: TOKENS.primary, carBody: TOKENS.carBody1, carWindow: TOKENS.carWindow1, shape: 'sedan' },
  { bg: TOKENS.pickupLavender, carBody: TOKENS.carBody2, carWindow: TOKENS.carWindow2, shape: 'round' },
  { bg: TOKENS.pickupMint, carBody: TOKENS.carBody3, carWindow: TOKENS.carWindow3, shape: 'sedan' },
  { bg: TOKENS.pickupSky, carBody: TOKENS.carBody4, carWindow: TOKENS.carWindow4, shape: 'round' },
] as const;
