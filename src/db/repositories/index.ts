import * as childrenRepo from './children';
import * as schedulesRepo from './schedules';
import * as exceptionsRepo from './schedule-exceptions';
import * as notificationSettingsRepo from './notification-settings';

export { childrenRepo, schedulesRepo, exceptionsRepo, notificationSettingsRepo };

// Also re-export types
export type { NewChild } from './children';
export { ChildCapError } from './children';
export type { NewSchedule } from './schedules';
export type { NewScheduleException } from './schedule-exceptions';
export type { NewNotificationSetting } from './notification-settings';
