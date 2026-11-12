// First-use tip (board CM2): a small dark bubble with an animated hint and ✕.
// No dimming — the screen stays usable; the tip goes away when the gesture is
// done or ✕ is tapped (the caller marks it seen).
//
//   <CoachFinger x y />          a finger that presses and holds on a point (+ ring)
//   <CoachFinger x y slideTo />  presses at x, slides to slideTo, lifts
//   <CoachTip ... />      the bubble; `gesture` draws a tiny looping hint inside

import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { IconXMark } from '../icons';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { TYPE } from '../typography';
import { makeStyles, useTheme } from '../appearance';

const CYCLE = 2400;
const ARROW = 14;
const FINGER_PATH =
  'M20 6c0-3 2.2-5 5-5s5 2 5 5v20l3-1c3-1 6 1 6 4v1l3-1c3-1 6 1 6 4v2l2-.5c3-.5 5 1.5 5 4.5v10c0 9-7 15-16 15h-6c-6 0-10-3-13-8L5 39c-1.6-2.6-.6-5.8 2-7 2.2-1 4.6-.2 6 1.6L20 41V6z';

function useLoop(): SharedValue<number> {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: CYCLE, easing: Easing.linear }), -1, false);
  }, [t]);
  return t;
}

function Finger({ size }: { size: number }): React.ReactElement {
  const theme = useTheme();
  return (
    <Svg width={size} height={(size * 64) / 54} viewBox="0 0 54 64">
      <Path d={FINGER_PATH} fill={theme.t.onDark} stroke={theme.t.onLight} strokeWidth={2.4} strokeLinejoin="round" />
    </Svg>
  );
}

/** A finger pressing (and, with `slideTo`, sliding) — the fingertip lands on (x, y). */
export const CoachFinger = memo(function CoachFinger({ x, y, slideTo }: { x: number; y: number; slideTo?: number }): React.ReactElement {
  const styles = useStyles();
  const t = useLoop();
  const dx = slideTo !== undefined ? slideTo - x : 0;
  const finger = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 0.3, 0.75, 0.9, 1], [0, 0, dx, dx, 0]) },
      { translateY: interpolate(t.value, [0, 0.15, 0.3, 0.8, 0.95, 1], [14, 14, 0, 0, 14, 14]) },
      { scale: interpolate(t.value, [0, 0.15, 0.3, 0.8, 0.95, 1], [1, 1, 0.92, 0.92, 1, 1]) },
    ],
  }));
  // Press: a ring fills where the finger holds. Slide: a pill-shaped trail
  // grows behind the finger.
  const ring = useAnimatedStyle(() =>
    dx === 0
      ? {
          opacity: interpolate(t.value, [0, 0.28, 0.32, 0.78, 0.9, 1], [0, 0, 0.9, 0.9, 0, 0]),
          transform: [{ scale: interpolate(t.value, [0, 0.28, 0.78, 0.9, 1], [0.2, 0.2, 1, 1.15, 1.15]) }],
        }
      : {
          opacity: interpolate(t.value, [0, 0.28, 0.32, 0.8, 0.92, 1], [0, 0, 0.9, 0.9, 0, 0]),
          width: interpolate(t.value, [0, 0.3, 0.75, 1], [52, 52, 52 + dx, 52 + dx]),
        },
  );
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.layer]}>
      <Reanimated.View style={[styles.ring, { left: x - 26, top: y - 26 }, ring]} />
      <Reanimated.View style={[styles.finger, { left: x - 16, top: y - 4 }, finger]}>
        <Finger size={46} />
      </Reanimated.View>
    </View>
  );
});

/** Tiny looping hint drawn inside the bubble. */
function Hint({ gesture }: { gesture: 'pinch' | 'drag' }): React.ReactElement {
  const styles = useStyles();
  const theme = useTheme();
  const t = useLoop();
  const left = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 0.2, 0.6, 0.8, 1], [0, 0, -9, -9, 0]) },
      { translateY: interpolate(t.value, [0, 0.2, 0.6, 0.8, 1], [0, 0, 5, 5, 0]) },
    ],
  }));
  const right = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 0.2, 0.6, 0.8, 1], [0, 0, 9, 9, 0]) },
      { translateY: interpolate(t.value, [0, 0.2, 0.6, 0.8, 1], [0, 0, -5, -5, 0]) },
      { rotate: '180deg' },
    ],
  }));
  const drag = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(t.value, [0, 0.15, 0.35, 0.75, 0.9, 1], [0, 0, 0, 16, 16, 0]) }],
  }));
  return (
    <View style={[styles.hint, { backgroundColor: theme.t.surfaceOnFillMuted }]}>
      {gesture === 'pinch' ? (
        <>
          <Reanimated.View style={[styles.hintFingerA, left]}>
            <Finger size={18} />
          </Reanimated.View>
          <Reanimated.View style={[styles.hintFingerB, right]}>
            <Finger size={18} />
          </Reanimated.View>
        </>
      ) : (
        <Reanimated.View style={[styles.hintDrag, drag]}>
          <View style={[styles.hintBlock, { backgroundColor: theme.kid(0).source }]} />
          <View style={styles.hintDragFinger}>
            <Finger size={18} />
          </View>
        </Reanimated.View>
      )}
    </View>
  );
}

interface CoachTipProps {
  /** Text before / after the highlighted words, e.g. ['', '길게 누르면', ' 한 아이만 보여요']. */
  parts: readonly [string, string, string];
  onClose: () => void;
  /** Little arrow on the bubble's edge, `x` px from its left. */
  arrowX?: number;
  /** Which edge the arrow sits on (default top: pointing up at the target). */
  arrowSide?: 'top' | 'bottom';
  gesture?: 'pinch' | 'drag';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const CoachTip = memo(function CoachTip({ parts, onClose, arrowX, arrowSide = 'top', gesture, style, testID }: CoachTipProps): React.ReactElement {
  const styles = useStyles();
  const theme = useTheme();
  // Keep the arrow on the bubble's straight top edge — past the rounded corner
  // it pokes out as a diamond (share button at the far right).
  const [width, setWidth] = useState(0);
  const edge = RADIUS.box + ARROW / 2 + 2;
  const ax = arrowX === undefined || width === 0 ? arrowX : Math.min(Math.max(arrowX, edge), width - edge);
  return (
    <View
      style={[styles.bubble, style]}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={parts.join('')}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {ax !== undefined ? (
        <View style={[styles.arrow, arrowSide === 'bottom' ? styles.arrowBottom : null, { left: ax - ARROW / 2 }]} />
      ) : null}
      {gesture !== undefined ? <Hint gesture={gesture} /> : null}
      <Text style={styles.text}>
        {parts[0]}
        <Text style={styles.strong}>{parts[1]}</Text>
        {parts[2]}
      </Text>
      <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="안내 닫기" testID={testID !== undefined ? `${testID}-close` : undefined}>
        <IconXMark size={14} color={theme.t.surfaceOnFill} />
      </Pressable>
    </View>
  );
});

const useStyles = makeStyles((th) => ({
  layer: { zIndex: 40 },
  ring: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: RADIUS.full,
    borderWidth: 4,
    borderColor: th.t.primary,
  },
  finger: { position: 'absolute' },
  bubble: {
    position: 'absolute',
    zIndex: 41,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.md,
    borderRadius: RADIUS.box,
    backgroundColor: th.t.onLight,
  },
  arrow: {
    position: 'absolute',
    top: -6,
    width: ARROW,
    height: ARROW,
    borderRadius: 2,
    backgroundColor: th.t.onLight,
    transform: [{ rotate: '45deg' }],
  },
  arrowBottom: { top: undefined, bottom: -6 },
  text: { ...TYPE.subhead, color: th.t.onDark, flexShrink: 1 },
  strong: { color: th.t.primary, fontFamily: TYPE.headline.fontFamily },
  hint: { width: 40, height: 40, borderRadius: RADIUS.sm, overflow: 'hidden' },
  hintFingerA: { position: 'absolute', left: 6, top: 14 },
  hintFingerB: { position: 'absolute', left: 16, top: 2 },
  hintDrag: { position: 'absolute', left: 6, top: 2 },
  hintBlock: { width: 26, height: 10, borderRadius: 3 },
  hintDragFinger: { position: 'absolute', left: 8, top: 2 },
}));
