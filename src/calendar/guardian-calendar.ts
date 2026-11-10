// Device calendar access for guardian events — ADR-008.
//
// The only module that touches expo-calendar. Reads events from the chosen
// calendars, writes guardian events the user adds in the app, and opens one
// in the system event screen. Nothing here is stored in SQLite.

import { Platform } from 'react-native';

import { dateAt, type GuardianRawEvent } from '../domain/guardian';
import { ALL_DAY_ALERT_BASE_MINUTES } from '../notifications/scheduler';
import type { ISODate } from '../domain/types';

/** 'unavailable' = this app build has no calendar module (an older dev client). */
export type CalendarPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

type CalendarModule = typeof import('expo-calendar');
let cachedModule: CalendarModule | null | undefined;
/**
 * expo-calendar, loaded on first use. A build without the native module
 * (an older dev client) throws on import — the app must keep working then,
 * with the calendar link simply unavailable.
 */
function calendarModule(): CalendarModule | null {
  if (cachedModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cachedModule = require('expo-calendar') as CalendarModule;
    } catch {
      cachedModule = null;
    }
  }
  return cachedModule;
}
function need(): CalendarModule {
  const m = calendarModule();
  if (m === null) throw new Error('expo-calendar is not in this build');
  return m;
}
export function isCalendarAvailable(): boolean {
  return calendarModule() !== null;
}

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
  const m = calendarModule();
  return m === null ? 'unavailable' : permissionOf(await m.getCalendarPermissionsAsync());
}

export async function requestPermission(): Promise<CalendarPermission> {
  const m = calendarModule();
  return m === null ? 'unavailable' : permissionOf(await m.requestCalendarPermissionsAsync());
}

/** Event calendars on the device (reminder lists excluded). */
export async function listCalendars(): Promise<DeviceCalendar[]> {
  const Calendar = need();
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
  const events = await need().getEventsAsync([...calendarIds], dateAt(from, 0), dateAt(to, 24 * 60));
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
      const def = await need().getDefaultCalendarAsync();
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

/** Event fields for a write (create / update). */
function eventFields(e: NewGuardianEvent) {
  return {
    title: e.title,
    location: e.location ?? undefined,
    notes: e.notes ?? undefined,
    startDate: dateAt(e.date, e.allDay ? 0 : e.startMinutes),
    endDate: dateAt(e.date, e.allDay ? 24 * 60 : e.endMinutes),
    allDay: e.allDay,
    // All-day: the alarm counts back from 08:00 that day, like kid events.
    alarms:
      e.alarmMinutesBefore === null
        ? []
        : [{ relativeOffset: e.allDay ? ALL_DAY_ALERT_BASE_MINUTES - e.alarmMinutesBefore : -e.alarmMinutesBefore }],
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/** Write a guardian event to the device calendar; resolves with its id. */
export async function createGuardianEvent(calendarId: string, e: NewGuardianEvent): Promise<string> {
  return need().createEventAsync(calendarId, eventFields(e));
}

/** One guardian event as the detail / edit screens need it. */
export interface GuardianEventDetail {
  id: string;
  calendarId: string;
  title: string;
  location: string;
  notes: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  /** Minutes before the start of its first alarm (all-day: before 08:00), or null. */
  alarmMinutesBefore: number | null;
  recurring: boolean;
  /** Starts and ends on the same day (all-day: one day) — the app's form can edit it. */
  singleDay: boolean;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Read one event (the instance starting at `instanceStart` for a recurring one). */
export async function getGuardianEvent(eventId: string, instanceStart: Date): Promise<GuardianEventDetail> {
  const e = await need().getEventAsync(eventId, { instanceStartDate: instanceStart });
  const start = new Date(e.startDate);
  const end = new Date(e.endDate);
  const allDay = e.allDay === true;
  const offset = e.alarms?.[0]?.relativeOffset;
  const alarm =
    typeof offset !== 'number' ? null : allDay ? Math.max(0, ALL_DAY_ALERT_BASE_MINUTES - offset) : Math.max(0, -offset);
  // All-day ends at the next midnight (or 23:59:59 of the same day).
  const lastMoment = new Date(end.getTime() - 1);
  return {
    id: e.id,
    calendarId: e.calendarId,
    title: e.title ?? '',
    location: e.location ?? '',
    notes: e.notes ?? '',
    startDate: start,
    endDate: end,
    allDay,
    alarmMinutesBefore: alarm,
    recurring: e.recurrenceRule !== null && e.recurrenceRule !== undefined,
    singleDay: allDay ? sameDay(start, lastMoment) : sameDay(start, lastMoment),
  };
}

/** Update an event; a recurring one only for the instance at `instanceStart`. */
export async function updateGuardianEvent(
  eventId: string,
  instanceStart: Date,
  recurring: boolean,
  e: NewGuardianEvent,
): Promise<void> {
  await need().updateEventAsync(
    eventId,
    eventFields(e),
    recurring ? { instanceStartDate: instanceStart, futureEvents: false } : undefined,
  );
}

/** Delete an event; a recurring one: this instance, or this and all later ones. */
export async function deleteGuardianEvent(
  eventId: string,
  instanceStart: Date,
  recurring: boolean,
  andFuture = false,
): Promise<void> {
  await need().deleteEventAsync(
    eventId,
    recurring ? { instanceStartDate: instanceStart, futureEvents: andFuture } : undefined,
  );
}

/** Show one event (one instance of a recurring one) in the system screen; editing allowed. */
export async function openGuardianEvent(eventId: string, instanceStart: Date): Promise<void> {
  await need().openEventInCalendarAsync(
    { id: eventId, instanceStartDate: instanceStart },
    { allowsEditing: true },
  );
}
