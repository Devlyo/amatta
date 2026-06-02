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
import { ColorDot } from '../../src/ui/common/ColorDot';
import { EmptyChildrenState } from '../../src/ui/common/EmptyChildrenState';
import { DailyGrid, type EmptySlotEvent } from '../../src/ui/grid/DailyGrid';
import { TOKENS } from '../../src/ui/palette';
import {
  formatKoreanDateLabel,
  shiftIsoDate,
  todayIso,
} from '../../src/ui/utils/date';

const SWIPE_THRESHOLD = 60;

export default function DailyViewScreen(): React.ReactElement {
  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);
  const currentDate = useUiStore((s) => s.currentDate);
  const setCurrentDate = useUiStore((s) => s.setCurrentDate);
  const openEditSheet = useUiStore((s) => s.openEditSheet);
  const router = useRouter();

  const [gridSurfaceWidth, setGridSurfaceWidth] = useState(0);

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
        // swipe left → next day
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
    // TODO (Phase 4): the actual edit sheet UI consumes ui-store and reads
    // preFill.childId + a startMinutes hint. Plumb startMinutes through
    // EditSheetPreFill once the sheet ships.
    void startMinutes;
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
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={goPrev}
          accessibilityRole="button"
          accessibilityLabel="이전 날짜"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={TOKENS.ink} />
        </Pressable>
        <Text style={styles.dateLabel}>{formatKoreanDateLabel(currentDate)}</Text>
        <Pressable
          onPress={goNext}
          accessibilityRole="button"
          accessibilityLabel="다음 날짜"
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={24} color={TOKENS.ink} />
        </Pressable>
        <View style={styles.headerSpacer} />
        <Pressable
          onPress={goToday}
          accessibilityRole="button"
          accessibilityLabel="오늘로 이동"
          style={({ pressed }) => [
            styles.todayPill,
            {
              backgroundColor: pressed ? TOKENS.primaryDeep : TOKENS.primary,
            },
          ]}
        >
          <Text style={styles.todayLabel}>오늘로</Text>
        </Pressable>
      </View>

      {/* Children header row */}
      <View style={styles.childrenHeader}>
        <View style={{ width: TIME_COL_WIDTH }} />
        <View style={styles.childrenRow}>
          {visibleChildren.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/child/${c.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${c.name} 주간 보기`}
              style={[styles.childCell, { minWidth: CHILD_COL_MIN }]}
            >
              <ColorDot colorIndex={c.colorIndex} size={12} />
              <Text style={styles.childName} numberOfLines={1}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Time column + Grid (swipeable area) */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.body}>
          {/* Time labels: 06:00 .. 22:00 at each hour boundary */}
          <View
            style={[styles.timeCol, { width: TIME_COL_WIDTH }]}
            pointerEvents="none"
          >
            {Array.from({ length: GRID_SLOTS }, (_, i) => {
              if (i % 2 !== 0) return <View key={i} style={styles.timeSpacer} />;
              const hour = GRID_START_HOUR + i / 2;
              return (
                <View key={i} style={styles.timeLabelRow}>
                  <Text style={styles.timeLabel}>{`${String(hour).padStart(2, '0')}:00`}</Text>
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
            />
          </View>
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
    gap: 8,
    borderBottomColor: TOKENS.hair,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dateLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: TOKENS.ink,
  },
  headerSpacer: { flex: 1 },
  todayPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 9999,
  },
  todayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TOKENS.surface,
  },
  childrenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomColor: TOKENS.hair,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  childrenRow: {
    flex: 1,
    flexDirection: 'row',
  },
  childCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  childName: {
    fontSize: 16,
    fontWeight: '600',
    color: TOKENS.ink,
    flexShrink: 1,
  },
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
    justifyContent: 'flex-start',
    paddingLeft: 8,
    paddingTop: 2,
  },
  timeLabel: {
    fontSize: 12,
    color: TOKENS.inkSub,
    fontVariant: ['tabular-nums'],
  },
  gridSurface: {
    flex: 1,
  },
});
