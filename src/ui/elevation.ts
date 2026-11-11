import type { ViewStyle } from 'react-native';
import { LIGHT_TOKENS } from './palette';

// Elevation / shadow tokens.
// Policy: cards use a `hair` border for containment, NOT a drop shadow
// (README §7 Cards: "Drop shadow 사용 금지"). Buttons have NO shadow either.
// Shadows are reserved for floating chrome — the FAB and the bottom dock.
//
// NOTE: the shipping FAB (BottomDock) is INK (#1D1D1B), not Sunset Orange, with
// an ink-tinted shadow — README §7's orange FAB was never built. The real app
// wins, so `fab` mirrors BottomDock's shadow.
//
// RN note: iOS reads shadow* props; Android reads `elevation`. We provide both.
export const ELEVATION = {
  // No shadow — the default for cards / buttons / containers.
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },

  // Floating pill bar (FloatingDock — the tab bar): 0 10px 26px rgba(0,0,0,0.10).
  dock: {
    shadowColor: LIGHT_TOKENS.shadow, // black in both schemes
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 26,
    elevation: 8,
  },

  // ADR-014: the card on top of the home 지금 stack — a soft lift so the cards
  // peeking underneath read as separate layers (iOS notification stack).
  // Owner 2026-11-11: a light shadow all around each stacked card (no offset).
  stack: {
    shadowColor: LIGHT_TOKENS.shadow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
} as const satisfies Record<string, ViewStyle>;

export type ElevationKey = keyof typeof ELEVATION;

/**
 * ADR-009: elevation for a theme — dark needs heavier shadows to read at all.
 * Use inside makeStyles: `...elevationFor(th).dock`.
 */
export function elevationFor(th: { shadowOpacity: number }): typeof ELEVATION {
  return {
    ...ELEVATION,
    dock: { ...ELEVATION.dock, shadowOpacity: Math.min(1, ELEVATION.dock.shadowOpacity * th.shadowOpacity) },
    stack: { ...ELEVATION.stack, shadowOpacity: Math.min(1, ELEVATION.stack.shadowOpacity * th.shadowOpacity) },
  } as typeof ELEVATION;
}
