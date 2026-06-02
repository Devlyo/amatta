// Dev-seed integration test.
//
// Mirrors the migration-test pattern: expo-sqlite is a native module not
// usable under jest-expo, so we wrap node:sqlite's DatabaseSync to expose the
// subset of SQLiteDatabase that runMigrations + seedDevData consume.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../src/db/migrations';
import { seedDevData } from '../../src/db/seed-dev';

// Minimal duck-typed db that satisfies the slices of SQLiteDatabase that
// runMigrations and seedDevData call. Cast at the boundary when passing to
// the production functions.
interface MinimalDb {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
  runAsync(
    sql: string,
    params: unknown[],
  ): Promise<{ lastInsertRowId: number; changes: number }>;
  closeAsync(): Promise<void>;
}

function wrap(real: DatabaseSync): MinimalDb {
  return {
    async execAsync(sql) {
      real.exec(sql);
    },
    async getFirstAsync<T>(sql: string) {
      const row = real.prepare(sql).get() as unknown;
      return (row as T) ?? null;
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
    async runAsync(sql, params) {
      const stmt = real.prepare(sql);
      const result = stmt.run(...(params as never[]));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    async closeAsync() {
      real.close();
    },
  };
}

function tmpDbPath(): string {
  const dir = resolve(tmpdir(), 'schedulapp-tests');
  mkdirSync(dir, { recursive: true });
  return resolve(dir, `seed-${randomUUID()}.db`);
}

describe('seedDevData', () => {
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
    real.close();
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  it('inserts 3 children, 8 schedules, 1 exception, 3 notification settings on a fresh DB', async () => {
    await seedDevData(db as never);

    expect(real.prepare('SELECT COUNT(*) AS c FROM children').get()).toEqual({ c: 3 });
    expect(real.prepare('SELECT COUNT(*) AS c FROM schedules').get()).toEqual({ c: 8 });
    expect(real.prepare('SELECT COUNT(*) AS c FROM schedule_exceptions').get()).toEqual({
      c: 1,
    });
    expect(real.prepare('SELECT COUNT(*) AS c FROM notification_settings').get()).toEqual({
      c: 3,
    });
  });

  it('marks 3 schedules with needs_pickup=1 (v2)', async () => {
    await seedDevData(db as never);
    expect(
      real.prepare('SELECT COUNT(*) AS c FROM schedules WHERE needs_pickup = 1').get(),
    ).toEqual({ c: 3 });
  });

  it('inserts 7 checklist_items (v2)', async () => {
    await seedDevData(db as never);
    expect(real.prepare('SELECT COUNT(*) AS c FROM checklist_items').get()).toEqual({ c: 7 });
  });

  it('inserts 4 todos with deterministic NOW_MS timestamps (v2)', async () => {
    await seedDevData(db as never);
    expect(real.prepare('SELECT COUNT(*) AS c FROM todos').get()).toEqual({ c: 4 });
    const rows = real
      .prepare('SELECT created_at FROM todos')
      .all() as { created_at: number }[];
    for (const r of rows) {
      expect(r.created_at).toBe(1717286400000);
    }
  });

  it('leaves schedule_pickup_log empty (v2)', async () => {
    await seedDevData(db as never);
    expect(real.prepare('SELECT COUNT(*) AS c FROM schedule_pickup_log').get()).toEqual({
      c: 0,
    });
  });

  it('produces children with valid color indices and distinct names', async () => {
    await seedDevData(db as never);
    const rows = real
      .prepare('SELECT name, color_index FROM children ORDER BY id')
      .all() as { name: string; color_index: number }[];
    expect(rows.map((r) => r.name)).toEqual(['민준', '서연', '도윤']);
    for (const r of rows) {
      expect(r.color_index).toBeGreaterThanOrEqual(0);
      expect(r.color_index).toBeLessThanOrEqual(5);
    }
  });

  it('respects schedule type CHECK and days_of_week range', async () => {
    await seedDevData(db as never);
    const rows = real
      .prepare(
        'SELECT title, type, days_of_week, start_minutes, end_minutes FROM schedules ORDER BY id',
      )
      .all() as {
      title: string;
      type: string;
      days_of_week: number;
      start_minutes: number;
      end_minutes: number;
    }[];
    expect(rows).toHaveLength(8);
    for (const r of rows) {
      expect(['school', 'academy', 'activity', 'other']).toContain(r.type);
      expect(r.days_of_week).toBeGreaterThan(0);
      expect(r.days_of_week).toBeLessThan(128);
      expect(r.end_minutes).toBeGreaterThan(r.start_minutes);
    }
  });

  it('exception references an existing schedule via FK', async () => {
    await seedDevData(db as never);
    const row = real
      .prepare(
        `SELECT e.date, e.kind, s.title
         FROM schedule_exceptions e
         JOIN schedules s ON s.id = e.schedule_id`,
      )
      .get() as { date: string; kind: string; title: string };
    expect(row).toEqual({ date: '2026-06-04', kind: 'cancel', title: '피아노' });
  });

  it('is idempotent — second call leaves counts unchanged', async () => {
    await seedDevData(db as never);
    await seedDevData(db as never);
    expect(real.prepare('SELECT COUNT(*) AS c FROM children').get()).toEqual({ c: 3 });
    expect(real.prepare('SELECT COUNT(*) AS c FROM schedules').get()).toEqual({ c: 8 });
    expect(real.prepare('SELECT COUNT(*) AS c FROM schedule_exceptions').get()).toEqual({
      c: 1,
    });
  });

  it('skips entirely if children table is already non-empty', async () => {
    real
      .prepare('INSERT INTO children (name, color_index, created_at) VALUES (?, ?, ?)')
      .run('기존자녀', 5, '2026-01-01');
    await seedDevData(db as never);
    expect(real.prepare('SELECT COUNT(*) AS c FROM children').get()).toEqual({ c: 1 });
    expect(real.prepare('SELECT COUNT(*) AS c FROM schedules').get()).toEqual({ c: 0 });
  });
});
