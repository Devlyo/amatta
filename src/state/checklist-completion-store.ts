import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';

import { checklistCompletionRepo } from '../db/repositories';

// Per-occurrence checklist completion (v6 / PREP-RECUR). Mirrors
// pickup-log-store verbatim: a flat in-memory map keyed by
// `${checklistItemId}|${occurrenceDate}` (occurrenceDate = yyyymmdd int).
// This is the single source of truth for ALL checklist completion — the
// legacy checklist_items.is_done/done_at columns are FROZEN as of v6.
interface ChecklistCompletionState {
  completionMap: Map<string, number>;
  isLoaded: boolean;
  load: (db: SQLiteDatabase) => Promise<void>;
  markComplete: (
    db: SQLiteDatabase,
    checklistItemId: number,
    occurrenceDate: number,
  ) => Promise<void>;
  clearComplete: (
    db: SQLiteDatabase,
    checklistItemId: number,
    occurrenceDate: number,
  ) => Promise<void>;
}

function keyOf(checklistItemId: number, occurrenceDate: number): string {
  return `${checklistItemId}|${occurrenceDate}`;
}

async function reloadMap(db: SQLiteDatabase): Promise<Map<string, number>> {
  const rows = await db.getAllAsync<{
    checklist_item_id: number;
    occurrence_date: number;
    completed_at: number;
  }>('SELECT checklist_item_id, occurrence_date, completed_at FROM checklist_completion');
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(keyOf(r.checklist_item_id, r.occurrence_date), r.completed_at);
  }
  return map;
}

export const useChecklistCompletionStore = create<ChecklistCompletionState>()((set) => ({
  completionMap: new Map(),
  isLoaded: false,

  load: async (db) => {
    const completionMap = await reloadMap(db);
    set({ completionMap, isLoaded: true });
  },

  markComplete: async (db, checklistItemId, occurrenceDate) => {
    await checklistCompletionRepo.markComplete(db, {
      checklistItemId,
      occurrenceDate,
      completedAt: Date.now(),
    });
    const completionMap = await reloadMap(db);
    set({ completionMap });
  },

  clearComplete: async (db, checklistItemId, occurrenceDate) => {
    await checklistCompletionRepo.clearComplete(db, checklistItemId, occurrenceDate);
    const completionMap = await reloadMap(db);
    set({ completionMap });
  },
}));

export const selectChecklistIsComplete =
  (checklistItemId: number, occurrenceDate: number) =>
  (s: ChecklistCompletionState): boolean =>
    s.completionMap.has(keyOf(checklistItemId, occurrenceDate));
