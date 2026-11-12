import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import type { Child, ColorIndex, ISODate, Occurrence, ScheduleType } from '../../../src/domain/types';
import { MonthStrip } from '../../../src/ui/calendar/MonthStrip';
import { MonthView } from '../../../src/ui/calendar/MonthView';
import { WeekView } from '../../../src/ui/calendar/WeekView';
import { TIME_GUTTER } from '../../../src/ui/calendar/time-axis';
import { visibleWeekDays } from '../../../src/ui/calendar/calendar-layout';

const ISO = (s: string) => s as unknown as ISODate;

const kids: Child[] = [
  { id: 1, name: '민준', colorIndex: 0 as ColorIndex, avatar: 'face-wink', createdAt: ISO('2026-01-01') },
  { id: 2, name: '서연', colorIndex: 5 as ColorIndex, avatar: 'face-calm', createdAt: ISO('2026-01-01') },
];

function occ(
  scheduleId: number,
  childId: number,
  date: string,
  start: number,
  end: number,
  title: string,
  type: ScheduleType = 'academy',
): Occurrence {
  return {
    scheduleId,
    childId,
    date: ISO(date),
    startMinutes: start,
    endMinutes: end,
    title,
    type,
    colorIndex: (childId === 1 ? 0 : 5) as ColorIndex,
    needsPickup: false,
  };
}

const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style) as Record<string, number>;

describe('WeekView', () => {
  const week = [
    occ(1, 1, '2026-11-10', 9 * 60, 14 * 60 + 30, '학교', 'school'),
    occ(2, 2, '2026-11-10', 9 * 60, 13 * 60, '학교', 'school'),
    occ(3, 2, '2026-11-12', 15 * 60, 16 * 60, '피아노'),
    occ(4, 1, '2026-11-10', 16 * 60, 17 * 60, '영어'),
    occ(5, 2, '2026-11-10', 16 * 60 + 30, 17 * 60 + 30, '미술'),
    occ(6, 2, '2026-11-10', 10 * 60, 11 * 60, '현장학습'),
  ];

  function renderWeek(zoomed: boolean, extra: Partial<React.ComponentProps<typeof WeekView>> = {}) {
    const days = visibleWeekDays(ISO('2026-11-10'), zoomed ? 4 : 7);
    render(
      <WeekView
        days={days}
        today={ISO('2026-11-10')}
        kids={kids}
        occurrences={week}
        nowMinutes={13 * 60}
        inactive={[]}
        zoomed={zoomed}
        scrollKey="w"
        onPressOccurrence={() => {}}
        onPressDay={() => {}}
        {...extra}
      />,
    );
    fireEvent(screen.getByTestId('week-view'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: TIME_GUTTER + days.length * 50, height: 600 } },
    });
  }

  test('7 days: every event is a bar in its person’s lane (column ÷ people shown), no titles', () => {
    renderWeek(false);
    expect(screen.queryByTestId('week-block-1|2026-11-10')).toBeNull();
    expect(screen.queryByTestId('week-block-4|2026-11-10')).toBeNull();
    expect(screen.queryByText('학교')).toBeNull();
    expect(screen.queryByText('영어')).toBeNull();
    // 민준 · 서연 · 보호자 → three lanes in the Tue column.
    const lane = (50 - 2 - 2) / 3;
    const school1 = style('week-bar-1|2026-11-10');
    const english1 = style('week-bar-4|2026-11-10');
    const school2 = style('week-bar-2|2026-11-10');
    expect(school1.width).toBeCloseTo(lane);
    expect(school1.left).toBeCloseTo(2 * 50 + 1);
    expect(english1.left).toBeCloseTo(school1.left); // same person, same lane
    expect(school2.left).toBeCloseTo(2 * 50 + 1 + lane + 1);
    // 서연's 현장학습 overlaps her 학교 → drawn on top in her lane.
    const trip = style('week-bar-6|2026-11-10');
    expect(trip.left).toBeCloseTo(school2.left);
    expect(trip.zIndex).toBeGreaterThan(school2.zIndex);
    expect(screen.getByLabelText(/^민준 학교, 화요일/)).toBeTruthy();
  });

  test('a kid switched off frees their lane', () => {
    renderWeek(false, { inactive: [1] });
    expect(screen.queryByTestId('week-bar-1|2026-11-10')).toBeNull();
    expect(style('week-bar-2|2026-11-10').width).toBeCloseTo((50 - 2 - 1) / 2); // 서연 + 보호자
  });

  test('보호자 일정 off → no guardian lane', () => {
    renderWeek(false, { guardian: false });
    expect(style('week-bar-2|2026-11-10').width).toBeCloseTo((50 - 2 - 1) / 2); // 민준 + 서연
  });

  test('one kid: titled blocks even at 7 days (no bars)', () => {
    const one = kids.slice(0, 1);
    renderWeek(false, { kids: one, occurrences: week.filter((o) => o.childId === 1) });
    expect(screen.getByTestId('week-block-1|2026-11-10')).toBeTruthy();
    expect(screen.queryByTestId('week-bar-1|2026-11-10')).toBeNull();
    expect(screen.getByText('영어')).toBeTruthy();
  });

  test('≤ 4 days: titled blocks with times, school included, overlaps stack', () => {
    renderWeek(true);
    expect(screen.getByTestId('week-day-2026-11-13')).toBeTruthy();
    expect(screen.queryByTestId('week-day-2026-11-14')).toBeNull();
    expect(screen.getByText('3–4PM')).toBeTruthy();
    expect(screen.getByTestId('week-block-1|2026-11-10')).toBeTruthy();
    expect(screen.queryByTestId('week-bar-1|2026-11-10')).toBeNull();
    const a = style('week-slot-1|2026-11-10');
    const b = style('week-slot-2|2026-11-10');
    expect(b.left).toBeGreaterThan(a.left);
    expect(b.zIndex).toBeGreaterThan(a.zIndex);
  });

  test('one person picked alone → only their blocks, back to full width', () => {
    renderWeek(true);
    const narrowed = style('week-slot-5|2026-11-10').width; // overlaps 민준's 영어
    screen.unmount();
    renderWeek(true, { inactive: [1, 'guardian'] }); // 서연 alone
    expect(screen.queryByTestId('week-block-4|2026-11-10')).toBeNull();
    expect(style('week-slot-5|2026-11-10').width).toBeGreaterThan(narrowed);
    expect(style('week-slot-5|2026-11-10').width).toBe(50 - 2);
  });

  test('tap a day header → that day; long press a slot → that date + hour', () => {
    jest.useFakeTimers();
    const onPressDay = jest.fn();
    const onLongPressSlot = jest.fn();
    renderWeek(false, { onPressDay, onLongPressSlot });
    fireEvent.press(screen.getByTestId('week-day-2026-11-12'));
    expect(onPressDay).toHaveBeenCalledWith('2026-11-12');
    act(() => {
      fireGestureHandler(getByGestureTestId('time-grid-slots'), [
        { state: State.BEGAN, x: 4 * 50 + 10, y: 8 + 17 * 44 + 5 },
        { state: State.ACTIVE, x: 4 * 50 + 10, y: 8 + 17 * 44 + 5 },
        { state: State.END, x: 4 * 50 + 10, y: 8 + 17 * 44 + 5 },
      ]);
    });
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(onLongPressSlot).toHaveBeenCalledWith('2026-11-12', 17 * 60);
    jest.useRealTimers();
  });
});

describe('MonthView', () => {
  const month = [
    occ(1, 1, '2026-11-10', 9 * 60, 14 * 60, '학교', 'school'),
    occ(2, 1, '2026-11-10', 16 * 60, 17 * 60 + 30, '영어학원'),
    occ(3, 2, '2026-11-10', 15 * 60, 16 * 60, '피아노'),
    ...['소풍', '병원', '회식', '수영', '미술'].map((t, i) =>
      occ(10 + i, i % 2 === 0 ? 1 : 2, '2026-11-18', (9 + i) * 60, (10 + i) * 60, t),
    ),
  ];

  function renderMonth(zoomed: boolean, inactive: (number | 'guardian')[] = []) {
    render(
      <MonthView
        anchor={ISO('2026-11-10')}
        today={ISO('2026-11-10')}
        kids={kids}
        occurrences={month}
        inactive={inactive}
        zoomed={zoomed}
        onPressDay={() => {}}
      />,
    );
  }

  test('hides fixed schedules and orders chips by start time', () => {
    renderMonth(false);
    expect(screen.queryByText('학교')).toBeNull();
    const titles = screen.getAllByText(/영어학원|피아노/).map((n) => n.props.children);
    expect(titles).toEqual(['피아노', '영어학원']);
  });

  test('overflow → "+N" (4 slots, 3 when zoomed)', () => {
    renderMonth(false);
    expect(screen.getByTestId('month-more-2026-11-18').props.children).toEqual(['+', 2]);
    screen.unmount();
    renderMonth(true);
    expect(screen.getByTestId('month-more-2026-11-18').props.children).toEqual(['+', 3]);
  });

  test('zoomed chips show the start time', () => {
    renderMonth(false);
    expect(screen.queryByText('3PM')).toBeNull();
    screen.unmount();
    renderMonth(true);
    expect(screen.getByText('3PM')).toBeTruthy();
  });

  test('switched-off kids are hidden', () => {
    renderMonth(false, [2]);
    expect(screen.queryByTestId('month-chip-2026-11-10-3')).toBeNull();
    expect(style('month-chip-2026-11-10-2').opacity).toBe(1);
  });
});

describe('WeekView — many people (6) in a narrow day column', () => {
  test('six overlapping blocks fan out with distinct, in-column offsets', () => {
    const six: Child[] = [1, 2, 3, 4, 5].map((id) => ({
      id,
      name: `k${id}`,
      colorIndex: (id % 6) as ColorIndex,
      avatar: 'face-wink',
      createdAt: ISO('2026-01-01'),
    }));
    const occ6 = [1, 2, 3, 4, 5].map((id) =>
      occ(id, id, '2026-11-10', 9 * 60, (13 + id / 10) * 60, `학원${id}`),
    );
    render(
      <WeekView
        days={visibleWeekDays(ISO('2026-11-10'), 7)}
        today={ISO('2026-11-10')}
        kids={six}
        span={4}
        occurrences={occ6}
        nowMinutes={13 * 60}
        inactive={[]}
        zoomed={false}
        scrollKey="w"
        onPressOccurrence={() => {}}
        onPressDay={() => {}}
      />,
    );
    fireEvent(screen.getByTestId('week-view'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: TIME_GUTTER + 4 * 50, height: 600 } },
    });
    const lefts = [1, 2, 3, 4, 5].map((id) => style(`week-slot-${id}|2026-11-10`).left);
    const widths = [1, 2, 3, 4, 5].map((id) => style(`week-slot-${id}|2026-11-10`).width);
    expect(new Set(lefts).size).toBe(5); // no two stacked on the same spot
    const columnLeft = 2 * 50; // Tue column
    for (let i = 0; i < 5; i += 1) {
      expect(lefts[i]).toBeGreaterThanOrEqual(columnLeft);
      expect((lefts[i] ?? 0) + (widths[i] ?? 0)).toBeLessThanOrEqual(columnLeft + 50);
      expect(widths[i]).toBeGreaterThan(20); // deepest still ≈45% of the column
    }
  });
});

describe('WeekView — zoomed strip scrolls sideways through the whole week', () => {
  function renderStrip() {
    // Shared values are plain objects in tests.
    const sv = (v: number) => ({ value: v }) as never;
    render(
      <WeekView
        days={visibleWeekDays(ISO('2026-11-10'), 7)}
        today={ISO('2026-11-10')}
        kids={kids}
        occurrences={[occ(3, 2, '2026-11-12', 15 * 60, 16 * 60, '피아노')]}
        nowMinutes={13 * 60}
        inactive={[]}
        zoomed
        span={2}
        strip={{ scrollX: sv(0), stretch: sv(1), focalX: sv(0), initialColumn: 2, key: 'k' }}
        scrollKey="w"
        onPressOccurrence={() => {}}
        onPressDay={() => {}}
      />,
    );
    fireEvent(screen.getByTestId('week-view'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: TIME_GUTTER + 300, height: 600 } },
    });
  }

  test('all 7 days are laid out at half the viewport each (2-day zoom)', () => {
    renderStrip();
    expect(screen.getByTestId('week-day-2026-11-08')).toBeTruthy(); // Sun, off-screen left
    expect(screen.getByTestId('week-day-2026-11-14')).toBeTruthy(); // Sat, off-screen right
    expect(style('week-slot-3|2026-11-12').width).toBeGreaterThan(140); // ≈ 150px column
  });

  test('a long strip renders only its window, at the window\'s columns', () => {
    const sv = (v: number) => ({ value: v }) as never;
    render(
      <WeekView
        days={visibleWeekDays(ISO('2026-11-10'), 7)}
        firstColumn={14}
        totalColumns={35}
        today={ISO('2026-11-10')}
        kids={kids}
        occurrences={[occ(3, 2, '2026-11-12', 15 * 60, 16 * 60, '피아노')]}
        nowMinutes={13 * 60}
        inactive={[]}
        zoomed
        span={2}
        strip={{ scrollX: sv(0), stretch: sv(1), focalX: sv(0), initialColumn: 16, key: 'k' }}
        scrollKey="w"
        onPressOccurrence={() => {}}
        onPressDay={() => {}}
      />,
    );
    fireEvent(screen.getByTestId('week-view'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: TIME_GUTTER + 300, height: 600 } },
    });
    // Thu = window index 4 → strip column 18 → 18 × 150px.
    expect(style('week-slot-3|2026-11-12').left).toBeGreaterThanOrEqual(18 * 150);
    expect(style('week-slot-3|2026-11-12').left).toBeLessThan(19 * 150);
  });
});

describe('MonthStrip — months page sideways natively', () => {
  test('renders the current month ±1 at their pages; paging reports the page', () => {
    const onPage = jest.fn();
    render(
      <MonthStrip
        anchor={ISO('2026-11-10')}
        origin={ISO('2026-09-01')}
        pages={5}
        jumpKey="j"
        today={ISO('2026-11-10')}
        kids={kids}
        occurrences={[occ(2, 1, '2026-11-10', 16 * 60, 17 * 60, '영어학원')]}
        inactive={[]}
        rowHeight={128}
        onPage={onPage}
        onPressDay={() => {}}
      />,
    );
    fireEvent(screen.getByTestId('month-strip-viewport'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 350, height: 600 } },
    });
    expect(screen.getByTestId('month-view')).toBeTruthy(); // Nov (page 2)
    expect(screen.getByTestId('month-view--1')).toBeTruthy(); // Oct
    expect(screen.getByTestId('month-view-1')).toBeTruthy(); // Dec
    expect(screen.getByText('4PM')).toBeTruthy(); // 128px rows → two-line chips
    fireEvent(screen.getByTestId('month-strip'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 3 * 350, y: 0 } },
    });
    expect(onPage).toHaveBeenCalledWith(3);
  });
});

describe('guardian events (device calendar, ADR-008)', () => {
  const g = (key: string, date: string, start: number, end: number, title: string, allDay = false) => ({
    key: `${key}|${date}`,
    eventId: key,
    calendarId: 'home',
    title,
    date: ISO(date),
    startMinutes: start,
    endMinutes: end,
    allDay,
    instanceStart: new Date(2026, 10, 10),
  });

  test('week (7 days): grey guardian bar in its own lane; tap opens; solo kid hides it', () => {
    const onPressGuardian = jest.fn();
    const props = {
      days: visibleWeekDays(ISO('2026-11-10'), 7),
      today: ISO('2026-11-10'),
      kids,
      occurrences: [occ(3, 2, '2026-11-12', 15 * 60, 16 * 60, '피아노')],
      nowMinutes: 13 * 60,
      zoomed: false,
      scrollKey: 'w',
      onPressOccurrence: () => {},
      onPressDay: () => {},
      guardianEvents: [g('e1', '2026-11-12', 15 * 60, 17 * 60, '회의')],
      onPressGuardian,
    };
    render(<WeekView {...props} inactive={[]} />);
    fireEvent(screen.getByTestId('week-view'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: TIME_GUTTER + 7 * 50, height: 600 } },
    });
    expect(screen.getByLabelText(/^보호자 회의, 목요일 3–5PM/)).toBeTruthy();
    expect(screen.getByTestId('week-bar-g:e1|2026-11-12')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(/^보호자 회의, 목요일 3–5PM/));
    expect(onPressGuardian).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e1' }));
    screen.unmount();
    render(<WeekView {...props} inactive={[1, 'guardian']} />);
    expect(screen.queryByTestId('week-bar-g:e1|2026-11-12')).toBeNull();
  });

  test('month: guardian chips sit with the kids’ chips, all-day first', () => {
    render(
      <MonthView
        anchor={ISO('2026-11-10')}
        today={ISO('2026-11-10')}
        kids={kids}
        occurrences={[occ(2, 1, '2026-11-10', 16 * 60, 17 * 60, '영어학원')]}
        inactive={[]}
        zoomed={false}
        onPressDay={() => {}}
        guardianEvents={[g('e1', '2026-11-10', 9 * 60, 10 * 60, '회의'), g('e2', '2026-11-10', 0, 1440, '출장', true)]}
      />,
    );
    const titles = screen.getAllByText(/영어학원|회의|출장/).map((n) => n.props.children);
    expect(titles).toEqual(['출장', '회의', '영어학원']);
  });
});
