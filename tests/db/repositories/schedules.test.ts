// Repository round-trip tests for the schedules repo.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../../src/db/migrations';
import * as childrenRepo from '../../../src/db/repositories/children';
import * as schedulesRepo from '../../../src/db/repositories/schedules';
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
  return resolve(dir, `schedules-repo-${randomUUID()}.db`);
}

const VALID_FROM = '2026-01-01' as ISODate;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('schedulesRepo', () => {
  let dbPath: string;
  let real: DatabaseSync;
  let db: MinimalDb;
  let childId: number;

  beforeEach(async () => {
    dbPath = tmpDbPath();
    real = new DatabaseSync(dbPath);
    db = wrap(real);
    await runMigrations(db as never);
    real.exec('PRAGMA foreign_keys = ON');

    // Create a parent child for all schedule tests
    const child = await childrenRepo.create(db as never, { name: '테스트자녀', colorIndex: 0 });
    childId = child.id;
  });

  afterEach(() => {
    try { real.close(); } catch { /* already closed */ }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('list() returns empty array on fresh DB', async () => {
    const result = await schedulesRepo.list(db as never);
    expect(result).toEqual([]);
  });

  test('create() inserts a schedule and returns it with id', async () => {
    const schedule = await schedulesRepo.create(db as never, {
      childId,
      title: '학교',
      type: 'school',
      location: null,
      notes: null,
      daysOfWeek: 0b11111,
      startMinutes: 540,
      endMinutes: 870,
      validFrom: VALID_FROM,
      validUntil: null,
      notifyMinutesBefore: null,
    });
    expect(schedule.id).toBeGreaterThan(0);
    expect(schedule.childId).toBe(childId);
    expect(schedule.title).toBe('학교');
    expect(schedule.type).toBe('school');
    expect(schedule.startMinutes).toBe(540);
    expect(schedule.endMinutes).toBe(870);
    expect(schedule.validFrom).toBe(VALID_FROM);
    expect(schedule.validUntil).toBeNull();
    expect(schedule.notifyMinutesBefore).toBeNull();
  });

  test('getById() returns null for non-existent id', async () => {
    const result = await schedulesRepo.getById(db as never, 999);
    expect(result).toBeNull();
  });

  test('getById() returns the schedule after create()', async () => {
    const created = await schedulesRepo.create(db as never, {
      childId,
      title: '영어학원',
      type: 'academy',
      location: '강남',
      notes: '메모',
      daysOfWeek: 0b10101,
      startMinutes: 960,
      endMinutes: 1050,
      validFrom: VALID_FROM,
      validUntil: null,
      notifyMinutesBefore: 30,
    });
    const fetched = await schedulesRepo.getById(db as never, created.id);
    expect(fetched).toEqual(created);
  });

  test('list() returns all schedules ordered by id ASC', async () => {
    const a = await schedulesRepo.create(db as never, {
      childId, title: 'A', type: 'school', location: null, notes: null,
      daysOfWeek: 1, startMinutes: 540, endMinutes: 600, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });
    const b = await schedulesRepo.create(db as never, {
      childId, title: 'B', type: 'academy', location: null, notes: null,
      daysOfWeek: 2, startMinutes: 700, endMinutes: 760, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });
    const all = await schedulesRepo.list(db as never);
    expect(all.map((s) => s.id)).toEqual([a.id, b.id]);
  });

  test('update() mutates title and startMinutes', async () => {
    const created = await schedulesRepo.create(db as never, {
      childId, title: 'original', type: 'other', location: null, notes: null,
      daysOfWeek: 1, startMinutes: 540, endMinutes: 600, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });
    const updated = await schedulesRepo.update(db as never, created.id, {
      title: 'updated',
      startMinutes: 600,
    });
    expect(updated.title).toBe('updated');
    expect(updated.startMinutes).toBe(600);
    expect(updated.id).toBe(created.id);
  });

  test('update() with empty patch returns schedule unchanged', async () => {
    const created = await schedulesRepo.create(db as never, {
      childId, title: 'test', type: 'activity', location: null, notes: null,
      daysOfWeek: 4, startMinutes: 1020, endMinutes: 1080, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });
    const updated = await schedulesRepo.update(db as never, created.id, {});
    expect(updated).toEqual(created);
  });

  test('remove() deletes the schedule', async () => {
    const created = await schedulesRepo.create(db as never, {
      childId, title: 'to-delete', type: 'other', location: null, notes: null,
      daysOfWeek: 1, startMinutes: 540, endMinutes: 600, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });
    await schedulesRepo.remove(db as never, created.id);
    const fetched = await schedulesRepo.getById(db as never, created.id);
    expect(fetched).toBeNull();
  });

  test('cascade: deleting child removes its schedules', async () => {
    await schedulesRepo.create(db as never, {
      childId, title: '학교', type: 'school', location: null, notes: null,
      daysOfWeek: 0b11111, startMinutes: 540, endMinutes: 870, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });
    const before = await schedulesRepo.list(db as never);
    expect(before).toHaveLength(1);

    await childrenRepo.remove(db as never, childId);

    const after = await schedulesRepo.list(db as never);
    expect(after).toHaveLength(0);
  });

  test('cascade: deleting child removes its schedules AND their exceptions', async () => {
    const schedule = await schedulesRepo.create(db as never, {
      childId, title: '피아노', type: 'activity', location: null, notes: null,
      daysOfWeek: 0b01010, startMinutes: 1020, endMinutes: 1080, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });
    // Insert an exception manually
    real.prepare(
      'INSERT INTO schedule_exceptions (schedule_id, date, kind) VALUES (?, ?, ?)'
    ).run(schedule.id, '2026-06-04', 'cancel');

    const exCount = real.prepare('SELECT COUNT(*) AS c FROM schedule_exceptions').get() as { c: number };
    expect(exCount.c).toBe(1);

    await childrenRepo.remove(db as never, childId);

    const afterSched = real.prepare('SELECT COUNT(*) AS c FROM schedules').get() as { c: number };
    const afterEx = real.prepare('SELECT COUNT(*) AS c FROM schedule_exceptions').get() as { c: number };
    expect(afterSched.c).toBe(0);
    expect(afterEx.c).toBe(0);
  });

  test('update() covers all optional fields: type, location, notes, daysOfWeek, endMinutes, validFrom, validUntil, notifyMinutesBefore', async () => {
    const created = await schedulesRepo.create(db as never, {
      childId, title: 'all-fields', type: 'school', location: null, notes: null,
      daysOfWeek: 1, startMinutes: 540, endMinutes: 600, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });
    const child2 = await childrenRepo.create(db as never, { name: '두번째', colorIndex: 1 });
    const updated = await schedulesRepo.update(db as never, created.id, {
      childId: child2.id,
      type: 'academy',
      location: '강남',
      notes: '노트',
      daysOfWeek: 0b11111,
      endMinutes: 660,
      validFrom: '2026-02-01' as ISODate,
      validUntil: '2026-12-31' as ISODate,
      notifyMinutesBefore: 15,
    });
    expect(updated.childId).toBe(child2.id);
    expect(updated.type).toBe('academy');
    expect(updated.location).toBe('강남');
    expect(updated.notes).toBe('노트');
    expect(updated.daysOfWeek).toBe(0b11111);
    expect(updated.endMinutes).toBe(660);
    expect(updated.validFrom).toBe('2026-02-01');
    expect(updated.validUntil).toBe('2026-12-31');
    expect(updated.notifyMinutesBefore).toBe(15);
  });

  test('update() validUntil can be set to null', async () => {
    const created = await schedulesRepo.create(db as never, {
      childId, title: 'with-until', type: 'school', location: null, notes: null,
      daysOfWeek: 1, startMinutes: 540, endMinutes: 600, validFrom: VALID_FROM,
      validUntil: '2026-12-31' as ISODate, notifyMinutesBefore: null,
    });
    const updated = await schedulesRepo.update(db as never, created.id, {
      validUntil: null,
    });
    expect(updated.validUntil).toBeNull();
  });

  test('listByChild() returns only schedules for given child', async () => {
    const child2 = await childrenRepo.create(db as never, { name: '두번째', colorIndex: 1 });

    await schedulesRepo.create(db as never, {
      childId, title: '자녀1 일정', type: 'school', location: null, notes: null,
      daysOfWeek: 1, startMinutes: 540, endMinutes: 600, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });
    await schedulesRepo.create(db as never, {
      childId: child2.id, title: '자녀2 일정', type: 'academy', location: null, notes: null,
      daysOfWeek: 2, startMinutes: 700, endMinutes: 760, validFrom: VALID_FROM,
      validUntil: null, notifyMinutesBefore: null,
    });

    const forChild1 = await schedulesRepo.listByChild(db as never, childId);
    expect(forChild1).toHaveLength(1);
    expect(forChild1[0]?.title).toBe('자녀1 일정');
  });
});
