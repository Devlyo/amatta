import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { ChecklistItem } from '../domain/types';
import { checklistItemsRepo, type NewChecklistItem } from '../db/repositories';
import { rescheduleAll } from '../notifications/scheduler';

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
  toggleDone: (db: SQLiteDatabase, id: number) => Promise<void>;
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

  toggleDone: async (db, id) => {
    const existing = await checklistItemsRepo.getById(db, id);
    if (!existing) throw new Error(`ChecklistItem with id ${id} not found`);
    await checklistItemsRepo.toggleDone(db, id, Date.now());
    const next = await refreshSchedule(db, existing.scheduleId, get().itemsByScheduleId);
    set({ itemsByScheduleId: next });
    reconcile(db);
  },

  reorder: async (db, scheduleId, orderedIds) => {
    await checklistItemsRepo.reorder(db, scheduleId, orderedIds);
    const next = await refreshSchedule(db, scheduleId, get().itemsByScheduleId);
    set({ itemsByScheduleId: next });
    reconcile(db);
  },
}));
