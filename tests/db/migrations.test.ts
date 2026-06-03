// Migration tests.
//
// expo-sqlite is a native module and is not usable in the jest-expo runtime,
// so this test file builds a thin SQLiteDatabase-shaped wrapper around
// node:sqlite (DatabaseSync) — which exists in Node ≥22 and runs synchronously
// against an actual SQLite engine. That gives Test A/B a real schema to inspect
// and Test C a real on-disk file that we can re-open after the simulated crash.
//
// Per worker-db's handoff, the migration test uses a TEMP FILE DB (not
// :memory:) so we can close, reopen, and assert post-crash state on the same
// database file.

import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations, type TxMode } from '../../src/db/migrations';
import { migration001 } from '../../src/db/migrations/001_init.sql';

const TX_LOG_PATH = resolve(__dirname, '..', '..', '.omc', 'logs', 'phase1-tx-mode.txt');

// Minimal subset of expo-sqlite's SQLiteDatabase that runMigrations uses.
interface MinimalDb {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}

interface WrapOpts {
  // When set, the first matching execAsync call throws once with this error,
  // then the spy is disarmed.
  execThrowOnce?: { match: RegExp; error: Error };
}

function wrap(real: DatabaseSync, opts: WrapOpts = {}): MinimalDb {
  let armed = opts.execThrowOnce !== undefined;
  return {
    async execAsync(sql: string) {
      if (armed && opts.execThrowOnce && opts.execThrowOnce.match.test(sql)) {
        armed = false;
        throw opts.execThrowOnce.error;
      }
      real.exec(sql);
    },
    async getFirstAsync<T>(sql: string) {
      const row = real.prepare(sql).get() as unknown;
      return (row as T) ?? null;
    },
    async withTransactionAsync(fn: () => Promise<void>) {
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
  return resolve(dir, `mig-${randomUUID()}.db`);
}

function tableNames(db: DatabaseSync): string[] {
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
  return rows.map((r) => r.name);
}

function indexNames(db: DatabaseSync): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}

function columnNames(db: DatabaseSync, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.map((r) => r.name);
}

function userVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
  return row?.user_version ?? -1;
}

describe('runMigrations', () => {
  const created: string[] = [];

  afterEach(() => {
    for (const p of created) {
      try {
        rmSync(p, { force: true });
        rmSync(`${p}-journal`, { force: true });
        rmSync(`${p}-wal`, { force: true });
        rmSync(`${p}-shm`, { force: true });
      } catch {
        /* ignore */
      }
    }
    created.length = 0;
  });

  function makeDb(): { real: DatabaseSync; path: string } {
    const path = tmpDbPath();
    created.push(path);
    return { real: new DatabaseSync(path), path };
  }

  test('Test A: fresh DB → user_version=4 and all 7 tables exist', async () => {
    const { real } = makeDb();
    const wrapped = wrap(real);
    await runMigrations(wrapped as unknown as Parameters<typeof runMigrations>[0]);

    expect(userVersion(real)).toBe(4);
    const tables = tableNames(real);
    expect(tables).toEqual(
      expect.arrayContaining([
        'children',
        'schedules',
        'schedule_exceptions',
        'notification_settings',
        'checklist_items',
        'todos',
        'schedule_pickup_log',
      ]),
    );
    real.close();
  });

  test('Test B: idempotent — running twice yields no error and version stays 4', async () => {
    const { real } = makeDb();
    const wrapped = wrap(real);

    await runMigrations(wrapped as unknown as Parameters<typeof runMigrations>[0]);
    await expect(
      runMigrations(wrapped as unknown as Parameters<typeof runMigrations>[0]),
    ).resolves.toBeUndefined();

    expect(userVersion(real)).toBe(4);
    real.close();
  });

  test('Test C: crash-recovery — throw during PRAGMA user_version rolls back atomically', async () => {
    const path = tmpDbPath();
    created.push(path);

    // First connection: make the migration runner throw mid-tx while writing
    // user_version. ROLLBACK should leave the schema untouched.
    const first = new DatabaseSync(path);
    const wrapped = wrap(first, {
      execThrowOnce: {
        match: /^PRAGMA user_version\s*=\s*\d+$/,
        error: new Error('synthetic crash before commit'),
      },
    });

    await expect(
      runMigrations(wrapped as unknown as Parameters<typeof runMigrations>[0]),
    ).rejects.toThrow('synthetic crash before commit');

    first.close();

    // Re-open the same file — schema must be empty, version must still be 0.
    expect(existsSync(path)).toBe(true);
    const second = new DatabaseSync(path);
    expect(userVersion(second)).toBe(0);
    const tables = tableNames(second);
    for (const t of ['children', 'schedules', 'schedule_exceptions', 'notification_settings']) {
      expect(tables).not.toContain(t);
    }
    second.close();
  });

  test('Test D: tx-mode logging — callback fires exactly once with explicit-begin on the happy path', async () => {
    const { real } = makeDb();
    const wrapped = wrap(real);
    const modes: TxMode[] = [];

    await runMigrations(
      wrapped as unknown as Parameters<typeof runMigrations>[0],
      { logTxModeTo: (m) => modes.push(m) },
    );

    // Happy path now applies v1 + v2 + v3 + v4 — one log per migration.
    expect(modes).toEqual([
      'explicit-begin',
      'explicit-begin',
      'explicit-begin',
      'explicit-begin',
    ]);

    // Persist the chosen tx-mode for team-lead per the task spec.
    mkdirSync(dirname(TX_LOG_PATH), { recursive: true });
    appendFileSync(TX_LOG_PATH, ''); // ensure file exists; actual line is written in afterAll below.
    txModeChosen = modes[0]!;
    real.close();
  });

  test('Test D2: tx-mode logging — fallback path is exercised when BEGIN IMMEDIATE is rejected', async () => {
    const { real } = makeDb();
    // execThrowOnce fires on the FIRST BEGIN IMMEDIATE (migration v1) and
    // then disarms — so v1 takes the fallback path while v2 proceeds via
    // explicit-begin. The test still asserts the fallback path is exercised.
    const wrapped = wrap(real, {
      execThrowOnce: {
        match: /^BEGIN IMMEDIATE$/,
        error: new Error('cannot start a transaction within a DDL statement'),
      },
    });
    const modes: TxMode[] = [];

    await runMigrations(
      wrapped as unknown as Parameters<typeof runMigrations>[0],
      { logTxModeTo: (m) => modes.push(m) },
    );

    expect(modes).toEqual([
      'fallback-with-transaction',
      'explicit-begin',
      'explicit-begin',
      'explicit-begin',
    ]);
    expect(userVersion(real)).toBe(4);
    real.close();
  });

  test('Test E: fresh DB → v2 applied, all 7 tables + 3 new indexes exist', async () => {
    const { real } = makeDb();
    const wrapped = wrap(real);
    await runMigrations(wrapped as unknown as Parameters<typeof runMigrations>[0]);

    expect(userVersion(real)).toBe(4);

    const tables = tableNames(real);
    expect(tables).toEqual(
      expect.arrayContaining([
        'children',
        'schedules',
        'schedule_exceptions',
        'notification_settings',
        'checklist_items',
        'todos',
        'schedule_pickup_log',
      ]),
    );

    const indexes = indexNames(real);
    expect(indexes).toEqual(
      expect.arrayContaining([
        'idx_checklist_schedule',
        'idx_todos_due',
        'idx_pickup_schedule_date',
      ]),
    );

    real.close();
  });

  test('Test F: v1-applied DB → runMigrations applies v2 + v3, ends at user_version=4', async () => {
    const { real } = makeDb();

    // Land at v1 first by execing migration001 directly + setting user_version=1.
    real.exec('BEGIN');
    real.exec(migration001);
    real.exec('PRAGMA user_version = 1');
    real.exec('COMMIT');
    expect(userVersion(real)).toBe(1);

    const wrapped = wrap(real);
    await runMigrations(wrapped as unknown as Parameters<typeof runMigrations>[0]);

    expect(userVersion(real)).toBe(4);
    const tables = tableNames(real);
    expect(tables).toEqual(
      expect.arrayContaining(['checklist_items', 'todos', 'schedule_pickup_log']),
    );
    real.close();
  });

  test('Test G: schedules.needs_pickup column exists after v2, defaults to 0 on existing rows', async () => {
    const { real } = makeDb();

    // Land at v1 first and insert a child + schedule (pre-v2 row).
    real.exec('BEGIN');
    real.exec(migration001);
    real.exec('PRAGMA user_version = 1');
    real.exec('COMMIT');

    real.exec(
      `INSERT INTO children (name, color_index, created_at) VALUES ('민준', 0, '2026-06-02T00:00:00.000Z')`,
    );
    real.exec(
      `INSERT INTO schedules (child_id, title, type, days_of_week, start_minutes, end_minutes, valid_from)
       VALUES (1, '수영', 'academy', 64, 1080, 1140, '2026-06-01')`,
    );

    // Now migrate to v3 (v2 + v3 both apply on top of v1).
    const wrapped = wrap(real);
    await runMigrations(wrapped as unknown as Parameters<typeof runMigrations>[0]);

    expect(userVersion(real)).toBe(4);
    expect(columnNames(real, 'schedules')).toEqual(
      expect.arrayContaining(['needs_pickup']),
    );

    const row = real
      .prepare('SELECT needs_pickup FROM schedules WHERE id = 1')
      .get() as { needs_pickup: number } | undefined;
    expect(row?.needs_pickup).toBe(0);
    real.close();
  });

  test('Test H: crash-recovery v2 — throw during PRAGMA user_version=2 leaves v1 intact, no v2 artifacts', async () => {
    const path = tmpDbPath();
    created.push(path);

    // Throw only on v2's PRAGMA (the v1 PRAGMA "= 1" won't match the "= 2" regex).
    const first = new DatabaseSync(path);
    const wrapped = wrap(first, {
      execThrowOnce: {
        match: /^PRAGMA user_version\s*=\s*2$/,
        error: new Error('synthetic crash before v2 commit'),
      },
    });

    await expect(
      runMigrations(wrapped as unknown as Parameters<typeof runMigrations>[0]),
    ).rejects.toThrow('synthetic crash before v2 commit');

    first.close();

    // Re-open the same file. v1 must be fully committed; v2 must be entirely absent.
    expect(existsSync(path)).toBe(true);
    const second = new DatabaseSync(path);
    expect(userVersion(second)).toBe(1);

    const tables = tableNames(second);
    // v1 tables present:
    expect(tables).toEqual(
      expect.arrayContaining([
        'children',
        'schedules',
        'schedule_exceptions',
        'notification_settings',
      ]),
    );
    // v2 tables absent:
    for (const t of ['checklist_items', 'todos', 'schedule_pickup_log']) {
      expect(tables).not.toContain(t);
    }
    // needs_pickup column absent on schedules:
    expect(columnNames(second, 'schedules')).not.toEqual(
      expect.arrayContaining(['needs_pickup']),
    );
    second.close();
  });

  test('Test I: v3 adds children.avatar column with default "face-wink" for pre-v3 rows', async () => {
    const { real } = makeDb();

    // Land at v1 then insert a child (so a pre-v3 row exists when v3 runs).
    real.exec('BEGIN');
    real.exec(migration001);
    real.exec('PRAGMA user_version = 1');
    real.exec('COMMIT');
    real.exec(
      `INSERT INTO children (name, color_index, created_at) VALUES ('민준', 0, '2026-06-02')`,
    );

    // Migrate forward — v2 then v3 should both apply on top of v1.
    const wrapped = wrap(real);
    await runMigrations(wrapped as unknown as Parameters<typeof runMigrations>[0]);

    expect(userVersion(real)).toBe(4);
    expect(columnNames(real, 'children')).toEqual(
      expect.arrayContaining(['avatar']),
    );

    const row = real
      .prepare('SELECT avatar FROM children WHERE id = 1')
      .get() as { avatar: string } | undefined;
    expect(row?.avatar).toBe('face-wink');
    real.close();
  });
});

// Tracks which tx path the migration runner picked on the happy-path Test D,
// then writes it to .omc/logs/phase1-tx-mode.txt after the file's tests finish.
let txModeChosen: TxMode | null = null;

afterAll(() => {
  if (txModeChosen !== null) {
    mkdirSync(dirname(TX_LOG_PATH), { recursive: true });
    // Overwrite (not append) so this file always reflects the most recent run.
    require('node:fs').writeFileSync(
      TX_LOG_PATH,
      `${txModeChosen}\n`,
      'utf8',
    );
  }
});
