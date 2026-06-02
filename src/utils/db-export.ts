// Pure DB → JSON export. Read-only against the live SQLite handle.
// Spec: ralplan §Phase 4 §3 "데이터 내보내기 (JSON)". Schema v1 only —
// the 4 entities exported here are the entire user-facing surface; the
// `schemaVersion` field lets a future v3 importer reject incompatible bundles.

import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  Child,
  NotificationSetting,
  Schedule,
  ScheduleException,
} from '../domain/types';
import {
  rowToChild,
  rowToNotificationSetting,
  rowToSchedule,
  rowToScheduleException,
  type ChildRow,
  type NotificationSettingRow,
  type ScheduleExceptionRow,
  type ScheduleRow,
} from '../db/row-mappers';

export const EXPORT_SCHEMA_VERSION = 1 as const;

export interface ExportEnvelope {
  exportedAt: string; // ISO timestamp (UTC)
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  children: Child[];
  schedules: Schedule[];
  exceptions: ScheduleException[];
  notificationSettings: NotificationSetting[];
}

export interface ExportResult {
  json: string;
  envelope: ExportEnvelope;
  suggestedFilename: string;
}

/**
 * Reads every row from the four v1 entity tables and returns a serialized
 * JSON envelope. Caller is responsible for writing to disk + invoking
 * Sharing.shareAsync; this function stays pure so it can be unit-tested
 * against an in-memory SQLite under jest-expo.
 */
export async function exportDb(
  db: SQLiteDatabase,
  now: Date = new Date(),
): Promise<ExportResult> {
  const childrenRows = await db.getAllAsync<ChildRow>(
    'SELECT id, name, color_index, created_at FROM children ORDER BY id ASC',
  );
  const schedulesRows = await db.getAllAsync<ScheduleRow>(
    `SELECT id, child_id, title, type, location, notes,
            days_of_week, start_minutes, end_minutes,
            valid_from, valid_until, notify_minutes_before
     FROM schedules ORDER BY id ASC`,
  );
  const exceptionsRows = await db.getAllAsync<ScheduleExceptionRow>(
    `SELECT id, schedule_id, date, kind,
            override_start_minutes, override_end_minutes, override_title
     FROM schedule_exceptions ORDER BY id ASC`,
  );
  const notifRows = await db.getAllAsync<NotificationSettingRow>(
    `SELECT child_id, default_minutes_before, sound, enabled
     FROM notification_settings ORDER BY child_id ASC`,
  );

  const envelope: ExportEnvelope = {
    exportedAt: now.toISOString(),
    schemaVersion: EXPORT_SCHEMA_VERSION,
    children: childrenRows.map(rowToChild),
    schedules: schedulesRows.map(rowToSchedule),
    exceptions: exceptionsRows.map(rowToScheduleException),
    notificationSettings: notifRows.map(rowToNotificationSetting),
  };

  return {
    json: JSON.stringify(envelope, null, 2),
    envelope,
    suggestedFilename: makeFilename(now),
  };
}

function makeFilename(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `schedulapp-export-${y}${m}${d}-${hh}${mm}.json`;
}
