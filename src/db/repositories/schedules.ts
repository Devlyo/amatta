import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';

import type { ISODate, Schedule } from '../../domain/types';
import { rowToSchedule, type ScheduleRow } from '../row-mappers';

export type NewSchedule = Omit<
  Schedule,
  'id' | 'needsPickup' | 'allDay' | 'notifyEndMinutesBefore' | 'memberIds' | 'withGuardian'
> & {
  /** ADR-013: every kid member. Defaults to [childId]; childId is always included. */
  memberIds?: number[];
  withGuardian?: boolean;
  needsPickup?: boolean;
  allDay?: boolean;
  notifyEndMinutesBefore?: number | null;
};

/** ADR-007 §8: an all-day row always stores the whole day as its range. */
function normalizeRange(allDay: boolean, start: number, end: number): [number, number] {
  return allDay ? [0, 24 * 60] : [start, end];
}

const SELECT_COLUMNS = `id, child_id, title, type, location, notes,
                        days_of_week, start_minutes, end_minutes,
                        valid_from, valid_until, notify_minutes_before,
                        needs_pickup, all_day, notify_end_minutes_before,
                        with_guardian`;

async function membersOf(db: SQLiteDatabase, ids: number[] | null): Promise<Map<number, number[]>> {
  const rows = await db.getAllAsync<{ schedule_id: number; child_id: number }>(
    ids === null
      ? 'SELECT schedule_id, child_id FROM schedule_children'
      : `SELECT schedule_id, child_id FROM schedule_children WHERE schedule_id IN (${ids.map(() => '?').join(',')})`,
    ids ?? [],
  );
  const map = new Map<number, number[]>();
  for (const r of rows) {
    const list = map.get(r.schedule_id);
    if (list) list.push(r.child_id);
    else map.set(r.schedule_id, [r.child_id]);
  }
  return map;
}

/** Replace the member rows (the main kid is always kept). No own transaction. */
async function writeMembers(db: SQLiteDatabase, scheduleId: number, mainId: number, memberIds: readonly number[]): Promise<void> {
  const ids = [...new Set([mainId, ...memberIds])];
  await db.runAsync('DELETE FROM schedule_children WHERE schedule_id = ?', [scheduleId]);
  for (const childId of ids) {
    await db.runAsync('INSERT OR IGNORE INTO schedule_children (schedule_id, child_id) VALUES (?, ?)', [scheduleId, childId]);
  }
}

/** ADR-013: the main kid stays if still a member; otherwise the first remaining one. */
export function pickMainKid(currentMain: number | null, memberIds: readonly number[]): number | null {
  if (currentMain !== null && memberIds.includes(currentMain)) return currentMain;
  return memberIds[0] ?? null;
}

export async function getById(db: SQLiteDatabase, id: number): Promise<Schedule | null> {
  const row = await db.getFirstAsync<ScheduleRow>(
    `SELECT ${SELECT_COLUMNS} FROM schedules WHERE id = ?`,
    [id],
  );
  if (!row) return null;
  const members = await membersOf(db, [id]);
  return rowToSchedule(row, members.get(id) ?? []);
}

export async function list(db: SQLiteDatabase): Promise<Schedule[]> {
  const rows = await db.getAllAsync<ScheduleRow>(
    `SELECT ${SELECT_COLUMNS} FROM schedules ORDER BY id ASC`,
  );
  const members = await membersOf(db, null);
  return rows.map((r) => rowToSchedule(r, members.get(r.id) ?? []));
}

/** Schedules the kid is a member of (ADR-013 — not only the ones they're the main kid of). */
export async function listByChild(db: SQLiteDatabase, childId: number): Promise<Schedule[]> {
  const all = await list(db);
  return all.filter((s) => s.memberIds.includes(childId));
}

export async function create(db: SQLiteDatabase, input: NewSchedule): Promise<Schedule> {
  const allDay = input.allDay ?? false;
  const [start, end] = normalizeRange(allDay, input.startMinutes, input.endMinutes);
  let newId = 0;
  await db.withTransactionAsync(async () => {
  const result = await db.runAsync(
    `INSERT INTO schedules
       (child_id, title, type, location, notes,
        days_of_week, start_minutes, end_minutes,
        valid_from, valid_until, notify_minutes_before, needs_pickup,
        all_day, notify_end_minutes_before, with_guardian)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.childId,
      input.title,
      input.type,
      input.location ?? null,
      input.notes ?? null,
      input.daysOfWeek,
      start,
      end,
      input.validFrom as string,
      input.validUntil ? (input.validUntil as string) : null,
      input.notifyMinutesBefore ?? null,
      // An all-day event has no pickup time (ADR-007 §8).
      input.needsPickup && !allDay ? 1 : 0,
      allDay ? 1 : 0,
      input.notifyEndMinutesBefore ?? null,
      input.withGuardian === true ? 1 : 0,
    ],
  );
  newId = result.lastInsertRowId;
  await writeMembers(db, newId, input.childId, input.memberIds ?? [input.childId]);
  });
  const schedule = await getById(db, newId);
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

  // ADR-013: a member change may move the main kid.
  let members: number[] | null = null;
  let mainId: number | undefined = patch.childId;
  if (patch.memberIds !== undefined && patch.memberIds.length > 0) {
    members = [...new Set(patch.memberIds)];
    let current: number | null = patch.childId ?? null;
    if (current === null) {
      const row = await db.getFirstAsync<{ child_id: number }>('SELECT child_id FROM schedules WHERE id = ?', [id]);
      current = row?.child_id ?? null;
    }
    mainId = pickMainKid(current, members) ?? undefined;
  }
  if (mainId !== undefined) {
    fields.push('child_id = ?');
    values.push(mainId);
  }
  if (patch.withGuardian !== undefined) {
    fields.push('with_guardian = ?');
    values.push(patch.withGuardian ? 1 : 0);
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
  if (patch.needsPickup !== undefined) {
    fields.push('needs_pickup = ?');
    values.push(patch.needsPickup && patch.allDay !== true ? 1 : 0);
  }
  if (patch.allDay !== undefined) {
    fields.push('all_day = ?');
    values.push(patch.allDay ? 1 : 0);
    if (patch.allDay) {
      // Canonical all-day range overrides any start/end in the same patch.
      for (const col of ['start_minutes = ?', 'end_minutes = ?', 'needs_pickup = ?']) {
        const i = fields.indexOf(col);
        if (i >= 0) {
          fields.splice(i, 1);
          values.splice(i, 1);
        }
      }
      fields.push('start_minutes = ?', 'end_minutes = ?', 'needs_pickup = ?');
      values.push(0, 24 * 60, 0);
    }
  }
  if (patch.notifyEndMinutesBefore !== undefined) {
    fields.push('notify_end_minutes_before = ?');
    values.push(patch.notifyEndMinutesBefore);
  }

  if (fields.length > 0 || members !== null) {
    values.push(id);
    await db.withTransactionAsync(async () => {
      if (fields.length > 0) {
        await db.runAsync(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`, values);
      }
      if (members !== null && mainId !== undefined) await writeMembers(db, id, mainId, members);
    });
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
