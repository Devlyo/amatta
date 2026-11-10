// Global notification settings (system on/off + default lead time).
// These values feed both the Settings 알림 section AND the default
// for newly-created schedules in ScheduleEditSheet — picking 30분 전
// in Settings means new schedules start with 30분 전 selected.
//
// Persistence (NOTIF-PERSIST): both values are persisted to the
// `app_settings` key-value table (migration v5) so they survive a
// relaunch. `load(db)` hydrates from app_settings on boot (falling
// back to the defaults below when a key is absent); the setters
// write-through to app_settings in addition to updating in-memory state.
//
// `lastScheduleTruncated` / `lastScheduledCount` are written by the
// scheduler after each rescheduleAll() so the UI can surface the iOS
// 64-pending-cap truncation (≤60 soonest scheduled).

import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';

import { appSettingsRepo } from '../db/repositories';

/** app_settings keys owned by this store. */
export const NOTIF_SETTINGS_KEYS = {
  systemEnabled: 'system_notifications_enabled',
  defaultMinutesBefore: 'default_minutes_before',
} as const;

/** Defaults applied when a key is absent in app_settings. */
const DEFAULT_SYSTEM_ENABLED = true;
/** 2026-11-10 (owner): default 시작 전 알림 for new events = 없음. */
const DEFAULT_MINUTES_BEFORE: number | null = null;
/** Stored value for an explicit 없음 (absent key also reads as the default). */
const NONE = 'none';

interface NotifSettingsState {
  systemEnabled: boolean;
  /** Default 시작 전 알림 for new events; null = 없음. */
  defaultMinutesBefore: number | null;
  /** True iff the last rescheduleAll() dropped triggers beyond the ≤60 cap. */
  lastScheduleTruncated: boolean;
  /** Number of triggers actually scheduled by the last rescheduleAll(). */
  lastScheduledCount: number;
  load: (db: SQLiteDatabase) => Promise<void>;
  setSystemEnabled: (db: SQLiteDatabase, v: boolean) => Promise<void>;
  setDefaultMinutesBefore: (db: SQLiteDatabase, n: number | null) => Promise<void>;
  setScheduleResult: (result: {
    truncated: boolean;
    scheduledCount: number;
  }) => void;
  /** Reset in-memory state to defaults (used by the wipe/reset flow). */
  resetToDefaults: () => void;
}

export const useNotifSettingsStore = create<NotifSettingsState>()((set) => ({
  systemEnabled: DEFAULT_SYSTEM_ENABLED,
  defaultMinutesBefore: DEFAULT_MINUTES_BEFORE,
  lastScheduleTruncated: false,
  lastScheduledCount: 0,

  load: async (db) => {
    const [enabled, raw] = await Promise.all([
      appSettingsRepo.getBool(db, NOTIF_SETTINGS_KEYS.systemEnabled),
      appSettingsRepo.getString(db, NOTIF_SETTINGS_KEYS.defaultMinutesBefore),
    ]);
    const parsed = raw === null || raw === NONE ? null : Number.parseInt(raw, 10);
    set({
      systemEnabled: enabled ?? DEFAULT_SYSTEM_ENABLED,
      defaultMinutesBefore: raw === null ? DEFAULT_MINUTES_BEFORE : parsed !== null && !Number.isNaN(parsed) ? parsed : null,
    });
  },

  setSystemEnabled: async (db, v) => {
    set({ systemEnabled: v });
    await appSettingsRepo.setBool(db, NOTIF_SETTINGS_KEYS.systemEnabled, v);
  },

  setDefaultMinutesBefore: async (db, n) => {
    set({ defaultMinutesBefore: n });
    await appSettingsRepo.setString(db, NOTIF_SETTINGS_KEYS.defaultMinutesBefore, n === null ? NONE : String(n));
  },

  setScheduleResult: ({ truncated, scheduledCount }) =>
    set({ lastScheduleTruncated: truncated, lastScheduledCount: scheduledCount }),

  resetToDefaults: () =>
    set({
      systemEnabled: DEFAULT_SYSTEM_ENABLED,
      defaultMinutesBefore: DEFAULT_MINUTES_BEFORE,
      lastScheduleTruncated: false,
      lastScheduledCount: 0,
    }),
}));
