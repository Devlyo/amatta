// State store tests for useTodosStore.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../src/db/migrations';
import * as childrenRepo from '../../src/db/repositories/children';
import { useTodosStore } from '../../src/state/todos-store';

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
  return resolve(dir, `todos-store-${randomUUID()}.db`);
}

describe('useTodosStore', () => {
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

    const child = await childrenRepo.create(db as never, { name: '민준', colorIndex: 0 });
    childId = child.id;

    useTodosStore.setState({ todos: [], isLoaded: false });
  });

  afterEach(() => {
    try { real.close(); } catch { /* already closed */ }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('load() hydrates todos sorted by dueAt ASC, sets isLoaded=true', async () => {
    real.prepare(
      'INSERT INTO todos (child_id, title, due_at, created_at) VALUES (?, ?, ?, ?)',
    ).run(null, 'later', 2000, 1000);
    real.prepare(
      'INSERT INTO todos (child_id, title, due_at, created_at) VALUES (?, ?, ?, ?)',
    ).run(null, 'sooner', 1000, 1000);

    await useTodosStore.getState().load(db as never);

    const state = useTodosStore.getState();
    expect(state.isLoaded).toBe(true);
    expect(state.todos).toHaveLength(2);
    expect(state.todos[0]?.title).toBe('sooner');
    expect(state.todos[1]?.title).toBe('later');
  });

  test('add() inserts a todo and updates store', async () => {
    await useTodosStore.getState().load(db as never);
    const todo = await useTodosStore.getState().add(db as never, {
      childId: null,
      title: '병원 예약',
      dueAt: 5000,
    });

    expect(todo.id).toBeGreaterThan(0);
    expect(useTodosStore.getState().todos).toHaveLength(1);
    expect(useTodosStore.getState().todos[0]?.title).toBe('병원 예약');
  });

  test('updateOne() mutates title in store', async () => {
    await useTodosStore.getState().load(db as never);
    const todo = await useTodosStore.getState().add(db as never, {
      childId,
      title: '원본',
      dueAt: 1000,
    });

    await useTodosStore.getState().updateOne(db as never, todo.id, { title: '수정됨' });

    const found = useTodosStore.getState().todos.find((t) => t.id === todo.id);
    expect(found?.title).toBe('수정됨');
  });

  test('removeOne() removes todo from store', async () => {
    await useTodosStore.getState().load(db as never);
    const todo = await useTodosStore.getState().add(db as never, {
      childId: null,
      title: '제거대상',
      dueAt: 1000,
    });
    expect(useTodosStore.getState().todos).toHaveLength(1);

    await useTodosStore.getState().removeOne(db as never, todo.id);
    expect(useTodosStore.getState().todos).toHaveLength(0);
  });

  test('toggleDone() flips isDone and stamps doneAt', async () => {
    await useTodosStore.getState().load(db as never);
    const todo = await useTodosStore.getState().add(db as never, {
      childId: null,
      title: '토글',
      dueAt: 1000,
    });

    await useTodosStore.getState().toggleDone(db as never, todo.id);
    let found = useTodosStore.getState().todos.find((t) => t.id === todo.id);
    expect(found?.isDone).toBe(true);
    expect(found?.doneAt).not.toBeNull();

    await useTodosStore.getState().toggleDone(db as never, todo.id);
    found = useTodosStore.getState().todos.find((t) => t.id === todo.id);
    expect(found?.isDone).toBe(false);
    expect(found?.doneAt).toBeNull();
  });
});
