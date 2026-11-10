import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import type { Child, ColorIndex, ISODate, Occurrence, ScheduleType } from '../../../src/domain/types';
import { MonthView } from '../../../src/ui/calendar/MonthView';
import { BLOCK_DIMMED_OPACITY } from '../../../src/ui/calendar/TimeBlock';
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
  ];

  function renderWeek(zoomed: boolean, extra: Partial<React.ComponentProps<typeof WeekView>> = {}) {
    const days = visibleWeekDays(ISO('2026-11-10'), zoomed);
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

  test('fixed schedules are regular blocks; same-day overlaps stack', () => {
    renderWeek(false);
    const a = style('week-block-1|2026-11-10');
    const b = style('week-block-2|2026-11-10');
    expect(b.left).toBeGreaterThan(a.left);
    expect(b.zIndex).toBeGreaterThan(a.zIndex);
    expect(screen.getByTestId('week-block-3|2026-11-12')).toBeTruthy();
    expect(screen.queryByText('3–4PM')).toBeNull(); // compact: titles only
  });

  test('zoomed shows 4 days and block times', () => {
    renderWeek(true);
    expect(screen.getByTestId('week-day-2026-11-13')).toBeTruthy();
    expect(screen.queryByTestId('week-day-2026-11-14')).toBeNull();
    expect(screen.getByText('3–4PM')).toBeTruthy();
  });

  test('switched-off kids fade', () => {
    renderWeek(false, { inactive: [1] });
    expect(style('week-block-1|2026-11-10').opacity).toBe(BLOCK_DIMMED_OPACITY);
    expect(style('week-block-3|2026-11-12').opacity).toBe(1);
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

  test('switched-off kids fade', () => {
    renderMonth(false, [2]);
    expect(style('month-chip-2026-11-10-3').opacity).toBe(0.2);
    expect(style('month-chip-2026-11-10-2').opacity).toBe(1);
  });
});
