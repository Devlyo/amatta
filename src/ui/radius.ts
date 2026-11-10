// Border-radius scale. Source of truth: docs/design/README.md §8.
// `full` (9999) is the single canonical pill value — do not use 99 / 99999.
// ADR-007: `box` (14) is the app-wide default for cards / grouped boxes.
// Existing 14 literals fold into `box`, 18 into `lg` (Phase 7 sweep).
export const RADIUS = {
  xs: 6, // tag, micro pill
  sm: 8, // schedule block
  md: 12, // button, input
  box: 14, // ADR-007 default card / grouped list box
  lg: 16, // sheet top corners
  card: 22, // ADR-014: home cards (지금 stack, 준비물, 할 일) — iOS widget feel
  xl: 24, // bottom sheet top
  full: 9999, // FAB, avatar ring, status pill
} as const;

export type RadiusKey = keyof typeof RADIUS;
