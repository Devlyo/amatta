import type { ScheduleType } from './types';

// amatta-v1 design system §2 — 6-color sub palette.
// Index order is contractual: seed data + child.colorIndex reference this order.
// Source of truth: docs/design/README.md §2.
export const PALETTE = [
  '#FFA9FF', // 0: Petunia Pink
  '#C0F0AA', // 1: Vibrant Mint
  '#D8E6FF', // 2: Glacier Blue
  '#FFE8D2', // 3: Soft Peach
  '#E0E446', // 4: Citrus Green
  '#C7B0FF', // 5: French Lavender
] as const;

export const SLOT_MIN = 30;
export const GRID_START_HOUR = 6;
export const GRID_END_HOUR = 23;
export const GRID_SLOTS = (GRID_END_HOUR - GRID_START_HOUR) * 2;
export const MAX_CHILDREN = 4;

// Grid layout tokens — px (density-independent). Locked by ADR-001 + design §6.
export const ROW_HEIGHT = 24;
export const TIME_COL_WIDTH = 56;
export const CHILD_COL_MIN = 80;

export const SCHEDULE_TYPES: readonly ScheduleType[] = [
  'school',
  'academy',
  'activity',
  'other',
] as const;
