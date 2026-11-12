// Drag-to-move a calendar block (ADR-015). Pure decision + injected steps so
// it is tested without stores, alerts or a DB.
//
//   one-time schedule → move it (time and/or date) straight away
//   repeating         → ask "이 일정만 / 모든 일정 / 취소" (iOS action sheet):
//     · 이 일정만, same day   → a modify exception with the new times
//     · 이 일정만, other day  → cancel that day + a one-time copy on the new day
//                              (members, guardian, alerts, pickup and the
//                               supplies shown that day come along)
//     · 모든 일정            → every occurrence takes the time the block was
//                              dropped at (absolute, not "+1h": a day that had
//                              its own time no longer skews the rest — owner
//                              report 2026-11-12); a day move shifts the
//                              weekdays by the same number of days

import { isChecklistItemVisibleOn } from '../domain/checklist-membership';
import type { ChecklistItem, ISODate, Schedule, ScheduleException } from '../domain/types';
import { isoToYyyymmdd, shiftIsoDate } from '../ui/utils/date';
import type { NewSchedule } from '../db/repositories';

export type MoveScope = 'this' | 'all';

export interface MoveSteps {
  ask: () => Promise<MoveScope | null>;
  updateSchedule: (id: number, patch: Partial<Omit<Schedule, 'id'>>) => Promise<void>;
  /** Modify (or cancel) one occurrence. */
  applyException: (
    scheduleId: number,
    date: ISODate,
    o: { kind: 'cancel' } | { kind: 'modify'; overrideStartMinutes: number; overrideEndMinutes: number; overrideTitle: string | null },
  ) => Promise<void>;
  addSchedule: (input: NewSchedule) => Promise<Schedule>;
  addChecklistItem: (input: { scheduleId: number; label: string; sortOrder: number; occurrenceDate: number | null; recurring: boolean }) => Promise<void>;
}

/** Mon=bit0 … Sun=bit6 for an ISO date. */
export function weekdayBit(iso: ISODate): number {
  const s = iso as unknown as string;
  const d = new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return 1 << ((d.getDay() + 6) % 7);
}

/** Shift every weekday in a mask by `days` (wrapping Sun→Mon). */
export function rotateMask(mask: number, days: number): number {
  const k = ((days % 7) + 7) % 7;
  let out = 0;
  for (let i = 0; i < 7; i++) if (mask & (1 << i)) out |= 1 << ((i + k) % 7);
  return out;
}

export function isOneTime(s: Pick<Schedule, 'validFrom' | 'validUntil'>): boolean {
  return s.validUntil !== null && s.validUntil === s.validFrom;
}

export async function moveOccurrence(
  input: {
    schedule: Schedule;
    /** The occurrence's date and its shown (possibly overridden) times. */
    date: ISODate;
    startMinutes: number;
    endMinutes: number;
    deltaMinutes: number;
    deltaDays: number;
    exception: ScheduleException | undefined;
    checklist: readonly ChecklistItem[];
  },
  steps: MoveSteps,
): Promise<boolean> {
  const { schedule, date, startMinutes, endMinutes, deltaMinutes, deltaDays, exception, checklist } = input;
  if (deltaMinutes === 0 && deltaDays === 0) return false;
  const newStart = startMinutes + deltaMinutes;
  const newEnd = endMinutes + deltaMinutes;
  if (newStart < 0 || newEnd > 24 * 60) return false;
  const newDate = shiftIsoDate(date, deltaDays);

  if (isOneTime(schedule)) {
    await steps.updateSchedule(schedule.id, {
      startMinutes: newStart,
      endMinutes: newEnd,
      validFrom: newDate,
      validUntil: newDate,
      daysOfWeek: weekdayBit(newDate),
    });
    return true;
  }

  const scope = await steps.ask();
  if (scope === null) return false;

  if (scope === 'all') {
    // The new time is what the user sees where they let go — not base + delta,
    // which went wrong when this day already had its own time (an exception):
    // e.g. base 6–7, this day moved to 8–9 earlier, dragged to 9–10 → next
    // week landed on 7–8.
    await steps.updateSchedule(schedule.id, {
      startMinutes: newStart,
      endMinutes: newEnd,
      ...(deltaDays !== 0 ? { daysOfWeek: rotateMask(schedule.daysOfWeek, deltaDays) } : {}),
    });
    // This day's own time would otherwise keep showing the old slot.
    if (exception?.kind === 'modify' && deltaDays === 0) {
      await steps.applyException(schedule.id, date, {
        kind: 'modify',
        overrideStartMinutes: newStart,
        overrideEndMinutes: newEnd,
        overrideTitle: exception.overrideTitle,
      });
    }
    return true;
  }

  if (deltaDays === 0) {
    await steps.applyException(schedule.id, date, {
      kind: 'modify',
      overrideStartMinutes: newStart,
      overrideEndMinutes: newEnd,
      overrideTitle: exception?.kind === 'modify' ? exception.overrideTitle : null,
    });
    return true;
  }

  // This day only, to another day: cancel here, a one-time copy there.
  await steps.applyException(schedule.id, date, { kind: 'cancel' });
  const copy = await steps.addSchedule({
    childId: schedule.childId,
    memberIds: schedule.memberIds,
    withGuardian: schedule.withGuardian,
    title: exception?.kind === 'modify' && exception.overrideTitle !== null ? exception.overrideTitle : schedule.title,
    type: schedule.type,
    location: schedule.location,
    notes: schedule.notes,
    daysOfWeek: weekdayBit(newDate),
    startMinutes: newStart,
    endMinutes: newEnd,
    validFrom: newDate,
    validUntil: newDate,
    notifyMinutesBefore: schedule.notifyMinutesBefore,
    needsPickup: schedule.needsPickup,
    allDay: false,
    notifyEndMinutesBefore: schedule.notifyEndMinutesBefore,
  });
  const dayInt = isoToYyyymmdd(date);
  const shown = checklist.filter((it) => isChecklistItemVisibleOn(it, dayInt)).sort((a, b) => a.sortOrder - b.sortOrder);
  for (let i = 0; i < shown.length; i++) {
    const it = shown[i];
    if (it === undefined) continue;
    await steps.addChecklistItem({ scheduleId: copy.id, label: it.label, sortOrder: i, occurrenceDate: null, recurring: true });
  }
  return true;
}
