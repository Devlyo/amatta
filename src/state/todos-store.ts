import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Todo } from '../domain/types';
import { todosRepo, type NewTodo } from '../db/repositories';

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
    return todo;
  },

  updateOne: async (db, id, patch) => {
    await todosRepo.update(db, id, patch);
    const todos = await todosRepo.list(db);
    set({ todos });
  },

  removeOne: async (db, id) => {
    await todosRepo.remove(db, id);
    const todos = await todosRepo.list(db);
    set({ todos });
  },

  toggleDone: async (db, id) => {
    await todosRepo.toggleDone(db, id, Date.now());
    const todos = await todosRepo.list(db);
    set({ todos });
  },
}));
