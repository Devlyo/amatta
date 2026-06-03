import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockAdd = jest.fn();
const mockDb = { __fake: 'db' } as const;

jest.mock('../../../src/state/children-store', () => ({
  useChildrenStore: (selector: (state: { add: jest.Mock }) => unknown) =>
    selector({ add: mockAdd }),
}));

jest.mock('../../../src/db/client', () => ({
  getDb: jest.fn(async () => mockDb),
}));

// eslint-disable-next-line import/first
import { EmptyChildrenState } from '../../../src/ui/common/EmptyChildrenState';

describe('EmptyChildrenState', () => {
  beforeEach(() => {
    mockAdd.mockClear();
    mockAdd.mockResolvedValue({
      id: 1,
      name: '아이',
      colorIndex: 0,
      createdAt: '2026-06-02',
    });
  });

  test('renders welcome state by default', () => {
    const { queryByText, queryByLabelText } = render(<EmptyChildrenState />);
    expect(queryByText('Welcome')).not.toBeNull();
    expect(queryByLabelText('시작하기')).not.toBeNull();
  });

  test('tapping 시작하기 transitions to addKid screen', () => {
    const { getByLabelText, queryByLabelText, queryByText } = render(
      <EmptyChildrenState />,
    );
    fireEvent.press(getByLabelText('시작하기'));
    expect(queryByText('자녀를 알려주세요')).not.toBeNull();
    expect(queryByLabelText('자녀 이름')).not.toBeNull();
  });

  test('filling name + selecting color + tapping 추가 calls childrenStore.add', async () => {
    const { getByLabelText } = render(<EmptyChildrenState />);
    fireEvent.press(getByLabelText('시작하기'));

    fireEvent.changeText(getByLabelText('자녀 이름'), '민준');
    fireEvent.press(getByLabelText('색상 2'));
    fireEvent.press(getByLabelText('추가'));

    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalledTimes(1);
    });
    // colorIndex 1 → AVATAR_KEYS[1] = 'face-cool' per src/domain/avatar.
    expect(mockAdd).toHaveBeenCalledWith(mockDb, {
      name: '민준',
      colorIndex: 1,
      avatar: 'face-cool',
    });
  });
});
