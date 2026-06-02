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

import { useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { MAX_CHILDREN } from '../../src/domain/constants';
import { expandOccurrences } from '../../src/domain/occurrences';
import type { Child, Occurrence } from '../../src/domain/types';
import { useChildrenStore } from '../../src/state/children-store';
import { useSchedulesStore } from '../../src/state/schedules-store';
import { useUiStore } from '../../src/state/ui-store';
import { BottomDock } from '../../src/ui/common/BottomDock';
import { EmptyChildrenState } from '../../src/ui/common/EmptyChildrenState';
import { KidPillsHeader } from '../../src/ui/daily/KidPillsHeader';
import { ScheduleGrid } from '../../src/ui/daily/ScheduleGrid';
import { TabStrip, type DailyTabKey } from '../../src/ui/daily/TabStrip';
import { TopBar } from '../../src/ui/daily/TopBar';
import { FONT_FAMILIES } from '../../src/ui/fonts';
import { TOKENS } from '../../src/ui/palette';
import { formatKoreanShortDate, isToday } from '../../src/ui/utils/date';

function currentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export default function DailyViewScreen(): React.ReactElement {
  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);
  const currentDate = useUiStore((s) => s.currentDate);
  const openEditSheet = useUiStore((s) => s.openEditSheet);
  const router = useRouter();

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
    // TODO(R3-drawers): open CalendarDrawer (date picker) — no-op for R2.
  };

  const handlePressSearch = (): void => {
    // TODO(R3-drawers): open SearchDrawer — no-op for R2.
  };

  const handlePressWeek = (): void => {
    // First visible kid's weekly view. If nothing's been added yet the empty
    // state would have taken over already, so the index is safe.
    const first = visibleChildren[0];
    if (first === undefined) return;
    router.push(`/child/${first.id}`);
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
        onPressDate={handlePressDate}
        onPressSearch={handlePressSearch}
        onPressWeek={handlePressWeek}
      />

      {/* Section 3 — Pickup carousel — TODO(v2-schema): needs `needs_pickup`
          column on the Schedule row (see ADR-002). Intentionally skipped in
          R2; the layout collapses tight, with TabStrip flowing directly under
          the top bar — matches the prototype when there's no pickup. */}

      {/* Section 4 — Tabs */}
      <TabStrip
        active={tab}
        onChange={setTab}
        todoCount={0 /* TODO(v2-schema): TODOS + TASKS entities */}
      />

      {tab === 'schedule' ? (
        <>
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
            onBlockPress={handleBlockPress}
          />
        </>
      ) : (
        // TODO(v2-schema): the 준비물 & 할일 tab needs ChecklistItem + Todo
        // entities (ADR-002). For R2 we render a placeholder so the tab is
        // tappable without crashing.
        <View style={styles.todoPlaceholder}>
          <Text style={styles.todoPlaceholderText}>v1.1에서 출시 예정</Text>
        </View>
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
  safe: { flex: 1, backgroundColor: TOKENS.surface },
  todoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  todoPlaceholderText: {
    fontFamily: FONT_FAMILIES.pretendardMedium,
    fontSize: 14,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },
});
