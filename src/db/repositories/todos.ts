import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';

import type { Todo } from '../../domain/types';
import { rowToTodo, type TodoRow } from '../row-mappers';

export interface NewTodo {
  childId: number | null;
  title: string;
  dueAt: number;
  notifyMinutesBefore?: number | null;
}

const SELECT_TODO = `SELECT id, child_id, title, due_at, notify_minutes_before,
                            is_done, done_at, created_at
                     FROM todos`;

export async function getById(db: SQLiteDatabase, id: number): Promise<Todo | null> {
  const row = await db.getFirstAsync<TodoRow>(
    `${SELECT_TODO} WHERE id = ?`,
    [id],
  );
  return row ? rowToTodo(row) : null;
}

export async function list(db: SQLiteDatabase): Promise<Todo[]> {
  const rows = await db.getAllAsync<TodoRow>(
    `${SELECT_TODO} ORDER BY due_at ASC`,
  );
  return rows.map(rowToTodo);
}

export async function listByChild(
  db: SQLiteDatabase,
  childId: number | null,
): Promise<Todo[]> {
  if (childId === null) {
    const rows = await db.getAllAsync<TodoRow>(
      `${SELECT_TODO} WHERE child_id IS NULL ORDER BY due_at ASC`,
    );
    return rows.map(rowToTodo);
  }
  const rows = await db.getAllAsync<TodoRow>(
    `${SELECT_TODO} WHERE child_id = ? ORDER BY due_at ASC`,
    [childId],
  );
  return rows.map(rowToTodo);
}

export async function listUndone(db: SQLiteDatabase): Promise<Todo[]> {
  const rows = await db.getAllAsync<TodoRow>(
    `${SELECT_TODO} WHERE is_done = 0 ORDER BY due_at ASC`,
  );
  return rows.map(rowToTodo);
}

export async function create(db: SQLiteDatabase, input: NewTodo): Promise<Todo> {
  const createdAt = Date.now();
  const result = await db.runAsync(
    `INSERT INTO todos (child_id, title, due_at, notify_minutes_before, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      input.childId,
      input.title,
      input.dueAt,
      input.notifyMinutesBefore ?? null,
      createdAt,
    ],
  );
  const todo = await getById(db, result.lastInsertRowId);
  if (!todo) throw new Error('Failed to retrieve newly created todo');
  return todo;
}

export async function update(
  db: SQLiteDatabase,
  id: number,
  patch: Partial<Omit<Todo, 'id' | 'createdAt'>>,
): Promise<Todo> {
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
  if (patch.dueAt !== undefined) {
    fields.push('due_at = ?');
    values.push(patch.dueAt);
  }
  if (patch.notifyMinutesBefore !== undefined) {
    fields.push('notify_minutes_before = ?');
    values.push(patch.notifyMinutesBefore);
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
      `UPDATE todos SET ${fields.join(', ')} WHERE id = ?`,
      values,
    );
  }

  const updated = await getById(db, id);
  if (!updated) throw new Error(`Todo with id ${id} not found`);
  return updated;
}

export async function remove(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM todos WHERE id = ?', [id]);
}

export async function toggleDone(
  db: SQLiteDatabase,
  id: number,
  doneAt: number,
): Promise<Todo> {
  const current = await getById(db, id);
  if (!current) throw new Error(`Todo with id ${id} not found`);
  const nextDone = !current.isDone;
  await db.runAsync(
    `UPDATE todos SET is_done = ?, done_at = ? WHERE id = ?`,
    [nextDone ? 1 : 0, nextDone ? doneAt : null, id],
  );
  const updated = await getById(db, id);
  if (!updated) throw new Error(`Todo with id ${id} not found`);
  return updated;
}
