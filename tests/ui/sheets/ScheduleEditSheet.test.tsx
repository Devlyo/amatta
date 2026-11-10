// Component tests for the EditSheet 준비물 (supplies) checklist UI rework
// (A안 / ADR-006a + v7 PREP-RECUR / ADR-006b). Covers:
//   - ↻ pill conditional render (absent one-time, present recurring)
//   - ON/OFF state driven by `item.recurring` (NOT occurrence_date): ON shows
//     "매번" + icon, OFF icon-only; toggling flips `recurring`
//   - founder navigate-to-date binding: a new item / a recurring→이번만 toggle
//     anchors occurrenceDate to boundDateInt (the viewed date)
//   - fix-1 bind target (editAll opened for date X binds to X, not currentDate)
//   - new item persists { occurrenceDate: <anchor>, recurring: true }
//   - Decision C save normalization across create + UPDATE persist sites
//     (one-time schedule → { occurrenceDate: null, recurring: true })
//
// Stores are seeded directly; getDb + the mutating store methods are replaced
// with jest mocks so save payloads are observable without real SQLite.

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type {
  ChecklistItem,
  Child,
  ISODate,
  Schedule,
} from '../../../src/domain/types';
import { useChecklistStore } from '../../../src/state/checklist-store';
import { useChildrenStore } from '../../../src/state/children-store';
import { useSchedulesStore } from '../../../src/state/schedules-store';
import { useUiStore } from '../../../src/state/ui-store';

jest.mock('../../../src/db/client', () => ({
  // runAsync / getFirstAsync: app_settings writes from the guardian path.
  getDb: jest.fn().mockResolvedValue({
    __mock: true,
    runAsync: async () => undefined,
    getFirstAsync: async () => null,
  }),
}));

// eslint-disable-next-line import/first
import { ScheduleEditContent } from '../../../src/ui/sheets/ScheduleEditSheet';

const iso = (s: string): ISODate => s as unknown as ISODate;

// Mon=bit0 … Sun=bit6. 2026-06-02 is a Tuesday.
const TUE_BIT = 1 << 1;

function mkChild(id: number): Child {
  return {
    id,
    name: '민준',
    colorIndex: 0,
    avatar: 'face-wink',
    createdAt: iso('2026-05-01'),
  };
}

function mkSchedule(over: Partial<Schedule> = {}): Schedule {
  return {
    id: 7,
    childId: 1,
    title: '영어학원',
    type: 'academy',
    location: null,
    notes: null,
    daysOfWeek: TUE_BIT,
    startMinutes: 9 * 60,
    endMinutes: 10 * 60,
    validFrom: iso('2026-01-01'),
    validUntil: null,
    notifyMinutesBefore: 30,
    needsPickup: false,
    ...over,
  };
}

// v7 / ADR-006b: a checklist item now carries BOTH the `occurrenceDate` anchor
// AND a `recurring` flag. The ↻ pill ON state reflects `recurring` (매번), not
// the anchor. Default fixture = recurring with a NULL anchor (legacy/unbounded).
function mkItem(over: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: 100,
    scheduleId: 7,
    label: '교재',
    sortOrder: 0,
    occurrenceDate: null,
    recurring: true,
    isDone: false,
    doneAt: null,
    ...over,
  } as ChecklistItem;
}

interface Mocks {
  add: jest.Mock;
  update: jest.Mock;
  remove: jest.Mock;
  addSchedule: jest.Mock;
  updateSchedule: jest.Mock;
}

function seedStores(opts: {
  schedule: Schedule;
  items?: ChecklistItem[];
  mode: 'create' | 'editAll';
  occurrenceDate?: ISODate;
  currentDate?: ISODate;
}): Mocks {
  const add = jest.fn().mockResolvedValue(mkItem());
  const update = jest.fn().mockResolvedValue(undefined);
  const remove = jest.fn().mockResolvedValue(undefined);
  const addSchedule = jest.fn().mockResolvedValue(opts.schedule);
  const updateSchedule = jest.fn().mockResolvedValue(undefined);

  useChildrenStore.setState({ children: [mkChild(1)] });
  useSchedulesStore.setState({
    schedules: [opts.schedule],
    exceptions: [],
    addSchedule,
    updateSchedule,
  } as never);
  useChecklistStore.setState({
    itemsByScheduleId: new Map([[opts.schedule.id, opts.items ?? []]]),
    add,
    updateOne: update,
    removeOne: remove,
  } as never);
  useUiStore.setState({
    currentDate: opts.currentDate ?? iso('2026-06-15'),
    editSheetState: {
      mode: opts.mode,
      scheduleId: opts.schedule.id,
      occurrenceDate: opts.occurrenceDate,
    },
  });

  return { add, update, remove, addSchedule, updateSchedule };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('EditSheet 준비물 ↻ pill — conditional render', () => {
  test('recurring schedule + recurring item renders the ↻ pill ON (매번)', () => {
    seedStores({
      schedule: mkSchedule({ daysOfWeek: TUE_BIT }),
      // v7: ON state is driven by `recurring`, not the anchor.
      items: [mkItem({ recurring: true, occurrenceDate: 20260602 })],
      mode: 'editAll',
    });
    const { queryByLabelText, queryByText } = render(
      <ScheduleEditContent onClose={() => {}} />,
    );
    // ON pill present, with the "매번" label.
    expect(queryByLabelText('매번 챙김 (탭하면 이번만)')).toBeTruthy();
    expect(queryByText('매번')).toBeTruthy();
  });

  test('OFF state (recurring=false) is icon-only (no 매번 label)', () => {
    seedStores({
      schedule: mkSchedule({ daysOfWeek: TUE_BIT }),
      // v7: a 이번만 item — recurring=false with the anchor as its bind date.
      items: [mkItem({ recurring: false, occurrenceDate: 20260602 })],
      mode: 'editAll',
    });
    const { queryByLabelText, queryByText } = render(
      <ScheduleEditContent onClose={() => {}} />,
    );
    expect(queryByLabelText('이번만 (탭하면 매번)')).toBeTruthy();
    expect(queryByText('매번')).toBeNull();
  });

  test('one-time (all weekdays off) hides the pill entirely', () => {
    seedStores({
      schedule: mkSchedule({ daysOfWeek: TUE_BIT }),
      items: [mkItem({ recurring: true, occurrenceDate: null })],
      mode: 'editAll',
    });
    const { queryByLabelText, getByLabelText, getByTestId } = render(
      <ScheduleEditContent onClose={() => {}} />,
    );
    expect(queryByLabelText('매번 챙김 (탭하면 이번만)')).toBeTruthy();
    // Open the 반복 row, toggle the one selected weekday (화/Tue) OFF → daysOfWeek === 0.
    fireEvent.press(getByTestId('row-repeat'));
    fireEvent.press(getByLabelText('요일 화'));
    expect(queryByLabelText('매번 챙김 (탭하면 이번만)')).toBeNull();
    expect(queryByLabelText('이번만 (탭하면 매번)')).toBeNull();
  });
});

describe('EditSheet 준비물 — recurring toggle (↻ pill flips `recurring`)', () => {
  test('toggle OFF on a day-specific row flips recurring true→false, keeps the anchor', async () => {
    // v7: the ↻ pill flips ONLY `recurring`; the occurrenceDate anchor is kept.
    // Seed a row already anchored to the viewed date so the resulting 이번만 row
    // is well-formed { occurrenceDate: anchor, recurring: false }.
    const mocks = seedStores({
      schedule: mkSchedule({ daysOfWeek: TUE_BIT }),
      items: [mkItem({ id: 100, occurrenceDate: 20260620, recurring: true })],
      mode: 'editAll',
      occurrenceDate: iso('2026-06-20'),
      currentDate: iso('2026-06-15'),
    });
    const { getByLabelText } = render(<ScheduleEditContent onClose={() => {}} />);
    // Flip the row OFF (매번 → 이번만).
    fireEvent.press(getByLabelText('매번 챙김 (탭하면 이번만)'));
    fireEvent.press(getByLabelText('저장'));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    // recurring flipped to false; the anchor is preserved (not re-written).
    expect(mocks.update).toHaveBeenCalledWith(
      expect.anything(),
      100,
      expect.objectContaining({ occurrenceDate: 20260620, recurring: false }),
    );
  });

  test('toggle ON on a day-specific row flips recurring false→true, keeps the anchor', async () => {
    const mocks = seedStores({
      schedule: mkSchedule({ daysOfWeek: TUE_BIT }),
      items: [mkItem({ id: 100, occurrenceDate: 20260620, recurring: false })],
      mode: 'editAll',
    });
    const { getByLabelText } = render(<ScheduleEditContent onClose={() => {}} />);
    // Flip the row ON (이번만 → 매번).
    fireEvent.press(getByLabelText('이번만 (탭하면 매번)'));
    fireEvent.press(getByLabelText('저장'));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(
      expect.anything(),
      100,
      expect.objectContaining({ occurrenceDate: 20260620, recurring: true }),
    );
  });

  test('toggle OFF on a legacy NULL-anchor row re-anchors to the viewed date (else 이번만 is a no-op)', async () => {
    // A legacy/unbounded recurring row (occurrenceDate NULL — e.g. a v6-era 매번
    // item kept unbounded by v7) toggled to 이번만 MUST gain an anchor, or the
    // membership NULL short-circuit (always-visible) would silently ignore
    // recurring=false and the item would still show on every occurrence.
    const mocks = seedStores({
      schedule: mkSchedule({ daysOfWeek: TUE_BIT }),
      items: [mkItem({ id: 100, occurrenceDate: null, recurring: true })],
      mode: 'editAll',
      occurrenceDate: iso('2026-06-20'),
      currentDate: iso('2026-06-15'),
    });
    const { getByLabelText } = render(<ScheduleEditContent onClose={() => {}} />);
    fireEvent.press(getByLabelText('매번 챙김 (탭하면 이번만)'));
    fireEvent.press(getByLabelText('저장'));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    // recurring=false AND re-anchored to the viewed date (20260620) so 이번만
    // membership (O === anchor) actually takes effect.
    expect(mocks.update).toHaveBeenCalledWith(
      expect.anything(),
      100,
      expect.objectContaining({ occurrenceDate: 20260620, recurring: false }),
    );
  });
});

describe('EditSheet 준비물 — fix-1 new-item anchor binding (boundDateInt)', () => {
  test('new item on a recurring schedule persists { occurrenceDate: <viewed>, recurring: true }', async () => {
    // A fresh row anchors occurrenceDate to boundDateInt (= the viewed date) and
    // defaults recurring=true. editAll viewed-date 2026-06-20 ≠ currentDate.
    const mocks = seedStores({
      schedule: mkSchedule({ daysOfWeek: TUE_BIT }),
      items: [],
      mode: 'editAll',
      occurrenceDate: iso('2026-06-20'),
      currentDate: iso('2026-06-15'),
    });
    const { getByLabelText } = render(<ScheduleEditContent onClose={() => {}} />);
    fireEvent.press(getByLabelText('준비물 추가'));
    fireEvent.changeText(getByLabelText('준비물 1'), '교재');
    fireEvent.press(getByLabelText('저장'));
    await waitFor(() => expect(mocks.add).toHaveBeenCalled());
    expect(mocks.add).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        label: '교재',
        occurrenceDate: 20260620,
        recurring: true,
      }),
    );
  });

  test('fix-1: editAll opened for date X (≠ currentDate) anchors a new item to X', async () => {
    const mocks = seedStores({
      schedule: mkSchedule({ daysOfWeek: TUE_BIT }),
      items: [],
      mode: 'editAll',
      occurrenceDate: iso('2026-07-09'), // X
      currentDate: iso('2026-06-15'), // different week anchor
    });
    const { getByLabelText } = render(<ScheduleEditContent onClose={() => {}} />);
    fireEvent.press(getByLabelText('준비물 추가'));
    fireEvent.changeText(getByLabelText('준비물 1'), '도시락');
    // Flip it 이번만 so the anchor is the membership-bearing field.
    fireEvent.press(getByLabelText('매번 챙김 (탭하면 이번만)'));
    fireEvent.press(getByLabelText('저장'));
    await waitFor(() => expect(mocks.add).toHaveBeenCalled());
    expect(mocks.add).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        label: '도시락',
        occurrenceDate: 20260709,
        recurring: false,
      }),
    );
  });
});

describe('EditSheet 준비물 — Decision C save normalization', () => {
  test('UPDATE-path regression: existing day-specific row + all weekdays OFF → UPDATE writes { null, recurring:true }', async () => {
    const mocks = seedStores({
      schedule: mkSchedule({ daysOfWeek: TUE_BIT }),
      // Existing row already day-specific (이번만): stale anchor + recurring=false.
      items: [mkItem({ id: 100, occurrenceDate: 20260602, recurring: false })],
      mode: 'editAll',
    });
    const { getByLabelText, getByTestId } = render(<ScheduleEditContent onClose={() => {}} />);
    // All weekdays off → one-time schedule → Decision C normalizes every row.
    fireEvent.press(getByTestId('row-repeat'));
    fireEvent.press(getByLabelText('요일 화'));
    fireEvent.press(getByLabelText('저장'));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    // The stale day-specific row must be re-written to the unbounded form
    // { occurrenceDate: null, recurring: true } (no orphaned 이번만 row).
    expect(mocks.update).toHaveBeenCalledWith(
      expect.anything(),
      100,
      expect.objectContaining({ occurrenceDate: null, recurring: true }),
    );
  });

  test('create-path: one-time create (no weekdays) persists rows as { null, recurring:true }', async () => {
    const add = jest.fn().mockResolvedValue(mkItem());
    const addSchedule = jest.fn().mockResolvedValue(mkSchedule());
    useChildrenStore.setState({ children: [mkChild(1)] });
    useSchedulesStore.setState({
      schedules: [],
      exceptions: [],
      addSchedule,
    } as never);
    useChecklistStore.setState({
      itemsByScheduleId: new Map(),
      add,
    } as never);
    // preFill.date seeds a valid validFrom so create validation passes with
    // no weekdays selected (one-time).
    useUiStore.setState({
      currentDate: iso('2026-06-15'),
      editSheetState: {
        mode: 'create',
        preFill: { date: iso('2026-06-15') },
      },
    });
    const mocks = { add, addSchedule };
    const { getByLabelText, getByTestId } = render(
      <ScheduleEditContent onClose={() => {}} />,
    );
    // Create requires childId + type + title; date comes from preFill.
    fireEvent.press(getByTestId('row-kid'));
    fireEvent.press(getByLabelText('자녀: 민준'));
    fireEvent.press(getByTestId('row-type'));
    fireEvent.press(getByLabelText('학원'));
    fireEvent.changeText(getByTestId('sheet-title-input'), '체험학습');
    // Add a 준비물 row (anchors to boundDateInt; pill hidden while one-time).
    fireEvent.press(getByLabelText('준비물 추가'));
    fireEvent.changeText(getByLabelText('준비물 1'), '도시락');
    // daysOfWeek === 0 (one-time) → normalization nulls the anchor + recurring=true.
    fireEvent.press(getByLabelText('추가'));
    await waitFor(() => expect(mocks.addSchedule).toHaveBeenCalled());
    await waitFor(() => expect(mocks.add).toHaveBeenCalled());
    expect(mocks.add).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        label: '도시락',
        occurrenceDate: null,
        recurring: true,
      }),
    );
  });

  test('inverse: recurring save preserves a day-specific row’s anchor + recurring flag', async () => {
    const mocks = seedStores({
      schedule: mkSchedule({ daysOfWeek: TUE_BIT }),
      items: [mkItem({ id: 100, occurrenceDate: 20260602, recurring: false })],
      mode: 'editAll',
    });
    const { getByLabelText } = render(<ScheduleEditContent onClose={() => {}} />);
    // Save with the schedule still recurring → the row passes through unchanged,
    // so no normalizing UPDATE to { null, recurring:true } occurs.
    fireEvent.press(getByLabelText('저장'));
    await waitFor(() => expect(mocks.updateSchedule).toHaveBeenCalled());
    const normalizedCall = mocks.update.mock.calls.find(
      (c) => c[2]?.occurrenceDate === null,
    );
    expect(normalizedCall).toBeUndefined();
  });
});

describe('EditSheet — iPhone-style form (ADR-007 §7–8)', () => {
  test('rows summarise their values; time chips use "3:00 PM"', () => {
    seedStores({ schedule: mkSchedule({ startMinutes: 15 * 60, endMinutes: 16 * 60 }), mode: 'editAll' });
    const { getByLabelText } = render(<ScheduleEditContent onClose={() => {}} />);
    expect(getByLabelText('반복: 매주 화')).toBeTruthy();
    expect(getByLabelText('시작 전 알림: 30분 전')).toBeTruthy();
    expect(getByLabelText('종료 전 알림: 없음')).toBeTruthy();
    expect(getByLabelText('시작 시간')).toBeTruthy();
    expect(getByLabelText('끝 시간')).toBeTruthy();
  });

  test('하루 종일 hides times, end alert and pickup; saves allDay without pickup', async () => {
    const mocks = seedStores({ schedule: mkSchedule({ needsPickup: true }), mode: 'editAll' });
    const { getByLabelText, queryByLabelText } = render(<ScheduleEditContent onClose={() => {}} />);
    fireEvent(getByLabelText('하루 종일'), 'valueChange', true);
    expect(queryByLabelText('시작 시간')).toBeNull();
    expect(queryByLabelText('끝 시간')).toBeNull();
    expect(queryByLabelText(/종료 전 알림/)).toBeNull();
    expect(queryByLabelText('픽업 필요')).toBeNull();
    fireEvent.press(getByLabelText('저장'));
    await waitFor(() => expect(mocks.updateSchedule).toHaveBeenCalled());
    expect(mocks.updateSchedule).toHaveBeenCalledWith(
      expect.anything(),
      7,
      expect.objectContaining({ allDay: true, needsPickup: false, notifyEndMinutesBefore: null }),
    );
  });

  test('종료 전 알림 choice is saved', async () => {
    const mocks = seedStores({ schedule: mkSchedule(), mode: 'editAll' });
    const { getByLabelText, getByTestId } = render(<ScheduleEditContent onClose={() => {}} />);
    fireEvent.press(getByTestId('row-alert-end'));
    fireEvent.press(getByLabelText('10분 전'));
    expect(getByLabelText('종료 전 알림: 10분 전')).toBeTruthy();
    fireEvent.press(getByLabelText('저장'));
    await waitFor(() => expect(mocks.updateSchedule).toHaveBeenCalled());
    expect(mocks.updateSchedule).toHaveBeenCalledWith(
      expect.anything(),
      7,
      expect.objectContaining({ allDay: false, notifyEndMinutesBefore: 10 }),
    );
  });

  test('only one inline panel is open at a time', () => {
    seedStores({ schedule: mkSchedule(), mode: 'editAll' });
    const { getByTestId, queryByLabelText } = render(<ScheduleEditContent onClose={() => {}} />);
    fireEvent.press(getByTestId('row-repeat'));
    expect(queryByLabelText('요일 화')).toBeTruthy();
    fireEvent.press(getByTestId('row-type'));
    expect(queryByLabelText('요일 화')).toBeNull();
    expect(queryByLabelText('학원')).toBeTruthy();
  });
});

describe('EditSheet — 보호자 (device calendar, ADR-008)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Calendar = require('expo-calendar') as jest.Mocked<typeof import('expo-calendar')>;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useGuardianStore } = require('../../../src/state/guardian-store') as typeof import('../../../src/state/guardian-store');

  beforeEach(() => {
    useGuardianStore.getState().resetToDefaults();
  });

  function openCreate(guardian: boolean) {
    const mocks = seedStores({ schedule: mkSchedule(), mode: 'create' });
    useUiStore.setState({
      editSheetState: { mode: 'create', preFill: { date: iso('2026-11-10'), startMinutes: 15 * 60, guardian } },
    });
    return mocks;
  }

  test('보호자 hides kid-only rows and writes to the device calendar, not SQLite', async () => {
    const mocks = openCreate(false);
    Calendar.getCalendarPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    Calendar.getCalendarsAsync.mockResolvedValue([
      { id: 'home', title: '집', color: 'red', source: { name: 'iCloud' }, allowsModifications: true },
    ] as never);
    const onClose = jest.fn();
    const { getByTestId, getByLabelText, queryByTestId, queryByLabelText, getByText } = render(
      <ScheduleEditContent onClose={onClose} />,
    );
    fireEvent.press(getByTestId('row-kid'));
    fireEvent.press(getByLabelText('자녀: 보호자'));
    expect(getByLabelText('자녀: 보호자')).toBeTruthy(); // row value
    expect(queryByTestId('row-type')).toBeNull();
    expect(queryByTestId('row-repeat')).toBeNull();
    expect(queryByTestId('row-alert-end')).toBeNull();
    expect(queryByLabelText('픽업 필요')).toBeNull();
    expect(getByText('보호자 일정은 아이폰 캘린더에 저장돼요.')).toBeTruthy();

    fireEvent.changeText(getByLabelText('제목 입력'), '회의');
    fireEvent.press(getByLabelText('추가'));
    await waitFor(() => expect(Calendar.createEventAsync).toHaveBeenCalled());
    const [calendarId, event] = Calendar.createEventAsync.mock.calls[0] ?? [];
    expect(calendarId).toBe('default'); // nothing chosen → the device default calendar
    expect(event).toMatchObject({ title: '회의', allDay: false, alarms: [{ relativeOffset: -30 }] });
    expect((event?.startDate as Date).getHours()).toBe(15);
    expect(mocks.addSchedule).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test('guardian column long press pre-selects 보호자; refused permission → nothing saved', async () => {
    openCreate(true);
    Calendar.getCalendarPermissionsAsync.mockResolvedValue({ status: 'undetermined' } as never);
    Calendar.requestCalendarPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
    const onClose = jest.fn();
    const { getByLabelText } = render(<ScheduleEditContent onClose={onClose} />);
    expect(getByLabelText('자녀: 보호자')).toBeTruthy();
    fireEvent.changeText(getByLabelText('제목 입력'), '회의');
    fireEvent.press(getByLabelText('추가'));
    await waitFor(() => expect(Calendar.requestCalendarPermissionsAsync).toHaveBeenCalled());
    expect(Calendar.createEventAsync).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('EditSheet — 이 회차만 수정 keeps the detail\u2019s rows', () => {
  test('fixed rows are read-only; 매번 supplies shown, this day\u2019s 이번만 editable; new one saved as 이번만', async () => {
    const day = iso('2026-06-02'); // a Tuesday
    const mocks = seedStores({
      schedule: mkSchedule({ location: 'JLS', notes: '현관 앞' }),
      mode: 'editOccurrence',
      occurrenceDate: day,
      items: [
        mkItem({ id: 1, label: '교재', occurrenceDate: null, recurring: true }),
        mkItem({ id: 2, label: '실내화', occurrenceDate: 20260602, recurring: false }),
        mkItem({ id: 3, label: '다른날', occurrenceDate: 20260609, recurring: false }),
      ],
    });
    const applyException = jest.fn().mockResolvedValue(undefined);
    useSchedulesStore.setState({ applyException } as never);
    const { getByText, queryByText, getByLabelText, queryByLabelText, getByTestId } = render(
      <ScheduleEditContent onClose={() => {}} />,
    );
    // Same rows as the detail, but fixed ones have no picker.
    expect(getByText('JLS')).toBeTruthy();
    expect(getByText('현관 앞')).toBeTruthy();
    expect(getByLabelText('반복: 매주 화')).toBeTruthy();
    fireEvent.press(getByTestId('row-repeat'));
    expect(queryByLabelText('요일 화')).toBeNull(); // no repeat panel
    // Supplies: 매번 one read-only, this day's 이번만 editable, other day's hidden.
    expect(getByText('교재')).toBeTruthy();
    expect(getByLabelText('준비물 1').props.value).toBe('실내화');
    expect(queryByText('다른날')).toBeNull();
    fireEvent.press(getByLabelText('준비물 추가'));
    fireEvent.changeText(getByLabelText('준비물 2'), '물통');
    fireEvent.press(getByLabelText('저장'));
    await waitFor(() => expect(mocks.add).toHaveBeenCalled());
    expect(mocks.add).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ label: '물통', occurrenceDate: 20260602, recurring: false }),
    );
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(applyException).toHaveBeenCalledWith(expect.anything(), 7, day, expect.objectContaining({ kind: 'modify' }));
  });
});
