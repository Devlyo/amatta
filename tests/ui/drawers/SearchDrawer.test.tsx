// Render-level tests for SearchDrawer.

import { act, fireEvent, render } from '@testing-library/react-native';

// Result-tap swaps to the event/detail route via replace (no onClose race).
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}));


// eslint-disable-next-line import/first
import { SearchContent } from '../../../src/ui/drawers/SearchDrawer';
// eslint-disable-next-line import/first
import { useChildrenStore } from '../../../src/state/children-store';
// eslint-disable-next-line import/first
import { useChecklistStore } from '../../../src/state/checklist-store';
// eslint-disable-next-line import/first
import { useSchedulesStore } from '../../../src/state/schedules-store';
// eslint-disable-next-line import/first
import { useTodosStore } from '../../../src/state/todos-store';
// eslint-disable-next-line import/first
import { useUiStore } from '../../../src/state/ui-store';
// eslint-disable-next-line import/first
import type {
  ChecklistItem,
  Child,
  ColorIndex,
  ISODate,
  Schedule,
  Todo,
} from '../../../src/domain/types';

const ISO = (s: string): ISODate => s as unknown as ISODate;

const KID: Child = {
  id: 1,
  name: '민준',
  colorIndex: 0 as ColorIndex,
  createdAt: ISO('2026-01-01'),
};

const SCHEDULE: Schedule = {
  id: 11,
  childId: 1,
  title: '영어학원',
  type: 'academy',
  location: '학원 1관',
  notes: null,
  daysOfWeek: 0b0101010,
  startMinutes: 16 * 60,
  endMinutes: 17 * 60,
  validFrom: ISO('2026-01-01'),
  validUntil: null,
  notifyMinutesBefore: 30,
  needsPickup: false,
};

const TODO: Todo = {
  id: 21,
  childId: 1,
  title: '준비물 챙기기',
  dueAt: Date.parse('2026-05-06T09:00:00Z'),
  notifyMinutesBefore: null,
  isDone: false,
  doneAt: null,
  createdAt: Date.parse('2026-05-01T00:00:00Z'),
};

const CHECKLIST_ITEM: ChecklistItem = {
  id: 31,
  scheduleId: 11,
  label: '수영복',
  sortOrder: 0,
  isDone: false,
  doneAt: null,
};

describe('SearchDrawer', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    act(() => {
      useChildrenStore.setState({ children: [KID], isLoaded: true });
      useSchedulesStore.setState({
        schedules: [SCHEDULE],
        exceptions: [],
        isLoaded: true,
      });
      useTodosStore.setState({ todos: [TODO], isLoaded: true });
      useChecklistStore.setState({
        itemsByScheduleId: new Map([[SCHEDULE.id, [CHECKLIST_ITEM]]]),
        isLoaded: true,
      });
      useUiStore.setState({
        searchDrawerOpen: true,
        currentDate: ISO('2026-05-05'),
        eventDetailState: { mode: 'closed' },
      });
    });
  });

  afterEach(() => {
    act(() => {
      useUiStore.setState({
        searchDrawerOpen: false,
        eventDetailState: { mode: 'closed' },
      });
    });
  });

  test('empty query shows the placeholder', () => {
    const { queryByText } = render(<SearchContent onClose={() => {}} />);
    expect(queryByText('검색어를 입력하세요')).not.toBeNull();
  });

  test('typing a schedule title filters and shows the matching result', () => {
    const { getByTestId, queryByText } = render(<SearchContent onClose={() => {}} />);
    fireEvent.changeText(getByTestId('search-drawer-input'), '영어');
    expect(queryByText('영어학원')).not.toBeNull();
    expect(queryByText(/결과 1건/)).not.toBeNull();
    // Todo + checklist shouldn't match "영어".
    expect(queryByText('준비물 챙기기')).toBeNull();
    expect(queryByText('수영복')).toBeNull();
  });

  test('tapping a schedule result replaces with the event detail route', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<SearchContent onClose={onClose} />);
    fireEvent.changeText(getByTestId('search-drawer-input'), '영어');
    fireEvent.press(getByTestId(`search-result-schedule-${SCHEDULE.id}`));
    expect(onClose).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/event/detail',
        params: expect.objectContaining({ scheduleId: String(SCHEDULE.id) }),
      }),
    );
  });
});
