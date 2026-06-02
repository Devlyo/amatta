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

  test('renders the onboarding message', () => {
    const { queryByText } = render(<EmptyChildrenState />);
    expect(queryByText('자녀를 등록해 일정을 시작하세요.')).not.toBeNull();
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
