import { View, type ViewStyle } from 'react-native';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { Text } from './Text';
import { makeStyles, useTheme } from '../appearance';

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
  tone: toneProp,
  max = 99,
  style,
}: BadgeProps): React.ReactElement {
  const theme = useTheme();
  const tone = toneProp ?? theme.t.danger;
  const styles = useStyles();
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
        color={theme.t.surface}
        style={styles.count}
      >
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((th) => ({
  count: { lineHeight: 14, textAlign: 'center', includeFontPadding: false },
}));
