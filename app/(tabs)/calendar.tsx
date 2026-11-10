// 캘린더 탭 — ADR-007 §1–4 (design canvas boards "1 월간" "2 주간" "3 일간").
//
//   CalendarTopBar   title + date picker · day/week/month · search
//   KidFilterBar     kid + guardian pills (tap = on/off, long press = only)
//   day   → DateStrip + DayView (kid columns + guardian column)
//   week  → WeekView (7 days; pinch → 4 days with times)
//   month → MonthView (chips, "+N"; pinch → 2-line chips with start time)
//
// One-finger horizontal swipe moves by a day / a week (4 days zoomed) / a
// month. Pinch out/in toggles the week/month zoom. Long press on an empty
// slot (day/week) creates an event there. New events from anywhere else use
// the dock's "+".

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
import {
  monthGridDates,
  visibleWeekDays,
  weekSwipeDays,
} from '../../src/ui/calendar/calendar-layout';
import { DateStrip } from '../../src/ui/calendar/DateStrip';
import { DayView } from '../../src/ui/calendar/DayView';
import { KidFilterBar } from '../../src/ui/calendar/KidFilterBar';
import { MonthView } from '../../src/ui/calendar/MonthView';
import { useNowMinutes } from '../../src/ui/calendar/useNowMinutes';
import { WeekView } from '../../src/ui/calendar/WeekView';
import { TOKENS } from '../../src/ui/palette';
import { shiftIsoDate, shiftIsoMonth, todayIso, weekdayKo } from '../../src/ui/utils/date';

const ENABLED_VIEWS: readonly CalendarView[] = ['day', 'week', 'month'];
const SWIPE_THRESHOLD = 60;
const PINCH_IN = 1.15;
const PINCH_OUT = 0.87;

function md(date: ISODate): { m: number; d: number } {
  const s = date as unknown as string;
  return { m: Number(s.slice(5, 7)), d: Number(s.slice(8, 10)) };
}

export default function CalendarScreen(): React.ReactElement {
  const router = useRouter();
  const children = useChildrenStore((s) => s.children);
  const schedules = useSchedulesStore((s) => s.schedules);
  const exceptions = useSchedulesStore((s) => s.exceptions);
  const currentDate = useUiStore((s) => s.currentDate);
  const setCurrentDate = useUiStore((s) => s.setCurrentDate);
  const view = useUiStore((s) => s.calendarView);
  const setCalendarView = useUiStore((s) => s.setCalendarView);
  const weekZoomed = useUiStore((s) => s.weekZoomed);
  const monthZoomed = useUiStore((s) => s.monthZoomed);
  const setZoomed = useUiStore((s) => s.setZoomed);
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
  const everyone = useMemo<PersonKey[]>(() => [...kids.map((k) => k.id), 'guardian'], [kids]);

  const weekDays = useMemo(() => visibleWeekDays(currentDate, weekZoomed), [currentDate, weekZoomed]);
  const monthDates = useMemo(() => monthGridDates(currentDate), [currentDate]);

  // Occurrences for exactly what the active view shows.
  const range = useMemo(() => {
    const span = (list: readonly ISODate[]) => ({
      from: list[0] ?? currentDate,
      to: list[list.length - 1] ?? currentDate,
    });
    if (view === 'week') return span(weekDays);
    if (view === 'month') return span(monthDates);
    return { from: currentDate, to: currentDate };
  }, [view, weekDays, monthDates, currentDate]);
  const occurrences = useMemo<Occurrence[]>(
    () => expandOccurrences(schedules, exceptions, range, childrenById),
    [schedules, exceptions, range, childrenById],
  );

  const move = (dir: -1 | 1): void => {
    if (view === 'day') setCurrentDate(shiftIsoDate(currentDate, dir));
    else if (view === 'week') setCurrentDate(shiftIsoDate(currentDate, dir * weekSwipeDays(weekZoomed)));
    else setCurrentDate(shiftIsoMonth(currentDate, dir));
  };
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .maxPointers(1)
    .activeOffsetX([-20, 20])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      if (e.translationX <= -SWIPE_THRESHOLD) move(1);
      else if (e.translationX >= SWIPE_THRESHOLD) move(-1);
    });
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .enabled(view !== 'day')
    .onEnd((e) => {
      if (view === 'day') return;
      if (e.scale >= PINCH_IN) setZoomed(view, true);
      else if (e.scale <= PINCH_OUT) setZoomed(view, false);
    });
  const gestures = Gesture.Simultaneous(swipe, pinch);

  // Title + caption per view.
  let title: string;
  let caption: string;
  let holiday = false;
  if (view === 'day') {
    const { m, d } = md(currentDate);
    const weekday = weekdayKo(currentDate);
    title = isToday ? '오늘' : `${m}월 ${d}일`;
    caption = isToday ? `${m}월 ${d}일 · ${weekday}` : weekday;
    holiday = weekday === '일' || isKoreanHoliday(currentDate);
  } else if (view === 'week') {
    const first = md(weekDays[0] ?? currentDate);
    const last = md(weekDays[weekDays.length - 1] ?? currentDate);
    title = `${first.m}월`;
    caption = first.m === last.m ? `${first.d}–${last.d}일` : `${first.d}일 – ${last.m}월 ${last.d}일`;
  } else {
    title = `${md(currentDate).m}월`;
    caption = dateKey.slice(0, 4);
  }

  const openDetail = (occ: Occurrence): void => {
    router.push({
      pathname: '/event/detail',
      params: { scheduleId: String(occ.scheduleId), occurrenceDate: occ.date },
    });
  };
  const openDay = (date: ISODate): void => {
    setCurrentDate(date);
    setCalendarView('day');
  };
  // Long press on an empty slot → new event there (kid column → that kid
  // pre-selected; guardian column / week view → the form asks for the kid).
  const createAt = (date: ISODate, minutes: number, person?: PersonKey): void => {
    const params: Record<string, string> = {
      mode: 'create',
      date: date as unknown as string,
      start: String(minutes),
    };
    if (person !== undefined && person !== 'guardian') params.childId = String(person);
    router.push({ pathname: '/schedule/edit', params });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <CalendarTopBar
        title={title}
        caption={caption}
        holiday={holiday}
        view={view}
        enabledViews={ENABLED_VIEWS}
        onChangeView={setCalendarView}
        onPressTitle={() => router.push('/date-picker')}
        onPressSearch={() => router.push('/search')}
      />
      <KidFilterBar
        kids={kids}
        inactive={inactivePeople}
        onToggle={togglePerson}
        onSolo={(key) => soloPerson(key, everyone)}
      />
      {view === 'day' ? (
        <DateStrip selected={currentDate} today={today} onSelect={(d: ISODate) => setCurrentDate(d)} />
      ) : null}
      <GestureDetector gesture={gestures}>
        <View style={styles.body}>
          {view === 'day' ? (
            <DayView
              kids={kids}
              occurrences={occurrences}
              nowMinutes={isToday ? nowMinutes : null}
              inactive={inactivePeople}
              scrollKey={`day-${dateKey}`}
              onPressOccurrence={openDetail}
              onLongPressSlot={(person, minutes) => createAt(currentDate, minutes, person)}
            />
          ) : view === 'week' ? (
            <WeekView
              days={weekDays}
              today={today}
              kids={kids}
              occurrences={occurrences}
              nowMinutes={nowMinutes}
              inactive={inactivePeople}
              zoomed={weekZoomed}
              scrollKey={`week-${weekDays[0] as unknown as string}-${String(weekZoomed)}`}
              onPressOccurrence={openDetail}
              onPressDay={openDay}
              onLongPressSlot={(date, minutes) => createAt(date, minutes)}
            />
          ) : (
            <MonthView
              anchor={currentDate}
              today={today}
              kids={kids}
              occurrences={occurrences}
              inactive={inactivePeople}
              zoomed={monthZoomed}
              onPressDay={openDay}
            />
          )}
        </View>
      </GestureDetector>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.surface },
  body: { flex: 1 },
});
