// Pickup carousel data derivation. Spec §2.1.
//
// Builds the list of "next pickup" cards for the currently-viewed date by
// filtering the day's Occurrences down to those whose source Schedule has
// `needsPickup === true`, excluding ones already completed in the pickup log
// and ones whose end-time has already passed (when viewing today). Sorted by
// `(date, endMinutes, scheduleId)` ASC — soonest pickup first — and capped at
// the per-day max of 4 (= MAX_CHILDREN).

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

const MAX_CARDS = 4;

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

/**
 * Formats `endMinutes` as the compact `H:MM` form used in PickupCard's title
 * row (no AM/PM, matches the prototype's `15:30` literal).
 */
function fmtTimeShort(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/**
 * Returns a Korean ETA caption like "1시간 10분" / "10분" / "지금" for the
 * delta between `nowMinutes` and `targetMinutes`. Negative deltas (already
 * past) collapse to "지금" — callers filter past pickups out earlier so this
 * branch only fires on borderline ties.
 */
function fmtEta(nowMinutes: number, targetMinutes: number): string {
  const delta = targetMinutes - nowMinutes;
  if (delta <= 0) return '지금';
  const h = Math.floor(delta / 60);
  const m = delta % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

interface ScoredCard {
  card: PickupCardData;
  endMinutes: number;
}

/**
 * Selects, sorts, and caps the pickup cards for the day in view.
 *
 * Defensive: when an Occurrence lacks the `needsPickup` field (worker-pickup-
 * domain may not have landed yet during integration), we treat it as `false`
 * so this helper can ship before the domain extension. See spec §8 Stage 1.
 */
export function computePickupCards(
  occurrences: Occurrence[],
  pickupLogIsComplete: (scheduleId: number, occurrenceDateInt: number) => boolean,
  childrenById: Map<number, Child>,
  nowMinutes: number,
  currentDate: ISODate,
): PickupCardData[] {
  const today = todayIso() as unknown as string;
  const viewingToday = (currentDate as unknown as string) === today;

  const scored: ScoredCard[] = [];
  for (const occ of occurrences) {
    // Cast through unknown so a missing field on a drifted Occurrence shape
    // resolves to `undefined` → `false` rather than throwing.
    const needs = (occ as unknown as { needsPickup?: boolean }).needsPickup === true;
    if (!needs) continue;

    const occDateInt = isoToYyyymmdd(occ.date);
    if (pickupLogIsComplete(occ.scheduleId, occDateInt)) continue;

    if (viewingToday && occ.endMinutes < nowMinutes) continue;

    const child = childrenById.get(occ.childId);
    if (child === undefined) continue;

    scored.push({
      endMinutes: occ.endMinutes,
      card: {
        scheduleId: occ.scheduleId,
        occurrenceDate: occ.date,
        occurrenceDateInt: occDateInt,
        time: fmtKoTime(occ.endMinutes),
        timeShort: fmtTimeShort(occ.endMinutes),
        who: child.name,
        what: occ.title,
        etaText: viewingToday ? fmtEta(nowMinutes, occ.endMinutes) : '예정',
        childColorIndex: child.colorIndex,
      },
    });
  }

  scored.sort((a, b) => {
    const ad = a.card.occurrenceDateInt - b.card.occurrenceDateInt;
    if (ad !== 0) return ad;
    if (a.endMinutes !== b.endMinutes) return a.endMinutes - b.endMinutes;
    return a.card.scheduleId - b.card.scheduleId;
  });

  return scored.slice(0, MAX_CARDS).map((s) => s.card);
}
