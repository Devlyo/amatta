// 캘린더 탭 — ADR-007 §1–4 (design canvas boards "1 월간" "2 주간" "3 일간").
//
//   CalendarTopBar   title + date picker · day/week/month · search
//   KidFilterBar     kid + guardian pills (tap = on/off, long press = only)
//   day   → DateStrip + DayView (kid columns + guardian column)
//   week  → WeekView (7 days; pinch → 4 days with times)
//   month → MonthView (chips, "+N"; pinch → 2-line chips with start time)
//
// One-finger horizontal swipe drags the page with the finger and pages by a
// day / the visible days / a month. Pinching stretches the content live, then
// snaps: week 7 → 4 → 3 → 2 days, month normal ↔ 2-line chips. Long press on an empty
// slot (day/week) creates an event there. New events from anywhere else use
// the dock's "+".

import { useEffect, useMemo } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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
  nextWeekSpan,
  visibleWeekDays,
  weekSwipeDays,
  type WeekSpan,
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
const PAGE_MS = 160;
/** Month cells: zoomed / normal height (MonthView) — the live stretch snaps to this. */
const MONTH_ZOOM_RATIO = 136 / 104;

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
  const weekSpan = useUiStore((s) => s.weekSpan);
  const setWeekSpan = useUiStore((s) => s.setWeekSpan);
  const monthZoomed = useUiStore((s) => s.monthZoomed);
  const setMonthZoomed = useUiStore((s) => s.setMonthZoomed);
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

  const weekDays = useMemo(() => visibleWeekDays(currentDate, weekSpan), [currentDate, weekSpan]);
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
    else if (view === 'week')
      setCurrentDate(shiftIsoDate(currentDate, dir * weekSwipeDays(weekSpan)));
    else setCurrentDate(shiftIsoMonth(currentDate, dir));
  };

  // ── Live motion ──────────────────────────────────────────────────────────
  // dragX: the page follows one finger; past the threshold it slides out, the
  // date moves, and the new page slides in from the other side.
  // stretch: pinch scales the content around the fingers (week → wider
  // columns, month → taller cells); on release it eases to the next level's
  // ratio, then the real layout for that level replaces the preview.
  const bodyW = useSharedValue(0);
  const dragX = useSharedValue(0);
  const stretch = useSharedValue(1);
  const focal = useSharedValue(0);
  const pinchView = useSharedValue<'day' | 'week' | 'month'>(view);
  useEffect(() => {
    pinchView.value = view;
    stretch.value = 1;
    dragX.value = 0;
  }, [view, pinchView, stretch, dragX]);

  const commitMove = (dir: -1 | 1): void => {
    move(dir);
    dragX.value = -dir * bodyW.value * 0.35;
    dragX.value = withTiming(0, { duration: PAGE_MS });
  };
  const commitWeekSpan = (span: WeekSpan): void => {
    setWeekSpan(span);
    stretch.value = 1;
  };
  const commitMonthZoom = (zoomed: boolean): void => {
    setMonthZoomed(zoomed);
    stretch.value = 1;
  };
  const endPinch = (scale: number): void => {
    if (view === 'week') {
      const next = nextWeekSpan(weekSpan, scale);
      if (next === weekSpan) {
        stretch.value = withTiming(1, { duration: PAGE_MS });
        return;
      }
      stretch.value = withTiming(weekSpan / next, { duration: PAGE_MS }, (done) => {
        if (done) runOnJS(commitWeekSpan)(next);
      });
    } else if (view === 'month') {
      const zoom = scale >= PINCH_IN ? true : scale <= PINCH_OUT ? false : monthZoomed;
      if (zoom === monthZoomed) {
        stretch.value = withTiming(1, { duration: PAGE_MS });
        return;
      }
      stretch.value = withTiming(
        zoom ? MONTH_ZOOM_RATIO : 1 / MONTH_ZOOM_RATIO,
        { duration: PAGE_MS },
        (done) => {
          if (done) runOnJS(commitMonthZoom)(zoom);
        },
      );
    }
  };

  const swipe = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX([-20, 20])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      dragX.value = e.translationX;
    })
    .onEnd((e) => {
      const w = bodyW.value;
      if (e.translationX <= -SWIPE_THRESHOLD) {
        dragX.value = withTiming(-w, { duration: PAGE_MS }, (done) => {
          if (done) runOnJS(commitMove)(1);
        });
      } else if (e.translationX >= SWIPE_THRESHOLD) {
        dragX.value = withTiming(w, { duration: PAGE_MS }, (done) => {
          if (done) runOnJS(commitMove)(-1);
        });
      } else {
        dragX.value = withTiming(0, { duration: PAGE_MS });
      }
    });
  const pinch = Gesture.Pinch()
    .enabled(view !== 'day')
    .onStart((e) => {
      focal.value = pinchView.value === 'week' ? e.focalX : e.focalY;
    })
    .onUpdate((e) => {
      stretch.value = Math.min(Math.max(e.scale, 0.3), 4);
    })
    .onEnd((e) => {
      runOnJS(endPinch)(e.scale);
    });
  const gestures = Gesture.Simultaneous(swipe, pinch);

  const bodyStyle = useAnimatedStyle(() => {
    const w = bodyW.value;
    const s = stretch.value;
    const pinchT = focal.value * (1 - s);
    const isMonth = pinchView.value === 'month';
    return {
      opacity: w > 0 ? 1 - Math.min(Math.abs(dragX.value) / w, 1) * 0.6 : 1,
      transform: isMonth
        ? [{ translateX: dragX.value }, { translateY: pinchT }, { scaleY: s }]
        : [{ translateX: dragX.value + pinchT }, { scaleX: s }],
    };
  });
  const onBodyLayout = (e: LayoutChangeEvent): void => {
    bodyW.value = e.nativeEvent.layout.width;
  };

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
    caption =
      first.m === last.m ? `${first.d}–${last.d}일` : `${first.d}일 – ${last.m}월 ${last.d}일`;
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
        <DateStrip
          selected={currentDate}
          today={today}
          onSelect={(d: ISODate) => setCurrentDate(d)}
        />
      ) : null}
      <GestureDetector gesture={gestures}>
        <View style={styles.body} onLayout={onBodyLayout}>
          <Animated.View style={[styles.stage, bodyStyle]}>
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
                zoomed={weekSpan < 7}
                scrollKey={`week-${weekDays[0] as unknown as string}-${weekSpan}`}
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
          </Animated.View>
        </View>
      </GestureDetector>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.surface },
  // The viewport clips the stretched / sliding stage.
  body: { flex: 1, overflow: 'hidden' },
  // Left/top origin so the pinch stretch (translate + scale) pivots on the fingers.
  stage: { flex: 1, transformOrigin: 'left top' },
});
