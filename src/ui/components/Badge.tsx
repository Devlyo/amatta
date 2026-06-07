import { StyleSheet, View, type ViewStyle } from 'react-native';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { Text } from './Text';

// Design-system Badge — count bubble or status dot.
// NOTE: not tabled in README §7; derived from tokens. `dot` renders the 6px
// status marker (README §6 warning-dot pattern). Default tone danger.
export interface BadgeProps {
  count?: number;
  dot?: boolean;
  tone?: string;
  max?: number; // cap, e.g. 99 -> "99+"
  style?: ViewStyle;
}

export function Badge({
  count,
  dot = false,
  tone = TOKENS.danger,
  max = 99,
  style,
}: BadgeProps): React.ReactElement {
  if (dot) {
    const d: ViewStyle = {
      width: SPACING.sm,
      height: SPACING.sm,
      borderRadius: RADIUS.full,
      backgroundColor: tone,
    };
    return <View style={[d, style]} />;
  }
  const n = count ?? 0;
  const text = n > max ? `${max}+` : String(n);
  const base: ViewStyle = {
    minWidth: SPACING.xl,
    height: SPACING.xl,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: tone,
    alignItems: 'center',
    justifyContent: 'center',
  };
  return (
    <View style={[base, style]}>
      {/* lineHeight tightened to the box + includeFontPadding off so the digits
          sit dead-center (caption's 17px line-height otherwise floats high). */}
      <Text
        variant="caption"
        color={TOKENS.surface}
        style={styles.count}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  count: { lineHeight: 14, textAlign: 'center', includeFontPadding: false },
});
