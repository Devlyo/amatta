// Pickup carousel data derivation.
//
// Rules (per the user's spec, 2026-06):
//   1. Banner renders ONLY when `currentDate === today`. On any other date,
//      the carousel collapses to zero height — non-today views never advertise
//      "next pickup."
//   2. Past-today pickups (`endMinutes < nowMinutes`) are excluded — they
//      already happened. The kid was either picked up or won't be picked up;
//      either way the carousel should move on to the next.
//   3. Completed pickups (in `schedule_pickup_log` for that occurrence_date)
//      are excluded.
//   4. Of all eligible pickups today, only the SOONEST `endMinutes` group is
//      surfaced. If a single pickup sits at the soonest time we render one
//      card; if two-or-more pickups share that exact `endMinutes` (= conflict
//      where the user must split themselves), all of them become cards. A
//      14:00 + 18:00 pair is NOT a conflict and only the 14:00 card shows
//      until that time passes; then the 18:00 surfaces alone.
//
// `etaText` is the remaining time from now to the pickup's `endMinutes`,
// formatted "Nh Nm" / "Nm" / "곧" Korean shorthand.

import type { Child, ColorIndex, ISODate, Occurrence } from '../../domain/types';
import { fmtKoTime, todayIso } from '../utils/date';

export interface PickupCardData {
  scheduleId: number;
  occurrenceDate: ISODate;
  occurrenceDateInt: number;
  time: string;
  timeShort: string;
  who: string;
  what: string;
  etaText: string;
  childColorIndex: ColorIndex;
}

/**
 * Parses an `YYYY-MM-DD` ISO date into a `YYYYMMDD` integer used by the
 * pickup-log table's `occurrence_date` column.
 */
export function isoToYyyymmdd(iso: ISODate): number {
  const s = iso as unknown as string;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  return y * 10000 + m * 100 + d;
}

function fmtTimeShort(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function fmtEta(nowMinutes: number, targetMinutes: number): string {
  const delta = targetMinutes - nowMinutes;
  // '곧' is the "imminent" cap — already self-contained, no '남음' suffix.
  if (delta <= 0) return '곧';
  const h = Math.floor(delta / 60);
  const m = delta % 60;
  if (h === 0) return `${m}분 남음`;
  if (m === 0) return `${h}시간 남음`;
  return `${h}시간 ${m}분 남음`;
}

interface Eligible {
  occ: Occurrence;
  child: Child;
}

export function computePickupCards(
  occurrences: Occurrence[],
  pickupLogIsComplete: (scheduleId: number, occurrenceDateInt: number) => boolean,
  childrenById: Map<number, Child>,
  nowMinutes: number,
  currentDate: ISODate,
): PickupCardData[] {
  // Rule 1: only today.
  const today = todayIso() as unknown as string;
  if ((currentDate as unknown as string) !== today) return [];

  // Rules 2 + 3: future + uncompleted + needsPickup + has a known child.
  const eligible: Eligible[] = [];
  for (const occ of occurrences) {
    const needs = (occ as unknown as { needsPickup?: boolean }).needsPickup === true;
    if (!needs) continue;
    if (occ.endMinutes < nowMinutes) continue;
    const occDateInt = isoToYyyymmdd(occ.date);
    if (pickupLogIsComplete(occ.scheduleId, occDateInt)) continue;
    const child = childrenById.get(occ.childId);
    if (child === undefined) continue;
    eligible.push({ occ, child });
  }
  if (eligible.length === 0) return [];

  // Rule 4: only the soonest-end-time group, all pickups at that exact time.
  let soonestEnd = Infinity;
  for (const e of eligible) {
    if (e.occ.endMinutes < soonestEnd) soonestEnd = e.occ.endMinutes;
  }
  const nextBatch = eligible.filter((e) => e.occ.endMinutes === soonestEnd);
  // Stable order by scheduleId so the carousel always renders the same kid
  // in the same slot across re-renders.
  nextBatch.sort((a, b) => a.occ.scheduleId - b.occ.scheduleId);

  return nextBatch.map<PickupCardData>(({ occ, child }) => ({
    scheduleId: occ.scheduleId,
    occurrenceDate: occ.date,
    occurrenceDateInt: isoToYyyymmdd(occ.date),
    time: fmtKoTime(occ.endMinutes),
    timeShort: fmtTimeShort(occ.endMinutes),
    who: child.name,
    what: occ.title,
    etaText: fmtEta(nowMinutes, occ.endMinutes),
    childColorIndex: child.colorIndex,
  }));
}
