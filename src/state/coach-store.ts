// First-use tips (board CM2, owner 2026-11-12): one small bubble per scene,
// shown once, for gestures nobody discovers on their own. Seen tips persist in
// app_settings (`coach_seen`, comma list) so they never come back.

import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';

import { appSettingsRepo } from '../db/repositories';

// Owner's list (2026-11-12):
//   view-switch  calendar, first time    → points at 일·주·월: "주간·월간 보기도 있어요"
//   week-slide   week view               → slide across the pills for everyone
//   week-pinch   week view               → pinch to zoom
//   month-pinch  month view              → pinch to zoom
//   share        last, once the rest are seen → points at the share button
export type CoachId = 'view-switch' | 'week-slide' | 'week-pinch' | 'month-pinch' | 'share';
export const COACH_KEY = 'coach_seen';
/** Order the tips may appear in — at most one on screen at a time. */
export const COACH_ORDER: readonly CoachId[] = ['view-switch', 'week-slide', 'week-pinch', 'month-pinch', 'share'];

interface CoachState {
  seen: CoachId[];
  loaded: boolean;
  load: (db: SQLiteDatabase) => Promise<void>;
  markSeen: (db: SQLiteDatabase, id: CoachId) => Promise<void>;
  reset: () => void;
}

export const useCoachStore = create<CoachState>()((set, get) => ({
  seen: [],
  loaded: false,
  load: async (db) => {
    const raw = await appSettingsRepo.getString(db, COACH_KEY);
    const seen = (raw ?? '').split(',').filter((s): s is CoachId => (COACH_ORDER as readonly string[]).includes(s));
    set({ seen, loaded: true });
  },
  markSeen: async (db, id) => {
    if (get().seen.includes(id)) return;
    const seen = [...get().seen, id];
    set({ seen });
    await appSettingsRepo.setString(db, COACH_KEY, seen.join(','));
  },
  reset: () => set({ seen: [], loaded: true }),
}));

/**
 * The tip to show now: the first unseen one (in COACH_ORDER) that the current
 * screen can host — one at a time; a tip for a screen you never open doesn't
 * hold the others back. Nothing until loaded (no flash).
 */
export function nextCoach(seen: readonly CoachId[], loaded: boolean, available: readonly CoachId[]): CoachId | null {
  if (!loaded) return null;
  return COACH_ORDER.find((id) => !seen.includes(id) && available.includes(id)) ?? null;
}
