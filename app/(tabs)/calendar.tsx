// 캘린더 탭 (ADR-007). Phase 2 step 1: the previous daily screen, moved here
// unchanged apart from the dock/tab strip (now the app tab bar). Rewritten on
// the shared TimeGrid in the next step.

// 1:1 port of DailyB (docs/design/amatta-v1/app-daily-b.jsx) into the schedule
// app's daily-view screen. See that file for the source layout. Sections (in
// render order):
//   1. SafeAreaView (replaces the prototype's hard `paddingTop: 54`).
//   2. TopBar         — "오늘" + caption + ViewToggle + search.
//   3. (PickupCarousel SKIPPED — needs_pickup is v2 schema, see below.)
//   4. TabStrip       — 일정 / 준비물 & 할일 (todo tab routes to placeholder).
//   5. KidPillsHeader — gutter (40) + N pill buttons that link to /child/[id].
//   6. ScheduleGrid   — vertical scroll, 18 hours, slotH=32, kid columns +
//                       absolute blocks + now line.
//   7. BottomDock     — floating home/+/gear pill.
//
// The 4 drawers (Calendar / Search / NewEvent / EventDetail) are TODO-stubs
// in R2; '+' falls back to the existing useUiStore.openEditSheet flow until
// the form port lands in R3.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { MAX_CHILDREN } from '../../src/domain/constants';
import { isKoreanHoliday } from '../../src/domain/korean-holidays';
import { expandOccurrences } from '../../src/domain/occurrences';
import type { Child, ISODate, Occurrence } from '../../src/domain/types';
import { useChildrenStore } from '../../src/state/children-store';
import { usePickupLogStore } from '../../src/state/pickup-log-store';
import { useSchedulesStore } from '../../src/state/schedules-store';
import { useUiStore } from '../../src/state/ui-store';
import { EmptyDayState } from '../../src/ui/daily/EmptyDayState';
import { KidPillsHeader } from '../../src/ui/daily/KidPillsHeader';
import { PickupCarousel } from '../../src/ui/daily/PickupCarousel';
import { ScheduleGrid } from '../../src/ui/daily/ScheduleGrid';
import { TopBar } from '../../src/ui/daily/TopBar';
import { TOKENS } from '../../src/ui/palette';
import { useNowMinutes } from '../../src/ui/calendar/useNowMinutes';
import { formatKoreanShortDate, isToday, shiftIsoDate } from '../../src/ui/utils/date';

const SWIPE_THRESHOLD = 60;


export default function DailyViewScreen(): React.ReactElement {
  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);
  const currentDate = useUiStore((s) => s.currentDate);
  const setCurrentDate = useUiStore((s) => s.setCurrentDate);
  const router = useRouter();

  // Refine #1 — the ±1-day swipe is a 3-PAGE CAROUSEL (prev / current / next),
  // not a slide-to-white. We render the body for all three days side by side in
  // a horizontal track of width 3×pageWidth and translate the track to center
  // on the current day (rest = -pageWidth). While the user drags, the neighbor
  // day's real schedule is already on-screen sliding in — no white gap.
  //
  // `dragX` (the live finger translation) is driven on the UI thread (a
  // reanimated worklet, never the JS thread). On release past threshold we
  // `withTiming` the track to the neighbor page, then via `runOnJS` commit
  // setCurrentDate(±1) and snap the track back to the centered rest position so
  // prev/next re-render around the NEW current day.
  //
  // The gesture wraps BOTH tab bodies (Item 8), so swiping either the 일정 grid
  // or the 준비물 & 할일 list pages the date. activeOffsetX keeps
  // predominantly-vertical drags (grid/list scroll, and the todo row's own
  // swipe-to-delete Swipeable, which activates on a smaller horizontal offset
  // within its row) from triggering the date swipe.
  const [pageWidth, setPageWidth] = useState(0);
  const dragX = useSharedValue(0);
  // Becomes true only after we have a measured pageWidth; until then the track
  // stays centered with no animation (avoids a flash before first layout).
  const pageWidthSv = useSharedValue(0);

  const onTrackLayout = useCallback((e: LayoutChangeEvent): void => {
    setPageWidth(e.nativeEvent.layout.width);
  }, []);

  useEffect(() => {
    pageWidthSv.value = pageWidth;
  }, [pageWidth, pageWidthSv]);

  const commitShift = useCallback(
    (dir: -1 | 1): void => {
      // dir = +1 → user swiped left → next day; -1 → swiped right → prev day.
      setCurrentDate(shiftIsoDate(currentDate, dir));
      // Snap the track instantly back to the centered rest (dragX 0): prev/next
      // now re-render around the new current day, so no visible jump occurs.
      dragX.value = 0;
    },
    [currentDate, setCurrentDate, dragX],
  );

  const panGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      dragX.value = e.translationX;
    })
    .onEnd((e) => {
      const w = pageWidthSv.value;
      if (w === 0) {
        dragX.value = withTiming(0, { duration: 160 });
        return;
      }
      if (e.translationX <= -SWIPE_THRESHOLD) {
        // Page to the next day: slide the track fully left by one page.
        dragX.value = withTiming(-w, { duration: 160 }, (done) => {
          if (done) runOnJS(commitShift)(1);
        });
      } else if (e.translationX >= SWIPE_THRESHOLD) {
        dragX.value = withTiming(w, { duration: 160 }, (done) => {
          if (done) runOnJS(commitShift)(-1);
        });
      } else {
        // Below threshold — snap back to the centered rest.
        dragX.value = withTiming(0, { duration: 160 });
      }
    });

  // Track transform: rest position is -pageWidth (current day centered); the
  // live drag adds on top. Width 3×page, so prev sits at [0,page], current at
  // [page,2page], next at [2page,3page].
  const trackStyle = useAnimatedStyle(() => ({
    width: pageWidthSv.value * 3,
    transform: [{ translateX: -pageWidthSv.value + dragX.value }],
  }));

  const nowMinutes = useNowMinutes();

  // First 4 children, sorted by id ASC (stable insertion order). Hooks must
  // run unconditionally — the empty-state branch happens below.
  const visibleChildren = useMemo<Child[]>(
    () => [...children].sort((a, b) => a.id - b.id).slice(0, MAX_CHILDREN),
    [children],
  );

  const childrenById = useMemo(() => {
    const m = new Map<number, Child>();
    for (const c of visibleChildren) m.set(c.id, c);
    return m;
  }, [visibleChildren]);

  // Carousel neighbour dates (Refine #1). Expand a single ±1-day window
  // covering prev..next once, then bucket per day so each page renders its
  // own occurrences with no white gap during the swipe.
  const prevDate = useMemo(() => shiftIsoDate(currentDate, -1), [currentDate]);
  const nextDate = useMemo(() => shiftIsoDate(currentDate, 1), [currentDate]);

  const occurrencesByDate = useMemo<Map<string, Occurrence[]>>(() => {
    const expanded = expandOccurrences(
      schedules,
      exceptions,
      { from: prevDate, to: nextDate },
      childrenById,
    );
    const m = new Map<string, Occurrence[]>();
    m.set(prevDate as unknown as string, []);
    m.set(currentDate as unknown as string, []);
    m.set(nextDate as unknown as string, []);
    for (const occ of expanded) {
      const key = occ.date as unknown as string;
      const bucket = m.get(key);
      if (bucket !== undefined) bucket.push(occ);
    }
    return m;
  }, [schedules, exceptions, prevDate, currentDate, nextDate, childrenById]);

  const occurrences = useMemo<Occurrence[]>(
    () => occurrencesByDate.get(currentDate as unknown as string) ?? [],
    [occurrencesByDate, currentDate],
  );

  const completionMap = usePickupLogStore((s) => s.completionMap);
  const pickupLogIsComplete = useCallback(
    (scheduleId: number, occurrenceDateInt: number): boolean =>
      completionMap.has(`${scheduleId}|${occurrenceDateInt}`),
    [completionMap],
  );

  const handleBlockPress = (occ: Occurrence): void => {
    // Spec: tapping a daily block opens the read-only EventDetailDrawer
    // (app-event-detail.jsx). The drawer's top-right '수정' routes into
    // the editAll sheet from there.
    router.push({
      pathname: '/event/detail',
      params: { scheduleId: String(occ.scheduleId), occurrenceDate: currentDate },
    });
  };

  const handlePressDate = (): void => {
    router.push('/date-picker');
  };

  const handlePressSearch = (): void => {
    router.push('/search');
  };

  const handlePressWeek = (): void => {
    // WEEK toggle = multi-kid weekly grid. (Single-kid weekly is reached
    // by tapping a kid pill instead — see KidPillsHeader.onPressKid below.)
    router.push('/multi');
  };

  // One carousel page (Refine #1). Width = pageWidth so 3 pages tile the
  // 3×page track. The schedule tab renders that day's own occurrences (real
  // neighbour data → no white gap). The 준비물 & 할일 tab is date-bound through
  // the store inside TodoTabContent (not threadable here), so neighbour pages
  // render the same list as filler during the drag; after the commit the store
  // date updates and the content refreshes to the new day.
  const renderPage = (date: ISODate): React.ReactElement => {
    const pageOccurrences =
      occurrencesByDate.get(date as unknown as string) ?? [];
    return (
      <View key={date as unknown as string} style={[styles.page, { width: pageWidth }]}>
        <>
            <KidPillsHeader
              kids={visibleChildren}
              onPressKid={(id) => router.push(`/child/${id}`)}
            />
            {pageOccurrences.length === 0 ? (
              <EmptyDayState />
            ) : (
              <ScheduleGrid
                kids={visibleChildren}
                occurrences={pageOccurrences}
                nowMinutes={nowMinutes}
                currentDate={date}
                onBlockPress={handleBlockPress}
              />
            )}
          </>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Section 2 — Top bar */}
      <TopBar
        caption={formatKoreanShortDate(currentDate)}
        isToday={isToday(currentDate)}
        isHoliday={isKoreanHoliday(currentDate)}
        onPressDate={handlePressDate}
        onPressSearch={handlePressSearch}
        onPressWeek={handlePressWeek}
      />

      {/* Section 3 — Pickup carousel (returns null when no cards) */}
      <PickupCarousel
        occurrences={occurrences}
        childrenById={childrenById}
        nowMinutes={nowMinutes}
        currentDate={currentDate}
        pickupLogIsComplete={pickupLogIsComplete}
      />

      {/* Sections 5/6 (schedule) + 준비물 & 할일 body share one pan gesture
          (Item 8) and a 3-page carousel track (Refine #1) so a horizontal
          swipe on EITHER tab pages the date ±1 with the neighbour day already
          visible (no white gap). Outer View is the viewport (1 page wide,
          overflow hidden); the inner Animated track is 3 pages wide. */}
      <View style={styles.viewport} onLayout={onTrackLayout}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.track, trackStyle]}>
            {renderPage(prevDate)}
            {renderPage(currentDate)}
            {renderPage(nextDate)}
          </Animated.View>
        </GestureDetector>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Viewport = exactly one page wide; clips the 3-page track so only the
  // current day is visible at rest.
  viewport: { flex: 1, overflow: 'hidden' },
  // Track holds prev/current/next pages in a row; width + translate are set
  // by the animated `trackStyle`.
  track: { height: '100%', flexDirection: 'row' },
  // Each page fills the viewport height; width is set inline from pageWidth.
  page: { height: '100%' },
  safe: { flex: 1, backgroundColor: TOKENS.surface },
});
