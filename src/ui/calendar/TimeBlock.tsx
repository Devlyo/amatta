// One event on a time grid — ADR-007 §3.
//
//   · fill = owner colour (`source`) at 60% (80% for the focused kid)
//   · 1.5px side bar in the owner's `deep` tone, white 1.5px outline so a
//     stacked block reads as separate from the one beneath it
//   · day view: title + clock + "3–4PM";  week view (`compact`): title only,
//     or title + range when zoomed (`showTime`)
//   · focus mode: blocks of other kids are drawn at 20% (`dimmed`)
//
// Geometry (top/left/width/height/level) comes from the caller (layoutCascade
// + TimeGrid's `y`), so this component never computes layout.

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';

import { IconClock } from '../icons';
import { TOKENS, withAlpha } from '../palette';
import { RADIUS } from '../radius';
import { TYPE } from '../typography';
import { fmtRange } from '../utils/date';

export const BLOCK_FILL_ALPHA = 0.6;
export const BLOCK_FOCUSED_FILL_ALPHA = 0.8;
export const BLOCK_DIMMED_OPACITY = 0.2;

export interface TimeBlockProps {
  top: number;
  left: number;
  /** Number, or '100%' inside a live-sized box (pinched week view). */
  width: DimensionValue;
  height: number;
  /** Cascade level — higher levels draw on top. */
  level: number;
  title: string;
  startMinutes: number;
  endMinutes: number;
  /** Owner colour (kid palette `source` or the guardian token). */
  color: string;
  /** Owner deep tone for the side bar. */
  deep: string;
  /** This block's owner is the focused kid → stronger fill. */
  focused?: boolean;
  /** Another kid is focused → fade this block. */
  dimmed?: boolean;
  /** Week view: title only (unless `showTime`). */
  compact?: boolean;
  showTime?: boolean;
  needsPickup?: boolean;
  accessibilityLabel: string;
  onPress?: () => void;
  testID?: string;
}

function TimeBlockImpl({
  top,
  left,
  width,
  height,
  level,
  title,
  startMinutes,
  endMinutes,
  color,
  deep,
  focused = false,
  dimmed = false,
  compact = false,
  showTime = !compact,
  needsPickup = false,
  accessibilityLabel,
  onPress,
  testID,
}: TimeBlockProps): React.ReactElement {
  const fill = withAlpha(color, focused ? BLOCK_FOCUSED_FILL_ALPHA : BLOCK_FILL_ALPHA);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        styles.block,
        compact ? styles.blockCompact : null,
        {
          top,
          left,
          width,
          height,
          zIndex: level + 1,
          opacity: dimmed ? BLOCK_DIMMED_OPACITY : 1,
          backgroundColor: fill,
        },
      ]}
    >
      <View style={[styles.bar, { backgroundColor: deep }]} />
      <View style={styles.titleRow}>
        <Text
          style={[compact ? styles.titleCompact : styles.title]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {needsPickup && !compact ? <View testID="time-block-pickup" style={styles.pickupDot} /> : null}
      </View>
      {showTime ? (
        <View style={styles.timeRow}>
          {compact ? null : <IconClock size={11} color={TOKENS.ink} />}
          <Text style={compact ? styles.timeCompact : styles.time} numberOfLines={1}>
            {fmtRange(startMinutes, endMinutes)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export const TimeBlock = memo(TimeBlockImpl);

const BAR_W = 1.5;
const RING_W = 1.5;

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    borderRadius: RADIUS.xs,
    borderWidth: RING_W,
    borderColor: TOKENS.surface,
    paddingTop: 4,
    paddingRight: 4,
    paddingBottom: 3,
    paddingLeft: 8,
    overflow: 'hidden',
    gap: 2,
  },
  blockCompact: {
    paddingTop: 2,
    paddingRight: 2,
    paddingLeft: 5,
    gap: 1,
  },
  bar: {
    position: 'absolute',
    left: 1.5,
    top: 1.5,
    bottom: 1.5,
    width: BAR_W,
    borderRadius: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    ...TYPE.blockTitle,
    flexShrink: 1,
    color: TOKENS.ink,
  },
  titleCompact: {
    ...TYPE.caption2,
    flexShrink: 1,
    color: TOKENS.ink,
  },
  pickupDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    backgroundColor: TOKENS.primary,
    borderWidth: RING_W,
    borderColor: TOKENS.surface,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  time: {
    ...TYPE.caption,
    color: TOKENS.ink,
  },
  timeCompact: {
    ...TYPE.caption2,
    color: TOKENS.ink70,
  },
});
