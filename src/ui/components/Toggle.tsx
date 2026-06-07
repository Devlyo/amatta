import { Pressable, View, type ViewStyle } from 'react-native';
import { TOKENS } from '../palette';
import { RADIUS } from '../radius';

// On/off switch. Source of truth: ScheduleEditSheet `ToggleSwitch` (track 36×22,
// off #D6D8DD, on near-black, knob 18 white). Track height = round(width × 0.6),
// knob = height − 4 (matches the shipping geometry). off→switchOff / on→controlActive.
export type ToggleSize = 'sm' | 'md' | 'lg';

const TRACK_W: Record<ToggleSize, number> = { sm: 32, md: 36, lg: 44 };

export interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  size?: ToggleSize;
  ariaLabel?: string;
  style?: ViewStyle;
}

export function Toggle({
  value,
  onChange,
  size = 'md',
  ariaLabel,
  style,
}: ToggleProps): React.ReactElement {
  const w = TRACK_W[size];
  const h = Math.round(w * 0.6);
  const knob = h - 4;
  const track: ViewStyle = {
    width: w,
    height: h,
    borderRadius: RADIUS.full,
    padding: 2,
    backgroundColor: value ? TOKENS.controlActive : TOKENS.switchOff,
  };
  const knobStyle: ViewStyle = {
    width: knob,
    height: knob,
    borderRadius: RADIUS.full,
    backgroundColor: TOKENS.surface,
    alignSelf: value ? 'flex-end' : 'flex-start',
  };
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={ariaLabel}
      accessibilityState={{ checked: value }}
      style={[track, style]}
    >
      <View style={knobStyle} />
    </Pressable>
  );
}
