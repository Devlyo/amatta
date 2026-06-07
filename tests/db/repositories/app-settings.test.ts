// Repository round-trip tests for the app-settings key-value repo.
// Covers typed string/bool/int get+set, UPSERT semantics, absent-key nulls,
// and clearAll().

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../../src/db/migrations';
import * as appSettingsRepo from '../../../src/db/repositories/app-settings';

// ---------------------------------------------------------------------------
// MinimalDb shim (mirrors notification-settings.test.ts)
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
  return resolve(dir, `app-settings-repo-${randomUUID()}.db`);
}

describe('appSettingsRepo', () => {
  let dbPath: string;
  let real: DatabaseSync;
  let db: MinimalDb;

  beforeEach(async () => {
    dbPath = tmpDbPath();
    real = new DatabaseSync(dbPath);
    db = wrap(real);
    await runMigrations(db as never);
  });

  afterEach(() => {
    try { real.close(); } catch { /* already closed */ }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('getString returns null on absent key', async () => {
    expect(await appSettingsRepo.getString(db as never, 'nope')).toBeNull();
  });

  test('setString then getString round-trips', async () => {
    await appSettingsRepo.setString(db as never, 'k', 'hello');
    expect(await appSettingsRepo.getString(db as never, 'k')).toBe('hello');
  });

  test('setString UPSERTs (second write overwrites)', async () => {
    await appSettingsRepo.setString(db as never, 'k', 'first');
    await appSettingsRepo.setString(db as never, 'k', 'second');
    expect(await appSettingsRepo.getString(db as never, 'k')).toBe('second');
    const count = real.prepare('SELECT COUNT(*) AS c FROM app_settings').get() as { c: number };
    expect(count.c).toBe(1);
  });

  test('bool round-trips as 1/0', async () => {
    await appSettingsRepo.setBool(db as never, 'b', true);
    expect(await appSettingsRepo.getString(db as never, 'b')).toBe('1');
    expect(await appSettingsRepo.getBool(db as never, 'b')).toBe(true);
    await appSettingsRepo.setBool(db as never, 'b', false);
    expect(await appSettingsRepo.getString(db as never, 'b')).toBe('0');
    expect(await appSettingsRepo.getBool(db as never, 'b')).toBe(false);
  });

  test('getBool returns null on absent key', async () => {
    expect(await appSettingsRepo.getBool(db as never, 'absent')).toBeNull();
  });

  test('int round-trips as decimal string', async () => {
    await appSettingsRepo.setInt(db as never, 'n', 60);
    expect(await appSettingsRepo.getString(db as never, 'n')).toBe('60');
    expect(await appSettingsRepo.getInt(db as never, 'n')).toBe(60);
  });

  test('getInt returns null on absent key', async () => {
    expect(await appSettingsRepo.getInt(db as never, 'absent')).toBeNull();
  });

  test('clearAll removes every row', async () => {
    await appSettingsRepo.setString(db as never, 'a', '1');
    await appSettingsRepo.setString(db as never, 'b', '2');
    await appSettingsRepo.clearAll(db as never);
    const count = real.prepare('SELECT COUNT(*) AS c FROM app_settings').get() as { c: number };
    expect(count.c).toBe(0);
    expect(await appSettingsRepo.getString(db as never, 'a')).toBeNull();
  });
});
