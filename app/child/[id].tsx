// 1:1 port of WeeklyB (docs/design/amatta-v1/app-weekly.jsx) into the
// schedule app's single-kid weekly drill-down screen.
//
// Sections (in render order):
//   1. SafeAreaView edges=['top'].
//   2. Top bar — back chev + "이번 주" pill + week range caption (calendar
//      drawer trigger via chev-down — currently TODO no-op; Batch D
//      worker-drawers wires this once CalendarDrawer mounts).
//   3. Kid header row — KidAvatar(30) + name + "이번 주 일정" + active count.
//      Grade caption from the prototype is omitted (schema has no grade —
//      TODO if we ever add one).
//   4. WeeklyGrid — week strip + scrollable body with 56px gutter + 7 day
//      columns × 34 30-min rows.
//   5. Swipe ±7 days via Gesture.Pan (same activeOffsetX/failOffsetY pattern
//      as daily index.tsx — see commit 1cbfd81).
//
// Block tap → useUiStore.openEventDetail({scheduleId, occurrenceDate}).
// Empty-slot tap → useUiStore.openEditSheet('create', {preFill: {childId,
// date}}).

import { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { expandOccurrences } from '../../src/domain/occurrences';
import type { Child, ISODate } from '../../src/domain/types';
import { useChildrenStore } from '../../src/state/children-store';
import { useSchedulesStore } from '../../src/state/schedules-store';
import { useUiStore } from '../../src/state/ui-store';
import { KidAvatar } from '../../src/ui/common/KidAvatar';
import { KidSwitchDrawer } from '../../src/ui/drawers/KidSwitchDrawer';
import { FONT_FAMILIES } from '../../src/ui/fonts';
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
} from '../../src/ui/icons';
import { TOKENS } from '../../src/ui/palette';
import {
  shiftIsoDate,
  weekDatesIso,
  weekStartIso,
} from '../../src/ui/utils/date';
import {
  WeeklyGrid,
  type WeeklyBlockPressEvent,
  type WeeklyEmptySlotEvent,
} from '../../src/ui/weekly/WeeklyGrid';

const SWIPE_THRESHOLD = 60;
// Matches docs/design/amatta-v1/app-weekly.jsx grid-template '40px repeat(7,1fr)'.
const TIME_GUTTER = 40;

const KOREAN_MONTH = (month: number, day: number): string =>
  `${month}월 ${day}일`;

/** "5월 3일 – 9일" or "5월 31일 – 6월 6일". */
function formatWeekRange(start: ISODate, end: ISODate): string {
  const s = start as unknown as string;
  const e = end as unknown as string;
  const sm = Number(s.slice(5, 7));
  const sd = Number(s.slice(8, 10));
  const em = Number(e.slice(5, 7));
  const ed = Number(e.slice(8, 10));
  if (sm === em) return `${KOREAN_MONTH(sm, sd)} – ${ed}일`;
  return `${KOREAN_MONTH(sm, sd)} – ${KOREAN_MONTH(em, ed)}`;
}

export default function ChildWeeklyScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);
  const openEditSheet = useUiStore((s) => s.openEditSheet);
  const openEventDetail = useUiStore((s) => s.openEventDetail);
  const openCalendar = useUiStore((s) => s.openCalendar);
  const openSearch = useUiStore((s) => s.openSearch);
  const openKidSwitch = useUiStore((s) => s.openKidSwitch);
  // Week follows the shared currentDate so opening CalendarDrawer + picking
  // a date here lands the right week. ±7 swipe writes back into currentDate
  // so toggling back to daily/multi keeps the same focus.
  const anchorDate = useUiStore((s) => s.currentDate);
  const setAnchorDate = useUiStore((s) => s.setCurrentDate);
  const [bodyWidth, setBodyWidth] = useState(0);

  const childId = useMemo(() => {
    const raw = params.id;
    if (typeof raw !== 'string') return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }, [params.id]);

  const child: Child | undefined = useMemo(() => {
    if (childId === null) return undefined;
    return children.find((c) => c.id === childId);
  }, [children, childId]);

  const weekStart = useMemo(() => weekStartIso(anchorDate), [anchorDate]);
  const weekDates = useMemo(() => weekDatesIso(anchorDate), [anchorDate]);
  const weekEnd = useMemo(() => shiftIsoDate(weekStart, 6), [weekStart]);

  const childrenById = useMemo(() => {
    const m = new Map<number, Child>();
    if (child !== undefined) m.set(child.id, child);
    return m;
  }, [child]);

  const childSchedules = useMemo(() => {
    if (child === undefined) return [];
    return schedules.filter((s) => s.childId === child.id);
  }, [schedules, child]);

  const occurrences = useMemo(() => {
    if (child === undefined) return [];
    const lastDate = weekDates[6];
    if (lastDate === undefined) return [];
    return expandOccurrences(
      childSchedules,
      exceptions,
      { from: weekStart, to: lastDate },
      childrenById,
    );
  }, [child, childSchedules, exceptions, weekStart, weekDates, childrenById]);

  const activeCount = occurrences.length;

  // Horizontal pan: ±7 days. Mirrors daily/index.tsx commit 1cbfd81.
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

  const handleEmpty = (e: WeeklyEmptySlotEvent): void => {
    if (child === undefined) return;
    openEditSheet('create', {
      preFill: { childId: child.id, date: e.date },
    });
  };

  const handleBlock = (e: WeeklyBlockPressEvent): void => {
    openEventDetail({ scheduleId: e.scheduleId, occurrenceDate: e.date });
  };

  // ---------- Render branches (hooks above ran unconditionally) ----------
  if (childId === null || child === undefined) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>자녀를 찾을 수 없어요.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="돌아가기"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backCta,
              {
                backgroundColor: pressed
                  ? TOKENS.primaryDeep
                  : TOKENS.primary,
              },
            ]}
          >
            <Text style={styles.backCtaLabel}>돌아가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Column width must keep WeeklyGrid happy (it positions blocks absolutely
  // off this width). 56px gutter on the left, 7 columns share the rest.
  const columnWidth =
    bodyWidth > 0 ? Math.floor((bodyWidth - TIME_GUTTER) / 7) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar — chev-back + "이번 주" range pill + search (no chev-right;
          spec puts search on the right, not a this-week shortcut). */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={8}
          style={styles.backBtn}
        >
          <IconChevronLeft size={20} color={TOKENS.ink} />
        </Pressable>
        <Pressable
          onPress={openCalendar}
          accessibilityRole="button"
          accessibilityLabel="주 선택"
          style={styles.topTitleRow}
        >
          <Text style={styles.topTitle}>이번 주</Text>
          <View style={styles.topCaptionRow}>
            <Text style={styles.topCaption}>
              {formatWeekRange(weekStart, weekEnd)}
            </Text>
            <IconChevronDown size={16} color={TOKENS.inkSub} />
          </View>
        </Pressable>
        <Pressable
          onPress={openSearch}
          accessibilityRole="button"
          accessibilityLabel="검색"
          hitSlop={8}
          style={styles.searchBtn}
        >
          <IconSearch size={20} color={TOKENS.ink} />
        </Pressable>
      </View>

      {/* Kid header pill — entire row is the kid-switch trigger.
          Mirrors app-weekly.jsx:140 ("바꾸기" affordance on the right). */}
      <View style={styles.kidHeaderWrap}>
        <Pressable
          onPress={openKidSwitch}
          accessibilityRole="button"
          accessibilityLabel={`${child.name} — 자녀 바꾸기`}
          style={styles.kidHeader}
        >
          <KidAvatar child={child} size={28} />
          <View style={styles.kidHeaderTextRow}>
            <Text style={styles.kidName}>{child.name}</Text>
            <Text style={styles.kidWeekLabel}>이번 주 일정</Text>
            <Text style={styles.kidCount}>{activeCount}건</Text>
          </View>
          <View style={styles.kidSwitchAffordance}>
            <Text style={styles.kidSwitchLabel}>바꾸기</Text>
            <IconChevronRight size={11} color={TOKENS.inkSub} />
          </View>
        </Pressable>
      </View>

      <GestureDetector gesture={panGesture}>
        <View
          style={styles.body}
          onLayout={(e: LayoutChangeEvent) =>
            setBodyWidth(e.nativeEvent.layout.width)
          }
        >
          {columnWidth > 0 ? (
            <WeeklyGrid
              occurrences={occurrences}
              weekDates={weekDates}
              columnWidth={columnWidth}
              todayColorIndex={child.colorIndex}
              onEmptySlotPress={handleEmpty}
              onBlockPress={handleBlock}
            />
          ) : null}
        </View>
      </GestureDetector>

      <KidSwitchDrawer
        currentKidId={child.id}
        onPick={(newKidId) => {
          // Swap the route param so the same screen re-renders for the new
          // kid (preserves the current week, just changes the lane).
          router.setParams({ id: String(newKidId) });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.surface },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 14,
    gap: 10,
  },
  backBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    marginLeft: -4,
  },
  searchBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
  },
  topTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 4,
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

  kidHeaderWrap: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
  },
  kidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: TOKENS.ink04,
    borderRadius: 9999,
  },
  kidHeaderTextRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    flexWrap: 'wrap',
    minWidth: 0,
  },
  kidSwitchAffordance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  kidSwitchLabel: {
    fontSize: 11.5,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },
  kidName: {
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
  kidWeekLabel: {
    fontSize: 11,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
  },
  kidCount: {
    fontSize: 11,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
  },

  body: { flex: 1 },

  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  errorTitle: {
    fontSize: 16,
    color: TOKENS.ink,
    fontFamily: FONT_FAMILIES.pretendardMedium,
  },
  backCta: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  backCtaLabel: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.surface,
  },
});
