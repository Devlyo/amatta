// Repository round-trip tests for the checklist_items repo.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../../src/db/migrations';
import * as childrenRepo from '../../../src/db/repositories/children';
import * as schedulesRepo from '../../../src/db/repositories/schedules';
import * as checklistItemsRepo from '../../../src/db/repositories/checklist-items';
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
  return resolve(dir, `checklist-repo-${randomUUID()}.db`);
}

const VALID_FROM = '2026-01-01' as ISODate;

async function createSchedule(db: MinimalDb, childId: number): Promise<number> {
  const s = await schedulesRepo.create(db as never, {
    childId,
    title: '수영',
    type: 'activity',
    location: null,
    notes: null,
    daysOfWeek: 0b1000000,
    startMinutes: 900,
    endMinutes: 960,
    validFrom: VALID_FROM,
    validUntil: null,
    notifyMinutesBefore: null,
  });
  return s.id;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('checklistItemsRepo', () => {
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
    scheduleId = await createSchedule(db, child.id);
  });

  afterEach(() => {
    try { real.close(); } catch { /* already closed */ }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('CRUD round-trip: create → getById → update → remove', async () => {
    const created = await checklistItemsRepo.create(db as never, {
      scheduleId,
      label: '수영가방',
    });
    expect(created.id).toBeGreaterThan(0);
    expect(created.scheduleId).toBe(scheduleId);
    expect(created.label).toBe('수영가방');
    expect(created.sortOrder).toBe(0);
    expect(created.isDone).toBe(false);
    expect(created.doneAt).toBeNull();
    // v6: defaults to recurring membership (occurrence_date NULL).
    expect(created.occurrenceDate).toBeNull();

    const fetched = await checklistItemsRepo.getById(db as never, created.id);
    expect(fetched).toEqual(created);

    const updated = await checklistItemsRepo.update(db as never, created.id, {
      label: '수영가방 (큰 거)',
      sortOrder: 5,
    });
    expect(updated.label).toBe('수영가방 (큰 거)');
    expect(updated.sortOrder).toBe(5);

    await checklistItemsRepo.remove(db as never, created.id);
    const after = await checklistItemsRepo.getById(db as never, created.id);
    expect(after).toBeNull();
  });

  test('create() with occurrenceDate binds the item day-specific (v6)', async () => {
    const day = await checklistItemsRepo.create(db as never, {
      scheduleId,
      label: '오늘만',
      occurrenceDate: 20260602,
    });
    expect(day.occurrenceDate).toBe(20260602);

    // update() can flip membership recurring ↔ day-specific.
    const flipped = await checklistItemsRepo.update(db as never, day.id, {
      occurrenceDate: null,
    });
    expect(flipped.occurrenceDate).toBeNull();
  });

  test('listBySchedule() returns items ordered by sort_order ASC, id ASC', async () => {
    const a = await checklistItemsRepo.create(db as never, { scheduleId, label: 'A', sortOrder: 2 });
    const b = await checklistItemsRepo.create(db as never, { scheduleId, label: 'B', sortOrder: 0 });
    const c = await checklistItemsRepo.create(db as never, { scheduleId, label: 'C', sortOrder: 0 });
    const items = await checklistItemsRepo.listBySchedule(db as never, scheduleId);
    // sortOrder: B(0), C(0), A(2); within same sort_order id ASC → B, C, A
    expect(items.map((i) => i.id)).toEqual([b.id, c.id, a.id]);
  });

  test('cascade: deleting schedule removes its checklist_items', async () => {
    await checklistItemsRepo.create(db as never, { scheduleId, label: 'X' });
    await checklistItemsRepo.create(db as never, { scheduleId, label: 'Y' });
    const before = real.prepare('SELECT COUNT(*) AS c FROM checklist_items').get() as { c: number };
    expect(before.c).toBe(2);

    await schedulesRepo.remove(db as never, scheduleId);

    const after = real.prepare('SELECT COUNT(*) AS c FROM checklist_items').get() as { c: number };
    expect(after.c).toBe(0);
  });

  test('label length CHECK violation: >60 chars throws', async () => {
    const longLabel = 'a'.repeat(61);
    await expect(
      checklistItemsRepo.create(db as never, { scheduleId, label: longLabel }),
    ).rejects.toThrow();
  });

  test('toggleDone() flips is_done and sets done_at when becoming done', async () => {
    const item = await checklistItemsRepo.create(db as never, { scheduleId, label: '간식' });
    expect(item.isDone).toBe(false);

    const doneAt = 1717_000_000_000;
    const toggled = await checklistItemsRepo.toggleDone(db as never, item.id, doneAt);
    expect(toggled.isDone).toBe(true);
    expect(toggled.doneAt).toBe(doneAt);

    const untoggled = await checklistItemsRepo.toggleDone(db as never, item.id, doneAt + 1);
    expect(untoggled.isDone).toBe(false);
    expect(untoggled.doneAt).toBeNull();
  });

  test('reorder() updates sort_order according to position in array', async () => {
    const a = await checklistItemsRepo.create(db as never, { scheduleId, label: 'A', sortOrder: 0 });
    const b = await checklistItemsRepo.create(db as never, { scheduleId, label: 'B', sortOrder: 1 });
    const c = await checklistItemsRepo.create(db as never, { scheduleId, label: 'C', sortOrder: 2 });

    // Reverse the order
    await checklistItemsRepo.reorder(db as never, scheduleId, [c.id, b.id, a.id]);

    const items = await checklistItemsRepo.listBySchedule(db as never, scheduleId);
    expect(items.map((i) => i.id)).toEqual([c.id, b.id, a.id]);
    expect(items[0]?.sortOrder).toBe(0);
    expect(items[1]?.sortOrder).toBe(1);
    expect(items[2]?.sortOrder).toBe(2);
  });
});
