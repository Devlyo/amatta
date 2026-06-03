// 1:1 port of docs/design/amatta-v1/app-settings.jsx Switch (line 261-281).
// 44×26 track + 22 knob. Track is primary (#FF7144 brand orange) when
// on, ink12 when off; the knob is plain white with a soft drop shadow.
// Built from RN primitives so we don't carry the OS-native iOS green.

import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TOKENS } from '../palette';

const W = 44;
const H = 26;
const KNOB = 22;
const PAD = 2;

interface Props {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

function SwitchPillImpl({
  value,
  onChange,
  disabled,
  accessibilityLabel,
  testID,
}: Props): React.ReactElement {
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        onChange(!value);
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      testID={testID}
      style={[
        styles.track,
        value ? styles.trackOn : styles.trackOff,
        disabled ? styles.disabled : null,
      ]}
    >
      <View
        style={[
          styles.knob,
          { left: value ? W - KNOB - PAD : PAD },
        ]}
      />
    </Pressable>
  );
}

export const SwitchPill = memo(SwitchPillImpl);

const styles = StyleSheet.create({
  // No `borderWidth` here: the spec uses `box-shadow: inset 0 0 0 1px …`
  // which sits ABOVE the layout, not inside it. RN's borderWidth eats 1px
  // from each edge of the inner area, which breaks the knob's PAD math
  // (top + bottom margins become asymmetric). Drop the inset ring; the
  // background + corner radius alone read correctly.
  track: {
    width: W,
    height: H,
    borderRadius: 9999,
    position: 'relative',
  },
  trackOn: { backgroundColor: TOKENS.primary },
  trackOff: { backgroundColor: TOKENS.ink12 },
  disabled: { opacity: 0.5 },
  knob: {
    position: 'absolute',
    top: PAD,
    width: KNOB,
    height: KNOB,
    borderRadius: 9999,
    backgroundColor: TOKENS.surface,
    // Soft iOS-like drop shadow.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
});
