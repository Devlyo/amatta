// Local push scheduler — reconciliation-first model
// (Architect S3 / Critic C7 fix in .omc/plans/ralplan-schedul-app-v2.md §Phase 5).
//
// INVARIANTS — DO NOT VIOLATE
//
//   1. The OS scheduled-notifications queue is a derived projection of
//      `schedules`, `schedule_exceptions`, `todos`, `checklist_items`,
//      and `notification_settings`. SQLite is the only source of truth.
//
//   2. `sessionMap` is an in-memory cache only. It is NEVER read from
//      AsyncStorage. It is NEVER written to AsyncStorage. It is rebuilt
//      every cold start by `rescheduleAll()`. A grep test in
//      tests/notifications/scheduler.test.ts asserts there is no
//      AsyncStorage.setItem referencing the notification map.
//
//   3. `rescheduleAll()` is the only path that guarantees consistency.
//      It ALWAYS starts with `Notifications.cancelAllScheduledNotificationsAsync()`,
//      which eliminates orphan triggers from any prior crash mid-delete,
//      prior version's bugs, or AsyncStorage drift.
//
//   4. Horizon is N rolling days from `today()` (default 14). Triggers in
//      the past are skipped. The horizon means we deliberately do NOT
//      attempt to cover the iOS 64-trigger cap by reaching further into
//      the future — re-fire is owned by the AppState=active hook in
//      app/_layout.tsx.

import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { expandOccurrences } from '../domain/occurrences';
import type {
  ChecklistItem,
  Child,
  ISODate,
  Schedule,
  ScheduleException,
  Todo,
} from '../domain/types';
import {
  childrenRepo,
  checklistItemsRepo,
  exceptionsRepo,
  schedulesRepo,
  todosRepo,
} from '../db/repositories';
import { shiftIsoDate, todayIso } from '../ui/utils/date';
import { useNotifSettingsStore } from '../state/notif-settings-store';
import {
  formatScheduleNotification,
  formatTodoNotification,
} from './body';

/** Default rolling horizon in days. */
export const DEFAULT_HORIZON_DAYS = 14;

/**
 * Max pending triggers we schedule per reconcile. iOS silently caps the
 * pending-notification queue at 64; we stay safely under it so the SOONEST
 * triggers are always armed (4-kid density can produce ~280/14d). When the
 * candidate set exceeds this, we keep only the `MAX_SCHEDULED` soonest and
 * flag the truncation on the notif store.
 */
export const MAX_SCHEDULED = 60;

/**
 * A single not-yet-scheduled notification, carrying its absolute fire time
 * so the full candidate set can be sorted soonest-first before we commit
 * the bounded subset to the OS queue.
 */
interface Candidate {
  /** Owner key for the sessionMap (e.g. `s:12` / `t:3`). */
  ownerKey: string;
  fireAtMs: number;
  request: {
    content: { title: string; body: string; sound: 'default' };
    trigger: {
      type: typeof Notifications.SchedulableTriggerInputTypes.DATE;
      date: Date;
    };
  };
}

/**
 * PER-SESSION CACHE. Maps a scheduleId/todoId to the notification ids it
 * owns in the current OS queue. Cleared on cold start and on every
 * `rescheduleAll()`. We expose `__sessionMapSize()` for the test harness.
 */
const sessionMap = new Map<string, string[]>();

function keyForSchedule(scheduleId: number): string {
  return `s:${scheduleId}`;
}
function keyForTodo(todoId: number): string {
  return `t:${todoId}`;
}

/**
 * For a single Schedule, BUILD (do not schedule) every candidate trigger
 * that falls inside the horizon and whose firing time is in the future.
 * Scheduling happens later in rescheduleAll after the global candidate set
 * is sorted soonest-first and truncated to the ≤60 cap.
 */
function candidatesForSchedule(input: {
  schedule: Schedule;
  exceptions: readonly ScheduleException[];
  childrenById: Map<number, Child>;
  checklistByScheduleId: Map<number, ChecklistItem[]>;
  horizonDays: number;
  now: Date;
}): Candidate[] {
  const {
    schedule,
    exceptions,
    childrenById,
    checklistByScheduleId,
    horizonDays,
    now,
  } = input;

  if (schedule.notifyMinutesBefore === null) return [];

  const child = childrenById.get(schedule.childId);
  if (child === undefined) return []; // orphan row — defer to cleanup.

  const from = todayIso();
  const to = shiftIsoDate(from, horizonDays);

  const occurrences = expandOccurrences(
    [schedule],
    Array.from(exceptions),
    { from, to },
    childrenById,
  );

  const checklist = checklistByScheduleId.get(schedule.id) ?? [];
  const ownerKey = keyForSchedule(schedule.id);
  const candidates: Candidate[] = [];

  for (const occ of occurrences) {
    const fireAt = subtractMinutes(
      localDateTime(occ.date, occ.startMinutes),
      schedule.notifyMinutesBefore,
    );
    if (fireAt.getTime() <= now.getTime()) continue;

    const { title, body } = formatScheduleNotification({
      schedule,
      startMinutes: occ.startMinutes,
      endMinutes: occ.endMinutes,
      kidName: child.name,
      checklist,
    });

    candidates.push({
      ownerKey,
      fireAtMs: fireAt.getTime(),
      request: {
        content: { title, body, sound: 'default' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
        },
      },
    });
  }

  return candidates;
}

/**
 * For a single Todo, BUILD (do not schedule) its single candidate trigger
 * (dueAt - notifyMinutesBefore).
 */
function candidatesForTodo(input: {
  todo: Todo;
  childrenById: Map<number, Child>;
  now: Date;
}): Candidate[] {
  const { todo, childrenById, now } = input;
  if (todo.notifyMinutesBefore === null) return [];
  if (todo.isDone) return [];

  const kidName =
    todo.childId === null ? null : childrenById.get(todo.childId)?.name ?? null;
  const fireAt = new Date(todo.dueAt - todo.notifyMinutesBefore * 60_000);
  if (fireAt.getTime() <= now.getTime()) return [];

  const { title, body } = formatTodoNotification({ todo, kidName });
  return [
    {
      ownerKey: keyForTodo(todo.id),
      fireAtMs: fireAt.getTime(),
      request: {
        content: { title, body, sound: 'default' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
        },
      },
    },
  ];
}

/**
 * SOURCE-OF-TRUTH RECONCILIATION.
 *
 * 1. Cancel every scheduled notification in the OS queue (always first).
 * 2. Clear sessionMap.
 * 3. Re-load DB state + re-schedule everything inside the horizon.
 *
 * Callers:
 *   - app/_layout.tsx cold-start path (always)
 *   - AppState 'active' debounced (≥ 60 min since last run)
 *   - any store mutation that affects scheduling (schedules / todos /
 *     checklist_items / schedule_exceptions / notification_settings)
 */
export async function rescheduleAll(
  db: SQLiteDatabase,
  opts: { horizonDays?: number; now?: Date } = {},
): Promise<void> {
  const horizonDays = opts.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const now = opts.now ?? new Date();

  // CRITICAL — wipe the OS queue first. See invariant 3. This MUST run on
  // every reschedule path, including the systemEnabled=false early return,
  // so turning notifications OFF immediately cancels everything pending.
  await Notifications.cancelAllScheduledNotificationsAsync();
  sessionMap.clear();

  // P3.4 — systemEnabled gates scheduling. When OFF: cancel (above) and
  // schedule NOTHING. The store is hydrated from app_settings during boot
  // before this runs, so getState() reflects the persisted preference.
  const notifStore = useNotifSettingsStore.getState();
  if (!notifStore.systemEnabled) {
    notifStore.setScheduleResult({ truncated: false, scheduledCount: 0 });
    return;
  }

  const [children, schedules, allExceptions, allTodos] = await Promise.all([
    childrenRepo.list(db),
    schedulesRepo.list(db),
    exceptionsRepo.list(db),
    todosRepo.list(db),
  ]);
  const childrenById = new Map<number, Child>();
  for (const c of children) childrenById.set(c.id, c);

  // Group exceptions by scheduleId.
  const exceptionsByScheduleId = new Map<number, ScheduleException[]>();
  for (const ex of allExceptions) {
    const list = exceptionsByScheduleId.get(ex.scheduleId);
    if (list === undefined) exceptionsByScheduleId.set(ex.scheduleId, [ex]);
    else list.push(ex);
  }

  // Load checklist items per schedule.
  const checklistByScheduleId = new Map<number, ChecklistItem[]>();
  for (const s of schedules) {
    const items = await checklistItemsRepo.listBySchedule(db, s.id);
    checklistByScheduleId.set(s.id, items);
  }

  // P3.2 — collect ALL candidate triggers (schedules + todos) WITHOUT
  // scheduling inline, sort soonest-first, then truncate to MAX_SCHEDULED.
  // This guarantees the soonest triggers win the limited iOS slots instead
  // of the OS silently dropping whatever overflows the 64-pending cap.
  const candidates: Candidate[] = [];
  for (const s of schedules) {
    candidates.push(
      ...candidatesForSchedule({
        schedule: s,
        exceptions: exceptionsByScheduleId.get(s.id) ?? [],
        childrenById,
        checklistByScheduleId,
        horizonDays,
        now,
      }),
    );
  }
  for (const t of allTodos) {
    candidates.push(...candidatesForTodo({ todo: t, childrenById, now }));
  }

  candidates.sort((a, b) => a.fireAtMs - b.fireAtMs);
  const truncated = candidates.length > MAX_SCHEDULED;
  const toSchedule = truncated ? candidates.slice(0, MAX_SCHEDULED) : candidates;

  for (const c of toSchedule) {
    const id = await Notifications.scheduleNotificationAsync(c.request);
    const existing = sessionMap.get(c.ownerKey);
    if (existing === undefined) sessionMap.set(c.ownerKey, [id]);
    else existing.push(id);
  }

  notifStore.setScheduleResult({
    truncated,
    scheduledCount: toSchedule.length,
  });
}

// ── Time helpers ──────────────────────────────────────────────────────

function localDateTime(date: ISODate, minutes: number): Date {
  const s = date as unknown as string;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const h = Math.floor(minutes / 60);
  const mn = minutes % 60;
  return new Date(y, m - 1, d, h, mn, 0, 0);
}

function subtractMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() - minutes * 60_000);
}

// ── Test-only inspection helpers ──────────────────────────────────────

/** Test-only: size of the in-memory session map (NOT persisted). */
export function __sessionMapSize(): number {
  return sessionMap.size;
}

/** Test-only: clear the session map (mirrors a cold start). */
export function __clearSessionMap(): void {
  sessionMap.clear();
}
