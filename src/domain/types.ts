export type ColorIndex = 0 | 1 | 2 | 3 | 4 | 5;

export type ScheduleType = 'school' | 'academy' | 'activity' | 'other';

export type ISODate = string & { readonly __iso: unique symbol };

export type Minutes = number;

export type DaysOfWeekMask = number;

export interface Child {
  id: number;
  name: string;
  colorIndex: ColorIndex;
  /** Face-icon avatar key. Paired 1:1 with colorIndex per
   *  src/domain/avatar.ts AVATAR_KEYS. v3 schema. */
  avatar: import('./avatar').AvatarKey;
  createdAt: ISODate;
}

export interface Schedule {
  id: number;
  childId: number;
  title: string;
  type: ScheduleType;
  location: string | null;
  notes: string | null;
  daysOfWeek: DaysOfWeekMask;
  startMinutes: Minutes;
  endMinutes: Minutes;
  validFrom: ISODate;
  validUntil: ISODate | null;
  notifyMinutesBefore: number | null;
  needsPickup: boolean;
}

export interface ScheduleException {
  id: number;
  scheduleId: number;
  date: ISODate;
  kind: 'cancel' | 'modify';
  overrideStartMinutes: Minutes | null;
  overrideEndMinutes: Minutes | null;
  overrideTitle: string | null;
}

export interface NotificationSetting {
  childId: number;
  defaultMinutesBefore: number;
  sound: boolean;
  enabled: boolean;
}

export interface Occurrence {
  scheduleId: number;
  childId: number;
  date: ISODate;
  startMinutes: Minutes;
  endMinutes: Minutes;
  title: string;
  type: ScheduleType;
  colorIndex: ColorIndex;
  needsPickup: boolean;
}

export interface ChecklistItem {
  id: number;
  scheduleId: number;
  label: string;
  sortOrder: number;
  isDone: boolean;
  doneAt: number | null;
  // v6/v7 / PREP-RECUR membership (ADR-006b). `occurrenceDate` is the ANCHOR
  // date (yyyymmdd int) and `recurring` chooses the membership rule for an
  // occurrence whose date is O:
  //   occurrenceDate === null  → always visible (legacy/unbounded recurring).
  //   else recurring === true  → visible iff O >= occurrenceDate (매번, forward).
  //   else recurring === false → visible iff O === occurrenceDate (이번만, only).
  // See src/domain/checklist-membership.ts (single source of the rule).
  // Completion is NOT stored here as of v6 — it lives in checklist_completion,
  // keyed by (checklist_item_id, occurrence_date). is_done/done_at are FROZEN.
  occurrenceDate: number | null;
  recurring: boolean;
}

export interface Todo {
  id: number;
  childId: number | null;
  title: string;
  dueAt: number;
  notifyMinutesBefore: number | null;
  isDone: boolean;
  doneAt: number | null;
  createdAt: number;
}

export interface SchedulePickupLog {
  id: number;
  scheduleId: number;
  occurrenceDate: number;
  completedAt: number;
}

export interface ChecklistCompletion {
  id: number;
  checklistItemId: number;
  occurrenceDate: number; // yyyymmdd int
  completedAt: number; // epoch ms
}
