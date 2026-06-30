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
import { Redirect, useRouter } from 'expo-router';

import { MAX_CHILDREN } from '../../src/domain/constants';
import { isKoreanHoliday } from '../../src/domain/korean-holidays';
import { expandOccurrences } from '../../src/domain/occurrences';
import type { Child, Occurrence } from '../../src/domain/types';
import { useChecklistStore } from '../../src/state/checklist-store';
import { useChecklistCompletionStore } from '../../src/state/checklist-completion-store';
import { useChildrenStore } from '../../src/state/children-store';
import { usePickupLogStore } from '../../src/state/pickup-log-store';
import { useSchedulesStore } from '../../src/state/schedules-store';
import { useTodosStore } from '../../src/state/todos-store';
import { useUiStore } from '../../src/state/ui-store';
import { BottomDock } from '../../src/ui/common/BottomDock';
import { EmptyDayState } from '../../src/ui/daily/EmptyDayState';
import { KidPillsHeader } from '../../src/ui/daily/KidPillsHeader';
import { isoToYyyymmdd } from '../../src/ui/daily/pickup-data';
import { PickupCarousel } from '../../src/ui/daily/PickupCarousel';
import { ScheduleGrid } from '../../src/ui/daily/ScheduleGrid';
import { TabStrip, type DailyTabKey } from '../../src/ui/daily/TabStrip';
import { TodoTabContent } from '../../src/ui/daily/TodoTabContent';
import { TopBar } from '../../src/ui/daily/TopBar';
import { TOKENS } from '../../src/ui/palette';
import { formatKoreanShortDate, isDueOnDate, isToday, shiftIsoDate, todayIso } from '../../src/ui/utils/date';

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

  // Todos are date-bound: only count the ones due on the viewed day so the
  // tab badge matches the (date-filtered) list inside the 준비물 & 할일 tab.
  const todos = useTodosStore((s) => s.todos);
  const undoneTodos = useMemo(
    () => todos.filter((t) => !t.isDone && isDueOnDate(t.dueAt, currentDate)).length,
    [todos, currentDate],
  );
  // Checklist badge mirrors ChecklistSection (v6): count items whose schedule
  // occurs on the viewed date, respecting membership (NULL = recurring, set =
  // day-specific) and per-occurrence completion (checklist_completion), NOT the
  // frozen is_done. Keeps the badge in sync with the date-filtered 준비물 list.
  const itemsByScheduleId = useChecklistStore((s) => s.itemsByScheduleId);
  const checklistCompletionMap = useChecklistCompletionStore((s) => s.completionMap);
  const undoneChecklist = useMemo(() => {
    const dateInt = isoToYyyymmdd(currentDate);
    let n = 0;
    for (const occ of occurrences) {
      const items = itemsByScheduleId.get(occ.scheduleId);
      if (items === undefined) continue;
      for (const item of items) {
        if (item.occurrenceDate !== null && item.occurrenceDate !== dateInt) continue;
        if (!checklistCompletionMap.has(`${item.id}|${dateInt}`)) n += 1;
      }
    }
    return n;
  }, [occurrences, itemsByScheduleId, checklistCompletionMap, currentDate]);
  const todoCount = undoneTodos + undoneChecklist;

  const handleBlockPress = (occ: Occurrence): void => {
    // Spec: tapping a daily block opens the read-only EventDetailDrawer
    // (app-event-detail.jsx). The drawer's top-right '수정' routes into
    // the editAll sheet from there.
    router.push({
      pathname: '/event/detail',
      params: { scheduleId: String(occ.scheduleId), occurrenceDate: currentDate },
    });
  };

  const handlePressAdd = (): void => {
    router.push({ pathname: '/schedule/edit', params: { mode: 'create', date: currentDate } });
  };

  const handlePressGear = (): void => {
    router.push('/(tabs)/settings');
  };

  const handlePressDate = (): void => {
    router.push('/calendar');
  };

  const handlePressSearch = (): void => {
    router.push('/search');
  };

  const handlePressWeek = (): void => {
    // WEEK toggle = multi-kid weekly grid. (Single-kid weekly is reached
    // by tapping a kid pill instead — see KidPillsHeader.onPressKid below.)
    router.push('/multi');
  };

  // Zero-kids state: route into onboarding. Replace (not push) so the
  // back stack stays clean on first launch + post-wipe states.
  if (children.length === 0) {
    return <Redirect href="/onboarding/welcome" />;
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
            {/* Section 6 — Day grid (scrolls vertically), or an empty-day
                hint when nothing is scheduled for the viewed date. */}
            {occurrences.length === 0 ? (
              <EmptyDayState />
            ) : (
              <ScheduleGrid
                kids={visibleChildren}
                occurrences={occurrences}
                nowMinutes={nowMinutes}
                currentDate={currentDate}
                onBlockPress={handleBlockPress}
              />
            )}
          </View>
        </GestureDetector>
      ) : (
        <TodoTabContent />
      )}

      {/* Section 7 — Floating bottom dock */}
      <BottomDock
        onPressHome={() => {
          // Home = jump back to today's daily view.
          setCurrentDate(todayIso());
          setTab('schedule');
        }}
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
