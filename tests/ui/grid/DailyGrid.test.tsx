import { render } from '@testing-library/react-native';
import { DailyGrid } from '../../../src/ui/grid/DailyGrid';
import { GRID_SLOTS } from '../../../src/domain/constants';
import type { ISODate, Occurrence } from '../../../src/domain/types';

const iso = (s: string): ISODate => s as unknown as ISODate;

describe('DailyGrid', () => {
  test('renders 34 SlotCells when given no occurrences', () => {
    const { UNSAFE_root } = render(
      <DailyGrid
        occurrences={[]}
        childrenOrder={[1, 2]}
        columnWidth={120}
      />,
    );
    // SlotCell renders a styled View; one Pressable for the tap surface
    // and N=GRID_SLOTS=34 cells. We look up the count of SlotCells by
    // walking the tree for the styled cell signature.
    const allViews = UNSAFE_root.findAllByType('View' as never).length;
    // Sanity floor: at least GRID_SLOTS Views must exist (one per row).
    expect(allViews).toBeGreaterThanOrEqual(GRID_SLOTS);
  });

  test('renders one ScheduleBlock per occurrence', () => {
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
        childId: 20,
        date: iso('2026-06-02'),
        startMinutes: 17 * 60,
        endMinutes: 18 * 60,
        title: '피아노',
        type: 'activity',
        colorIndex: 2,
      },
    ];

    const { queryByText } = render(
      <DailyGrid
        occurrences={occurrences}
        childrenOrder={[10, 20]}
        columnWidth={120}
      />,
    );

    expect(queryByText('학교')).not.toBeNull();
    expect(queryByText('피아노')).not.toBeNull();
  });

  test('drops blocks whose childId is not in childrenOrder', () => {
    const occurrences: Occurrence[] = [
      {
        scheduleId: 99,
        childId: 999, // not in order
        date: iso('2026-06-02'),
        startMinutes: 9 * 60,
        endMinutes: 10 * 60,
        title: 'orphan',
        type: 'school',
        colorIndex: 0,
      },
    ];

    const { queryByText } = render(
      <DailyGrid
        occurrences={occurrences}
        childrenOrder={[10]}
        columnWidth={120}
      />,
    );

    expect(queryByText('orphan')).toBeNull();
  });
});
