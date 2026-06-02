// 1:1 port of ViewToggleB from docs/design/amatta-v1/app-daily-b.jsx
// (the segmented WEEK / DAY pill in the top-bar right cluster).
//
// Mechanical JSX→RN mapping:
//   - outer pill: ink04 bg, radius 99, padding 2, gap 2, flexDirection: 'row'
//   - each segment: base font (Geist Mono) 10/600/0.6 letterSpacing, padding 5×9,
//     radius 99. Active segment has white bg + shadow + 1px inset border (mapped
//     to borderWidth/borderColor + RN shadow*); inactive is transparent w/ inkSub.
//
// Active=DAY by default for the daily screen. Tapping WEEK navigates to the
// current child's weekly view via the supplied callback (orchestrator wires it
// to the first child's `/child/[id]` route).

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT_FAMILIES } from '../fonts';
import { TOKENS } from '../palette';

interface Props {
  active?: 'day' | 'week';
  onPressWeek?: () => void;
  onPressDay?: () => void;
}

function ViewToggleImpl({ active = 'day', onPressWeek, onPressDay }: Props): React.ReactElement {
  return (
    <View style={styles.wrap}>
      <Segment label="WEEK" isActive={active === 'week'} onPress={onPressWeek} />
      <Segment label="DAY" isActive={active === 'day'} onPress={onPressDay} />
    </View>
  );
}

interface SegProps {
  label: string;
  isActive: boolean;
  onPress?: (() => void) | undefined;
}

function Segment({ label, isActive, onPress }: SegProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.seg, isActive ? styles.segActive : styles.segInactive]}
    >
      <Text style={[styles.label, { color: isActive ? TOKENS.ink : TOKENS.inkSub }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export const ViewToggle = memo(ViewToggleImpl);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.ink04,
    borderRadius: 9999,
    padding: 2,
    gap: 2,
    alignSelf: 'flex-start', // RN equivalent of `display: inline-flex`
  },
  seg: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 9999,
  },
  segActive: {
    backgroundColor: TOKENS.surface,
    // boxShadow: '0 1px 2px rgba(0,0,0,0.06), inset 0 0 0 1px hair'
    // → RN approximation: outer drop shadow + 1px border (the inset shadow).
    borderWidth: 1,
    borderColor: TOKENS.hair,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  segInactive: {
    backgroundColor: 'transparent',
  },
  label: {
    fontFamily: FONT_FAMILIES.mono, // Geist Mono — the prototype uses Geist
    fontSize: 10,
    letterSpacing: 0.6,
    lineHeight: 10,
    // RN can't set CSS `fontWeight: 600` for non-system fonts; Geist Mono is
    // single-weight here so the visual weight comes from the family itself.
  },
});
