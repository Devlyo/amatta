// Guardian events — ADR-007 §9 / ADR-008.
//
// The guardian's schedule lives in the device calendar (never in SQLite).
// This module turns raw calendar events into per-day pieces the grids can
// lay out, exactly like kid occurrences: a timed event spanning midnight
// becomes one piece per day it touches (clipped to that day), an all-day
// event one all-day piece per day. Pure — no expo-calendar import.

import type { ISODate } from './types';

/** A raw device-calendar event (the fields we read). */
export interface GuardianRawEvent {
  id: string;
  calendarId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
}

/** One day's slice of a guardian event, ready for a grid. */
export interface GuardianOccurrence {
  /** Unique per piece: `${eventId}|${date}`. */
  key: string;
  eventId: string;
  calendarId: string;
  title: string;
  date: ISODate;
  /** Minutes from that day's midnight, [0, 1440]. All-day: 0 … 1440. */
  startMinutes: number;
  endMinutes: number;
  allDay: boolean;
  /** Start / end of this instance (a recurring event's dates differ per instance). */
  instanceStart: Date;
  instanceEnd: Date;
}

const DAY_MIN = 24 * 60;

function isoOf(d: Date): ISODate {
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}` as unknown as ISODate;
}

function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function nextDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

/**
 * Split events into per-day pieces within [from, to] (inclusive ISO dates).
 * Zero-length or inverted events are dropped; untitled ones read "(제목 없음)".
 */
export function guardianOccurrences(
  events: readonly GuardianRawEvent[],
  from: ISODate,
  to: ISODate,
): GuardianOccurrence[] {
  const fromS = from as unknown as string;
  const toS = to as unknown as string;
  const out: GuardianOccurrence[] = [];
  for (const e of events) {
    const start = e.startDate;
    let end = e.endDate;
    if (!(end.getTime() > start.getTime())) {
      if (!e.allDay) continue;
      end = nextDay(midnight(start)); // all-day with a degenerate end → that day
    }
    const title = e.title.trim().length > 0 ? e.title.trim() : '(제목 없음)';
    // Walk the days the event touches. All-day: [start day, end) — the end is
    // the following midnight (or 23:59:59 of the last day on some sources).
    for (let day = midnight(start); day.getTime() < end.getTime(); day = nextDay(day)) {
      const date = isoOf(day);
      const ds = date as unknown as string;
      if (ds > toS) break;
      if (ds < fromS) continue;
      const dayStart = day.getTime();
      const s = e.allDay ? 0 : Math.max(0, Math.round((start.getTime() - dayStart) / 60000));
      const en = e.allDay ? DAY_MIN : Math.min(DAY_MIN, Math.round((end.getTime() - dayStart) / 60000));
      if (!e.allDay && en <= s) continue;
      out.push({
        key: `${e.id}|${ds}`,
        eventId: e.id,
        calendarId: e.calendarId,
        title,
        date,
        startMinutes: s,
        endMinutes: en,
        allDay: e.allDay,
        instanceStart: start,
        instanceEnd: end,
      });
    }
  }
  out.sort((a, b) =>
    a.date === b.date ? a.startMinutes - b.startMinutes : (a.date as unknown as string) < (b.date as unknown as string) ? -1 : 1,
  );
  return out;
}

/** Local Date for an ISO date + minutes from its midnight (24:00 = next midnight). */
export function dateAt(date: ISODate, minutes: number): Date {
  const s = date as unknown as string;
  return new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)), 0, minutes);
}
