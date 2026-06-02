// UI tests for ChecklistSection. Stores are seeded directly via setState;
// getDb is mocked so toggleDone exercises the store path without real SQLite.

import { fireEvent, render } from '@testing-library/react-native';

import type {
  Child,
  ChecklistItem,
  ISODate,
  Schedule,
} from '../../../src/domain/types';
import {
  useChecklistStore,
} from '../../../src/state/checklist-store';
import { useChildrenStore } from '../../../src/state/children-store';
import { useSchedulesStore } from '../../../src/state/schedules-store';
import { useUiStore } from '../../../src/state/ui-store';

// ---- Mocks ----------------------------------------------------------------
const toggleDoneMock = jest.fn();

jest.mock('../../../src/db/client', () => ({
  getDb: jest.fn().mockResolvedValue({ __mock: true }),
}));

// eslint-disable-next-line import/first
import { ChecklistSection } from '../../../src/ui/daily/ChecklistSection';

// ---- Helpers --------------------------------------------------------------
const iso = (s: string): ISODate => s as unknown as ISODate;
const TODAY = iso('2026-06-02');

function mkChild(id: number, name: string, colorIndex: 0 | 1 | 2 | 3 | 4 | 5): Child {
  return { id, name, colorIndex, createdAt: iso('2026-05-01') };
}

// Mon=0..Sun=6 per `domain/days-of-week.ts:dayOfWeekIndex`. TODAY is a Tuesday.
const TUE_BIT = 1 << 1;

function mkSchedule(id: number, childId: number, daysOfWeek: number = TUE_BIT): Schedule {
  return {
    id,
    childId,
    title: '학원',
    type: 'academy',
    location: null,
    notes: null,
    daysOfWeek,
    startMinutes: 9 * 60,
    endMinutes: 10 * 60,
    validFrom: iso('2026-01-01'),
    validUntil: null,
    notifyMinutesBefore: null,
    needsPickup: false,
  };
}

function mkItem(id: number, scheduleId: number, label: string, isDone = false): ChecklistItem {
  return { id, scheduleId, label, sortOrder: id, isDone, doneAt: null };
}

function reset(): void {
  useChildrenStore.setState({ children: [], isLoaded: true });
  useSchedulesStore.setState({ schedules: [], exceptions: [], isLoaded: true });
  useChecklistStore.setState({ itemsByScheduleId: new Map(), isLoaded: true });
  useUiStore.setState({ currentDate: TODAY });
}

// Override toggleDone on the store so tap exercises an observable call without
// running the real repo path.
beforeEach(() => {
  reset();
  toggleDoneMock.mockReset();
  useChecklistStore.setState({ toggleDone: toggleDoneMock });
});

describe('ChecklistSection', () => {
  test('empty state shows 0/0 in section header', () => {
    const { getByText, queryByTestId } = render(<ChecklistSection />);
    expect(getByText('준비물')).toBeTruthy();
    expect(getByText('0/0')).toBeTruthy();
    expect(queryByTestId(/checklist-item-/)).toBeNull();
  });

  test('populated: groups by kid and renders one row per item', () => {
    // 2026-06-02 is a Tuesday → dow=2 in JS (Tue index from sun=0).
    const minjun = mkChild(1, '민준', 0);
    const seoyeon = mkChild(2, '서연', 5);
    const schedMin = mkSchedule(10, minjun.id);
    const schedSeo = mkSchedule(11, seoyeon.id);

    useChildrenStore.setState({ children: [minjun, seoyeon], isLoaded: true });
    useSchedulesStore.setState({
      schedules: [schedMin, schedSeo],
      exceptions: [],
      isLoaded: true,
    });
    useChecklistStore.setState({
      itemsByScheduleId: new Map([
        [10, [mkItem(100, 10, '수영가방'), mkItem(101, 10, '수건', true)]],
        [11, [mkItem(200, 11, '미술도구')]],
      ]),
      isLoaded: true,
      toggleDone: toggleDoneMock,
    });

    const { getByText, getByTestId } = render(<ChecklistSection />);

    // header: 1 done out of 3 total
    expect(getByText('1/3')).toBeTruthy();
    expect(getByText('민준')).toBeTruthy();
    expect(getByText('서연')).toBeTruthy();
    expect(getByText('수영가방')).toBeTruthy();
    expect(getByText('수건')).toBeTruthy();
    expect(getByText('미술도구')).toBeTruthy();
    expect(getByTestId('checklist-item-100')).toBeTruthy();
    expect(getByTestId('checklist-item-101')).toBeTruthy();
    expect(getByTestId('checklist-item-200')).toBeTruthy();
  });

  test('tap on item invokes toggleDone with the correct id', async () => {
    const minjun = mkChild(1, '민준', 0);
    const sched = mkSchedule(10, minjun.id);
    useChildrenStore.setState({ children: [minjun], isLoaded: true });
    useSchedulesStore.setState({ schedules: [sched], exceptions: [], isLoaded: true });
    useChecklistStore.setState({
      itemsByScheduleId: new Map([[10, [mkItem(100, 10, '수영가방')]]]),
      isLoaded: true,
      toggleDone: toggleDoneMock,
    });

    const { getByTestId } = render(<ChecklistSection />);
    fireEvent.press(getByTestId('checklist-item-100'));

    // toggleDone is invoked async via getDb() — yield to the microtask queue.
    await Promise.resolve();
    await Promise.resolve();

    expect(toggleDoneMock).toHaveBeenCalledTimes(1);
    expect(toggleDoneMock).toHaveBeenCalledWith(expect.objectContaining({ __mock: true }), 100);
  });
});
