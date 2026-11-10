// 설정 > 화면 — ADR-009 (owner decisions 2026-11-10).
//
//   dock_add_side   'right' | 'left'   new-event "+" next to the dock (왼손잡이 = left)
// Persisted in app_settings (write-through), loaded on boot, exported with the
// other app settings, back to the default on reset. The 화면 모드 (system /
// light / dark) joins here once every screen supports dark (ADR-009 step 5).

import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';

import { appSettingsRepo } from '../db/repositories';

export type AddButtonSide = 'right' | 'left';

export const DISPLAY_SETTINGS_KEYS = {
  addButtonSide: 'dock_add_side',
} as const;

const DEFAULT_ADD_SIDE: AddButtonSide = 'right';

interface DisplayState {
  addButtonSide: AddButtonSide;
  load: (db: SQLiteDatabase) => Promise<void>;
  setAddButtonSide: (db: SQLiteDatabase, side: AddButtonSide) => Promise<void>;
  resetToDefaults: () => void;
}

export const useDisplayStore = create<DisplayState>()((set) => ({
  addButtonSide: DEFAULT_ADD_SIDE,

  load: async (db) => {
    const side = await appSettingsRepo.getString(db, DISPLAY_SETTINGS_KEYS.addButtonSide);
    set({ addButtonSide: side === 'left' ? 'left' : DEFAULT_ADD_SIDE });
  },

  setAddButtonSide: async (db, side) => {
    set({ addButtonSide: side });
    await appSettingsRepo.setString(db, DISPLAY_SETTINGS_KEYS.addButtonSide, side);
  },

  resetToDefaults: () => set({ addButtonSide: DEFAULT_ADD_SIDE }),
}));
