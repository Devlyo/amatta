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

  test('empty DB → envelope has all eight arrays empty + schemaVersion bump', async () => {
    const result = await exportDb(db as never);
    expect(result.envelope.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(EXPORT_SCHEMA_VERSION).toBeGreaterThanOrEqual(3);
    expect(result.envelope.children).toEqual([]);
    expect(result.envelope.schedules).toEqual([]);
    expect(result.envelope.exceptions).toEqual([]);
    expect(result.envelope.notificationSettings).toEqual([]);
    expect(result.envelope.checklistItems).toEqual([]);
    expect(result.envelope.todos).toEqual([]);
    expect(result.envelope.pickupLog).toEqual([]);
    expect(result.envelope.checklistCompletion).toEqual([]);
  });

  // Reject-vector guard (P3.3): every category the data screen counts/displays
  // under "내보낼 정보" — 자녀(children) / 일정(schedules) / 준비물(checklist) /
  // 할일(todos) — plus the rest of the DB surface MUST be an exported envelope
  // key. If the UI ever shows a category the export drops, this fails.
  test('exported categories cover all eight DB entities (no silent data loss)', async () => {
    const result = await exportDb(db as never);
    const exportedKeys = Object.keys(result.envelope).sort();
    expect(exportedKeys).toEqual(
      [
        'checklistCompletion',
        'checklistItems',
        'children',
        'exceptions',
        'exportedAt',
        'notificationSettings',
        'pickupLog',
        'schedules',
        'schemaVersion',
        'todos',
      ].sort(),
    );
    // The four categories the data.tsx "내보낼 정보" UI counts must each map to
    // a populated-able export array.
    expect(result.envelope.children).toBeDefined(); // 자녀
    expect(result.envelope.schedules).toBeDefined(); // 일정
    expect(result.envelope.checklistItems).toBeDefined(); // 준비물
    expect(result.envelope.todos).toBeDefined(); // 할일
    // Authoritative per-occurrence completion table (v6 / PREP-RECUR).
    expect(result.envelope.checklistCompletion).toBeDefined();
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

  test('populated DB → every table round-trips its row count into the export', async () => {
    real.exec(
      `INSERT INTO children (name, color_index, created_at) VALUES
        ('민준', 0, '2026-05-01'),
        ('서연', 2, '2026-05-01')`,
    );
    real.exec(
      `INSERT INTO schedules
         (child_id, title, type, days_of_week, start_minutes, end_minutes, valid_from, notify_minutes_before, needs_pickup)
       VALUES
         (1, '학교', 'school', 31, 540, 870, '2026-05-01', NULL, 0),
         (1, '영어학원', 'academy', 21, 960, 1050, '2026-05-01', 30, 1)`,
    );
    real.exec(
      `INSERT INTO schedule_exceptions (schedule_id, date, kind)
       VALUES (2, '2026-06-04', 'cancel')`,
    );
    real.exec(
      `INSERT INTO notification_settings (child_id, default_minutes_before, sound, enabled)
       VALUES (1, 15, 1, 1), (2, 30, 0, 1)`,
    );
    real.exec(
      `INSERT INTO checklist_items (schedule_id, label, sort_order, is_done, done_at)
       VALUES
         (2, '교재', 0, 0, NULL),
         (2, '필통', 1, 1, 1717000000000),
         (1, '물통', 0, 0, NULL)`,
    );
    real.exec(
      `INSERT INTO todos (child_id, title, due_at, notify_minutes_before, is_done, done_at, created_at)
       VALUES
         (1, '준비물 챙기기', 1717100000000, 30, 0, NULL, 1716000000000),
         (NULL, '학부모 상담 예약', 1717200000000, NULL, 1, 1717150000000, 1716000000000)`,
    );
    real.exec(
      `INSERT INTO schedule_pickup_log (schedule_id, occurrence_date, completed_at)
       VALUES (2, 1717000000000, 1717003600000)`,
    );
    // checklist_completion: two per-occurrence completions for checklist items
    // that already exist above (item id 1 = '교재' on schedule 2, item id 3 = '물통' on schedule 1).
    real.exec(
      `INSERT INTO checklist_completion (checklist_item_id, occurrence_date, completed_at)
       VALUES (1, 20260602, 1717000001000),
              (3, 20260602, 1717000002000)`,
    );

    // Expected counts straight from the seed above — these are the source of
    // truth the export must mirror per table.
    const expectedCounts: Record<string, number> = {
      children: 2,
      schedules: 2,
      exceptions: 1,
      notificationSettings: 2,
      checklistItems: 3,
      todos: 2,
      pickupLog: 1,
      checklistCompletion: 2,
    };

    const result = await exportDb(db as never);
    expect(result.envelope.children).toHaveLength(expectedCounts.children);
    expect(result.envelope.schedules).toHaveLength(expectedCounts.schedules);
    expect(result.envelope.exceptions).toHaveLength(expectedCounts.exceptions);
    expect(result.envelope.notificationSettings).toHaveLength(
      expectedCounts.notificationSettings,
    );
    expect(result.envelope.checklistItems).toHaveLength(
      expectedCounts.checklistItems,
    );
    expect(result.envelope.todos).toHaveLength(expectedCounts.todos);
    expect(result.envelope.pickupLog).toHaveLength(expectedCounts.pickupLog);
    expect(result.envelope.checklistCompletion).toHaveLength(
      expectedCounts.checklistCompletion,
    );

    // Cross-check each export array length against the live DB row count, so a
    // future schema change that drops rows from a table is caught.
    for (const [table, sql] of [
      ['children', 'SELECT COUNT(*) AS c FROM children'],
      ['schedules', 'SELECT COUNT(*) AS c FROM schedules'],
      ['exceptions', 'SELECT COUNT(*) AS c FROM schedule_exceptions'],
      ['notificationSettings', 'SELECT COUNT(*) AS c FROM notification_settings'],
      ['checklistItems', 'SELECT COUNT(*) AS c FROM checklist_items'],
      ['todos', 'SELECT COUNT(*) AS c FROM todos'],
      ['pickupLog', 'SELECT COUNT(*) AS c FROM schedule_pickup_log'],
      ['checklistCompletion', 'SELECT COUNT(*) AS c FROM checklist_completion'],
    ] as const) {
      const dbCount = Number(
        (real.prepare(sql).get() as { c: number | bigint }).c,
      );
      const exported = (result.envelope as Record<string, unknown[]>)[table];
      expect(exported).toHaveLength(dbCount);
    }

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
      needsPickup: true,
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
    expect(result.envelope.checklistItems[1]).toMatchObject({
      scheduleId: 2,
      label: '필통',
      isDone: true,
    });
    expect(result.envelope.todos[1]).toMatchObject({
      childId: null,
      title: '학부모 상담 예약',
      isDone: true,
    });
    expect(result.envelope.pickupLog[0]).toMatchObject({
      scheduleId: 2,
      occurrenceDate: 1717000000000,
    });
    expect(result.envelope.checklistCompletion[0]).toMatchObject({
      checklistItemId: 1,
      occurrenceDate: 20260602,
      completedAt: 1717000001000,
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
