// In-memory notification settings (system on/off + default lead time).
// These values feed both the Settings 알림 section AND the default
// for newly-created schedules in ScheduleEditSheet — picking 30분 전
// in Settings means new schedules start with 30분 전 selected.
//
// Persistence is intentionally NOT in scope here (tracked as
// BACKLOG NOTIF-PERSIST). Values reset to the defaults on app
// relaunch; an app_settings table or AsyncStorage slice can layer
// in later without changing this module's surface.

import { create } from 'zustand';

interface NotifSettingsState {
  systemEnabled: boolean;
  defaultMinutesBefore: number;
  setSystemEnabled: (v: boolean) => void;
  setDefaultMinutesBefore: (n: number) => void;
}

export const useNotifSettingsStore = create<NotifSettingsState>()((set) => ({
  systemEnabled: true,
  defaultMinutesBefore: 30, // matches the Settings UI's initial selection
  setSystemEnabled: (v) => set({ systemEnabled: v }),
  setDefaultMinutesBefore: (n) => set({ defaultMinutesBefore: n }),
}));
