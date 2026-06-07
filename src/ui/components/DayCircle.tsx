import { Pressable, type ViewStyle } from 'react-native';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { Text } from './Text';

// Circular day toggle (반복 요일 picker). Source of truth: ScheduleEditSheet
// `DayCircle` (md = 28). Idle controlIdle / active controlActive.
export type DayCircleSize = 'sm' | 'md' | 'lg';

const DIAMETER: Record<DayCircleSize, number> = { sm: 24, md: 28, lg: 32 };

export interface DayCircleProps {
  label: string;
  active?: boolean;
  size?: DayCircleSize;
  onPress?: () => void;
  style?: ViewStyle;
}

export function DayCircle({
  label,
  active = false,
  size = 'md',
  onPress,
  style,
}: DayCircleProps): React.ReactElement {
  const d = DIAMETER[size];
  const base: ViewStyle = {
    width: d,
    height: d,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: active ? TOKENS.controlActive : TOKENS.controlIdle,
  };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`요일 ${label}`}
      accessibilityState={{ selected: active }}
      style={[base, style]}
    >
      <Text variant="caption" color={active ? TOKENS.surface : TOKENS.inkSub}>
        {label}
      </Text>
    </Pressable>
  );
}
