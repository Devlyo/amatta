// Pure form model + validation for ScheduleEditSheet.
// Extracted from the component so tests can exercise validation without
// mounting @gorhom/bottom-sheet.

import { GRID_END_HOUR, GRID_START_HOUR } from '../../domain/constants';
import type {
  DaysOfWeekMask,
  ISODate,
  Minutes,
  Schedule,
  ScheduleException,
  ScheduleType,
} from '../../domain/types';

export interface EditFormState {
  childId: number | null;
  title: string;
  type: ScheduleType;
  daysOfWeek: DaysOfWeekMask;
  startMinutes: Minutes;
  endMinutes: Minutes;
  validFrom: string; // YYYY-MM-DD (validated separately)
  validUntil: string; // optional; empty string means "no end"
  location: string;
  notes: string;
  notifyMinutesBefore: number | null; // null = no notification
  needsPickup: boolean;
}

// Korean labels for the type pill row in the amatta-v1 edit form. Order
// matches `TYPE_OPTIONS` so the visual sequence in the sheet is stable.
export const TYPE_LABELS_KO: Readonly<Record<ScheduleType, string>> = {
  school: '학교',
  academy: '학원',
  activity: '운동',
  other: '기타',
} as const;

export const NOTIFY_OPTIONS: readonly (number | null)[] = [
  null,
  5,
  10,
  15,
  30,
  60,
] as const;

export const TYPE_OPTIONS: readonly ScheduleType[] = [
  'school',
  'academy',
  'activity',
  'other',
] as const;

export const DOW_LABELS_KO = ['월', '화', '수', '목', '금', '토', '일'] as const;

export function defaultFormState(childId: number | null, date: ISODate | null): EditFormState {
  const validFrom = date !== null ? (date as unknown as string) : '';
  return {
    childId,
    title: '',
    type: 'academy',
    daysOfWeek: 0,
    startMinutes: 15 * 60, // 15:00
    endMinutes: 16 * 60, // 16:00
    validFrom,
    validUntil: '',
    location: '',
    notes: '',
    notifyMinutesBefore: 15,
    needsPickup: false,
  };
}

export function formFromSchedule(s: Schedule): EditFormState {
  return {
    childId: s.childId,
    title: s.title,
    type: s.type,
    daysOfWeek: s.daysOfWeek,
    startMinutes: s.startMinutes,
    endMinutes: s.endMinutes,
    validFrom: s.validFrom as unknown as string,
    validUntil: s.validUntil === null ? '' : (s.validUntil as unknown as string),
    location: s.location ?? '',
    notes: s.notes ?? '',
    notifyMinutesBefore: s.notifyMinutesBefore,
    needsPickup: s.needsPickup,
  };
}

// For an occurrence-only edit, the form starts from the schedule but the
// user can override start/end/title and the date is fixed.
export function formFromOccurrence(
  s: Schedule,
  existing: ScheduleException | undefined,
): EditFormState {
  const base = formFromSchedule(s);
  if (existing === undefined) return base;
  return {
    ...base,
    startMinutes:
      existing.overrideStartMinutes !== null
        ? existing.overrideStartMinutes
        : base.startMinutes,
    endMinutes:
      existing.overrideEndMinutes !== null
        ? existing.overrideEndMinutes
        : base.endMinutes,
    title: existing.overrideTitle !== null ? existing.overrideTitle : base.title,
  };
}

export interface ValidationResult {
  ok: boolean;
  errors: Partial<Record<keyof EditFormState, string>>;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const GRID_START_MIN = GRID_START_HOUR * 60;
const GRID_END_MIN = GRID_END_HOUR * 60 + 30; // accept up to 23:30 inclusive

/**
 * @param requireChildId when true, the form is in `create` mode and a child
 *   pick is mandatory. In `editAll` the childId comes pre-bound to the
 *   existing schedule's row.
 * @param requireDaysOfWeek when false, the daysOfWeek field is skipped (used
 *   by `editOccurrence` which doesn't change recurrence).
 */
export function validate(
  form: EditFormState,
  options: { requireChildId: boolean; requireDaysOfWeek: boolean },
): ValidationResult {
  const errors: ValidationResult['errors'] = {};

  if (options.requireChildId && (form.childId === null || !Number.isFinite(form.childId))) {
    errors.childId = '자녀를 선택하세요.';
  }
  const title = form.title.trim();
  if (title.length === 0) {
    errors.title = '제목을 입력하세요.';
  } else if (title.length > 60) {
    errors.title = '제목은 60자 이하로 작성하세요.';
  }
  if (options.requireDaysOfWeek && form.daysOfWeek === 0) {
    errors.daysOfWeek = '반복 요일을 하나 이상 선택하세요.';
  }
  if (form.startMinutes < GRID_START_MIN || form.startMinutes > GRID_END_MIN) {
    errors.startMinutes = '시작 시간은 06:00–23:30 사이여야 합니다.';
  }
  if (form.endMinutes <= form.startMinutes) {
    errors.endMinutes = '종료 시간은 시작 시간보다 늦어야 합니다.';
  }
  if (form.endMinutes > GRID_END_MIN + 30) {
    // hard cap at 24:00 (next-day midnight) so the block can be clamped by layoutDay
    errors.endMinutes = '종료 시간은 24:00 이전이어야 합니다.';
  }
  if (form.validFrom.length === 0) {
    errors.validFrom = '시작일을 입력하세요.';
  } else if (!ISO_RE.test(form.validFrom)) {
    errors.validFrom = '시작일은 YYYY-MM-DD 형식이어야 합니다.';
  }
  if (form.validUntil.length > 0) {
    if (!ISO_RE.test(form.validUntil)) {
      errors.validUntil = '종료일은 YYYY-MM-DD 형식이어야 합니다.';
    } else if (
      ISO_RE.test(form.validFrom) &&
      form.validUntil < form.validFrom
    ) {
      errors.validUntil = '종료일은 시작일 이후여야 합니다.';
    }
  }
  if (form.title.trim().length > 0 && form.title !== title) {
    // (no-op — we trim on submit)
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

// --- helpers ---
export function formatHHMM(minutes: Minutes): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function stepMinutes(current: Minutes, deltaSlots: number): Minutes {
  // 30-min step; clamp 06:00..24:00.
  const next = current + deltaSlots * 30;
  if (next < GRID_START_MIN) return GRID_START_MIN;
  if (next > GRID_END_MIN + 30) return GRID_END_MIN + 30;
  return next;
}

export function toggleDayMask(mask: DaysOfWeekMask, dayIdx: number): DaysOfWeekMask {
  return mask ^ (1 << dayIdx);
}
