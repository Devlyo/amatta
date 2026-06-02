import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';

import type { NotificationSetting } from '../../domain/types';
import { rowToNotificationSetting, type NotificationSettingRow } from '../row-mappers';

export type NewNotificationSetting = NotificationSetting;

export async function getByChildId(
  db: SQLiteDatabase,
  childId: number,
): Promise<NotificationSetting | null> {
  const row = await db.getFirstAsync<NotificationSettingRow>(
    `SELECT child_id, default_minutes_before, sound, enabled
     FROM notification_settings WHERE child_id = ?`,
    [childId],
  );
  return row ? rowToNotificationSetting(row) : null;
}

export async function list(db: SQLiteDatabase): Promise<NotificationSetting[]> {
  const rows = await db.getAllAsync<NotificationSettingRow>(
    `SELECT child_id, default_minutes_before, sound, enabled
     FROM notification_settings ORDER BY child_id ASC`,
  );
  return rows.map(rowToNotificationSetting);
}

export async function create(
  db: SQLiteDatabase,
  input: NewNotificationSetting,
): Promise<NotificationSetting> {
  await db.runAsync(
    `INSERT INTO notification_settings (child_id, default_minutes_before, sound, enabled)
     VALUES (?, ?, ?, ?)`,
    [
      input.childId,
      input.defaultMinutesBefore,
      input.sound ? 1 : 0,
      input.enabled ? 1 : 0,
    ],
  );
  const setting = await getByChildId(db, input.childId);
  if (!setting) throw new Error('Failed to retrieve newly created notification setting');
  return setting;
}

export async function update(
  db: SQLiteDatabase,
  childId: number,
  patch: Partial<Omit<NotificationSetting, 'childId'>>,
): Promise<NotificationSetting> {
  const fields: string[] = [];
  const values: SQLiteBindValue[] = [];

  if (patch.defaultMinutesBefore !== undefined) {
    fields.push('default_minutes_before = ?');
    values.push(patch.defaultMinutesBefore);
  }
  if (patch.sound !== undefined) {
    fields.push('sound = ?');
    values.push(patch.sound ? 1 : 0);
  }
  if (patch.enabled !== undefined) {
    fields.push('enabled = ?');
    values.push(patch.enabled ? 1 : 0);
  }

  if (fields.length > 0) {
    values.push(childId);
    await db.runAsync(
      `UPDATE notification_settings SET ${fields.join(', ')} WHERE child_id = ?`,
      values,
    );
  }

  const updated = await getByChildId(db, childId);
  if (!updated) throw new Error(`NotificationSetting for childId ${childId} not found`);
  return updated;
}

export async function remove(db: SQLiteDatabase, childId: number): Promise<void> {
  await db.runAsync('DELETE FROM notification_settings WHERE child_id = ?', [childId]);
}
