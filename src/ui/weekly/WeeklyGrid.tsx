// 1:1 port of WeeklyB grid body in docs/design/amatta-v1/app-weekly.jsx:195–317.
//
// Tokens:
//   SLOT_H        = 32         (per 30-min slot — hour = 64px)
//   TIME_GUTTER   = 40         (spec: gridTemplateColumns: '40px repeat(7,1fr)')
//   TOTAL_SLOTS   = (GRID_END_HOUR-GRID_START_HOUR)*2 from src/domain/constants
//   HOUR_COUNT    = GRID_END_HOUR-GRID_START_HOUR (gutter labels per hour)
//   DOW_LABELS    = ['일','월','화','수','목','금','토']  (Sun-first; spec)
//
// Body: 7 day columns × TOTAL_SLOTS rows. Today's column has a faint
// palette.bg tint. Hourly hairlines per column. Blocks position absolute
// using minutes-from-GRID_START so 09:45 lands sub-slot. Tap a block
// dispatches onBlockPress; tap empty surface dispatches onEmptySlotPress.
// NOW line (lime badge + horizontal rule) shows when today is in the
// visible week — mirrors ADR-003 NOW tick.

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { isKoreanHoliday } from '../../domain/korean-holidays';
import type { ISODate, Occurrence, ScheduleType } from '../../domain/types';
import { FONT_FAMILIES } from '../fonts';
import { KIND_ICON } from '../icons';
import { getKidPalette, TOKENS, type KidPalette } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { fmt12hrShort, todayIso } from '../utils/date';

const SLOT_H = 32;
const TIME_START_MIN = GRID_START_HOUR * 60;
const TIME_END_MIN = GRID_END_HOUR * 60;
const TOTAL_SLOTS = (TIME_END_MIN - TIME_START_MIN) / SLOT_MIN;
const GRID_H = SLOT_H * TOTAL_SLOTS;
const HOUR_H = SLOT_H * 2;
const HOUR_COUNT = GRID_END_HOUR - GRID_START_HOUR;
const TIME_GUTTER = 40;

// Sun-first to match docs/design/amatta-v1/app-weekly.jsx:73.
const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

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
  weekDates: ISODate[]; // length 7 (Sun..Sat)
  /** Optional kid palette index for today-column tint. Caller's choice. */
  todayColorIndex?: number;
  /** Optional fixed column width; otherwise the grid divides available width by 7. */
  columnWidth?: number;
  /** Minutes-of-day (0..1440) for the NOW line + lime badge. When omitted
   *  the grid still ticks its own clock so the lime line moves over time. */
  nowMinutes?: number;
  onEmptySlotPress?: (e: WeeklyEmptySlotEvent) => void;
  onBlockPress?: (e: WeeklyBlockPressEvent) => void;
}

function nowMinutesOfDay(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function WeeklyGrid({
  occurrences,
  weekDates,
  todayColorIndex,
  columnWidth,
  nowMinutes: nowMinutesProp,
  onEmptySlotPress,
  onBlockPress,
}: Props): React.ReactElement {
  // Local NOW tick — minute-boundary aligned setInterval, mirrors ADR-003 §B.
  // If the caller supplies `nowMinutes` (e.g. parent screen already runs the
  // tick), we use that instead and skip the local interval.
  const [localNow, setLocalNow] = useState<number>(() => nowMinutesOfDay());
  useEffect(() => {
    if (nowMinutesProp !== undefined) return;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const tick = (): void => setLocalNow(nowMinutesOfDay());
    const now = new Date();
    const msUntilNext = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 60_000);
    }, msUntilNext);
    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [nowMinutesProp]);
  const nowMinutes = nowMinutesProp ?? localNow;
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
            const isHoliday = isKoreanHoliday(d);
            // Sun-first now: i=0 = Sunday (red), i=6 = Saturday (blue).
            // Korean public holidays anywhere in the week also resolve to
            // TOKENS.danger. '#3F66D8' Saturday tint stays as inline
            // literal — no saturday/blue token exists in src/ui/palette.ts.
            const dowColor =
              i === 0 || isHoliday
                ? TOKENS.danger
                : i === 6
                  ? TOKENS.saturday
                  : TOKENS.inkSub;
            // Sunday OR Korean holiday → date number in danger.
            // Today's filled bubble takes precedence (white text on
            // primary background) so we still gate on !isToday.
            const dayColor =
              (i === 0 || isHoliday) && !isToday
                ? TOKENS.danger
                : TOKENS.ink;
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
                      isToday ? styles.weekStripDayToday : { color: dayColor },
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
              const rawHour = GRID_START_HOUR + i;
              // GRID_END_HOUR may exceed 23 (extended past midnight). Wrap
              // so 24 → 12AM (midnight), 25 → 1AM. Matches ScheduleGrid.
              const hour = rawHour % 24;
              const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
              const ap = hour < 12 ? 'AM' : 'PM';
              return (
                <View
                  key={rawHour}
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
                  />
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

            {/* Hour gridlines drawn AFTER (on top of) the blocks — the time
                grid should read above the colored blocks. Sits under the NOW
                line (rendered outside the surface). pointerEvents none so the
                tap surface / blocks keep receiving touches. */}
            <View
              pointerEvents="none"
              style={[styles.gridlinesOverlay, { width: totalWidth }]}
            >
              {Array.from({ length: HOUR_COUNT + 1 }).map((_, h) => (
                <View key={h} style={[styles.hairLine, { top: h * HOUR_H }]} />
              ))}
            </View>
          </View>
        </View>

        {/* NOW line — drawn only when today is in the visible week.
            Spans the gutter (badge) + grid surface (line). Matches the
            prototype's continuous bar at app-weekly.jsx:295. */}
        {todayIdx >= 0 ? (
          <View
            pointerEvents="none"
            style={[
              styles.nowRow,
              { top: ((nowMinutes - TIME_START_MIN) / SLOT_MIN) * SLOT_H - 9 },
            ]}
          >
            <View style={[styles.nowBadgeArea, { width: TIME_GUTTER }]}>
              <View style={styles.nowBadge}>
                <Text style={styles.nowBadgeLabel}>
                  {fmt12hrShortNoAmpm(nowMinutes)}
                </Text>
              </View>
            </View>
            <View style={styles.nowLine} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// 12hr without AM/PM suffix (badge is just "H:MM").
function fmt12hrShortNoAmpm(minutes: number): string {
  const wrapped = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')}`;
}

// Lime green from docs/design/amatta-v1/app-weekly.jsx:306 — matches the
// existing NOW_YELLOW used in src/ui/daily/ScheduleGrid.tsx. Not yet a
// TOKENS entry; inlined here to stay consistent with the daily grid.
const NOW_YELLOW = TOKENS.nowLine;

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
          <KindIcon size={9} color={TOKENS.ink} />
        </View>
        <Text style={blockStyles.title}>{block.title}</Text>
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
    borderRadius: RADIUS.xs,
    paddingHorizontal: 4,
    paddingVertical: SPACING.xs,
    overflow: 'hidden',
    gap: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  iconWrap: { opacity: 0.85 },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 9,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
    letterSpacing: -0.3,
    lineHeight: 11,
  },
  time: {
    fontSize: 8,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    lineHeight: 10,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.surface },

  weekStrip: {
    flexDirection: 'row',
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    borderBottomColor: TOKENS.hair,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weekStripRow: { flexDirection: 'row' },
  weekStripCell: { alignItems: 'center', gap: SPACING.xs },
  weekStripDow: {
    fontSize: 11,
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
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    lineHeight: 12,
  },
  hourAp: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.mono,
    color: TOKENS.ink30,
    letterSpacing: 0.4,
    lineHeight: 14,
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
  gridlinesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: GRID_H,
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

  // --- NOW line + badge -----------------------------------------------
  nowRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nowBadgeArea: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  nowBadge: {
    backgroundColor: NOW_YELLOW,
    paddingVertical: SPACING.xxs,
    paddingHorizontal: 7,
    borderRadius: RADIUS.full,
    shadowColor: NOW_YELLOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
  },
  nowBadgeLabel: {
    fontSize: 10.5,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.1,
  },
  nowLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: NOW_YELLOW,
    marginLeft: -1,
  },
});
