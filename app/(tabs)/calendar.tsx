// 캘린더 탭 — ADR-007 §1–4 (design canvas boards "1 월간" "2 주간" "3 일간").
//
//   CalendarTopBar   title + date picker · day/week/month · search
//   KidFilterBar     kid + guardian pills (tap = on/off, long press = only)
//   DateStrip        (day view) Sun..Sat of the selected week
//   DayView          kid columns + guardian column on the shared TimeGrid
//
// Phase 2: the day view only — week/month render disabled in the segment
// until Phase 3. Swiping the grid left/right moves one day.

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';

import { MAX_CHILDREN } from '../../src/domain/constants';
import { isKoreanHoliday } from '../../src/domain/korean-holidays';
import { expandOccurrences } from '../../src/domain/occurrences';
import type { Child, ISODate, Occurrence } from '../../src/domain/types';
import { useChildrenStore } from '../../src/state/children-store';
import { useSchedulesStore } from '../../src/state/schedules-store';
import { useUiStore, type CalendarView, type PersonKey } from '../../src/state/ui-store';
import { CalendarTopBar } from '../../src/ui/calendar/CalendarTopBar';
import { DateStrip } from '../../src/ui/calendar/DateStrip';
import { DayView } from '../../src/ui/calendar/DayView';
import { KidFilterBar } from '../../src/ui/calendar/KidFilterBar';
import { useNowMinutes } from '../../src/ui/calendar/useNowMinutes';
import { TOKENS } from '../../src/ui/palette';
import { shiftIsoDate, todayIso, weekdayKo } from '../../src/ui/utils/date';

/** Views available in this phase; week/month land in Phase 3. */
const ENABLED_VIEWS: readonly CalendarView[] = ['day'];
const SWIPE_THRESHOLD = 60;

export default function CalendarScreen(): React.ReactElement {
  const router = useRouter();
  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);
  const currentDate = useUiStore((s) => s.currentDate);
  const setCurrentDate = useUiStore((s) => s.setCurrentDate);
  const calendarView = useUiStore((s) => s.calendarView);
  const setCalendarView = useUiStore((s) => s.setCalendarView);
  const inactivePeople = useUiStore((s) => s.inactivePeople);
  const togglePerson = useUiStore((s) => s.togglePerson);
  const soloPerson = useUiStore((s) => s.soloPerson);

  const nowMinutes = useNowMinutes();
  const today = todayIso();
  const dateKey = currentDate as unknown as string;
  const isToday = dateKey === (today as unknown as string);

  const kids = useMemo<Child[]>(
    () => [...children].sort((a, b) => a.id - b.id).slice(0, MAX_CHILDREN),
    [children],
  );
  const childrenById = useMemo(() => new Map(kids.map((k) => [k.id, k])), [kids]);

  const occurrences = useMemo<Occurrence[]>(
    () => expandOccurrences(schedules, exceptions, { from: currentDate, to: currentDate }, childrenById),
    [schedules, exceptions, currentDate, childrenById],
  );

  const shiftDay = (dir: -1 | 1): void => setCurrentDate(shiftIsoDate(currentDate, dir));
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      if (e.translationX <= -SWIPE_THRESHOLD) shiftDay(1);
      else if (e.translationX >= SWIPE_THRESHOLD) shiftDay(-1);
    });

  const month = Number(dateKey.slice(5, 7));
  const day = Number(dateKey.slice(8, 10));
  const weekday = weekdayKo(currentDate);
  const title = isToday ? '오늘' : `${month}월 ${day}일`;
  const caption = isToday ? `${month}월 ${day}일 · ${weekday}` : weekday;
  const holiday = weekday === '일' || isKoreanHoliday(currentDate);

  const openDetail = (occ: Occurrence): void => {
    router.push({
      pathname: '/event/detail',
      params: { scheduleId: String(occ.scheduleId), occurrenceDate: currentDate },
    });
  };

  // Long press on an empty slot → new event there (kid column → that kid
  // pre-selected; the guardian column has no kid, so the form asks).
  const createAt = (person: PersonKey, minutes: number): void => {
    const params: Record<string, string> = {
      mode: 'create',
      date: dateKey,
      start: String(minutes),
    };
    if (person !== 'guardian') params.childId = String(person);
    router.push({ pathname: '/schedule/edit', params });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <CalendarTopBar
        title={title}
        caption={caption}
        holiday={holiday}
        view={calendarView}
        enabledViews={ENABLED_VIEWS}
        onChangeView={setCalendarView}
        onPressTitle={() => router.push('/date-picker')}
        onPressSearch={() => router.push('/search')}
      />
      <KidFilterBar
        kids={kids}
        inactive={inactivePeople}
        onToggle={togglePerson}
        onSolo={(key) => soloPerson(key, [...kids.map((k) => k.id), 'guardian'])}
      />
      <DateStrip selected={currentDate} today={today} onSelect={(d: ISODate) => setCurrentDate(d)} />
      <GestureDetector gesture={swipe}>
        <View style={styles.body}>
          <DayView
            kids={kids}
            occurrences={occurrences}
            nowMinutes={isToday ? nowMinutes : null}
            inactive={inactivePeople}
            scrollKey={dateKey}
            onPressOccurrence={openDetail}
            onLongPressSlot={createAt}
          />
        </View>
      </GestureDetector>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.surface },
  body: { flex: 1 },
});
