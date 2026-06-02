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
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  GRID_START_HOUR,
  SLOT_MIN,
  TIME_COL_WIDTH,
} from '../../src/domain/constants';
import { expandOccurrences } from '../../src/domain/occurrences';
import type { Child, ISODate } from '../../src/domain/types';
import { useChildrenStore } from '../../src/state/children-store';
import { useSchedulesStore } from '../../src/state/schedules-store';
import { useUiStore } from '../../src/state/ui-store';
import { ColorDot } from '../../src/ui/common/ColorDot';
import { TOKENS } from '../../src/ui/palette';
import {
  formatKoreanWeekRange,
  shiftIsoDate,
  todayIso,
  weekDatesIso,
  weekStartIso,
} from '../../src/ui/utils/date';
import {
  WeeklyGrid,
  type WeeklyBlockPressEvent,
  type WeeklyEmptySlotEvent,
} from '../../src/ui/weekly/WeeklyGrid';

const SWIPE_THRESHOLD = 60;

export default function ChildWeeklyScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);
  const openEditSheet = useUiStore((s) => s.openEditSheet);

  // Anchor week to the child screen's own date (independent of the daily
  // view's currentDate so navigation doesn't snap them together).
  const [anchorDate, setAnchorDate] = useState<ISODate>(todayIso());
  const [bodyWidth, setBodyWidth] = useState(0);

  // Parse id. Note: hooks above MUST run unconditionally; the invalid-id
  // branch happens below.
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

  // Filter schedules + exceptions to this child only. expandOccurrences is the
  // pure path; we feed it a single-child map so unrelated occurrences vanish.
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

  // Horizontal pan: ±7 days.
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

  const goPrev = (): void => setAnchorDate(shiftIsoDate(weekStart, -7));
  const goNext = (): void => setAnchorDate(shiftIsoDate(weekStart, 7));
  const goThisWeek = (): void => setAnchorDate(todayIso());

  const handleEmpty = (e: WeeklyEmptySlotEvent): void => {
    if (child === undefined) return;
    const startMinutes = GRID_START_HOUR * 60 + e.slotIndex * SLOT_MIN;
    openEditSheet('create', {
      preFill: { childId: child.id, date: e.date },
    });
    // TODO: thread startMinutes through preFill once schema is extended; for
    // now the sheet picks a sensible default and the user adjusts.
    void startMinutes;
  };

  const handleBlock = (e: WeeklyBlockPressEvent): void => {
    openEditSheet('editAll', {
      scheduleId: e.scheduleId,
      occurrenceDate: e.date,
    });
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

  const columnWidth =
    bodyWidth > 0 ? Math.floor((bodyWidth - TIME_COL_WIDTH) / 7) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <ColorDot colorIndex={child.colorIndex} size={14} />
          <Text style={styles.title}>{child.name}</Text>
        </View>
        <View style={styles.headerSpacer} />
        <Pressable
          onPress={goThisWeek}
          accessibilityRole="button"
          accessibilityLabel="이번 주로 이동"
          style={({ pressed }) => [
            styles.thisWeekPill,
            {
              backgroundColor: pressed ? TOKENS.primaryDeep : TOKENS.primary,
            },
          ]}
        >
          <Text style={styles.thisWeekLabel}>이번 주</Text>
        </Pressable>
      </View>

      <View style={styles.subHeader}>
        <Pressable
          onPress={goPrev}
          accessibilityRole="button"
          accessibilityLabel="이전 주"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={TOKENS.ink} />
        </Pressable>
        <Text style={styles.weekLabel} accessibilityRole="text">
          {formatKoreanWeekRange(weekStart)}
        </Text>
        <Pressable
          onPress={goNext}
          accessibilityRole="button"
          accessibilityLabel="다음 주"
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={22} color={TOKENS.ink} />
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
              onEmptySlotPress={handleEmpty}
              onBlockPress={handleBlock}
            />
          ) : null}
        </View>
      </GestureDetector>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 20, fontWeight: '700', color: TOKENS.ink },
  headerSpacer: { flex: 1 },
  thisWeekPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 9999,
  },
  thisWeekLabel: { fontSize: 13, fontWeight: '600', color: TOKENS.surface },

  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 8,
    borderBottomColor: TOKENS.hair,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weekLabel: { fontSize: 15, fontWeight: '600', color: TOKENS.ink },

  body: { flex: 1 },

  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  errorTitle: { fontSize: 16, color: TOKENS.ink, fontWeight: '500' },
  backCta: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  backCtaLabel: { fontSize: 14, fontWeight: '600', color: TOKENS.surface },
});
