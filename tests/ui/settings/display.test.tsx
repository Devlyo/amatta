import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useDisplayStore } from '../../../src/state/display-store';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('../../../src/db/client', () => ({ getDb: jest.fn().mockResolvedValue({}) }));

// eslint-disable-next-line import/first
import DisplaySettingsScreen from '../../../app/settings/display';
// eslint-disable-next-line import/first
import { FloatingDock } from '../../../src/ui/common/FloatingDock';

const setSide = jest.fn(async (_db: unknown, side: 'left' | 'right') => {
  useDisplayStore.setState({ addButtonSide: side });
});

beforeEach(() => {
  useDisplayStore.setState({ addButtonSide: 'right', setAddButtonSide: setSide as never });
});

test('설정 > 화면: + 버튼 위치 오른쪽(기본) / 왼쪽', async () => {
  render(<DisplaySettingsScreen />);
  expect(screen.getByLabelText('+ 버튼 위치: 오른쪽').props.accessibilityState).toMatchObject({ selected: true });
  fireEvent.press(screen.getByLabelText('+ 버튼 위치: 왼쪽'));
  await waitFor(() => expect(setSide).toHaveBeenCalledWith(expect.anything(), 'left'), { timeout: 5000 });
});

test('the dock puts + on the chosen side', () => {
  const props = {
    state: { index: 0, routes: [{ key: 'h', name: 'index' }, { key: 'c', name: 'calendar' }, { key: 's', name: 'settings' }] },
    navigation: { emit: () => ({ defaultPrevented: false }), navigate: jest.fn() },
  } as never;
  const { getByTestId, rerender } = render(<FloatingDock {...(props as object)} />);
  const wrapStyle = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { StyleSheet } = require('react-native') as typeof import('react-native');
    return StyleSheet.flatten(getByTestId('dock').props.style) as { flexDirection?: string };
  };
  expect(wrapStyle().flexDirection).toBe('row');
  useDisplayStore.setState({ addButtonSide: 'left' });
  rerender(<FloatingDock {...(props as object)} />);
  expect(wrapStyle().flexDirection).toBe('row-reverse');
});
