import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';

import { schedulePickupLogRepo } from '../db/repositories';

interface PickupLogState {
  completionMap: Map<string, number>;
  isLoaded: boolean;
  load: (db: SQLiteDatabase) => Promise<void>;
  markComplete: (
    db: SQLiteDatabase,
    scheduleId: number,
    occurrenceDate: number,
  ) => Promise<void>;
  clearComplete: (
    db: SQLiteDatabase,
    scheduleId: number,
    occurrenceDate: number,
  ) => Promise<void>;
}

function keyOf(scheduleId: number, occurrenceDate: number): string {
  return `${scheduleId}|${occurrenceDate}`;
}

async function reloadMap(db: SQLiteDatabase): Promise<Map<string, number>> {
  const rows = await db.getAllAsync<{
    schedule_id: number;
    occurrence_date: number;
    completed_at: number;
  }>('SELECT schedule_id, occurrence_date, completed_at FROM schedule_pickup_log');
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(keyOf(r.schedule_id, r.occurrence_date), r.completed_at);
  }
  return map;
}

export const usePickupLogStore = create<PickupLogState>()((set) => ({
  completionMap: new Map(),
  isLoaded: false,

  load: async (db) => {
    const completionMap = await reloadMap(db);
    set({ completionMap, isLoaded: true });
  },

  markComplete: async (db, scheduleId, occurrenceDate) => {
    await schedulePickupLogRepo.markComplete(db, {
      scheduleId,
      occurrenceDate,
      completedAt: Date.now(),
    });
    const completionMap = await reloadMap(db);
    set({ completionMap });
  },

  clearComplete: async (db, scheduleId, occurrenceDate) => {
    await schedulePickupLogRepo.clearComplete(db, scheduleId, occurrenceDate);
    const completionMap = await reloadMap(db);
    set({ completionMap });
  },
}));

export const selectIsComplete =
  (scheduleId: number, occurrenceDate: number) =>
  (s: PickupLogState): boolean =>
    s.completionMap.has(keyOf(scheduleId, occurrenceDate));
