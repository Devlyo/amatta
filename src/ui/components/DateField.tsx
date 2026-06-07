import { Pressable, type ViewStyle } from 'react-native';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { IconChevronDown } from '../icons';
import { Text } from './Text';
import type { TypeKey } from '../typography';

// Tappable date/time field. Source of truth: ScheduleEditSheet `NativeField`
// (bg ink04, radius 8, chevron-down). Opens the OS picker via onPress. Display
// only — the caller owns the picker + formatting.
export type DateFieldSize = 'md' | 'lg';

const SIZE: Record<DateFieldSize, { padV: number; padH: number; label: TypeKey }> = {
  md: { padV: 6, padH: 10, label: 'body' }, // = ScheduleEditSheet nativeField
  lg: { padV: 8, padH: 12, label: 'bodyL' },
};

export interface DateFieldProps {
  displayText: string;
  onPress: () => void;
  size?: DateFieldSize;
  ariaLabel?: string;
  style?: ViewStyle;
}

export function DateField({
  displayText,
  onPress,
  size = 'md',
  ariaLabel,
  style,
}: DateFieldProps): React.ReactElement {
  const s = SIZE[size];
  const base: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: s.padV,
    paddingHorizontal: s.padH,
    borderRadius: RADIUS.sm,
    backgroundColor: TOKENS.ink04,
  };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={ariaLabel}
      hitSlop={12}
      style={({ pressed }) => [base, pressed ? { opacity: 0.6 } : null, style ?? null]}
    >
      <Text variant={s.label} color={TOKENS.ink}>
        {displayText}
      </Text>
      <IconChevronDown size={14} color={TOKENS.inkSub} />
    </Pressable>
  );
}
