// Month view — ADR-007 §4 (design boards "1 월간" / "1-2 월간 확대").
//
// Whole weeks covering the month. Each date cell lists its events as chips
// (owner colour at 60%, no side bar, start-time order); fixed schedules
// (학교·어린이집) are left out. When a cell overflows, its last slot reads
// "+N". Pinch zoom changes the row height live (no stretched text); from
// MONTH_ROW_TWO_LINE up each chip shows two lines — the title (truncated
// with …) and the start time ("4PM").

import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Reanimated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { emphasisOf, type PersonKey } from '../../domain/people-filter';
import type { GuardianOccurrence } from '../../domain/guardian';
import type { Child, ISODate, Occurrence } from '../../domain/types';
import { getKidPalette, TOKENS, withAlpha } from '../palette';
import { RADIUS } from '../radius';
import { TYPE } from '../typography';
import { fmt12hrShort } from '../utils/date';
import {
  MONTH_CHIP_H,
  MONTH_CHIP_H_TWO_LINE,
  MONTH_ROW_MIN,
  MONTH_ROW_TWO_LINE,
  monthCellChips,
  monthChipLimit,
  monthGridDates,
  showsInMonth,
} from './calendar-layout';

export const MONTH_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;
/** Legacy "zoomed" row height (tests / callers without a live height). */
const ROW_H_ZOOMED = 136;
const DOCK_CLEARANCE = 96;

/** Live row height while a pinch is sizing (UI thread). */
export interface MonthLiveRows {
  sizing: SharedValue<boolean>;
  rowH: SharedValue<number>;
}

interface Props {
  anchor: ISODate;
  today: ISODate;
  kids: readonly Child[];
  /** Occurrences covering the visible grid (any order). */
  occurrences: readonly Occurrence[];
  inactive: readonly PersonKey[];
  zoomed: boolean;
  onPressDay: (date: ISODate) => void;
  /** Committed row height (overrides `zoomed`). */
  rowHeight?: number;
  live?: MonthLiveRows;
  /** The weekday names row (a month strip draws one shared row instead). */
  showNames?: boolean;
  testID?: string;
  /** Guardian (device calendar) events — grey chips. */
  guardianEvents?: readonly GuardianOccurrence[];
}

/** One chip: a kid occurrence or a guardian event. */
interface MonthChip {
  id: string;
  person: PersonKey;
  title: string;
  color: string;
  start: number;
  allDay: boolean;
}

function MonthViewImpl({
  anchor,
  today,
  kids,
  occurrences,
  inactive,
  zoomed,
  onPressDay,
  rowHeight,
  live,
  showNames = true,
  testID = 'month-view',
  guardianEvents = [],
}: Props): React.ReactElement {
  const dates = useMemo(() => monthGridDates(anchor), [anchor]);
  const monthKey = (anchor as unknown as string).slice(0, 7);
  const kidById = useMemo(() => new Map(kids.map((k) => [k.id, k])), [kids]);
  const everyone = useMemo<PersonKey[]>(() => [...kids.map((k) => k.id), 'guardian'], [kids]);

  const byDate = useMemo(() => {
    const m = new Map<string, MonthChip[]>();
    const add = (date: ISODate, chip: MonthChip): void => {
      const key = date as unknown as string;
      const list = m.get(key);
      if (list === undefined) m.set(key, [chip]);
      else list.push(chip);
    };
    // Switched-off people are hidden (everyone off → nothing is filtered).
    const noneOn = everyone.every((k) => inactive.includes(k));
    const shown = (p: PersonKey): boolean => noneOn || !inactive.includes(p);
    for (const occ of occurrences) {
      if (!showsInMonth(occ) || !kidById.has(occ.childId) || !shown(occ.childId)) continue;
      add(occ.date, {
        id: String(occ.scheduleId),
        person: occ.childId,
        title: occ.title,
        color: getKidPalette(occ.colorIndex).source,
        start: occ.startMinutes,
        allDay: occ.allDay === true,
      });
    }
    for (const g of shown('guardian') ? guardianEvents : []) {
      add(g.date, { id: `g:${g.eventId}`, person: 'guardian', title: g.title, color: TOKENS.guardian, start: g.startMinutes, allDay: g.allDay });
    }
    // All-day first, then by start time.
    for (const list of m.values()) list.sort((a, b) => (a.allDay === b.allDay ? a.start - b.start : a.allDay ? -1 : 1));
    return m;
  }, [occurrences, guardianEvents, kidById, everyone, inactive]);

  const rowH = rowHeight ?? (zoomed ? ROW_H_ZOOMED : MONTH_ROW_MIN);
  const twoLine = rowH >= MONTH_ROW_TWO_LINE;
  const chipH = twoLine ? MONTH_CHIP_H_TWO_LINE : MONTH_CHIP_H;
  const limit = monthChipLimit(rowH);
  const rows: ISODate[][] = [];
  for (let i = 0; i < dates.length; i += 7) rows.push(dates.slice(i, i + 7));

  return (
    <View style={styles.root}>
      {showNames ? <MonthNames /> : null}
      <ScrollView
        testID={testID}
        contentContainerStyle={{ paddingBottom: DOCK_CLEARANCE }}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((row) => (
          <MonthRow key={row[0] as unknown as string} height={rowH} live={live}>
            {row.map((date, col) => {
              const key = date as unknown as string;
              const inMonth = key.slice(0, 7) === monthKey;
              const isToday = key === (today as unknown as string);
              const list = byDate.get(key) ?? [];
              const { shown, more } = monthCellChips(list, limit);
              const day = Number(key.slice(8, 10));
              const numberColor = isToday
                ? TOKENS.surface
                : !inMonth
                  ? TOKENS.ink30
                  : col === 0
                    ? TOKENS.sunday
                    : col === 6
                      ? TOKENS.saturday
                      : TOKENS.ink;
              return (
                <Pressable
                  key={key}
                  onPress={() => onPressDay(date)}
                  accessibilityRole="button"
                  accessibilityLabel={`${Number(key.slice(5, 7))}월 ${day}일, 일정 ${list.length}개${isToday ? ', 오늘' : ''}`}
                  testID={`month-cell-${key}`}
                  style={[styles.cell, col === 6 ? styles.cellLast : null]}
                >
                  <View style={[styles.circle, isToday ? styles.circleToday : null]}>
                    <Text style={[styles.number, { color: numberColor }]}>{day}</Text>
                  </View>
                  {shown.map((chip) => {
                    const emphasis = emphasisOf(inactive, everyone, chip.person);
                    return (
                      <View
                        key={chip.id}
                        testID={`month-chip-${key}-${chip.id}`}
                        style={[
                          styles.chip,
                          {
                            height: chipH,
                            backgroundColor: withAlpha(chip.color, emphasis === 'solo' ? 0.8 : 0.6),
                            opacity: emphasis === 'inactive' ? 0.2 : 1,
                          },
                        ]}
                      >
                        <Text style={styles.chipTitle} numberOfLines={1} ellipsizeMode="tail">
                          {chip.title}
                        </Text>
                        {twoLine ? (
                          <Text style={styles.chipTime} numberOfLines={1}>
                            {chip.allDay ? '하루 종일' : fmt12hrShort(chip.start)}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                  {more > 0 ? (
                    <Text style={styles.more} testID={`month-more-${key}`}>
                      +{more}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </MonthRow>
        ))}
      </ScrollView>
    </View>
  );
}

export const MonthView = memo(MonthViewImpl);

/** Weekday names (일…토) above the month grid. */
export function MonthNames(): React.ReactElement {
  return (
    <View style={styles.names}>
      {MONTH_NAMES.map((n, i) => (
        <Text
          key={n}
          style={[
            styles.name,
            i === 0 ? { color: TOKENS.sunday } : i === 6 ? { color: TOKENS.saturday } : null,
          ]}
        >
          {n}
        </Text>
      ))}
    </View>
  );
}

/** A week row; follows the live pinch height while sizing, else `height`. */
function MonthRow({
  height,
  live,
  children,
}: {
  height: number;
  live?: MonthLiveRows;
  children: React.ReactNode;
}): React.ReactElement {
  const sizing = live?.sizing;
  const rowH = live?.rowH;
  const sized = useAnimatedStyle(() => ({
    height: sizing?.value === true && rowH !== undefined ? rowH.value : height,
  }));
  return <Reanimated.View style={[styles.row, { height }, sized]}>{children}</Reanimated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  names: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TOKENS.hair,
  },
  name: { ...TYPE.caption, flex: 1, textAlign: 'center', color: TOKENS.inkSub },
  row: { flexDirection: 'row' },
  cell: {
    flex: 1,
    minWidth: 0,
    paddingTop: 4,
    paddingHorizontal: 1,
    gap: 2,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: TOKENS.hair,
  },
  cellLast: { borderRightWidth: 0 },
  circle: {
    alignSelf: 'center',
    width: 26,
    height: 26,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleToday: { backgroundColor: TOKENS.primary },
  number: { ...TYPE.body, fontFamily: TYPE.mono.fontFamily },
  chip: {
    borderRadius: 3,
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  chipTitle: { ...TYPE.caption2, color: TOKENS.ink, letterSpacing: -0.4 },
  chipTime: { ...TYPE.caption2, fontFamily: TYPE.mono.fontFamily, color: TOKENS.ink70 },
  more: { ...TYPE.caption2, color: TOKENS.inkSub, paddingHorizontal: 3 },
});
