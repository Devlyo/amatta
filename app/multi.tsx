// 1:1 port of docs/design/amatta-v1/app-multi-grid.jsx — the multi-kid
// weekly grid reached from Daily View's WEEK toggle. Owns the screen
// chrome (top bar, tab strip, kid filter chips, bottom dock) and delegates
// the actual time/lane layout to <MultiKidGrid />.

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';

import { MAX_CHILDREN } from '../src/domain/constants';
import { expandOccurrences } from '../src/domain/occurrences';
import type { Child, ISODate, Occurrence } from '../src/domain/types';
import { useChildrenStore } from '../src/state/children-store';
import { useChecklistStore } from '../src/state/checklist-store';
import { useSchedulesStore } from '../src/state/schedules-store';
import { useTodosStore } from '../src/state/todos-store';
import { useUiStore } from '../src/state/ui-store';
import { BottomDock } from '../src/ui/common/BottomDock';
import { KidAvatar } from '../src/ui/common/KidAvatar';
import { ViewToggle } from '../src/ui/common/ViewToggle';
import { TabStrip, type DailyTabKey } from '../src/ui/daily/TabStrip';
import { TodoTabContent } from '../src/ui/daily/TodoTabContent';
import { FONT_FAMILIES } from '../src/ui/fonts';
import {
  IconChevronDown,
  IconChevronLeft,
  IconSearch,
} from '../src/ui/icons';
import { TOKENS } from '../src/ui/palette';
import {
  shiftIsoDate,
  todayIso,
  weekDatesIso,
  weekStartIso,
} from '../src/ui/utils/date';
import { MultiKidGrid } from '../src/ui/weekly/MultiKidGrid';

const SWIPE_THRESHOLD = 60;

function currentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// "5월 3일 – 9일" / "5월 31일 – 6월 6일"
function formatWeekRange(start: ISODate, end: ISODate): string {
  const s = start as unknown as string;
  const e = end as unknown as string;
  const sm = Number(s.slice(5, 7));
  const sd = Number(s.slice(8, 10));
  const em = Number(e.slice(5, 7));
  const ed = Number(e.slice(8, 10));
  if (sm === em) return `${sm}월 ${sd}일 – ${ed}일`;
  return `${sm}월 ${sd}일 – ${em}월 ${ed}일`;
}

function MultiViewScreenImpl(): React.ReactElement {
  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);
  const openEditSheet = useUiStore((s) => s.openEditSheet);
  const router = useRouter();

  // Anchor independent of the daily currentDate so swiping ±7 here doesn't
  // tug the daily view along.
  const [anchorDate, setAnchorDate] = useState<ISODate>(todayIso());
  const [tab, setTab] = useState<DailyTabKey>('schedule');
  const [nowMinutes, setNowMinutes] = useState<number>(() => currentMinutes());

  // Tick the NOW line at the next minute boundary then every 60s, plus a
  // re-sync on AppState=active. Matches the daily-grid pattern (ADR-003).
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const tick = (): void => setNowMinutes(currentMinutes());
    const start = (): void => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (intervalId !== null) clearInterval(intervalId);
      const now = new Date();
      const msUntilNext = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      timeoutId = setTimeout(() => {
        tick();
        intervalId = setInterval(tick, 60_000);
      }, msUntilNext);
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

  // First MAX_CHILDREN kids, stable insertion order (matches daily index).
  const allKids = useMemo<Child[]>(
    () => [...children].sort((a, b) => a.id - b.id).slice(0, MAX_CHILDREN),
    [children],
  );

  // Kid-filter chips: subset of allKids whose lanes are visible. Default
  // to "all on". The prototype refuses to let users hide every kid — we
  // mirror that so the grid never becomes empty by toggling.
  const [activeKidIds, setActiveKidIds] = useState<Set<number>>(
    () => new Set(allKids.map((k) => k.id)),
  );

  // If the children list changes (add/remove kid in settings), re-sync the
  // active set to include any newly-added kids.
  useEffect(() => {
    setActiveKidIds((prev) => {
      const next = new Set(prev);
      for (const k of allKids) next.add(k.id);
      // Drop any stale IDs that no longer exist.
      for (const id of Array.from(next)) {
        if (!allKids.some((k) => k.id === id)) next.delete(id);
      }
      return next;
    });
  }, [allKids]);

  const toggleKid = useCallback((id: number) => {
    setActiveKidIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev; // never go to zero
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const visibleKids = useMemo<Child[]>(
    () => allKids.filter((k) => activeKidIds.has(k.id)),
    [allKids, activeKidIds],
  );

  const weekStart = useMemo(() => weekStartIso(anchorDate), [anchorDate]);
  const weekDates = useMemo(() => weekDatesIso(anchorDate), [anchorDate]);
  const weekEnd = useMemo(() => shiftIsoDate(weekStart, 6), [weekStart]);

  const childrenById = useMemo(() => {
    const m = new Map<number, Child>();
    for (const c of allKids) m.set(c.id, c);
    return m;
  }, [allKids]);

  // Expand for the whole week × all kids, then the grid filters lanes by
  // visibleKids at render time. (Doing the kid filter inside expand would
  // force a re-expand every toggle — cheap now, expensive once we ever add
  // RRULE.)
  const occurrences = useMemo<Occurrence[]>(() => {
    const lastDate = weekDates[6];
    if (lastDate === undefined) return [];
    return expandOccurrences(
      schedules,
      exceptions,
      { from: weekStart, to: lastDate },
      childrenById,
    );
  }, [schedules, exceptions, weekStart, weekDates, childrenById]);

  // Horizontal swipe ±7 days (mirrors child weekly).
  const panGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      if (e.translationX <= -SWIPE_THRESHOLD) {
        setAnchorDate(shiftIsoDate(weekStart, 7));
      } else if (e.translationX >= SWIPE_THRESHOLD) {
        setAnchorDate(shiftIsoDate(weekStart, -7));
      }
    })
    .runOnJS(true);

  // Counts for the tab badge (same intent as daily/index.tsx).
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

  // Block tap → editAll for now (matches daily). EventDetail drawer can
  // slot in once it's wired (see app/child/[id].tsx for the eventual API).
  const handleBlockPress = (occ: Occurrence): void => {
    openEditSheet('editAll', {
      scheduleId: occ.scheduleId,
      occurrenceDate: occ.date,
    });
  };

  const handlePressAdd = (): void => {
    openEditSheet('create', { preFill: { date: anchorDate } });
  };

  const handlePressGear = (): void => {
    router.push('/(tabs)/settings');
  };

  const handlePressDay = (): void => {
    router.back(); // returns to (tabs)/index (the daily view)
  };

  const handlePressTitle = (): void => {
    useUiStore.getState().openCalendar();
  };

  const handlePressSearch = (): void => {
    useUiStore.getState().openSearch();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar — chev-back (inline, next to 이번 주) + title pressable +
          ViewToggle/search on the right. The default Stack header is
          disabled in _layout for this route so the chev here is the only
          back affordance the user sees. */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={8}
          style={styles.backBtn}
        >
          <IconChevronLeft size={22} color={TOKENS.ink} />
        </Pressable>
        <Pressable
          onPress={handlePressTitle}
          accessibilityRole="button"
          accessibilityLabel="주 선택"
          style={styles.leftBtn}
        >
          <Text style={styles.topTitle}>이번 주</Text>
          <View style={styles.topCaptionRow}>
            <Text
              style={styles.topCaption}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {formatWeekRange(weekStart, weekEnd)}
            </Text>
            <IconChevronDown size={16} color={TOKENS.inkSub} />
          </View>
        </Pressable>
        <View style={styles.rightCluster}>
          <ViewToggle active="week" onPressDay={handlePressDay} />
          <Pressable
            onPress={handlePressSearch}
            accessibilityRole="button"
            accessibilityLabel="검색"
            hitSlop={8}
            style={styles.searchBtn}
          >
            <IconSearch size={20} color={TOKENS.ink} />
          </Pressable>
        </View>
      </View>

      {/* Tabs */}
      <TabStrip active={tab} onChange={setTab} todoCount={todoCount} />

      {tab === 'schedule' ? (
        <>
          {/* Kid filter chips */}
          <View style={styles.chipsRow}>
            {allKids.map((k) => {
              const active = activeKidIds.has(k.id);
              return (
                <Pressable
                  key={k.id}
                  onPress={() => toggleKid(k.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${k.name} 필터`}
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.kidChip,
                    active ? styles.kidChipActive : styles.kidChipInactive,
                  ]}
                >
                  <KidAvatar child={k} size={26} />
                  <Text style={styles.kidChipName}>{k.name}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Week strip — day-of-week labels + date circles */}
          <View style={styles.weekStrip}>
            <View style={styles.weekStripGutter} />
            {weekDates.map((date, idx) => {
              const today = (date as unknown as string) === (todayIso() as unknown as string);
              const dowLabel = ['일', '월', '화', '수', '목', '금', '토'][idx] ?? '';
              const day = Number((date as unknown as string).slice(8, 10));
              const dowColor =
                idx === 0 ? '#D04580' : idx === 6 ? '#3F66D8' : TOKENS.inkSub;
              return (
                <View key={date as unknown as string} style={styles.weekStripCell}>
                  <Text style={[styles.weekStripDow, { color: dowColor }]}>
                    {dowLabel}
                  </Text>
                  <View
                    style={[
                      styles.weekStripDateChip,
                      today ? styles.weekStripDateChipToday : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.weekStripDateLabel,
                        today ? styles.weekStripDateLabelToday : null,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <GestureDetector gesture={panGesture}>
            <View style={styles.body}>
              <MultiKidGrid
                weekDates={weekDates}
                kids={visibleKids}
                occurrences={occurrences}
                nowMinutes={nowMinutes}
                today={todayIso()}
                onBlockPress={handleBlockPress}
              />
            </View>
          </GestureDetector>
        </>
      ) : (
        <TodoTabContent />
      )}

      <BottomDock onPressAdd={handlePressAdd} onPressGear={handlePressGear} />
    </SafeAreaView>
  );
}

export default memo(MultiViewScreenImpl);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.surface },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 14,
    gap: 6,
  },
  backBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  leftBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  topTitle: {
    fontSize: 22,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    letterSpacing: -0.4,
    color: TOKENS.ink,
  },
  topCaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 1,
    minWidth: 0,
  },
  topCaption: {
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchBtn: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  kidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 13,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  kidChipActive: {
    backgroundColor: TOKENS.ink04,
  },
  kidChipInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: TOKENS.hair,
    opacity: 0.5,
  },
  kidChipName: {
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },

  weekStrip: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TOKENS.hair,
    paddingTop: 4,
    paddingBottom: 8,
  },
  weekStripGutter: {
    width: 44,
  },
  weekStripCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  weekStripDow: {
    fontSize: 10,
    fontFamily: FONT_FAMILIES.pretendardMedium,
  },
  weekStripDateChip: {
    width: 26,
    height: 26,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekStripDateChipToday: {
    backgroundColor: TOKENS.primary,
  },
  weekStripDateLabel: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.ink,
    letterSpacing: -0.2,
  },
  weekStripDateLabelToday: {
    color: TOKENS.surface,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
  },

  body: { flex: 1 },
});
