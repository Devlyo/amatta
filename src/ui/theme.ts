// Design-system barrel — single import surface for all foundation tokens.
// Source of truth for VALUES: docs/design/README.md (§2 color, §4 type,
// §7 components, §8 radius) + 4px spacing grid.
//
// New code should import tokens from here (relative, matching existing style):
//   import { TOKENS, TYPE, SPACING, RADIUS, ELEVATION } from '../theme';
// (tsconfig `@/*` → `./*`, so `@/src/ui/theme` also resolves if you prefer.)
//
// Do NOT hand-write color hexes, font sizes, radii, or padding numbers in
// components — reach for a token. If a value you need isn't here, it belongs
// in the scale (extend the relevant file), not inline.

// Color + kid palette (src/ui/palette.ts)
export {
  TOKENS,
  getKidPalette,
  getKidPaletteByKey,
  paletteKeyForIndex,
  indexForPaletteKey,
} from './palette';
export type { KidPalette, KidPaletteKey } from './palette';

// Font families (src/ui/fonts.ts)
export { FONT_FAMILIES } from './fonts';
export type { FontFamilyKey } from './fonts';

// Typography presets (src/ui/typography.ts)
export { TYPE } from './typography';
export type { TypeKey } from './typography';

// Spacing scale (src/ui/spacing.ts)
export { SPACING } from './spacing';
export type { SpacingKey } from './spacing';

// Radius scale (src/ui/radius.ts)
export { RADIUS } from './radius';
export type { RadiusKey } from './radius';

// Elevation / shadow (src/ui/elevation.ts)
export { ELEVATION } from './elevation';
export type { ElevationKey } from './elevation';
