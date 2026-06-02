// Repository round-trip tests for the schedule_pickup_log repo.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../../src/db/migrations';
import * as childrenRepo from '../../../src/db/repositories/children';
import * as schedulesRepo from '../../../src/db/repositories/schedules';
import * as pickupLogRepo from '../../../src/db/repositories/schedule-pickup-log';
import type { ISODate } from '../../../src/domain/types';

// ---------------------------------------------------------------------------
// MinimalDb shim
// ---------------------------------------------------------------------------
interface MinimalDb {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  runAsync(sql: string, params?: unknown[]): Promise<{ lastInsertRowId: number; changes: number }>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}

function wrap(real: DatabaseSync): MinimalDb {
  return {
    async execAsync(sql) { real.exec(sql); },
    async getFirstAsync<T>(sql: string, params: unknown[] = []) {
      const row = real.prepare(sql).get(...(params as never[])) as unknown;
      return (row as T) ?? null;
    },
    async getAllAsync<T>(sql: string, params: unknown[] = []) {
      return real.prepare(sql).all(...(params as never[])) as T[];
    },
    async runAsync(sql, params = []) {
      const result = real.prepare(sql).run(...(params as never[]));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async withTransactionAsync(fn) {
      real.exec('BEGIN');
      try { await fn(); real.exec('COMMIT'); }
      catch (e) { real.exec('ROLLBACK'); throw e; }
    },
    async closeAsync() { real.close(); },
  };
}

function tmpDbPath(): string {
  const dir = resolve(tmpdir(), 'schedulapp-tests');
  mkdirSync(dir, { recursive: true });
  return resolve(dir, `pickup-log-repo-${randomUUID()}.db`);
}

const VALID_FROM = '2026-01-01' as ISODate;

async function createSchedule(
  db: MinimalDb,
  childId: number,
  title: string,
  needsPickup = true,
): Promise<number> {
  const s = await schedulesRepo.create(db as never, {
    childId,
    title,
    type: 'academy',
    location: null,
    notes: null,
    daysOfWeek: 0b0000010,
    startMinutes: 900,
    endMinutes: 960,
    validFrom: VALID_FROM,
    validUntil: null,
    notifyMinutesBefore: null,
    needsPickup,
  });
  return s.id;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('schedulePickupLogRepo', () => {
  let dbPath: string;
  let real: DatabaseSync;
  let db: MinimalDb;
  let scheduleId: number;

  beforeEach(async () => {
    dbPath = tmpDbPath();
    real = new DatabaseSync(dbPath);
    db = wrap(real);
    await runMigrations(db as never);
    real.exec('PRAGMA foreign_keys = ON');

    const child = await childrenRepo.create(db as never, { name: '민준', colorIndex: 0 });
    scheduleId = await createSchedule(db, child.id, '수영');
  });

  afterEach(() => {
    try { real.close(); } catch { /* already closed */ }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('markComplete() inserts a row and returns it', async () => {
    const completedAt = 1717_000_000_000;
    const log = await pickupLogRepo.markComplete(db as never, {
      scheduleId,
      occurrenceDate: 20260602,
      completedAt,
    });
    expect(log.id).toBeGreaterThan(0);
    expect(log.scheduleId).toBe(scheduleId);
    expect(log.occurrenceDate).toBe(20260602);
    expect(log.completedAt).toBe(completedAt);
  });

  test('double markComplete() is a no-op (UNIQUE collision via INSERT OR IGNORE)', async () => {
    const first = await pickupLogRepo.markComplete(db as never, {
      scheduleId,
      occurrenceDate: 20260602,
      completedAt: 1717_000_000_000,
    });
    // Second insert with same (schedule_id, occurrence_date) but different completed_at
    const second = await pickupLogRepo.markComplete(db as never, {
      scheduleId,
      occurrenceDate: 20260602,
      completedAt: 1717_000_000_999,
    });
    // Returns the original row (UNIQUE collision ignored, completed_at unchanged)
    expect(second.id).toBe(first.id);
    expect(second.completedAt).toBe(first.completedAt);

    const total = real.prepare('SELECT COUNT(*) AS c FROM schedule_pickup_log').get() as { c: number };
    expect(total.c).toBe(1);
  });

  test('clearComplete() removes the matching row', async () => {
    await pickupLogRepo.markComplete(db as never, {
      scheduleId,
      occurrenceDate: 20260602,
      completedAt: 1717_000_000_000,
    });
    expect(await pickupLogRepo.isComplete(db as never, scheduleId, 20260602)).toBe(true);

    await pickupLogRepo.clearComplete(db as never, scheduleId, 20260602);
    expect(await pickupLogRepo.isComplete(db as never, scheduleId, 20260602)).toBe(false);
  });

  test('isComplete() returns false when no row exists', async () => {
    expect(await pickupLogRepo.isComplete(db as never, scheduleId, 20260602)).toBe(false);
  });

  test('listForSchedule() returns rows for the given schedule ordered by occurrence_date ASC', async () => {
    await pickupLogRepo.markComplete(db as never, {
      scheduleId, occurrenceDate: 20260610, completedAt: 1717_000_000_000,
    });
    await pickupLogRepo.markComplete(db as never, {
      scheduleId, occurrenceDate: 20260603, completedAt: 1717_000_000_000,
    });
    await pickupLogRepo.markComplete(db as never, {
      scheduleId, occurrenceDate: 20260617, completedAt: 1717_000_000_000,
    });

    const rows = await pickupLogRepo.listForSchedule(db as never, scheduleId);
    expect(rows.map((r) => r.occurrenceDate)).toEqual([20260603, 20260610, 20260617]);
  });

  test('listForDate() returns rows across schedules for the given date', async () => {
    const child = await childrenRepo.list(db as never);
    const childId = child[0]?.id as number;
    const otherSchedule = await createSchedule(db, childId, '미술');

    await pickupLogRepo.markComplete(db as never, {
      scheduleId, occurrenceDate: 20260602, completedAt: 1717_000_000_000,
    });
    await pickupLogRepo.markComplete(db as never, {
      scheduleId: otherSchedule, occurrenceDate: 20260602, completedAt: 1717_000_000_001,
    });
    await pickupLogRepo.markComplete(db as never, {
      scheduleId, occurrenceDate: 20260603, completedAt: 1717_000_000_002,
    });

    const rows = await pickupLogRepo.listForDate(db as never, 20260602);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.scheduleId).sort((a, b) => a - b)).toEqual(
      [scheduleId, otherSchedule].sort((a, b) => a - b),
    );
  });

  test('cascade: deleting schedule removes its pickup_log rows', async () => {
    await pickupLogRepo.markComplete(db as never, {
      scheduleId, occurrenceDate: 20260602, completedAt: 1717_000_000_000,
    });
    await pickupLogRepo.markComplete(db as never, {
      scheduleId, occurrenceDate: 20260609, completedAt: 1717_000_000_000,
    });
    const before = real.prepare('SELECT COUNT(*) AS c FROM schedule_pickup_log').get() as { c: number };
    expect(before.c).toBe(2);

    await schedulesRepo.remove(db as never, scheduleId);

    const after = real.prepare('SELECT COUNT(*) AS c FROM schedule_pickup_log').get() as { c: number };
    expect(after.c).toBe(0);
  });
});
