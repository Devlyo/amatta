// Destructive utility — clears every row from the app's user-data tables.
// Schema, indexes, and PRAGMA user_version are left intact, so the
// migration runner does not re-run on the next boot.
//
// Delete order respects foreign-key dependencies even though every FK is
// declared ON DELETE CASCADE. We delete leaves before parents anyway so
// the row counts are predictable in the log (and a future test can
// inspect them).
//
// Wired from app/(tabs)/settings.tsx "모든 데이터 초기화" → ResetConfirmSheet
// 초기화하기 button.

import type { SQLiteDatabase } from 'expo-sqlite';

const TABLES_LEAF_FIRST = [
  'schedule_pickup_log',
  'checklist_items',
  'schedule_exceptions',
  'todos',
  'notification_settings',
  'schedules',
  'children',
] as const;

export async function wipeAllData(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.withTransactionAsync(async () => {
    for (const t of TABLES_LEAF_FIRST) {
      await db.execAsync(`DELETE FROM ${t}`);
    }
    // Reset the AUTOINCREMENT counters so the next inserts start at id=1
    // again. sqlite_sequence may not exist if no AUTOINCREMENT row was
    // ever inserted; guard with IF EXISTS via a defensive try/catch.
    try {
      await db.execAsync(`DELETE FROM sqlite_sequence`);
    } catch {
      /* sqlite_sequence absent — fine. */
    }
  });
}
