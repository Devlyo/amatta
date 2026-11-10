import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useNotifSettingsStore } from '../../../src/state/notif-settings-store';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../../../src/db/client', () => ({ getDb: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../src/notifications/scheduler', () => ({ rescheduleAll: jest.fn() }));

// eslint-disable-next-line import/first
import SettingsScreen from '../../../app/(tabs)/settings';

const setDefault = jest.fn(async (_db: unknown, n: number | null) => {
  useNotifSettingsStore.setState({ defaultMinutesBefore: n });
});

beforeEach(() => {
  useNotifSettingsStore.setState({
    systemEnabled: true,
    defaultMinutesBefore: null,
    setDefaultMinutesBefore: setDefault as never,
    setSystemEnabled: (async (_db: unknown, v: boolean) => useNotifSettingsStore.setState({ systemEnabled: v })) as never,
  });
});

test('기본 알림 시점 shows only while 시스템 알림 is on; default 없음; 없음 is an option', async () => {
  render(<SettingsScreen />);
  expect(screen.getByLabelText('기본 알림 시점: 없음')).toBeTruthy();
  fireEvent.press(screen.getByTestId('settings-row-notif-lead'));
  expect(screen.getByLabelText('기본 알림 시점: 10분 전')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('기본 알림 시점: 30분 전'));
  await waitFor(() => expect(setDefault).toHaveBeenCalledWith(expect.anything(), 30));

  fireEvent(screen.getByLabelText('시스템 알림'), 'valueChange', false);
  await waitFor(() => expect(screen.queryByTestId('settings-row-notif-lead')).toBeNull());
  fireEvent(screen.getByLabelText('시스템 알림'), 'valueChange', true);
  await waitFor(() => expect(screen.getByTestId('settings-row-notif-lead')).toBeTruthy());
});
