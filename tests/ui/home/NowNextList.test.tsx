import { render, screen } from '@testing-library/react-native';

import type { Child, ColorIndex, ISODate } from '../../../src/domain/types';
import { NowNextList } from '../../../src/ui/home/NowNextList';

const kid = (id: number, name: string): Child => ({
  id,
  name,
  colorIndex: (id % 6) as ColorIndex,
  avatar: 'face-wink',
  createdAt: '2026-01-01' as unknown as ISODate,
});

test('each row names its kid right before what they are doing', () => {
  render(
    <NowNextList
      kids={[kid(1, '민준'), kid(2, '서연')]}
      rows={[
        {
          childId: 1,
          status: 'inProgress',
          current: { title: '영어학원', type: 'academy', startMinutes: 14 * 60, endMinutes: 15 * 60 + 30 },
          next: null,
          minutesUntilNext: null,
        },
        { childId: 2, status: 'none', current: null, next: null, minutesUntilNext: null },
      ] as never}
    />,
  );
  // Inline, right before the title.
  expect(screen.getByText('민준')).toBeTruthy();
  expect(screen.getByText('서연')).toBeTruthy();
  expect(screen.getByLabelText(/^민준, 영어학원 3:30PM까지/)).toBeTruthy();
  // Shown as "~3:30PM" (spoken "3:30PM까지").
  expect(screen.getByText('~3:30PM')).toBeTruthy();
});
