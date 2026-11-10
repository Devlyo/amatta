import * as Calendar from 'expo-calendar';

import { useGuardianStore, visibleCalendarIds } from '../../src/state/guardian-store';
import type { ISODate } from '../../src/domain/types';

const ISO = (s: string) => s as unknown as ISODate;
const mocked = Calendar as jest.Mocked<typeof Calendar>;

// Minimal app_settings fake: the store only calls get/set on the repo.
function fakeDb() {
  const rows = new Map<string, string>();
  return {
    rows,
    getFirstAsync: jest.fn(async (_sql: string, [key]: [string]) =>
      rows.has(key) ? { value: rows.get(key) } : null,
    ),
    runAsync: jest.fn(async (_sql: string, [key, value]: [string, string]) => {
      rows.set(key, value);
    }),
  };
}

const calendars = [
  { id: 'home', title: '집', color: '#f00', source: { name: 'iCloud' }, allowsModifications: true },
  { id: 'work', title: '회사', color: '#00f', source: { name: 'Gmail' }, allowsModifications: false },
];

beforeEach(() => {
  useGuardianStore.getState().resetToDefaults();
  jest.clearAllMocks();
});

test('turning on asks for permission; refused → stays off', async () => {
  const db = fakeDb();
  mocked.requestCalendarPermissionsAsync.mockResolvedValueOnce({ status: 'denied' } as never);
  expect(await useGuardianStore.getState().setEnabled(db as never, true)).toBe(false);
  expect(useGuardianStore.getState().enabled).toBe(false);
  expect(useGuardianStore.getState().permission).toBe('denied');
  expect(db.rows.has('guardian_enabled')).toBe(false);
});

test('granted → on, persisted, calendars listed; events read only from chosen calendars', async () => {
  const db = fakeDb();
  mocked.requestCalendarPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as never);
  mocked.getCalendarsAsync.mockResolvedValue(calendars as never);
  expect(await useGuardianStore.getState().setEnabled(db as never, true)).toBe(true);
  expect(db.rows.get('guardian_enabled')).toBe('1');
  expect(useGuardianStore.getState().calendars.map((c) => c.id)).toEqual(['work', 'home']); // by source
  expect(useGuardianStore.getState().calendars.find((c) => c.id === 'work')?.writable).toBe(false);

  await useGuardianStore.getState().toggleCalendar(db as never, 'work'); // all → all but work
  expect(JSON.parse(db.rows.get('guardian_calendar_ids') ?? '[]')).toEqual(['home']);

  mocked.getEventsAsync.mockResolvedValueOnce([
    {
      id: 'e1',
      calendarId: 'home',
      title: '병원',
      startDate: new Date(2026, 10, 10, 10, 0).toISOString(),
      endDate: new Date(2026, 10, 10, 11, 0).toISOString(),
      allDay: false,
    },
  ] as never);
  await useGuardianStore.getState().fetchRange(ISO('2026-11-08'), ISO('2026-11-14'));
  expect(mocked.getEventsAsync.mock.calls[0]?.[0]).toEqual(['home']);
  expect(useGuardianStore.getState().events).toMatchObject([{ title: '병원', date: '2026-11-10', startMinutes: 600 }]);
});

test('load restores the choices; vanished calendar ids are ignored', async () => {
  const db = fakeDb();
  db.rows.set('guardian_enabled', '1');
  db.rows.set('guardian_calendar_ids', JSON.stringify(['home', 'gone']));
  mocked.getCalendarPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as never);
  mocked.getCalendarsAsync.mockResolvedValue(calendars as never);
  await useGuardianStore.getState().load(db as never);
  const s = useGuardianStore.getState();
  expect(s.enabled).toBe(true);
  expect(visibleCalendarIds(s.calendars, s.calendarIds)).toEqual(['home']);
});

test('off or no permission → no device reads', async () => {
  await useGuardianStore.getState().fetchRange(ISO('2026-11-08'), ISO('2026-11-14'));
  expect(mocked.getEventsAsync).not.toHaveBeenCalled();
  expect(useGuardianStore.getState().events).toEqual([]);
});
