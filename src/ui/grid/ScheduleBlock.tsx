import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ROW_HEIGHT } from '../../domain/constants';
import type { BlockLayout } from '../../domain/grid';
import type { ScheduleType } from '../../domain/types';
import { FONT_FAMILIES } from '../fonts';
import { KIND_ICON } from '../icons';
import { getKidPalette, TOKENS } from '../palette';
import { fmt12hrShort } from '../utils/date';

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

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={block.title}
      style={[
        styles.block,
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
        <Icon size={12} color={TOKENS.ink} />
        <Text numberOfLines={1} style={styles.title}>
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
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingTop: 5,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  timePill: {
    marginTop: 2,
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
    borderRadius: 3,
    backgroundColor: TOKENS.warningDot,
  },
});
