// 1:1 port of WeeklyB grid body in docs/design/amatta-v1/app-weekly.jsx:195–317.
//
// Tokens (aligned with src/ui/daily/ScheduleGrid.tsx so a kid's 30-min block
// reads identically on both screens):
//   SLOT_H        = 32         (per 30-min slot — hour = 64px)
//   TIME_GUTTER   = 56         (left time column — wider than daily's 40 because
//                               weekly stacks "00:00" + "AM/PM" with full hour
//                               numbers, not just `h12`)
//   TOTAL_SLOTS   = 34         (06:00..23:00)
//   HOUR_COUNT    = 18         (06..23 inclusive in the gutter)
//
// Body: 7 day columns × TOTAL_SLOTS rows. Today's column has a faint
// palette.bg tint. Hourly hairlines per column. Blocks position absolute
// using minutes-from-06:00 so 09:45 lands sub-slot. Tap a block dispatches
// onBlockPress; tap empty surface dispatches onEmptySlotPress.

import { useEffect, useMemo, useRef } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  SLOT_MIN,
} from '../../domain/constants';
import { layoutWeek, type WeekBlockLayout } from '../../domain/grid';
import type { ISODate, Occurrence, ScheduleType } from '../../domain/types';
import { FONT_FAMILIES } from '../fonts';
import { KIND_ICON } from '../icons';
import { getKidPalette, TOKENS, type KidPalette } from '../palette';
import { fmt12hrShort, todayIso } from '../utils/date';

const SLOT_H = 32;
const TIME_START_MIN = GRID_START_HOUR * 60;
const TIME_END_MIN = GRID_END_HOUR * 60;
const TOTAL_SLOTS = (TIME_END_MIN - TIME_START_MIN) / SLOT_MIN; // 34
const GRID_H = SLOT_H * TOTAL_SLOTS;
const HOUR_H = SLOT_H * 2;
const HOUR_COUNT = GRID_END_HOUR - GRID_START_HOUR; // 17 hour-gap rows
const TIME_GUTTER = 56;

const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

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
  /** Optional kid palette index for today-column tint. Caller's choice. */
  todayColorIndex?: number;
  /** Optional fixed column width; otherwise the grid divides available width by 7. */
  columnWidth?: number;
  onEmptySlotPress?: (e: WeeklyEmptySlotEvent) => void;
  onBlockPress?: (e: WeeklyBlockPressEvent) => void;
}

export function WeeklyGrid({
  occurrences,
  weekDates,
  todayColorIndex,
  columnWidth,
  onEmptySlotPress,
  onBlockPress,
}: Props): React.ReactElement {
  const typeByScheduleId = useMemo(() => {
    const m = new Map<number, ScheduleType>();
    for (const occ of occurrences) m.set(occ.scheduleId, occ.type);
    return m;
  }, [occurrences]);

  const blocks = useMemo(
    () => layoutWeek(occurrences, weekDates),
    [occurrences, weekDates],
  );

  const today = todayIso() as unknown as string;
  const todayIdx = useMemo(() => {
    for (let i = 0; i < weekDates.length; i++) {
      const d = weekDates[i];
      if (d === undefined) continue;
      if ((d as unknown as string) === today) return i;
    }
    return -1;
  }, [weekDates, today]);

  const colW = columnWidth ?? 60;
  const totalWidth = 7 * colW;

  const todayTint = useMemo(() => {
    if (todayColorIndex === undefined) return null;
    if (todayColorIndex < 0 || todayColorIndex > 5) return null;
    return getKidPalette(todayColorIndex as 0 | 1 | 2 | 3 | 4 | 5).bg;
  }, [todayColorIndex]);

  const scrollRef = useRef<ScrollView | null>(null);
  useEffect(() => {
    if (scrollRef.current === null) return;
    // Same convenience as the daily view: bias the initial scroll to the
    // morning band so 08:00 sits near the top.
    const target = Math.max(0, 2 * HOUR_H - 24);
    scrollRef.current.scrollTo({ y: target, animated: false });
  }, []);

  const handleSurfacePress = (e: GestureResponderEvent): void => {
    if (onEmptySlotPress === undefined) return;
    const { locationX, locationY } = e.nativeEvent;
    const slotIndex = Math.floor(locationY / SLOT_H);
    const dayIdx = Math.floor(locationX / colW);
    if (slotIndex < 0 || slotIndex >= TOTAL_SLOTS) return;
    if (dayIdx < 0 || dayIdx >= 7) return;
    const date = weekDates[dayIdx];
    if (date === undefined) return;
    onEmptySlotPress({ dayIdx, date, slotIndex });
  };

  return (
    <View style={styles.root}>
      {/* Week strip header — weekday short + date number (today gets pill). */}
      <View style={styles.weekStrip}>
        <View style={{ width: TIME_GUTTER }} />
        <View style={styles.weekStripRow}>
          {weekDates.map((d, i) => {
            const dayNum = Number((d as unknown as string).slice(8, 10));
            const isToday = i === todayIdx;
            const dowColor =
              i === 6 ? TOKENS.danger : i === 5 ? '#3F66D8' : TOKENS.inkSub;
            return (
              <View
                key={d as unknown as string}
                style={[styles.weekStripCell, { width: colW }]}
              >
                <Text style={[styles.weekStripDow, { color: dowColor }]}>
                  {DOW_LABELS[i]}
                </Text>
                <View
                  style={[
                    styles.weekStripDayBubble,
                    isToday ? styles.weekStripDayBubbleToday : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.weekStripDay,
                      isToday ? styles.weekStripDayToday : null,
                    ]}
                  >
                    {dayNum}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ height: GRID_H }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          {/* Time gutter — hour number + AM/PM stacked, right-aligned. */}
          <View
            style={[styles.gutter, { width: TIME_GUTTER }]}
            pointerEvents="none"
          >
            {Array.from({ length: HOUR_COUNT + 1 }).map((_, i) => {
              const hour = GRID_START_HOUR + i;
              const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
              const ap = hour < 12 ? 'AM' : 'PM';
              return (
                <View
                  key={hour}
                  style={[styles.hourLabel, { top: i * HOUR_H - 6 }]}
                >
                  <Text style={styles.hourNum}>{h12}</Text>
                  <Text style={styles.hourAp}>{ap}</Text>
                </View>
              );
            })}
          </View>

          {/* Grid surface — 7 day columns with hourly hairlines + blocks. */}
          <View style={[styles.surface, { width: totalWidth }]}>
            {/* Day columns (background tint + hairlines). */}
            <View
              style={[styles.columnsRow, { width: totalWidth }]}
              pointerEvents="none"
            >
              {weekDates.map((d, i) => {
                const isToday = i === todayIdx;
                return (
                  <View
                    key={d as unknown as string}
                    style={[
                      styles.dayCol,
                      {
                        width: colW,
                        backgroundColor:
                          isToday && todayTint !== null
                            ? todayTint
                            : 'transparent',
                        borderRightWidth:
                          i < 6 ? StyleSheet.hairlineWidth : 0,
                      },
                    ]}
                  >
                    {Array.from({ length: HOUR_COUNT + 1 }).map((_, h) => (
                      <View
                        key={h}
                        style={[styles.hairLine, { top: h * HOUR_H }]}
                      />
                    ))}
                  </View>
                );
              })}
            </View>

            {/* Tap surface — fills the grid; gives an empty-slot tap target. */}
            <Pressable
              style={[styles.tapSurface, { width: totalWidth, height: GRID_H }]}
              onPress={handleSurfacePress}
              accessibilityRole="button"
              accessibilityLabel="빈 슬롯 탭하여 일정 추가"
            />

            {/* Absolute-positioned schedule blocks. */}
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
// Weekly block — positions by dayIdx (not childIdx) using minutes-of-day so
// sub-30min boundaries (09:45) snap to fractional offsets within their slot.
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
  const palette: KidPalette = getKidPalette(block.colorIndex);
  const KindIcon = KIND_ICON[type];

  // Sub-slot precision: derive top/height directly from minutes-of-day so
  // 17:15–18:45 lands at the right pixel offset, not snapped to 30-min ticks.
  const topMin = block.startMinutes - TIME_START_MIN;
  const spanMin = block.endMinutes - block.startMinutes;
  const top = (topMin / SLOT_MIN) * SLOT_H + 1;
  const height = Math.max(12, (spanMin / SLOT_MIN) * SLOT_H - 2);

  const left = block.dayIdx * columnWidth + 2;
  const width = Math.max(0, columnWidth - 4);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${block.title} 일정`}
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
      <View style={blockStyles.titleRow}>
        <View style={blockStyles.iconWrap}>
          <KindIcon size={11} color={TOKENS.ink} />
        </View>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={blockStyles.title}
        >
          {block.title}
        </Text>
      </View>
      {height > 26 ? (
        <Text style={blockStyles.time}>
          {fmt12hrShort(block.startMinutes)}–{fmt12hrShort(block.endMinutes)}
        </Text>
      ) : null}
    </Pressable>
  );
}

const blockStyles = StyleSheet.create({
  block: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 4,
    overflow: 'hidden',
    gap: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconWrap: { opacity: 0.85 },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.2,
    lineHeight: 13,
  },
  time: {
    fontSize: 9,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    lineHeight: 11,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.surface },

  weekStrip: {
    flexDirection: 'row',
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomColor: TOKENS.hair,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weekStripRow: { flexDirection: 'row' },
  weekStripCell: { alignItems: 'center', gap: 4 },
  weekStripDow: {
    fontSize: 10,
    fontFamily: FONT_FAMILIES.pretendardMedium,
  },
  weekStripDayBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  weekStripDayBubbleToday: { backgroundColor: TOKENS.primary },
  weekStripDay: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },
  weekStripDayToday: {
    color: TOKENS.surface,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
  },

  scroll: { flex: 1 },
  body: { flexDirection: 'row' },

  gutter: { position: 'relative' },
  hourLabel: {
    position: 'absolute',
    right: 6,
    alignItems: 'flex-end',
  },
  hourNum: {
    fontSize: 11,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    lineHeight: 12,
  },
  hourAp: {
    fontSize: 8,
    fontFamily: FONT_FAMILIES.mono,
    color: TOKENS.ink30,
    letterSpacing: 0.4,
    lineHeight: 9,
  },

  surface: { position: 'relative', height: GRID_H },
  columnsRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: GRID_H,
    flexDirection: 'row',
  },
  dayCol: {
    height: GRID_H,
    position: 'relative',
    borderRightColor: TOKENS.hair,
  },
  hairLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: TOKENS.hair,
    opacity: 0.7,
  },
  tapSurface: { position: 'absolute', top: 0, left: 0 },
});
