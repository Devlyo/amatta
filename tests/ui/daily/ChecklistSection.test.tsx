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
import { useChecklistCompletionStore } from '../../../src/state/checklist-completion-store';
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
const TODAY_INT = 20260602; // yyyymmdd of TODAY

// Seed the per-occurrence completion store. Each entry is a (itemId, dateInt)
// key marked complete.
function seedCompletion(entries: [number, number][]): void {
  const map = new Map<string, number>();
  for (const [itemId, dateInt] of entries) map.set(`${itemId}|${dateInt}`, 1);
  useChecklistCompletionStore.setState({ completionMap: map, isLoaded: true });
}

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

// occurrenceDate: null = recurring (every date), set = day-specific.
function mkItem(
  id: number,
  scheduleId: number,
  label: string,
  occurrenceDate: number | null = null,
): ChecklistItem {
  return { id, scheduleId, label, sortOrder: id, isDone: false, doneAt: null, occurrenceDate };
}

function reset(): void {
  useChildrenStore.setState({ children: [], isLoaded: true });
  useSchedulesStore.setState({ schedules: [], exceptions: [], isLoaded: true });
  useChecklistStore.setState({ itemsByScheduleId: new Map(), isLoaded: true });
  useChecklistCompletionStore.setState({ completionMap: new Map(), isLoaded: true });
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
        [10, [mkItem(100, 10, '수영가방'), mkItem(101, 10, '수건')]],
        [11, [mkItem(200, 11, '미술도구')]],
      ]),
      isLoaded: true,
      toggleDone: toggleDoneMock,
    });
    // Completion is per-occurrence now (v6): mark item 101 done for TODAY.
    seedCompletion([[101, TODAY_INT]]);

    const { getByText, getByTestId } = render(<ChecklistSection />);

    // header: 1 done out of 3 total (only item 101 has a completion row for D)
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

  test('tap on item invokes toggleDone with the id AND viewed-date int', async () => {
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
    // Per-occurrence (v6): the displayed date int is passed so checking on D
    // never marks D+1.
    expect(toggleDoneMock).toHaveBeenCalledWith(
      expect.objectContaining({ __mock: true }),
      100,
      TODAY_INT,
    );
  });

  test('membership: day-specific item shows only on its date', () => {
    const minjun = mkChild(1, '민준', 0);
    const sched = mkSchedule(10, minjun.id);
    useChildrenStore.setState({ children: [minjun], isLoaded: true });
    useSchedulesStore.setState({ schedules: [sched], exceptions: [], isLoaded: true });
    // Recurring item (null) + a day-specific item bound to TODAY.
    useChecklistStore.setState({
      itemsByScheduleId: new Map([
        [10, [mkItem(100, 10, '매일준비물', null), mkItem(101, 10, '오늘만', TODAY_INT)]],
      ]),
      isLoaded: true,
      toggleDone: toggleDoneMock,
    });

    const onToday = render(<ChecklistSection />);
    expect(onToday.getByText('매일준비물')).toBeTruthy();
    expect(onToday.getByText('오늘만')).toBeTruthy();
    expect(onToday.getByText('0/2')).toBeTruthy();
    onToday.unmount();

    // View a different date the schedule still occurs (next Tuesday). The
    // recurring item stays; the day-specific item (bound to TODAY) drops.
    useUiStore.setState({ currentDate: iso('2026-06-09') });
    const onOther = render(<ChecklistSection />);
    expect(onOther.getByText('매일준비물')).toBeTruthy();
    expect(onOther.queryByText('오늘만')).toBeNull();
    expect(onOther.getByText('0/1')).toBeTruthy();
  });

  test('completion is per-occurrence: done on D, not done on D+1', () => {
    const minjun = mkChild(1, '민준', 0);
    // Schedule occurs every day so the same recurring item shows on both dates.
    const everyDay = 0b1111111;
    const sched = mkSchedule(10, minjun.id, everyDay);
    useChildrenStore.setState({ children: [minjun], isLoaded: true });
    useSchedulesStore.setState({ schedules: [sched], exceptions: [], isLoaded: true });
    useChecklistStore.setState({
      itemsByScheduleId: new Map([[10, [mkItem(100, 10, '수영가방', null)]]]),
      isLoaded: true,
      toggleDone: toggleDoneMock,
    });
    // Completed for TODAY only.
    seedCompletion([[100, TODAY_INT]]);

    const onD = render(<ChecklistSection />);
    expect(onD.getByText('1/1')).toBeTruthy();
    onD.unmount();

    useUiStore.setState({ currentDate: iso('2026-06-03') });
    const onD1 = render(<ChecklistSection />);
    // Same recurring item, next day → no completion row → unchecked.
    expect(onD1.getByText('0/1')).toBeTruthy();
  });
});
