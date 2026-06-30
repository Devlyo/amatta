import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ROW_HEIGHT, SLOT_MIN } from '../../domain/constants';
import type { BlockLayout } from '../../domain/grid';
import type { ScheduleType } from '../../domain/types';
import { FONT_FAMILIES } from '../fonts';
import { KIND_ICON } from '../icons';
import { getKidPalette, TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { fmt12hrShort } from '../utils/date';

// Refine #2 — short-block title font scales PROPORTIONALLY to the block's
// duration (Apple-like). Full size at a whole slot (30 min) and above; shrinks
// linearly toward a readable floor for shorter blocks (e.g. a 15-min block
// gets a smaller title than a 30-min one), never below the floor.
const TITLE_FONT_FULL = 12; // matches styles.title (normal small text token)
const TITLE_FONT_FLOOR = 6; // very-short-block floor (founder: shrink to 6px)

/** Proportional title size for a block of `durationMin` minutes. */
function shortBlockFontSize(durationMin: number): number {
  // Fraction of a full 30-min slot the block occupies, clamped to [0, 1].
  const frac = Math.max(0, Math.min(1, durationMin / SLOT_MIN));
  const size = TITLE_FONT_FLOOR + (TITLE_FONT_FULL - TITLE_FONT_FLOOR) * frac;
  // Round to a whole pixel for crisp text; clamp to the floor as a guard.
  return Math.max(TITLE_FONT_FLOOR, Math.round(size));
}

interface Props {
  block: BlockLayout;
  type: ScheduleType;
  columnWidth: number;
  onPress?: () => void;
  /**
   * TODO (Phase 4 polish): wire cancel-exception data through layoutDay so the
   * block renders with `opacity: 0.3` + center strike-through. For now
   * `expandOccurrences` drops cancelled dates so this stays false in the
   * daily-view happy path.
   */
  isCancelled?: boolean;
  /**
   * TODO (Phase 4): a small warning-dot in the corner when the block is backed
   * by a `modify` exception.
   */
  isModified?: boolean;
}

function ScheduleBlockImpl({
  block,
  type,
  columnWidth,
  onPress,
  isCancelled = false,
  isModified = false,
}: Props): React.ReactElement {
  const palette = getKidPalette(block.colorIndex);
  const Icon = KIND_ICON[type];
  const top = block.topSlot * ROW_HEIGHT;
  const height = Math.max(1, block.heightSlots * ROW_HEIGHT - 2); // 2px gap between consecutive blocks
  const left = block.childIdx * columnWidth + 3;
  const width = Math.max(0, columnWidth - 6);

  // Per design §6 — show time pill once there's enough vertical room.
  // ≥ 2 slots (60 min) gives us two text rows comfortably.
  const showTimePill = block.heightSlots >= 2;

  // Item 10 + Refine #2 — short blocks (≤ 1 slot / ≤ 30 min) render a COMPACT
  // layout: title only, single line, ellipsised. The time pill / location are
  // already dropped here (showTimePill is false below 2 slots), and inner
  // padding is tightened so the one title line fits. The title font scales
  // proportionally to the block's true duration (15-min < 30-min) down to a
  // readable floor — no tiny auto-shrink, no height inflation, so the true slot
  // height is preserved and a short block never overlaps the one beneath it.
  const isCompact = block.heightSlots < 2;
  const compactFontSize = isCompact
    ? shortBlockFontSize(block.endMinutes - block.startMinutes)
    : TITLE_FONT_FULL;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={block.title}
      style={[
        styles.block,
        isCompact ? styles.blockCompact : null,
        {
          top,
          height,
          left,
          width,
          backgroundColor: palette.bg,
          borderColor: palette.source,
          opacity: isCancelled ? 0.3 : 1,
        },
      ]}
    >
      <View style={styles.titleRow}>
        <Icon size={isCompact ? 10 : 12} color={TOKENS.ink} />
        <Text
          numberOfLines={1}
          style={[styles.title, isCompact ? { fontSize: compactFontSize } : null]}
        >
          {block.title}
        </Text>
      </View>
      {showTimePill ? (
        <Text numberOfLines={1} style={styles.timePill}>
          {fmt12hrShort(block.startMinutes)}–{fmt12hrShort(block.endMinutes)}
        </Text>
      ) : null}
      {isCancelled ? <View style={styles.strike} /> : null}
      {isModified ? <View style={styles.modifiedDot} /> : null}
    </Pressable>
  );
}

export const ScheduleBlock = memo(ScheduleBlockImpl);

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 7,
    paddingTop: 5,
    paddingBottom: SPACING.xs,
    overflow: 'hidden',
  },
  // Item 10 — compact (≤ 30 min) blocks: tighten vertical padding and center
  // the single title row so the legible 12px title fits inside the true
  // (un-inflated) ~22px block height without being clipped, and pull the
  // horizontal padding in slightly so a longer title ellipsises later.
  blockCompact: {
    justifyContent: 'center',
    paddingTop: SPACING.xxs,
    paddingBottom: SPACING.xxs,
    paddingHorizontal: SPACING.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  title: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  timePill: {
    marginTop: SPACING.xxs,
    fontSize: 10,
    fontFamily: FONT_FAMILIES.mono,
    color: TOKENS.inkSub,
    letterSpacing: -0.1,
  },
  strike: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: '50%',
    height: 1,
    backgroundColor: TOKENS.ink,
  },
  modifiedDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3, // hairline
    backgroundColor: TOKENS.warningDot,
  },
});
