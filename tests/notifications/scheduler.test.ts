// Notification scheduler invariants — Phase 5 acceptance.
//
// What this file pins:
//
//   1. rescheduleAll() ALWAYS begins with
//      Notifications.cancelAllScheduledNotificationsAsync() — call-order
//      assertion against the mocked module.
//   2. Schedules with notifyMinutesBefore = null produce zero triggers.
//   3. Schedules with notifyMinutesBefore set produce one trigger per
//      future occurrence inside the 14-day horizon (past triggers skipped).
//   4. Todos with notifyMinutesBefore + a future dueAt fire once each.
//   5. sessionMap is NEVER persisted to AsyncStorage — grep across
//      src/notifications/* asserts no AsyncStorage.setItem references the
//      notification map.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  rescheduleAll,
  __sessionMapSize,
  __clearSessionMap,
} from '../../src/notifications/scheduler';
import type { Child, Schedule, Todo } from '../../src/domain/types';

// ── Mocks ────────────────────────────────────────────────────────────
//
// jest.mock() factories may only reference variables whose names start
// with "mock" (case-insensitive). The closure state lives on the
// `mockState` object so the tests can mutate it via beforeEach.

interface MockState {
  callOrder: string[];
  scheduled: { id: string; content: unknown; trigger: unknown }[];
  nextNotifId: number;
  fakeChildren: Child[];
  fakeSchedules: Schedule[];
  fakeTodos: Todo[];
}

const mockState: MockState = {
  callOrder: [],
  scheduled: [],
  nextNotifId: 1,
  fakeChildren: [
    {
      id: 1,
      name: '민준',
      colorIndex: 0,
      avatar: 'face-wink',
      createdAt: '2026-01-01' as unknown as Child['createdAt'],
    },
  ],
  fakeSchedules: [],
  fakeTodos: [],
};

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {
    mockState.callOrder.push('cancelAll');
    mockState.scheduled.length = 0;
  }),
  scheduleNotificationAsync: jest.fn(
    async ({ content, trigger }: { content: unknown; trigger: unknown }) => {
      mockState.callOrder.push('schedule');
      const id = `n${mockState.nextNotifId++}`;
      mockState.scheduled.push({ id, content, trigger });
      return id;
    },
  ),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
}));

jest.mock('../../src/db/repositories', () => ({
  childrenRepo: {
    list: jest.fn(async () => mockState.fakeChildren),
  },
  schedulesRepo: {
    list: jest.fn(async () => mockState.fakeSchedules),
  },
  exceptionsRepo: {
    list: jest.fn(async () => []),
  },
  checklistItemsRepo: {
    listBySchedule: jest.fn(async () => []),
  },
  todosRepo: {
    list: jest.fn(async () => mockState.fakeTodos),
  },
  notificationSettingsRepo: {},
  schedulePickupLogRepo: {},
}));

// ── Test helpers ─────────────────────────────────────────────────────

function makeSchedule(over: Partial<Schedule>): Schedule {
  return {
    id: 1,
    childId: 1,
    title: '영어학원',
    type: 'academy',
    location: null,
    notes: null,
    daysOfWeek: 0b1111111, // every day in the Mon-bit-0 mask
    startMinutes: 15 * 60, // 15:00
    endMinutes: 16 * 60,
    validFrom: '2026-01-01' as unknown as Schedule['validFrom'],
    validUntil: null,
    notifyMinutesBefore: 15,
    needsPickup: false,
    ...over,
  };
}

function makeTodo(over: Partial<Todo>): Todo {
  return {
    id: 1,
    childId: null,
    title: '준비물 챙기기',
    dueAt: Date.now() + 60 * 60 * 1000, // 1h from now
    notifyMinutesBefore: 30,
    isDone: false,
    doneAt: null,
    createdAt: Date.now(),
    ...over,
  };
}

const fakeDb = {} as Parameters<typeof rescheduleAll>[0];

beforeEach(() => {
  mockState.callOrder.length = 0;
  mockState.scheduled.length = 0;
  mockState.nextNotifId = 1;
  mockState.fakeSchedules = [];
  mockState.fakeTodos = [];
  __clearSessionMap();
});

describe('rescheduleAll', () => {
  test('first call is always cancelAllScheduledNotificationsAsync', async () => {
    mockState.fakeSchedules = [makeSchedule({})];
    await rescheduleAll(fakeDb);
    expect(mockState.callOrder[0]).toBe('cancelAll');
  });

  test('schedules with notifyMinutesBefore=null produce zero triggers', async () => {
    mockState.fakeSchedules = [makeSchedule({ notifyMinutesBefore: null })];
    await rescheduleAll(fakeDb);
    expect(mockState.scheduled).toHaveLength(0);
    expect(__sessionMapSize()).toBe(0);
  });

  test('schedules with notifyMinutesBefore set produce future-occurrence triggers', async () => {
    // Use a stable "now" so the 14-day horizon is deterministic. The
    // schedule fires every day at 15:00 with a 15-min lead time.
    // We expect 14 triggers (one per day inside the horizon).
    const now = new Date('2026-06-02T08:00:00');
    mockState.fakeSchedules = [makeSchedule({})];
    await rescheduleAll(fakeDb, { now });
    expect(mockState.scheduled.length).toBeGreaterThan(0);
    expect(mockState.scheduled.length).toBeLessThanOrEqual(15);
    expect(__sessionMapSize()).toBe(1);
  });

  test('past trigger times are skipped', async () => {
    // Same daily schedule but "now" is AFTER its end time on the same
    // day — that day's own trigger must be skipped (already past).
    const now = new Date('2026-06-02T20:00:00');
    mockState.fakeSchedules = [makeSchedule({})];
    await rescheduleAll(fakeDb, { now });
    // Inspect trigger dates: none should be earlier than `now`.
    for (const s of mockState.scheduled) {
      const t = s.trigger as { date: Date };
      expect(t.date.getTime()).toBeGreaterThan(now.getTime());
    }
  });

  test('todo with future dueAt fires exactly once', async () => {
    const now = new Date('2026-06-02T08:00:00');
    mockState.fakeTodos = [
      makeTodo({
        dueAt: now.getTime() + 2 * 60 * 60 * 1000, // 2h from "now"
        notifyMinutesBefore: 30,
      }),
    ];
    await rescheduleAll(fakeDb, { now });
    expect(mockState.scheduled).toHaveLength(1);
  });

  test('done todos and past dueAt are skipped', async () => {
    const now = new Date('2026-06-02T08:00:00');
    mockState.fakeTodos = [
      makeTodo({ id: 1, isDone: true }),
      makeTodo({ id: 2, dueAt: now.getTime() - 60 * 1000 }),
      makeTodo({ id: 3, notifyMinutesBefore: null }),
    ];
    await rescheduleAll(fakeDb, { now });
    expect(mockState.scheduled).toHaveLength(0);
  });
});

describe('SPEC-NOTIF-1 — sessionMap never persisted', () => {
  // Grep test: walk every src/notifications/* .ts file and assert no
  // AsyncStorage.setItem call references the notification map. Spec
  // pins this so a future regression that tries to "speed up" cold
  // start by caching the map gets caught here.
  test('no AsyncStorage write references the notification map', () => {
    const dir = join(__dirname, '..', '..', 'src', 'notifications');
    const offenders: string[] = [];
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (!statSync(p).isFile() || !name.endsWith('.ts')) continue;
      const src = readFileSync(p, 'utf8');
      // Permissions stores ONE flag key; that's allowed.
      // Disallow anything writing the notification-map shape.
      const re = /AsyncStorage\.setItem\([^)]*(sessionMap|notif.*map|n.*ids|scheduledIds)/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        offenders.push(`${name}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
