export type ColorIndex = 0 | 1 | 2 | 3 | 4 | 5;

export type ScheduleType = 'school' | 'academy' | 'activity' | 'other';

export type ISODate = string & { readonly __iso: unique symbol };

export type Minutes = number;

export type DaysOfWeekMask = number;

export interface Child {
  id: number;
  name: string;
  colorIndex: ColorIndex;
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
}
