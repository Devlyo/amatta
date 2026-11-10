// Week view — ADR-007 §4 (design boards "2 주간" / "2-2 주간 확대").
//
// Day header (요일 + date, today = orange circle) over the shared TimeGrid with
// one column per day. Every kid's events — fixed ones (학교·어린이집) included —
// are blocks; overlaps within a day stack via layoutCascade. Pinch-zoomed it
// shows 4 days and each block gains its time range.

import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { emphasisOf, type PersonKey } from '../../domain/people-filter';
import { clipToDay, layoutCascade } from '../../domain/layout';
import type { Child, ISODate, Occurrence } from '../../domain/types';
import { getKidPalette, TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { TYPE } from '../typography';
import { fmtRange, weekdayKo } from '../utils/date';
import { TimeBlock } from './TimeBlock';
import { TimeGrid } from './TimeGrid';
import { initialScrollY, TIME_GUTTER } from './time-axis';

const HOUR_HEIGHT = 44;
const INDENT = 15;
const INDENT_ZOOMED = 22;
const MIN_BLOCK_H = 16;
const DOCK_CLEARANCE = 96;

interface Props {
  days: readonly ISODate[];
  today: ISODate;
  kids: readonly Child[];
  /** Occurrences for the visible days (any order). */
  occurrences: readonly Occurrence[];
  nowMinutes: number;
  inactive: readonly PersonKey[];
  zoomed: boolean;
  scrollKey: string;
  onPressOccurrence: (occ: Occurrence) => void;
  onPressDay: (date: ISODate) => void;
  onLongPressSlot?: (date: ISODate, minutes: number) => void;
}

function WeekViewImpl({
  days,
  today,
  kids,
  occurrences,
  nowMinutes,
  inactive,
  zoomed,
  scrollKey,
  onPressOccurrence,
  onPressDay,
  onLongPressSlot,
}: Props): React.ReactElement {
  const columnOfDate = useMemo(
    () => new Map(days.map((d, i) => [d as unknown as string, i])),
    [days],
  );
  const kidById = useMemo(() => new Map(kids.map((k) => [k.id, k])), [kids]);
  const everyone = useMemo<PersonKey[]>(() => [...kids.map((k) => k.id), 'guardian'], [kids]);
  const todayColumn = columnOfDate.get(today as unknown as string) ?? null;

  const placed = useMemo(() => {
    const byId = new Map<string, Occurrence>();
    const inputs = [];
    for (const occ of occurrences) {
      const column = columnOfDate.get(occ.date as unknown as string);
      if (column === undefined || !kidById.has(occ.childId)) continue;
      const range = clipToDay(occ.startMinutes, occ.endMinutes);
      if (range === null) continue;
      const id = `${occ.scheduleId}|${occ.date as unknown as string}`;
      byId.set(id, occ);
      inputs.push({ id, column, start: range.start, end: range.end });
    }
    return layoutCascade(inputs).map((p) => ({ ...p, occ: byId.get(p.id) as Occurrence }));
  }, [occurrences, columnOfDate, kidById]);

  const firstStart = occurrences.length > 0 ? Math.min(...occurrences.map((o) => o.startMinutes)) : null;
  const openAt = initialScrollY({
    hourHeight: HOUR_HEIGHT,
    nowMinutes: todayColumn !== null ? nowMinutes : null,
    firstStart,
  });
  const indentStep = zoomed ? INDENT_ZOOMED : INDENT;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {days.map((date) => {
          const key = date as unknown as string;
          const wd = weekdayKo(date);
          const isToday = key === (today as unknown as string);
          const nameColor = wd === '일' ? TOKENS.sunday : wd === '토' ? TOKENS.saturday : TOKENS.inkSub;
          return (
            <Pressable
              key={key}
              onPress={() => onPressDay(date)}
              accessibilityRole="button"
              accessibilityLabel={`${Number(key.slice(5, 7))}월 ${Number(key.slice(8, 10))}일 ${wd}요일${isToday ? ', 오늘' : ''} — 일간 보기`}
              testID={`week-day-${key}`}
              style={styles.headerCell}
            >
              <Text style={[styles.headerName, { color: nameColor }]}>{wd}</Text>
              <View style={[styles.headerCircle, isToday ? styles.headerCircleToday : null]}>
                <Text style={[styles.headerNumber, { color: isToday ? TOKENS.surface : TOKENS.ink }]}>
                  {Number(key.slice(8, 10))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <TimeGrid
        testID="week-view"
        columns={days.length}
        hourHeight={HOUR_HEIGHT}
        nowMinutes={todayColumn !== null ? nowMinutes : null}
        todayColumn={todayColumn}
        initialScrollY={openAt}
        scrollKey={scrollKey}
        bottomInset={DOCK_CLEARANCE}
        onLongPressSlot={
          onLongPressSlot === undefined
            ? undefined
            : (column, minutes) => {
                const date = days[column];
                if (date !== undefined) onLongPressSlot(date, minutes);
              }
        }
        renderColumns={({ columnWidth, y }) =>
          placed.map(({ id, column, start, end, level, occ }) => {
            const kid = kidById.get(occ.childId);
            if (kid === undefined) return null;
            const palette = getKidPalette(occ.colorIndex);
            const emphasis = emphasisOf(inactive, everyone, kid.id);
            const indent = Math.min(level * indentStep, columnWidth / 2);
            return (
              <TimeBlock
                key={id}
                testID={`week-block-${id}`}
                compact
                showTime={zoomed}
                top={y(start) + 1}
                left={column * columnWidth + 1 + indent}
                width={columnWidth - 2 - indent}
                height={Math.max(y(end) - y(start) - 2, MIN_BLOCK_H)}
                level={level}
                title={occ.title}
                startMinutes={occ.startMinutes}
                endMinutes={occ.endMinutes}
                color={palette.source}
                deep={palette.deep}
                focused={emphasis === 'solo'}
                dimmed={emphasis === 'inactive'}
                accessibilityLabel={`${kid.name} ${occ.title}, ${weekdayKo(occ.date)}요일 ${fmtRange(occ.startMinutes, occ.endMinutes)}${level > 0 ? ', 다른 일정과 시간이 겹침' : ''}`}
                onPress={() => onPressOccurrence(occ)}
              />
            );
          })
        }
      />
    </View>
  );
}

export const WeekView = memo(WeekViewImpl);

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 54,
    flexDirection: 'row',
    paddingLeft: TIME_GUTTER,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TOKENS.hair,
  },
  headerCell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  headerName: { ...TYPE.caption },
  headerCircle: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCircleToday: { backgroundColor: TOKENS.primary },
  headerNumber: { ...TYPE.subhead, fontFamily: TYPE.mono.fontFamily },
});
