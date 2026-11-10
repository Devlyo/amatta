import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { TimeGrid } from '../../../src/ui/calendar/TimeGrid';
import { TIME_GUTTER } from '../../../src/ui/calendar/time-axis';

function layout(width: number) {
  fireEvent(screen.getByTestId('grid'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 600 } },
  });
}

describe('TimeGrid', () => {
  test('draws 00:00–24:00 hour labels with AM/PM', () => {
    render(
      <TimeGrid
        testID="grid"
        columns={4}
        hourHeight={46}
        nowMinutes={null}
        initialScrollY={0}
        scrollKey="d"
        renderColumns={() => null}
      />,
    );
    // 12 AM appears twice (00:00 and 24:00), noon once.
    expect(screen.getAllByText('12 AM')).toHaveLength(2);
    expect(screen.getByText('12 PM')).toBeTruthy();
    expect(screen.getByText('9 AM')).toBeTruthy();
    expect(screen.getByText('9 PM')).toBeTruthy();
  });

  test('shows the NOW pill only when nowMinutes is set', () => {
    const { rerender } = render(
      <TimeGrid
        testID="grid"
        columns={1}
        hourHeight={46}
        nowMinutes={13 * 60 + 20}
        initialScrollY={0}
        scrollKey="d"
        renderColumns={() => null}
      />,
    );
    expect(screen.getByTestId('time-grid-now')).toBeTruthy();
    expect(screen.getByText('1:20')).toBeTruthy();

    rerender(
      <TimeGrid
        testID="grid"
        columns={1}
        hourHeight={46}
        nowMinutes={null}
        initialScrollY={0}
        scrollKey="d"
        renderColumns={() => null}
      />,
    );
    expect(screen.queryByTestId('time-grid-now')).toBeNull();
  });

  test('renders columns after layout with the measured column width', () => {
    const renderColumns = jest.fn(({ columnWidth }: { columnWidth: number }) => (
      <Text>{`w=${columnWidth}`}</Text>
    ));
    render(
      <TimeGrid
        testID="grid"
        columns={4}
        hourHeight={46}
        nowMinutes={null}
        todayColumn={2}
        initialScrollY={0}
        scrollKey="d"
        renderColumns={renderColumns}
      />,
    );
    expect(screen.queryByText(/^w=/)).toBeNull(); // nothing before layout
    layout(TIME_GUTTER + 4 * 80);
    expect(screen.getByText('w=80')).toBeTruthy();
    expect(screen.getByTestId('time-grid-today-column')).toBeTruthy();
  });
});
