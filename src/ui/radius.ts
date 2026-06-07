// Border-radius scale. Source of truth: docs/design/README.md §8.
// `full` (9999) is the single canonical pill value — do not use 99 / 99999.
// Existing 14/18 literals fold into md(12)/lg(16) during Step 2 migration.
export const RADIUS = {
  xs: 6, // tag, micro pill
  sm: 8, // schedule block
  md: 12, // button, input
  lg: 16, // card, sheet handle
  xl: 24, // bottom sheet top
  full: 9999, // FAB, avatar ring, status pill
} as const;

export type RadiusKey = keyof typeof RADIUS;
