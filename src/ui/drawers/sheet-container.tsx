import { Platform } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

// Wraps the BottomSheetModal `containerComponent` slot so the modal renders
// inside an iOS FullWindowOverlay (top of the window above the navigation
// container). Without this, BottomSheetModal in v5 can `present()` but
// remain visually hidden when the provider sits inside expo-router's
// navigation stack. Android path is a no-op passthrough.
//
// Type adapter: react-native-screens types `FullWindowOverlay` as requiring
// a non-optional `children` prop, but bottom-sheet's `containerComponent`
// expects `ComponentType<{ children?: ReactNode }>` (optional). This
// component sits between them with the relaxed signature.
function IosSheetContainer({ children }: { children?: React.ReactNode }): React.ReactElement {
  if (Platform.OS !== 'ios') return <>{children}</>;
  return <FullWindowOverlay>{children}</FullWindowOverlay>;
}

export const SHEET_CONTAINER = IosSheetContainer;
