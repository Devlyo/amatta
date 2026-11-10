// Guardian calendar state — ADR-008.
//
// Settings (persisted in app_settings, excluded from export, wiped on reset):
//   guardian_enabled          '1' | '0'           show guardian events
//   guardian_calendar_ids     JSON string[]       calendars to show (absent = all)
//   guardian_write_calendar_id                    where new guardian events go
// Runtime (memory only): permission, the device's calendars, and the events
// of the last fetched range. Events are never stored.

import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';

import * as deviceCalendar from '../calendar/guardian-calendar';
import type { CalendarPermission, DeviceCalendar } from '../calendar/guardian-calendar';
import { appSettingsRepo } from '../db/repositories';
import { guardianOccurrences, type GuardianOccurrence } from '../domain/guardian';
import type { ISODate } from '../domain/types';

export const GUARDIAN_SETTINGS_KEYS = {
  enabled: 'guardian_enabled',
  calendarIds: 'guardian_calendar_ids',
  writeCalendarId: 'guardian_write_calendar_id',
} as const;
/** app_settings keys that are device-specific and never exported. */
export const GUARDIAN_KEY_PREFIX = 'guardian_';

interface GuardianState {
  enabled: boolean;
  /** Chosen calendars; null = every event calendar. */
  calendarIds: string[] | null;
  writeCalendarId: string | null;
  permission: CalendarPermission | 'unknown';
  calendars: DeviceCalendar[];
  /** Pieces for `range` (one per day touched). */
  events: GuardianOccurrence[];
  range: { from: ISODate; to: ISODate } | null;
  /** Bumped whenever events must be re-read (AppState focus, writes, settings). */
  version: number;

  load: (db: SQLiteDatabase) => Promise<void>;
  /** Turning on asks for permission first; stays off if it is refused. */
  setEnabled: (db: SQLiteDatabase, on: boolean) => Promise<boolean>;
  toggleCalendar: (db: SQLiteDatabase, id: string) => Promise<void>;
  setWriteCalendar: (db: SQLiteDatabase, id: string) => Promise<void>;
  refreshCalendars: () => Promise<void>;
  /** Read the events for [from, to] (no-op unless enabled + granted). */
  fetchRange: (from: ISODate, to: ISODate) => Promise<void>;
  invalidate: () => void;
  resetToDefaults: () => void;
}

const INITIAL = {
  enabled: false,
  calendarIds: null,
  writeCalendarId: null,
  permission: 'unknown' as const,
  calendars: [],
  events: [],
  range: null,
  version: 0,
};

/** Calendars to read: the chosen ones that still exist (ids can vanish on resync). */
export function visibleCalendarIds(calendars: readonly DeviceCalendar[], chosen: readonly string[] | null): string[] {
  const all = calendars.map((c) => c.id);
  return chosen === null ? all : chosen.filter((id) => all.includes(id));
}

// Guards against an older fetch landing after a newer one.
let fetchSeq = 0;

export const useGuardianStore = create<GuardianState>()((set, get) => ({
  ...INITIAL,

  load: async (db) => {
    const [enabled, idsJson, writeId] = await Promise.all([
      appSettingsRepo.getBool(db, GUARDIAN_SETTINGS_KEYS.enabled),
      appSettingsRepo.getString(db, GUARDIAN_SETTINGS_KEYS.calendarIds),
      appSettingsRepo.getString(db, GUARDIAN_SETTINGS_KEYS.writeCalendarId),
    ]);
    let calendarIds: string[] | null = null;
    if (idsJson !== null) {
      try {
        const parsed: unknown = JSON.parse(idsJson);
        if (Array.isArray(parsed)) calendarIds = parsed.filter((x): x is string => typeof x === 'string');
      } catch {
        /* corrupt → all calendars */
      }
    }
    set({ enabled: enabled === true, calendarIds, writeCalendarId: writeId });
    if (enabled === true) {
      const permission = await deviceCalendar.getPermission();
      set({ permission });
      if (permission === 'granted') await get().refreshCalendars();
    }
  },

  setEnabled: async (db, on) => {
    if (on) {
      let permission = await deviceCalendar.getPermission();
      if (permission !== 'granted') permission = await deviceCalendar.requestPermission();
      set({ permission });
      if (permission !== 'granted') return false;
      await get().refreshCalendars();
    }
    await appSettingsRepo.setBool(db, GUARDIAN_SETTINGS_KEYS.enabled, on);
    set((s) => ({ enabled: on, events: on ? s.events : [], version: s.version + 1 }));
    return true;
  },

  toggleCalendar: async (db, id) => {
    const { calendars, calendarIds } = get();
    const current = visibleCalendarIds(calendars, calendarIds);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    await appSettingsRepo.setString(db, GUARDIAN_SETTINGS_KEYS.calendarIds, JSON.stringify(next));
    set((s) => ({ calendarIds: next, version: s.version + 1 }));
  },

  setWriteCalendar: async (db, id) => {
    await appSettingsRepo.setString(db, GUARDIAN_SETTINGS_KEYS.writeCalendarId, id);
    set({ writeCalendarId: id });
  },

  refreshCalendars: async () => {
    try {
      set({ calendars: await deviceCalendar.listCalendars() });
    } catch {
      set({ calendars: [] });
    }
  },

  fetchRange: async (from, to) => {
    const { enabled, permission, calendars, calendarIds } = get();
    if (!enabled || permission !== 'granted') {
      set({ events: [], range: { from, to } });
      return;
    }
    const seq = ++fetchSeq;
    try {
      const raw = await deviceCalendar.fetchEvents(visibleCalendarIds(calendars, calendarIds), from, to);
      if (seq !== fetchSeq) return;
      set({ events: guardianOccurrences(raw, from, to), range: { from, to } });
    } catch {
      if (seq === fetchSeq) set({ events: [], range: { from, to } });
    }
  },

  invalidate: () => set((s) => ({ version: s.version + 1 })),

  resetToDefaults: () => set({ ...INITIAL }),
}));
