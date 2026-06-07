// notif-settings-store persistence round-trip (P3.1).
//
// Verifies: setters write-through to app_settings, load(db) hydrates both
// values from app_settings, defaults apply when keys are absent, and a
// write→reload survives a fresh store/db read.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../src/db/migrations';
import * as appSettingsRepo from '../../src/db/repositories/app-settings';
import {
  useNotifSettingsStore,
  NOTIF_SETTINGS_KEYS,
} from '../../src/state/notif-settings-store';

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
  return resolve(dir, `notif-store-${randomUUID()}.db`);
}

describe('notif-settings-store persistence', () => {
  let dbPath: string;
  let real: DatabaseSync;
  let db: MinimalDb;

  beforeEach(async () => {
    dbPath = tmpDbPath();
    real = new DatabaseSync(dbPath);
    db = wrap(real);
    await runMigrations(db as never);
    useNotifSettingsStore.getState().resetToDefaults();
  });

  afterEach(() => {
    try { real.close(); } catch { /* already closed */ }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('load() applies defaults when app_settings is empty', async () => {
    await useNotifSettingsStore.getState().load(db as never);
    expect(useNotifSettingsStore.getState().systemEnabled).toBe(true);
    expect(useNotifSettingsStore.getState().defaultMinutesBefore).toBe(30);
  });

  test('setSystemEnabled write-through persists to app_settings', async () => {
    await useNotifSettingsStore.getState().setSystemEnabled(db as never, false);
    expect(useNotifSettingsStore.getState().systemEnabled).toBe(false);
    const raw = await appSettingsRepo.getString(
      db as never,
      NOTIF_SETTINGS_KEYS.systemEnabled,
    );
    expect(raw).toBe('0');
  });

  test('setDefaultMinutesBefore write-through persists to app_settings', async () => {
    await useNotifSettingsStore.getState().setDefaultMinutesBefore(db as never, 60);
    expect(useNotifSettingsStore.getState().defaultMinutesBefore).toBe(60);
    const raw = await appSettingsRepo.getString(
      db as never,
      NOTIF_SETTINGS_KEYS.defaultMinutesBefore,
    );
    expect(raw).toBe('60');
  });

  test('write → reset → reload round-trips both values (simulated relaunch)', async () => {
    await useNotifSettingsStore.getState().setSystemEnabled(db as never, false);
    await useNotifSettingsStore.getState().setDefaultMinutesBefore(db as never, 10);

    // Simulate a relaunch: in-memory state is wiped to defaults...
    useNotifSettingsStore.getState().resetToDefaults();
    expect(useNotifSettingsStore.getState().systemEnabled).toBe(true);
    expect(useNotifSettingsStore.getState().defaultMinutesBefore).toBe(30);

    // ...then hydrated from the persisted app_settings.
    await useNotifSettingsStore.getState().load(db as never);
    expect(useNotifSettingsStore.getState().systemEnabled).toBe(false);
    expect(useNotifSettingsStore.getState().defaultMinutesBefore).toBe(10);
  });
});
