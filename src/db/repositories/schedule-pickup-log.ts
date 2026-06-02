import type { SQLiteDatabase } from 'expo-sqlite';

import type { SchedulePickupLog } from '../../domain/types';
import {
  rowToSchedulePickupLog,
  type SchedulePickupLogRow,
} from '../row-mappers';

export interface MarkCompleteInput {
  scheduleId: number;
  occurrenceDate: number; // yyyymmdd int
  completedAt: number; // epoch ms
}

const SELECT_LOG = `SELECT id, schedule_id, occurrence_date, completed_at
                    FROM schedule_pickup_log`;

export async function markComplete(
  db: SQLiteDatabase,
  input: MarkCompleteInput,
): Promise<SchedulePickupLog> {
  // Idempotent: UNIQUE(schedule_id, occurrence_date) collision is silently ignored.
  await db.runAsync(
    `INSERT OR IGNORE INTO schedule_pickup_log
       (schedule_id, occurrence_date, completed_at)
     VALUES (?, ?, ?)`,
    [input.scheduleId, input.occurrenceDate, input.completedAt],
  );
  const row = await db.getFirstAsync<SchedulePickupLogRow>(
    `${SELECT_LOG} WHERE schedule_id = ? AND occurrence_date = ?`,
    [input.scheduleId, input.occurrenceDate],
  );
  if (!row) throw new Error('Failed to retrieve pickup log row after markComplete');
  return rowToSchedulePickupLog(row);
}

export async function clearComplete(
  db: SQLiteDatabase,
  scheduleId: number,
  occurrenceDate: number,
): Promise<void> {
  await db.runAsync(
    `DELETE FROM schedule_pickup_log
     WHERE schedule_id = ? AND occurrence_date = ?`,
    [scheduleId, occurrenceDate],
  );
}

export async function isComplete(
  db: SQLiteDatabase,
  scheduleId: number,
  occurrenceDate: number,
): Promise<boolean> {
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM schedule_pickup_log
     WHERE schedule_id = ? AND occurrence_date = ?`,
    [scheduleId, occurrenceDate],
  );
  return (row?.c ?? 0) > 0;
}

export async function listForSchedule(
  db: SQLiteDatabase,
  scheduleId: number,
): Promise<SchedulePickupLog[]> {
  const rows = await db.getAllAsync<SchedulePickupLogRow>(
    `${SELECT_LOG} WHERE schedule_id = ? ORDER BY occurrence_date ASC`,
    [scheduleId],
  );
  return rows.map(rowToSchedulePickupLog);
}

export async function listForDate(
  db: SQLiteDatabase,
  occurrenceDate: number,
): Promise<SchedulePickupLog[]> {
  const rows = await db.getAllAsync<SchedulePickupLogRow>(
    `${SELECT_LOG} WHERE occurrence_date = ? ORDER BY schedule_id ASC`,
    [occurrenceDate],
  );
  return rows.map(rowToSchedulePickupLog);
}
