import { useMemo } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  GRID_SLOTS,
  GRID_START_HOUR,
  ROW_HEIGHT,
  TIME_COL_WIDTH,
} from '../../domain/constants';
import { layoutWeek, type WeekBlockLayout } from '../../domain/grid';
import type { ISODate, Occurrence, ScheduleType } from '../../domain/types';
import { getKidPalette, TOKENS } from '../palette';
import { TypeIcon } from '../common/TypeIcon';

export interface WeeklyEmptySlotEvent {
  dayIdx: number;
  date: ISODate;
  slotIndex: number;
}

export interface WeeklyBlockPressEvent {
  scheduleId: number;
  date: ISODate;
}

interface Props {
  occurrences: Occurrence[];
  weekDates: ISODate[]; // length 7 (Mon..Sun)
  /** Optional fixed column width; otherwise the grid divides available width by 7. */
  columnWidth?: number;
  onEmptySlotPress?: (e: WeeklyEmptySlotEvent) => void;
  onBlockPress?: (e: WeeklyBlockPressEvent) => void;
}

const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

export function WeeklyGrid({
  occurrences,
  weekDates,
  columnWidth,
  onEmptySlotPress,
  onBlockPress,
}: Props): React.ReactElement {
  // typeByScheduleId for icon rendering on blocks. Same pattern as DailyGrid.
  const typeByScheduleId = useMemo(() => {
    const m = new Map<number, ScheduleType>();
    for (const occ of occurrences) m.set(occ.scheduleId, occ.type);
    return m;
  }, [occurrences]);

  const blocks = useMemo(
    () => layoutWeek(occurrences, weekDates),
    [occurrences, weekDates],
  );

  // If columnWidth not provided, render 7 equal-width columns inside a flex row.
  // For absolute positioning of blocks we need a numeric width; if no column
  // width is given, callers should pass one. As a safe default for tests, use 80.
  const colW = columnWidth ?? 80;
  const totalHeight = GRID_SLOTS * ROW_HEIGHT;
  const totalWidth = 7 * colW;

  const handleSurfacePress = (e: GestureResponderEvent): void => {
    if (onEmptySlotPress === undefined) return;
    const { locationX, locationY } = e.nativeEvent;
    const slotIndex = Math.floor(locationY / ROW_HEIGHT);
    const dayIdx = Math.floor(locationX / colW);
    if (slotIndex < 0 || slotIndex >= GRID_SLOTS) return;
    if (dayIdx < 0 || dayIdx >= 7) return;
    const date = weekDates[dayIdx];
    if (date === undefined) return;
    onEmptySlotPress({ dayIdx, date, slotIndex });
  };

  return (
    <View style={styles.root}>
      {/* Column header: weekday short name + date number */}
      <View style={styles.columnHeader}>
        <View style={{ width: TIME_COL_WIDTH }} />
        <View style={styles.columnHeaderRow}>
          {weekDates.map((d, i) => {
            const dayNum = Number((d as unknown as string).slice(8, 10));
            const isWeekend = i >= 5;
            return (
              <View
                key={d as unknown as string}
                style={[styles.columnHeaderCell, { width: colW }]}
              >
                <Text
                  style={[
                    styles.columnHeaderDow,
                    isWeekend ? styles.columnHeaderWeekend : undefined,
                  ]}
                >
                  {DOW_LABELS[i]}
                </Text>
                <Text style={styles.columnHeaderDay}>{dayNum}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ height: totalHeight }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          {/* Time labels column (left) */}
          <View
            style={[styles.timeCol, { width: TIME_COL_WIDTH }]}
            pointerEvents="none"
          >
            {Array.from({ length: GRID_SLOTS }, (_, i) => {
              if (i % 2 !== 0) return <View key={i} style={styles.timeSpacer} />;
              const hour = GRID_START_HOUR + i / 2;
              return (
                <View key={i} style={styles.timeLabelRow}>
                  <Text style={styles.timeLabel}>{`${String(hour).padStart(2, '0')}:00`}</Text>
                </View>
              );
            })}
          </View>

          {/* Grid surface (7 columns) */}
          <View
            style={[styles.surface, { width: totalWidth, height: totalHeight }]}
          >
            {/* Slot rows full-width */}
            <View
              style={[styles.cells, { width: totalWidth }]}
              pointerEvents="none"
            >
              {Array.from({ length: GRID_SLOTS }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.cellRow,
                    {
                      borderBottomColor:
                        i % 2 === 0 ? TOKENS.ink12 : TOKENS.ink06,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Vertical column dividers between days */}
            <View
              style={[styles.dividers, { width: totalWidth, height: totalHeight }]}
              pointerEvents="none"
            >
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <View
                  key={idx}
                  style={[
                    styles.divider,
                    { left: idx * colW, height: totalHeight },
                  ]}
                />
              ))}
            </View>

            {/* Tap surface */}
            <Pressable
              style={[styles.tapSurface, { width: totalWidth, height: totalHeight }]}
              onPress={handleSurfacePress}
              accessibilityRole="button"
              accessibilityLabel="빈 슬롯 탭하여 일정 추가"
            />

            {/* Schedule blocks */}
            {blocks.map((block) => (
              <WeeklyScheduleBlock
                key={`${block.scheduleId}-${block.date as unknown as string}`}
                block={block}
                type={typeByScheduleId.get(block.scheduleId) ?? 'other'}
                columnWidth={colW}
                onPress={
                  onBlockPress !== undefined
                    ? (): void =>
                        onBlockPress({
                          scheduleId: block.scheduleId,
                          date: block.date,
                        })
                    : undefined
                }
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Weekly block — mirrors ScheduleBlock but positions by dayIdx (not childIdx)
// ---------------------------------------------------------------------------
interface BlockProps {
  block: WeekBlockLayout;
  type: ScheduleType;
  columnWidth: number;
  onPress?: () => void;
}

function WeeklyScheduleBlock({
  block,
  type,
  columnWidth,
  onPress,
}: BlockProps): React.ReactElement {
  const palette = getKidPalette(block.colorIndex);
  const top = block.topSlot * ROW_HEIGHT;
  const height = Math.max(1, block.heightSlots * ROW_HEIGHT - 2);
  const left = block.dayIdx * columnWidth + 2;
  const width = Math.max(0, columnWidth - 4);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={block.title}
      style={[
        blockStyles.block,
        {
          top,
          height,
          left,
          width,
          backgroundColor: palette.bg,
          borderColor: palette.source,
        },
      ]}
    >
      <View style={blockStyles.row}>
        <TypeIcon type={type} size={10} color={TOKENS.ink} />
        <Text numberOfLines={1} style={blockStyles.title}>
          {block.title}
        </Text>
      </View>
    </Pressable>
  );
}

const blockStyles = StyleSheet.create({
  block: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  title: {
    fontSize: 11,
    fontWeight: '500',
    color: TOKENS.ink,
    flexShrink: 1,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.surface },
  columnHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomColor: TOKENS.hair,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  columnHeaderRow: { flexDirection: 'row' },
  columnHeaderCell: { alignItems: 'center', gap: 2 },
  columnHeaderDow: { fontSize: 11, fontWeight: '500', color: TOKENS.inkSub },
  columnHeaderWeekend: { color: TOKENS.primary },
  columnHeaderDay: { fontSize: 14, fontWeight: '600', color: TOKENS.ink },

  scroll: { flex: 1 },
  body: { flexDirection: 'row' },

  timeCol: { backgroundColor: TOKENS.surface },
  timeSpacer: { height: ROW_HEIGHT },
  timeLabelRow: {
    height: ROW_HEIGHT,
    justifyContent: 'flex-start',
    paddingLeft: 8,
    paddingTop: 2,
  },
  timeLabel: {
    fontSize: 12,
    color: TOKENS.inkSub,
    fontVariant: ['tabular-nums'],
  },

  surface: { position: 'relative' },
  cells: { position: 'absolute', top: 0, left: 0 },
  cellRow: {
    height: ROW_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dividers: { position: 'absolute', top: 0, left: 0 },
  divider: {
    position: 'absolute',
    top: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: TOKENS.ink06,
  },
  tapSurface: { position: 'absolute', top: 0, left: 0 },
});
