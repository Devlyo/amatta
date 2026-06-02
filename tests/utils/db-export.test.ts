// Tests for src/utils/db-export.
// Uses the established node:sqlite wrap() pattern so the export runs against
// a real SQLite engine with the production schema (via runMigrations).

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../src/db/migrations';
import { exportDb, EXPORT_SCHEMA_VERSION } from '../../src/utils/db-export';

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
  return resolve(dir, `db-export-${randomUUID()}.db`);
}

describe('exportDb', () => {
  let dbPath: string;
  let real: DatabaseSync;
  let db: MinimalDb;

  beforeEach(async () => {
    dbPath = tmpDbPath();
    real = new DatabaseSync(dbPath);
    db = wrap(real);
    await runMigrations(db as never);
    real.exec('PRAGMA foreign_keys = ON');
  });

  afterEach(() => {
    try {
      real.close();
    } catch {
      /* already closed */
    }
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
  });

  test('empty DB → envelope has all four arrays empty + schemaVersion=1', async () => {
    const result = await exportDb(db as never);
    expect(result.envelope.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(result.envelope.children).toEqual([]);
    expect(result.envelope.schedules).toEqual([]);
    expect(result.envelope.exceptions).toEqual([]);
    expect(result.envelope.notificationSettings).toEqual([]);
  });

  test('exportedAt is a valid ISO 8601 UTC timestamp', async () => {
    const now = new Date('2026-06-02T13:24:00.000Z');
    const result = await exportDb(db as never, now);
    expect(result.envelope.exportedAt).toBe('2026-06-02T13:24:00.000Z');
  });

  test('json is parseable and round-trips to the envelope', async () => {
    const result = await exportDb(db as never);
    const parsed: unknown = JSON.parse(result.json);
    expect(parsed).toEqual(result.envelope);
  });

  test('suggested filename matches schedulapp-export-YYYYMMDD-HHMM.json', async () => {
    const now = new Date(2026, 5, 2, 13, 24); // local Jun 2 13:24
    const result = await exportDb(db as never, now);
    expect(result.suggestedFilename).toBe('schedulapp-export-20260602-1324.json');
  });

  test('populated DB → all four tables present', async () => {
    real.exec(
      `INSERT INTO children (name, color_index, created_at) VALUES
        ('민준', 0, '2026-05-01'),
        ('서연', 2, '2026-05-01')`,
    );
    real.exec(
      `INSERT INTO schedules
         (child_id, title, type, days_of_week, start_minutes, end_minutes, valid_from, notify_minutes_before)
       VALUES
         (1, '학교', 'school', 31, 540, 870, '2026-05-01', NULL),
         (1, '영어학원', 'academy', 21, 960, 1050, '2026-05-01', 30)`,
    );
    real.exec(
      `INSERT INTO schedule_exceptions (schedule_id, date, kind)
       VALUES (2, '2026-06-04', 'cancel')`,
    );
    real.exec(
      `INSERT INTO notification_settings (child_id, default_minutes_before, sound, enabled)
       VALUES (1, 15, 1, 1), (2, 30, 0, 1)`,
    );

    const result = await exportDb(db as never);
    expect(result.envelope.children).toHaveLength(2);
    expect(result.envelope.schedules).toHaveLength(2);
    expect(result.envelope.exceptions).toHaveLength(1);
    expect(result.envelope.notificationSettings).toHaveLength(2);

    // Spot-check that the mappers ran (domain shape, not raw row shape).
    expect(result.envelope.children[0]).toMatchObject({
      id: 1,
      name: '민준',
      colorIndex: 0,
    });
    expect(result.envelope.schedules[1]).toMatchObject({
      title: '영어학원',
      type: 'academy',
      notifyMinutesBefore: 30,
    });
    expect(result.envelope.exceptions[0]).toMatchObject({
      scheduleId: 2,
      kind: 'cancel',
    });
    expect(result.envelope.notificationSettings[0]).toMatchObject({
      childId: 1,
      sound: true,
      enabled: true,
    });
  });

  test('JSON output is pretty-printed (indent 2)', async () => {
    real.exec(
      `INSERT INTO children (name, color_index, created_at)
       VALUES ('민준', 0, '2026-05-01')`,
    );
    const result = await exportDb(db as never);
    // Indented JSON has a newline + spaces; collapsed JSON has neither.
    expect(result.json).toContain('\n');
    expect(result.json).toContain('  "children"');
  });
});
