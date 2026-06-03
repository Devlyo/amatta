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
import { AppState, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';

import { MAX_CHILDREN } from '../../src/domain/constants';
import { isKoreanHoliday } from '../../src/domain/korean-holidays';
import { expandOccurrences } from '../../src/domain/occurrences';
import type { Child, Occurrence } from '../../src/domain/types';
import { useChecklistStore } from '../../src/state/checklist-store';
import { useChildrenStore } from '../../src/state/children-store';
import { usePickupLogStore } from '../../src/state/pickup-log-store';
import { useSchedulesStore } from '../../src/state/schedules-store';
import { useTodosStore } from '../../src/state/todos-store';
import { useUiStore } from '../../src/state/ui-store';
import { BottomDock } from '../../src/ui/common/BottomDock';
import { EmptyChildrenState } from '../../src/ui/common/EmptyChildrenState';
import { KidPillsHeader } from '../../src/ui/daily/KidPillsHeader';
import { PickupCarousel } from '../../src/ui/daily/PickupCarousel';
import { ScheduleGrid } from '../../src/ui/daily/ScheduleGrid';
import { TabStrip, type DailyTabKey } from '../../src/ui/daily/TabStrip';
import { TodoTabContent } from '../../src/ui/daily/TodoTabContent';
import { TopBar } from '../../src/ui/daily/TopBar';
import { TOKENS } from '../../src/ui/palette';
import { formatKoreanShortDate, isToday, shiftIsoDate } from '../../src/ui/utils/date';

const SWIPE_THRESHOLD = 60;

function currentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export default function DailyViewScreen(): React.ReactElement {
  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);
  const currentDate = useUiStore((s) => s.currentDate);
  const setCurrentDate = useUiStore((s) => s.setCurrentDate);
  const openEditSheet = useUiStore((s) => s.openEditSheet);
  const router = useRouter();

  // Horizontal swipe ±1 day on the schedule body. activeOffsetX delays
  // activation until the user commits to a horizontal motion so vertical
  // scroll inside ScheduleGrid wins for predominantly-vertical drags.
  // Until R3 ships the CalendarDrawer, this is the user's primary
  // date-navigation gesture.
  const panGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      if (e.translationX <= -SWIPE_THRESHOLD) {
        setCurrentDate(shiftIsoDate(currentDate, 1));
      } else if (e.translationX >= SWIPE_THRESHOLD) {
        setCurrentDate(shiftIsoDate(currentDate, -1));
      }
    })
    .runOnJS(true);

  const [tab, setTab] = useState<DailyTabKey>('schedule');
  const [nowMinutes, setNowMinutes] = useState<number>(() => currentMinutes());

  // NOW line tick — ADR-003 §B. The grid's lime now-line + pill must
  // advance every minute (8:30 → 8:31 → ...) without requiring user input,
  // so we align to the next minute boundary, then fire setInterval(60s).
  // AppState=active also re-syncs immediately + restarts the alignment in
  // case the device was backgrounded across many minutes.
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tick = (): void => setNowMinutes(currentMinutes());

    const start = (): void => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (intervalId !== null) clearInterval(intervalId);
      const now = new Date();
      const msUntilNextMinute =
        (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      timeoutId = setTimeout(() => {
        tick();
        intervalId = setInterval(tick, 60_000);
      }, msUntilNextMinute);
    };

    start();

    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        tick();
        start();
      }
    });

    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (intervalId !== null) clearInterval(intervalId);
      sub.remove();
    };
  }, []);

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

  const occurrences = useMemo<Occurrence[]>(
    () =>
      expandOccurrences(
        schedules,
        exceptions,
        { from: currentDate, to: currentDate },
        childrenById,
      ),
    [schedules, exceptions, currentDate, childrenById],
  );

  const completionMap = usePickupLogStore((s) => s.completionMap);
  const pickupLogIsComplete = useCallback(
    (scheduleId: number, occurrenceDateInt: number): boolean =>
      completionMap.has(`${scheduleId}|${occurrenceDateInt}`),
    [completionMap],
  );

  const undoneTodos = useTodosStore(
    (s) => s.todos.filter((t) => !t.isDone).length,
  );
  const undoneChecklist = useChecklistStore((s) => {
    let n = 0;
    for (const items of s.itemsByScheduleId.values()) {
      for (const item of items) if (!item.isDone) n += 1;
    }
    return n;
  });
  const todoCount = undoneTodos + undoneChecklist;

  const handleBlockPress = (occ: Occurrence): void => {
    // TODO(R3-drawers): the prototype routes to EventDetailDrawer. Until R3
    // ports app-event-form.jsx into ScheduleEditSheet, we open the existing
    // editAll sheet directly so users can still edit an occurrence.
    openEditSheet('editAll', {
      scheduleId: occ.scheduleId,
      occurrenceDate: currentDate,
    });
  };

  const handlePressAdd = (): void => {
    // TODO(R3-drawers): replace with NewEventDrawer flow.
    openEditSheet('create', { preFill: { date: currentDate } });
  };

  const handlePressGear = (): void => {
    router.push('/(tabs)/settings');
  };

  const handlePressDate = (): void => {
    useUiStore.getState().openCalendar();
  };

  const handlePressSearch = (): void => {
    useUiStore.getState().openSearch();
  };

  const handlePressWeek = (): void => {
    // WEEK toggle = multi-kid weekly grid. (Single-kid weekly is reached
    // by tapping a kid pill instead — see KidPillsHeader.onPressKid below.)
    router.push('/multi');
  };

  if (children.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyChildrenState />
      </SafeAreaView>
    );
  }

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

      {/* Section 4 — Tabs */}
      <TabStrip active={tab} onChange={setTab} todoCount={todoCount} />

      {tab === 'schedule' ? (
        <GestureDetector gesture={panGesture}>
          <View style={styles.scheduleBody}>
            {/* Section 5 — Kid pill header row */}
            <KidPillsHeader
              kids={visibleChildren}
              onPressKid={(id) => router.push(`/child/${id}`)}
            />
            {/* Section 6 — Day grid (scrolls vertically) */}
            <ScheduleGrid
              kids={visibleChildren}
              occurrences={occurrences}
              nowMinutes={nowMinutes}
              currentDate={currentDate}
              onBlockPress={handleBlockPress}
            />
          </View>
        </GestureDetector>
      ) : (
        <TodoTabContent />
      )}

      {/* Section 7 — Floating bottom dock */}
      <BottomDock
        onPressAdd={handlePressAdd}
        onPressGear={handlePressGear}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scheduleBody: { flex: 1 },
  safe: { flex: 1, backgroundColor: TOKENS.surface },
});
