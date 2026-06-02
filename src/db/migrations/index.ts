import type { SQLiteDatabase } from 'expo-sqlite';
import { migration001 } from './001_init.sql';
import { migration002 } from './002_v2_prep_todos_pickup.sql';

export type TxMode = 'explicit-begin' | 'fallback-with-transaction';

export interface RunMigrationsOptions {
  logTxModeTo?: (mode: TxMode) => void;
}

export interface Migration {
  readonly version: number;
  readonly sql: string;
}

export const MIGRATIONS: ReadonlyArray<Migration> = [
  { version: 1, sql: migration001 },
  { version: 2, sql: migration002 },
];

export async function runMigrations(
  db: SQLiteDatabase,
  opts?: RunMigrationsOptions,
): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.execAsync('PRAGMA journal_mode = WAL');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  for (const m of MIGRATIONS) {
    if (m.version <= currentVersion) continue;
    await applyMigrationAtomic(db, m, opts);
  }
}

async function applyMigrationAtomic(
  db: SQLiteDatabase,
  m: Migration,
  opts: RunMigrationsOptions | undefined,
): Promise<void> {
  try {
    await db.execAsync('BEGIN IMMEDIATE');
    try {
      await db.execAsync(m.sql);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
      await db.execAsync('COMMIT');
    } catch (inner) {
      await db.execAsync('ROLLBACK').catch(() => undefined);
      throw inner;
    }
    opts?.logTxModeTo?.('explicit-begin');
    return;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e ?? '');
    const isDdlInTxRejected = /cannot.*DDL|not allowed.*transaction/i.test(msg);
    if (!isDdlInTxRejected) throw e;

    await db.withTransactionAsync(async () => {
      await db.execAsync(m.sql);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    });
    opts?.logTxModeTo?.('fallback-with-transaction');
  }
}
