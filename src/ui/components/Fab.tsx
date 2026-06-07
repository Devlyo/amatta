import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { ELEVATION } from '../elevation';

// Design-system FAB. Source of truth: the shipping BottomDock center button.
// INK (#1D1D1B), full pill, ELEVATION.fab (ink-tinted) shadow. NOT Sunset
// Orange — README §7's orange FAB was never built. Icon-only (pass an icon as
// children). BottomDock uses diameter 44; default here 56 for standalone use.
export interface FabProps extends Omit<PressableProps, 'style' | 'children'> {
  children: React.ReactNode; // icon
  size?: number;
  style?: ViewStyle;
}

export function Fab({
  children,
  size = 56,
  disabled,
  style,
  ...rest
}: FabProps): React.ReactElement {
  const base: ViewStyle = {
    width: size,
    height: size,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...ELEVATION.fab,
  };
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        base,
        { backgroundColor: TOKENS.ink },
        pressed && disabled !== true ? { opacity: 0.85 } : null,
        disabled === true ? { opacity: 0.5 } : null,
        style ?? null,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
