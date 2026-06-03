import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Todo } from '../domain/types';
import { todosRepo, type NewTodo } from '../db/repositories';
import { rescheduleAll } from '../notifications/scheduler';

// Every mutation here changes either a todo's notify trigger directly
// or its visibility — reconcile after every set().
function reconcile(db: SQLiteDatabase): void {
  void rescheduleAll(db).catch((e) => {
    console.warn('[todos-store] reconcile failed:', e);
  });
}

interface TodosState {
  todos: Todo[];
  isLoaded: boolean;
  load: (db: SQLiteDatabase) => Promise<void>;
  add: (db: SQLiteDatabase, input: NewTodo) => Promise<Todo>;
  updateOne: (
    db: SQLiteDatabase,
    id: number,
    patch: Partial<Omit<Todo, 'id' | 'createdAt'>>,
  ) => Promise<void>;
  removeOne: (db: SQLiteDatabase, id: number) => Promise<void>;
  toggleDone: (db: SQLiteDatabase, id: number) => Promise<void>;
}

export const useTodosStore = create<TodosState>()((set) => ({
  todos: [],
  isLoaded: false,

  load: async (db) => {
    const todos = await todosRepo.list(db);
    set({ todos, isLoaded: true });
  },

  add: async (db, input) => {
    const todo = await todosRepo.create(db, input);
    const todos = await todosRepo.list(db);
    set({ todos });
    reconcile(db);
    return todo;
  },

  updateOne: async (db, id, patch) => {
    await todosRepo.update(db, id, patch);
    const todos = await todosRepo.list(db);
    set({ todos });
    reconcile(db);
  },

  removeOne: async (db, id) => {
    await todosRepo.remove(db, id);
    const todos = await todosRepo.list(db);
    set({ todos });
    reconcile(db);
  },

  toggleDone: async (db, id) => {
    await todosRepo.toggleDone(db, id, Date.now());
    const todos = await todosRepo.list(db);
    set({ todos });
    reconcile(db);
  },
}));
