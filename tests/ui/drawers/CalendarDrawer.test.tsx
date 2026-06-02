// Render-level tests for CalendarDrawer.
//
// We bypass the @gorhom/bottom-sheet provider by mocking its surface to a
// plain View — that way the drawer's grid renders immediately under
// @testing-library/react-native without a host BottomSheetModalProvider.

import { act, fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';

jest.mock('@gorhom/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native') as typeof import('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  return {
    __esModule: true,
    BottomSheetModal: React.forwardRef(function MockModal(
      props: { children?: React.ReactNode },
      _ref: unknown,
    ) {
      return <RN.View>{props.children}</RN.View>;
    }),
    BottomSheetView: function MockView(props: { children?: React.ReactNode }) {
      return <RN.View>{props.children}</RN.View>;
    },
    BottomSheetTextInput: RN.TextInput,
    BottomSheetBackdrop: function MockBackdrop() {
      return null;
    },
  };
});

// eslint-disable-next-line import/first
import { CalendarDrawer } from '../../../src/ui/drawers/CalendarDrawer';
// eslint-disable-next-line import/first
import { useUiStore } from '../../../src/state/ui-store';
// eslint-disable-next-line import/first
import type { ISODate } from '../../../src/domain/types';

const ISO = (s: string): ISODate => s as unknown as ISODate;

// Pin today() so "today highlight" is deterministic. The drawer reads
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

describe('CalendarDrawer', () => {
  beforeAll(() => {
    // @ts-expect-error — override global Date for deterministic todayIso().
    global.Date = FakeDate;
  });

  afterAll(() => {
    global.Date = ORIGINAL_DATE;
  });

  beforeEach(() => {
    act(() => {
      useUiStore.setState({
        calendarDrawerOpen: true,
        currentDate: ISO('2026-05-05'),
      });
    });
  });

  afterEach(() => {
    act(() => {
      useUiStore.setState({ calendarDrawerOpen: false });
    });
  });

  test('renders the current month label + DOW header', () => {
    const { queryByText } = render(<CalendarDrawer />);
    expect(queryByText('2026년 5월')).not.toBeNull();
    for (const d of ['일', '월', '화', '수', '목', '금', '토']) {
      expect(queryByText(d)).not.toBeNull();
    }
  });

  test('next-month chevron advances the visible month', () => {
    const { queryByText, getByLabelText } = render(<CalendarDrawer />);
    expect(queryByText('2026년 5월')).not.toBeNull();
    fireEvent.press(getByLabelText('다음 달'));
    expect(queryByText('2026년 6월')).not.toBeNull();
    fireEvent.press(getByLabelText('이전 달'));
    fireEvent.press(getByLabelText('이전 달'));
    expect(queryByText('2026년 4월')).not.toBeNull();
  });

  test('tapping a date sets currentDate and closes the drawer', () => {
    const { getByLabelText } = render(<CalendarDrawer />);
    fireEvent.press(getByLabelText('2026년 5월 12일'));
    const next = useUiStore.getState();
    expect(next.currentDate as unknown as string).toBe('2026-05-12');
    expect(next.calendarDrawerOpen).toBe(false);
  });

  test('today (2026-05-05) is rendered with the primary highlight pill', () => {
    const { getByLabelText, UNSAFE_getAllByType } = render(<CalendarDrawer />);
    const todayBtn = getByLabelText('2026년 5월 5일');
    // The inner pill view sits inside the Pressable. Inspect its style
    // recursively via UNSAFE_getAllByType to confirm the primary background.
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
