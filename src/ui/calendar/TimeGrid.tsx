// Shared time grid for the day and week views — ADR-007 §3, §4.
//
// Draws the 00:00–24:00 axis (hour labels "9 AM", hour lines, column rules),
// an optional tinted "today" column and the NOW indicator (orange line + dot +
// pill with white text), inside one vertical ScrollView. Blocks are supplied by
// the caller through `renderColumns`, which receives the measured column width
// and an axis mapper, so day/week wrappers only decide *what* goes in which
// column — never how the axis is drawn.

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { TOKENS, withAlpha } from '../palette';
import { RADIUS } from '../radius';
import { TYPE } from '../typography';
import {
  axisHeight,
  hourLabel,
  minutesAtY,
  minutesToY,
  nowLabel,
  TIME_GUTTER,
} from './time-axis';

export interface TimeGridColumnsLayout {
  columnWidth: number;
  /** Absolute y (px) inside the grid for minutes-from-midnight. */
  y: (minutes: number) => number;
}

export interface TimeGridProps {
  columns: number;
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
   * keep their own presses). Receives the column index and the pressed time,
   * snapped to 30 minutes — used to create an event right there.
   */
  onLongPressSlot?: (column: number, minutes: number) => void;
  testID?: string;
}

/** Hold time before a long press on an empty slot creates an event. */
const SLOT_LONG_PRESS_MS = 400;

const HOURS = Array.from({ length: 25 }, (_, h) => h);

function TimeGridImpl({
  columns,
  hourHeight,
  nowMinutes,
  todayColumn = null,
  initialScrollY,
  scrollKey,
  bottomInset = 0,
  renderColumns,
  onLongPressSlot,
  testID,
}: TimeGridProps): React.ReactElement {
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const columnWidth = width > 0 ? (width - TIME_GUTTER) / columns : 0;
  const height = axisHeight(hourHeight);
  const y = useMemo(() => (m: number) => minutesToY(m, hourHeight), [hourHeight]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: initialScrollY, animated: false });
    // Only re-scroll when the caller says the content changed (date / view);
    // NOW ticks and re-renders must not yank the user's scroll position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey]);

  const onLayout = (e: LayoutChangeEvent): void => setWidth(e.nativeEvent.layout.width);

  const handleSlotLongPress = (e: GestureResponderEvent): void => {
    if (onLongPressSlot === undefined || columnWidth <= 0) return;
    const { locationX, locationY } = e.nativeEvent;
    const column = Math.min(columns - 1, Math.max(0, Math.floor(locationX / columnWidth)));
    onLongPressSlot(column, minutesAtY(locationY, hourHeight));
  };

  return (
    <ScrollView
      ref={scrollRef}
      testID={testID}
      onLayout={onLayout}
      contentOffset={{ x: 0, y: initialScrollY }}
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
        <>
          {Array.from({ length: columns }, (_, c) => (
            <View
              key={`rule-${c}`}
              pointerEvents="none"
              style={[styles.columnRule, { left: TIME_GUTTER + c * columnWidth, height }]}
            />
          ))}

          {todayColumn !== null ? (
            <View
              pointerEvents="none"
              testID="time-grid-today-column"
              style={[
                styles.todayColumn,
                { left: TIME_GUTTER + todayColumn * columnWidth + 1, width: columnWidth - 1, height },
              ]}
            />
          ) : null}

          <View style={[styles.columns, { width: width - TIME_GUTTER, height }]}>
            {onLongPressSlot !== undefined ? (
              <Pressable
                testID="time-grid-slots"
                accessibilityLabel="빈 시간을 길게 눌러 일정 추가"
                onLongPress={handleSlotLongPress}
                delayLongPress={SLOT_LONG_PRESS_MS}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            {renderColumns({ columnWidth, y })}
          </View>
        </>
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
    width: StyleSheet.hairlineWidth,
    backgroundColor: TOKENS.hair,
  },
  todayColumn: {
    position: 'absolute',
    top: 0,
    backgroundColor: withAlpha(TOKENS.primary, 0.06),
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
