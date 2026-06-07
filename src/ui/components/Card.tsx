import { View, type ViewProps, type ViewStyle } from 'react-native';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING, type SpacingKey } from '../spacing';

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
  const base: ViewStyle = {
    backgroundColor: variant === 'warm' ? TOKENS.surfaceWarm : TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.hair,
    borderRadius: RADIUS.lg,
    padding: SPACING[padding],
  };
  return <View style={[base, style]} {...rest} />;
}
