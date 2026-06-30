// Repository round-trip tests for the checklist_completion repo (v6 / PREP-RECUR).
// Mirrors schedule-pickup-log.test.ts: per-occurrence completion keyed by
// (checklist_item_id, occurrence_date) where occurrence_date is a yyyymmdd int.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../../src/db/migrations';
import * as childrenRepo from '../../../src/db/repositories/children';
import * as schedulesRepo from '../../../src/db/repositories/schedules';
import * as checklistItemsRepo from '../../../src/db/repositories/checklist-items';
import * as completionRepo from '../../../src/db/repositories/checklist-completion';
import type { ISODate } from '../../../src/domain/types';

// ---------------------------------------------------------------------------
// MinimalDb shim (identical to schedule-pickup-log.test.ts)
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
  return resolve(dir, `checklist-completion-repo-${randomUUID()}.db`);
}

const VALID_FROM = '2026-01-01' as ISODate;

async function createSchedule(db: MinimalDb, childId: number, title: string): Promise<number> {
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
    needsPickup: false,
  });
  return s.id;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('checklistCompletionRepo', () => {
  let dbPath: string;
  let real: DatabaseSync;
  let db: MinimalDb;
  let itemId: number;

  beforeEach(async () => {
    dbPath = tmpDbPath();
    real = new DatabaseSync(dbPath);
    db = wrap(real);
    await runMigrations(db as never);
    real.exec('PRAGMA foreign_keys = ON');

    const child = await childrenRepo.create(db as never, { name: '민준', colorIndex: 0 });
    const scheduleId = await createSchedule(db, child.id, '수영');
    const item = await checklistItemsRepo.create(db as never, { scheduleId, label: '수영복' });
    itemId = item.id;
  });

  afterEach(() => {
    try { real.close(); } catch { /* already closed */ }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('markComplete() inserts a row and returns it', async () => {
    const completedAt = 1717_000_000_000;
    const log = await completionRepo.markComplete(db as never, {
      checklistItemId: itemId,
      occurrenceDate: 20260602,
      completedAt,
    });
    expect(log.id).toBeGreaterThan(0);
    expect(log.checklistItemId).toBe(itemId);
    expect(log.occurrenceDate).toBe(20260602);
    expect(log.completedAt).toBe(completedAt);
  });

  test('double markComplete() is a no-op (UNIQUE collision via INSERT OR IGNORE)', async () => {
    const first = await completionRepo.markComplete(db as never, {
      checklistItemId: itemId, occurrenceDate: 20260602, completedAt: 1717_000_000_000,
    });
    const second = await completionRepo.markComplete(db as never, {
      checklistItemId: itemId, occurrenceDate: 20260602, completedAt: 1717_000_000_999,
    });
    // Returns the original row (UNIQUE collision ignored, completed_at unchanged).
    expect(second.id).toBe(first.id);
    expect(second.completedAt).toBe(first.completedAt);

    const total = real.prepare('SELECT COUNT(*) AS c FROM checklist_completion').get() as { c: number };
    expect(total.c).toBe(1);
  });

  test('clearComplete() removes the matching row', async () => {
    await completionRepo.markComplete(db as never, {
      checklistItemId: itemId, occurrenceDate: 20260602, completedAt: 1717_000_000_000,
    });
    expect(await completionRepo.isComplete(db as never, itemId, 20260602)).toBe(true);

    await completionRepo.clearComplete(db as never, itemId, 20260602);
    expect(await completionRepo.isComplete(db as never, itemId, 20260602)).toBe(false);
  });

  test('isComplete() returns false when no row exists', async () => {
    expect(await completionRepo.isComplete(db as never, itemId, 20260602)).toBe(false);
  });

  test('per-occurrence isolation: checking day D leaves day D+1 unchecked', async () => {
    await completionRepo.markComplete(db as never, {
      checklistItemId: itemId, occurrenceDate: 20260602, completedAt: 1717_000_000_000,
    });
    // Same item, next day — must remain unchecked.
    expect(await completionRepo.isComplete(db as never, itemId, 20260602)).toBe(true);
    expect(await completionRepo.isComplete(db as never, itemId, 20260603)).toBe(false);
  });

  test('listForDate() scopes to the given occurrence_date across items', async () => {
    const child = (await childrenRepo.list(db as never))[0];
    const otherSchedule = await createSchedule(db, child!.id, '미술');
    const otherItem = await checklistItemsRepo.create(db as never, {
      scheduleId: otherSchedule, label: '크레파스',
    });

    await completionRepo.markComplete(db as never, {
      checklistItemId: itemId, occurrenceDate: 20260602, completedAt: 1717_000_000_000,
    });
    await completionRepo.markComplete(db as never, {
      checklistItemId: otherItem.id, occurrenceDate: 20260602, completedAt: 1717_000_000_001,
    });
    // Same item, different date — must NOT appear in the 20260602 listing.
    await completionRepo.markComplete(db as never, {
      checklistItemId: itemId, occurrenceDate: 20260603, completedAt: 1717_000_000_002,
    });

    const rows = await completionRepo.listForDate(db as never, 20260602);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.checklistItemId).sort((a, b) => a - b)).toEqual(
      [itemId, otherItem.id].sort((a, b) => a - b),
    );
  });

  test('cascade: deleting checklist_item removes its completion rows', async () => {
    await completionRepo.markComplete(db as never, {
      checklistItemId: itemId, occurrenceDate: 20260602, completedAt: 1717_000_000_000,
    });
    await completionRepo.markComplete(db as never, {
      checklistItemId: itemId, occurrenceDate: 20260609, completedAt: 1717_000_000_000,
    });
    const before = real.prepare('SELECT COUNT(*) AS c FROM checklist_completion').get() as { c: number };
    expect(before.c).toBe(2);

    await checklistItemsRepo.remove(db as never, itemId);

    const after = real.prepare('SELECT COUNT(*) AS c FROM checklist_completion').get() as { c: number };
    expect(after.c).toBe(0);
  });
});
