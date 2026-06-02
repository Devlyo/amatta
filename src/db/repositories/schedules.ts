import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';

import type { ISODate, Schedule } from '../../domain/types';
import { rowToSchedule, type ScheduleRow } from '../row-mappers';

export type NewSchedule = Omit<Schedule, 'id'>;

export async function getById(db: SQLiteDatabase, id: number): Promise<Schedule | null> {
  const row = await db.getFirstAsync<ScheduleRow>(
    `SELECT id, child_id, title, type, location, notes,
            days_of_week, start_minutes, end_minutes,
            valid_from, valid_until, notify_minutes_before
     FROM schedules WHERE id = ?`,
    [id],
  );
  return row ? rowToSchedule(row) : null;
}

export async function list(db: SQLiteDatabase): Promise<Schedule[]> {
  const rows = await db.getAllAsync<ScheduleRow>(
    `SELECT id, child_id, title, type, location, notes,
            days_of_week, start_minutes, end_minutes,
            valid_from, valid_until, notify_minutes_before
     FROM schedules ORDER BY id ASC`,
  );
  return rows.map(rowToSchedule);
}

export async function listByChild(db: SQLiteDatabase, childId: number): Promise<Schedule[]> {
  const rows = await db.getAllAsync<ScheduleRow>(
    `SELECT id, child_id, title, type, location, notes,
            days_of_week, start_minutes, end_minutes,
            valid_from, valid_until, notify_minutes_before
     FROM schedules WHERE child_id = ? ORDER BY id ASC`,
    [childId],
  );
  return rows.map(rowToSchedule);
}

export async function create(db: SQLiteDatabase, input: NewSchedule): Promise<Schedule> {
  const result = await db.runAsync(
    `INSERT INTO schedules
       (child_id, title, type, location, notes,
        days_of_week, start_minutes, end_minutes,
        valid_from, valid_until, notify_minutes_before)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.childId,
      input.title,
      input.type,
      input.location ?? null,
      input.notes ?? null,
      input.daysOfWeek,
      input.startMinutes,
      input.endMinutes,
      input.validFrom as string,
      input.validUntil ? (input.validUntil as string) : null,
      input.notifyMinutesBefore ?? null,
    ],
  );
  const schedule = await getById(db, result.lastInsertRowId);
  if (!schedule) throw new Error('Failed to retrieve newly created schedule');
  return schedule;
}

export async function update(
  db: SQLiteDatabase,
  id: number,
  patch: Partial<Omit<Schedule, 'id'>>,
): Promise<Schedule> {
  const fields: string[] = [];
  const values: SQLiteBindValue[] = [];

  if (patch.childId !== undefined) {
    fields.push('child_id = ?');
    values.push(patch.childId);
  }
  if (patch.title !== undefined) {
    fields.push('title = ?');
    values.push(patch.title);
  }
  if (patch.type !== undefined) {
    fields.push('type = ?');
    values.push(patch.type);
  }
  if (patch.location !== undefined) {
    fields.push('location = ?');
    values.push(patch.location);
  }
  if (patch.notes !== undefined) {
    fields.push('notes = ?');
    values.push(patch.notes);
  }
  if (patch.daysOfWeek !== undefined) {
    fields.push('days_of_week = ?');
    values.push(patch.daysOfWeek);
  }
  if (patch.startMinutes !== undefined) {
    fields.push('start_minutes = ?');
    values.push(patch.startMinutes);
  }
  if (patch.endMinutes !== undefined) {
    fields.push('end_minutes = ?');
    values.push(patch.endMinutes);
  }
  if (patch.validFrom !== undefined) {
    fields.push('valid_from = ?');
    values.push(patch.validFrom as string);
  }
  if (patch.validUntil !== undefined) {
    fields.push('valid_until = ?');
    values.push(patch.validUntil ? (patch.validUntil as string) : null);
  }
  if (patch.notifyMinutesBefore !== undefined) {
    fields.push('notify_minutes_before = ?');
    values.push(patch.notifyMinutesBefore);
  }

  if (fields.length > 0) {
    values.push(id);
    await db.runAsync(
      `UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`,
      values,
    );
  }

  const updated = await getById(db, id);
  if (!updated) throw new Error(`Schedule with id ${id} not found`);
  return updated;
}

export async function remove(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM schedules WHERE id = ?', [id]);
}

// Re-export ISODate for convenience within this module
export type { ISODate };
