// Week view — ADR-007 §4 (design boards "2 주간" / "2-2 주간 확대").
//
// Day header (요일 + date, today = orange circle) over the shared TimeGrid with
// one column per day. Two drawing modes by how many days fit (boards "2-5" /
// "2-6", 2026-11-10):
//   · ≤ 4 days (default 3.2): every event is a block with title + time range;
//     overlaps within a day stack via layoutCascade.
//   · > 4 days (5–7), 2+ kids: every event is a bar in its person's lane — the day
//     column split evenly by the people shown (kids, then 보호자 when on),
//     owner colour + side bar + a black type icon, no title. A person's own
//     overlapping events stack in their lane, the later one on top.

import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { emphasisOf, type PersonKey } from '../../domain/people-filter';
import { cascadeStep, clipToDay, layoutCascade } from '../../domain/layout';
import type { GuardianOccurrence } from '../../domain/guardian';
import type { Child, ISODate, Occurrence, ScheduleType } from '../../domain/types';
import { IconPerson, KIND_ICON } from '../icons';
import { withAlpha } from '../palette';
import { RADIUS } from '../radius';
import { TYPE } from '../typography';
import { fmtRange, weekdayKo } from '../utils/date';
import { MemberFaces } from '../common/MemberFaces';
import { AllDayRow, type AllDayItem } from './AllDayRow';
import { WEEK_SPAN_BARS_FROM } from './calendar-layout';
import { DraggableBlock } from './DraggableBlock';
import { BLOCK_DIMMED_OPACITY, TimeBlock } from './TimeBlock';
import { TimeGrid, type LiveColumns, type TimeGridStrip } from './TimeGrid';
import { initialScrollY, ongoingStart, TIME_GUTTER } from './time-axis';
import { makeStyles, useTheme } from '../appearance';

const HOUR_HEIGHT = 44;
const INDENT = 15;
const INDENT_ZOOMED = 22;
const MIN_BLOCK_H = 16;
const DOCK_CLEARANCE = 96;

interface Props {
  days: readonly ISODate[];
  today: ISODate;
  kids: readonly Child[];
  /** 보호자 as a person (pill / column). False while 보호자 일정 is off in 설정. */
  guardian?: boolean;

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
  /** Guardian (device calendar) events for the rendered days. */
  guardianEvents?: readonly GuardianOccurrence[];
  onPressGuardian?: (ev: GuardianOccurrence) => void;
  /** ADR-015: a block dragged to a new start / day. Resolve true when it moved. */
  onMoveOccurrence?: (occ: Occurrence, deltaMinutes: number, deltaDays: number) => Promise<boolean>;
}

/** A kid occurrence or a guardian event, in one shape for layout + drawing. */
interface WeekItem {
  id: string;
  person: PersonKey;
  date: ISODate;
  start: number;
  end: number;
  allDay: boolean;
  title: string;
  color: string;
  deep: string;
  /** "민준 영어학원" / "보호자 회의" — the accessible name before the time. */
  name: string;
  /** Schedule type (icon in bar mode); 'guardian' for device-calendar events. */
  kind: ScheduleType | 'guardian';
  /** ADR-013 block mode: stacked faces of a shared schedule. */
  faces?: React.ReactNode;
  /** The WeMoa occurrence behind it (absent for device-calendar events) — draggable (ADR-015). */
  occ?: Occurrence;
  onPress?: () => void;
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
  guardianEvents = [],
  guardian = true,
  onPressGuardian,
  onMoveOccurrence,
}: Props): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  // ADR-015: the block being dragged shows its new range live.
  const [preview, setPreview] = useState<{ id: string; d: number } | null>(null);
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
  const everyone = useMemo<PersonKey[]>(() => guardian ? [...kids.map((k) => k.id), 'guardian'] : kids.map((k) => k.id), [kids, guardian]);
  const todayColumn = columnOfDate.get(today as unknown as string) ?? null;

  // People switched off in the filter are hidden — only the ones that are on
  // are laid out (so blocks narrowed by a hidden person's overlap get their
  // width back). Everyone off → nothing is filtered.
  const noneOn = everyone.every((k) => inactive.includes(k));
  // More than 4 days on screen → bars + icons; otherwise titled blocks.
  // One person shown (owner, 2026-11-12 — one kid, or the week's default
  // one-at-a-time filter): the day column is theirs alone, so it keeps titled
  // blocks even at 7 days.
  const shownPeople = noneOn ? everyone.length : everyone.filter((k) => !inactive.includes(k)).length;
  const bars = span > WEEK_SPAN_BARS_FROM && shownPeople > 1 && kids.length !== 1;
  const items = useMemo<WeekItem[]>(() => {
    const out: WeekItem[] = [];
    for (const occ of occurrences) {
      // ADR-013: the people on this schedule that are shown. Bars = a copy in
      // every member's lane; blocks (one day column) = one block, drawn in the
      // first shown member's colour.
      const people: PersonKey[] = [...(occ.memberIds ?? [occ.childId])];
      if (occ.withGuardian === true && guardian) people.push('guardian');
      const shown = people.filter((p) => (p === 'guardian' || kidById.has(p)) && (noneOn || !inactive.includes(p)));
      const shared = people.length > 1;
      for (const person of bars ? shown : shown.slice(0, 1)) {
        const kid = person === 'guardian' ? undefined : kidById.get(person);
        if (person !== 'guardian' && kid === undefined) continue;
        const p = kid !== undefined ? theme.kid(kid.colorIndex) : { source: theme.t.guardian, deep: theme.t.guardianDeep, bar: theme.t.guardianDeep };
        const base = `${occ.scheduleId}|${occ.date as unknown as string}`;
        out.push({
          id: shared ? `${base}|${person}` : base,
          person,
          date: occ.date,
          start: occ.startMinutes,
          end: occ.endMinutes,
          allDay: occ.allDay === true,
          title: occ.title,
          color: p.source,
          deep: p.bar,
          name: `${kid?.name ?? '보호자'} ${occ.title}`,
          kind: occ.type,
          faces:
            !bars && people.length > 1 ? (
              <MemberFaces
                kids={(occ.memberIds ?? []).map((id) => kidById.get(id)).filter((k): k is Child => k !== undefined)}
                withGuardian={occ.withGuardian === true}
                size={14}
              />
            ) : undefined,
          onPress: () => onPressOccurrence(occ),
          occ,
        });
      }
    }
    for (const g of guardianEvents) {
      out.push({
        id: `g:${g.key}`,
        person: 'guardian',
        date: g.date,
        start: g.startMinutes,
        end: g.endMinutes,
        allDay: g.allDay,
        title: g.title,
        color: theme.t.guardian,
        deep: theme.t.guardianDeep,
        name: `보호자 ${g.title}`,
        kind: 'guardian',
        onPress: onPressGuardian === undefined ? undefined : () => onPressGuardian(g),
      });
    }
    return out;
  }, [occurrences, guardianEvents, kidById, onPressOccurrence, onPressGuardian, theme, bars, guardian, inactive, noneOn]);
  const visible = useMemo(
    () => (noneOn ? items : items.filter((i) => !inactive.includes(i.person))),
    [items, inactive, noneOn],
  );

  // First frame: only the days on screen (+1 each side) get blocks — the 3-week
  // strip's hundreds of draggable blocks mount a frame later, so opening the
  // week view isn't held up by off-screen days.
  const [warm, setWarm] = useState(strip === undefined);
  useEffect(() => {
    if (warm) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const raf = requestAnimationFrame(() => {
      t = setTimeout(() => setWarm(true), 0);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (t !== null) clearTimeout(t);
    };
  }, [warm]);
  const firstVisible = strip?.initialColumn ?? firstColumn;
  const onScreen = (column: number): boolean =>
    warm || (column >= firstVisible - 1 && column <= firstVisible + Math.ceil(span) + 1);

  const placed = useMemo(() => {
    const byId = new Map<string, WeekItem>();
    const inputs = [];
    for (const item of visible) {
      if (item.allDay) continue; // drawn in the all-day row
      if (bars) continue; // bar mode: drawn in the person's lane instead
      const column = columnOfDate.get(item.date as unknown as string);
      if (column === undefined || !onScreen(column)) continue;
      const range = clipToDay(item.start, item.end);
      if (range === null) continue;
      byId.set(item.id, item);
      inputs.push({ id: item.id, column, start: range.start, end: range.end });
    }
    return layoutCascade(inputs).map((p) => ({ ...p, item: byId.get(p.id) as WeekItem }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, columnOfDate, bars, warm]);

  // Bar mode: one lane per person shown (kids in order, then 보호자).
  const lanes = useMemo(() => {
    const shown: PersonKey[] = everyone.filter((k) => noneOn || !inactive.includes(k));
    return new Map<PersonKey, number>(shown.map((k, i) => [k, i]));
  }, [everyone, inactive, noneOn]);
  const laneBars = useMemo(() => {
    if (!bars) return [];
    const out: { item: WeekItem; column: number; lane: number; start: number; end: number; stacked: boolean }[] = [];
    const sorted = visible
      .filter((i) => !i.allDay)
      .sort((a, b) => a.start - b.start || b.end - a.end);
    for (const item of sorted) {
      const column = columnOfDate.get(item.date as unknown as string);
      const lane = lanes.get(item.person);
      if (column === undefined || lane === undefined || !onScreen(column)) continue;
      const range = clipToDay(item.start, item.end);
      if (range === null) continue;
      // Same person, same day, overlapping an earlier bar → drawn on top of it.
      const stacked = out.some(
        (o) => o.column === column && o.lane === lane && o.start < range.end && range.start < o.end,
      );
      out.push({ item, column, lane, start: range.start, end: range.end, stacked });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, visible, columnOfDate, lanes, warm]);

  const allDayItems = useMemo<AllDayItem[]>(() => {
    const out: AllDayItem[] = [];
    for (const item of visible) {
      if (!item.allDay) continue;
      const abs = columnOfDate.get(item.date as unknown as string);
      if (abs === undefined) continue;
      const emphasis = emphasisOf(inactive, everyone, item.person);
      out.push({
        id: item.id,
        column: abs - firstColumn, // AllDayRow indexes the window
        title: item.title,
        color: item.color,
        deep: item.deep,
        focused: emphasis === 'solo',
        dimmed: emphasis === 'inactive',
        accessibilityLabel: `${item.name}, ${weekdayKo(item.date)}요일 하루 종일`,
        onPress: item.onPress ?? (() => {}),
      });
    }
    return out;
  }, [visible, columnOfDate, inactive, everyone, firstColumn]);

  const timed = visible.filter((i) => !i.allDay);
  const firstStart = timed.length > 0 ? Math.min(...timed.map((i) => i.start)) : null;
  const openAt = initialScrollY({
    hourHeight: HOUR_HEIGHT,
    nowMinutes: todayColumn !== null ? nowMinutes : null,
    firstStart,
    ongoingStart: ongoingStart(
      timed
        .filter((i) => (i.date as unknown as string) === (today as unknown as string))
        .map((i) => ({ startMinutes: i.start, endMinutes: i.end })),
      todayColumn !== null ? nowMinutes : null,
    ),
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
                wd === '일' ? theme.t.sunday : wd === '토' ? theme.t.saturday : theme.t.inkSub;
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
                        { color: isToday ? theme.t.surface : theme.t.ink },
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
        renderColumns={({ live: liveCols, y }) => [
          ...laneBars.map(({ item, column, lane, start, end, stacked }) => {
            const emphasis = emphasisOf(inactive, everyone, item.person);
            const height = Math.max(y(end) - y(start) - 2, MIN_BLOCK_H);
            const Icon = item.kind === 'guardian' ? IconPerson : KIND_ICON[item.kind];
            return (
              <LiveLaneBox
                key={`bar-${item.id}`}
                testID={`week-bar-${item.id}`}
                live={liveCols}
                column={column}
                lane={lane}
                lanes={lanes.size}
                top={y(start) + 1}
                height={height}
                zIndex={stacked ? 2 : 1}
              >
                <Pressable
                  onPress={item.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${weekdayKo(item.date)}요일 ${fmtRange(item.start, item.end)}`}
                  style={[
                    styles.laneBar,
                    stacked ? styles.laneBarStacked : null,
                    {
                      backgroundColor: withAlpha(
                        item.color,
                        emphasis === 'solo' ? theme.blockFillFocused : theme.blockFill,
                      ),
                      opacity: emphasis === 'inactive' ? BLOCK_DIMMED_OPACITY : 1,
                    },
                  ]}
                >
                  <View style={[styles.laneSide, { backgroundColor: item.deep }]} />
                  <Icon size={9} color={theme.t.onLight} />
                </Pressable>
              </LiveLaneBox>
            );
          }),
          ...placed.map(({ id, column, start, end, level, depth, item }) => {
            const emphasis = emphasisOf(inactive, everyone, item.person);
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
              <DraggableBlock
                enabled={onMoveOccurrence !== undefined && item.occ !== undefined && !item.allDay}
                startMinutes={item.start}
                endMinutes={item.end}
                pxPerMin={HOUR_HEIGHT / 60}
                columnWidth={liveCols.columnWidth}
                minColumnDelta={firstColumn - column}
                maxColumnDelta={firstColumn + days.length - 1 - column}
                placeKey={`${item.date as unknown as string}|${item.start}|${item.end}`}
                onPreview={(d) => setPreview(d === null ? null : { id, d })}
                onDrop={(d, dc) =>
                  onMoveOccurrence === undefined || item.occ === undefined
                    ? Promise.resolve(false)
                    : onMoveOccurrence(item.occ, d, dc)
                }
                testID={`week-block-${id}`}
                style={{ flex: 1 }}
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
                title={item.title}
                startMinutes={item.start + (preview?.id === id ? preview.d : 0)}
                endMinutes={item.end + (preview?.id === id ? preview.d : 0)}
                color={item.color}
                guardian={item.person === 'guardian'}
                deep={item.deep}
                focused={emphasis === 'solo'}
                dimmed={emphasis === 'inactive'}
                footer={item.faces}
                accessibilityLabel={`${item.name}, ${weekdayKo(item.date)}요일 ${fmtRange(item.start, item.end)}${level > 0 ? ', 다른 일정과 시간이 겹침' : ''}`}
                onPress={item.onPress}
                holdToDrag={onMoveOccurrence !== undefined && item.occ !== undefined}
              />
              </DraggableBlock>
              </LiveBlockBox>
            );
          }),
        ]}
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

/** Gap between two people's bars in one day column. */
const LANE_GAP = 1;

/** A bar's lane in its day column (column width ÷ people shown), pinch-live. */
function LiveLaneBox({
  live,
  column,
  lane,
  lanes,
  top,
  height,
  zIndex,
  testID,
  children,
}: {
  live: LiveColumns;
  column: number;
  lane: number;
  lanes: number;
  top: number;
  height: number;
  zIndex: number;
  testID?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const { span, sizing, viewportW, columnWidth } = live;
  const laneOf = (w: number): { left: number; width: number } => {
    'worklet';
    const n = Math.max(1, lanes);
    const laneW = (w - 2 - LANE_GAP * (n - 1)) / n;
    return { left: column * w + 1 + lane * (laneW + LANE_GAP), width: laneW };
  };
  const sized = useAnimatedStyle(() =>
    laneOf(sizing.value && span.value > 0 ? viewportW / span.value : columnWidth),
  );
  return (
    <Reanimated.View
      testID={testID}
      style={[{ position: 'absolute', top, height, zIndex, ...laneOf(columnWidth) }, sized]}
    >
      {children}
    </Reanimated.View>
  );
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

const useStyles = makeStyles((th) => ({
  root: { flex: 1 },
  header: {
    height: 54,
    flexDirection: 'row',
    paddingLeft: TIME_GUTTER,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: th.t.gridLine,
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
  headerCircleToday: { backgroundColor: th.t.primary },
  headerNumber: { ...TYPE.subhead, fontFamily: TYPE.mono.fontFamily },
  // Bar mode — TimeBlock's fill + side bar, no outline, icon instead of a title.
  laneBar: {
    flex: 1,
    borderRadius: RADIUS.xs,
    alignItems: 'center',
    paddingTop: 4,
    overflow: 'hidden',
  },
  // A person's own overlapping bar: white ring so it reads as on top.
  laneBarStacked: { borderWidth: 1.5, borderColor: th.t.surface },
  laneSide: {
    position: 'absolute',
    left: 1.5,
    top: 1.5,
    bottom: 1.5,
    width: th.scheme === 'dark' ? 2.5 : 1.5,
    borderRadius: 1,
  },
}));
