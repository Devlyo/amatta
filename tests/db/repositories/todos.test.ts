// Repository round-trip tests for the todos repo.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../../src/db/migrations';
import * as childrenRepo from '../../../src/db/repositories/children';
import * as todosRepo from '../../../src/db/repositories/todos';

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
  return resolve(dir, `todos-repo-${randomUUID()}.db`);
}

const NOW = 1717_286_400_000; // deterministic epoch ms

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('todosRepo', () => {
  let dbPath: string;
  let real: DatabaseSync;
  let db: MinimalDb;
  let childA: number;
  let childB: number;

  beforeEach(async () => {
    dbPath = tmpDbPath();
    real = new DatabaseSync(dbPath);
    db = wrap(real);
    await runMigrations(db as never);
    real.exec('PRAGMA foreign_keys = ON');

    childA = (await childrenRepo.create(db as never, { name: '민준', colorIndex: 0 })).id;
    childB = (await childrenRepo.create(db as never, { name: '서연', colorIndex: 2 })).id;
  });

  afterEach(() => {
    try { real.close(); } catch { /* already closed */ }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('CRUD round-trip: create → getById → update → remove', async () => {
    const created = await todosRepo.create(db as never, {
      childId: childA,
      title: '학교 알림장 확인',
      dueAt: NOW + 86_400_000,
      notifyMinutesBefore: 30,
    });
    expect(created.id).toBeGreaterThan(0);
    expect(created.childId).toBe(childA);
    expect(created.title).toBe('학교 알림장 확인');
    expect(created.dueAt).toBe(NOW + 86_400_000);
    expect(created.notifyMinutesBefore).toBe(30);
    expect(created.isDone).toBe(false);
    expect(created.doneAt).toBeNull();
    expect(created.createdAt).toBeGreaterThan(0);

    const fetched = await todosRepo.getById(db as never, created.id);
    expect(fetched).toEqual(created);

    const updated = await todosRepo.update(db as never, created.id, {
      title: '학교 알림장 (재확인)',
      notifyMinutesBefore: 60,
    });
    expect(updated.title).toBe('학교 알림장 (재확인)');
    expect(updated.notifyMinutesBefore).toBe(60);
    expect(updated.createdAt).toBe(created.createdAt);

    await todosRepo.remove(db as never, created.id);
    const after = await todosRepo.getById(db as never, created.id);
    expect(after).toBeNull();
  });

  test('listByChild(null) returns parent-level todos only', async () => {
    await todosRepo.create(db as never, {
      childId: null,
      title: '병원 예약',
      dueAt: NOW + 86_400_000,
    });
    await todosRepo.create(db as never, {
      childId: childA,
      title: '민준 준비물',
      dueAt: NOW + 86_400_000,
    });
    await todosRepo.create(db as never, {
      childId: childB,
      title: '서연 준비물',
      dueAt: NOW + 172_800_000,
    });

    const parentLevel = await todosRepo.listByChild(db as never, null);
    expect(parentLevel).toHaveLength(1);
    expect(parentLevel[0]?.title).toBe('병원 예약');

    const childATodos = await todosRepo.listByChild(db as never, childA);
    expect(childATodos).toHaveLength(1);
    expect(childATodos[0]?.title).toBe('민준 준비물');
  });

  test('listUndone() filters out done todos and orders by due_at ASC', async () => {
    const a = await todosRepo.create(db as never, {
      childId: null, title: 'A', dueAt: NOW + 3 * 86_400_000,
    });
    const b = await todosRepo.create(db as never, {
      childId: null, title: 'B', dueAt: NOW + 1 * 86_400_000,
    });
    const c = await todosRepo.create(db as never, {
      childId: null, title: 'C', dueAt: NOW + 2 * 86_400_000,
    });

    // Mark `c` done
    await todosRepo.toggleDone(db as never, c.id, NOW);

    const undone = await todosRepo.listUndone(db as never);
    expect(undone.map((t) => t.id)).toEqual([b.id, a.id]);
  });

  test('cascade: deleting child sets todos.child_id to NULL (SET NULL, not CASCADE)', async () => {
    const todo = await todosRepo.create(db as never, {
      childId: childA,
      title: '민준 todo',
      dueAt: NOW + 86_400_000,
    });
    expect(todo.childId).toBe(childA);

    await childrenRepo.remove(db as never, childA);

    const after = await todosRepo.getById(db as never, todo.id);
    expect(after).not.toBeNull();
    expect(after?.childId).toBeNull();
  });

  test('title length CHECK violation: >120 chars throws', async () => {
    const longTitle = 'a'.repeat(121);
    await expect(
      todosRepo.create(db as never, {
        childId: null,
        title: longTitle,
        dueAt: NOW,
      }),
    ).rejects.toThrow();
  });

  test('toggleDone() flips is_done and sets/clears done_at', async () => {
    const t = await todosRepo.create(db as never, {
      childId: null,
      title: '병원 예약',
      dueAt: NOW + 86_400_000,
    });
    expect(t.isDone).toBe(false);
    expect(t.doneAt).toBeNull();

    const doneAt = NOW + 1000;
    const toggled = await todosRepo.toggleDone(db as never, t.id, doneAt);
    expect(toggled.isDone).toBe(true);
    expect(toggled.doneAt).toBe(doneAt);

    const untoggled = await todosRepo.toggleDone(db as never, t.id, doneAt + 1);
    expect(untoggled.isDone).toBe(false);
    expect(untoggled.doneAt).toBeNull();
  });

  test('list() returns all todos ordered by due_at ASC', async () => {
    const a = await todosRepo.create(db as never, {
      childId: null, title: 'far', dueAt: NOW + 7 * 86_400_000,
    });
    const b = await todosRepo.create(db as never, {
      childId: null, title: 'soon', dueAt: NOW + 1 * 86_400_000,
    });
    const c = await todosRepo.create(db as never, {
      childId: null, title: 'mid', dueAt: NOW + 3 * 86_400_000,
    });
    const all = await todosRepo.list(db as never);
    expect(all.map((t) => t.id)).toEqual([b.id, c.id, a.id]);
  });
});
