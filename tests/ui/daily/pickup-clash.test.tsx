import { render, screen } from '@testing-library/react-native';

import type { Child, ColorIndex, ISODate, Occurrence } from '../../../src/domain/types';
import { PickupCarousel } from '../../../src/ui/daily/PickupCarousel';
import { todayIso } from '../../../src/ui/utils/date';

const today = todayIso();
const kid: Child = { id: 1, name: '민준', colorIndex: 0 as ColorIndex, avatar: 'face-wink', createdAt: today };
const piano: Occurrence = {
  scheduleId: 7,
  childId: 1,
  date: today,
  startMinutes: 17 * 60,
  endMinutes: 18 * 60,
  title: '피아노',
  type: 'academy',
  colorIndex: 0 as ColorIndex,
  needsPickup: true,
};
const dinner = {
  key: `g1|${today as unknown as string}`,
  eventId: 'g1',
  calendarId: 'home',
  title: '저녁 약속',
  date: today as ISODate,
  startMinutes: 17 * 60 + 30,
  endMinutes: 20 * 60,
  allDay: false,
  instanceStart: new Date(),
  instanceEnd: new Date(),
};

function renderCarousel(guardianEvents: (typeof dinner)[]) {
  render(
    <PickupCarousel
      occurrences={[piano]}
      childrenById={new Map([[1, kid]])}
      nowMinutes={9 * 60}
      currentDate={today}
      pickupLogIsComplete={() => false}
      guardianEvents={guardianEvents}
    />,
  );
}

test('home pickup card: one line when a 보호자 event clashes with the pickup', () => {
  renderCarousel([dinner]);
  expect(screen.getByTestId('pickup-guardian-clash')).toBeTruthy();
  expect(screen.getByText(/보호자 일정 ‘저녁 약속’\(5:30–8PM\)과 픽업 시간이 겹쳐요/)).toBeTruthy();
});

test('no clash → no line', () => {
  renderCarousel([{ ...dinner, startMinutes: 19 * 60 }]);
  expect(screen.queryByTestId('pickup-guardian-clash')).toBeNull();
});
