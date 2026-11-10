// Tests for the children-cap behavior on /settings/kids.
// The 5 cap assertions were originally on the inline settings tab; with the
// D-screens refactor the children CRUD belt moved to app/settings/kids.tsx,
// so the same assertions now target that screen.

import { fireEvent, render } from '@testing-library/react-native';

import type { Child, ISODate } from '../../../src/domain/types';
import { useChildrenStore } from '../../../src/state/children-store';

// ---- Mocks ----------------------------------------------------------------
jest.mock('../../../src/db/client', () => ({
  getDb: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../src/db/repositories', () => ({
  notificationSettingsRepo: {
    getByChildId: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('expo-file-system', () => ({
  Paths: { document: { uri: 'file:///tmp/' } },
  File: class {
    exists = false;
    create(): void {
      /* noop */
    }
    write(): void {
      /* noop */
    }
    delete(): void {
      /* noop */
    }
  },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    SafeAreaView: ({ children, ...props }: React.PropsWithChildren<unknown>) =>
      React.createElement(View, props as object, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// Now import the screen.
// eslint-disable-next-line import/first
import KidsScreen from '../../../app/settings/kids';

// ---- Helpers --------------------------------------------------------------
function seedChildren(count: number): Child[] {
  return Array.from({ length: count }, (_, i): Child => ({
    id: i + 1,
    name: `자녀${i + 1}`,
    colorIndex: (i % 6) as Child['colorIndex'],
    createdAt: '2026-05-01' as unknown as ISODate,
  }));
}

function setChildren(children: Child[]): void {
  useChildrenStore.setState({ children, isLoaded: true });
}

// ---- Tests ----------------------------------------------------------------
describe('Settings — children cap (kids screen)', () => {
  beforeEach(() => {
    setChildren([]);
  });

  test('cap message is NOT visible when children.length < 4', () => {
    setChildren(seedChildren(3));
    const { queryByTestId } = render(<KidsScreen />);
    expect(queryByTestId('cap-message')).toBeNull();
  });

  test('add button is enabled when under cap', () => {
    setChildren(seedChildren(2));
    const { getByTestId } = render(<KidsScreen />);
    const btn = getByTestId('add-child-button');
    const accState = btn.props.accessibilityState as { disabled?: boolean };
    expect(accState.disabled).toBe(false);
  });

  test('add button is disabled when at cap (4 children)', () => {
    setChildren(seedChildren(4));
    const { getByTestId } = render(<KidsScreen />);
    const btn = getByTestId('add-child-button');
    const accState = btn.props.accessibilityState as { disabled?: boolean };
    expect(accState.disabled).toBe(true);
  });

  test('cap message appears only after tapping the disabled add button', () => {
    setChildren(seedChildren(4));
    const { getByTestId, queryByTestId } = render(<KidsScreen />);
    expect(queryByTestId('cap-message')).toBeNull();
    fireEvent.press(getByTestId('add-child-button'));
    expect(queryByTestId('cap-message')).not.toBeNull();
  });

  test('cap message text matches spec', () => {
    setChildren(seedChildren(4));
    const { getByTestId, queryByText } = render(<KidsScreen />);
    fireEvent.press(getByTestId('add-child-button'));
    expect(queryByText('최대 4명까지 등록할 수 있습니다.')).not.toBeNull();
  });
});
