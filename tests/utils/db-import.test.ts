// Tests for src/utils/db-import (ADR-012) — real SQLite (node:sqlite) with the
// production schema, same wrap() pattern as db-export.test.ts plus an
// exclusive-transaction method that hands the same handle to the task.

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../src/db/migrations';
import { seedDevData } from '../../src/db/seed-dev';
import { exportDb, type ExportEnvelope } from '../../src/utils/db-export';
import { importDb, parseBackup, type BackupData } from '../../src/utils/db-import';

type Params = (string | number | null)[];
interface TestDb {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string, params?: Params): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: Params): Promise<T[]>;
  runAsync(sql: string, params?: Params): Promise<{ lastInsertRowId: number; changes: number }>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
  withExclusiveTransactionAsync(fn: (txn: TestDb) => Promise<void>): Promise<void>;
}

function wrap(real: DatabaseSync): TestDb {
  const self: TestDb = {
    async execAsync(sql) {
      real.exec(sql);
    },
    async getFirstAsync<T>(sql: string, params: Params = []) {
      return ((real.prepare(sql).get(...(params as never[])) as unknown) ?? null) as T | null;
    },
    async getAllAsync<T>(sql: string, params: Params = []) {
      return real.prepare(sql).all(...(params as never[])) as unknown as T[];
    },
    async runAsync(sql, params = []) {
      const r = real.prepare(sql).run(...(params as never[]));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
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
    async withExclusiveTransactionAsync(fn) {
      real.exec('BEGIN EXCLUSIVE');
      try {
        await fn(self);
        real.exec('COMMIT');
      } catch (e) {
        real.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return self;
}

let dbPath: string;
let real: DatabaseSync;
let db: TestDb;

beforeEach(async () => {
  const dir = resolve(tmpdir(), 'schedulapp-tests');
  mkdirSync(dir, { recursive: true });
  dbPath = resolve(dir, `db-import-${randomUUID()}.db`);
  real = new DatabaseSync(dbPath);
  db = wrap(real);
  await runMigrations(db as never);
  real.exec('PRAGMA foreign_keys = ON');
});

afterEach(() => {
  try {
    real.close();
  } catch {
    /* closed */
  }
  if (existsSync(dbPath)) rmSync(dbPath, { force: true });
});

/** A small but complete data set touching every table. */
function seed(target: DatabaseSync, opts: { guardian?: boolean } = {}): void {
  target.exec(`
    INSERT INTO children (id, name, color_index, avatar, created_at) VALUES
      (3, '민준', 0, 'face-wink', '2026-01-01'), (7, '서연', 5, 'face-calm', '2026-01-02');
    INSERT INTO schedules (id, child_id, title, type, location, notes, days_of_week, start_minutes,
      end_minutes, valid_from, valid_until, notify_minutes_before, needs_pickup, all_day, notify_end_minutes_before)
    VALUES
      (10, 3, '학교', 'school', NULL, NULL, 62, 540, 870, '2026-03-02', NULL, NULL, 0, 0, NULL),
      (11, 7, '피아노', 'academy', '피아노학원', '책 챙기기', 20, 900, 960, '2026-03-02', '2026-12-31', 10, 1, 0, 5),
      (12, 7, '현장학습', 'activity', NULL, NULL, 0, 0, 1440, '2026-11-20', NULL, NULL, 0, 1, NULL);
    -- ADR-013: 학교 is shared by both kids + the guardian.
    INSERT INTO schedule_children (schedule_id, child_id) VALUES (10, 7);
    UPDATE schedules SET with_guardian = 1 WHERE id = 10;
    INSERT INTO schedule_exceptions (id, schedule_id, date, kind, override_start_minutes, override_end_minutes, override_title)
    VALUES (20, 11, '2026-11-17', 'modify', 960, 1020, '피아노(보강)'), (21, 10, '2026-11-18', 'cancel', NULL, NULL, NULL);
    INSERT INTO notification_settings (child_id, default_minutes_before, sound, enabled) VALUES (3, 15, 1, 1), (7, 30, 0, 1);
    INSERT INTO checklist_items (id, schedule_id, label, sort_order, is_done, done_at, occurrence_date, recurring)
    VALUES (30, 11, '피아노 책', 0, 1, 1700000000000, NULL, 1), (31, 11, '연필', 1, 0, NULL, 20261117, 0),
           (32, 11, '물통', 2, 0, NULL, 20261110, 1);
    INSERT INTO todos (id, child_id, title, due_at, notify_minutes_before, is_done, done_at, created_at)
    VALUES (40, 7, '숙제 사인', 1763000000000, 60, 1, 1762900000000, 1762800000000),
           (41, NULL, '우유 사기', 1763100000000, NULL, 0, NULL, 1762800000000);
    INSERT INTO schedule_pickup_log (id, schedule_id, occurrence_date, completed_at) VALUES (50, 11, 20261110, 1762780000000);
    INSERT INTO checklist_completion (id, checklist_item_id, occurrence_date, completed_at) VALUES (60, 30, 20261110, 1762770000000);
    INSERT INTO app_settings (key, value) VALUES ('system_notifications_enabled', '1'), ('appearance', 'dark');
  `);
  if (opts.guardian === true) {
    target.exec(`INSERT INTO app_settings (key, value) VALUES ('guardian_enabled', '1'), ('guardian_calendar_ids', '["A"]');`);
  }
}

async function exportedFromSeed(): Promise<ExportEnvelope> {
  const otherPath = resolve(tmpdir(), 'schedulapp-tests', `db-import-src-${randomUUID()}.db`);
  const other = new DatabaseSync(otherPath);
  const odb = wrap(other);
  await runMigrations(odb as never);
  seed(other);
  const { envelope } = await exportDb(odb as never, new Date('2026-11-10T13:15:00.000Z'));
  other.close();
  rmSync(otherPath, { force: true });
  return envelope;
}

function ok(text: string): BackupData {
  const r = parseBackup(text);
  if (r.kind !== 'ok') throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r.data;
}

const strip = (e: ExportEnvelope): Omit<ExportEnvelope, 'exportedAt'> => {
  const { exportedAt: _ignored, ...rest } = e;
  return rest;
};

describe('importDb — round trip', () => {
  test('export → import → export gives the same data (ids and links kept)', async () => {
    const source = await exportedFromSeed();
    await importDb(db as never, ok(JSON.stringify(source)));
    const again = (await exportDb(db as never)).envelope;
    expect(strip(again)).toEqual(strip(source));
  });

  test('replaces what was there, keeps this device’s guardian_* settings', async () => {
    real.exec(`
      INSERT INTO children (id, name, color_index, avatar, created_at) VALUES (1, '옛날아이', 1, 'face-dizzy', '2025-01-01');
      INSERT INTO app_settings (key, value) VALUES ('guardian_enabled', '1'), ('appearance', 'light');
    `);
    await importDb(db as never, ok(JSON.stringify(await exportedFromSeed())));
    const kids = await db.getAllAsync<{ name: string }>('SELECT name FROM children ORDER BY id');
    expect(kids.map((k) => k.name)).toEqual(['민준', '서연']);
    const settings = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM app_settings ORDER BY key');
    expect(settings).toEqual([
      { key: 'appearance', value: 'dark' },
      { key: 'guardian_enabled', value: '1' },
      { key: 'system_notifications_enabled', value: '1' },
    ]);
  });

  test('guardian_* keys inside a file are ignored', async () => {
    const env = await exportedFromSeed();
    env.appSettings.push({ key: 'guardian_write_calendar_id', value: 'X' });
    const data = ok(JSON.stringify(env));
    expect(data.appSettings.some((s) => s.key.startsWith('guardian_'))).toBe(false);
  });

  test('a failure part-way keeps the original data byte for byte', async () => {
    seed(real, { guardian: true });
    const before = await exportDb(db as never);
    const data = ok(JSON.stringify(await exportedFromSeed()));
    // Sneak a row past validation that violates the label CHECK.
    data.checklistItems.push({ ...data.checklistItems[0]!, id: 99, label: 'x'.repeat(61) });
    await expect(importDb(db as never, data)).rejects.toThrow();
    const after = await exportDb(db as never);
    expect(strip(after.envelope)).toEqual(strip(before.envelope));
    expect(await db.getAllAsync('SELECT key FROM app_settings WHERE key LIKE ?', ['guardian%'])).toHaveLength(2);
  });

  test('a reference the validator missed is caught by foreign_key_check and rolled back', async () => {
    real.exec('PRAGMA foreign_keys = OFF'); // the exclusive connection has FKs off
    const data = ok(JSON.stringify(await exportedFromSeed()));
    data.pickupLog.push({ id: 98, scheduleId: 999, occurrenceDate: 20261111, completedAt: 1 });
    await expect(importDb(db as never, data)).rejects.toThrow('broken references');
    expect(await db.getAllAsync('SELECT id FROM children')).toEqual([]);
  });
});

describe('parseBackup — shared schedules (v6, ADR-013)', () => {
  test('v6 keeps members + withGuardian; v5 files get the one kid', async () => {
    const env = await exportedFromSeed();
    const v6 = ok(JSON.stringify(env));
    expect(v6.schedules.find((x) => x.id === 10)).toMatchObject({ childId: 3, memberIds: [3, 7], withGuardian: true });
    const old = JSON.parse(JSON.stringify(env)) as Record<string, unknown>;
    old.schemaVersion = 5;
    for (const x of old.schedules as Record<string, unknown>[]) {
      delete x.memberIds;
      delete x.withGuardian;
    }
    const v5 = ok(JSON.stringify(old));
    expect(v5.schedules.map((x) => x.memberIds)).toEqual([[3], [7], [7]]);
    expect(v5.schedules.every((x) => !x.withGuardian)).toBe(true);
  });

  test('bad members → invalid', async () => {
    const env = await exportedFromSeed();
    const bad = (mut: (x: Record<string, unknown>) => void): string => {
      const e = JSON.parse(JSON.stringify(env)) as { schedules: Record<string, unknown>[] };
      mut(e.schedules[0]!);
      return parseBackup(JSON.stringify(e)).kind;
    };
    expect(bad((x) => delete x.memberIds)).toBe('invalid');
    expect(bad((x) => (x.memberIds = [7]))).toBe('invalid'); // main kid missing
    expect(bad((x) => (x.memberIds = [3, 3]))).toBe('invalid');
    expect(bad((x) => (x.memberIds = [3, 99]))).toBe('invalid');
  });

  test('import replaces old memberships (FKs off on the exclusive connection)', async () => {
    real.exec(`
      INSERT INTO children (id, name, color_index, avatar, created_at) VALUES (3, '옛날', 0, 'face-wink', '2025-01-01'), (9, '옛날2', 1, 'face-dizzy', '2025-01-01');
      INSERT INTO schedules (id, child_id, title, type, days_of_week, start_minutes, end_minutes, valid_from) VALUES (11, 3, '옛 일정', 'other', 1, 0, 60, '2025-01-01');
      INSERT INTO schedule_children (schedule_id, child_id) VALUES (11, 9);
    `);
    real.exec('PRAGMA foreign_keys = OFF');
    await importDb(db as never, ok(JSON.stringify(await exportedFromSeed())));
    const rows = await db.getAllAsync<{ schedule_id: number; child_id: number }>('SELECT schedule_id, child_id FROM schedule_children ORDER BY schedule_id, child_id');
    expect(rows).toEqual([
      { schedule_id: 10, child_id: 3 },
      { schedule_id: 10, child_id: 7 },
      { schedule_id: 11, child_id: 7 },
      { schedule_id: 12, child_id: 7 },
    ]);
  });
});

describe('parseBackup — versions', () => {
  test('v4 file: schedules get allDay false / no end alert', async () => {
    const env = (await exportedFromSeed()) as unknown as Record<string, unknown>;
    env.schemaVersion = 4;
    for (const s of env.schedules as Record<string, unknown>[]) {
      delete s.allDay;
      delete s.notifyEndMinutesBefore;
    }
    const data = ok(JSON.stringify(env));
    expect(data.schedules.every((s) => !s.allDay && s.notifyEndMinutesBefore === null)).toBe(true);
    expect(data.checklistItems.find((c) => c.id === 31)).toMatchObject({ occurrenceDate: 20261117, recurring: false });
  });

  test('v3 file (shipped v1.0.0): no appSettings, membership → NULL anchor + 매번', async () => {
    const env = (await exportedFromSeed()) as unknown as Record<string, unknown>;
    env.schemaVersion = 3;
    delete env.appSettings;
    for (const s of env.schedules as Record<string, unknown>[]) {
      delete s.allDay;
      delete s.notifyEndMinutesBefore;
    }
    for (const c of env.checklistItems as Record<string, unknown>[]) {
      delete c.occurrenceDate;
      c.recurring = false; // what the v3 mapper wrote — not data
    }
    const data = ok(JSON.stringify(env));
    expect(data.appSettings).toEqual([]);
    expect(data.checklistItems.every((c) => c.occurrenceDate === null && c.recurring)).toBe(true);
    await importDb(db as never, data);
    expect(await db.getAllAsync('SELECT key FROM app_settings')).toEqual([]);
  });

  test('newer / too old / not ours', () => {
    expect(parseBackup(JSON.stringify({ schemaVersion: 7 })).kind).toBe('newer');
    expect(parseBackup(JSON.stringify({ schemaVersion: 2 })).kind).toBe('tooOld');
    expect(parseBackup(JSON.stringify({ schemaVersion: 1 })).kind).toBe('tooOld');
    expect(parseBackup('not json').kind).toBe('invalid');
    expect(parseBackup('{}').kind).toBe('invalid');
    expect(parseBackup('[]').kind).toBe('invalid');
    expect(parseBackup(JSON.stringify({ schemaVersion: 5 })).kind).toBe('invalid'); // arrays missing
  });

  test('a UTF-8 BOM is tolerated', async () => {
    expect(parseBackup(`﻿${JSON.stringify(await exportedFromSeed())}`).kind).toBe('ok');
  });

  test('summary: counts and the export time', async () => {
    const r = parseBackup(JSON.stringify(await exportedFromSeed()));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.summary).toMatchObject({ kids: 2, schedules: 3, checklist: 3, todos: 2, schemaVersion: 6 });
    expect(r.summary.exportedAt?.toISOString()).toBe('2026-11-10T13:15:00.000Z');
  });
});

describe('parseBackup — rules', () => {
  async function mutate(fn: (env: Record<string, any>) => void): Promise<string> {
    const env = (await exportedFromSeed()) as unknown as Record<string, any>;
    fn(env);
    return parseBackup(JSON.stringify(env)).kind;
  }

  test('no kids → empty', async () => {
    expect(
      await mutate((e) => {
        e.children = [];
        e.schedules = [];
        e.exceptions = [];
        e.notificationSettings = [];
        e.checklistItems = [];
        e.pickupLog = [];
        e.checklistCompletion = [];
        e.todos = [];
      }),
    ).toBe('empty');
  });

  test('more than 4 kids → invalid; a repeated avatar is fine (pre-v3 kids all got face-wink)', async () => {
    const extra = (id: number, avatar: string) => ({ id, name: `k${id}`, colorIndex: 0, avatar, createdAt: '2026-01-01' });
    expect(
      await mutate((e) => {
        e.children.push(extra(8, 'face-cool'), extra(9, 'face-sleep'), extra(10, 'face-dizzy'));
      }),
    ).toBe('invalid');
    expect(await mutate((e) => e.children.push(extra(8, 'face-wink')))).toBe('ok');
  });

  test('an unknown avatar falls back to the one paired with its colour', async () => {
    const env = (await exportedFromSeed()) as unknown as Record<string, any>;
    env.children[1].avatar = 'face-happy';
    env.children[1].colorIndex = 2;
    expect(ok(JSON.stringify(env)).children[1]).toMatchObject({ avatar: 'face-cool', colorIndex: 2 });
  });

  test('the dev seed (repeated avatars) exports and parses', async () => {
    await seedDevData(db as never);
    const r = parseBackup((await exportDb(db as never)).json);
    expect(r.kind).toBe('ok');
  });

  test('colour is rewritten from the avatar', async () => {
    const env = (await exportedFromSeed()) as unknown as Record<string, any>;
    env.children[0].colorIndex = 4;
    const data = ok(JSON.stringify(env));
    expect(data.children[0]?.colorIndex).toBe(0); // face-wink → 0
  });

  test('broken references and CHECK rules → invalid (not a SQL error)', async () => {
    expect(await mutate((e) => (e.schedules[0].childId = 99))).toBe('invalid');
    expect(await mutate((e) => (e.checklistItems[0].scheduleId = 99))).toBe('invalid');
    expect(await mutate((e) => (e.checklistCompletion[0].checklistItemId = 99))).toBe('invalid');
    expect(await mutate((e) => (e.todos[0].childId = 99))).toBe('invalid');
    expect(await mutate((e) => (e.checklistItems[0].label = 'x'.repeat(61)))).toBe('invalid');
    expect(await mutate((e) => (e.todos[0].title = 'x'.repeat(121)))).toBe('invalid');
    expect(await mutate((e) => (e.schedules[0].type = 'party'))).toBe('invalid');
    expect(await mutate((e) => (e.exceptions[0].kind = 'move'))).toBe('invalid');
    expect(await mutate((e) => (e.schedules[1].id = e.schedules[0].id))).toBe('invalid');
    expect(await mutate((e) => (e.schedules[0].startMinutes = '9:00'))).toBe('invalid');
  });

  test('a todo with no kid is fine', async () => {
    expect(await mutate(() => {})).toBe('ok');
  });
});
