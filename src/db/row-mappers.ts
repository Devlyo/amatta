import type {
  Child,
  ColorIndex,
  ISODate,
  NotificationSetting,
  Schedule,
  ScheduleException,
  ScheduleType,
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
