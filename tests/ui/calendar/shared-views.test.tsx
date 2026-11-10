// ADR-013 view A: a shared schedule draws a copy in every member's column
// (day) / lane (week bars), one block in week block mode, one chip in month;
// the guardian copy only while the guardian is shown.

import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Child, ColorIndex, ISODate, Occurrence } from '../../../src/domain/types';
import { DayView } from '../../../src/ui/calendar/DayView';
import { MonthView } from '../../../src/ui/calendar/MonthView';
import { WeekView } from '../../../src/ui/calendar/WeekView';
import { visibleWeekDays } from '../../../src/ui/calendar/calendar-layout';
import { TIME_GUTTER } from '../../../src/ui/calendar/time-axis';

const ISO = (s: string) => s as unknown as ISODate;
const kids: Child[] = [
  { id: 1, name: '민준', colorIndex: 0 as ColorIndex, avatar: 'face-wink', createdAt: ISO('2026-01-01') },
  { id: 2, name: '서연', colorIndex: 5 as ColorIndex, avatar: 'face-calm', createdAt: ISO('2026-01-01') },
  { id: 3, name: '도윤', colorIndex: 2 as ColorIndex, avatar: 'face-cool', createdAt: ISO('2026-01-01') },
];

const family: Occurrence = {
  scheduleId: 7,
  childId: 1,
  memberIds: [1, 3],
  withGuardian: true,
  date: ISO('2026-11-10'),
  startMinutes: 18 * 60,
  endMinutes: 20 * 60,
  title: '가족 모임',
  type: 'other',
  colorIndex: 0 as ColorIndex,
  needsPickup: false,
  allDay: false,
};

function renderDay(inactive: (number | 'guardian')[] = [], guardian = true) {
  render(
    <DayView
      kids={kids}
      occurrences={[family]}
      nowMinutes={null}
      inactive={inactive}
      scrollKey="d"
      onPressOccurrence={() => {}}
      guardian={guardian}
    />,
  );
  fireEvent(screen.getByTestId('day-view'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: TIME_GUTTER + 4 * 90, height: 800 } },
  });
}

describe('DayView — shared schedule', () => {
  test('a copy in each member column + the guardian column, with stacked faces', () => {
    renderDay();
    expect(screen.getByTestId('day-block-7-1')).toBeTruthy();
    expect(screen.getByTestId('day-block-7-3')).toBeTruthy();
    expect(screen.getByTestId('day-block-7-g')).toBeTruthy();
    expect(screen.queryByTestId('day-block-7-2')).toBeNull();
    expect(screen.getAllByLabelText('함께: 민준, 도윤, 보호자').length).toBe(3);
  });

  test('switching a member off hides only their copy', () => {
    renderDay([1]);
    expect(screen.queryByTestId('day-block-7-1')).toBeNull();
    expect(screen.getByTestId('day-block-7-3')).toBeTruthy();
  });

  test('보호자 일정 off → no guardian copy', () => {
    renderDay([], false);
    expect(screen.queryByTestId('day-block-7-g')).toBeNull();
    expect(screen.getByTestId('day-block-7-1')).toBeTruthy();
  });
});

describe('WeekView — shared schedule', () => {
  function renderWeek(span: number) {
    const days = visibleWeekDays(ISO('2026-11-10'), 7);
    render(
      <WeekView
        days={days}
        today={ISO('2026-11-10')}
        kids={kids}
        occurrences={[family]}
        nowMinutes={13 * 60}
        inactive={[]}
        zoomed={span <= 4}
        span={span}
        scrollKey="w"
        onPressOccurrence={() => {}}
        onPressDay={() => {}}
      />,
    );
    fireEvent(screen.getByTestId('week-view'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: TIME_GUTTER + 7 * 50, height: 600 } },
    });
  }

  test('bars (7 days): one bar per member lane incl. the guardian', () => {
    renderWeek(7);
    expect(screen.getByTestId('week-bar-7|2026-11-10|1')).toBeTruthy();
    expect(screen.getByTestId('week-bar-7|2026-11-10|3')).toBeTruthy();
    expect(screen.getByTestId('week-bar-7|2026-11-10|guardian')).toBeTruthy();
  });

  test('blocks (≤ 4 days): one block, not one per person', () => {
    renderWeek(3.2);
    expect(screen.getAllByText('가족 모임')).toHaveLength(1);
  });
});

describe('MonthView — shared schedule', () => {
  test('one chip per schedule', () => {
    render(
      <MonthView
        anchor={ISO('2026-11-10')}
        today={ISO('2026-11-10')}
        kids={kids}
        occurrences={[family]}
        inactive={[]}
        zoomed
        onPressDay={() => {}}
      />,
    );
    expect(screen.getAllByText('가족 모임')).toHaveLength(1);
  });
});
