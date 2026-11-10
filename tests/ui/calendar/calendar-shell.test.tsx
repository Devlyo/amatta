import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { Child, ColorIndex, ISODate, Occurrence } from '../../../src/domain/types';
import { CalendarTopBar } from '../../../src/ui/calendar/CalendarTopBar';
import { DateStrip } from '../../../src/ui/calendar/DateStrip';
import { DayView } from '../../../src/ui/calendar/DayView';
import { KidFilterBar, PILL_FADED_OPACITY } from '../../../src/ui/calendar/KidFilterBar';
import { BLOCK_DIMMED_OPACITY } from '../../../src/ui/calendar/TimeBlock';
import { TIME_GUTTER } from '../../../src/ui/calendar/time-axis';

const ISO = (s: string) => s as unknown as ISODate;

const kids: Child[] = [
  { id: 1, name: '민준', colorIndex: 0 as ColorIndex, avatar: 'face-wink', createdAt: ISO('2026-01-01') },
  { id: 2, name: '서연', colorIndex: 5 as ColorIndex, avatar: 'face-calm', createdAt: ISO('2026-01-01') },
];

function occ(scheduleId: number, childId: number, start: number, end: number, title: string): Occurrence {
  return {
    scheduleId,
    childId,
    date: ISO('2026-11-10'),
    startMinutes: start,
    endMinutes: end,
    title,
    type: 'academy',
    colorIndex: (childId === 1 ? 0 : 5) as ColorIndex,
    needsPickup: false,
  };
}

function opacityOf(testID: string): unknown {
  return (StyleSheet.flatten(screen.getByTestId(testID).props.style) as { opacity?: unknown }).opacity;
}

describe('KidFilterBar', () => {
  test('everyone active by default; tap toggles, long press solos', () => {
    const onToggle = jest.fn();
    const onSolo = jest.fn();
    render(<KidFilterBar kids={kids} inactive={[]} onToggle={onToggle} onSolo={onSolo} />);
    expect(opacityOf('kid-filter-1')).toBe(1);
    expect(opacityOf('kid-filter-guardian')).toBe(1);
    fireEvent.press(screen.getByTestId('kid-filter-2'));
    fireEvent(screen.getByTestId('kid-filter-guardian'), 'longPress');
    expect(onToggle.mock.calls).toEqual([[2]]);
    expect(onSolo.mock.calls).toEqual([['guardian']]);
  });

  test('fades the pills that are switched off', () => {
    render(<KidFilterBar kids={kids} inactive={[1, 'guardian']} onToggle={() => {}} onSolo={() => {}} />);
    expect(opacityOf('kid-filter-2')).toBe(1);
    expect(opacityOf('kid-filter-1')).toBe(PILL_FADED_OPACITY);
    expect(opacityOf('kid-filter-guardian')).toBe(PILL_FADED_OPACITY);
  });
});

describe('CalendarTopBar', () => {
  test('disabled views cannot be selected; search fires', () => {
    const onChangeView = jest.fn();
    const onPressSearch = jest.fn();
    render(
      <CalendarTopBar
        title="오늘"
        caption="11월 10일 · 화"
        view="day"
        enabledViews={['day']}
        onChangeView={onChangeView}
        onPressTitle={() => {}}
        onPressSearch={onPressSearch}
      />,
    );
    fireEvent.press(screen.getByTestId('view-week'));
    expect(onChangeView).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('검색'));
    expect(onPressSearch).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('일정 추가')).toBeNull(); // + lives in the dock
  });
});

describe('DateStrip', () => {
  test('shows Sun..Sat of the selected week and selects a date', () => {
    const onSelect = jest.fn();
    render(<DateStrip selected={ISO('2026-11-10')} today={ISO('2026-11-10')} onSelect={onSelect} />);
    expect(screen.getByTestId('date-strip-2026-11-08')).toBeTruthy(); // Sunday
    expect(screen.getByTestId('date-strip-2026-11-14')).toBeTruthy(); // Saturday
    fireEvent.press(screen.getByTestId('date-strip-2026-11-12'));
    expect(onSelect).toHaveBeenCalledWith('2026-11-12');
  });
});

describe('DayView', () => {
  function renderDay(inactive: (number | 'guardian')[]) {
    render(
      <DayView
        kids={kids}
        occurrences={[
          occ(10, 1, 16 * 60, 17 * 60 + 30, '영어학원'),
          occ(11, 1, 17 * 60, 18 * 60, '치과'),
          occ(20, 2, 15 * 60, 16 * 60, '피아노'),
        ]}
        nowMinutes={null}
        inactive={inactive}
        scrollKey="2026-11-10"
        onPressOccurrence={() => {}}
      />,
    );
    fireEvent(screen.getByTestId('day-view'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: TIME_GUTTER + 3 * 100, height: 600 } },
    });
  }

  test('one block per occurrence, overlapping ones stacked', () => {
    renderDay([]);
    expect(screen.getByText('영어학원')).toBeTruthy();
    expect(screen.getByText('피아노')).toBeTruthy();
    const under = StyleSheet.flatten(screen.getByTestId('day-block-10').props.style) as { zIndex: number; left: number };
    const over = StyleSheet.flatten(screen.getByTestId('day-block-11').props.style) as { zIndex: number; left: number };
    expect(over.zIndex).toBeGreaterThan(under.zIndex);
    expect(over.left).toBeGreaterThan(under.left);
  });

  test('switched-off people fade; a solo person is emphasised', () => {
    renderDay([1, 'guardian']); // only 서연 (2) active → solo
    expect(opacityOf('day-block-20')).toBe(1);
    expect(opacityOf('day-block-10')).toBe(BLOCK_DIMMED_OPACITY);
  });
});
