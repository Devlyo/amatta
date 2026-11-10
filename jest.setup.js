// Pre-framework setup (runs before `expect` is defined).
require('react-native-gesture-handler/jestSetup');

// expo-calendar is a native module (ADR-008). Default: permission not yet
// asked, no calendars, no events. Tests override per case.
jest.mock('expo-calendar', () => ({
  EntityTypes: { EVENT: 'event', REMINDER: 'reminder' },
  getCalendarPermissionsAsync: jest.fn(async () => ({ status: 'undetermined', granted: false })),
  requestCalendarPermissionsAsync: jest.fn(async () => ({ status: 'denied', granted: false })),
  getCalendarsAsync: jest.fn(async () => []),
  getDefaultCalendarAsync: jest.fn(async () => ({ id: 'default', allowsModifications: true })),
  getEventsAsync: jest.fn(async () => []),
  createEventAsync: jest.fn(async () => 'new-event'),
  openEventInCalendarAsync: jest.fn(async () => ({ action: 'done' })),
  getEventAsync: jest.fn(async () => null),
  updateEventAsync: jest.fn(async () => 'updated'),
  deleteEventAsync: jest.fn(async () => undefined),
}));
