import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Schedule, ScheduleException } from '../domain/types';
import { schedulesRepo, exceptionsRepo, type NewSchedule, type NewScheduleException } from '../db/repositories';

interface SchedulesState {
  schedules: Schedule[];
  exceptions: ScheduleException[];
  isLoaded: boolean;
  load: (db: SQLiteDatabase) => Promise<void>;
  addSchedule: (db: SQLiteDatabase, input: NewSchedule) => Promise<Schedule>;
  updateSchedule: (db: SQLiteDatabase, id: number, patch: Partial<Omit<Schedule, 'id'>>) => Promise<void>;
  removeSchedule: (db: SQLiteDatabase, id: number) => Promise<void>;
  addException: (db: SQLiteDatabase, input: NewScheduleException) => Promise<ScheduleException>;
  updateException: (db: SQLiteDatabase, id: number, patch: Partial<Omit<ScheduleException, 'id'>>) => Promise<void>;
  removeException: (db: SQLiteDatabase, id: number) => Promise<void>;
}

async function loadBoth(db: SQLiteDatabase): Promise<{ schedules: Schedule[]; exceptions: ScheduleException[] }> {
  const [schedules, exceptions] = await Promise.all([
    schedulesRepo.list(db),
    exceptionsRepo.list(db),
  ]);
  return { schedules, exceptions };
}

export const useSchedulesStore = create<SchedulesState>()((set) => ({
  schedules: [],
  exceptions: [],
  isLoaded: false,

  load: async (db) => {
    const { schedules, exceptions } = await loadBoth(db);
    set({ schedules, exceptions, isLoaded: true });
  },

  addSchedule: async (db, input) => {
    const schedule = await schedulesRepo.create(db, input);
    const { schedules, exceptions } = await loadBoth(db);
    set({ schedules, exceptions });
    return schedule;
  },

  updateSchedule: async (db, id, patch) => {
    await schedulesRepo.update(db, id, patch);
    const { schedules, exceptions } = await loadBoth(db);
    set({ schedules, exceptions });
  },

  removeSchedule: async (db, id) => {
    await schedulesRepo.remove(db, id);
    const { schedules, exceptions } = await loadBoth(db);
    set({ schedules, exceptions });
  },

  addException: async (db, input) => {
    const exception = await exceptionsRepo.create(db, input);
    const { schedules, exceptions } = await loadBoth(db);
    set({ schedules, exceptions });
    return exception;
  },

  updateException: async (db, id, patch) => {
    await exceptionsRepo.update(db, id, patch);
    const { schedules, exceptions } = await loadBoth(db);
    set({ schedules, exceptions });
  },

  removeException: async (db, id) => {
    await exceptionsRepo.remove(db, id);
    const { schedules, exceptions } = await loadBoth(db);
    set({ schedules, exceptions });
  },
}));
