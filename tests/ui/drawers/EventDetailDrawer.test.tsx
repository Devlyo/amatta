// Render-level tests for EventDetailContent (the de-chromed body rendered by
// the app/event/detail.tsx native formSheet route). Plain RN now — no gorhom.
// Dismissal is delegated via the onClose prop.

import { act, fireEvent, render } from '@testing-library/react-native';

// Stub the DB client so the drawer's destructive actions don't try to open
// a real expo-sqlite DB during tests.
jest.mock('../../../src/db/client', () => ({
  getDb: jest.fn().mockResolvedValue({}),
}));

// "수정" now navigates to the edit route (via replace) instead of setting the store.
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}));

// eslint-disable-next-line import/first
import { EventDetailContent } from '../../../src/ui/drawers/EventDetailDrawer';
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
    occurrenceDate: null,
  },
  {
    id: 2,
    scheduleId: 7,
    label: '필통',
    sortOrder: 1,
    isDone: true,
    doneAt: 1717000000000,
    occurrenceDate: null,
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

describe('EventDetailContent', () => {
  beforeEach(() => {
    mockReplace.mockClear();
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
    const { queryByText } = render(<EventDetailContent onClose={() => {}} />);
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
    const { queryByText } = render(<EventDetailContent onClose={() => {}} />);
    expect(queryByText('교재')).not.toBeNull();
    expect(queryByText('필통')).not.toBeNull();
  });

  test('header "수정" replaces this route with the edit route in editAll mode', () => {
    // The per-occurrence vs schedule-wide split lives inside the edit sheet.
    // "수정" atomically swaps detail → edit via router.replace (no onClose race).
    const onClose = jest.fn();
    const { getByLabelText } = render(<EventDetailContent onClose={onClose} />);
    fireEvent.press(getByLabelText('수정'));
    expect(onClose).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/schedule/edit',
        params: expect.objectContaining({
          mode: 'editAll',
          scheduleId: String(sampleSchedule.id),
        }),
      }),
    );
  });
});
