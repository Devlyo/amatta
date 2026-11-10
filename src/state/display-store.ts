// 설정 > 화면 — ADR-009 (owner decisions 2026-11-10).
//
//   appearance      'system' | 'light' | 'dark'   화면 모드 (default: follow the phone)
//   dock_add_side   'right' | 'left'              new-event "+" next to the dock (왼손잡이 = left)
// Persisted in app_settings (write-through), loaded on boot BEFORE the splash
// hides (so the first frame is already in the right scheme), exported with the
// other app settings, back to the defaults on reset.

import { Appearance } from 'react-native';
import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';

import { appSettingsRepo } from '../db/repositories';

export type AddButtonSide = 'right' | 'left';
export type AppearanceMode = 'system' | 'light' | 'dark';

export const DISPLAY_SETTINGS_KEYS = {
  appearance: 'appearance',
  addButtonSide: 'dock_add_side',
} as const;

const DEFAULT_ADD_SIDE: AddButtonSide = 'right';
/** ADR-009 owner decision: follow the phone. */
const DEFAULT_APPEARANCE: AppearanceMode = 'system';

/** Apply a mode app-wide — native sheets, keyboard and pickers follow it too. */
export function applyAppearance(mode: AppearanceMode): void {
  // null = no override → the phone's setting ('unspecified' natively).
  Appearance.setColorScheme(mode === 'system' ? null : mode);
}

interface DisplayState {
  appearance: AppearanceMode;
  setAppearance: (db: SQLiteDatabase, mode: AppearanceMode) => Promise<void>;
  addButtonSide: AddButtonSide;
  load: (db: SQLiteDatabase) => Promise<void>;
  setAddButtonSide: (db: SQLiteDatabase, side: AddButtonSide) => Promise<void>;
  resetToDefaults: () => void;
}

export const useDisplayStore = create<DisplayState>()((set) => ({
  appearance: DEFAULT_APPEARANCE,
  addButtonSide: DEFAULT_ADD_SIDE,

  load: async (db) => {
    const [mode, side] = await Promise.all([
      appSettingsRepo.getString(db, DISPLAY_SETTINGS_KEYS.appearance),
      appSettingsRepo.getString(db, DISPLAY_SETTINGS_KEYS.addButtonSide),
    ]);
    const appearance: AppearanceMode = mode === 'light' || mode === 'dark' ? mode : DEFAULT_APPEARANCE;
    applyAppearance(appearance);
    set({ appearance, addButtonSide: side === 'left' ? 'left' : DEFAULT_ADD_SIDE });
  },

  setAppearance: async (db, mode) => {
    applyAppearance(mode);
    set({ appearance: mode });
    await appSettingsRepo.setString(db, DISPLAY_SETTINGS_KEYS.appearance, mode);
  },

  setAddButtonSide: async (db, side) => {
    set({ addButtonSide: side });
    await appSettingsRepo.setString(db, DISPLAY_SETTINGS_KEYS.addButtonSide, side);
  },

  resetToDefaults: () => {
    applyAppearance(DEFAULT_APPEARANCE);
    set({ appearance: DEFAULT_APPEARANCE, addButtonSide: DEFAULT_ADD_SIDE });
  },
}));
