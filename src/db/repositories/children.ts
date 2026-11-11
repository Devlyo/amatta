import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';

import { MAX_CHILDREN } from '../../domain/constants';
import type { Child, ColorIndex, ISODate } from '../../domain/types';
import { avatarKeyForColorIndex } from '../../domain/avatar';
import { rowToChild, type ChildRow } from '../row-mappers';

// `avatar` is optional in the create() input: when omitted we derive it
// from colorIndex via AVATAR_KEYS (1:1 mapping) so callsites that only
// know about the color slot — including the legacy 'add a kid' tests —
// keep working. The kid-edit screen still passes the explicit pair.
export type NewChild = Omit<Child, 'id' | 'createdAt' | 'avatar'> & {
  avatar?: Child['avatar'];
};

export class ChildCapError extends Error {
  readonly code = 'CHILD_CAP_EXCEEDED';
  constructor() {
    super(`최대 ${MAX_CHILDREN}명의 자녀만 등록할 수 있습니다.`);
    this.name = 'ChildCapError';
  }
}

export async function getById(db: SQLiteDatabase, id: number): Promise<Child | null> {
  const row = await db.getFirstAsync<ChildRow>(
    'SELECT id, name, color_index, avatar, created_at FROM children WHERE id = ?',
    [id],
  );
  return row ? rowToChild(row) : null;
}

export async function list(db: SQLiteDatabase): Promise<Child[]> {
  const rows = await db.getAllAsync<ChildRow>(
    'SELECT id, name, color_index, avatar, created_at FROM children ORDER BY id ASC',
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
  const avatar = input.avatar ?? avatarKeyForColorIndex(input.colorIndex);
  const result = await db.runAsync(
    'INSERT INTO children (name, color_index, avatar, created_at) VALUES (?, ?, ?, ?)',
    [input.name, input.colorIndex, avatar, createdAt],
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
  if (patch.avatar !== undefined) {
    fields.push('avatar = ?');
    values.push(patch.avatar);
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

/**
 * ADR-013: a schedule the kid shares with others survives — the next member
 * (lowest id) becomes its main kid first, then the kid is deleted (CASCADE
 * removes their membership rows and the schedules only they were on).
 */
export async function remove(db: SQLiteDatabase, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE schedules SET child_id = (
         SELECT MIN(sc.child_id) FROM schedule_children sc
         WHERE sc.schedule_id = schedules.id AND sc.child_id <> ?
       )
       WHERE child_id = ?
         AND EXISTS (SELECT 1 FROM schedule_children sc WHERE sc.schedule_id = schedules.id AND sc.child_id <> ?)`,
      [id, id, id],
    );
    await db.runAsync('DELETE FROM children WHERE id = ?', [id]);
  });
}

/** How many schedules go away with the kid (the ones nobody else is on). */
export async function countSchedulesOnlyFor(db: SQLiteDatabase, id: number): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM schedules s
     WHERE s.child_id = ?
       AND NOT EXISTS (SELECT 1 FROM schedule_children sc WHERE sc.schedule_id = s.id AND sc.child_id <> ?)`,
    [id, id],
  );
  return row?.n ?? 0;
}
