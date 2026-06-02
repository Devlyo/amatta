import { useMemo, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';

import {
  CHILD_COL_MIN,
  GRID_SLOTS,
  GRID_START_HOUR,
  MAX_CHILDREN,
  ROW_HEIGHT,
  SLOT_MIN,
  TIME_COL_WIDTH,
} from '../../src/domain/constants';
import { expandOccurrences } from '../../src/domain/occurrences';
import type { Child } from '../../src/domain/types';
import { useChildrenStore } from '../../src/state/children-store';
import { useSchedulesStore } from '../../src/state/schedules-store';
import { useUiStore } from '../../src/state/ui-store';
import { LOGOS } from '../../src/ui/assets';
import { EmptyChildrenState } from '../../src/ui/common/EmptyChildrenState';
import { KidAvatar } from '../../src/ui/common/KidAvatar';
import { FONT_FAMILIES } from '../../src/ui/fonts';
import { DailyGrid, type EmptySlotEvent } from '../../src/ui/grid/DailyGrid';
import {
  IconChevronLeft,
  IconChevronRight,
} from '../../src/ui/icons';
import { TOKENS } from '../../src/ui/palette';
import {
  formatKoreanDateLabel,
  formatKoreanShortDate,
  isToday,
  shiftIsoDate,
  todayIso,
} from '../../src/ui/utils/date';

const SWIPE_THRESHOLD = 60;
const HORIZONTAL_PAD = 16;

export default function DailyViewScreen(): React.ReactElement {
  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);
  const currentDate = useUiStore((s) => s.currentDate);
  const setCurrentDate = useUiStore((s) => s.setCurrentDate);
  const openEditSheet = useUiStore((s) => s.openEditSheet);
  const router = useRouter();

  const [gridSurfaceWidth, setGridSurfaceWidth] = useState(0);
  // TODO(v2-schema): 할일(Todo) entity ships in v2 migration. The tab strip
  // below renders the disabled 할일 tab visual; for R2 the 일정 tab is
  // hard-active so we don't need any state here.

  // First 4 children, sorted by id ASC (stable insertion order).
  // All hooks must run unconditionally — the empty-state branch happens below.
  const visibleChildren = useMemo<Child[]>(
    () => [...children].sort((a, b) => a.id - b.id).slice(0, MAX_CHILDREN),
    [children],
  );

  const childrenById = useMemo(() => {
    const m = new Map<number, Child>();
    for (const c of visibleChildren) m.set(c.id, c);
    return m;
  }, [visibleChildren]);

  const childrenOrder = useMemo(
    () => visibleChildren.map((c) => c.id),
    [visibleChildren],
  );

  const occurrences = useMemo(
    () =>
      expandOccurrences(
        schedules,
        exceptions,
        { from: currentDate, to: currentDate },
        childrenById,
      ),
    [schedules, exceptions, currentDate, childrenById],
  );

  const columnCount = Math.max(1, visibleChildren.length);
  const columnWidth =
    gridSurfaceWidth > 0
      ? Math.max(CHILD_COL_MIN, gridSurfaceWidth / columnCount)
      : CHILD_COL_MIN;

  const onToday = isToday(currentDate);
  const goPrev = (): void => setCurrentDate(shiftIsoDate(currentDate, -1));
  const goNext = (): void => setCurrentDate(shiftIsoDate(currentDate, 1));
  const goToday = (): void => setCurrentDate(todayIso());

  // Horizontal-only pan: activeOffsetX delays activation until the user has
  // committed to a horizontal motion, so vertical scroll inside DailyGrid
  // wins for predominantly-vertical drags.
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

  const handleEmptySlotPress = (e: EmptySlotEvent): void => {
    const child = visibleChildren[e.childIdx];
    if (child === undefined) return;
    const startMinutes = GRID_START_HOUR * 60 + e.slotIndex * SLOT_MIN;
    openEditSheet('create', {
      preFill: { childId: child.id, date: currentDate },
    });
    // TODO (Phase 4 polish): plumb startMinutes through EditSheetPreFill so the
    // sheet pre-fills the chosen slot instead of using the form default.
    void startMinutes;
  };

  const handleBlockPress = (scheduleId: number): void => {
    openEditSheet('editAll', {
      scheduleId,
      occurrenceDate: currentDate,
    });
  };

  if (children.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyChildrenState />
      </SafeAreaView>
    );
  }

  const isSingleChild = visibleChildren.length === 1;
  const hasOccurrencesToday = occurrences.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Top bar: logo wordmark + chevrons + 오늘로 + (settings handled via tab) ── */}
      <View style={styles.topBar}>
        <Image
          source={LOGOS.wordmark}
          style={styles.wordmark}
          resizeMode="contain"
          accessibilityLabel="아마따"
        />
        <View style={styles.topBarSpacer} />
        <Pressable
          onPress={goPrev}
          accessibilityRole="button"
          accessibilityLabel="이전 날짜"
          hitSlop={10}
          style={styles.chevronBtn}
        >
          <IconChevronLeft size={22} color={TOKENS.ink} />
        </Pressable>
        <Pressable
          onPress={goToday}
          accessibilityRole="button"
          accessibilityLabel="오늘로 이동"
          style={({ pressed }) => [
            styles.todayPill,
            {
              backgroundColor: onToday
                ? TOKENS.ink04
                : pressed
                  ? TOKENS.primaryDeep
                  : TOKENS.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.todayLabel,
              { color: onToday ? TOKENS.inkSub : TOKENS.surface },
            ]}
          >
            오늘로
          </Text>
        </Pressable>
        <Pressable
          onPress={goNext}
          accessibilityRole="button"
          accessibilityLabel="다음 날짜"
          hitSlop={10}
          style={styles.chevronBtn}
        >
          <IconChevronRight size={22} color={TOKENS.ink} />
        </Pressable>
      </View>

      {/* ── Hero date line ── mirrors amatta-v1: big "오늘" (or M월 D일) + caption */}
      <View style={styles.dateBlock}>
        <Text style={styles.dateTitle} accessibilityRole="header">
          {onToday ? '오늘' : formatKoreanDateLabel(currentDate)}
          {'  '}
          <Text style={styles.dateTitleCaption}>
            {onToday ? formatKoreanShortDate(currentDate) : null}
          </Text>
        </Text>
      </View>

      {/* ── 일정 / 할일 tabs ── */}
      <View style={styles.tabStrip}>
        <View style={styles.tabBtnActive}>
          <Text style={styles.tabLabelActive}>일정</Text>
          <View style={styles.tabUnderline} />
        </View>
        {/* TODO(v2-schema): Todo entity ships in v2 migration. Disabled for now. */}
        <View style={[styles.tabBtnInactive, { opacity: 0.4 }]}>
          <Text style={styles.tabLabelInactive}>준비물 & 할일</Text>
        </View>
      </View>

      {/* TODO(v2-schema): NEXT_PICKUP hero card requires `needs_pickup` column.
          Placeholder skipped intentionally — keep the layout tight. */}

      {/* ── Children header row ── */}
      <View style={styles.childrenHeader}>
        <View style={{ width: TIME_COL_WIDTH }} />
        <View style={styles.childrenRow}>
          {visibleChildren.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/child/${c.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${c.name} 주간 보기`}
              style={[
                styles.childCell,
                isSingleChild ? styles.childCellHero : null,
              ]}
            >
              <KidAvatar child={c} size={isSingleChild ? 48 : 30} ring />
              <Text
                style={[
                  styles.childName,
                  isSingleChild ? styles.childNameHero : null,
                ]}
                numberOfLines={1}
              >
                {c.name}
              </Text>
              {/* TODO(v2-schema): amatta-v1 shows grade caption ("초3").
                  Our domain Child has no grade field — defer to v2. */}
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Grid (swipeable) ── */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.body}>
          {/* Time labels: 06:00 .. 22:00 at each hour boundary (mono) */}
          <View
            style={[styles.timeCol, { width: TIME_COL_WIDTH }]}
            pointerEvents="none"
          >
            {Array.from({ length: GRID_SLOTS }, (_, i) => {
              if (i % 2 !== 0) return <View key={i} style={styles.timeSpacer} />;
              const hour = GRID_START_HOUR + i / 2;
              const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
              const ap = hour < 12 ? 'AM' : 'PM';
              return (
                <View key={i} style={styles.timeLabelRow}>
                  <Text style={styles.timeLabelHour}>{h12}</Text>
                  <Text style={styles.timeLabelAp}>{ap}</Text>
                </View>
              );
            })}
          </View>

          <View
            style={styles.gridSurface}
            onLayout={(e: LayoutChangeEvent) =>
              setGridSurfaceWidth(e.nativeEvent.layout.width)
            }
          >
            <DailyGrid
              occurrences={occurrences}
              childrenOrder={childrenOrder}
              columnWidth={columnWidth}
              onEmptySlotPress={handleEmptySlotPress}
              onBlockPress={handleBlockPress}
            />
            {!hasOccurrencesToday ? (
              <View pointerEvents="none" style={styles.emptyDay}>
                <Text style={styles.emptyDayLabel}>오늘은 일정이 없어요</Text>
              </View>
            ) : null}
          </View>
        </View>
      </GestureDetector>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.surface },

  // ── Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: HORIZONTAL_PAD,
    paddingVertical: 8,
    gap: 6,
  },
  wordmark: { width: 84, height: 24 },
  topBarSpacer: { flex: 1 },
  chevronBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9999,
  },
  todayLabel: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    letterSpacing: -0.2,
  },

  // ── Date hero
  dateBlock: {
    paddingHorizontal: HORIZONTAL_PAD,
    paddingTop: 2,
    paddingBottom: 10,
  },
  dateTitle: {
    fontSize: 24,
    fontFamily: FONT_FAMILIES.pretendardBold,
    color: TOKENS.ink,
    letterSpacing: -0.4,
  },
  dateTitleCaption: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.inkSub,
    letterSpacing: -0.2,
  },

  // ── Tabs
  tabStrip: {
    flexDirection: 'row',
    paddingHorizontal: HORIZONTAL_PAD,
    borderBottomColor: TOKENS.hair,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtnActive: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: 'relative',
  },
  tabBtnInactive: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tabLabelActive: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.3,
  },
  tabLabelInactive: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.pretendard,
    color: TOKENS.inkSub,
    letterSpacing: -0.3,
  },
  tabUnderline: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: -1,
    height: 3,
    borderRadius: 2,
    backgroundColor: TOKENS.primary,
  },

  // ── Children header row
  childrenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomColor: TOKENS.hair,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  childrenRow: {
    flex: 1,
    flexDirection: 'row',
  },
  childCell: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  childCellHero: {
    flexDirection: 'column',
    paddingVertical: 6,
    gap: 8,
  },
  childName: {
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendardSemiBold,
    color: TOKENS.ink,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  childNameHero: {
    fontSize: 16,
    letterSpacing: -0.3,
  },

  // ── Body / grid
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  timeCol: {
    backgroundColor: TOKENS.surface,
  },
  timeSpacer: { height: ROW_HEIGHT },
  timeLabelRow: {
    height: ROW_HEIGHT,
    alignItems: 'flex-end',
    paddingRight: 6,
    paddingTop: 2,
  },
  timeLabelHour: {
    fontSize: 12,
    fontFamily: FONT_FAMILIES.mono,
    color: TOKENS.inkSub,
    lineHeight: 14,
  },
  timeLabelAp: {
    fontSize: 8,
    fontFamily: FONT_FAMILIES.mono,
    color: TOKENS.ink30,
    letterSpacing: 0.4,
    lineHeight: 9,
  },
  gridSurface: {
    flex: 1,
    position: 'relative',
  },

  // ── Empty-day overlay (sits over the grid)
  emptyDay: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  emptyDayLabel: {
    fontSize: 13,
    fontFamily: FONT_FAMILIES.pretendardMedium,
    color: TOKENS.inkSub,
    backgroundColor: TOKENS.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TOKENS.hair,
  },
});
