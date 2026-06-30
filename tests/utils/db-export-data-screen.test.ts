// 3.3 — Backup-promise consistency guard.
//
// The "내보낼 정보" section of app/settings/data.tsx displays four counts:
//   자녀 (children) / 일정 (schedules) / 준비물 (checklistItems) / 할일 (todos)
//
// This test verifies that the four categories the UI promises to export are
// actually present in the export envelope, and that the export copy is
// accurate — export-only today, restore deferred to v1.1.
//
// If a future refactor renames an envelope key or drops a category, this test
// will fail before the user notices the mismatch.

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../src/db/migrations';
import { exportDb, EXPORT_SCHEMA_VERSION } from '../../src/utils/db-export';

// ---------------------------------------------------------------------------
// MinimalDb shim (identical to db-export.test.ts)
// ---------------------------------------------------------------------------
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
  return resolve(dir, `db-export-data-screen-${randomUUID()}.db`);
}

// ---------------------------------------------------------------------------
// The four categories data.tsx "내보낼 정보" displays — kept in sync manually.
// If this list drifts from the screen, update BOTH this test and data.tsx.
// ---------------------------------------------------------------------------
const DATA_SCREEN_CATEGORIES = [
  { label: '자녀', envelopeKey: 'children' },
  { label: '일정', envelopeKey: 'schedules' },
  { label: '준비물', envelopeKey: 'checklistItems' },
  { label: '할일', envelopeKey: 'todos' },
] as const;

describe('data.tsx backup-promise consistency', () => {
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

  test('schema version is 3 (checklistCompletion added in v3)', () => {
    // Hard assertion so a version bump without updating data.tsx copy is caught.
    expect(EXPORT_SCHEMA_VERSION).toBe(3);
  });

  test('every category data.tsx displays is present in the export envelope', async () => {
    const result = await exportDb(db as never);
    const exportedKeys = Object.keys(result.envelope);
    for (const { label, envelopeKey } of DATA_SCREEN_CATEGORIES) {
      // Jest doesn't support a message arg in expect(); assert via inclusion check.
      if (!exportedKeys.includes(envelopeKey)) {
        throw new Error(
          `data.tsx shows "${label}" but envelope key "${envelopeKey}" is missing from export`,
        );
      }
      expect(exportedKeys).toContain(envelopeKey);
    }
  });

  test('data.tsx category counts match the export envelope row counts (populated DB)', async () => {
    // Seed one row per category the UI counts.
    real.exec(
      `INSERT INTO children (name, color_index, created_at)
       VALUES ('민준', 0, '2026-06-01')`,
    );
    real.exec(
      `INSERT INTO schedules
         (child_id, title, type, days_of_week, start_minutes, end_minutes,
          valid_from, notify_minutes_before, needs_pickup)
       VALUES
         (1, '수영', 'academy', 2, 900, 960, '2026-06-01', NULL, 0),
         (1, '영어', 'academy', 4, 1020, 1080, '2026-06-01', NULL, 0)`,
    );
    real.exec(
      `INSERT INTO checklist_items (schedule_id, label, sort_order, is_done, done_at)
       VALUES (1, '수영복', 0, 0, NULL),
              (1, '물안경', 1, 0, NULL),
              (2, '교재', 0, 0, NULL)`,
    );
    real.exec(
      `INSERT INTO todos (child_id, title, due_at, notify_minutes_before,
                          is_done, done_at, created_at)
       VALUES (1, '숙제', 1717100000000, NULL, 0, NULL, 1717000000000)`,
    );

    // Simulate the four counts that data.tsx derives from Zustand stores
    // (which mirror the DB). We read directly from the DB to avoid store
    // bootstrap complexity.
    const dbKidCount = Number(
      (real.prepare('SELECT COUNT(*) AS c FROM children').get() as { c: number | bigint }).c,
    );
    const dbScheduleCount = Number(
      (real.prepare('SELECT COUNT(*) AS c FROM schedules').get() as { c: number | bigint }).c,
    );
    const dbChecklistCount = Number(
      (real.prepare('SELECT COUNT(*) AS c FROM checklist_items').get() as { c: number | bigint }).c,
    );
    const dbTodoCount = Number(
      (real.prepare('SELECT COUNT(*) AS c FROM todos').get() as { c: number | bigint }).c,
    );

    const result = await exportDb(db as never);

    // Each count the UI would show must equal the count in the export.
    expect(result.envelope.children).toHaveLength(dbKidCount);
    expect(result.envelope.schedules).toHaveLength(dbScheduleCount);
    expect(result.envelope.checklistItems).toHaveLength(dbChecklistCount);
    expect(result.envelope.todos).toHaveLength(dbTodoCount);
  });

  test('export copy is export-only (restore placeholder must say v1.1)', () => {
    // Guard the UX promise in data.tsx:
    //   "내보낸 JSON 파일은 백업용으로 보관할 수 있어요. 가져오기(복원)는 v1.1에서 지원돼요."
    // and the import badge:
    //   "v1.1 출시 예정"
    //
    // This is a documentation/source test: we read the screen source and assert
    // the key phrases are present so someone cannot silently change the copy to
    // claim restore works now without updating this test.
    const src = readFileSync(
      resolve(__dirname, '../../app/settings/data.tsx'),
      'utf8',
    );
    // The note below the export button must mention backup-only + v1.1.
    expect(src).toContain('백업용');
    expect(src).toContain('v1.1');
    // The import row must carry the "coming in v1.1" badge.
    expect(src).toContain('v1.1 출시 예정');
    // There must NOT be an active import handler wired up — the import section
    // should be disabled/placeholder only.
    expect(src).not.toContain('handleImport');
  });
});
