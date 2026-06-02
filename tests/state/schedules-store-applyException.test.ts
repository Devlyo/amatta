// Tests for the applyException action added to schedules-store.
// Uses the node:sqlite wrap() pattern so we exercise the real DDL paths.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../src/db/migrations';
import { useSchedulesStore } from '../../src/state/schedules-store';
import type { ISODate } from '../../src/domain/types';

interface MinimalDb {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  runAsync(
    sql: string,
    params?: unknown[],
  ): Promise<{ lastInsertRowId: number; changes: number }>;
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
      const r = real.prepare(sql).run(...(params as never[]));
      return {
        lastInsertRowId: Number(r.lastInsertRowid),
        changes: Number(r.changes),
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
  return resolve(dir, `apply-exc-${randomUUID()}.db`);
}

describe('useSchedulesStore.applyException', () => {
  let dbPath: string;
  let real: DatabaseSync;
  let db: MinimalDb;

  beforeEach(async () => {
    dbPath = tmpDbPath();
    real = new DatabaseSync(dbPath);
    db = wrap(real);
    await runMigrations(db as never);
    real.exec('PRAGMA foreign_keys = ON');
    // Seed one child + one schedule.
    real.exec(
      `INSERT INTO children (name, color_index, created_at)
       VALUES ('민준', 0, '2026-05-01')`,
    );
    real.exec(
      `INSERT INTO schedules
         (child_id, title, type, days_of_week, start_minutes, end_minutes, valid_from, notify_minutes_before)
       VALUES (1, '영어학원', 'academy', 21, 960, 1050, '2026-05-01', 30)`,
    );
    // Reset store
    useSchedulesStore.setState({
      schedules: [],
      exceptions: [],
      isLoaded: false,
    });
  });

  afterEach(() => {
    try {
      real.close();
    } catch {
      /* ignore */
    }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('inserts a cancel exception when none exists', async () => {
    await useSchedulesStore.getState().applyException(
      db as never,
      1,
      '2026-06-04' as unknown as ISODate,
      { kind: 'cancel' },
    );
    const rows = real
      .prepare('SELECT schedule_id, date, kind FROM schedule_exceptions')
      .all() as { schedule_id: number; date: string; kind: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      schedule_id: 1,
      date: '2026-06-04',
      kind: 'cancel',
    });
  });

  test('inserts a modify exception with overrides', async () => {
    await useSchedulesStore.getState().applyException(
      db as never,
      1,
      '2026-06-04' as unknown as ISODate,
      {
        kind: 'modify',
        overrideStartMinutes: 1020,
        overrideEndMinutes: 1110,
        overrideTitle: '특별 보충',
      },
    );
    const rows = real
      .prepare(
        `SELECT kind, override_start_minutes, override_end_minutes, override_title
         FROM schedule_exceptions WHERE schedule_id = 1`,
      )
      .all() as {
      kind: string;
      override_start_minutes: number | null;
      override_end_minutes: number | null;
      override_title: string | null;
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: 'modify',
      override_start_minutes: 1020,
      override_end_minutes: 1110,
      override_title: '특별 보충',
    });
  });

  test('is idempotent — replaces an existing row on the same (scheduleId, date)', async () => {
    await useSchedulesStore.getState().applyException(
      db as never,
      1,
      '2026-06-04' as unknown as ISODate,
      { kind: 'cancel' },
    );
    await useSchedulesStore.getState().applyException(
      db as never,
      1,
      '2026-06-04' as unknown as ISODate,
      { kind: 'modify', overrideStartMinutes: 1020 },
    );
    const rows = real
      .prepare(
        'SELECT kind FROM schedule_exceptions WHERE schedule_id = 1 AND date = ?',
      )
      .all('2026-06-04') as { kind: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('modify');
  });

  test('refreshes the store after applying an exception', async () => {
    await useSchedulesStore.getState().applyException(
      db as never,
      1,
      '2026-06-04' as unknown as ISODate,
      { kind: 'cancel' },
    );
    const state = useSchedulesStore.getState();
    expect(state.exceptions).toHaveLength(1);
    expect(state.exceptions[0]?.kind).toBe('cancel');
  });
});
