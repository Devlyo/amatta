// wipeAllData — reset/wipe consistency.
//
// Pins that "모든 데이터 초기화" is a true clean slate: in particular the
// persisted notification settings in app_settings are cleared (NOTIF-PERSIST
// regression guard), alongside the user-data tables.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../src/db/migrations';
import { wipeAllData } from '../../src/db/wipe';
import * as appSettingsRepo from '../../src/db/repositories/app-settings';
import * as childrenRepo from '../../src/db/repositories/children';
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
  return resolve(dir, `wipe-${randomUUID()}.db`);
}

describe('wipeAllData', () => {
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

  test('clears app_settings rows (persisted notif settings)', async () => {
    await appSettingsRepo.setBool(db as never, NOTIF_SETTINGS_KEYS.systemEnabled, false);
    await appSettingsRepo.setInt(db as never, NOTIF_SETTINGS_KEYS.defaultMinutesBefore, 10);

    await wipeAllData(db as never);

    const count = real.prepare('SELECT COUNT(*) AS c FROM app_settings').get() as { c: number };
    expect(count.c).toBe(0);
    expect(
      await appSettingsRepo.getBool(db as never, NOTIF_SETTINGS_KEYS.systemEnabled),
    ).toBeNull();
  });

  test('after wipe + reload, store falls back to defaults', async () => {
    await appSettingsRepo.setBool(db as never, NOTIF_SETTINGS_KEYS.systemEnabled, false);
    await appSettingsRepo.setInt(db as never, NOTIF_SETTINGS_KEYS.defaultMinutesBefore, 10);
    await useNotifSettingsStore.getState().load(db as never);
    expect(useNotifSettingsStore.getState().systemEnabled).toBe(false);

    await wipeAllData(db as never);
    useNotifSettingsStore.getState().resetToDefaults();
    await useNotifSettingsStore.getState().load(db as never);

    expect(useNotifSettingsStore.getState().systemEnabled).toBe(true);
    expect(useNotifSettingsStore.getState().defaultMinutesBefore).toBe(30);
  });

  test('clears user-data tables too', async () => {
    await childrenRepo.create(db as never, { name: '아이', colorIndex: 0 });
    await wipeAllData(db as never);
    const children = await childrenRepo.list(db as never);
    expect(children).toHaveLength(0);
  });
});
