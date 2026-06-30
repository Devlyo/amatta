// Single source of truth for checklist-item membership on an occurrence
// (ADR-006b / PREP-RECUR). Used by every membership site: the daily 준비물 tab
// (ChecklistSection), the notification body builder (scheduler), and the event
// detail screen (EventDetailDrawer).
//
// `occurrenceDate` is the ANCHOR date and `occ` the viewed occurrence date —
// BOTH yyyymmdd integers (use isoToYyyymmdd; never compare ISODate TEXT to int).
//
//   occurrenceDate === null  → always visible (legacy/unbounded recurring).
//   else recurring           → visible iff occ >= occurrenceDate (매번 forward).
//   else (이번만)            → visible iff occ === occurrenceDate (that date only).

export function isChecklistItemVisibleOn(
  item: { occurrenceDate: number | null; recurring: boolean },
  occ: number,
): boolean {
  if (item.occurrenceDate === null) return true;
  return item.recurring ? occ >= item.occurrenceDate : occ === item.occurrenceDate;
}
