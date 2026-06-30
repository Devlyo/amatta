// Pure DB → JSON export. Read-only against the live SQLite handle.
// Spec: ralplan §Phase 4 §3 "데이터 내보내기 (JSON)". Schema v3 covers all
// eight user entities (the full DB surface): children, schedules,
// schedule_exceptions, notification_settings, checklist_items, todos,
// schedule_pickup_log, checklist_completion. The `schemaVersion` field lets a
// future importer detect/reject incompatible bundles.

import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  ChecklistCompletion,
  ChecklistItem,
  Child,
  NotificationSetting,
  Schedule,
  ScheduleException,
  SchedulePickupLog,
  Todo,
} from '../domain/types';
import {
  rowToChecklistCompletion,
  rowToChecklistItem,
  rowToChild,
  rowToNotificationSetting,
  rowToSchedule,
  rowToScheduleException,
  rowToSchedulePickupLog,
  rowToTodo,
  type ChecklistCompletionRow,
  type ChecklistItemRow,
  type ChildRow,
  type NotificationSettingRow,
  type ScheduleExceptionRow,
  type SchedulePickupLogRow,
  type ScheduleRow,
  type TodoRow,
} from '../db/row-mappers';

// Bumped 1 → 2 when checklist_items / todos / schedule_pickup_log were added.
// Bumped 2 → 3 when checklist_completion was added (PREP-RECUR, v6 schema).
// A future importer keys off this to detect the format.
export const EXPORT_SCHEMA_VERSION = 3 as const;

export interface ExportEnvelope {
  exportedAt: string; // ISO timestamp (UTC)
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  children: Child[];
  schedules: Schedule[];
  exceptions: ScheduleException[];
  notificationSettings: NotificationSetting[];
  checklistItems: ChecklistItem[];
  todos: Todo[];
  pickupLog: SchedulePickupLog[];
  checklistCompletion: ChecklistCompletion[];
}

export interface ExportResult {
  json: string;
  envelope: ExportEnvelope;
  suggestedFilename: string;
}

/**
 * Reads every row from all seven entity tables and returns a serialized
 * JSON envelope. Caller is responsible for writing to disk + invoking
 * Sharing.shareAsync; this function stays pure so it can be unit-tested
 * against an in-memory SQLite under jest-expo.
 */
export async function exportDb(
  db: SQLiteDatabase,
  now: Date = new Date(),
): Promise<ExportResult> {
  const childrenRows = await db.getAllAsync<ChildRow>(
    'SELECT id, name, color_index, avatar, created_at FROM children ORDER BY id ASC',
  );
  const schedulesRows = await db.getAllAsync<ScheduleRow>(
    `SELECT id, child_id, title, type, location, notes,
            days_of_week, start_minutes, end_minutes,
            valid_from, valid_until, notify_minutes_before, needs_pickup
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
  const checklistRows = await db.getAllAsync<ChecklistItemRow>(
    // FROZEN legacy fields — `checklist_completion` is the authoritative
    // completion source for the v1.1 restore path. `is_done`/`done_at` are
    // serialized here only for envelope shape stability; do NOT write them
    // back on import (v1.1+). See PREP-RECUR / ADR-002.
    `SELECT id, schedule_id, label, sort_order, is_done, done_at
     FROM checklist_items ORDER BY id ASC`,
  );
  const todoRows = await db.getAllAsync<TodoRow>(
    `SELECT id, child_id, title, due_at, notify_minutes_before,
            is_done, done_at, created_at
     FROM todos ORDER BY id ASC`,
  );
  const pickupLogRows = await db.getAllAsync<SchedulePickupLogRow>(
    `SELECT id, schedule_id, occurrence_date, completed_at
     FROM schedule_pickup_log ORDER BY id ASC`,
  );
  const checklistCompletionRows = await db.getAllAsync<ChecklistCompletionRow>(
    `SELECT id, checklist_item_id, occurrence_date, completed_at
     FROM checklist_completion ORDER BY id ASC`,
  );

  const envelope: ExportEnvelope = {
    exportedAt: now.toISOString(),
    schemaVersion: EXPORT_SCHEMA_VERSION,
    children: childrenRows.map(rowToChild),
    schedules: schedulesRows.map(rowToSchedule),
    exceptions: exceptionsRows.map(rowToScheduleException),
    notificationSettings: notifRows.map(rowToNotificationSetting),
    checklistItems: checklistRows.map(rowToChecklistItem),
    todos: todoRows.map(rowToTodo),
    pickupLog: pickupLogRows.map(rowToSchedulePickupLog),
    checklistCompletion: checklistCompletionRows.map(rowToChecklistCompletion),
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
