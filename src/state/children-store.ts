import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Child } from '../domain/types';
import { childrenRepo, type NewChild } from '../db/repositories';
import { requestReschedule } from '../notifications/scheduler';
import { useSchedulesStore } from './schedules-store';
import { useUiStore } from './ui-store';

interface ChildrenState {
  children: Child[];
  isLoaded: boolean;
  load: (db: SQLiteDatabase) => Promise<void>;
  add: (db: SQLiteDatabase, input: NewChild) => Promise<Child>;
  updateOne: (db: SQLiteDatabase, id: number, patch: Partial<Omit<Child, 'id' | 'createdAt'>>) => Promise<void>;
  removeOne: (db: SQLiteDatabase, id: number) => Promise<void>;
}

export const useChildrenStore = create<ChildrenState>()((set) => ({
  children: [],
  isLoaded: false,

  load: async (db) => {
    const children = await childrenRepo.list(db);
    set({ children, isLoaded: true });
    useUiStore.getState().applyKidCountDefaults(children.length);
  },

  add: async (db, input) => {
    const child = await childrenRepo.create(db, input);
    const children = await childrenRepo.list(db);
    set({ children });
    useUiStore.getState().applyKidCountDefaults(children.length);
    return child;
  },

  updateOne: async (db, id, patch) => {
    await childrenRepo.update(db, id, patch);
    const children = await childrenRepo.list(db);
    set({ children });
  },

  removeOne: async (db, id) => {
    await childrenRepo.remove(db, id);
    const children = await childrenRepo.list(db);
    set({ children });
    useUiStore.getState().applyKidCountDefaults(children.length);
    // Schedules changed too (deleted, or a shared one got a new main kid).
    await useSchedulesStore.getState().load(db);
    requestReschedule(db, 'children-store');
  },
}));
