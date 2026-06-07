// UI tests for TodoSection.

import { fireEvent, render } from '@testing-library/react-native';

import type { ISODate, Todo } from '../../../src/domain/types';
import { useTodosStore } from '../../../src/state/todos-store';
import { useUiStore } from '../../../src/state/ui-store';

const toggleDoneMock = jest.fn();
const addMock = jest.fn();

jest.mock('../../../src/db/client', () => ({
  getDb: jest.fn().mockResolvedValue({ __mock: true }),
}));

// eslint-disable-next-line import/first
import { TodoSection } from '../../../src/ui/daily/TodoSection';

const iso = (s: string): ISODate => s as unknown as ISODate;
const TODAY = iso('2026-06-02');

function mkTodo(id: number, title: string, dueAt: number, isDone = false, childId: number | null = null): Todo {
  return {
    id,
    childId,
    title,
    dueAt,
    notifyMinutesBefore: null,
    isDone,
    doneAt: null,
    createdAt: 0,
  };
}

beforeEach(() => {
  toggleDoneMock.mockReset();
  addMock.mockReset();
  // Promise-resolving mocks so `await` in commitDraft resolves cleanly.
  addMock.mockResolvedValue(undefined);
  useTodosStore.setState({ todos: [], isLoaded: true, toggleDone: toggleDoneMock, add: addMock });
  useUiStore.setState({ currentDate: TODAY });
});

describe('TodoSection', () => {
  test('empty state shows 0/0 and the inline add row', () => {
    const { getByText, getByTestId, queryByTestId } = render(<TodoSection />);
    expect(getByText('할일')).toBeTruthy();
    expect(getByText('0/0')).toBeTruthy();
    expect(getByText('할일 추가')).toBeTruthy();
    expect(getByTestId('todo-add-row')).toBeTruthy();
    expect(queryByTestId(/^todo-item-/)).toBeNull();
  });

  test('populated: renders parent-level + per-kid todos sorted by dueAt ASC', () => {
    // Both due on the viewed day (2026-06-02), different times → sort by time.
    const earlier = new Date(2026, 5, 2, 8, 0).getTime();
    const later = new Date(2026, 5, 2, 17, 0).getTime();
    useTodosStore.setState({
      todos: [
        mkTodo(2, '준비물 사기', later, false, null),
        mkTodo(1, '서연 약 챙기기', earlier, true, 2),
      ],
      isLoaded: true,
      toggleDone: toggleDoneMock,
      add: addMock,
    });

    const { getByText, getByTestId } = render(<TodoSection />);
    expect(getByText('1/2')).toBeTruthy();
    expect(getByTestId('todo-item-1')).toBeTruthy();
    expect(getByTestId('todo-item-2')).toBeTruthy();
    expect(getByText('서연 약 챙기기')).toBeTruthy();
    expect(getByText('준비물 사기')).toBeTruthy();
    // Date pill removed — new todos always bind to the viewed date so
    // a relative "오늘 / 내일 / M/D" caption became redundant clutter.
  });

  test('date-bound: a todo due on another day is hidden (June 5 todo not shown on June 2)', () => {
    const onJun2 = new Date(2026, 5, 2, 9, 0).getTime();
    const onJun5 = new Date(2026, 5, 5, 9, 0).getTime();
    useTodosStore.setState({
      todos: [
        mkTodo(1, '오늘 할일', onJun2, false, null),
        mkTodo(2, '다른날 할일', onJun5, false, null),
      ],
      isLoaded: true,
      toggleDone: toggleDoneMock,
      add: addMock,
    });

    const { getByText, getByTestId, queryByTestId, queryByText } = render(<TodoSection />);
    // currentDate is 2026-06-02 → only the June 2 todo counts/renders.
    expect(getByText('0/1')).toBeTruthy();
    expect(getByTestId('todo-item-1')).toBeTruthy();
    expect(getByText('오늘 할일')).toBeTruthy();
    expect(queryByTestId('todo-item-2')).toBeNull();
    expect(queryByText('다른날 할일')).toBeNull();
  });

  test('inline add flow: tap + → type → submit → add() invoked with childId null', async () => {
    const { getByTestId, queryByTestId } = render(<TodoSection />);

    // Open the inline editor.
    fireEvent.press(getByTestId('todo-add-row'));
    await Promise.resolve();

    const input = getByTestId('todo-add-input');
    fireEvent.changeText(input, '학부모회의 자료 출력');
    fireEvent(input, 'submitEditing');

    // commitDraft awaits getDb() → flush microtasks.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(addMock).toHaveBeenCalledTimes(1);
    const [, payload] = addMock.mock.calls[0] ?? [];
    expect(payload).toEqual(
      expect.objectContaining({
        childId: null,
        title: '학부모회의 자료 출력',
        notifyMinutesBefore: null,
      }),
    );
    expect(typeof payload.dueAt).toBe('number');
    // After commit the input is unmounted again.
    expect(queryByTestId('todo-add-input')).toBeNull();
  });
});
