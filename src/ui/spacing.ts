// Spacing scale — 4px grid.
// README §7 has no explicit spacing table; this is the agreed canonical scale
// (Clean 4px grid). Button padding `12px 20px` (README §7) = md × xl.
// Use these instead of raw numeric literals for padding/margin/gap so spacing
// stays on a single rhythm. Existing 10/14 literals are migrated to 12/16 in a
// follow-up pass (see Step 2 migration).
export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export type SpacingKey = keyof typeof SPACING;
