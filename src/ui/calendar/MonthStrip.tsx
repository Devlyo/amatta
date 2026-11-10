// Month view as a native paging strip — ADR-007 §4.
//
// Months sit side by side in one horizontal ScrollView (`pages` pages from
// `origin`), paged by iOS itself, so a drag follows the finger and a flick
// lands on the next month with system physics. Only the current month ±1 is
// rendered; the rest of the strip is empty until the window moves there.
// The weekday names row stays put above the strip.

import { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Reanimated, { useAnimatedProps, type AnimatedRef, type SharedValue } from 'react-native-reanimated';

import type { PersonKey } from '../../domain/people-filter';
import type { Child, ISODate, Occurrence } from '../../domain/types';
import { shiftIsoMonth } from '../utils/date';
import { monthsBetween } from './calendar-layout';
import { MonthNames, MonthView, type MonthLiveRows } from './MonthView';

interface Props {
  /** The current date — its month is the page in view. */
  anchor: ISODate;
  /** Any date in the month at page 0. */
  origin: ISODate;
  pages: number;
  /** Re-positions the strip on the anchor's page whenever it changes. */
  jumpKey: string;
  today: ISODate;
  kids: readonly Child[];
  occurrences: readonly Occurrence[];
  inactive: readonly PersonKey[];
  rowHeight: number;
  live?: MonthLiveRows;
  /** True while pinching — paging is switched off. */
  locked?: SharedValue<boolean>;
  scrollRef?: AnimatedRef<Reanimated.ScrollView>;
  /** The user paged to another month (page index from `origin`). */
  onPage: (page: number) => void;
  onPressDay: (date: ISODate) => void;
}

function MonthStripImpl({
  anchor,
  origin,
  pages,
  jumpKey,
  today,
  kids,
  occurrences,
  inactive,
  rowHeight,
  live,
  locked,
  scrollRef,
  onPage,
  onPressDay,
}: Props): React.ReactElement {
  const ownRef = useRef<Reanimated.ScrollView>(null);
  const ref = scrollRef ?? ownRef;
  const [pageW, setPageW] = useState(0);
  const onLayout = (e: LayoutChangeEvent): void => setPageW(e.nativeEvent.layout.width);

  const current = monthsBetween(origin, anchor);
  const targetX = current * pageW;
  // A fresh strip has no content size yet and would clamp the offset to 0 —
  // keep the target pending until the content is wide enough.
  const pendingX = useRef<number | null>(null);
  useEffect(() => {
    if (pageW <= 0) return;
    pendingX.current = targetX;
    ref.current?.scrollTo({ x: targetX, animated: false });
    // Only on jumps (and size changes), never on the user's own paging.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpKey, pageW]);
  const onContentSize = (w: number): void => {
    const x = pendingX.current;
    if (x === null || w < x + pageW) return;
    pendingX.current = null;
    ref.current?.scrollTo({ x, animated: false });
  };

  const stripProps = useAnimatedProps(() => ({ scrollEnabled: locked === undefined || !locked.value }));
  const settle = (x: number): void => {
    if (pageW <= 0) return;
    const page = Math.round(x / pageW);
    if (page !== current) onPage(page);
  };

  return (
    <View style={styles.root}>
      <MonthNames />
      <View style={styles.viewport} onLayout={onLayout} testID="month-strip-viewport">
        {pageW > 0 ? (
          <Reanimated.ScrollView
            ref={ref}
            testID="month-strip"
            horizontal
            pagingEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            animatedProps={stripProps}
            contentOffset={{ x: targetX, y: 0 }}
            onContentSizeChange={onContentSize}
            onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
            onScrollEndDrag={(e) => {
              // Released exactly on a page → no momentum event follows.
              if ((e.nativeEvent.velocity?.x ?? 0) === 0) settle(e.nativeEvent.contentOffset.x);
            }}
          >
            <View style={{ width: pageW * pages, height: '100%' }}>
              {[current - 1, current, current + 1]
                .filter((p) => p >= 0 && p < pages)
                .map((p) => {
                  const month = shiftIsoMonth(origin, p);
                  return (
                    <View
                      key={(month as unknown as string).slice(0, 7)}
                      style={[styles.page, { left: p * pageW, width: pageW }]}
                    >
                      <MonthView
                        anchor={month}
                        today={today}
                        kids={kids}
                        occurrences={occurrences}
                        inactive={inactive}
                        zoomed={false}
                        rowHeight={rowHeight}
                        live={live}
                        showNames={false}
                        testID={p === current ? 'month-view' : `month-view-${p - current}`}
                        onPressDay={onPressDay}
                      />
                    </View>
                  );
                })}
            </View>
          </Reanimated.ScrollView>
        ) : null}
      </View>
    </View>
  );
}

export const MonthStrip = memo(MonthStripImpl);

const styles = StyleSheet.create({
  root: { flex: 1 },
  viewport: { flex: 1 },
  page: { position: 'absolute', top: 0, bottom: 0 },
});
