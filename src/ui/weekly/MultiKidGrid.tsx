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

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';

import type { Child, ISODate, Occurrence } from '../../domain/types';
import { getKidPalette, TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { SPACING } from '../spacing';
import { FONT_FAMILIES } from '../fonts';
import { TypeIcon } from '../common/TypeIcon';
import { KidAvatar } from '../common/KidAvatar';
import { fmt12hrShort } from '../utils/date';

export const MG_HOUR_START = 6;
export const MG_HOUR_END = 25;
export const MG_HOUR_PX = 56;
// Unified across all three grids (daily/weekly/multi) per user direction.
const MG_GUTTER = 40;
const NOW_BADGE_DEAD_ZONE = 14; // skip hour label too close to NOW pill
const TIME_START_MIN = MG_HOUR_START * 60;
const TIME_END_MIN = MG_HOUR_END * 60;
const GRID_H = (MG_HOUR_END - MG_HOUR_START) * MG_HOUR_PX;
// Was 120 (BottomDock clearance); user wants the scroll content to end
// flush at the last hour with no trailing gap, matching WeeklyGrid.
const SCROLL_BOTTOM_PAD = 0;

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
  // Guards onContentSizeChange so the synchronous "set initial scroll
  // position before paint" runs exactly once per mount. After that the
  // user (or week-change effect) owns the scroll position.
  const initialScrollDone = useRef(false);

  // Tap-block tooltip — matches the popover affordance from
  // docs/design/amatta-v1/app-multi-grid.jsx. tooltipKey is the
  // (scheduleId|date) pair of the currently-open block; tapping the same
  // block again closes the tooltip, tapping another block moves it.
  const [tooltipKey, setTooltipKey] = useState<{
    scheduleId: number;
    date: string;
  } | null>(null);
  const tooltipKeyMatch = (occ: Occurrence): boolean =>
    tooltipKey !== null &&
    tooltipKey.scheduleId === occ.scheduleId &&
    tooltipKey.date === (occ.date as unknown as string);

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
      onContentSizeChange={() => {
        // Belt-and-suspenders for the platforms where `contentOffset` is
        // unreliable (Android, certain RN/iOS versions). This fires when
        // the inner View is first sized — synchronously, before paint —
        // so a one-shot scrollTo here lets us land at targetY without a
        // visible jump from y=0.
        if (initialScrollDone.current) return;
        initialScrollDone.current = true;
        scrollRef.current?.scrollTo({ y: targetY, animated: false });
      }}
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
                          const isOpen = tooltipKeyMatch(occ);
                          const placeAbove = top > 90;
                          return (
                            <View
                              key={`${occ.scheduleId}|${occ.date as unknown as string}`}
                              style={[styles.blockSlot, { zIndex: isOpen ? 20 : 1 }]}
                            >
                              <Pressable
                                onPress={() => {
                                  const k = {
                                    scheduleId: occ.scheduleId,
                                    date: occ.date as unknown as string,
                                  };
                                  setTooltipKey((prev) =>
                                    prev !== null &&
                                    prev.scheduleId === k.scheduleId &&
                                    prev.date === k.date
                                      ? null
                                      : k,
                                  );
                                }}
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
                                  isOpen ? styles.blockOpen : null,
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
                              {isOpen ? (
                                <Pressable
                                  onPress={() => onBlockPress?.(occ)}
                                  accessibilityRole="button"
                                  accessibilityLabel={`${kid.name} ${occ.title} 상세 보기`}
                                  style={[
                                    styles.tooltip,
                                    placeAbove
                                      ? { top: top - 62 }
                                      : { top: top + h + 6 },
                                  ]}
                                >
                                  <View style={styles.tooltipKidRow}>
                                    <KidAvatar child={kid} size={18} />
                                    <Text style={styles.tooltipKidName}>
                                      {kid.name}
                                    </Text>
                                  </View>
                                  <View style={styles.tooltipTitleRow}>
                                    <TypeIcon
                                      type={occ.type}
                                      size={12}
                                      color={TOKENS.ink}
                                    />
                                    <Text
                                      style={styles.tooltipTitle}
                                      numberOfLines={1}
                                    >
                                      {occ.title}
                                    </Text>
                                  </View>
                                  <Text style={styles.tooltipTime}>
                                    {fmt12hrShort(occ.startMinutes)}–
                                    {fmt12hrShort(occ.endMinutes)}
                                  </Text>
                                </Pressable>
                              ) : null}
                            </View>
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
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    lineHeight: 12,
  },
  gutterAmpm: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink30,
    lineHeight: 14,
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
    gap: SPACING.xxs,
  },
  lane: {
    flex: 1,
    position: 'relative',
    minWidth: 0,
  },
  blockSlot: {
    ...StyleSheet.absoluteFillObject,
  },
  block: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
  },
  blockOpen: {
    borderWidth: 1.5,
    shadowColor: TOKENS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 2,
  },
  tooltip: {
    position: 'absolute',
    left: '50%',
    width: 140,
    marginLeft: -70,
    backgroundColor: TOKENS.surface,
    borderRadius: 9,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    shadowColor: TOKENS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 4,
    // Sit above hour-lines + neighboring blocks.
    zIndex: 30,
  },
  tooltipKidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: SPACING.xxs,
  },
  tooltipKidName: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
  tooltipTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 1,
  },
  tooltipTitle: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
  tooltipTime: {
    fontSize: 10,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.1,
  },
  kindChip: {
    position: 'absolute',
    top: -9,
    left: '50%',
    marginLeft: -10,
    width: 20,
    height: 20,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle iOS-ish drop shadow so the chip lifts above the block edge.
    shadowColor: TOKENS.shadow,
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
    backgroundColor: TOKENS.nowLine,
    paddingVertical: SPACING.xxs,
    paddingHorizontal: 7,
    borderRadius: RADIUS.full,
    shadowColor: TOKENS.nowLine,
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
    backgroundColor: TOKENS.nowLine,
    marginLeft: -1,
  },
});
