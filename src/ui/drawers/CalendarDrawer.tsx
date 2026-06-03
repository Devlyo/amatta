// 1:1 port of CalendarDrawer from docs/design/amatta-v1/app-weekly-drawers.jsx.
//
// Single-month grid driven by useUiStore.calendarDrawerOpen. Prev/next month
// chevrons; weekday header 일~토; tap a date → useUiStore.setCurrentDate +
// closeCalendar. The grid is anchored to the *currently-selected* currentDate's
// month on each open; today (in the device's local time) is rendered with the
// brand primary background.
//
// Per-kid color dots: each date that hosts at least one occurrence shows up to
// 4 small dots (one per kid with an event that day), colored by that kid's
// palette. The list is expanded once per (year, month) via expandOccurrences
// and bucketed by ISODate for O(1) lookup in the cell renderer.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useChildrenStore } from '../../state/children-store';
import { useSchedulesStore } from '../../state/schedules-store';
import { useUiStore } from '../../state/ui-store';
import { expandOccurrences } from '../../domain/occurrences';
import {
  getKoreanHolidayName,
  isKoreanHoliday,
} from '../../domain/korean-holidays';
import type { Child, ISODate, Occurrence } from '../../domain/types';
import { FONT_FAMILIES } from '../fonts';
import { IconChevronLeft, IconChevronRight } from '../icons';
import { getKidPalette, TOKENS } from '../palette';
import { todayIso } from '../utils/date';

// Weekend tints from the prototype's DOW header (Sun=red-pink, Sat=blue).
const WEEKEND_COLOR_SUN = '#D04580';
const WEEKEND_COLOR_SAT = '#3F66D8';

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoFromYmd(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}` as unknown as ISODate;
}

function parseYmd(iso: ISODate): { y: number; m: number; d: number } {
  const s = iso as unknown as string;
  return {
    y: Number(s.slice(0, 4)),
    m: Number(s.slice(5, 7)),
    d: Number(s.slice(8, 10)),
  };
}

interface MonthShape {
  year: number;
  month: number; // 1..12
  daysInMonth: number;
  startDow: number; // 0=Sun..6=Sat
  cells: (number | null)[]; // length is multiple of 7
}

function buildMonth(year: number, month: number): MonthShape {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDow = firstDay.getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return { year, month, daysInMonth, startDow, cells };
}

export function CalendarDrawer(): React.ReactElement {
  const open = useUiStore((s) => s.calendarDrawerOpen);
  const closeCalendar = useUiStore((s) => s.closeCalendar);
  const currentDate = useUiStore((s) => s.currentDate);
  const setCurrentDate = useUiStore((s) => s.setCurrentDate);

  // Anchor the visible month to the current date when (re)opening; this keeps
  // the user in context if they've already navigated to a different week/day.
  const initialAnchor = useMemo(() => parseYmd(currentDate), [currentDate]);
  const [year, setYear] = useState(initialAnchor.y);
  const [month, setMonth] = useState(initialAnchor.m);

  // Re-anchor on each open. Don't depend on `currentDate` directly so that
  // tapping a date doesn't immediately flicker the month back if the parent
  // updates currentDate after the close transition starts.
  useEffect(() => {
    if (open) {
      const { y, m } = parseYmd(useUiStore.getState().currentDate);
      setYear(y);
      setMonth(m);
    }
  }, [open]);

  const todayYmd = useMemo(() => parseYmd(todayIso()), []);
  const selectedYmd = useMemo(() => parseYmd(currentDate), [currentDate]);
  const view = useMemo(() => buildMonth(year, month), [year, month]);

  // Build a per-date list of distinct kid IDs with at least one occurrence
  // that day. Used to draw the colored dot row under each date cell.
  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);

  const childrenById = useMemo(() => {
    const m = new Map<number, Child>();
    for (const c of children) m.set(c.id, c);
    return m;
  }, [children]);

  // Distinct kid IDs (in stable order by Child.id) per ISODate.
  const kidsByDate = useMemo<Map<string, number[]>>(() => {
    const monthStart = isoFromYmd(year, month, 1);
    const monthEnd = isoFromYmd(year, month, view.daysInMonth);
    const occs: Occurrence[] = expandOccurrences(
      schedules,
      exceptions,
      { from: monthStart, to: monthEnd },
      childrenById,
    );
    const map = new Map<string, Set<number>>();
    for (const occ of occs) {
      const key = occ.date as unknown as string;
      const set = map.get(key);
      if (set === undefined) map.set(key, new Set([occ.childId]));
      else set.add(occ.childId);
    }
    const out = new Map<string, number[]>();
    // Sort kids by ID so dot order is stable across renders.
    for (const [date, set] of map) {
      out.set(date, Array.from(set).sort((a, b) => a - b));
    }
    return out;
  }, [year, month, view.daysInMonth, schedules, exceptions, childrenById]);

  const prevMonth = useCallback(() => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const handlePickDate = useCallback(
    (d: number) => {
      setCurrentDate(isoFromYmd(year, month, d));
      closeCalendar();
    },
    [year, month, setCurrentDate, closeCalendar],
  );

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={closeCalendar}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={closeCalendar} />
      <View style={styles.sheet} testID="calendar-drawer-content">
        <View style={styles.handleArea}>
          <View style={styles.handle} />
        </View>
        {/* Month nav */}
        <View style={styles.monthNav}>
          <Pressable
            onPress={prevMonth}
            accessibilityRole="button"
            accessibilityLabel="이전 달"
            hitSlop={8}
            style={styles.navBtn}
          >
            <IconChevronLeft size={18} color={TOKENS.inkSub} />
          </Pressable>
          <Text style={styles.monthLabel}>
            {year}년 {month}월
          </Text>
          <Pressable
            onPress={nextMonth}
            accessibilityRole="button"
            accessibilityLabel="다음 달"
            hitSlop={8}
            style={styles.navBtn}
          >
            <IconChevronRight size={18} color={TOKENS.inkSub} />
          </Pressable>
        </View>

        {/* DOW header — weekend colored, weekday inkSub */}
        <View style={styles.dowRow}>
          {DOW_LABELS.map((d, i) => {
            const tint =
              i === 0
                ? WEEKEND_COLOR_SUN
                : i === 6
                  ? WEEKEND_COLOR_SAT
                  : TOKENS.inkSub;
            return (
              <View key={d} style={styles.dowCell}>
                <Text style={[styles.dowText, { color: tint }]}>{d}</Text>
              </View>
            );
          })}
        </View>

        {/* Date grid */}
        <View style={styles.gridWrap} accessibilityLabel="달력 그리드">
          {view.cells.map((d, i) => {
            if (d === null) {
              return <View key={`b-${i}`} style={styles.cell} />;
            }
            const isToday =
              year === todayYmd.y && month === todayYmd.m && d === todayYmd.d;
            const isSelected =
              year === selectedYmd.y &&
              month === selectedYmd.m &&
              d === selectedYmd.d;

            const pillStyles = [
              styles.pill,
              isToday
                ? styles.pillToday
                : isSelected
                  ? styles.pillSelected
                  : null,
            ];
            const pillTextStyles = [
              styles.pillText,
              isToday
                ? styles.pillTextToday
                : isSelected
                  ? styles.pillTextSelected
                  : null,
            ];

            const dateIso = isoFromYmd(year, month, d);
            const dateIsoStr = dateIso as unknown as string;
            const kidIdsForDate = kidsByDate.get(dateIsoStr) ?? [];
            const dowIdx = i % 7;
            const isSunday = dowIdx === 0;
            const holidayName = getKoreanHolidayName(dateIso);
            const isHoliday = isKoreanHoliday(dateIso);
            const isRedText = (isSunday || isHoliday) && !isToday && !isSelected;
            return (
              <Pressable
                key={`d-${i}`}
                onPress={() => handlePickDate(d)}
                accessibilityRole="button"
                accessibilityLabel={`${year}년 ${month}월 ${d}일${holidayName !== null ? ` ${holidayName}` : ''}${kidIdsForDate.length > 0 ? ` 일정 ${kidIdsForDate.length}건` : ''}`}
                accessibilityState={{ selected: isSelected }}
                style={styles.cell}
              >
                <View style={pillStyles}>
                  <Text
                    style={[
                      ...pillTextStyles,
                      isRedText ? styles.pillTextRed : null,
                    ]}
                  >
                    {d}
                  </Text>
                </View>
                {kidIdsForDate.length > 0 ? (
                  <View style={styles.dotRow}>
                    {kidIdsForDate.slice(0, 4).map((kidId) => {
                      const kid = childrenById.get(kidId);
                      if (kid === undefined) return null;
                      const pal = getKidPalette(kid.colorIndex);
                      return (
                        <View
                          key={kidId}
                          style={[styles.dot, { backgroundColor: pal.source }]}
                        />
                      );
                    })}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29,29,27,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '50%',
    backgroundColor: TOKENS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: TOKENS.ink30,
  },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 12,
  },
  navBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 16,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },

  dowRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dowCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dowText: {
    fontSize: 11,
    fontFamily: FONT_FAMILIES.pretendardMedium,
  },

  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  pill: {
    width: 30,
    height: 30,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillToday: {
    backgroundColor: TOKENS.primary,
  },
  pillSelected: {
    backgroundColor: TOKENS.ink06,
    borderWidth: 1.5,
    borderColor: TOKENS.primary,
  },
  pillText: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.ink,
  },
  pillTextToday: {
    color: TOKENS.surface,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
  },
  pillTextSelected: {
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
  },
  pillTextRed: {
    // Sunday + 한국 공휴일 — both adopt the DOW header's Sunday tint
    // so weekend-vs-holiday distinction stays implicit (calendars
    // conventionally treat them the same visually).
    color: WEEKEND_COLOR_SUN,
  },

  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
    minHeight: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 9999,
  },
});
