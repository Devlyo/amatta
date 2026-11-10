import { View, type ViewProps, type ViewStyle } from 'react-native';
import { RADIUS } from '../radius';
import { SPACING, type SpacingKey } from '../spacing';
import { useTheme } from '../appearance';

// Design-system Card. Source of truth: README §7 (Cards).
// Containment is a `hair` border + radius lg — NO drop shadow ("Drop shadow
// 사용 금지"). `warm` lifts the surface to surface-warm for paper feel.
export type CardVariant = 'plain' | 'warm';

export interface CardProps extends ViewProps {
  variant?: CardVariant;
  padding?: SpacingKey; // inner padding token (default lg)
  style?: ViewStyle;
}

export function Card({
  variant = 'plain',
  padding = 'lg',
  style,
  ...rest
}: CardProps): React.ReactElement {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor: variant === 'warm' ? theme.t.surfaceWarm : theme.t.surface,
    borderWidth: 1,
    borderColor: theme.t.hair,
    borderRadius: RADIUS.lg,
    padding: SPACING[padding],
  };
  return <View style={[base, style]} {...rest} />;
}
