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

  test('Test A: fresh DB → user_version=1 and all 4 tables exist', async () => {
    const { real } = makeDb();
    const wrapped = wrap(real);
    await runMigrations(wrapped as unknown as Parameters<typeof runMigrations>[0]);

    expect(userVersion(real)).toBe(1);
    const tables = tableNames(real);
    expect(tables).toEqual(
      expect.arrayContaining([
        'children',
        'schedules',
        'schedule_exceptions',
        'notification_settings',
      ]),
    );
    real.close();
  });

  test('Test B: idempotent — running twice yields no error and version stays 1', async () => {
    const { real } = makeDb();
    const wrapped = wrap(real);

    await runMigrations(wrapped as unknown as Parameters<typeof runMigrations>[0]);
    await expect(
      runMigrations(wrapped as unknown as Parameters<typeof runMigrations>[0]),
    ).resolves.toBeUndefined();

    expect(userVersion(real)).toBe(1);
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

    expect(modes).toHaveLength(1);
    expect(modes[0]).toBe('explicit-begin');

    // Persist the chosen tx-mode for team-lead per the task spec.
    mkdirSync(dirname(TX_LOG_PATH), { recursive: true });
    appendFileSync(TX_LOG_PATH, ''); // ensure file exists; actual line is written in afterAll below.
    txModeChosen = modes[0]!;
    real.close();
  });

  test('Test D2: tx-mode logging — fallback path is exercised when BEGIN IMMEDIATE is rejected', async () => {
    const { real } = makeDb();
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

    expect(modes).toEqual(['fallback-with-transaction']);
    expect(userVersion(real)).toBe(1);
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
