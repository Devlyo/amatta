import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ROW_HEIGHT } from '../../domain/constants';
import type { BlockLayout } from '../../domain/grid';
import type { ScheduleType } from '../../domain/types';
import { getKidPalette, TOKENS } from '../palette';
import { TypeIcon } from '../common/TypeIcon';

interface Props {
  block: BlockLayout;
  type: ScheduleType;
  columnWidth: number;
  onPress?: () => void;
  /**
   * TODO (Phase 4 polish): wire cancel-exception data through layoutDay so
   * the block can render with `opacity: 0.3 + strike-through`. For now
   * `expandOccurrences` already drops cancelled dates so this stays false
   * in the daily-view happy path.
   */
  isCancelled?: boolean;
  /**
   * TODO (Phase 4): a small warning-dot in the corner when the block is
   * backed by a `modify` exception.
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
  const top = block.topSlot * ROW_HEIGHT;
  const height = Math.max(1, block.heightSlots * ROW_HEIGHT - 2); // 2px gap
  const left = block.childIdx * columnWidth + 2;
  const width = Math.max(0, columnWidth - 4);

  const showSecondaryRow = block.heightSlots >= 3;

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
      <View style={styles.row}>
        <TypeIcon type={type} size={12} color={TOKENS.ink} />
        <Text numberOfLines={1} style={styles.title}>
          {block.title}
        </Text>
      </View>
      {showSecondaryRow ? (
        <Text numberOfLines={1} style={styles.secondary}>
          {formatRange(block.startMinutes, block.endMinutes)}
        </Text>
      ) : null}
      {isCancelled ? <View style={styles.strike} /> : null}
      {isModified ? <View style={styles.modifiedDot} /> : null}
    </Pressable>
  );
}

function formatRange(startMinutes: number, endMinutes: number): string {
  return `${formatHHMM(startMinutes)} – ${formatHHMM(endMinutes)}`;
}

function formatHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const ScheduleBlock = memo(ScheduleBlockImpl);

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    color: TOKENS.ink,
    flexShrink: 1,
  },
  secondary: {
    fontSize: 10,
    fontWeight: '400',
    color: TOKENS.inkSub,
    marginTop: 2,
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
