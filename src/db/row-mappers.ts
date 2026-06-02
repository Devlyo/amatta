import type {
  ChecklistItem,
  Child,
  ColorIndex,
  ISODate,
  NotificationSetting,
  Schedule,
  ScheduleException,
  SchedulePickupLog,
  ScheduleType,
  Todo,
} from '../domain/types';

export interface ChildRow {
  id: number;
  name: string;
  color_index: number;
  created_at: string;
}

export interface ScheduleRow {
  id: number;
  child_id: number;
  title: string;
  type: string;
  location: string | null;
  notes: string | null;
  days_of_week: number;
  start_minutes: number;
  end_minutes: number;
  valid_from: string;
  valid_until: string | null;
  notify_minutes_before: number | null;
  needs_pickup: number;
}

export interface ScheduleExceptionRow {
  id: number;
  schedule_id: number;
  date: string;
  kind: string;
  override_start_minutes: number | null;
  override_end_minutes: number | null;
  override_title: string | null;
}

export interface NotificationSettingRow {
  child_id: number;
  default_minutes_before: number;
  sound: number;
  enabled: number;
}

export function rowToChild(r: ChildRow): Child {
  return {
    id: r.id,
    name: r.name,
    colorIndex: r.color_index as ColorIndex,
    createdAt: r.created_at as ISODate,
  };
}

export function rowToSchedule(r: ScheduleRow): Schedule {
  return {
    id: r.id,
    childId: r.child_id,
    title: r.title,
    type: r.type as ScheduleType,
    location: r.location,
    notes: r.notes,
    daysOfWeek: r.days_of_week,
    startMinutes: r.start_minutes,
    endMinutes: r.end_minutes,
    validFrom: r.valid_from as ISODate,
    validUntil: r.valid_until === null ? null : (r.valid_until as ISODate),
    notifyMinutesBefore: r.notify_minutes_before,
    needsPickup: r.needs_pickup === 1,
  };
}

export function rowToScheduleException(r: ScheduleExceptionRow): ScheduleException {
  return {
    id: r.id,
    scheduleId: r.schedule_id,
    date: r.date as ISODate,
    kind: r.kind as 'cancel' | 'modify',
    overrideStartMinutes: r.override_start_minutes,
    overrideEndMinutes: r.override_end_minutes,
    overrideTitle: r.override_title,
  };
}

export function rowToNotificationSetting(r: NotificationSettingRow): NotificationSetting {
  return {
    childId: r.child_id,
    defaultMinutesBefore: r.default_minutes_before,
    sound: r.sound !== 0,
    enabled: r.enabled !== 0,
  };
}

export interface ChecklistItemRow {
  id: number;
  schedule_id: number;
  label: string;
  sort_order: number;
  is_done: number;
  done_at: number | null;
}

export interface TodoRow {
  id: number;
  child_id: number | null;
  title: string;
  due_at: number;
  notify_minutes_before: number | null;
  is_done: number;
  done_at: number | null;
  created_at: number;
}

export interface SchedulePickupLogRow {
  id: number;
  schedule_id: number;
  occurrence_date: number;
  completed_at: number;
}

export function rowToChecklistItem(r: ChecklistItemRow): ChecklistItem {
  return {
    id: r.id,
    scheduleId: r.schedule_id,
    label: r.label,
    sortOrder: r.sort_order,
    isDone: r.is_done === 1,
    doneAt: r.done_at,
  };
}

export function rowToTodo(r: TodoRow): Todo {
  return {
    id: r.id,
    childId: r.child_id,
    title: r.title,
    dueAt: r.due_at,
    notifyMinutesBefore: r.notify_minutes_before,
    isDone: r.is_done === 1,
    doneAt: r.done_at,
    createdAt: r.created_at,
  };
}

export function rowToSchedulePickupLog(r: SchedulePickupLogRow): SchedulePickupLog {
  return {
    id: r.id,
    scheduleId: r.schedule_id,
    occurrenceDate: r.occurrence_date,
    completedAt: r.completed_at,
  };
}
