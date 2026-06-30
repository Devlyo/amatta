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
  MAX_SCHEDULED,
  __sessionMapSize,
  __clearSessionMap,
} from '../../src/notifications/scheduler';
import { useNotifSettingsStore } from '../../src/state/notif-settings-store';
import type {
  ChecklistItem,
  Child,
  Schedule,
  Todo,
} from '../../src/domain/types';

// ── Mocks ────────────────────────────────────────────────────────────
//
// jest.mock() factories may only reference variables whose names start
// with "mock" (case-insensitive). The closure state lives on the
// `mockState` object so the tests can mutate it via beforeEach.

interface FakeCompletion {
  id: number;
  checklistItemId: number;
  occurrenceDate: number; // yyyymmdd int
  completedAt: number;
}

interface MockState {
  callOrder: string[];
  scheduled: { id: string; content: unknown; trigger: unknown }[];
  nextNotifId: number;
  fakeChildren: Child[];
  fakeSchedules: Schedule[];
  fakeTodos: Todo[];
  // PREP-RECUR: checklist items keyed by scheduleId, plus the completion log.
  fakeChecklistBySchedule: Map<number, ChecklistItem[]>;
  fakeCompletions: FakeCompletion[];
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
  fakeChecklistBySchedule: new Map<number, ChecklistItem[]>(),
  fakeCompletions: [],
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
    listBySchedule: jest.fn(
      async (_db: unknown, scheduleId: number) =>
        mockState.fakeChecklistBySchedule.get(scheduleId) ?? [],
    ),
  },
  checklistCompletionRepo: {
    listForDateRange: jest.fn(
      async (_db: unknown, from: number, to: number) =>
        mockState.fakeCompletions.filter(
          (c) => c.occurrenceDate >= from && c.occurrenceDate <= to,
        ),
    ),
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

function makeChecklistItem(over: Partial<ChecklistItem>): ChecklistItem {
  return {
    id: 1,
    scheduleId: 1,
    label: '교재',
    sortOrder: 0,
    isDone: false, // FROZEN as of v6 — never read by the scheduler.
    doneAt: null,
    occurrenceDate: null, // recurring by default.
    ...over,
  };
}

/** yyyymmdd int for a YYYY-MM-DD literal (mirrors isoToYyyymmdd). */
function ymd(iso: string): number {
  return (
    Number(iso.slice(0, 4)) * 10000 +
    Number(iso.slice(5, 7)) * 100 +
    Number(iso.slice(8, 10))
  );
}

const fakeDb = {} as Parameters<typeof rescheduleAll>[0];

beforeEach(() => {
  mockState.callOrder.length = 0;
  mockState.scheduled.length = 0;
  mockState.nextNotifId = 1;
  mockState.fakeSchedules = [];
  mockState.fakeTodos = [];
  mockState.fakeChecklistBySchedule = new Map();
  mockState.fakeCompletions = [];
  __clearSessionMap();
  // Default the notif gate to ON so the pre-existing tests are unaffected;
  // the P3.4 block flips it OFF explicitly.
  useNotifSettingsStore.setState({
    systemEnabled: true,
    lastScheduleTruncated: false,
    lastScheduledCount: 0,
  });
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

describe('P3.4 — systemEnabled gates scheduling', () => {
  test('systemEnabled=false ⇒ cancelAll runs but nothing is scheduled', async () => {
    useNotifSettingsStore.setState({ systemEnabled: false });
    mockState.fakeSchedules = [makeSchedule({})];
    mockState.fakeTodos = [makeTodo({})];
    await rescheduleAll(fakeDb, { now: new Date('2026-06-02T08:00:00') });

    expect(mockState.callOrder[0]).toBe('cancelAll');
    expect(mockState.callOrder).not.toContain('schedule');
    expect(mockState.scheduled).toHaveLength(0);
    expect(__sessionMapSize()).toBe(0);
    expect(useNotifSettingsStore.getState().lastScheduledCount).toBe(0);
  });

  test('toggling back on re-schedules', async () => {
    mockState.fakeSchedules = [makeSchedule({})];
    const now = new Date('2026-06-02T08:00:00');

    useNotifSettingsStore.setState({ systemEnabled: false });
    await rescheduleAll(fakeDb, { now });
    expect(mockState.scheduled).toHaveLength(0);

    useNotifSettingsStore.setState({ systemEnabled: true });
    await rescheduleAll(fakeDb, { now });
    expect(mockState.scheduled.length).toBeGreaterThan(0);
  });
});

describe('P3.2 — count-bounded soonest-first ≤60', () => {
  // Build N distinct todo candidates with strictly-increasing dueAt so the
  // candidate count is deterministic (1 trigger each) and "soonest" is the
  // smallest dueAt.
  function makeTodos(count: number, now: Date): Todo[] {
    const todos: Todo[] = [];
    for (let i = 0; i < count; i++) {
      todos.push(
        makeTodo({
          id: i + 1,
          // i+1 hours out, all in the future, strictly ascending.
          dueAt: now.getTime() + (i + 1) * 60 * 60 * 1000,
          notifyMinutesBefore: 0,
        }),
      );
    }
    return todos;
  }

  const now = new Date('2026-06-02T08:00:00');

  test('exactly 60 candidates → all 60 scheduled, not truncated', async () => {
    mockState.fakeTodos = makeTodos(60, now);
    await rescheduleAll(fakeDb, { now });
    expect(mockState.scheduled).toHaveLength(60);
    expect(useNotifSettingsStore.getState().lastScheduleTruncated).toBe(false);
    expect(useNotifSettingsStore.getState().lastScheduledCount).toBe(60);
  });

  test('61 candidates → only the 60 soonest scheduled, truncated flag true', async () => {
    mockState.fakeTodos = makeTodos(61, now);
    await rescheduleAll(fakeDb, { now });
    expect(mockState.scheduled).toHaveLength(MAX_SCHEDULED);
    expect(useNotifSettingsStore.getState().lastScheduleTruncated).toBe(true);

    // The single dropped trigger must be the LATEST (61st) dueAt.
    const droppedFireAt = makeTodos(61, now)[60]!.dueAt;
    const scheduledTimes = mockState.scheduled.map(
      (s) => (s.trigger as { date: Date }).date.getTime(),
    );
    expect(scheduledTimes).not.toContain(droppedFireAt);
    // Every scheduled time is earlier than the dropped one.
    for (const t of scheduledTimes) expect(t).toBeLessThan(droppedFireAt);
  });

  test('65 candidates → exactly 60 soonest, 5 dropped', async () => {
    const all = makeTodos(65, now);
    mockState.fakeTodos = all;
    await rescheduleAll(fakeDb, { now });
    expect(mockState.scheduled).toHaveLength(MAX_SCHEDULED);
    expect(useNotifSettingsStore.getState().lastScheduleTruncated).toBe(true);

    const scheduledTimes = new Set(
      mockState.scheduled.map((s) => (s.trigger as { date: Date }).date.getTime()),
    );
    const sortedFireAts = all.map((t) => t.dueAt).sort((a, b) => a - b);
    // The 60 soonest are present; the latest 5 are absent.
    for (let i = 0; i < 60; i++) expect(scheduledTimes.has(sortedFireAts[i]!)).toBe(true);
    for (let i = 60; i < 65; i++) expect(scheduledTimes.has(sortedFireAts[i]!)).toBe(false);
  });

  test('≤60 (50) candidates → truncated flag false', async () => {
    mockState.fakeTodos = makeTodos(50, now);
    await rescheduleAll(fakeDb, { now });
    expect(mockState.scheduled).toHaveLength(50);
    expect(useNotifSettingsStore.getState().lastScheduleTruncated).toBe(false);
  });
});

describe('PREP-RECUR 3.2f — per-occurrence checklist suppression (Option A)', () => {
  // Daily schedule at 15:00 (fires 14:45). "now" before the first occurrence so
  // the horizon yields one trigger per day. Map a scheduled trigger back to its
  // occurrence date via the local Y/M/D of the fire time.
  function bodyForDate(isoDate: string): string | undefined {
    const targetY = Number(isoDate.slice(0, 4));
    const targetM = Number(isoDate.slice(5, 7));
    const targetD = Number(isoDate.slice(8, 10));
    for (const s of mockState.scheduled) {
      const d = (s.trigger as { date: Date }).date;
      if (
        d.getFullYear() === targetY &&
        d.getMonth() + 1 === targetM &&
        d.getDate() === targetD
      ) {
        return (s.content as { body: string }).body;
      }
    }
    return undefined;
  }

  // The horizon window is derived from the REAL local clock (todayIso()), while
  // `now` only drives the past-occurrence skip. So D MUST be today and D1
  // tomorrow, with `now` at the very start of today so the 14:45 fire times are
  // still in the future. (Daily schedule fires at 15:00, 15-min lead.)
  const realNow = new Date();
  const startOfToday = new Date(
    realNow.getFullYear(),
    realNow.getMonth(),
    realNow.getDate(),
    0,
    1,
    0,
    0,
  );
  function isoOffset(days: number): string {
    const d = new Date(
      realNow.getFullYear(),
      realNow.getMonth(),
      realNow.getDate() + days,
    );
    const yy = String(d.getFullYear()).padStart(4, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }
  const now = startOfToday;
  const D = isoOffset(0); // today — first occurrence inside the horizon.
  const D1 = isoOffset(1); // tomorrow — next occurrence.

  test('item completed for occurrence D is absent on D but present on D+1', async () => {
    mockState.fakeSchedules = [makeSchedule({ id: 1 })];
    mockState.fakeChecklistBySchedule.set(1, [
      makeChecklistItem({ id: 100, label: '교재', occurrenceDate: null }),
    ]);
    // Completed only for D.
    mockState.fakeCompletions = [
      { id: 1, checklistItemId: 100, occurrenceDate: ymd(D), completedAt: 1 },
    ];

    await rescheduleAll(fakeDb, { now });

    const bodyD = bodyForDate(D);
    const bodyD1 = bodyForDate(D1);
    expect(bodyD).toBeDefined();
    expect(bodyD1).toBeDefined();
    // D: suppressed → body is just the time range, no '교재'.
    expect(bodyD).not.toContain('교재');
    // D+1: still pending → label present.
    expect(bodyD1).toContain('교재');
  });

  test('day-specific item appears ONLY on its bound date', async () => {
    mockState.fakeSchedules = [makeSchedule({ id: 1 })];
    mockState.fakeChecklistBySchedule.set(1, [
      // Bound to D1 only.
      makeChecklistItem({ id: 200, label: '수영복', occurrenceDate: ymd(D1) }),
    ]);

    await rescheduleAll(fakeDb, { now });

    expect(bodyForDate(D)).not.toContain('수영복');
    expect(bodyForDate(D1)).toContain('수영복');
  });

  test('recurring item (occurrenceDate null) appears on every occurrence', async () => {
    mockState.fakeSchedules = [makeSchedule({ id: 1 })];
    mockState.fakeChecklistBySchedule.set(1, [
      makeChecklistItem({ id: 300, label: '물통', occurrenceDate: null }),
    ]);

    await rescheduleAll(fakeDb, { now });

    expect(bodyForDate(D)).toContain('물통');
    expect(bodyForDate(D1)).toContain('물통');
  });

  test('is_done is IGNORED — a frozen is_done=true item still shows when not in completion log', async () => {
    mockState.fakeSchedules = [makeSchedule({ id: 1 })];
    mockState.fakeChecklistBySchedule.set(1, [
      // Legacy frozen flag set true, but no completion row → must still appear.
      makeChecklistItem({
        id: 400,
        label: '레거시',
        isDone: true,
        doneAt: 123,
        occurrenceDate: null,
      }),
    ]);

    await rescheduleAll(fakeDb, { now });

    expect(bodyForDate(D)).toContain('레거시');
  });

  test('mixed: recurring-completed-on-D + recurring-pending coexist correctly', async () => {
    mockState.fakeSchedules = [makeSchedule({ id: 1 })];
    mockState.fakeChecklistBySchedule.set(1, [
      makeChecklistItem({ id: 500, label: '교재', occurrenceDate: null }),
      makeChecklistItem({ id: 501, label: '필통', occurrenceDate: null }),
    ]);
    // Only 교재(500) completed for D.
    mockState.fakeCompletions = [
      { id: 1, checklistItemId: 500, occurrenceDate: ymd(D), completedAt: 1 },
    ];

    await rescheduleAll(fakeDb, { now });

    const bodyD = bodyForDate(D);
    expect(bodyD).not.toContain('교재');
    expect(bodyD).toContain('필통');
    // D+1: neither completed → both present.
    const bodyD1 = bodyForDate(D1);
    expect(bodyD1).toContain('교재');
    expect(bodyD1).toContain('필통');
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
