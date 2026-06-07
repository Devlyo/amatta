// Render-level tests for the calendar body (CalendarBody).
//
// Post-migration: CalendarBody is the de-chromed content rendered by the
// app/calendar/index.tsx formSheet route. It reads currentDate from the store
// and delegates dismissal to an `onClose` prop (the route calls router.back()).
// (The old @gorhom/bottom-sheet mock was dead — the component never imported
// gorhom — and has been removed.)

import { act, fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';

import { CalendarBody } from '../../../src/ui/drawers/CalendarDrawer';
import { useUiStore } from '../../../src/state/ui-store';
import type { ISODate } from '../../../src/domain/types';

const ISO = (s: string): ISODate => s as unknown as ISODate;

// Pin today() so "today highlight" is deterministic. The body reads
// todayIso() from src/ui/utils/date, which derives from `new Date()`.
const ORIGINAL_DATE = Date;
class FakeDate extends ORIGINAL_DATE {
  constructor(...args: ConstructorParameters<typeof Date>) {
    if (args.length === 0) {
      super(2026, 4, 5); // 2026-05-05 local
      return;
    }
    // @ts-expect-error — Date's overload set isn't tight enough to forward.
    super(...args);
  }
}

describe('CalendarBody', () => {
  beforeAll(() => {
    // @ts-expect-error — override global Date for deterministic todayIso().
    global.Date = FakeDate;
  });

  afterAll(() => {
    global.Date = ORIGINAL_DATE;
  });

  beforeEach(() => {
    act(() => {
      useUiStore.setState({ currentDate: ISO('2026-05-05') });
    });
  });

  test('renders the current month label + DOW header', () => {
    const { queryByText } = render(<CalendarBody onClose={() => {}} />);
    expect(queryByText('2026년 5월')).not.toBeNull();
    for (const d of ['일', '월', '화', '수', '목', '금', '토']) {
      expect(queryByText(d)).not.toBeNull();
    }
  });

  test('next-month chevron advances the visible month', () => {
    const { queryByText, getByLabelText } = render(<CalendarBody onClose={() => {}} />);
    expect(queryByText('2026년 5월')).not.toBeNull();
    fireEvent.press(getByLabelText('다음 달'));
    expect(queryByText('2026년 6월')).not.toBeNull();
    fireEvent.press(getByLabelText('이전 달'));
    fireEvent.press(getByLabelText('이전 달'));
    expect(queryByText('2026년 4월')).not.toBeNull();
  });

  test('tapping a date sets currentDate and calls onClose', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(<CalendarBody onClose={onClose} />);
    fireEvent.press(getByLabelText('2026년 5월 12일'));
    expect(useUiStore.getState().currentDate as unknown as string).toBe('2026-05-12');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('today (2026-05-05) is rendered with the primary highlight pill', () => {
    const { getByLabelText, UNSAFE_getAllByType } = render(
      <CalendarBody onClose={() => {}} />,
    );
    // 2026-05-05 is 어린이날 — the holiday name gets appended to the cell's
    // accessibility label by the Korean-holidays integration.
    const todayBtn = getByLabelText('2026년 5월 5일 어린이날');
    const views = UNSAFE_getAllByType(View);
    const hasPrimary = views.some((v) => {
      const style = v.props.style;
      const flat = Array.isArray(style) ? style.flat(Infinity) : [style];
      return flat.some(
        (s: unknown) =>
          typeof s === 'object' &&
          s !== null &&
          'backgroundColor' in s &&
          (s as { backgroundColor?: string }).backgroundColor === '#FF7144',
      );
    });
    expect(todayBtn).not.toBeNull();
    expect(hasPrimary).toBe(true);
  });
});
