// State store tests for useChildrenStore.
// Zustand stores are vanilla — we call .getState() directly without React.
// Uses the same node:sqlite MinimalDb shim as the repo tests.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../src/db/migrations';
import { useChildrenStore } from '../../src/state/children-store';

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
  return resolve(dir, `children-store-${randomUUID()}.db`);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('useChildrenStore', () => {
  let dbPath: string;
  let real: DatabaseSync;
  let db: MinimalDb;

  beforeEach(async () => {
    dbPath = tmpDbPath();
    real = new DatabaseSync(dbPath);
    db = wrap(real);
    await runMigrations(db as never);
    real.exec('PRAGMA foreign_keys = ON');

    // Reset store state between tests
    useChildrenStore.setState({ children: [], isLoaded: false });
  });

  afterEach(() => {
    try { real.close(); } catch { /* already closed */ }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('initial state: children=[] and isLoaded=false', () => {
    const state = useChildrenStore.getState();
    expect(state.children).toEqual([]);
    expect(state.isLoaded).toBe(false);
  });

  test('load() fetches children from DB and sets isLoaded=true', async () => {
    // Pre-insert directly to test load isolation
    real.prepare('INSERT INTO children (name, color_index, created_at) VALUES (?, ?, ?)').run('민준', 0, '2026-01-01');

    await useChildrenStore.getState().load(db as never);

    const state = useChildrenStore.getState();
    expect(state.isLoaded).toBe(true);
    expect(state.children).toHaveLength(1);
    expect(state.children[0]?.name).toBe('민준');
  });

  test('load() on empty DB sets isLoaded=true and children=[]', async () => {
    await useChildrenStore.getState().load(db as never);
    const state = useChildrenStore.getState();
    expect(state.isLoaded).toBe(true);
    expect(state.children).toEqual([]);
  });

  test('add() inserts a child and updates store', async () => {
    await useChildrenStore.getState().load(db as never);
    const child = await useChildrenStore.getState().add(db as never, { name: '서연', colorIndex: 2 });

    expect(child.id).toBeGreaterThan(0);
    expect(child.name).toBe('서연');

    const state = useChildrenStore.getState();
    expect(state.children).toHaveLength(1);
    expect(state.children[0]?.id).toBe(child.id);
  });

  test('updateOne() mutates child name in store', async () => {
    await useChildrenStore.getState().load(db as never);
    const child = await useChildrenStore.getState().add(db as never, { name: '민준', colorIndex: 0 });

    await useChildrenStore.getState().updateOne(db as never, child.id, { name: '준서' });

    const state = useChildrenStore.getState();
    const found = state.children.find((c) => c.id === child.id);
    expect(found?.name).toBe('준서');
  });

  test('removeOne() removes child from store', async () => {
    await useChildrenStore.getState().load(db as never);
    const child = await useChildrenStore.getState().add(db as never, { name: '도윤', colorIndex: 4 });

    expect(useChildrenStore.getState().children).toHaveLength(1);

    await useChildrenStore.getState().removeOne(db as never, child.id);

    expect(useChildrenStore.getState().children).toHaveLength(0);
  });

  test('add() → removeOne() → list is empty', async () => {
    await useChildrenStore.getState().load(db as never);
    const a = await useChildrenStore.getState().add(db as never, { name: '민준', colorIndex: 0 });
    const b = await useChildrenStore.getState().add(db as never, { name: '서연', colorIndex: 2 });

    await useChildrenStore.getState().removeOne(db as never, a.id);

    const state = useChildrenStore.getState();
    expect(state.children).toHaveLength(1);
    expect(state.children[0]?.id).toBe(b.id);
  });

  test('selector reference stability: reading children twice without mutation returns same reference', async () => {
    await useChildrenStore.getState().load(db as never);

    const children1 = useChildrenStore.getState().children;
    const children2 = useChildrenStore.getState().children;

    // Same reference — no intervening mutation
    expect(children1).toBe(children2);
  });

  test('selector reference changes after mutation', async () => {
    await useChildrenStore.getState().load(db as never);
    const before = useChildrenStore.getState().children;

    await useChildrenStore.getState().add(db as never, { name: '민준', colorIndex: 0 });

    const after = useChildrenStore.getState().children;
    // After mutation, store returns new array reference
    expect(after).not.toBe(before);
  });
});
