import { useMemo } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { GRID_SLOTS, ROW_HEIGHT } from '../../domain/constants';
import { layoutDay } from '../../domain/grid';
import type { Occurrence, ScheduleType } from '../../domain/types';
import { TOKENS } from '../palette';
import { SlotCell } from './SlotCell';
import { ScheduleBlock } from './ScheduleBlock';

export interface EmptySlotEvent {
  childIdx: number;
  slotIndex: number;
}

interface Props {
  occurrences: Occurrence[];
  childrenOrder: number[]; // child IDs, left-to-right column order
  columnWidth: number;
  onEmptySlotPress?: (event: EmptySlotEvent) => void;
  onBlockPress?: (scheduleId: number) => void;
}

export function DailyGrid({
  occurrences,
  childrenOrder,
  columnWidth,
  onEmptySlotPress,
  onBlockPress,
}: Props): React.ReactElement {
  // Map childId -> ScheduleType so ScheduleBlock can render the right icon.
  // The Occurrence carries the type already; we precompute a Map keyed by
  // scheduleId for O(1) lookup against the BlockLayout list.
  const typeByScheduleId = useMemo(() => {
    const m = new Map<number, ScheduleType>();
    for (const occ of occurrences) {
      m.set(occ.scheduleId, occ.type);
    }
    return m;
  }, [occurrences]);

  const blocks = useMemo(
    () => layoutDay(occurrences, childrenOrder),
    [occurrences, childrenOrder],
  );

  const totalHeight = GRID_SLOTS * ROW_HEIGHT;
  const totalWidth = Math.max(1, childrenOrder.length) * columnWidth;

  const handleSurfacePress = (e: GestureResponderEvent): void => {
    if (onEmptySlotPress === undefined) return;
    const { locationX, locationY } = e.nativeEvent;
    const slotIndex = Math.floor(locationY / ROW_HEIGHT);
    const childIdx = Math.floor(locationX / columnWidth);
    if (slotIndex < 0 || slotIndex >= GRID_SLOTS) return;
    if (childIdx < 0 || childIdx >= childrenOrder.length) return;
    onEmptySlotPress({ childIdx, slotIndex });
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ height: totalHeight }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.surface, { width: totalWidth, height: totalHeight }]}>
        {/* 34 SlotCells stacked full-width as the background grid */}
        <View style={[styles.cells, { width: totalWidth }]} pointerEvents="none">
          {Array.from({ length: GRID_SLOTS }, (_, i) => (
            <SlotCell key={i} slotIndex={i} isHourBoundary={i % 2 === 0} />
          ))}
        </View>

        {/* Column dividers (visual aid, doesn't intercept touches) */}
        <View
          style={[styles.dividers, { width: totalWidth, height: totalHeight }]}
          pointerEvents="none"
        >
          {childrenOrder.slice(1).map((_id, idx) => (
            <View
              key={idx}
              style={[
                styles.divider,
                { left: (idx + 1) * columnWidth, height: totalHeight },
              ]}
            />
          ))}
        </View>

        {/* Tap surface for empty slots */}
        <Pressable
          style={[styles.tapSurface, { width: totalWidth, height: totalHeight }]}
          onPress={handleSurfacePress}
          accessibilityRole="button"
          accessibilityLabel="빈 슬롯 탭하여 일정 추가"
        />

        {/* Absolutely-positioned schedule blocks */}
        {blocks.map((block) => {
          const type = typeByScheduleId.get(block.scheduleId) ?? 'other';
          return (
            <ScheduleBlock
              key={block.scheduleId}
              block={block}
              type={type}
              columnWidth={columnWidth}
              onPress={
                onBlockPress !== undefined
                  ? () => onBlockPress(block.scheduleId)
                  : undefined
              }
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  surface: { position: 'relative', backgroundColor: TOKENS.surface },
  cells: { position: 'absolute', top: 0, left: 0 },
  dividers: { position: 'absolute', top: 0, left: 0 },
  divider: {
    position: 'absolute',
    top: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: TOKENS.ink06,
  },
  tapSurface: { position: 'absolute', top: 0, left: 0 },
});
