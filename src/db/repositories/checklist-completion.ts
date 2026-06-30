import type { SQLiteDatabase } from 'expo-sqlite';

import type { ChecklistCompletion } from '../../domain/types';
import {
  rowToChecklistCompletion,
  type ChecklistCompletionRow,
} from '../row-mappers';

// Per-occurrence checklist completion (v6 / PREP-RECUR). Mirrors the
// schedule_pickup_log repo contract verbatim: keyed by
// (checklist_item_id, occurrence_date) where occurrence_date is a `yyyymmdd`
// integer (e.g. 20260630). This is the single source of truth for ALL checklist
// completion — the legacy checklist_items.is_done/done_at columns are FROZEN as
// of v6 and must not be written here.

export interface MarkCompleteInput {
  checklistItemId: number;
  occurrenceDate: number; // yyyymmdd int
  completedAt: number; // epoch ms
}

const SELECT_COMPLETION = `SELECT id, checklist_item_id, occurrence_date, completed_at
                           FROM checklist_completion`;

export async function markComplete(
  db: SQLiteDatabase,
  input: MarkCompleteInput,
): Promise<ChecklistCompletion> {
  // Idempotent: UNIQUE(checklist_item_id, occurrence_date) collision is silently ignored.
  await db.runAsync(
    `INSERT OR IGNORE INTO checklist_completion
       (checklist_item_id, occurrence_date, completed_at)
     VALUES (?, ?, ?)`,
    [input.checklistItemId, input.occurrenceDate, input.completedAt],
  );
  const row = await db.getFirstAsync<ChecklistCompletionRow>(
    `${SELECT_COMPLETION} WHERE checklist_item_id = ? AND occurrence_date = ?`,
    [input.checklistItemId, input.occurrenceDate],
  );
  if (!row) throw new Error('Failed to retrieve checklist completion row after markComplete');
  return rowToChecklistCompletion(row);
}

export async function clearComplete(
  db: SQLiteDatabase,
  checklistItemId: number,
  occurrenceDate: number,
): Promise<void> {
  await db.runAsync(
    `DELETE FROM checklist_completion
     WHERE checklist_item_id = ? AND occurrence_date = ?`,
    [checklistItemId, occurrenceDate],
  );
}

export async function isComplete(
  db: SQLiteDatabase,
  checklistItemId: number,
  occurrenceDate: number,
): Promise<boolean> {
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM checklist_completion
     WHERE checklist_item_id = ? AND occurrence_date = ?`,
    [checklistItemId, occurrenceDate],
  );
  return (row?.c ?? 0) > 0;
}

export async function listForDate(
  db: SQLiteDatabase,
  occurrenceDate: number,
): Promise<ChecklistCompletion[]> {
  const rows = await db.getAllAsync<ChecklistCompletionRow>(
    `${SELECT_COMPLETION} WHERE occurrence_date = ? ORDER BY checklist_item_id ASC`,
    [occurrenceDate],
  );
  return rows.map(rowToChecklistCompletion);
}

/**
 * All completions whose `occurrence_date` falls within [fromYyyymmdd, toYyyymmdd]
 * inclusive. Because occurrence_date is a `yyyymmdd` INTEGER, lexical/numeric
 * BETWEEN over the int is equivalent to a calendar-date range — used by the
 * notification scheduler to load every completion across its rolling horizon in
 * a single query (instead of one per-date round trip inside the occurrence loop).
 */
export async function listForDateRange(
  db: SQLiteDatabase,
  fromYyyymmdd: number,
  toYyyymmdd: number,
): Promise<ChecklistCompletion[]> {
  const rows = await db.getAllAsync<ChecklistCompletionRow>(
    `${SELECT_COMPLETION}
     WHERE occurrence_date BETWEEN ? AND ?
     ORDER BY occurrence_date ASC, checklist_item_id ASC`,
    [fromYyyymmdd, toYyyymmdd],
  );
  return rows.map(rowToChecklistCompletion);
}
