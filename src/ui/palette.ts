// TODO: Pretendard font is not loaded yet — UI falls back to system font.
// Wire `expo-font` Pretendard load in a follow-up (see docs/design/README.md §4).
import type { ColorIndex } from '../domain/types';

export interface KidPalette {
  source: string; // saturated hex — dot, border, ring; ADR-007 block fill (with alpha)
  bg: string;     // block background — color-mix(in srgb, source 15%, #FFFFFF)
  // ADR-007: darker tone of the same hue — time-block side bar (1.5px), kid
  // filter pill border, color dots. Must stay readable on white and on the
  // 60% source fill.
  deep: string;
  /** Side bar ON the block fill (time blocks, week bars, 지금 cards). Light =
   *  `deep`; dark = a darker tone — the dark fill is bright, and the lighter
   *  dark `deep` (made for dark backgrounds) vanished on it (2026-11-11). */
  bar: string;
}

// Pre-computed 6×2 table from docs/design/README.md §3.
// Out-of-range indices throw — `colorIndex` is constrained to `ColorIndex`
// (0..5) at the type system level, so this only fires on cast/runtime drift.
// `deep` for 0/4/5 is the value signed off on the ADR-007 design canvas; 1/2/3
// are provisional (ADR-007 OQ4) — same rule, confirm on device.
const KID_PALETTE: readonly KidPalette[] = [
  { source: '#FFA9FF', bg: '#FFF2FF', deep: '#D957D9', bar: '#A341A3' }, // 0 Petunia Pink
  { source: '#C0F0AA', bg: '#F6FDF2', deep: '#5E9E40', bar: '#467630' }, // 1 Vibrant Mint (provisional deep)
  { source: '#D8E6FF', bg: '#F9FBFF', deep: '#6C8FD9', bar: '#516BA3' }, // 2 Glacier Blue (provisional deep)
  { source: '#FFE8D2', bg: '#FFFCF8', deep: '#B87A40', bar: '#8A5C30' }, // 3 Soft Peach (provisional deep)
  { source: '#E0E446', bg: '#FAFBE3', deep: '#A8AD12', bar: '#7E820E' }, // 4 Citrus Green
  { source: '#C7B0FF', bg: '#F7F3FF', deep: '#8E6BE8', bar: '#6A50AE' }, // 5 French Lavender
] as const;

// ADR-009 dark: same `source` (blocks stay vivid), `bg` = source 15% over
// the dark surface, `deep` one step lighter so bars / borders read on dark.
// Values from the design canvas board "D 다크 모드 색 목록".
const KID_PALETTE_DARK: readonly KidPalette[] = [
  { source: '#FFA9FF', bg: '#473944', deep: '#F08BF0', bar: '#5E175E' },
  { source: '#C0F0AA', bg: '#3E4337', deep: '#8FD46F', bar: '#224612' },
  { source: '#D8E6FF', bg: '#424244', deep: '#9DB8F2', bar: '#20386B' },
  { source: '#FFE8D2', bg: '#47423D', deep: '#E0A86E', bar: '#522F0E' },
  { source: '#E0E446', bg: '#434228', deep: '#D3D84A', bar: '#414400' },
  { source: '#C7B0FF', bg: '#3F3A44', deep: '#B39CFF', bar: '#331A78' },
] as const;

// Contrast pass 2026-11-12: `bar` = deep (light) / dark bar darkened 25% — ≥3:1 on the block fill.

/** Kid palette for a colour scheme (ADR-009). */
export function getKidPaletteFor(colorIndex: ColorIndex, scheme: 'light' | 'dark'): KidPalette {
  const entry = (scheme === 'dark' ? KID_PALETTE_DARK : KID_PALETTE)[colorIndex];
  if (entry === undefined) {
    throw new Error(`getKidPalette: invalid colorIndex ${String(colorIndex)}`);
  }
  return entry;
}

export function getKidPalette(colorIndex: ColorIndex): KidPalette {
  const entry = KID_PALETTE[colorIndex];
  if (entry === undefined) {
    throw new Error(`getKidPalette: invalid colorIndex ${String(colorIndex)}`);
  }
  return entry;
}

/**
 * ADR-007 alpha fill: a kid's (or the guardian's) `source` colour at `alpha`
 * opacity, for time blocks (0.6), focused-kid blocks (0.8) and filter pills
 * (0.25). Alpha is always applied to `source`, never composited onto `bg`.
 */
/** Opaque blend a→b by t (0..1) of two `#RRGGBB` colours. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ch = (shift: number): string => {
    const x = (pa >> shift) & 255;
    const y = (pb >> shift) & 255;
    return Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`.toUpperCase();
}

export function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function kidFill(colorIndex: ColorIndex, alpha: number): string {
  return withAlpha(getKidPalette(colorIndex).source, alpha);
}

// Brand + neutral tokens. Source of truth: docs/design/README.md §2.
// Light theme values (ADR-009). Read colours through the theme
// (useTheme / makeStyles in ./appearance), never this table directly.
const LIGHT = {
  primary: '#FF7144',
  // Contrast pass 2026-11-12 (report 4gwiy7su): #D8501F → #B8431A (4.8:1 on groupedBg).
  primaryDeep: '#B8431A',
  primaryTint: '#FFE2D0',
  // Home "다음 픽업" clash line (design board "0 홈") — dark orange text.
  pickupWarn: '#B8431A',

  ink: '#1D1D1B',
  inkSub: '#6B665F', // contrast pass: #7A756E was 4.05:1 on groupedBg
  ink70: 'rgba(29,29,27,0.70)',
  ink50: 'rgba(29,29,27,0.50)',
  ink30: 'rgba(29,29,27,0.30)',
  ink12: 'rgba(29,29,27,0.12)',
  // Row separators in grouped lists (home, settings, forms) — a touch
  // darker than ink12 (owner, 2026-11-10).
  separator: 'rgba(29,29,27,0.2)',
  ink06: 'rgba(29,29,27,0.06)',
  ink04: 'rgba(29,29,27,0.04)',
  hair: '#ECEAE4',
  // Calendar grid lines (hour rows, day rules, month cells) — a step stronger
  // than `hair` in both schemes so the hairlines read on the surface.
  gridLine: '#DCD9D2',

  surface: '#FFFFFF',
  surfaceWarm: '#FAF8F2',
  surfaceSoft: '#F7F6F5', // legacy settings background — folds into groupedBg (ADR-007 Phase 7)
  // ADR-007 §7-1: shared background for system screens (settings, detail,
  // pickers, new-event form) under white grouped boxes (RADIUS.box).
  groupedBg: '#F2F1EF',
  // ADR-007: Sunday text + the red "+" (new event) and form actions. Distinct
  // from `danger` (#FF4444), which stays for destructive actions.
  sunday: '#D93636',
  // ADR-007 §9: guardian (iPhone Calendar) events — neutral grey pair, used
  // like a kid palette entry (fill with alpha, deep for bars/borders).
  guardian: '#E4E2DD',
  guardianDeep: '#8E8A83',

  success: '#00C951',
  danger: '#C8302B', // contrast pass: #FF4444 was 3.4:1 on white
  warningDot: '#FFB000',

  // Control surfaces — from the shipping new-schedule form (ScheduleEditSheet)
  // + the old BottomDock. These near-neutral grays were inline literals; promoted to
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

  // ADR-009: text on a coloured fill — the SAME in both schemes (never flip
  // with the theme): dark text on light fills (kid blocks, light pickup
  // cards), white on strong fills (orange pills, guardian blocks in dark).
  onLight: '#1D1D1B',
  onDark: '#FFFFFF',
  // Board H1 (home 지금 stack): pills / progress track sitting ON a kid fill —
  // same in both schemes, like onLight.
  surfaceOnFill: 'rgba(255,255,255,0.92)',
  surfaceOnFillMuted: 'rgba(255,255,255,0.55)',
  // Warning text on primaryTint (share screen) — 5.3:1.
  warnText: '#B3261E',
  // ADR-014: tint over the dock blur (translucent dock); solid surface without blur.
  dockTint: 'rgba(255,255,255,0.55)',
} as const;

export type TokenName = keyof typeof LIGHT;
/** The light values (for the theme module, the palette tests and fixed-colour helpers). */
export const LIGHT_TOKENS: Readonly<Record<TokenName, string>> = LIGHT;

/**
 * ADR-009 dark values — every light token has one (the Record type makes a
 * missing key a compile error). From the design canvas "D 다크 모드 색 목록".
 */
export const DARK_TOKENS: Readonly<Record<TokenName, string>> = {
  primary: '#FF7144',
  primaryDeep: '#FF9566',
  primaryTint: '#4A2C20',
  pickupWarn: '#FF9A70',

  ink: '#F2F1EF',
  inkSub: '#A39D94',
  ink70: 'rgba(242,241,239,0.70)',
  ink50: 'rgba(242,241,239,0.50)',
  ink30: 'rgba(242,241,239,0.30)',
  ink12: 'rgba(242,241,239,0.12)',
  separator: 'rgba(242,241,239,0.14)',
  ink06: 'rgba(242,241,239,0.08)',
  ink04: 'rgba(242,241,239,0.06)',
  hair: '#34322F',
  gridLine: '#4A4743',

  surface: '#272523',
  surfaceWarm: '#2B2926',
  surfaceSoft: '#1A1917',
  groupedBg: '#1A1917',
  sunday: '#FF6B5E',
  guardian: '#5A5751',
  guardianDeep: '#A8A49D',

  success: '#34D46C',
  danger: '#FF6B5E',
  warningDot: '#FFC233',

  controlIdle: '#34322F',
  controlActive: '#F2F1EF', // selected chip flips light (its text = surface → dark)
  switchOff: '#4A4743',

  nowLine: '#E0E345',
  saturday: '#7C9BFF',
  // Pickup cards and the car illustration keep their colours in dark.
  pickupLavender: '#D4B4FA',
  pickupMint: '#A5DC85',
  pickupSky: '#A9C8F5',
  carBody1: '#FFF4E5',
  carWindow1: '#FFD8C2',
  carBody2: '#FFFFFF',
  carWindow2: '#E8F2C9',
  carBody3: '#FFFFFF',
  carWindow3: '#FFE2D0',
  carBody4: '#FFFFFF',
  carWindow4: '#FFF0C2',
  carWheel: '#1D1D1B',
  carShine: 'rgba(255,255,255,0.92)',

  shadow: '#000000',
  onLight: '#1D1D1B',
  onDark: '#FFFFFF',
  surfaceOnFill: 'rgba(255,255,255,0.92)',
  surfaceOnFillMuted: 'rgba(255,255,255,0.55)',
  warnText: '#FF8577',
  // Contrast pass: a lighter frosted tint so the dock lifts off the dark page.
  dockTint: 'rgba(64,61,57,0.78)',
};

// Pickup carousel card spec (handoff #4). Index → palette[index % 4]; shape
// alternates sedan/round. Card 1 follows the live app theme `primary` at the
// call site (PickupCard substitutes LIGHT.primary), the rest keep their bg.
// Colors are token references — no raw literals here or at the call site.
export interface PickupCardPalette {
  bg: string;
  carBody: string;
  carWindow: string;
  shape: 'sedan' | 'round';
}

export const PICKUP_CARD_PALETTE: readonly PickupCardPalette[] = [
  { bg: LIGHT.primary, carBody: LIGHT.carBody1, carWindow: LIGHT.carWindow1, shape: 'sedan' },
  { bg: LIGHT.pickupLavender, carBody: LIGHT.carBody2, carWindow: LIGHT.carWindow2, shape: 'round' },
  { bg: LIGHT.pickupMint, carBody: LIGHT.carBody3, carWindow: LIGHT.carWindow3, shape: 'sedan' },
  { bg: LIGHT.pickupSky, carBody: LIGHT.carBody4, carWindow: LIGHT.carWindow4, shape: 'round' },
] as const;
