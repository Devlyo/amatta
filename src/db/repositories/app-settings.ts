// Generic key-value repo over the `app_settings` table (migration v5).
//
// app_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL) is the persistence
// layer for app-global settings that must survive relaunch — currently the
// notification settings (system on/off + default lead time). Values are
// always stored as TEXT; callers serialize/deserialize (e.g. '0'/'1' for
// booleans, the decimal string for ints).

import type { SQLiteDatabase } from 'expo-sqlite';

/** Read a raw string value, or null if the key is absent. */
export async function getString(
  db: SQLiteDatabase,
  key: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = ?`,
    [key],
  );
  return row ? row.value : null;
}

/** Write a string value (UPSERT on the primary key). */
export async function setString(
  db: SQLiteDatabase,
  key: string,
  value: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

/** Read a boolean ('1' → true, '0' → false), or null if the key is absent. */
export async function getBool(
  db: SQLiteDatabase,
  key: string,
): Promise<boolean | null> {
  const v = await getString(db, key);
  if (v === null) return null;
  return v === '1';
}

/** Write a boolean as '1' | '0'. */
export async function setBool(
  db: SQLiteDatabase,
  key: string,
  value: boolean,
): Promise<void> {
  await setString(db, key, value ? '1' : '0');
}

/** Read an integer, or null if the key is absent or unparseable. */
export async function getInt(
  db: SQLiteDatabase,
  key: string,
): Promise<number | null> {
  const v = await getString(db, key);
  if (v === null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

/** Write an integer as its decimal string. */
export async function setInt(
  db: SQLiteDatabase,
  key: string,
  value: number,
): Promise<void> {
  await setString(db, key, String(value));
}

/** Delete every row — used by the reset/wipe flow for a clean slate. */
export async function clearAll(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DELETE FROM app_settings');
}
