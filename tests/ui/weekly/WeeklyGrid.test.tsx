// Render-level tests for WeeklyGrid. Layout math is covered exhaustively in
// tests/domain/grid-week.test.ts; here we exercise that the component mounts,
// renders weekday headers, and emits a block per occurrence.

import { render } from '@testing-library/react-native';

import type { ISODate, Occurrence } from '../../../src/domain/types';
import { WeeklyGrid } from '../../../src/ui/weekly/WeeklyGrid';

const iso = (s: string): ISODate => s as unknown as ISODate;

const WEEK: ISODate[] = [
  iso('2026-06-01'),
  iso('2026-06-02'),
  iso('2026-06-03'),
  iso('2026-06-04'),
  iso('2026-06-05'),
  iso('2026-06-06'),
  iso('2026-06-07'),
];

describe('WeeklyGrid', () => {
  test('renders 7 weekday-short labels (월~일)', () => {
    const { queryByText } = render(
      <WeeklyGrid occurrences={[]} weekDates={WEEK} columnWidth={60} />,
    );
    for (const label of ['월', '화', '수', '목', '금', '토', '일']) {
      expect(queryByText(label)).not.toBeNull();
    }
  });

  test('renders date numbers from weekDates', () => {
    const { queryByText } = render(
      <WeeklyGrid occurrences={[]} weekDates={WEEK} columnWidth={60} />,
    );
    expect(queryByText('1')).not.toBeNull();
    expect(queryByText('7')).not.toBeNull();
  });

  test('renders a block for each occurrence', () => {
    const occurrences: Occurrence[] = [
      {
        scheduleId: 1,
        childId: 10,
        date: iso('2026-06-02'),
        startMinutes: 9 * 60,
        endMinutes: 10 * 60,
        title: '학교',
        type: 'school',
        colorIndex: 0,
      },
      {
        scheduleId: 2,
        childId: 10,
        date: iso('2026-06-04'),
        startMinutes: 17 * 60,
        endMinutes: 18 * 60,
        title: '피아노',
        type: 'activity',
        colorIndex: 2,
      },
    ];
    const { queryByText } = render(
      <WeeklyGrid
        occurrences={occurrences}
        weekDates={WEEK}
        columnWidth={60}
      />,
    );
    expect(queryByText('학교')).not.toBeNull();
    expect(queryByText('피아노')).not.toBeNull();
  });

  test('drops occurrences whose date is not in the displayed week', () => {
    const { queryByText } = render(
      <WeeklyGrid
        occurrences={[
          {
            scheduleId: 99,
            childId: 1,
            date: iso('2026-05-30'),
            startMinutes: 540,
            endMinutes: 600,
            title: 'last week',
            type: 'other',
            colorIndex: 0,
          },
        ]}
        weekDates={WEEK}
        columnWidth={60}
      />,
    );
    expect(queryByText('last week')).toBeNull();
  });
});
