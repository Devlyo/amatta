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

test('설정 > 화면: 새 일정 버튼 위치 오른쪽(기본) / 왼쪽', async () => {
  render(<DisplaySettingsScreen />);
  expect(screen.getByLabelText('새 일정 버튼 위치: 오른쪽').props.accessibilityState).toMatchObject({ selected: true });
  fireEvent.press(screen.getByLabelText('새 일정 버튼 위치: 왼쪽'));
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

describe('화면 모드 (ADR-009 step 5)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native') as typeof import('react-native');

  function fakeDb() {
    const rows = new Map<string, string>();
    return {
      rows,
      getFirstAsync: jest.fn(async (_sql: string, [key]: [string]) => (rows.has(key) ? { value: rows.get(key) } : null)),
      runAsync: jest.fn(async (_sql: string, [key, value]: [string, string]) => {
        rows.set(key, value);
      }),
    };
  }

  afterEach(() => jest.restoreAllMocks());

  test('default = 시스템 (no override); saved 다크 is applied on load; reset → 시스템', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const actual = jest.requireActual('../../../src/state/display-store') as typeof import('../../../src/state/display-store');
    const spy = jest.spyOn(RN.Appearance, 'setColorScheme').mockImplementation(() => undefined);
    const db = fakeDb();
    await actual.useDisplayStore.getState().load(db as never);
    expect(actual.useDisplayStore.getState().appearance).toBe('system');
    expect(spy).toHaveBeenLastCalledWith(null);

    db.rows.set('appearance', 'dark');
    await actual.useDisplayStore.getState().load(db as never);
    expect(spy).toHaveBeenLastCalledWith('dark');

    await actual.useDisplayStore.getState().setAppearance(db as never, 'light');
    expect(db.rows.get('appearance')).toBe('light');
    expect(spy).toHaveBeenLastCalledWith('light');

    actual.useDisplayStore.getState().resetToDefaults();
    expect(spy).toHaveBeenLastCalledWith(null);
    expect(actual.useDisplayStore.getState().appearance).toBe('system');
  });

  test('the 화면 screen lists 시스템 / 라이트 / 다크 and saves the choice', async () => {
    const setAppearance = jest.fn(async () => undefined);
    useDisplayStore.setState({ appearance: 'system', setAppearance: setAppearance as never });
    render(<DisplaySettingsScreen />);
    expect(screen.getByLabelText('화면 모드: 시스템 설정 따르기').props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByLabelText('화면 모드: 다크'));
    await waitFor(() => expect(setAppearance).toHaveBeenCalledWith(expect.anything(), 'dark'), { timeout: 5000 });
    expect(screen.queryByText('다크 미리보기')).toBeNull(); // the dev-only switch is gone
  });
});
