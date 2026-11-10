import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
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
  function renderDay(inactive: (number | 'guardian')[], onLongPressSlot?: jest.Mock) {
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
        onLongPressSlot={onLongPressSlot}
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

  test('long press on an empty slot pops in a 1-hour block, then reports person + hour', () => {
    jest.useFakeTimers();
    const onLongPressSlot = jest.fn();
    renderDay([], onLongPressSlot);
    // columns are 100px wide: x=150 → column 1 (서연); 10:05 → the 10 AM hour
    act(() => {
      fireGestureHandler(getByGestureTestId('time-grid-slots'), [
        { state: State.BEGAN, x: 150, y: 8 + 10 * 46 + 4 },
        { state: State.ACTIVE, x: 150, y: 8 + 10 * 46 + 4 },
        { state: State.END, x: 150, y: 8 + 10 * 46 + 4 },
      ]);
    });
    expect(screen.getByTestId('time-grid-draft')).toBeTruthy();
    expect(screen.getByText('새 일정')).toBeTruthy();
    expect(screen.getByText('10–11AM')).toBeTruthy();
    expect(onLongPressSlot).not.toHaveBeenCalled(); // form opens after the pop-in
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(onLongPressSlot).toHaveBeenCalledWith(2, 10 * 60);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.queryByTestId('time-grid-draft')).toBeNull();
    jest.useRealTimers();
  });

  test('guardian column → guardian; pressed time snaps to the hour', () => {
    jest.useFakeTimers();
    const onLongPressSlot = jest.fn();
    renderDay([], onLongPressSlot);
    fireGestureHandler(getByGestureTestId('time-grid-slots'), [
      { state: State.BEGAN, x: 250, y: 8 + 14.5 * 46 + 1 },
      { state: State.ACTIVE, x: 250, y: 8 + 14.5 * 46 + 1 },
      { state: State.END, x: 250, y: 8 + 14.5 * 46 + 1 },
    ]);
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(onLongPressSlot).toHaveBeenCalledWith('guardian', 14 * 60);
    jest.useRealTimers();
  });
});

describe('KidFilterBar — up to 6 kids + 보호자', () => {
  const many = (n: number): Child[] =>
    Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      name: `아이${i + 1}`,
      colorIndex: (i % 6) as ColorIndex,
      avatar: 'face-wink',
      createdAt: ISO('2026-01-01'),
    }));

  test('4 kids + 보호자 (5 pills): names still shown (compact)', () => {
    render(<KidFilterBar kids={many(4)} inactive={[]} onToggle={() => {}} onSolo={() => {}} />);
    expect(screen.getByText('아이4')).toBeTruthy();
    expect(screen.getByText('보호자')).toBeTruthy();
  });

  test('6 kids + 보호자 (7 pills): avatar only, names kept as labels', () => {
    render(<KidFilterBar kids={many(6)} inactive={[]} onToggle={() => {}} onSolo={() => {}} />);
    expect(screen.queryByText('아이6')).toBeNull();
    expect(screen.getByLabelText('아이6')).toBeTruthy();
    expect(screen.getByLabelText('보호자')).toBeTruthy();
  });
});
