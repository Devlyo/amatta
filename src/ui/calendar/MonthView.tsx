// Month view — ADR-007 §4 (design boards "1 월간" / "1-2 월간 확대").
//
// Whole weeks covering the month. Each date cell lists its events as chips
// (owner colour at 60%, no side bar, start-time order); fixed schedules
// (학교·어린이집) are left out. When a cell overflows, its last slot reads
// "+N". Pinch-zoomed, cells grow and each chip shows two lines — the title
// (truncated with …) and the start time ("4PM").

import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { emphasisOf, type PersonKey } from '../../domain/people-filter';
import type { Child, ISODate, Occurrence } from '../../domain/types';
import { getKidPalette, TOKENS, withAlpha } from '../palette';
import { RADIUS } from '../radius';
import { TYPE } from '../typography';
import { fmt12hrShort } from '../utils/date';
import { monthCellChips, monthGridDates, showsInMonth } from './calendar-layout';

const NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;
const CELL_H = 104;
const CELL_H_ZOOMED = 136;
const CHIP_H = 16;
const CHIP_H_ZOOMED = 30;
const DOCK_CLEARANCE = 96;

interface Props {
  anchor: ISODate;
  today: ISODate;
  kids: readonly Child[];
  /** Occurrences covering the visible grid (any order). */
  occurrences: readonly Occurrence[];
  inactive: readonly PersonKey[];
  zoomed: boolean;
  onPressDay: (date: ISODate) => void;
}

function MonthViewImpl({
  anchor,
  today,
  kids,
  occurrences,
  inactive,
  zoomed,
  onPressDay,
}: Props): React.ReactElement {
  const dates = useMemo(() => monthGridDates(anchor), [anchor]);
  const monthKey = (anchor as unknown as string).slice(0, 7);
  const kidById = useMemo(() => new Map(kids.map((k) => [k.id, k])), [kids]);
  const everyone = useMemo<PersonKey[]>(() => [...kids.map((k) => k.id), 'guardian'], [kids]);

  const byDate = useMemo(() => {
    const m = new Map<string, Occurrence[]>();
    for (const occ of occurrences) {
      if (!showsInMonth(occ) || !kidById.has(occ.childId)) continue;
      const key = occ.date as unknown as string;
      const list = m.get(key);
      if (list === undefined) m.set(key, [occ]);
      else list.push(occ);
    }
    for (const list of m.values()) list.sort((a, b) => a.startMinutes - b.startMinutes);
    return m;
  }, [occurrences, kidById]);

  const cellH = zoomed ? CELL_H_ZOOMED : CELL_H;
  const chipH = zoomed ? CHIP_H_ZOOMED : CHIP_H;
  const limit = zoomed ? 3 : 4;
  const rows: ISODate[][] = [];
  for (let i = 0; i < dates.length; i += 7) rows.push(dates.slice(i, i + 7));

  return (
    <View style={styles.root}>
      <View style={styles.names}>
        {NAMES.map((n, i) => (
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
      <ScrollView
        testID="month-view"
        scrollEnabled={zoomed}
        contentContainerStyle={{ paddingBottom: DOCK_CLEARANCE }}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((row) => (
          <View key={row[0] as unknown as string} style={styles.row}>
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
                  style={[styles.cell, { height: cellH }, col === 6 ? styles.cellLast : null]}
                >
                  <View style={[styles.circle, isToday ? styles.circleToday : null]}>
                    <Text style={[styles.number, { color: numberColor }]}>{day}</Text>
                  </View>
                  {shown.map((occ) => {
                    const p = getKidPalette(occ.colorIndex);
                    const emphasis = emphasisOf(inactive, everyone, occ.childId);
                    return (
                      <View
                        key={occ.scheduleId}
                        testID={`month-chip-${key}-${occ.scheduleId}`}
                        style={[
                          styles.chip,
                          {
                            height: chipH,
                            backgroundColor: withAlpha(p.source, emphasis === 'solo' ? 0.8 : 0.6),
                            opacity: emphasis === 'inactive' ? 0.2 : 1,
                          },
                        ]}
                      >
                        <Text style={styles.chipTitle} numberOfLines={1} ellipsizeMode="tail">
                          {occ.title}
                        </Text>
                        {zoomed ? (
                          <Text style={styles.chipTime} numberOfLines={1}>
                            {fmt12hrShort(occ.startMinutes)}
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
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export const MonthView = memo(MonthViewImpl);

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
