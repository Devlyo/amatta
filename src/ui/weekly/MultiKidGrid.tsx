// 1:1 port of docs/design/amatta-v1/app-multi-grid.jsx.
//
// Visual rules:
//  - 06:00–25:00 (matches daily-grid extension to 1 AM next day) at
//    60min × HOUR_PX = 56px. Total body height = 19 × 56 = 1064px.
//  - Time gutter (left) carries the hour labels (number + AM/PM stacked).
//  - 7 day columns share the rest of the width via flex:1 each.
//  - Each day column is subdivided into N kid lanes (the order in `kids`
//    governs left→right placement; caller already filters/sorts).
//  - A lane renders its kid's occurrences as kid-colored bars + a circular
//    "kind icon" chip pinned to the top of each bar.
//  - "Today" column gets a faint primary tint.
//  - The NOW line (lime, ADR-003 §B) draws across all 7 day columns when
//    today falls inside this week.
//
// Block tap → onBlockPress(occ). (Tooltip popover from the web prototype is
// dropped on mobile — the user gets EditDetail / EditSheet via the parent
// screen's wiring instead.)

import { memo, useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';

import type { Child, ISODate, Occurrence } from '../../domain/types';
import { getKidPalette } from '../palette';
import { TOKENS } from '../palette';
import { FONT_FAMILIES } from '../fonts';
import { TypeIcon } from '../common/TypeIcon';

export const MG_HOUR_START = 6;
export const MG_HOUR_END = 25;
export const MG_HOUR_PX = 56;
const MG_GUTTER = 44;
const NOW_BADGE_DEAD_ZONE = 14; // skip hour label too close to NOW pill
const TIME_START_MIN = MG_HOUR_START * 60;
const TIME_END_MIN = MG_HOUR_END * 60;
const GRID_H = (MG_HOUR_END - MG_HOUR_START) * MG_HOUR_PX;
const SCROLL_BOTTOM_PAD = 120; // BottomDock clearance, mirrors ScheduleGrid

export interface MultiKidGridProps {
  weekDates: readonly ISODate[]; // length 7 (Sun..Sat)
  kids: readonly Child[];        // filtered active kids, in left→right order
  occurrences: readonly Occurrence[]; // expanded for the week
  nowMinutes: number;
  today: ISODate; // used to compute the today column index + NOW line gate
  onBlockPress?: (occ: Occurrence) => void;
}

function minutesToPx(min: number): number {
  return ((min - TIME_START_MIN) / 60) * MG_HOUR_PX;
}

function MultiKidGridImpl({
  weekDates,
  kids,
  occurrences,
  nowMinutes,
  today,
  onBlockPress,
}: MultiKidGridProps): React.ReactElement {
  const scrollRef = useRef<ScrollView>(null);

  // Find today's column (0..6) — returns -1 if today is not in this week.
  const todayIdx = weekDates.findIndex(
    (d) => (d as unknown as string) === (today as unknown as string),
  );
  const showNow = todayIdx >= 0;
  const nowTop = minutesToPx(nowMinutes);

  // Compute the scroll target synchronously so it's available *before* the
  // first paint — passed to ScrollView via `contentOffset`. Without this
  // the view first paints at y=0 then jumps to targetY via scrollTo, which
  // reads as a flash/jitter at every day↔week toggle.
  const targetY = useMemo<number>(() => {
    if (showNow) return Math.max(0, nowTop - 110);
    if (occurrences.length > 0) {
      let earliest = Number.POSITIVE_INFINITY;
      for (const occ of occurrences) {
        if (occ.startMinutes < earliest) earliest = occ.startMinutes;
      }
      if (Number.isFinite(earliest)) {
        return Math.max(0, minutesToPx(earliest) - 60);
      }
    }
    return 0;
  }, [showNow, nowTop, occurrences]);

  // Re-scroll when the visible week changes (swipe ±7d). On the first
  // mount this also reasserts the contentOffset target, which is harmless
  // (scrolling to the same y is a no-op visually).
  const firstWeekKey = weekDates[0] as unknown as string | undefined;
  useEffect(() => {
    if (scrollRef.current === null) return;
    scrollRef.current.scrollTo({ y: targetY, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstWeekKey]);

  // Bucket occurrences by (kidId, dayIdx) for O(1) lookup in the render.
  const byKidDay = new Map<string, Occurrence[]>();
  for (const occ of occurrences) {
    const dayIdx = weekDates.findIndex(
      (d) => (d as unknown as string) === (occ.date as unknown as string),
    );
    if (dayIdx < 0) continue;
    const key = `${occ.childId}|${dayIdx}`;
    const list = byKidDay.get(key);
    if (list === undefined) byKidDay.set(key, [occ]);
    else list.push(occ);
  }

  const HOURS: number[] = [];
  for (let h = MG_HOUR_START; h <= MG_HOUR_END; h++) HOURS.push(h);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={[
        styles.scrollContent,
        { height: GRID_H + SCROLL_BOTTOM_PAD },
      ]}
      showsVerticalScrollIndicator={false}
      contentOffset={{ x: 0, y: targetY }}
    >
      <View style={[styles.body, { height: GRID_H }]}>
        {/* Time gutter — hour labels (number + AM/PM stacked) */}
        <View style={[styles.gutter, { width: MG_GUTTER }]}>
          {HOURS.map((h) => {
            const top = (h - MG_HOUR_START) * MG_HOUR_PX;
            const tooClose = showNow && Math.abs(top - nowTop) < NOW_BADGE_DEAD_ZONE;
            if (tooClose) return null;
            const hourWrapped = h % 24;
            const h12 = hourWrapped > 12 ? hourWrapped - 12 : hourWrapped === 0 ? 12 : hourWrapped;
            const ap = hourWrapped < 12 ? 'AM' : 'PM';
            return (
              <View key={h} style={[styles.gutterLabel, { top: top - 8 }]}>
                <Text style={styles.gutterHour}>{h12}</Text>
                <Text style={styles.gutterAmpm}>{ap}</Text>
              </View>
            );
          })}
        </View>

        {/* 7 day columns */}
        <View style={styles.daysRow}>
          {weekDates.map((date, dayIdx) => {
            const isToday = dayIdx === todayIdx;
            return (
              <View
                key={date as unknown as string}
                style={[
                  styles.dayCol,
                  isToday ? styles.dayColToday : null,
                ]}
              >
                {/* Hour gridlines */}
                {HOURS.map((h) => {
                  const top = (h - MG_HOUR_START) * MG_HOUR_PX;
                  return (
                    <View
                      key={h}
                      style={[styles.hourLine, { top }]}
                    />
                  );
                })}

                {/* Kid lanes — flex:1 each so they share the column equally */}
                <View style={styles.laneRow}>
                  {kids.map((kid) => {
                    const list = byKidDay.get(`${kid.id}|${dayIdx}`) ?? [];
                    const palette = getKidPalette(kid.colorIndex);
                    return (
                      <View key={kid.id} style={styles.lane}>
                        {list.map((occ) => {
                          const top = minutesToPx(occ.startMinutes);
                          const rawH =
                            minutesToPx(Math.min(occ.endMinutes, TIME_END_MIN)) - top;
                          const h = Math.max(12, rawH); // visible min-height
                          return (
                            <Pressable
                              key={`${occ.scheduleId}|${occ.date as unknown as string}`}
                              onPress={() => onBlockPress?.(occ)}
                              accessibilityRole="button"
                              accessibilityLabel={`${kid.name} ${occ.title}`}
                              style={[
                                styles.block,
                                {
                                  top: top + 1,
                                  height: h - 2,
                                  backgroundColor: palette.bg,
                                  borderColor: palette.source,
                                },
                              ]}
                            >
                              <View
                                style={[
                                  styles.kindChip,
                                  { backgroundColor: palette.source },
                                ]}
                              >
                                <TypeIcon
                                  type={occ.type}
                                  size={12}
                                  color={TOKENS.ink}
                                />
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        {/* NOW line — drawn last so it sits on top of blocks */}
        {showNow ? (
          <View
            pointerEvents="none"
            style={[styles.nowRow, { top: nowTop - 9 }]}
          >
            <View style={[styles.nowBadgeArea, { width: MG_GUTTER }]}>
              <View style={styles.nowBadge}>
                <Text style={styles.nowBadgeLabel}>
                  {fmtClock(nowMinutes)}
                </Text>
              </View>
            </View>
            <View style={styles.nowLine} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function fmtClock(minutes: number): string {
  const wrapped = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')}`;
}

export const MultiKidGrid = memo(MultiKidGridImpl);

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { },
  body: {
    flexDirection: 'row',
    position: 'relative',
  },
  gutter: {
    position: 'relative',
  },
  gutterLabel: {
    position: 'absolute',
    right: 6,
    alignItems: 'flex-end',
  },
  gutterHour: {
    fontSize: 11.5,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    lineHeight: 13,
  },
  gutterAmpm: {
    fontSize: 8,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink30,
    lineHeight: 9,
  },
  daysRow: {
    flexDirection: 'row',
    flex: 1,
  },
  dayCol: {
    flex: 1,
    position: 'relative',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: TOKENS.hair,
  },
  dayColToday: {
    // ~3% primary tint — same intent as the prototype's `${A.primary}06`.
    backgroundColor: 'rgba(255,113,68,0.06)',
  },
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: TOKENS.hair,
    opacity: 0.55,
  },
  laneRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 2,
    right: 2,
    flexDirection: 'row',
    gap: 2,
  },
  lane: {
    flex: 1,
    position: 'relative',
    minWidth: 0,
  },
  block: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 6,
    borderWidth: 1,
  },
  kindChip: {
    position: 'absolute',
    top: -9,
    left: '50%',
    marginLeft: -10,
    width: 20,
    height: 20,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle iOS-ish drop shadow so the chip lifts above the block edge.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 1,
  },
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
    backgroundColor: '#E0E345',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 9999,
    shadowColor: '#E0E345',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
  },
  nowBadgeLabel: {
    fontSize: 10.5,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: '#1d1d1b',
    letterSpacing: -0.1,
  },
  nowLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#E0E345',
    marginLeft: -1,
  },
});
