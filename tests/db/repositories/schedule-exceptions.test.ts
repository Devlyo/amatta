// Repository round-trip tests for the schedule-exceptions repo.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../../src/db/migrations';
import * as childrenRepo from '../../../src/db/repositories/children';
import * as schedulesRepo from '../../../src/db/repositories/schedules';
import * as exceptionsRepo from '../../../src/db/repositories/schedule-exceptions';
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
  return resolve(dir, `exceptions-repo-${randomUUID()}.db`);
}

const VALID_FROM = '2026-01-01' as ISODate;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('exceptionsRepo', () => {
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

    // Create parent child and schedule
    const child = await childrenRepo.create(db as never, { name: '테스트자녀', colorIndex: 0 });
    const schedule = await schedulesRepo.create(db as never, {
      childId: child.id,
      title: '피아노',
      type: 'activity',
      location: null,
      notes: null,
      daysOfWeek: 0b01010, // Tue+Thu
      startMinutes: 1020,
      endMinutes: 1080,
      validFrom: VALID_FROM,
      validUntil: null,
      notifyMinutesBefore: null,
    });
    scheduleId = schedule.id;
  });

  afterEach(() => {
    try { real.close(); } catch { /* already closed */ }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('list() returns empty array on fresh DB', async () => {
    const result = await exceptionsRepo.list(db as never);
    expect(result).toEqual([]);
  });

  test('create() inserts a cancel exception and returns it', async () => {
    const ex = await exceptionsRepo.create(db as never, {
      scheduleId,
      date: '2026-06-04' as ISODate,
      kind: 'cancel',
      overrideStartMinutes: null,
      overrideEndMinutes: null,
      overrideTitle: null,
    });
    expect(ex.id).toBeGreaterThan(0);
    expect(ex.scheduleId).toBe(scheduleId);
    expect(ex.date).toBe('2026-06-04');
    expect(ex.kind).toBe('cancel');
    expect(ex.overrideStartMinutes).toBeNull();
    expect(ex.overrideEndMinutes).toBeNull();
    expect(ex.overrideTitle).toBeNull();
  });

  test('create() inserts a modify exception with override fields', async () => {
    const ex = await exceptionsRepo.create(db as never, {
      scheduleId,
      date: '2026-06-10' as ISODate,
      kind: 'modify',
      overrideStartMinutes: 1080,
      overrideEndMinutes: 1140,
      overrideTitle: '피아노(변경)',
    });
    expect(ex.kind).toBe('modify');
    expect(ex.overrideStartMinutes).toBe(1080);
    expect(ex.overrideEndMinutes).toBe(1140);
    expect(ex.overrideTitle).toBe('피아노(변경)');
  });

  test('getById() returns null for non-existent id', async () => {
    const result = await exceptionsRepo.getById(db as never, 999);
    expect(result).toBeNull();
  });

  test('getById() returns the exception after create()', async () => {
    const created = await exceptionsRepo.create(db as never, {
      scheduleId,
      date: '2026-06-04' as ISODate,
      kind: 'cancel',
      overrideStartMinutes: null,
      overrideEndMinutes: null,
      overrideTitle: null,
    });
    const fetched = await exceptionsRepo.getById(db as never, created.id);
    expect(fetched).toEqual(created);
  });

  test('update() mutates kind and override fields', async () => {
    const created = await exceptionsRepo.create(db as never, {
      scheduleId,
      date: '2026-06-04' as ISODate,
      kind: 'cancel',
      overrideStartMinutes: null,
      overrideEndMinutes: null,
      overrideTitle: null,
    });
    const updated = await exceptionsRepo.update(db as never, created.id, {
      kind: 'modify',
      overrideTitle: '변경됨',
    });
    expect(updated.kind).toBe('modify');
    expect(updated.overrideTitle).toBe('변경됨');
    expect(updated.id).toBe(created.id);
  });

  test('remove() deletes the exception', async () => {
    const created = await exceptionsRepo.create(db as never, {
      scheduleId,
      date: '2026-06-04' as ISODate,
      kind: 'cancel',
      overrideStartMinutes: null,
      overrideEndMinutes: null,
      overrideTitle: null,
    });
    await exceptionsRepo.remove(db as never, created.id);
    const fetched = await exceptionsRepo.getById(db as never, created.id);
    expect(fetched).toBeNull();
  });

  test('UNIQUE(schedule_id, date) — duplicate throws', async () => {
    await exceptionsRepo.create(db as never, {
      scheduleId,
      date: '2026-06-04' as ISODate,
      kind: 'cancel',
      overrideStartMinutes: null,
      overrideEndMinutes: null,
      overrideTitle: null,
    });
    await expect(
      exceptionsRepo.create(db as never, {
        scheduleId,
        date: '2026-06-04' as ISODate,
        kind: 'modify',
        overrideStartMinutes: null,
        overrideEndMinutes: null,
        overrideTitle: null,
      }),
    ).rejects.toThrow();
  });

  test('update() covers all fields: scheduleId, date, overrideStartMinutes, overrideEndMinutes', async () => {
    // Create a second schedule to reassign scheduleId to
    const child2 = await childrenRepo.create(db as never, { name: '두번째', colorIndex: 1 });
    const schedule2 = await schedulesRepo.create(db as never, {
      childId: child2.id, title: '수영', type: 'activity', location: null, notes: null,
      daysOfWeek: 32, startMinutes: 600, endMinutes: 660, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });

    const created = await exceptionsRepo.create(db as never, {
      scheduleId,
      date: '2026-06-04' as ISODate,
      kind: 'cancel',
      overrideStartMinutes: null,
      overrideEndMinutes: null,
      overrideTitle: null,
    });
    const updated = await exceptionsRepo.update(db as never, created.id, {
      scheduleId: schedule2.id,
      date: '2026-06-11' as ISODate,
      kind: 'modify',
      overrideStartMinutes: 620,
      overrideEndMinutes: 680,
      overrideTitle: '변경 수영',
    });
    expect(updated.scheduleId).toBe(schedule2.id);
    expect(updated.date).toBe('2026-06-11');
    expect(updated.kind).toBe('modify');
    expect(updated.overrideStartMinutes).toBe(620);
    expect(updated.overrideEndMinutes).toBe(680);
    expect(updated.overrideTitle).toBe('변경 수영');
  });

  test('listBySchedule() returns only exceptions for given schedule', async () => {
    // Create a second schedule to verify isolation
    const child2 = await childrenRepo.create(db as never, { name: '두번째', colorIndex: 1 });
    const schedule2 = await schedulesRepo.create(db as never, {
      childId: child2.id, title: '수영', type: 'activity', location: null, notes: null,
      daysOfWeek: 32, startMinutes: 600, endMinutes: 660, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });

    await exceptionsRepo.create(db as never, {
      scheduleId,
      date: '2026-06-04' as ISODate,
      kind: 'cancel',
      overrideStartMinutes: null, overrideEndMinutes: null, overrideTitle: null,
    });
    await exceptionsRepo.create(db as never, {
      scheduleId: schedule2.id,
      date: '2026-06-07' as ISODate,
      kind: 'cancel',
      overrideStartMinutes: null, overrideEndMinutes: null, overrideTitle: null,
    });

    const forSchedule1 = await exceptionsRepo.listBySchedule(db as never, scheduleId);
    expect(forSchedule1).toHaveLength(1);
    expect(forSchedule1[0]?.date).toBe('2026-06-04');
  });
});
