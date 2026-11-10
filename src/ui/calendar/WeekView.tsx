// Week view — ADR-007 §4 (design boards "2 주간" / "2-2 주간 확대").
//
// Day header (요일 + date, today = orange circle) over the shared TimeGrid with
// one column per day. Every kid's events — fixed ones (학교·어린이집) included —
// are blocks; overlaps within a day stack via layoutCascade. Pinch-zoomed it
// shows 4 days and each block gains its time range.

import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { emphasisOf, type PersonKey } from '../../domain/people-filter';
import { cascadeStep, clipToDay, layoutCascade } from '../../domain/layout';
import type { Child, ISODate, Occurrence } from '../../domain/types';
import { getKidPalette, TOKENS } from '../palette';
import { RADIUS } from '../radius';
import { TYPE } from '../typography';
import { fmtRange, weekdayKo } from '../utils/date';
import { AllDayRow, type AllDayItem } from './AllDayRow';
import { TimeBlock } from './TimeBlock';
import { TimeGrid, type LiveColumns, type TimeGridStrip } from './TimeGrid';
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
  /** Days that fit the screen (7 = whole week; 4/3/2 = scroll sideways). */
  span?: number;
  /** Sideways scroll + pinch state shared with the screen (see TimeGridStrip). */
  strip?: TimeGridStrip;
  /**
   * Long strip: `days` is the rendered window, sitting at column `firstColumn`
   * of a `totalColumns`-wide strip (the rest scrolls in as the window moves).
   */
  firstColumn?: number;
  totalColumns?: number;
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
  span = days.length,
  strip,
  firstColumn = 0,
  totalColumns = firstColumn + days.length,
}: Props): React.ReactElement {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent): void => setWidth(e.nativeEvent.layout.width);
  const viewportW = Math.max(0, width - TIME_GUTTER);
  // Column width that follows a live pinch; shared by header, all-day row and grid.
  const ownSpan = useSharedValue(span);
  useEffect(() => {
    ownSpan.value = span;
  }, [span, ownSpan]);
  const ownSizing = useSharedValue(false);
  const columnWidth = width > 0 ? viewportW / span : 0;
  const spanSV = strip?.span ?? ownSpan;
  const sizingSV = strip?.sizing ?? ownSizing;
  const live: LiveColumns = { span: spanSV, sizing: sizingSV, viewportW, columnWidth };

  // Header + all-day row follow the strip's sideways scroll.
  const followStyle = useAnimatedStyle(() =>
    strip === undefined ? {} : { transform: [{ translateX: -strip.scrollX.value }] },
  );
  const headerStripStyle = useAnimatedStyle(() => {
    const w = sizingSV.value && spanSV.value > 0 ? viewportW / spanSV.value : columnWidth;
    return { width: w * totalColumns };
  });
  const headerSpacerStyle = useAnimatedStyle(() => {
    const w = sizingSV.value && spanSV.value > 0 ? viewportW / spanSV.value : columnWidth;
    return { width: w * firstColumn };
  });
  const columnOfDate = useMemo(
    () => new Map(days.map((d, i) => [d as unknown as string, firstColumn + i])),
    [days, firstColumn],
  );
  const kidById = useMemo(() => new Map(kids.map((k) => [k.id, k])), [kids]);
  const everyone = useMemo<PersonKey[]>(() => [...kids.map((k) => k.id), 'guardian'], [kids]);
  const todayColumn = columnOfDate.get(today as unknown as string) ?? null;

  const placed = useMemo(() => {
    const byId = new Map<string, Occurrence>();
    const inputs = [];
    for (const occ of occurrences) {
      if (occ.allDay) continue; // drawn in the all-day row
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

  const allDayItems = useMemo<AllDayItem[]>(() => {
    const out: AllDayItem[] = [];
    for (const occ of occurrences) {
      if (!occ.allDay) continue;
      const abs = columnOfDate.get(occ.date as unknown as string);
      const kid = kidById.get(occ.childId);
      if (abs === undefined || kid === undefined) continue;
      const column = abs - firstColumn; // AllDayRow indexes the window
      const p = getKidPalette(occ.colorIndex);
      const emphasis = emphasisOf(inactive, everyone, kid.id);
      out.push({
        id: `${occ.scheduleId}|${occ.date as unknown as string}`,
        column,
        title: occ.title,
        color: p.source,
        deep: p.deep,
        focused: emphasis === 'solo',
        dimmed: emphasis === 'inactive',
        accessibilityLabel: `${kid.name} ${occ.title}, ${weekdayKo(occ.date)}요일 하루 종일`,
        onPress: () => onPressOccurrence(occ),
      });
    }
    return out;
  }, [occurrences, columnOfDate, kidById, inactive, everyone, onPressOccurrence, firstColumn]);

  const timed = occurrences.filter((o) => !o.allDay);
  const firstStart = timed.length > 0 ? Math.min(...timed.map((o) => o.startMinutes)) : null;
  const openAt = initialScrollY({
    hourHeight: HOUR_HEIGHT,
    nowMinutes: todayColumn !== null ? nowMinutes : null,
    firstStart,
  });
  const indentStep = zoomed ? INDENT_ZOOMED : INDENT;

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={styles.header}>
        <View style={styles.headerViewport}>
          <Reanimated.View
            style={[styles.headerStrip, { width: columnWidth * totalColumns }, headerStripStyle, followStyle]}
          >
            <Reanimated.View style={[{ width: columnWidth * firstColumn }, headerSpacerStyle]} />
            {days.map((date) => {
              const key = date as unknown as string;
              const wd = weekdayKo(date);
              const isToday = key === (today as unknown as string);
              const nameColor =
                wd === '일' ? TOKENS.sunday : wd === '토' ? TOKENS.saturday : TOKENS.inkSub;
              return (
                <LiveCell key={key} live={live}>
                <Pressable
                  onPress={() => onPressDay(date)}
                  accessibilityRole="button"
                  accessibilityLabel={`${Number(key.slice(5, 7))}월 ${Number(key.slice(8, 10))}일 ${wd}요일${isToday ? ', 오늘' : ''} — 일간 보기`}
                  testID={`week-day-${key}`}
                  style={styles.headerCell}
                >
                  <Text style={[styles.headerName, { color: nameColor }]}>{wd}</Text>
                  <View style={[styles.headerCircle, isToday ? styles.headerCircleToday : null]}>
                    <Text
                      style={[
                        styles.headerNumber,
                        { color: isToday ? TOKENS.surface : TOKENS.ink },
                      ]}
                    >
                      {Number(key.slice(8, 10))}
                    </Text>
                  </View>
                </Pressable>
                </LiveCell>
              );
            })}
          </Reanimated.View>
        </View>
      </View>

      <AllDayRow
        columns={days.length}
        items={allDayItems}
        live={live}
        firstColumn={firstColumn}
        followStyle={followStyle}
      />

      <TimeGrid
        testID="week-view"
        columns={totalColumns}
        visibleColumns={span}
        strip={strip}
        renderRange={{ from: firstColumn, count: days.length }}
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
                const date = days[column - firstColumn];
                if (date !== undefined) onLongPressSlot(date, minutes);
              }
        }
        renderColumns={({ live: liveCols, y }) =>
          placed.map(({ id, column, start, end, level, depth, occ }) => {
            const kid = kidById.get(occ.childId);
            if (kid === undefined) return null;
            const palette = getKidPalette(occ.colorIndex);
            const emphasis = emphasisOf(inactive, everyone, kid.id);
            const height = Math.max(y(end) - y(start) - 2, MIN_BLOCK_H);
            return (
              <LiveBlockBox
                key={id}
                testID={`week-slot-${id}`}
                live={liveCols}
                column={column}
                level={level}
                depth={depth}
                indentStep={indentStep}
                top={y(start) + 1}
                height={height}
              >
              <TimeBlock
                testID={`week-block-${id}`}
                compact
                showTime={zoomed}
                top={0}
                left={0}
                width="100%"
                height={height}
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
              </LiveBlockBox>
            );
          })
        }
      />
    </View>
  );
}

export const WeekView = memo(WeekViewImpl);

/** Header cell whose width follows the live column width. */
function LiveCell({ live, children }: { live: LiveColumns; children: React.ReactNode }): React.ReactElement {
  const { span, sizing, viewportW, columnWidth } = live;
  const sized = useAnimatedStyle(() => ({
    width: sizing.value && span.value > 0 ? viewportW / span.value : columnWidth,
  }));
  return <Reanimated.View style={[{ width: columnWidth }, sized]}>{children}</Reanimated.View>;
}

/**
 * A block's slot in its day column, re-laid out every frame of a pinch
 * (same cascade maths as a static layout), so the block resizes instead of
 * being stretched.
 */
function LiveBlockBox({
  live,
  column,
  level,
  depth,
  indentStep,
  top,
  height,
  testID,
  children,
}: {
  live: LiveColumns;
  column: number;
  level: number;
  depth: number;
  indentStep: number;
  top: number;
  height: number;
  testID?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const { span, sizing, viewportW, columnWidth } = live;
  const staticIndent = level * cascadeStep(columnWidth, depth, indentStep);
  const sized = useAnimatedStyle(() => {
    const w = sizing.value && span.value > 0 ? viewportW / span.value : columnWidth;
    // cascadeStep, inlined for the UI thread.
    const step = depth <= 1 ? 0 : Math.min(indentStep, (w * (1 - 0.45)) / (depth - 1));
    const indent = level * step;
    return { left: column * w + 1 + indent, width: w - 2 - indent };
  });
  return (
    <Reanimated.View
      testID={testID}
      style={[
        {
          position: 'absolute',
          top,
          height,
          zIndex: level + 1,
          left: column * columnWidth + 1 + staticIndent,
          width: columnWidth - 2 - staticIndent,
        },
        sized,
      ]}
    >
      {children}
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 54,
    flexDirection: 'row',
    paddingLeft: TIME_GUTTER,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TOKENS.hair,
  },
  headerViewport: { flex: 1, overflow: 'hidden' },
  headerStrip: { flexDirection: 'row', height: '100%' },
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
