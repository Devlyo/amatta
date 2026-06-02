import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';

import type { Child, ColorIndex, ISODate } from '../../domain/types';
import { rowToChild, type ChildRow } from '../row-mappers';

export type NewChild = Omit<Child, 'id' | 'createdAt'>;

export class ChildCapError extends Error {
  readonly code = 'CHILD_CAP_EXCEEDED';
  constructor() {
    super('최대 4명의 자녀만 등록할 수 있습니다.');
    this.name = 'ChildCapError';
  }
}

const MAX_CHILDREN = 4;

export async function getById(db: SQLiteDatabase, id: number): Promise<Child | null> {
  const row = await db.getFirstAsync<ChildRow>(
    'SELECT id, name, color_index, created_at FROM children WHERE id = ?',
    [id],
  );
  return row ? rowToChild(row) : null;
}

export async function list(db: SQLiteDatabase): Promise<Child[]> {
  const rows = await db.getAllAsync<ChildRow>(
    'SELECT id, name, color_index, created_at FROM children ORDER BY id ASC',
  );
  return rows.map(rowToChild);
}

export async function create(db: SQLiteDatabase, input: NewChild): Promise<Child> {
  const countRow = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM children',
  );
  if ((countRow?.c ?? 0) >= MAX_CHILDREN) {
    throw new ChildCapError();
  }

  const createdAt = new Date().toISOString().slice(0, 10) as ISODate;
  const result = await db.runAsync(
    'INSERT INTO children (name, color_index, created_at) VALUES (?, ?, ?)',
    [input.name, input.colorIndex, createdAt],
  );
  const child = await getById(db, result.lastInsertRowId);
  if (!child) throw new Error('Failed to retrieve newly created child');
  return child;
}

export async function update(
  db: SQLiteDatabase,
  id: number,
  patch: Partial<Omit<Child, 'id' | 'createdAt'>>,
): Promise<Child> {
  const fields: string[] = [];
  const values: SQLiteBindValue[] = [];

  if (patch.name !== undefined) {
    fields.push('name = ?');
    values.push(patch.name);
  }
  if (patch.colorIndex !== undefined) {
    fields.push('color_index = ?');
    values.push(patch.colorIndex as ColorIndex);
  }

  if (fields.length > 0) {
    values.push(id);
    await db.runAsync(
      `UPDATE children SET ${fields.join(', ')} WHERE id = ?`,
      values,
    );
  }

  const updated = await getById(db, id);
  if (!updated) throw new Error(`Child with id ${id} not found`);
  return updated;
}

export async function remove(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM children WHERE id = ?', [id]);
}
