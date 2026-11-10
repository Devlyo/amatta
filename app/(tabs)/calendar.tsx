// 캘린더 탭 — ADR-007 §1–4 (design canvas boards "1 월간" "2 주간" "3 일간").
//
//   CalendarTopBar   title + date picker · day/week/month · search
//   KidFilterBar     kid + guardian pills (tap = on/off, long press = only)
//   day   → DateStrip + DayView (kid columns + guardian column)
//   week  → WeekView (7 days; pinch → 4 days with times)
//   month → MonthView (chips, "+N"; pinch → 2-line chips with start time)
//
// Day, week and month all scroll sideways natively (iOS paging physics): day
// and month page one at a time; the week strip pages by week at 7 days and
// glides day by day when zoomed. Pinching stretches the content live, then
// re-lays out live: week columns (7 … 2 days), month rows (taller rows get
// 2-line chips with the start time); both stay where the fingers stop. Long press on an empty
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
  useSharedValue,
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
  clampMonthRow,
  clampWeekSpan,
  monthGridDates,
  monthsBetween,
  visibleWeekDays,
  WEEK_SPAN_SHOW_TIME,
  type WeekSpan,
} from '../../src/ui/calendar/calendar-layout';
import {
  DEFAULT_HOUR_HEIGHT,
  initialScrollY,
  ongoingStart,
  TIME_GUTTER,
} from '../../src/ui/calendar/time-axis';
import { PagingStrip } from '../../src/ui/calendar/PagingStrip';
import { DateStrip } from '../../src/ui/calendar/DateStrip';
import { DayView } from '../../src/ui/calendar/DayView';
import { KidFilterBar } from '../../src/ui/calendar/KidFilterBar';
import { MonthStrip } from '../../src/ui/calendar/MonthStrip';
import { useNowMinutes } from '../../src/ui/calendar/useNowMinutes';
import { useGuardianEvents } from '../../src/ui/calendar/useGuardianEvents';
import { openGuardianEvent } from '../../src/calendar/guardian-calendar';
import type { GuardianOccurrence } from '../../src/domain/guardian';
import { useGuardianStore } from '../../src/state/guardian-store';
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
/** Day strip: days either side of the start (native paging). */
const DAY_HALF = 366;
const DAY_PAGES = DAY_HALF * 2 + 1;
const DAY_MARGIN = 3;
/** Month strip: months either side of the start (paged natively, like the week strip). */
const MONTH_HALF = 24;
const MONTH_PAGES = MONTH_HALF * 2 + 1;
const MONTH_MARGIN = 3;
const firstOfMonth = (d: ISODate): ISODate => `${(d as unknown as string).slice(0, 7)}-01` as unknown as ISODate;
const monthOriginFor = (d: ISODate): ISODate => shiftIsoMonth(firstOfMonth(d), -MONTH_HALF);
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
  const monthRowH = useUiStore((s) => s.monthRowH);
  const setMonthRowH = useUiStore((s) => s.setMonthRowH);
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
    // Reports come every week crossed, so a far jump is a stale measurement.
    if (Math.abs(col - daysBetweenIso(stripOrigin, currentDate)) > 21) return;
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
  // Month strip: page 0 = monthOrigin; the window renders the current month ±1.
  const [monthOrigin, setMonthOrigin] = useState<ISODate>(() => monthOriginFor(currentDate));
  const [monthJump, setMonthJump] = useState(0);
  const monthScrolled = useRef<string | null>(null);
  useEffect(() => {
    // Entering the month view, or the date changed elsewhere → show its month.
    if (view !== 'month' || monthScrolled.current === dateKey) return;
    const page = monthsBetween(monthOrigin, currentDate);
    if (page < MONTH_MARGIN || page > MONTH_PAGES - 1 - MONTH_MARGIN) setMonthOrigin(monthOriginFor(currentDate));
    setMonthJump((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, dateKey]);
  const onMonthPage = (page: number): void => {
    const date = shiftIsoMonth(currentDate, page - monthsBetween(monthOrigin, currentDate));
    monthScrolled.current = date as unknown as string;
    setCurrentDate(date);
    if (page < MONTH_MARGIN || page > MONTH_PAGES - 1 - MONTH_MARGIN) {
      setMonthOrigin(monthOriginFor(date));
      setMonthJump((n) => n + 1);
    }
  };
  // Day strip: page 0 = dayOrigin; current day ±1 rendered. Pages share one
  // vertical offset so paging keeps the hour you were looking at.
  const [dayOrigin, setDayOrigin] = useState<ISODate>(() => shiftIsoDate(currentDate, -DAY_HALF));
  const [dayJump, setDayJump] = useState(0);
  const [dayY, setDayY] = useState<{ y: number; n: number } | null>(null);
  const dayScrolled = useRef<string | null>(null);
  const dayPage = daysBetweenIso(dayOrigin, currentDate);
  useEffect(() => {
    if (view !== 'day' || dayScrolled.current === dateKey) return;
    if (dayPage < DAY_MARGIN || dayPage > DAY_PAGES - 1 - DAY_MARGIN) {
      setDayOrigin(shiftIsoDate(currentDate, -DAY_HALF));
    }
    setDayY(null); // a jump opens at "now" / the first event again
    setDayJump((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, dateKey]);
  const monthWindowDates = useMemo(() => {
    const prev = monthGridDates(shiftIsoMonth(firstOfMonth(currentDate), -1));
    const next = monthGridDates(shiftIsoMonth(firstOfMonth(currentDate), 1));
    return [prev[0] ?? currentDate, next[next.length - 1] ?? currentDate];
  }, [currentDate]);

  // Occurrences for exactly what the active view shows.
  const range = useMemo(() => {
    const span = (list: readonly ISODate[]) => ({
      from: list[0] ?? currentDate,
      to: list[list.length - 1] ?? currentDate,
    });
    if (view === 'week') return span(windowDays);
    if (view === 'month') return span(monthWindowDates);
    return { from: shiftIsoDate(currentDate, -1), to: shiftIsoDate(currentDate, 1) };
  }, [view, windowDays, monthWindowDates, currentDate]);
  const occurrences = useMemo<Occurrence[]>(
    () => expandOccurrences(schedules, exceptions, range, childrenById),
    [schedules, exceptions, range, childrenById],
  );
  // Guardian events (device calendar, ADR-008) for the same range.
  const guardianEvents = useGuardianEvents(range.from, range.to);
  const guardianOn = (date: ISODate): readonly GuardianOccurrence[] =>
    guardianEvents.filter((g) => (g.date as unknown as string) === (date as unknown as string));
  // Day pages: their own day's occurrences; one shared opening offset.
  const occurrencesOn = (date: ISODate): Occurrence[] =>
    occurrences.filter((o) => (o.date as unknown as string) === (date as unknown as string));
  const todayTimed = [
    ...occurrencesOn(currentDate).filter((o) => !o.allDay),
    ...guardianOn(currentDate).filter((g) => !g.allDay),
  ];
  const dayOpenY =
    dayY?.y ??
    initialScrollY({
      hourHeight: DEFAULT_HOUR_HEIGHT,
      nowMinutes: isToday ? nowMinutes : null,
      firstStart: todayTimed.length > 0 ? Math.min(...todayTimed.map((o) => o.startMinutes)) : null,
      ongoingStart: ongoingStart(todayTimed, isToday ? nowMinutes : null),
    });
  const onDayPage = (page: number): void => {
    const date = shiftIsoDate(dayOrigin, page);
    dayScrolled.current = date as unknown as string;
    // Freeze the vertical position so the new neighbours open at it.
    setDayY((d) => d ?? { y: dayOpenY, n: 0 });
    setCurrentDate(date);
    if (page < DAY_MARGIN || page > DAY_PAGES - 1 - DAY_MARGIN) {
      setDayOrigin(shiftIsoDate(date, -DAY_HALF));
      setDayJump((n) => n + 1);
    }
  };



  // ── Live motion ──────────────────────────────────────────────────────────
  // Day view: the page follows one finger; past the threshold it slides out,
  // the date moves, and the new page slides in. Week and month are native
  // paging strips. Pinch re-lays out week columns / month rows every frame
  // (no stretched text, no snap-back) and stays where the fingers stop.
  const bodyW = useSharedValue(0);
  const scrollX = useSharedValue(0);
  const pinchView = useSharedValue<'day' | 'week' | 'month'>(view);
  const liveSpan = useSharedValue<number>(weekSpan);
  const liveRowH = useSharedValue<number>(monthRowH);
  const stripLocked = useSharedValue(false);
  const stripSizing = useSharedValue(false);
  const stripRef = useAnimatedRef<Animated.ScrollView>();
  const pinchFrom = useSharedValue({ span: 7, focalCol: 0, fScreen: 0, rowH: 104 });
  useEffect(() => {
    pinchView.value = view;
  }, [view, pinchView]);
  useEffect(() => {
    if (stripLocked.value) return;
    liveSpan.value = weekSpan;
    liveRowH.value = monthRowH;
    // The new zoom is rendered → hand layout back to React.
    stripSizing.value = false;
  }, [weekSpan, monthRowH, stripPos.n, liveSpan, liveRowH, stripLocked, stripSizing]);


  const commitWeekSpan = (span: WeekSpan, col: number): void => {
    setWeekSpan(span);
    setStripPos((p) => ({ col, n: p.n + 1 }));
    const date = dateAtColumn(Math.max(0, Math.round(col)), span);
    scrolledDate.current = date as unknown as string;
    if ((date as unknown as string) !== dateKey) setCurrentDate(date);
  };

  const pinch = Gesture.Pinch()
    .enabled(view !== 'day')
    .onStart((e) => {
      if (pinchView.value === 'week') {
        const vw = bodyW.value - TIME_GUTTER;
        const fScreen = e.focalX - TIME_GUTTER;
        stripLocked.value = true;
        stripSizing.value = true;
        pinchFrom.value = {
          span: liveSpan.value,
          fScreen,
          focalCol: vw > 0 ? (fScreen + scrollX.value) / (vw / liveSpan.value) : 0,
          rowH: liveRowH.value,
        };
      } else {
        stripLocked.value = true;
        stripSizing.value = true;
        pinchFrom.value = { span: liveSpan.value, fScreen: 0, focalCol: 0, rowH: liveRowH.value };
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
        liveRowH.value = clampMonthRow(pinchFrom.value.rowH * e.scale);
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
        if (!stripLocked.value) return;
        stripLocked.value = false;
        runOnJS(setMonthRowH)(liveRowH.value);
      }
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
  // Guardian event → the system event screen (view / edit), then re-read.
  const openGuardian = (g: GuardianOccurrence): void => {
    void openGuardianEvent(g.eventId, g.instanceStart)
      .catch(() => undefined)
      .finally(() => useGuardianStore.getState().invalidate());
  };
  const openDay = (date: ISODate): void => {
    setCurrentDate(date);
    setCalendarView('day');
  };
  // Long press on an empty slot → new event there (kid column → that kid
  // pre-selected; guardian column → 보호자 pre-selected (ADR-008); week view →
  // the form asks).
  const createAt = (date: ISODate, minutes: number, person?: PersonKey): void => {
    const params: Record<string, string> = {
      mode: 'create',
      date: date as unknown as string,
      start: String(minutes),
    };
    if (person === 'guardian') params.guardian = '1';
    else if (person !== undefined) params.childId = String(person);
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
      {view === 'day' ? (
        <DateStrip
          selected={currentDate}
          today={today}
          onSelect={(d: ISODate) => setCurrentDate(d)}
        />
      ) : null}
      {/* Day view: names sit under the dates, right above their columns. */}
      <KidFilterBar
        kids={kids}
        inactive={inactivePeople}
        onToggle={togglePerson}
        onSolo={(key) => soloPerson(key, everyone)}
      />
      <GestureDetector gesture={pinch}>
        <View style={styles.body} onLayout={onBodyLayout}>
          <View style={styles.stage}>
            {view === 'day' ? (
              <PagingStrip
                testID="day-strip"
                pages={DAY_PAGES}
                current={dayPage}
                jumpKey={`${dayOrigin as unknown as string}-${dayJump}`}
                onPage={onDayPage}
                renderPage={(p) => {
                  const date = shiftIsoDate(dayOrigin, p);
                  const pageIsToday = (date as unknown as string) === (today as unknown as string);
                  return (
                    <DayView
                      testID={p === dayPage ? 'day-view' : `day-view-${p - dayPage}`}
                      kids={kids}
                      occurrences={occurrencesOn(date)}
                      guardianEvents={guardianOn(date)}
                      onPressGuardian={openGuardian}
                      nowMinutes={pageIsToday ? nowMinutes : null}
                      inactive={inactivePeople}
                      openAt={dayOpenY}
                      scrollKey={`day-${dayJump}-${dayY?.n ?? 0}`}
                      onScrollEndY={(y) => setDayY((d) => ({ y, n: (d?.n ?? 0) + 1 }))}
                      onPressOccurrence={openDetail}
                      onLongPressSlot={(person, minutes) => createAt(date, minutes, person)}
                    />
                  );
                }}
              />
            ) : view === 'week' ? (
              <WeekView
                guardianEvents={guardianEvents}
                onPressGuardian={openGuardian}
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
                  sizing: stripSizing,
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
              <MonthStrip
                guardianEvents={guardianEvents}
                anchor={currentDate}
                origin={monthOrigin}
                pages={MONTH_PAGES}
                jumpKey={`${monthOrigin as unknown as string}-${monthJump}`}
                today={today}
                kids={kids}
                occurrences={occurrences}
                inactive={inactivePeople}
                rowHeight={monthRowH}
                live={{ sizing: stripSizing, rowH: liveRowH }}
                locked={stripLocked}
                onPage={onMonthPage}
                onPressDay={openDay}
              />
            )}
          </View>
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
