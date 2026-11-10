// Shared vertical time axis for the day and week views — ADR-007 §1, §4.
//
// One axis for every time grid: 00:00–24:00 (iPhone-style), replacing the three
// per-grid copies of the 06:00–25:00 constants. Pure helpers only, so the
// geometry is unit-testable without rendering.

export const AXIS_START_MIN = 0;
export const AXIS_END_MIN = 24 * 60;
/** Width of the hour-label gutter on the left of every time grid. */
export const TIME_GUTTER = 40;
/** Space above 00:00 so the first label ("12 AM") is not clipped. */
export const AXIS_TOP_PAD = 8;
/** Default height of one hour (day view). Week view passes its own. */
export const DEFAULT_HOUR_HEIGHT = 46;

export function minutesToY(minutes: number, hourHeight: number): number {
  return AXIS_TOP_PAD + ((minutes - AXIS_START_MIN) / 60) * hourHeight;
}

/** Inverse of minutesToY, snapped down to `snap` minutes and clamped to the day. */
export function minutesAtY(y: number, hourHeight: number, snap = 30): number {
  const raw = ((y - AXIS_TOP_PAD) / hourHeight) * 60 + AXIS_START_MIN;
  const snapped = Math.floor(raw / snap) * snap;
  return Math.min(Math.max(snapped, AXIS_START_MIN), AXIS_END_MIN - snap);
}

/**
 * Start time to pre-fill when a new event is created by long-pressing the grid:
 * the pressed hour, kept so the default 1-hour event still ends by midnight.
 */
export function newEventStart(pressedMinutes: number): number {
  return Math.min(Math.max(pressedMinutes, 0), 23 * 60);
}

export function axisHeight(hourHeight: number): number {
  return AXIS_TOP_PAD + ((AXIS_END_MIN - AXIS_START_MIN) / 60) * hourHeight;
}

/** Hour label parts for the gutter: 0 → 12 AM, 9 → 9 AM, 12 → 12 PM, 13 → 1 PM, 24 → 12 AM. */
export function hourLabel(hour: number): { num: string; ap: 'AM' | 'PM' } {
  const h = ((hour % 24) + 24) % 24;
  return { num: String(h % 12 === 0 ? 12 : h % 12), ap: h < 12 ? 'AM' : 'PM' };
}

/** NOW pill text — 12-hour clock without AM/PM ("1:20"), as in the iPhone calendar. */
export function nowLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}`;
}

/**
 * Smallest grid height we count on (px) — the NOW line must stay inside it,
 * NOW_KEEP_PX above its bottom, when the opening scroll reaches back.
 */
const MIN_VIEWPORT_PX = 360;
const NOW_KEEP_PX = 40;
/** Room above an in-progress event's top edge so its title reads clearly. */
const ONGOING_TITLE_PAD_MIN = 15;

/** Earliest start among events in progress at `nowMinutes` (start ≤ now < end), or null. */
export function ongoingStart(
  events: readonly { startMinutes: number; endMinutes: number; allDay?: boolean }[],
  nowMinutes: number | null,
): number | null {
  if (nowMinutes === null) return null;
  let first: number | null = null;
  for (const e of events) {
    if (e.allDay === true || e.startMinutes > nowMinutes || e.endMinutes <= nowMinutes) continue;
    if (first === null || e.startMinutes < first) first = e.startMinutes;
  }
  return first;
}

/**
 * Where a time grid should open (scroll offset, px):
 *  - today → keep NOW about 1.5 hours below the top edge; if an event is in
 *    progress, reach back so its top (title) shows too — but never so far
 *    that the NOW line leaves the screen,
 *  - another day with events → 30 minutes above its first event,
 *  - otherwise → 7 AM.
 */
export function initialScrollY(input: {
  hourHeight: number;
  nowMinutes: number | null;
  firstStart: number | null;
  /** Earliest start of an event in progress now (see `ongoingStart`). */
  ongoingStart?: number | null;
}): number {
  const { hourHeight, nowMinutes, firstStart, ongoingStart: ongoing = null } = input;
  let anchor: number;
  if (nowMinutes !== null) {
    anchor = nowMinutes - 90;
    if (ongoing !== null && ongoing - ONGOING_TITLE_PAD_MIN < anchor) {
      const maxBack = ((MIN_VIEWPORT_PX - NOW_KEEP_PX - AXIS_TOP_PAD) / hourHeight) * 60;
      anchor = Math.max(ongoing - ONGOING_TITLE_PAD_MIN, nowMinutes - maxBack);
    }
  } else if (firstStart !== null) anchor = firstStart - 30;
  else anchor = 7 * 60;
  return Math.max(0, minutesToY(anchor, hourHeight) - AXIS_TOP_PAD);
}
