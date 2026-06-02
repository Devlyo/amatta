// Repository round-trip tests for the notification-settings repo.
// Also verifies boolean coercion: sound/enabled 0/1 ↔ true/false.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../../src/db/migrations';
import * as childrenRepo from '../../../src/db/repositories/children';
import * as notificationSettingsRepo from '../../../src/db/repositories/notification-settings';

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
  return resolve(dir, `notif-repo-${randomUUID()}.db`);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('notificationSettingsRepo', () => {
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

    const child = await childrenRepo.create(db as never, { name: '테스트자녀', colorIndex: 0 });
    childId = child.id;
  });

  afterEach(() => {
    try { real.close(); } catch { /* already closed */ }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('list() returns empty array on fresh DB', async () => {
    const result = await notificationSettingsRepo.list(db as never);
    expect(result).toEqual([]);
  });

  test('getByChildId() returns null when no setting exists', async () => {
    const result = await notificationSettingsRepo.getByChildId(db as never, childId);
    expect(result).toBeNull();
  });

  test('create() inserts a setting and returns it with boolean fields', async () => {
    const setting = await notificationSettingsRepo.create(db as never, {
      childId,
      defaultMinutesBefore: 15,
      sound: true,
      enabled: true,
    });
    expect(setting.childId).toBe(childId);
    expect(setting.defaultMinutesBefore).toBe(15);
    expect(setting.sound).toBe(true);
    expect(setting.enabled).toBe(true);
  });

  test('boolean coercion: sound=false, enabled=false stored as 0, returned as false', async () => {
    const setting = await notificationSettingsRepo.create(db as never, {
      childId,
      defaultMinutesBefore: 30,
      sound: false,
      enabled: false,
    });
    expect(setting.sound).toBe(false);
    expect(setting.enabled).toBe(false);

    // Verify raw storage is 0/0
    const raw = real.prepare(
      'SELECT sound, enabled FROM notification_settings WHERE child_id = ?'
    ).get(childId) as { sound: number; enabled: number };
    expect(raw.sound).toBe(0);
    expect(raw.enabled).toBe(0);
  });

  test('boolean coercion: sound=true, enabled=true stored as 1', async () => {
    await notificationSettingsRepo.create(db as never, {
      childId,
      defaultMinutesBefore: 10,
      sound: true,
      enabled: true,
    });
    const raw = real.prepare(
      'SELECT sound, enabled FROM notification_settings WHERE child_id = ?'
    ).get(childId) as { sound: number; enabled: number };
    expect(raw.sound).toBe(1);
    expect(raw.enabled).toBe(1);
  });

  test('getByChildId() returns the setting after create()', async () => {
    const created = await notificationSettingsRepo.create(db as never, {
      childId,
      defaultMinutesBefore: 15,
      sound: true,
      enabled: true,
    });
    const fetched = await notificationSettingsRepo.getByChildId(db as never, childId);
    expect(fetched).toEqual(created);
  });

  test('list() returns all settings ordered by child_id ASC', async () => {
    const child2 = await childrenRepo.create(db as never, { name: '두번째', colorIndex: 2 });
    await notificationSettingsRepo.create(db as never, { childId, defaultMinutesBefore: 15, sound: true, enabled: true });
    await notificationSettingsRepo.create(db as never, { childId: child2.id, defaultMinutesBefore: 30, sound: false, enabled: true });

    const all = await notificationSettingsRepo.list(db as never);
    expect(all).toHaveLength(2);
    expect(all[0]?.childId).toBe(childId);
    expect(all[1]?.childId).toBe(child2.id);
  });

  test('update() mutates defaultMinutesBefore and sound', async () => {
    await notificationSettingsRepo.create(db as never, {
      childId,
      defaultMinutesBefore: 15,
      sound: true,
      enabled: true,
    });
    const updated = await notificationSettingsRepo.update(db as never, childId, {
      defaultMinutesBefore: 30,
      sound: false,
    });
    expect(updated.defaultMinutesBefore).toBe(30);
    expect(updated.sound).toBe(false);
    expect(updated.enabled).toBe(true);
  });

  test('update() with empty patch returns setting unchanged', async () => {
    const created = await notificationSettingsRepo.create(db as never, {
      childId,
      defaultMinutesBefore: 15,
      sound: true,
      enabled: true,
    });
    const updated = await notificationSettingsRepo.update(db as never, childId, {});
    expect(updated).toEqual(created);
  });

  test('remove() deletes the setting', async () => {
    await notificationSettingsRepo.create(db as never, {
      childId,
      defaultMinutesBefore: 15,
      sound: true,
      enabled: true,
    });
    await notificationSettingsRepo.remove(db as never, childId);
    const fetched = await notificationSettingsRepo.getByChildId(db as never, childId);
    expect(fetched).toBeNull();
  });

  test('cascade: deleting child removes its notification setting', async () => {
    await notificationSettingsRepo.create(db as never, {
      childId,
      defaultMinutesBefore: 15,
      sound: true,
      enabled: true,
    });
    await childrenRepo.remove(db as never, childId);
    const fetched = await notificationSettingsRepo.getByChildId(db as never, childId);
    expect(fetched).toBeNull();
  });
});
