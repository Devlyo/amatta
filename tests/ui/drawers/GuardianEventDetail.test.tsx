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
    <GuardianEventDetailContent eventId="e1" instance={instance} onClose={() => {}} />,
  );
  expect(await findByLabelText('자녀: 보호자')).toBeTruthy();
  expect(getByLabelText('캘린더: 집')).toBeTruthy();
  expect(getByLabelText('시작: 2026. 11. 12. 3:00 PM')).toBeTruthy();
  expect(getByLabelText('종료: 4:30 PM')).toBeTruthy();
  expect(getByLabelText('반복: 안 함')).toBeTruthy();
  expect(getByLabelText('시작 전 알림: 30분 전')).toBeTruthy();
  expect(getByText('자료 챙기기')).toBeTruthy();
  fireEvent.press(getByLabelText('수정'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/schedule/edit',
    params: { mode: 'editGuardian', eventId: 'e1', instance },
  });
});

test('recurring: delete this instance only', async () => {
  mocked.getEventAsync.mockResolvedValue(event({ recurrenceRule: { frequency: 'weekly' } }) as never);
  const { findByLabelText } = render(<GuardianEventDetailContent eventId="e1" instance={instance} onClose={() => {}} />);
  expect(await findByLabelText('반복: 반복 일정')).toBeTruthy();
  expect(await findByLabelText('이후 일정 모두 삭제')).toBeTruthy();
});

test('read-only calendar: no 수정 / 삭제', async () => {
  useGuardianStore.setState({
    calendars: [{ id: 'home', title: '공휴일', color: 'red', source: 'iCloud', writable: false }],
  });
  mocked.getEventAsync.mockResolvedValue(event() as never);
  const { findByText, queryByLabelText, getByLabelText } = render(
    <GuardianEventDetailContent eventId="e1" instance={instance} onClose={() => {}} />,
  );
  expect(await findByText('읽기 전용 캘린더의 일정이라 앱에서 바꿀 수 없어요.')).toBeTruthy();
  expect(getByLabelText('수정').props.accessibilityState).toMatchObject({ disabled: true });
  expect(queryByLabelText('일정 삭제')).toBeNull();
});

test('gone from the calendar → closes', async () => {
  mocked.getEventAsync.mockRejectedValue(new Error('missing'));
  const onClose = jest.fn();
  render(<GuardianEventDetailContent eventId="e1" instance={instance} onClose={onClose} />);
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});
