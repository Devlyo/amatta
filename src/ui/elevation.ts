import type { ViewStyle } from 'react-native';
import { TOKENS } from './palette';

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

  // FAB (BottomDock center button): 0 4px 10px rgba(29,29,27,0.25), ink-tinted.
  fab: {
    shadowColor: TOKENS.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },

  // Floating pill bar (BottomDock wrapper): 0 10px 26px rgba(0,0,0,0.10).
  dock: {
    shadowColor: TOKENS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 26,
    elevation: 8,
  },
} as const satisfies Record<string, ViewStyle>;

export type ElevationKey = keyof typeof ELEVATION;
