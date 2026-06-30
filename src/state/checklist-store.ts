import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { ChecklistItem } from '../domain/types';
import { checklistItemsRepo, type NewChecklistItem } from '../db/repositories';
import { rescheduleAll } from '../notifications/scheduler';
import {
  useChecklistCompletionStore,
  selectChecklistIsComplete,
} from './checklist-completion-store';

// Checklist edits change the body of a schedule's notifications
// (ADR-002: items prepend to the body), so every mutation triggers a
// reschedule. Errors swallowed — body staleness for a few seconds is
// not worth blocking on.
function reconcile(db: SQLiteDatabase): void {
  void rescheduleAll(db).catch((e) => {
    console.warn('[checklist-store] reconcile failed:', e);
  });
}

interface ChecklistState {
  itemsByScheduleId: Map<number, ChecklistItem[]>;
  isLoaded: boolean;
  load: (db: SQLiteDatabase) => Promise<void>;
  loadForSchedule: (db: SQLiteDatabase, scheduleId: number) => Promise<void>;
  add: (db: SQLiteDatabase, input: NewChecklistItem) => Promise<ChecklistItem>;
  updateOne: (
    db: SQLiteDatabase,
    id: number,
    patch: Partial<Omit<ChecklistItem, 'id' | 'scheduleId'>>,
  ) => Promise<void>;
  removeOne: (db: SQLiteDatabase, id: number) => Promise<void>;
  // PREP-RECUR (v6): completion is per-occurrence. `toggleDone` flips the
  // checklist_completion row for (id, occurrenceDate) — the displayed day —
  // NOT the legacy is_done column (FROZEN). Checking an item on day D leaves
  // every other date untouched.
  toggleDone: (db: SQLiteDatabase, id: number, occurrenceDate: number) => Promise<void>;
  reorder: (db: SQLiteDatabase, scheduleId: number, orderedIds: number[]) => Promise<void>;
}

async function refreshSchedule(
  db: SQLiteDatabase,
  scheduleId: number,
  prev: Map<number, ChecklistItem[]>,
): Promise<Map<number, ChecklistItem[]>> {
  const items = await checklistItemsRepo.listBySchedule(db, scheduleId);
  const next = new Map(prev);
  next.set(scheduleId, items);
  return next;
}

export const useChecklistStore = create<ChecklistState>()((set, get) => ({
  itemsByScheduleId: new Map(),
  isLoaded: false,

  load: async (db) => {
    const rows = await db.getAllAsync<{ schedule_id: number }>(
      'SELECT DISTINCT schedule_id FROM checklist_items',
    );
    const map = new Map<number, ChecklistItem[]>();
    for (const r of rows) {
      const items = await checklistItemsRepo.listBySchedule(db, r.schedule_id);
      map.set(r.schedule_id, items);
    }
    set({ itemsByScheduleId: map, isLoaded: true });
  },

  loadForSchedule: async (db, scheduleId) => {
    const next = await refreshSchedule(db, scheduleId, get().itemsByScheduleId);
    set({ itemsByScheduleId: next });
  },

  add: async (db, input) => {
    const item = await checklistItemsRepo.create(db, input);
    const next = await refreshSchedule(db, input.scheduleId, get().itemsByScheduleId);
    set({ itemsByScheduleId: next });
    reconcile(db);
    return item;
  },

  updateOne: async (db, id, patch) => {
    const existing = await checklistItemsRepo.getById(db, id);
    if (!existing) throw new Error(`ChecklistItem with id ${id} not found`);
    await checklistItemsRepo.update(db, id, patch);
    const next = await refreshSchedule(db, existing.scheduleId, get().itemsByScheduleId);
    set({ itemsByScheduleId: next });
    reconcile(db);
  },

  removeOne: async (db, id) => {
    const existing = await checklistItemsRepo.getById(db, id);
    if (!existing) return;
    await checklistItemsRepo.remove(db, id);
    const next = await refreshSchedule(db, existing.scheduleId, get().itemsByScheduleId);
    set({ itemsByScheduleId: next });
    reconcile(db);
  },

  toggleDone: async (db, id, occurrenceDate) => {
    // Single source of truth = checklist_completion (v6). Decide mark vs clear
    // from the completion store's current map, then delegate so its in-memory
    // map (which the UI reads from) stays authoritative.
    const completion = useChecklistCompletionStore.getState();
    const isComplete = selectChecklistIsComplete(id, occurrenceDate)(completion);
    if (isComplete) {
      await completion.clearComplete(db, id, occurrenceDate);
    } else {
      await completion.markComplete(db, id, occurrenceDate);
    }
    // Body of the schedule's notifications suppresses items completed for the
    // occurrence (ADR-002 / Option A), so a completion flip reschedules.
    reconcile(db);
  },

  reorder: async (db, scheduleId, orderedIds) => {
    await checklistItemsRepo.reorder(db, scheduleId, orderedIds);
    const next = await refreshSchedule(db, scheduleId, get().itemsByScheduleId);
    set({ itemsByScheduleId: next });
    reconcile(db);
  },
}));
