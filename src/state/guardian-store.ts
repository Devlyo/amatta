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
  /**
   * Pieces (one per day touched) per fetched range, keyed `from|to` — the
   * home tab (today) and the calendar tab (its view) read different ranges.
   */
  byRange: Record<string, GuardianOccurrence[]>;
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
  byRange: {},
  version: 0,
};

/** Calendars to read: the chosen ones that still exist (ids can vanish on resync). */
export function visibleCalendarIds(calendars: readonly DeviceCalendar[], chosen: readonly string[] | null): string[] {
  const all = calendars.map((c) => c.id);
  return chosen === null ? all : chosen.filter((id) => all.includes(id));
}

export const rangeKey = (from: ISODate, to: ISODate): string => `${from as unknown as string}|${to as unknown as string}`;

// Guards against an older fetch (of the same range) landing after a newer one.
const fetchSeq = new Map<string, number>();

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
    set((s) => ({ enabled: on, byRange: on ? s.byRange : {}, version: s.version + 1 }));
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
    const key = rangeKey(from, to);
    const put = (events: GuardianOccurrence[]): void => set((s) => ({ byRange: { ...s.byRange, [key]: events } }));
    const { enabled, permission, calendars, calendarIds } = get();
    if (!enabled || permission !== 'granted') {
      put([]);
      return;
    }
    const seq = (fetchSeq.get(key) ?? 0) + 1;
    fetchSeq.set(key, seq);
    try {
      const raw = await deviceCalendar.fetchEvents(visibleCalendarIds(calendars, calendarIds), from, to);
      if (fetchSeq.get(key) === seq) put(guardianOccurrences(raw, from, to));
    } catch {
      if (fetchSeq.get(key) === seq) put([]);
    }
  },

  invalidate: () => set((s) => ({ version: s.version + 1 })),

  resetToDefaults: () => set({ ...INITIAL }),
}));
