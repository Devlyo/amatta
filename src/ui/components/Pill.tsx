import { Pressable, View, type ViewStyle } from 'react-native';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { Text } from './Text';

// Design-system Pill / Chip — status tags and filter chips.
// NOTE: README §7 does not table pills; sizing here is derived from the token +
// type scale and may be tuned. `solid` = filled tone, `outline` = bordered.
// Filter-chip pattern: <Pill variant={selected ? 'solid' : 'outline'} tone={TOKENS.primary} />
export type PillVariant = 'solid' | 'outline';
export type PillSize = 'sm' | 'md';

export interface PillProps {
  label: string;
  variant?: PillVariant;
  size?: PillSize;
  tone?: string; // base color (default ink)
  onPress?: () => void;
  style?: ViewStyle;
}

// Item 11: trimmed ~2px each side vs. the original (sm xxs/sm, md xs/md) so the
// chips read tighter. Composed from spacing tokens (no raw literals). Global to
// the primitive.
const PAD: Record<PillSize, { v: number; h: number }> = {
  sm: { v: 0, h: SPACING.xs + SPACING.xxs }, //  v 2→0, h 8→6
  md: { v: SPACING.xxs, h: SPACING.sm + SPACING.xxs }, // v 4→2, h 12→10
};

export function Pill({
  label,
  variant = 'solid',
  size = 'sm',
  tone = TOKENS.ink,
  onPress,
  style,
}: PillProps): React.ReactElement {
  const p = PAD[size];
  const isSolid = variant === 'solid';
  const base: ViewStyle = {
    alignSelf: 'flex-start',
    paddingVertical: p.v,
    paddingHorizontal: p.h,
    borderRadius: RADIUS.full,
    backgroundColor: isSolid ? tone : 'transparent',
    borderWidth: isSolid ? 0 : 1,
    borderColor: tone,
  };
  const content = (
    <Text variant="caption" color={isSolid ? TOKENS.surface : tone}>
      {label}
    </Text>
  );
  if (onPress !== undefined) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [base, pressed ? { opacity: 0.7 } : null, style ?? null]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{content}</View>;
}
