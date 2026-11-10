// 캘린더 탭 — ADR-007 §1–4 (design canvas boards "1 월간" "2 주간" "3 일간").
//
//   CalendarTopBar   title + date picker · day/week/month · search
//   KidFilterBar     kid + guardian pills (tap = on/off, long press = only)
//   day   → DateStrip + DayView (kid columns + guardian column)
//   week  → WeekView (7 days; pinch → 4 days with times)
//   month → MonthView (chips, "+N"; pinch → 2-line chips with start time)
//
// One-finger horizontal swipe drags the page with the finger and pages by a
// day / a month; the week view is a native sideways-scrolling day strip
// (pages by week at 7 days, glides day by day when zoomed). Pinching stretches the content live, then
// snaps: month normal ↔ 2-line chips. The week view re-lays out its day
// columns live (7 … 2 days, continuous) and stays where the fingers stop. Long press on an empty
// slot (day/week) creates an event there. New events from anywhere else use
// the dock's "+".

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  scrollTo,
  useAnimatedRef,
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
  clampWeekSpan,
  monthGridDates,
  visibleWeekDays,
  WEEK_SPAN_SHOW_TIME,
  type WeekSpan,
} from '../../src/ui/calendar/calendar-layout';
import { TIME_GUTTER } from '../../src/ui/calendar/time-axis';
import { DateStrip } from '../../src/ui/calendar/DateStrip';
import { DayView } from '../../src/ui/calendar/DayView';
import { KidFilterBar } from '../../src/ui/calendar/KidFilterBar';
import { MonthView } from '../../src/ui/calendar/MonthView';
import { useNowMinutes } from '../../src/ui/calendar/useNowMinutes';
import { WeekView } from '../../src/ui/calendar/WeekView';
import { TOKENS } from '../../src/ui/palette';
import {
  daysBetweenIso,
  shiftIsoDate,
  shiftIsoMonth,
  todayIso,
  weekdayKo,
  weekStartIso,
} from '../../src/ui/utils/date';

const ENABLED_VIEWS: readonly CalendarView[] = ['day', 'week', 'month'];
const SWIPE_THRESHOLD = 60;
const PINCH_IN = 1.15;
const PINCH_OUT = 0.87;
const PAGE_MS = 160;
/** Month cells: zoomed / normal height (MonthView) — the live stretch snaps to this. */
const MONTH_ZOOM_RATIO = 136 / 104;
/**
 * The week view is one long native-scrolling day strip (weeks either side of
 * the start), so dragging is plain iOS scrolling — no page swaps. Only a
 * 3-week window around the visible week is rendered.
 */
const STRIP_HALF_WEEKS = 26;
const STRIP_COLUMNS = (STRIP_HALF_WEEKS * 2 + 1) * 7;
/** Re-centre the strip when the view gets this close (days) to either end. */
const STRIP_MARGIN = 28;
const stripOriginFor = (d: ISODate): ISODate => shiftIsoDate(weekStartIso(d), -STRIP_HALF_WEEKS * 7);

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

  // Title week (Sun..Sat of the current date).
  const weekDays = useMemo(() => visibleWeekDays(currentDate, 7), [currentDate]);
  const weekStart = weekStartIso(currentDate);
  // Long week strip: column 0 = stripOrigin (a Sunday). Rendered window = the
  // current week ±1 week.
  const [stripOrigin, setStripOrigin] = useState<ISODate>(() => stripOriginFor(currentDate));
  const windowDays = useMemo(
    () => Array.from({ length: 21 }, (_, i) => shiftIsoDate(weekStart, i - 7)),
    [weekStart],
  );
  const windowFirstColumn = daysBetweenIso(stripOrigin, windowDays[0] ?? weekStart);
  // Left edge column of the strip + a nonce so the same value re-positions.
  const leftColumnFor = (col: number, span: WeekSpan): number => (span === 7 ? col - (col % 7) : col);
  const [stripPos, setStripPos] = useState<{ col: number; n: number }>(() => ({
    col: leftColumnFor(daysBetweenIso(stripOrigin, currentDate), weekSpan),
    n: 0,
  }));
  // Date the strip itself last scrolled to — such changes must not re-position it.
  const scrolledDate = useRef<string | null>(null);
  // Bumped on jumps only (not zoom / scroll), so the hours re-scroll to "now" then.
  const [weekJump, setWeekJump] = useState(0);
  const jumpStripTo = (date: ISODate, span: WeekSpan): void => {
    let origin = stripOrigin;
    let col = daysBetweenIso(origin, date);
    if (col < STRIP_MARGIN || col > STRIP_COLUMNS - STRIP_MARGIN) {
      origin = stripOriginFor(date);
      setStripOrigin(origin);
      col = daysBetweenIso(origin, date);
    }
    setStripPos((p) => ({ col: leftColumnFor(col, span), n: p.n + 1 }));
    setWeekJump((n) => n + 1);
  };
  useEffect(() => {
    // Entering the week view, or the date changed elsewhere (picker, day view)
    // → show that day.
    if (view !== 'week' || scrolledDate.current === dateKey) return;
    jumpStripTo(currentDate, weekSpan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, dateKey]);
  // Date for a strip column: whole week on screen → same weekday in that week;
  // zoomed → the left-most visible day.
  const dateAtColumn = (col: number, span: WeekSpan): ISODate =>
    span === 7
      ? shiftIsoDate(stripOrigin, col - (col % 7) + daysBetweenIso(weekStart, currentDate))
      : shiftIsoDate(stripOrigin, col);
  const onStripColumn = (col: number): void => {
    const date = dateAtColumn(col, weekSpan);
    scrolledDate.current = date as unknown as string;
    if ((date as unknown as string) !== dateKey) setCurrentDate(date);
    // Far from the start → re-centre (rare; months of scrolling).
    if (col < STRIP_MARGIN || col > STRIP_COLUMNS - STRIP_MARGIN) {
      const origin = stripOriginFor(date);
      setStripOrigin(origin);
      setStripPos((p) => ({ col: col - daysBetweenIso(stripOrigin, origin), n: p.n + 1 }));
    }
  };
  const stripReport = useRef(onStripColumn);
  stripReport.current = onStripColumn;
  const reportStripColumn = useCallback((col: number) => stripReport.current(col), []);
  const monthDates = useMemo(() => monthGridDates(currentDate), [currentDate]);

  // Occurrences for exactly what the active view shows.
  const range = useMemo(() => {
    const span = (list: readonly ISODate[]) => ({
      from: list[0] ?? currentDate,
      to: list[list.length - 1] ?? currentDate,
    });
    if (view === 'week') return span(windowDays);
    if (view === 'month') return span(monthDates);
    return { from: currentDate, to: currentDate };
  }, [view, windowDays, monthDates, currentDate]);
  const occurrences = useMemo<Occurrence[]>(
    () => expandOccurrences(schedules, exceptions, range, childrenById),
    [schedules, exceptions, range, childrenById],
  );

  const move = (dir: -1 | 1): void => {
    if (view === 'day') setCurrentDate(shiftIsoDate(currentDate, dir));
    else if (view === 'week') setCurrentDate(shiftIsoDate(currentDate, dir * 7));
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
  const scrollX = useSharedValue(0);
  const pinchView = useSharedValue<'day' | 'week' | 'month'>(view);
  // Month pinch can only stretch as far as the zoomed level reaches.
  const stretchMin = useSharedValue(1);
  const stretchMax = useSharedValue(1);
  // Week pinch: the column width itself changes every frame (Apple-style, no
  // stretched text, no snap-back); the strip scrolls so the day under the
  // fingers stays put.
  const liveSpan = useSharedValue<number>(weekSpan);
  const stripLocked = useSharedValue(false);
  const stripRef = useAnimatedRef<Animated.ScrollView>();
  const pinchFrom = useSharedValue({ span: 7, focalCol: 0, fScreen: 0 });
  useEffect(() => {
    pinchView.value = view;
    stretch.value = 1;
    dragX.value = 0;
    stretchMin.value = monthZoomed ? 1 / MONTH_ZOOM_RATIO : 1;
    stretchMax.value = monthZoomed ? 1 : MONTH_ZOOM_RATIO;
  }, [view, monthZoomed, pinchView, stretch, dragX, stretchMin, stretchMax]);
  useEffect(() => {
    if (!stripLocked.value) liveSpan.value = weekSpan;
  }, [weekSpan, liveSpan, stripLocked]);

  const commitMove = (dir: -1 | 1): void => {
    move(dir);
    dragX.value = -dir * bodyW.value * 0.35;
    dragX.value = withTiming(0, { duration: PAGE_MS });
  };
  const commitWeekSpan = (span: WeekSpan, col: number): void => {
    setWeekSpan(span);
    setStripPos((p) => ({ col, n: p.n + 1 }));
    const date = dateAtColumn(Math.max(0, Math.round(col)), span);
    scrolledDate.current = date as unknown as string;
    if ((date as unknown as string) !== dateKey) setCurrentDate(date);
    stretch.value = 1;
  };
  const commitMonthZoom = (zoomed: boolean): void => {
    setMonthZoomed(zoomed);
    stretch.value = 1;
  };
  const endPinch = (scale: number): void => {
    if (view === 'month') {
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
    // The week view scrolls sideways natively (see the strip).
    .enabled(view !== 'week')
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
      if (pinchView.value === 'week') {
        const vw = bodyW.value - TIME_GUTTER;
        const fScreen = e.focalX - TIME_GUTTER;
        stripLocked.value = true;
        pinchFrom.value = {
          span: liveSpan.value,
          fScreen,
          focalCol: vw > 0 ? (fScreen + scrollX.value) / (vw / liveSpan.value) : 0,
        };
      } else {
        focal.value = e.focalY;
      }
    })
    .onUpdate((e) => {
      if (pinchView.value === 'week') {
        const vw = bodyW.value - TIME_GUTTER;
        const from = pinchFrom.value;
        const span = clampWeekSpan(from.span / e.scale);
        liveSpan.value = span;
        scrollTo(stripRef, Math.max(0, from.focalCol * (vw / span) - from.fScreen), 0, false);
      } else {
        stretch.value = Math.min(Math.max(e.scale, stretchMin.value), stretchMax.value);
      }
    })
    .onFinalize(() => {
      if (pinchView.value === 'week') {
        if (!stripLocked.value) return;
        const vw = bodyW.value - TIME_GUTTER;
        const from = pinchFrom.value;
        const span = liveSpan.value;
        stripLocked.value = false;
        // Stays exactly where the fingers left it (no snapping to levels).
        runOnJS(commitWeekSpan)(span, vw > 0 ? Math.max(0, from.focalCol - from.fScreen / (vw / span)) : 0);
      } else {
        runOnJS(endPinch)(stretch.value);
      }
    });
  const gestures = Gesture.Simultaneous(swipe, pinch);

  const bodyStyle = useAnimatedStyle(() => {
    const w = bodyW.value;
    const s = stretch.value;
    const pinchT = focal.value * (1 - s);
    const isMonth = pinchView.value === 'month';
    return {
      opacity: w > 0 ? 1 - Math.min(Math.abs(dragX.value) / w, 1) * 0.6 : 1,
      // Week stretch is applied inside the grid (columns only, gutter fixed).
      transform: isMonth
        ? [{ translateX: dragX.value }, { translateY: pinchT }, { scaleY: s }]
        : [{ translateX: dragX.value }],
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
                days={windowDays}
                firstColumn={windowFirstColumn}
                totalColumns={STRIP_COLUMNS}
                today={today}
                kids={kids}
                occurrences={occurrences}
                nowMinutes={nowMinutes}
                inactive={inactivePeople}
                zoomed={weekSpan <= WEEK_SPAN_SHOW_TIME}
                span={weekSpan}
                strip={{
                  scrollX,
                  span: liveSpan,
                  scrollRef: stripRef,
                  locked: stripLocked,
                  initialColumn: stripPos.col,
                  key: `${stripOrigin as unknown as string}-${weekSpan}-${stripPos.n}`,
                  onVisibleColumn: reportStripColumn,
                }}
                scrollKey={`week-${weekJump}`}
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
