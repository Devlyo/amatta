// Render-level tests for EventDetailDrawer. We mock @gorhom/bottom-sheet to
// plain Views so the drawer's body renders synchronously, matching the
// CalendarDrawer test harness.

import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@gorhom/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Mock = require('react-native') as typeof import('react-native');
  const ViewMock = Mock.View;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { forwardRef } = require('react') as typeof import('react');
  return {
    __esModule: true,
    BottomSheetModal: forwardRef(function MockModal(
      props: { children?: React.ReactNode },
      _ref: unknown,
    ) {
      return <ViewMock>{props.children}</ViewMock>;
    }),
    BottomSheetView: function MockView(props: { children?: React.ReactNode }) {
      return <ViewMock>{props.children}</ViewMock>;
    },
    BottomSheetTextInput: Mock.TextInput,
    BottomSheetBackdrop: function MockBackdrop() {
      return null;
    },
  };
});

// Stub the DB client so the drawer's destructive actions don't try to open
// a real expo-sqlite DB during tests.
jest.mock('../../../src/db/client', () => ({
  getDb: jest.fn().mockResolvedValue({}),
}));

// eslint-disable-next-line import/first
import { EventDetailDrawer } from '../../../src/ui/drawers/EventDetailDrawer';
// eslint-disable-next-line import/first
import { useChecklistStore } from '../../../src/state/checklist-store';
// eslint-disable-next-line import/first
import { useChildrenStore } from '../../../src/state/children-store';
// eslint-disable-next-line import/first
import { useSchedulesStore } from '../../../src/state/schedules-store';
// eslint-disable-next-line import/first
import { useUiStore } from '../../../src/state/ui-store';
// eslint-disable-next-line import/first
import type {
  ChecklistItem,
  Child,
  ISODate,
  Schedule,
} from '../../../src/domain/types';

const ISO = (s: string): ISODate => s as unknown as ISODate;

const sampleChild: Child = {
  id: 1,
  name: '민준',
  colorIndex: 0,
  createdAt: ISO('2026-05-01'),
};

const sampleSchedule: Schedule = {
  id: 7,
  childId: 1,
  title: '영어학원',
  type: 'academy',
  location: 'JLS어학원',
  notes: '책 가져갈 것',
  daysOfWeek: 0b0010101, // Mon, Wed, Fri (bit 0=Mon)
  startMinutes: 16 * 60,
  endMinutes: 17 * 60 + 30,
  validFrom: ISO('2026-05-01'),
  validUntil: null,
  notifyMinutesBefore: 30,
  needsPickup: true,
};

const sampleChecklist: ChecklistItem[] = [
  {
    id: 1,
    scheduleId: 7,
    label: '교재',
    sortOrder: 0,
    isDone: false,
    doneAt: null,
  },
  {
    id: 2,
    scheduleId: 7,
    label: '필통',
    sortOrder: 1,
    isDone: true,
    doneAt: 1717000000000,
  },
];

function primeStores(): void {
  useChildrenStore.setState({ children: [sampleChild], isLoaded: true });
  useSchedulesStore.setState({
    schedules: [sampleSchedule],
    exceptions: [],
    isLoaded: true,
  });
  useChecklistStore.setState({
    itemsByScheduleId: new Map([[sampleSchedule.id, sampleChecklist]]),
    isLoaded: true,
  });
  useUiStore.setState({
    eventDetailState: {
      mode: 'open',
      scheduleId: sampleSchedule.id,
      occurrenceDate: ISO('2026-05-04'),
    },
  });
}

describe('EventDetailDrawer', () => {
  beforeEach(() => {
    primeStores();
  });

  afterEach(() => {
    act(() => {
      useUiStore.setState({
        eventDetailState: { mode: 'closed' },
        editSheetState: { mode: 'closed' },
      });
    });
  });

  test('renders title, kid name, type label, and pickup row when state is open', () => {
    const { queryByText } = render(<EventDetailDrawer />);
    // Kid chip
    expect(queryByText('민준')).not.toBeNull();
    // Type label (academy → 학원)
    expect(queryByText('학원')).not.toBeNull();
    // Schedule title
    expect(queryByText('영어학원')).not.toBeNull();
    // Location
    expect(queryByText('JLS어학원')).not.toBeNull();
    // Notify label
    expect(queryByText('30분 전')).not.toBeNull();
    // Pickup badge (uses fmtKoTime on end minutes)
    expect(queryByText('오후 5:30 픽업')).not.toBeNull();
  });

  test('renders the checklist items pulled from the checklist store', () => {
    const { queryByText } = render(<EventDetailDrawer />);
    expect(queryByText('교재')).not.toBeNull();
    expect(queryByText('필통')).not.toBeNull();
  });

  test('header "수정" closes the drawer and opens the edit sheet in editAll mode', () => {
    // Spec: the per-occurrence vs schedule-wide split now lives inside
    // ScheduleEditSheet. The drawer surfaces a single "수정" entry in the
    // top-right that opens the sheet in editAll mode.
    const { getByLabelText } = render(<EventDetailDrawer />);
    fireEvent.press(getByLabelText('수정'));
    const ui = useUiStore.getState();
    expect(ui.eventDetailState.mode).toBe('closed');
    expect(ui.editSheetState.mode).toBe('editAll');
    expect(ui.editSheetState.scheduleId).toBe(sampleSchedule.id);
  });
});
