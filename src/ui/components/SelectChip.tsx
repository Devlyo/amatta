import { Pressable, type ViewStyle } from 'react-native';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { Text } from './Text';
import type { TypeKey } from '../typography';

// Selectable chip / segmented option. Source of truth: ScheduleEditSheet `Pill`
// (종류 / 알림 options). Idle = controlIdle gray, active = controlActive
// near-black with white label. Distinct from `Pill` (status tag, tone-tinted).
// Padding values mirror the shipping form (md) with sm/lg derived around it.
export type SelectChipSize = 'sm' | 'md' | 'lg';

// Item 11: trimmed ~2px each side vs. the original (sm 7/12, md 7/13, lg 9/16)
// so the new-event chips (자녀/종류/반복/알림) read tighter. Global to the primitive.
const SIZE: Record<SelectChipSize, { padV: number; padH: number; label: TypeKey }> = {
  sm: { padV: 3, padH: 8, label: 'caption' },
  md: { padV: 5, padH: 11, label: 'caption' },
  lg: { padV: 7, padH: 14, label: 'body' },
};

export interface SelectChipProps {
  label: string;
  active?: boolean;
  size?: SelectChipSize;
  leading?: React.ReactNode; // e.g. a TypeIcon, recolored by caller to match active state
  onPress?: () => void;
  style?: ViewStyle;
}

export function SelectChip({
  label,
  active = false,
  size = 'md',
  leading,
  onPress,
  style,
}: SelectChipProps): React.ReactElement {
  const s = SIZE[size];
  const base: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: s.padV,
    paddingHorizontal: s.padH,
    borderRadius: RADIUS.full,
    backgroundColor: active ? TOKENS.controlActive : TOKENS.controlIdle,
  };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [base, pressed ? { opacity: 0.7 } : null, style ?? null]}
    >
      {leading}
      <Text variant={s.label} color={active ? TOKENS.surface : TOKENS.inkSub}>
        {label}
      </Text>
    </Pressable>
  );
}
