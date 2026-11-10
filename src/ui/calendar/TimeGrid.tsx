// Shared time grid for the day and week views — ADR-007 §3, §4.
//
// Draws the 00:00–24:00 axis (hour labels "9 AM", hour lines, column rules),
// an optional tinted "today" column and the NOW indicator (orange line + dot +
// pill with white text), inside one vertical ScrollView. Blocks are supplied by
// the caller through `renderColumns`, which receives the measured column width
// and an axis mapper, so day/week wrappers only decide *what* goes in which
// column — never how the axis is drawn.

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { Animated, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { ELEVATION } from '../elevation';
import { TOKENS, withAlpha } from '../palette';
import { RADIUS } from '../radius';
import { TYPE } from '../typography';
import {
  axisHeight,
  hourLabel,
  minutesAtY,
  minutesToY,
  newEventStart,
  nowLabel,
  TIME_GUTTER,
} from './time-axis';
import { TimeBlock } from './TimeBlock';

/**
 * Column width that follows a live pinch on the UI thread: viewport width ÷
 * the live column count. Read it in worklets with `liveWidth`.
 */
export interface LiveColumns {
  span: SharedValue<number>;
  viewportW: number;
}
export function liveWidth(l: LiveColumns): number {
  'worklet';
  return l.viewportW > 0 && l.span.value > 0 ? l.viewportW / l.span.value : 0;
}

export interface TimeGridColumnsLayout {
  columnWidth: number;
  /** Live column width source (pinch) — position blocks with `liveWidth(live)`. */
  live: LiveColumns;
  /** Absolute y (px) inside the grid for minutes-from-midnight. */
  y: (minutes: number) => number;
}

/**
 * Horizontal day strip (week view, ADR-007 §4): more columns than fit, scrolled
 * sideways under a fixed hour gutter. A pinch changes `span` every frame and
 * every column re-lays out at the new width (text never stretches); the
 * screen keeps the day under the fingers by scrolling `scrollRef`.
 */
export interface TimeGridStrip {
  /** Written by the strip's scroll (px). */
  scrollX: SharedValue<number>;
  /** Live number of columns on screen (may be fractional mid-pinch). */
  span: SharedValue<number>;
  scrollRef: AnimatedRef<Reanimated.ScrollView>;
  /** True while pinching — the strip's own scrolling is switched off. */
  locked: SharedValue<boolean>;
  /** Column to show at the left edge after `key` changes. */
  initialColumn: number;
  key: string;
  /**
   * The user scrolled to a new left-edge column: called live when a drag /
   * fling crosses into another week, and once more when the scroll settles.
   * Programmatic re-positioning (key change) never reports.
   */
  onVisibleColumn?: (column: number) => void;
}

/** Columns the caller actually renders (rules, today tint) — the rest is empty strip. */
export interface TimeGridRenderRange {
  from: number;
  count: number;
}

export interface TimeGridProps {
  /** Total columns in the grid. */
  columns: number;
  /** Columns that fit the viewport (default = columns, i.e. no sideways scroll). */
  visibleColumns?: number;
  strip?: TimeGridStrip;
  /** Limit column rules to this window (a long strip renders only near the viewport). */
  renderRange?: TimeGridRenderRange;
  hourHeight: number;
  /** Minutes-from-midnight for the NOW indicator, or null when not showing today. */
  nowMinutes: number | null;
  /** Column index to tint as "today" (week view), or null. */
  todayColumn?: number | null;
  /** Scroll offset to open at — see `initialScrollY`. */
  initialScrollY: number;
  /** Re-applies `initialScrollY` whenever this changes (e.g. the visible date). */
  scrollKey: string;
  /** Extra scroll space under 24:00 so the floating dock never hides the last hour. */
  bottomInset?: number;
  renderColumns: (layout: TimeGridColumnsLayout) => ReactNode;
  /**
   * Long press on an empty part of the grid (blocks sit above this layer and
   * keep their own presses). A one-hour "새 일정" block pops in on the pressed
   * hour, then this fires with the column and that block's start time.
   */
  onLongPressSlot?: (column: number, startMinutes: number) => void;
  /** Colour of the pop-in block per column (the column owner's colours). */
  draftColorOf?: (column: number) => { color: string; deep: string };
  testID?: string;
}

/** Hold time before a long press on an empty slot creates an event. */
const SLOT_LONG_PRESS_MS = 400;
/** How long the pop-in block shows before the new-event form opens. */
const DRAFT_SHOW_MS = 220;
/** The pop-in block is cleared after the form has covered the grid. */
const DRAFT_CLEAR_MS = 900;
const DRAFT_LENGTH_MIN = 60;

const HOURS = Array.from({ length: 25 }, (_, h) => h);

function TimeGridImpl({
  columns,
  visibleColumns = columns,
  strip,
  renderRange,
  hourHeight,
  nowMinutes,
  todayColumn = null,
  initialScrollY,
  scrollKey,
  bottomInset = 0,
  renderColumns,
  onLongPressSlot,
  draftColorOf,
  testID,
}: TimeGridProps): React.ReactElement {
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const viewportW = Math.max(0, width - TIME_GUTTER);
  const columnWidth = width > 0 ? viewportW / visibleColumns : 0;
  const contentW = columnWidth * columns;
  const scrollable = columns > visibleColumns;

  // ── horizontal strip ──
  const ownRef = useAnimatedRef<Reanimated.ScrollView>();
  const hRef = strip?.scrollRef ?? ownRef;
  const ownScrollX = useSharedValue(0);
  const ownLocked = useSharedValue(false);
  const scrollX = strip?.scrollX ?? ownScrollX;
  const locked = strip?.locked ?? ownLocked;
  const ownSpan = useSharedValue(visibleColumns);
  useEffect(() => {
    ownSpan.value = visibleColumns;
  }, [visibleColumns, ownSpan]);
  const live: LiveColumns = { span: strip?.span ?? ownSpan, viewportW };
  // Native scrolling does the motion (iOS physics); the worklet only mirrors
  // the offset for the header and tells the screen which days are in view.
  const report = strip?.onVisibleColumn;
  const userScrolling = useSharedValue(false);
  const lastWeek = useSharedValue(-1);
  const onHScroll = useAnimatedScrollHandler(
    {
      onScroll: (e) => {
        scrollX.value = e.contentOffset.x;
        if (!userScrolling.value || report === undefined || columnWidth <= 0) return;
        const col = Math.round(e.contentOffset.x / columnWidth);
        const week = Math.floor(col / 7);
        if (week !== lastWeek.value) {
          lastWeek.value = week;
          runOnJS(report)(col);
        }
      },
      onBeginDrag: (e) => {
        userScrolling.value = true;
        lastWeek.value = columnWidth > 0 ? Math.floor(Math.round(e.contentOffset.x / columnWidth) / 7) : -1;
      },
      onEndDrag: (e) => {
        // No fling → this is where it settles (a fling re-arms in onMomentumBegin).
        userScrolling.value = false;
        if (report !== undefined && columnWidth > 0) runOnJS(report)(Math.round(e.contentOffset.x / columnWidth));
      },
      onMomentumBegin: () => {
        userScrolling.value = true;
      },
      onMomentumEnd: (e) => {
        userScrolling.value = false;
        if (report !== undefined && columnWidth > 0) runOnJS(report)(Math.round(e.contentOffset.x / columnWidth));
      },
    },
    [columnWidth, report],
  );
  // A whole week on screen pages week by week; a zoomed week glides and
  // settles on a day boundary.
  const pageByViewport = scrollable && visibleColumns === 7;
  const initialX = Math.min(Math.max((strip?.initialColumn ?? 0) * columnWidth, 0), Math.max(contentW - viewportW, 0));
  useEffect(() => {
    if (columnWidth <= 0) return;
    hRef.current?.scrollTo({ x: initialX, animated: false });
    scrollX.value = initialX;
    // Re-position only when the caller's key or the column size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strip?.key, columnWidth]);
  const stageStyle = useAnimatedStyle(() => ({ width: columns * liveWidth(live) }));
  const stripProps = useAnimatedProps(() => ({ scrollEnabled: scrollable && !locked.value }));
  const height = axisHeight(hourHeight);
  const y = useMemo(() => (m: number) => minutesToY(m, hourHeight), [hourHeight]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: initialScrollY, animated: false });
    // Only re-scroll when the caller says the content changed (date / view);
    // NOW ticks and re-renders must not yank the user's scroll position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey]);

  const onLayout = (e: LayoutChangeEvent): void => setWidth(e.nativeEvent.layout.width);

  // Long press → "새 일정" block pops in on the pressed hour → form opens.
  const [draft, setDraft] = useState<{ column: number; start: number } | null>(null);
  const draftAnim = useRef(new Animated.Value(0)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const startDraft = (x: number, yPx: number): void => {
    if (onLongPressSlot === undefined || columnWidth <= 0) return;
    const column = Math.min(columns - 1, Math.max(0, Math.floor(x / columnWidth)));
    const start = newEventStart(minutesAtY(yPx, hourHeight, 60));
    timers.current.forEach(clearTimeout);
    setDraft({ column, start });
    draftAnim.setValue(0);
    Animated.spring(draftAnim, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 6 }).start();
    timers.current = [
      setTimeout(() => onLongPressSlot(column, start), DRAFT_SHOW_MS),
      setTimeout(() => setDraft(null), DRAFT_CLEAR_MS),
    ];
  };

  const slotPress = Gesture.LongPress()
    .minDuration(SLOT_LONG_PRESS_MS)
    .maxDistance(10)
    .runOnJS(true)
    .withTestId('time-grid-slots')
    .onStart((e) => startDraft(e.x, e.y));

  return (
    <ScrollView
      ref={scrollRef}
      testID={testID}
      onLayout={onLayout}
      contentOffset={{ x: 0, y: initialScrollY }}
      directionalLockEnabled
      contentContainerStyle={{ height: height + bottomInset }}
      showsVerticalScrollIndicator={false}
    >
      {HOURS.map((h) => {
        const label = hourLabel(h);
        return (
          <View key={h} pointerEvents="none" style={[styles.hourRow, { top: y(h * 60) }]}>
            <Text style={styles.hourLabel} numberOfLines={1}>
              {label.num}
              <Text style={styles.hourMeridiem}> {label.ap}</Text>
            </Text>
            <View style={styles.hourLine} />
          </View>
        );
      })}

      {columnWidth > 0 ? (
        <View style={[styles.columns, { width: viewportW, height }]}>
          <Reanimated.ScrollView
            ref={hRef}
            horizontal
            animatedProps={stripProps}
            bounces={scrollable}
            showsHorizontalScrollIndicator={false}
            onScroll={onHScroll}
            scrollEventThrottle={16}
            pagingEnabled={pageByViewport}
            snapToInterval={scrollable && !pageByViewport ? columnWidth : undefined}
            decelerationRate={pageByViewport ? 'fast' : 'normal'}
            directionalLockEnabled
            contentOffset={{ x: initialX, y: 0 }}
            testID={testID !== undefined ? `${testID}-strip` : undefined}
          >
            <Reanimated.View style={[{ width: contentW, height }, stageStyle]}>
              {Array.from({ length: renderRange?.count ?? columns }, (_, i) => (renderRange?.from ?? 0) + i).map((c) => (
                <LiveColumn
                  key={`rule-${c}`}
                  column={c}
                  live={live}
                  inset={0}
                  style={[styles.columnRule, { height }]}
                />
              ))}

              {todayColumn !== null ? (
                <LiveColumn
                  testID="time-grid-today-column"
                  column={todayColumn}
                  live={live}
                  inset={1}
                  style={[styles.todayColumn, { height }]}
                />
              ) : null}

              {onLongPressSlot !== undefined ? (
                <GestureDetector gesture={slotPress}>
                  <View
                    collapsable={false}
                    accessibilityLabel="빈 시간을 길게 눌러 일정 추가"
                    style={StyleSheet.absoluteFill}
                  />
                </GestureDetector>
              ) : null}
              {renderColumns({ columnWidth, live, y })}
              {draft !== null ? (
                <Animated.View
                  pointerEvents="none"
                  testID="time-grid-draft"
                  style={[
                    styles.draft,
                    {
                      left: draft.column * columnWidth + 2,
                      top: y(draft.start) + 1,
                      width: columnWidth - 4,
                      height: y(draft.start + DRAFT_LENGTH_MIN) - y(draft.start) - 2,
                      opacity: draftAnim,
                      transform: [
                        { scale: draftAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                      ],
                    },
                  ]}
                >
                  <TimeBlock
                    top={0}
                    left={0}
                    width={columnWidth - 4}
                    height={y(draft.start + DRAFT_LENGTH_MIN) - y(draft.start) - 2}
                    level={0}
                    title="새 일정"
                    startMinutes={draft.start}
                    endMinutes={draft.start + DRAFT_LENGTH_MIN}
                    focused
                    {...(draftColorOf?.(draft.column) ?? { color: TOKENS.primary, deep: TOKENS.primaryDeep })}
                    accessibilityLabel="새 일정"
                  />
                </Animated.View>
              ) : null}
            </Reanimated.View>
          </Reanimated.ScrollView>
        </View>
      ) : null}

      {nowMinutes !== null ? (
        <View
          pointerEvents="none"
          testID="time-grid-now"
          style={[styles.nowRow, { top: y(nowMinutes) - NOW_PILL_H / 2 }]}
        >
          <View style={styles.nowPill}>
            <Text style={styles.nowPillLabel}>{nowLabel(nowMinutes)}</Text>
          </View>
          <View style={styles.nowDot} />
          <View style={styles.nowLine} />
        </View>
      ) : null}
    </ScrollView>
  );
}

export const TimeGrid = memo(TimeGridImpl);

/**
 * A column-anchored box that follows the live column width: `left` = column
 * edge + inset, `width` = column − inset (rules pass a fixed hairline width
 * in `style`, which wins).
 */
function LiveColumn({
  column,
  live,
  inset,
  style,
  testID,
}: {
  column: number;
  live: LiveColumns;
  inset: number;
  style: React.ComponentProps<typeof View>['style'];
  testID?: string;
}): React.ReactElement {
  const sized = useAnimatedStyle(() => {
    const w = liveWidth(live);
    return { left: column * w + inset, width: w - inset };
  });
  return <Reanimated.View pointerEvents="none" testID={testID} style={[sized, style]} />;
}

const NOW_PILL_H = 19;
const NOW_DOT = 11;

const styles = StyleSheet.create({
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  hourLabel: {
    ...TYPE.mono,
    position: 'absolute',
    left: 0,
    top: -7,
    width: TIME_GUTTER - 6,
    textAlign: 'right',
    color: TOKENS.inkSub,
  },
  hourMeridiem: {
    ...TYPE.axisMeridiem,
    color: TOKENS.inkSub,
  },
  hourLine: {
    position: 'absolute',
    left: TIME_GUTTER,
    right: 0,
    top: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: TOKENS.hair,
  },
  columnRule: {
    position: 'absolute',
    top: 0,
    width: StyleSheet.hairlineWidth, // overrides LiveColumn's width
    backgroundColor: TOKENS.hair,
  },
  todayColumn: {
    position: 'absolute',
    top: 0,
    backgroundColor: withAlpha(TOKENS.primary, 0.06),
  },
  draft: {
    position: 'absolute',
    zIndex: 40,
    ...ELEVATION.dock,
  },
  columns: {
    position: 'absolute',
    top: 0,
    left: TIME_GUTTER,
  },
  nowRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: NOW_PILL_H,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 50,
  },
  nowPill: {
    width: TIME_GUTTER - 6,
    height: NOW_PILL_H,
    borderRadius: RADIUS.full,
    backgroundColor: TOKENS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowPillLabel: {
    ...TYPE.mono,
    color: TOKENS.surface,
  },
  nowDot: {
    width: NOW_DOT,
    height: NOW_DOT,
    borderRadius: RADIUS.full,
    backgroundColor: TOKENS.primary,
    marginLeft: 1,
    marginRight: -NOW_DOT / 2,
  },
  nowLine: {
    flex: 1,
    height: 2,
    backgroundColor: TOKENS.primary,
  },
});
