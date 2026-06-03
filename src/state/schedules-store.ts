import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { ISODate, Schedule, ScheduleException } from '../domain/types';
import { schedulesRepo, exceptionsRepo, type NewSchedule, type NewScheduleException } from '../db/repositories';
import { rescheduleAll } from '../notifications/scheduler';

// Fire-and-forget — every mutation in this store changes what the OS
// notification queue should hold, so we always reconcile via the
// cancelAll-first reschedule path. Errors are swallowed: the OS queue
// being a few seconds stale isn't worth blocking a user action over.
function reconcile(db: SQLiteDatabase): void {
  void rescheduleAll(db).catch((e) => {
    console.warn('[schedules-store] reconcile failed:', e);
  });
}

export type ExceptionOverrides =
  | { kind: 'cancel' }
  | {
      kind: 'modify';
      overrideStartMinutes?: number | null;
      overrideEndMinutes?: number | null;
      overrideTitle?: string | null;
    };

interface SchedulesState {
  schedules: Schedule[];
  exceptions: ScheduleException[];
  isLoaded: boolean;
  load: (db: SQLiteDatabase) => Promise<void>;
  addSchedule: (db: SQLiteDatabase, input: NewSchedule) => Promise<Schedule>;
  updateSchedule: (db: SQLiteDatabase, id: number, patch: Partial<Omit<Schedule, 'id'>>) => Promise<void>;
  removeSchedule: (db: SQLiteDatabase, id: number) => Promise<void>;
  addException: (db: SQLiteDatabase, input: NewScheduleException) => Promise<ScheduleException>;
  updateException: (db: SQLiteDatabase, id: number, patch: Partial<Omit<ScheduleException, 'id'>>) => Promise<void>;
  removeException: (db: SQLiteDatabase, id: number) => Promise<void>;
  /**
   * Idempotent upsert for a per-occurrence exception. Deletes any existing
   * row for `(scheduleId, date)` then inserts the new exception in a single
   * transaction. Required because the underlying `schedule_exceptions` table
   * has a `UNIQUE(schedule_id, date)` constraint and we deferred a true
   * `ON CONFLICT` UPSERT to v3 (Architect S4).
   */
  applyException: (
    db: SQLiteDatabase,
    scheduleId: number,
    date: ISODate,
    overrides: ExceptionOverrides,
  ) => Promise<void>;
}

async function loadBoth(db: SQLiteDatabase): Promise<{ schedules: Schedule[]; exceptions: ScheduleException[] }> {
  const [schedules, exceptions] = await Promise.all([
    schedulesRepo.list(db),
    exceptionsRepo.list(db),
  ]);
  return { schedules, exceptions };
}

export const useSchedulesStore = create<SchedulesState>()((set) => ({
  schedules: [],
  exceptions: [],
  isLoaded: false,

  load: async (db) => {
    const { schedules, exceptions } = await loadBoth(db);
    set({ schedules, exceptions, isLoaded: true });
  },

  addSchedule: async (db, input) => {
    const schedule = await schedulesRepo.create(db, input);
    const { schedules, exceptions } = await loadBoth(db);
    set({ schedules, exceptions });
    reconcile(db);
    return schedule;
  },

  updateSchedule: async (db, id, patch) => {
    await schedulesRepo.update(db, id, patch);
    const { schedules, exceptions } = await loadBoth(db);
    set({ schedules, exceptions });
    reconcile(db);
  },

  removeSchedule: async (db, id) => {
    await schedulesRepo.remove(db, id);
    const { schedules, exceptions } = await loadBoth(db);
    set({ schedules, exceptions });
    reconcile(db);
  },

  addException: async (db, input) => {
    const exception = await exceptionsRepo.create(db, input);
    const { schedules, exceptions } = await loadBoth(db);
    set({ schedules, exceptions });
    reconcile(db);
    return exception;
  },

  updateException: async (db, id, patch) => {
    await exceptionsRepo.update(db, id, patch);
    const { schedules, exceptions } = await loadBoth(db);
    set({ schedules, exceptions });
    reconcile(db);
  },

  removeException: async (db, id) => {
    await exceptionsRepo.remove(db, id);
    const { schedules, exceptions } = await loadBoth(db);
    set({ schedules, exceptions });
    reconcile(db);
  },

  applyException: async (db, scheduleId, date, overrides) => {
    // Delete-then-insert in a single transaction so the row count for
    // (scheduleId, date) stays exactly 1. UNIQUE(schedule_id, date) on the
    // table guarantees the SELECT returns at most one match — but we
    // delete-by-where to also handle any orphan rows from prior buggy paths.
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'DELETE FROM schedule_exceptions WHERE schedule_id = ? AND date = ?',
        [scheduleId, date as unknown as string],
      );
      if (overrides.kind === 'cancel') {
        await db.runAsync(
          `INSERT INTO schedule_exceptions
             (schedule_id, date, kind,
              override_start_minutes, override_end_minutes, override_title)
           VALUES (?, ?, 'cancel', NULL, NULL, NULL)`,
          [scheduleId, date as unknown as string],
        );
      } else {
        await db.runAsync(
          `INSERT INTO schedule_exceptions
             (schedule_id, date, kind,
              override_start_minutes, override_end_minutes, override_title)
           VALUES (?, ?, 'modify', ?, ?, ?)`,
          [
            scheduleId,
            date as unknown as string,
            overrides.overrideStartMinutes ?? null,
            overrides.overrideEndMinutes ?? null,
            overrides.overrideTitle ?? null,
          ],
        );
      }
    });
    const { schedules, exceptions } = await loadBoth(db);
    set({ schedules, exceptions });
    reconcile(db);
  },
}));
