import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';

import type { ISODate, ScheduleException } from '../../domain/types';
import { rowToScheduleException, type ScheduleExceptionRow } from '../row-mappers';

export type NewScheduleException = Omit<ScheduleException, 'id'>;

export async function getById(db: SQLiteDatabase, id: number): Promise<ScheduleException | null> {
  const row = await db.getFirstAsync<ScheduleExceptionRow>(
    `SELECT id, schedule_id, date, kind,
            override_start_minutes, override_end_minutes, override_title
     FROM schedule_exceptions WHERE id = ?`,
    [id],
  );
  return row ? rowToScheduleException(row) : null;
}

export async function list(db: SQLiteDatabase): Promise<ScheduleException[]> {
  const rows = await db.getAllAsync<ScheduleExceptionRow>(
    `SELECT id, schedule_id, date, kind,
            override_start_minutes, override_end_minutes, override_title
     FROM schedule_exceptions ORDER BY id ASC`,
  );
  return rows.map(rowToScheduleException);
}

export async function listBySchedule(
  db: SQLiteDatabase,
  scheduleId: number,
): Promise<ScheduleException[]> {
  const rows = await db.getAllAsync<ScheduleExceptionRow>(
    `SELECT id, schedule_id, date, kind,
            override_start_minutes, override_end_minutes, override_title
     FROM schedule_exceptions WHERE schedule_id = ? ORDER BY date ASC`,
    [scheduleId],
  );
  return rows.map(rowToScheduleException);
}

// TODO(v3): S4 UPSERT — currently plain INSERT; caller must delete-then-create
// for UPSERT semantics. ON CONFLICT(schedule_id, date) DO UPDATE deferred per
// branch decision (S4 open question).
export async function create(
  db: SQLiteDatabase,
  input: NewScheduleException,
): Promise<ScheduleException> {
  const result = await db.runAsync(
    `INSERT INTO schedule_exceptions
       (schedule_id, date, kind,
        override_start_minutes, override_end_minutes, override_title)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.scheduleId,
      input.date as string,
      input.kind,
      input.overrideStartMinutes ?? null,
      input.overrideEndMinutes ?? null,
      input.overrideTitle ?? null,
    ],
  );
  const exception = await getById(db, result.lastInsertRowId);
  if (!exception) throw new Error('Failed to retrieve newly created schedule exception');
  return exception;
}

export async function update(
  db: SQLiteDatabase,
  id: number,
  patch: Partial<Omit<ScheduleException, 'id'>>,
): Promise<ScheduleException> {
  const fields: string[] = [];
  const values: SQLiteBindValue[] = [];

  if (patch.scheduleId !== undefined) {
    fields.push('schedule_id = ?');
    values.push(patch.scheduleId);
  }
  if (patch.date !== undefined) {
    fields.push('date = ?');
    values.push(patch.date as string);
  }
  if (patch.kind !== undefined) {
    fields.push('kind = ?');
    values.push(patch.kind);
  }
  if (patch.overrideStartMinutes !== undefined) {
    fields.push('override_start_minutes = ?');
    values.push(patch.overrideStartMinutes);
  }
  if (patch.overrideEndMinutes !== undefined) {
    fields.push('override_end_minutes = ?');
    values.push(patch.overrideEndMinutes);
  }
  if (patch.overrideTitle !== undefined) {
    fields.push('override_title = ?');
    values.push(patch.overrideTitle);
  }

  if (fields.length > 0) {
    values.push(id);
    await db.runAsync(
      `UPDATE schedule_exceptions SET ${fields.join(', ')} WHERE id = ?`,
      values,
    );
  }

  const updated = await getById(db, id);
  if (!updated) throw new Error(`ScheduleException with id ${id} not found`);
  return updated;
}

export async function remove(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM schedule_exceptions WHERE id = ?', [id]);
}

// Re-export ISODate for convenience within this module
export type { ISODate };
