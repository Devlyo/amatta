import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Calendar from 'expo-calendar';

import { useGuardianStore } from '../../../src/state/guardian-store';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  // Run the focus effect once, like a mount.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));

// eslint-disable-next-line import/first
import { GuardianEventDetailContent } from '../../../src/ui/drawers/GuardianEventDetail';

const mocked = Calendar as jest.Mocked<typeof Calendar>;
const instance = new Date(2026, 10, 12, 15, 0).toISOString();
const instanceEnd = new Date(2026, 10, 12, 16, 30).toISOString();

function event(over: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    calendarId: 'home',
    title: '회의',
    location: '회사',
    notes: '자료 챙기기',
    startDate: new Date(2026, 10, 12, 15, 0).toISOString(),
    endDate: new Date(2026, 10, 12, 16, 30).toISOString(),
    allDay: false,
    alarms: [{ relativeOffset: -30 }],
    recurrenceRule: null,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useGuardianStore.setState({
    calendars: [{ id: 'home', title: '집', color: 'red', source: 'iCloud', writable: true }],
  });
});

test('same rows as a kid event: 보호자, calendar, times, alert, memo; 수정 opens the form', async () => {
  mocked.getEventAsync.mockResolvedValue(event() as never);
  const { findByLabelText, getByLabelText, getByText } = render(
    <GuardianEventDetailContent eventId="e1" instance={instance} instanceEnd={instanceEnd} onClose={() => {}} />,
  );
  expect(await findByLabelText('참여: 보호자')).toBeTruthy();
  expect(getByLabelText('캘린더: 집')).toBeTruthy();
  expect(getByLabelText('시작: 2026. 11. 12. 3:00 PM')).toBeTruthy();
  expect(getByLabelText('종료: 4:30 PM')).toBeTruthy();
  expect(getByLabelText('반복: 안 함')).toBeTruthy();
  expect(getByLabelText('시작 전 알림: 30분 전')).toBeTruthy();
  expect(getByText('자료 챙기기')).toBeTruthy();
  fireEvent.press(getByLabelText('수정'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/schedule/edit',
    params: { mode: 'editGuardian', eventId: 'e1' },
  });
});

test('recurring: shown with the TAPPED instance\u2019s dates; changed in the Calendar app, not here', async () => {
  // Read back as its first instance (Nov 5) — the detail must show Nov 12.
  mocked.getEventAsync.mockResolvedValue(
    event({
      recurrenceRule: { frequency: 'weekly' },
      startDate: new Date(2026, 10, 5, 15, 0).toISOString(),
      endDate: new Date(2026, 10, 5, 16, 30).toISOString(),
    }) as never,
  );
  const { findByLabelText, getByLabelText, queryByLabelText, getByText } = render(
    <GuardianEventDetailContent eventId="e1" instance={instance} instanceEnd={instanceEnd} onClose={() => {}} />,
  );
  expect(await findByLabelText('반복: 반복 일정')).toBeTruthy();
  expect(getByLabelText('시작: 2026. 11. 12. 3:00 PM')).toBeTruthy();
  expect(getByText('반복 일정은 아이폰 캘린더에서 수정하거나 삭제할 수 있어요.')).toBeTruthy();
  expect(getByLabelText('수정').props.accessibilityState).toMatchObject({ disabled: true });
  expect(queryByLabelText('일정 삭제')).toBeNull();
  expect(getByLabelText('아이폰 캘린더에서 열기')).toBeTruthy();
});

test('reads by id only (no instance date — the native lookup by instance is broken)', async () => {
  mocked.getEventAsync.mockResolvedValue(event() as never);
  const { findByLabelText } = render(
    <GuardianEventDetailContent eventId="e1" instance={instance} instanceEnd={instanceEnd} onClose={() => {}} />,
  );
  await findByLabelText('참여: 보호자');
  expect(mocked.getEventAsync).toHaveBeenCalledWith('e1');
});

test('read-only calendar: no 수정 / 삭제', async () => {
  useGuardianStore.setState({
    calendars: [{ id: 'home', title: '공휴일', color: 'red', source: 'iCloud', writable: false }],
  });
  mocked.getEventAsync.mockResolvedValue(event() as never);
  const { findByText, queryByLabelText, getByLabelText } = render(
    <GuardianEventDetailContent eventId="e1" instance={instance} instanceEnd={instanceEnd} onClose={() => {}} />,
  );
  expect(await findByText('읽기 전용 캘린더의 일정이라 앱에서 바꿀 수 없어요.')).toBeTruthy();
  expect(getByLabelText('수정').props.accessibilityState).toMatchObject({ disabled: true });
  expect(queryByLabelText('일정 삭제')).toBeNull();
});

test('gone from the calendar → closes', async () => {
  mocked.getEventAsync.mockRejectedValue(new Error('missing'));
  const onClose = jest.fn();
  render(<GuardianEventDetailContent eventId="e1" instance={instance} instanceEnd={instanceEnd} onClose={onClose} />);
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});
