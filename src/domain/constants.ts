import type { ScheduleType } from './types';

export const PALETTE = [
  '#F38BA8',
  '#FAB387',
  '#F9E2AF',
  '#A6E3A1',
  '#94E2D5',
  '#89B4FA',
] as const;

export const SLOT_MIN = 30;
export const GRID_START_HOUR = 6;
export const GRID_END_HOUR = 23;
export const GRID_SLOTS = (GRID_END_HOUR - GRID_START_HOUR) * 2;
export const MAX_CHILDREN = 4;

export const SCHEDULE_TYPES: readonly ScheduleType[] = [
  'school',
  'academy',
  'activity',
  'other',
] as const;
