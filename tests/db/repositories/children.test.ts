// Repository round-trip tests for the children repo.
// expo-sqlite is a native module not usable under jest-expo, so we wrap
// node:sqlite's DatabaseSync to expose the slice of SQLiteDatabase that
// the repositories use (runAsync, getAllAsync, getFirstAsync, execAsync,
// withTransactionAsync).

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../../src/db/migrations';
import * as childrenRepo from '../../../src/db/repositories/children';
import { ChildCapError } from '../../../src/db/repositories/children';

// ---------------------------------------------------------------------------
// MinimalDb shim (node:sqlite → expo-sqlite shape)
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
    async execAsync(sql) {
      real.exec(sql);
    },
    async getFirstAsync<T>(sql: string, params: unknown[] = []) {
      const row = real.prepare(sql).get(...(params as never[])) as unknown;
      return (row as T) ?? null;
    },
    async getAllAsync<T>(sql: string, params: unknown[] = []) {
      const rows = real.prepare(sql).all(...(params as never[])) as unknown[];
      return rows as T[];
    },
    async runAsync(sql, params = []) {
      const result = real.prepare(sql).run(...(params as never[]));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    async withTransactionAsync(fn) {
      real.exec('BEGIN');
      try {
        await fn();
        real.exec('COMMIT');
      } catch (e) {
        real.exec('ROLLBACK');
        throw e;
      }
    },
    async closeAsync() {
      real.close();
    },
  };
}

function tmpDbPath(): string {
  const dir = resolve(tmpdir(), 'schedulapp-tests');
  mkdirSync(dir, { recursive: true });
  return resolve(dir, `children-repo-${randomUUID()}.db`);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('childrenRepo', () => {
  let dbPath: string;
  let real: DatabaseSync;
  let db: MinimalDb;

  beforeEach(async () => {
    dbPath = tmpDbPath();
    real = new DatabaseSync(dbPath);
    db = wrap(real);
    await runMigrations(db as never);
    // Enable FK enforcement in test DB
    real.exec('PRAGMA foreign_keys = ON');
  });

  afterEach(() => {
    try { real.close(); } catch { /* already closed */ }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('list() returns empty array on fresh DB', async () => {
    const result = await childrenRepo.list(db as never);
    expect(result).toEqual([]);
  });

  test('create() inserts a child and returns it with id + createdAt', async () => {
    const child = await childrenRepo.create(db as never, { name: '민준', colorIndex: 0 });
    expect(child.id).toBeGreaterThan(0);
    expect(child.name).toBe('민준');
    expect(child.colorIndex).toBe(0);
    expect(child.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('getById() returns null for non-existent id', async () => {
    const result = await childrenRepo.getById(db as never, 999);
    expect(result).toBeNull();
  });

  test('getById() returns the child after create()', async () => {
    const created = await childrenRepo.create(db as never, { name: '서연', colorIndex: 2 });
    const fetched = await childrenRepo.getById(db as never, created.id);
    expect(fetched).toEqual(created);
  });

  test('list() returns all children ordered by id ASC', async () => {
    const a = await childrenRepo.create(db as never, { name: '민준', colorIndex: 0 });
    const b = await childrenRepo.create(db as never, { name: '서연', colorIndex: 2 });
    const c = await childrenRepo.create(db as never, { name: '도윤', colorIndex: 4 });
    const children = await childrenRepo.list(db as never);
    expect(children.map((ch) => ch.id)).toEqual([a.id, b.id, c.id]);
  });

  test('update() mutates name and colorIndex', async () => {
    const created = await childrenRepo.create(db as never, { name: '민준', colorIndex: 0 });
    const updated = await childrenRepo.update(db as never, created.id, { name: '준서', colorIndex: 3 });
    expect(updated.name).toBe('준서');
    expect(updated.colorIndex).toBe(3);
    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
  });

  test('update() with empty patch returns child unchanged', async () => {
    const created = await childrenRepo.create(db as never, { name: '민준', colorIndex: 0 });
    const updated = await childrenRepo.update(db as never, created.id, {});
    expect(updated).toEqual(created);
  });

  test('remove() deletes the child', async () => {
    const created = await childrenRepo.create(db as never, { name: '민준', colorIndex: 0 });
    await childrenRepo.remove(db as never, created.id);
    const fetched = await childrenRepo.getById(db as never, created.id);
    expect(fetched).toBeNull();
  });

  test('4-child cap: create() succeeds for 4 children', async () => {
    for (let i = 0; i < 4; i++) {
      await childrenRepo.create(db as never, { name: `자녀${i}`, colorIndex: (i % 6) as childrenRepo.NewChild['colorIndex'] });
    }
    const all = await childrenRepo.list(db as never);
    expect(all).toHaveLength(4);
  });

  test('4-child cap: create() throws ChildCapError when adding a 5th child', async () => {
    for (let i = 0; i < 4; i++) {
      await childrenRepo.create(db as never, { name: `자녀${i}`, colorIndex: 0 });
    }
    await expect(
      childrenRepo.create(db as never, { name: '5번째', colorIndex: 0 }),
    ).rejects.toBeInstanceOf(ChildCapError);
  });

  test('ChildCapError has code CHILD_CAP_EXCEEDED', async () => {
    for (let i = 0; i < 4; i++) {
      await childrenRepo.create(db as never, { name: `자녀${i}`, colorIndex: 0 });
    }
    try {
      await childrenRepo.create(db as never, { name: '5번째', colorIndex: 0 });
      fail('expected ChildCapError');
    } catch (e) {
      expect(e).toBeInstanceOf(ChildCapError);
      expect((e as ChildCapError).code).toBe('CHILD_CAP_EXCEEDED');
    }
  });
});
