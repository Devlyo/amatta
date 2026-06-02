import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';

import type { ChecklistItem } from '../../domain/types';
import { rowToChecklistItem, type ChecklistItemRow } from '../row-mappers';

export interface NewChecklistItem {
  scheduleId: number;
  label: string;
  sortOrder?: number;
}

export async function getById(
  db: SQLiteDatabase,
  id: number,
): Promise<ChecklistItem | null> {
  const row = await db.getFirstAsync<ChecklistItemRow>(
    `SELECT id, schedule_id, label, sort_order, is_done, done_at
     FROM checklist_items WHERE id = ?`,
    [id],
  );
  return row ? rowToChecklistItem(row) : null;
}

export async function listBySchedule(
  db: SQLiteDatabase,
  scheduleId: number,
): Promise<ChecklistItem[]> {
  const rows = await db.getAllAsync<ChecklistItemRow>(
    `SELECT id, schedule_id, label, sort_order, is_done, done_at
     FROM checklist_items
     WHERE schedule_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [scheduleId],
  );
  return rows.map(rowToChecklistItem);
}

export async function create(
  db: SQLiteDatabase,
  input: NewChecklistItem,
): Promise<ChecklistItem> {
  const result = await db.runAsync(
    `INSERT INTO checklist_items (schedule_id, label, sort_order)
     VALUES (?, ?, ?)`,
    [input.scheduleId, input.label, input.sortOrder ?? 0],
  );
  const item = await getById(db, result.lastInsertRowId);
  if (!item) throw new Error('Failed to retrieve newly created checklist item');
  return item;
}

export async function update(
  db: SQLiteDatabase,
  id: number,
  patch: Partial<Omit<ChecklistItem, 'id' | 'scheduleId'>>,
): Promise<ChecklistItem> {
  const fields: string[] = [];
  const values: SQLiteBindValue[] = [];

  if (patch.label !== undefined) {
    fields.push('label = ?');
    values.push(patch.label);
  }
  if (patch.sortOrder !== undefined) {
    fields.push('sort_order = ?');
    values.push(patch.sortOrder);
  }
  if (patch.isDone !== undefined) {
    fields.push('is_done = ?');
    values.push(patch.isDone ? 1 : 0);
  }
  if (patch.doneAt !== undefined) {
    fields.push('done_at = ?');
    values.push(patch.doneAt);
  }

  if (fields.length > 0) {
    values.push(id);
    await db.runAsync(
      `UPDATE checklist_items SET ${fields.join(', ')} WHERE id = ?`,
      values,
    );
  }

  const updated = await getById(db, id);
  if (!updated) throw new Error(`ChecklistItem with id ${id} not found`);
  return updated;
}

export async function remove(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM checklist_items WHERE id = ?', [id]);
}

export async function toggleDone(
  db: SQLiteDatabase,
  id: number,
  doneAt: number,
): Promise<ChecklistItem> {
  const current = await getById(db, id);
  if (!current) throw new Error(`ChecklistItem with id ${id} not found`);
  const nextDone = !current.isDone;
  await db.runAsync(
    `UPDATE checklist_items SET is_done = ?, done_at = ? WHERE id = ?`,
    [nextDone ? 1 : 0, nextDone ? doneAt : null, id],
  );
  const updated = await getById(db, id);
  if (!updated) throw new Error(`ChecklistItem with id ${id} not found`);
  return updated;
}

export async function reorder(
  db: SQLiteDatabase,
  scheduleId: number,
  orderedIds: number[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync(
        `UPDATE checklist_items SET sort_order = ? WHERE id = ? AND schedule_id = ?`,
        [i, orderedIds[i] as number, scheduleId],
      );
    }
  });
}
