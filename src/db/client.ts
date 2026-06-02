import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

const DEFAULT_DB_NAME = 'schedulapp.db';

let cachedDb: SQLiteDatabase | null = null;
let cachedName: string | null = null;

export async function openDb(name: string = DEFAULT_DB_NAME): Promise<SQLiteDatabase> {
  return openDatabaseAsync(name);
}

export async function getDb(name: string = DEFAULT_DB_NAME): Promise<SQLiteDatabase> {
  if (cachedDb && cachedName === name) {
    return cachedDb;
  }
  if (cachedDb && cachedName !== name) {
    await cachedDb.closeAsync().catch(() => undefined);
    cachedDb = null;
    cachedName = null;
  }
  const db = await openDatabaseAsync(name);
  cachedDb = db;
  cachedName = name;
  return db;
}

export async function resetDbForTests(): Promise<void> {
  if (cachedDb) {
    await cachedDb.closeAsync().catch(() => undefined);
  }
  cachedDb = null;
  cachedName = null;
}
