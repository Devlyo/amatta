// Device calendar access for guardian events — ADR-008.
//
// The only module that touches expo-calendar. Reads events from the chosen
// calendars, writes guardian events the user adds in the app, and opens one
// in the system event screen. Nothing here is stored in SQLite.

import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import { dateAt, type GuardianRawEvent } from '../domain/guardian';
import type { ISODate } from '../domain/types';

export type CalendarPermission = 'granted' | 'denied' | 'undetermined';

export interface DeviceCalendar {
  id: string;
  title: string;
  color: string;
  /** Account / source name ("iCloud", "Gmail", …). */
  source: string;
  writable: boolean;
}

function permissionOf(r: { status: string }): CalendarPermission {
  return r.status === 'granted' ? 'granted' : r.status === 'denied' ? 'denied' : 'undetermined';
}

export async function getPermission(): Promise<CalendarPermission> {
  return permissionOf(await Calendar.getCalendarPermissionsAsync());
}

export async function requestPermission(): Promise<CalendarPermission> {
  return permissionOf(await Calendar.requestCalendarPermissionsAsync());
}

/** Event calendars on the device (reminder lists excluded). */
export async function listCalendars(): Promise<DeviceCalendar[]> {
  const list = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return list
    .map((c) => ({
      id: c.id,
      title: c.title,
      color: c.color,
      source: c.source?.name ?? '',
      writable: c.allowsModifications,
    }))
    .sort((a, b) => (a.source === b.source ? a.title.localeCompare(b.title) : a.source.localeCompare(b.source)));
}

/** Events overlapping [from 00:00, to 24:00] in the given calendars. */
export async function fetchEvents(
  calendarIds: readonly string[],
  from: ISODate,
  to: ISODate,
): Promise<GuardianRawEvent[]> {
  if (calendarIds.length === 0) return [];
  const events = await Calendar.getEventsAsync([...calendarIds], dateAt(from, 0), dateAt(to, 24 * 60));
  return events.map((e) => ({
    id: e.id,
    calendarId: e.calendarId,
    title: e.title ?? '',
    startDate: new Date(e.startDate),
    endDate: new Date(e.endDate),
    allDay: e.allDay === true,
  }));
}

/** The calendar new guardian events go to: the chosen one if still writable, else the device default. */
export async function resolveWriteCalendar(preferredId: string | null): Promise<string | null> {
  const calendars = await listCalendars();
  const preferred = calendars.find((c) => c.id === preferredId && c.writable);
  if (preferred !== undefined) return preferred.id;
  if (Platform.OS === 'ios') {
    try {
      const def = await Calendar.getDefaultCalendarAsync();
      if (def.allowsModifications) return def.id;
    } catch {
      /* no default calendar — fall through */
    }
  }
  return calendars.find((c) => c.writable)?.id ?? null;
}

export interface NewGuardianEvent {
  title: string;
  location: string | null;
  notes: string | null;
  date: ISODate;
  startMinutes: number;
  endMinutes: number;
  allDay: boolean;
  /** Calendar alarm (iPhone Calendar rings it, not the app), or null. */
  alarmMinutesBefore: number | null;
}

/** Write a guardian event to the device calendar; resolves with its id. */
export async function createGuardianEvent(calendarId: string, e: NewGuardianEvent): Promise<string> {
  return Calendar.createEventAsync(calendarId, {
    title: e.title,
    location: e.location ?? undefined,
    notes: e.notes ?? undefined,
    startDate: dateAt(e.date, e.allDay ? 0 : e.startMinutes),
    endDate: dateAt(e.date, e.allDay ? 24 * 60 : e.endMinutes),
    allDay: e.allDay,
    alarms: e.alarmMinutesBefore === null ? [] : [{ relativeOffset: -e.alarmMinutesBefore }],
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

/** Show one event (one instance of a recurring one) in the system screen; editing allowed. */
export async function openGuardianEvent(eventId: string, instanceStart: Date): Promise<void> {
  await Calendar.openEventInCalendarAsync(
    { id: eventId, instanceStartDate: instanceStart },
    { allowsEditing: true },
  );
}
