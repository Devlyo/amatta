// Pickup ↔ guardian event overlap — ADR-007 (owner decision: screen only, no
// push; ADR-002/003 lock). A pickup happens at the END of a kid event that
// needs one; the guardian is busy if one of their timed events runs at that
// moment or within PICKUP_BUFFER_MIN of it (time to get there / back).
// All-day guardian events (birthdays, trips logged as all-day…) are ignored
// — too broad to call a clash.

/** Minutes either side of the pickup moment that still count as a clash. */
export const PICKUP_BUFFER_MIN = 15;

export interface TimedSpan {
  startMinutes: number;
  endMinutes: number;
  allDay?: boolean;
}

/** Two pickups (same day) clash when they are less than PICKUP_BUFFER_MIN apart. */
export function pickupsClash(a: number, b: number): boolean {
  return Math.abs(a - b) < PICKUP_BUFFER_MIN;
}

/** Does a guardian event clash with a pickup at `pickupMinutes` (same day)? */
export function clashesWithPickup(pickupMinutes: number, guardian: TimedSpan): boolean {
  if (guardian.allDay === true) return false;
  return (
    guardian.startMinutes < pickupMinutes + PICKUP_BUFFER_MIN &&
    guardian.endMinutes > pickupMinutes - PICKUP_BUFFER_MIN
  );
}

/** The guardian events (same day) that clash with a pickup at `pickupMinutes`. */
export function guardianClashes<T extends TimedSpan>(pickupMinutes: number, guardian: readonly T[]): T[] {
  return guardian.filter((g) => clashesWithPickup(pickupMinutes, g));
}

/** Kid occurrences (same day) needing a pickup that a guardian event would clash with. */
export function pickupClashes<T extends TimedSpan & { needsPickup: boolean }>(
  guardian: TimedSpan,
  kidOccurrences: readonly T[],
): T[] {
  return kidOccurrences.filter(
    (o) => o.needsPickup && o.allDay !== true && clashesWithPickup(o.endMinutes, guardian),
  );
}
