// Shared time grid for the day and week views — ADR-007 §3, §4.
//
// Draws the 00:00–24:00 axis (hour labels "9 AM", hour lines, column rules),
// an optional tinted "today" column and the NOW indicator (orange line + dot +
// pill with white text), inside one vertical ScrollView. Blocks are supplied by
// the caller through `renderColumns`, which receives the measured column width
// and an axis mapper, so day/week wrappers only decide *what* goes in which
// column — never how the axis is drawn.

import { createContext, memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

import { elevationFor } from '../elevation';
import { withAlpha } from '../palette';
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
import { makeStyles, useTheme } from '../appearance';

/**
 * Column width during a live pinch. Normally everything is laid out by React
 * at `columnWidth`; while `sizing` is on, worklets use viewport ÷ `span`
 * instead (UI thread, every frame). Worklets read the fields as locals —
 * destructure first, never call through the object.
 */
/** Lets a dragged block freeze the grid's scrolling (ADR-015). */
export interface TimeGridDrag {
  begin: () => void;
  end: () => void;
}
export const TimeGridDragContext = createContext<TimeGridDrag | null>(null);

export interface LiveColumns {
  span: SharedValue<number>;
  sizing: SharedValue<boolean>;
  viewportW: number;
  columnWidth: number;
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
  /** True from pinch start until the new zoom has been rendered. */
  sizing: SharedValue<boolean>;
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
  /** The user's vertical scroll came to rest at this offset. */
  onScrollEndY?: (y: number) => void;
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
  onScrollEndY,
  renderColumns,
  onLongPressSlot,
  draftColorOf,
  testID,
}: TimeGridProps): React.ReactElement {
  const theme = useTheme();
  const styles = useStyles();
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [viewH, setViewH] = useState(0);
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
  const ownSizing = useSharedValue(false);
  const spanSV = strip?.span ?? ownSpan;
  const sizingSV = strip?.sizing ?? ownSizing;
  const live: LiveColumns = { span: spanSV, sizing: sizingSV, viewportW, columnWidth };
  // Native scrolling does the motion (iOS physics); the worklet only mirrors
  // the offset for the header and tells the screen which days are in view.
  const report = strip?.onVisibleColumn;
  const userScrolling = useSharedValue(false);
  const lastWeek = useSharedValue(-1);
  // Column at the strip's left edge for a scroll offset — measured with the
  // *live* width (a pinch changes it before React re-renders), -1 = unknown.
  const columnAt = (x: number): number => {
    'worklet';
    const w = sizingSV.value && spanSV.value > 0 ? viewportW / spanSV.value : columnWidth;
    return w > 0 ? Math.round(x / w) : -1;
  };
  const onHScroll = useAnimatedScrollHandler(
    {
      onScroll: (e) => {
        scrollX.value = e.contentOffset.x;
        // A pinch moves the offset itself; only user scrolling reports.
        if (locked.value || !userScrolling.value || report === undefined) return;
        const col = columnAt(e.contentOffset.x);
        if (col < 0) return;
        const week = Math.floor(col / 7);
        if (week !== lastWeek.value) {
          lastWeek.value = week;
          runOnJS(report)(col);
        }
      },
      onBeginDrag: (e) => {
        userScrolling.value = !locked.value;
        const col = columnAt(e.contentOffset.x);
        lastWeek.value = col < 0 ? -1 : Math.floor(col / 7);
      },
      onEndDrag: (e) => {
        // No fling → this is where it settles (a fling re-arms in onMomentumBegin).
        const wasUser = userScrolling.value;
        userScrolling.value = false;
        const col = columnAt(e.contentOffset.x);
        if (wasUser && !locked.value && report !== undefined && col >= 0) runOnJS(report)(col);
      },
      onMomentumBegin: () => {
        userScrolling.value = !locked.value;
      },
      onMomentumEnd: (e) => {
        const wasUser = userScrolling.value;
        userScrolling.value = false;
        const col = columnAt(e.contentOffset.x);
        if (wasUser && !locked.value && report !== undefined && col >= 0) runOnJS(report)(col);
      },
    },
    [viewportW, columnWidth, report],
  );
  // A whole week on screen pages week by week; a zoomed week glides and
  // settles on a day boundary.
  const pageByViewport = scrollable && visibleColumns === 7;
  const pendingX = useRef<number | null>(null);
  const onStripContentSize = (w: number): void => {
    const x = pendingX.current;
    if (x === null || w < x + viewportW) return;
    pendingX.current = null;
    hRef.current?.scrollTo({ x, animated: false });
    scrollX.value = x;
  };
  const initialX = Math.min(Math.max((strip?.initialColumn ?? 0) * columnWidth, 0), Math.max(contentW - viewportW, 0));
  useEffect(() => {
    if (columnWidth <= 0) return;
    // A freshly mounted strip has no content size yet and would clamp this to
    // 0 — keep it pending and re-apply once the content is wide enough.
    pendingX.current = initialX;
    hRef.current?.scrollTo({ x: initialX, animated: false });
    scrollX.value = initialX;
    // Re-position only when the caller's key or the column size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strip?.key, columnWidth]);
  const stageStyle = useAnimatedStyle(() => {
    const w = sizingSV.value && spanSV.value > 0 ? viewportW / spanSV.value : columnWidth;
    return { width: columns * w };
  });
  // A block being dragged (DraggableBlock) freezes both scroll directions.
  const dragLock = useSharedValue(false);
  const [dragging, setDragging] = useState(false);
  const drag = useMemo<TimeGridDrag>(
    () => ({
      begin: () => {
        dragLock.value = true;
        setDragging(true);
      },
      end: () => {
        dragLock.value = false;
        setDragging(false);
      },
    }),
    [dragLock],
  );
  const stripProps = useAnimatedProps(() => ({ scrollEnabled: scrollable && !locked.value && !dragLock.value }));
  const height = axisHeight(hourHeight);
  const y = useMemo(() => (m: number) => minutesToY(m, hourHeight), [hourHeight]);

  // Never open past the bottom: late in the evening "now − 90 min" sits lower
  // than the last scrollable position, and iOS would show blank space below
  // 12AM until the next drag.
  const openY =
    viewH > 0 ? Math.min(initialScrollY, Math.max(0, height + bottomInset - viewH)) : initialScrollY;
  const measured = viewH > 0;
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: openY, animated: false });
    // Only re-scroll when the caller says the content changed (date / view);
    // NOW ticks and re-renders must not yank the user's scroll position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey, measured]);

  const onLayout = (e: LayoutChangeEvent): void => {
    setWidth(e.nativeEvent.layout.width);
    setViewH(e.nativeEvent.layout.height);
  };

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
    <TimeGridDragContext.Provider value={drag}>
    <ScrollView
      ref={scrollRef}
      testID={testID}
      scrollEnabled={!dragging}
      onLayout={onLayout}
      contentOffset={{ x: 0, y: openY }}
      directionalLockEnabled
      onMomentumScrollEnd={onScrollEndY === undefined ? undefined : (e) => onScrollEndY(e.nativeEvent.contentOffset.y)}
      onScrollEndDrag={
        onScrollEndY === undefined
          ? undefined
          : (e) => {
              // Only a release without a fling is the resting point.
              if ((e.nativeEvent.velocity?.y ?? 0) === 0) onScrollEndY(e.nativeEvent.contentOffset.y);
            }
      }
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
            onContentSizeChange={onStripContentSize}
            testID={testID !== undefined ? `${testID}-strip` : undefined}
          >
            <Reanimated.View style={[{ width: contentW, height }, stageStyle]}>
              {Array.from({ length: renderRange?.count ?? columns }, (_, i) => (renderRange?.from ?? 0) + i).map((c) => (
                <LiveColumn
                  key={`rule-${c}`}
                  column={c}
                  live={live}
                  inset={0}
                  fixedWidth={StyleSheet.hairlineWidth}
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
                    {...(draftColorOf?.(draft.column) ?? { color: theme.t.primary, deep: theme.t.primaryDeep })}
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
    </TimeGridDragContext.Provider>
  );
}

export const TimeGrid = memo(TimeGridImpl);

/**
 * A column-anchored box that follows the live column width: `left` = column
 * edge + inset, `width` = column − inset, or `fixedWidth` (rules). Animated
 * values override any static style, so a fixed width must be passed here.
 */
function LiveColumn({
  column,
  live,
  inset,
  fixedWidth,
  style,
  testID,
}: {
  column: number;
  live: LiveColumns;
  inset: number;
  fixedWidth?: number;
  style: React.ComponentProps<typeof View>['style'];
  testID?: string;
}): React.ReactElement {
  const { span, sizing, viewportW, columnWidth } = live;
  const sized = useAnimatedStyle(() => {
    const w = sizing.value && span.value > 0 ? viewportW / span.value : columnWidth;
    return { left: column * w + inset, width: fixedWidth ?? w - inset };
  });
  return (
    <Reanimated.View
      pointerEvents="none"
      testID={testID}
      style={[style, { left: column * columnWidth + inset, width: fixedWidth ?? columnWidth - inset }, sized]}
    />
  );
}

const NOW_PILL_H = 20;
const NOW_DOT = 11;

const useStyles = makeStyles((th) => ({
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
    color: th.t.inkSub,
  },
  hourMeridiem: {
    ...TYPE.axisMeridiem,
    color: th.t.inkSub,
  },
  hourLine: {
    position: 'absolute',
    left: TIME_GUTTER,
    right: 0,
    top: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: th.t.gridLine,
  },
  columnRule: {
    position: 'absolute',
    top: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: th.t.gridLine,
  },
  todayColumn: {
    position: 'absolute',
    top: 0,
    backgroundColor: withAlpha(th.t.primary, 0.06),
  },
  draft: {
    position: 'absolute',
    zIndex: 40,
    ...elevationFor(th).dock,
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
    // "12:07" (5 mono glyphs) needs the full gutter — 34pt clipped the ends.
    width: TIME_GUTTER - 2,
    height: NOW_PILL_H,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowPillLabel: {
    ...TYPE.mono,
    // A text box exactly the pill's height, centred both ways (the 12pt line
    // box sat high in the 19pt pill and the glyphs looked cut).
    fontSize: 11,
    lineHeight: NOW_PILL_H,
    height: NOW_PILL_H,
    letterSpacing: -0.3,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    // Contrast pass: dark digits on the orange pill (white was 2.7:1).
    color: th.t.onLight,
  },
  nowDot: {
    width: NOW_DOT,
    height: NOW_DOT,
    borderRadius: RADIUS.full,
    backgroundColor: th.t.primary,
    marginLeft: 1,
    marginRight: -NOW_DOT / 2,
  },
  nowLine: {
    flex: 1,
    height: 2,
    backgroundColor: th.t.primary,
  },
}));
