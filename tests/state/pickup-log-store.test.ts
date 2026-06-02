// State store tests for usePickupLogStore.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../src/db/migrations';
import * as childrenRepo from '../../src/db/repositories/children';
import * as schedulesRepo from '../../src/db/repositories/schedules';
import { usePickupLogStore, selectIsComplete } from '../../src/state/pickup-log-store';
import type { ISODate } from '../../src/domain/types';

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
  return resolve(dir, `pickup-log-store-${randomUUID()}.db`);
}

const VALID_FROM = '2026-01-01' as ISODate;
const DATE_A = 20260602;
const DATE_B = 20260603;

describe('usePickupLogStore', () => {
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
    const s = await schedulesRepo.create(db as never, {
      childId: child.id,
      title: '수영',
      type: 'activity',
      location: null,
      notes: null,
      daysOfWeek: 0b00100000,
      startMinutes: 600,
      endMinutes: 660,
      validFrom: VALID_FROM,
      validUntil: null,
      notifyMinutesBefore: null,
      needsPickup: true,
    });
    scheduleId = s.id;

    usePickupLogStore.setState({ completionMap: new Map(), isLoaded: false });
  });

  afterEach(() => {
    try { real.close(); } catch { /* already closed */ }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('load() hydrates completion map and sets isLoaded=true', async () => {
    real.prepare(
      'INSERT INTO schedule_pickup_log (schedule_id, occurrence_date, completed_at) VALUES (?, ?, ?)',
    ).run(scheduleId, DATE_A, 1000);

    await usePickupLogStore.getState().load(db as never);

    const state = usePickupLogStore.getState();
    expect(state.isLoaded).toBe(true);
    expect(state.completionMap.has(`${scheduleId}|${DATE_A}`)).toBe(true);
    expect(state.completionMap.get(`${scheduleId}|${DATE_A}`)).toBe(1000);
  });

  test('markComplete() inserts and is idempotent on repeat', async () => {
    await usePickupLogStore.getState().load(db as never);
    await usePickupLogStore.getState().markComplete(db as never, scheduleId, DATE_A);
    expect(usePickupLogStore.getState().completionMap.has(`${scheduleId}|${DATE_A}`)).toBe(true);

    const beforeRowCount = (real.prepare('SELECT COUNT(*) AS c FROM schedule_pickup_log').get() as { c: number }).c;
    await usePickupLogStore.getState().markComplete(db as never, scheduleId, DATE_A);
    const afterRowCount = (real.prepare('SELECT COUNT(*) AS c FROM schedule_pickup_log').get() as { c: number }).c;

    expect(afterRowCount).toBe(beforeRowCount);
    expect(usePickupLogStore.getState().completionMap.has(`${scheduleId}|${DATE_A}`)).toBe(true);
  });

  test('clearComplete() removes the entry', async () => {
    await usePickupLogStore.getState().load(db as never);
    await usePickupLogStore.getState().markComplete(db as never, scheduleId, DATE_A);
    expect(usePickupLogStore.getState().completionMap.has(`${scheduleId}|${DATE_A}`)).toBe(true);

    await usePickupLogStore.getState().clearComplete(db as never, scheduleId, DATE_A);
    expect(usePickupLogStore.getState().completionMap.has(`${scheduleId}|${DATE_A}`)).toBe(false);
  });

  test('selectIsComplete returns true only when entry exists', async () => {
    await usePickupLogStore.getState().load(db as never);
    await usePickupLogStore.getState().markComplete(db as never, scheduleId, DATE_A);

    expect(selectIsComplete(scheduleId, DATE_A)(usePickupLogStore.getState())).toBe(true);
    expect(selectIsComplete(scheduleId, DATE_B)(usePickupLogStore.getState())).toBe(false);
  });

  test('double markComplete keeps completedAt stable (first-write-wins)', async () => {
    await usePickupLogStore.getState().load(db as never);
    await usePickupLogStore.getState().markComplete(db as never, scheduleId, DATE_A);
    const first = usePickupLogStore.getState().completionMap.get(`${scheduleId}|${DATE_A}`);
    expect(first).toBeDefined();

    // Small delay would be required for clock change, but INSERT OR IGNORE
    // means second markComplete is a no-op — completedAt stays at the first value.
    await usePickupLogStore.getState().markComplete(db as never, scheduleId, DATE_A);
    const second = usePickupLogStore.getState().completionMap.get(`${scheduleId}|${DATE_A}`);
    expect(second).toBe(first);
  });
});
