// 홈 = 오늘 요약 — ADR-007 §6-1 (design canvas board "0 홈").
//
// The app's first screen and the root route `/` (onboarding and data reset
// both `router.replace('/')` here, so this file must stay at (tabs)/index).
// Always shows TODAY, independent of the calendar's selected date:
//   1. date caption + large "오늘" title, red "+" (new event for today)
//   2. 다음 픽업 card(s) — the existing pickup carousel, today's occurrences
//   3. 지금 · 다음 — per kid: running / next event + status chip
//   4. 오늘 챙길 것 — today's checklist (per-occurrence completion, ADR-006)
//   5. 오늘 할 일 — todos due today

import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';

import { MAX_CHILDREN } from '../../src/domain/constants';
import { nowAndNextByKid } from '../../src/domain/now-next';
import { expandOccurrences } from '../../src/domain/occurrences';
import type { Child } from '../../src/domain/types';
import { useChildrenStore } from '../../src/state/children-store';
import { usePickupLogStore } from '../../src/state/pickup-log-store';
import { useSchedulesStore } from '../../src/state/schedules-store';
import { useUiStore } from '../../src/state/ui-store';
import { useNowMinutes } from '../../src/ui/calendar/useNowMinutes';
import { ChecklistSection } from '../../src/ui/daily/ChecklistSection';
import { PickupCarousel } from '../../src/ui/daily/PickupCarousel';
import { TodoSection } from '../../src/ui/daily/TodoSection';
import { HomeSection } from '../../src/ui/home/HomeSection';
import { NowNextList } from '../../src/ui/home/NowNextList';
import { IconPlus } from '../../src/ui/icons';
import { TOKENS } from '../../src/ui/palette';
import { SPACING } from '../../src/ui/spacing';
import { TYPE } from '../../src/ui/typography';
import { todayIso, weekdayKo } from '../../src/ui/utils/date';

/** Space under the content so the floating dock never covers the last row. */
const DOCK_CLEARANCE = 110;

export default function HomeScreen(): React.ReactElement {
  const router = useRouter();
  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);
  const setCurrentDate = useUiStore((s) => s.setCurrentDate);
  const completionMap = usePickupLogStore((s) => s.completionMap);

  // Re-renders every minute (NOW tick), which also rolls `today` over at midnight.
  const nowMinutes = useNowMinutes();
  const today = todayIso();
  const todayKey = today as unknown as string;

  const kids = useMemo<Child[]>(
    () => [...children].sort((a, b) => a.id - b.id).slice(0, MAX_CHILDREN),
    [children],
  );
  const childrenById = useMemo(() => new Map(kids.map((k) => [k.id, k])), [kids]);

  const occurrences = useMemo(
    () => expandOccurrences(schedules, exceptions, { from: today, to: today }, childrenById),
    // `todayKey` (string) keeps the memo stable within a day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedules, exceptions, todayKey, childrenById],
  );

  const nowNext = useMemo(
    () => nowAndNextByKid(occurrences, kids.map((k) => k.id), nowMinutes),
    [occurrences, kids, nowMinutes],
  );

  const pickupLogIsComplete = useCallback(
    (scheduleId: number, occurrenceDateInt: number): boolean =>
      completionMap.has(`${scheduleId}|${occurrenceDateInt}`),
    [completionMap],
  );

  const handleAdd = (): void => {
    router.push({ pathname: '/schedule/edit', params: { mode: 'create', date: today } });
  };

  const handleOpenCalendar = (): void => {
    setCurrentDate(today);
    router.navigate('/(tabs)/calendar');
  };

  // Zero-kids state: route into onboarding (replace keeps the back stack clean
  // on first launch and after a data reset).
  if (children.length === 0) {
    return <Redirect href="/onboarding/welcome" />;
  }

  const s = todayKey;
  const caption = `${Number(s.slice(5, 7))}월 ${Number(s.slice(8, 10))}일 ${weekdayKo(today)}요일`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.caption}>{caption}</Text>
          <Text style={styles.title} accessibilityRole="header">
            오늘
          </Text>
        </View>
        <Pressable
          onPress={handleAdd}
          accessibilityRole="button"
          accessibilityLabel="일정 추가"
          hitSlop={8}
          style={styles.addButton}
        >
          <IconPlus size={26} color={TOKENS.sunday} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        testID="home-scroll"
      >
        <PickupCarousel
          occurrences={occurrences}
          childrenById={childrenById}
          nowMinutes={nowMinutes}
          currentDate={today}
          pickupLogIsComplete={pickupLogIsComplete}
        />

        <HomeSection title="지금 · 다음" actionLabel="캘린더" onPressAction={handleOpenCalendar}>
          <NowNextList kids={kids} rows={nowNext} />
        </HomeSection>

        <ChecklistSection date={today} />
        <TodoSection date={today} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.groupedBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.xs,
    paddingLeft: 18,
    paddingRight: SPACING.xs,
  },
  headerText: { flex: 1, gap: 1 },
  caption: { ...TYPE.footnote, color: TOKENS.inkSub },
  title: { ...TYPE.largeTitle, color: TOKENS.ink },
  addButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: DOCK_CLEARANCE,
    gap: 18,
  },
});
