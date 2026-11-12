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
import { Pressable, Text, View, type DimensionValue } from 'react-native';

import { IconClock } from '../icons';
import { withAlpha } from '../palette';
import { RADIUS } from '../radius';
import { TYPE } from '../typography';
import { fmtRange } from '../utils/date';
import { makeStyles, useTheme } from '../appearance';

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
  /** Guardian block — in dark its grey fill needs light text (ADR-009 contrast). */
  guardian?: boolean;
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
  /** ADR-013: stacked faces under the time (2+ people). */
  footer?: React.ReactNode;
  accessibilityLabel: string;
  onPress?: () => void;
  /** Draggable blocks: a hold lifts the block for dragging, so it must not
   *  also count as a tap (ADR-015). */
  holdToDrag?: boolean;
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
  guardian = false,
  footer,
  accessibilityLabel,
  onPress,
  holdToDrag = false,
  testID,
}: TimeBlockProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  // ADR-009: stronger fills in dark (pastels at 60% go muddy); text on the fill
  // is scheme-independent — dark on kid colours, light on the dark guardian grey.
  const fill = withAlpha(color, focused ? theme.blockFillFocused : theme.blockFill);
  const onFill = guardian ? theme.onGuardianBlock : theme.t.onLight;
  // ADR-013 faces: their own row from FACES_OWN_ROW up (≈ 1h10m); a shorter
  // block (a 1-hour class) puts them at the end of the time row, or in its
  // place when the time is hidden (owner 2026-11-12). Not on compact blocks
  // (5+ columns) — no room next to the time there.
  const hasFaces = footer !== undefined && footer !== null;
  const facesInline = hasFaces && !compact && height < FACES_OWN_ROW && height >= FACES_INLINE_MIN;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={holdToDrag ? () => {} : undefined}
      delayLongPress={holdToDrag ? 300 : undefined}
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
          style={[compact ? styles.titleCompact : styles.title, { color: onFill }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {/* Pickup dot — also on compact blocks (a 5-column day view: 4 kids + 보호자). */}
        {needsPickup ? (
          <View testID="time-block-pickup" style={[styles.pickupDot, compact ? styles.pickupDotCompact : null]} />
        ) : null}
      </View>
      {showTime ? (
        <View style={styles.timeRow}>
          {compact ? null : <IconClock size={11} color={onFill} />}
          <Text
            style={[compact ? styles.timeCompact : styles.time, { color: compact ? withAlpha(onFill, 0.7) : onFill }]}
            numberOfLines={1}
          >
            {fmtRange(startMinutes, endMinutes)}
          </Text>
          {facesInline ? <View style={styles.facesInline}>{footer}</View> : null}
        </View>
      ) : facesInline ? (
        <View style={styles.timeRow}>{footer}</View>
      ) : null}
      {hasFaces && height >= FACES_OWN_ROW ? <View style={styles.footer}>{footer}</View> : null}
    </Pressable>
  );
}

export const TimeBlock = memo(TimeBlockImpl);

const BAR_W = 1.5;
/** Faces get their own row from this block height (title + time + faces). */
const FACES_OWN_ROW = 52;
/** Below FACES_OWN_ROW, faces join the time row from this height (title + one row). */
const FACES_INLINE_MIN = 34;
const RING_W = 1.5;

const useStyles = makeStyles((th) => ({
  block: {
    position: 'absolute',
    borderRadius: RADIUS.xs,
    borderWidth: RING_W,
    borderColor: th.t.surface,
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
    // Dark: 2.5px — 1.5px got lost on the bright dark-mode fill.
    width: th.scheme === 'dark' ? 2.5 : BAR_W,
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
    color: th.t.ink,
  },
  titleCompact: {
    ...TYPE.caption2,
    flexShrink: 1,
    color: th.t.ink,
  },
  pickupDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.primary,
    borderWidth: RING_W,
    borderColor: th.t.surface,
  },
  pickupDotCompact: { width: 7, height: 7, borderWidth: 1 },
  footer: { marginTop: 'auto', paddingBottom: 1 },
  facesInline: { marginLeft: 'auto', paddingLeft: 2, flexShrink: 0 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  time: {
    ...TYPE.caption,
    color: th.t.ink,
    flexShrink: 1,
  },
  timeCompact: {
    ...TYPE.caption2,
    color: th.t.ink70,
  },
}));
