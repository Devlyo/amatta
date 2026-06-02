import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: (): { push: jest.Mock } => ({ push: mockPush }),
}));

// eslint-disable-next-line import/first
import { EmptyChildrenState } from '../../../src/ui/common/EmptyChildrenState';

describe('EmptyChildrenState', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  test('renders the amatta-v1 onboarding title', () => {
    const { queryByText } = render(<EmptyChildrenState />);
    expect(queryByText('자녀를 추가하고 시작해요')).not.toBeNull();
  });

  test('renders the body copy', () => {
    const { queryByText } = render(<EmptyChildrenState />);
    expect(queryByText('자녀별 일정을 한눈에 관리할 수 있어요.')).not.toBeNull();
  });

  test('CTA is present and labeled', () => {
    const { queryByText } = render(<EmptyChildrenState />);
    expect(queryByText('자녀 추가하기')).not.toBeNull();
  });

  test('CTA press navigates to /(tabs)/settings', () => {
    const { getByLabelText } = render(<EmptyChildrenState />);
    const cta = getByLabelText('자녀 추가하기');
    fireEvent.press(cta);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings');
  });
});
