// Pure form model + validation for ScheduleEditSheet.
// Extracted from the component so tests can exercise validation without
// mounting the sheet.

import { useNotifSettingsStore } from '../../state/notif-settings-store';
import type {
  DaysOfWeekMask,
  ISODate,
  Minutes,
  Schedule,
  ScheduleException,
  ScheduleType,
} from '../../domain/types';

export interface EditFormState {
  /** The main kid = memberIds[0] (null while nobody is picked). */
  childId: number | null;
  /** ADR-013: every kid picked, in pick order (main kid first). */
  memberIds: number[];
  /** ADR-013: 보호자 picked together with kids → saved in WeMoa. */
  withGuardian: boolean;
  title: string;
  type: ScheduleType | null; // null = nothing selected yet (no default)
  daysOfWeek: DaysOfWeekMask;
  startMinutes: Minutes;
  endMinutes: Minutes;
  validFrom: string; // YYYY-MM-DD (validated separately)
  validUntil: string; // optional; empty string means "no end"
  location: string;
  notes: string;
  notifyMinutesBefore: number | null; // null = no notification (before start)
  needsPickup: boolean;
  /** ADR-007 §8: all-day event (times hidden, saved as 0–1440, no pickup). */
  allDay: boolean;
  /** ADR-007 §8: alert before the END (null = none). */
  notifyEndMinutesBefore: number | null;
}

// Korean labels for the type pill row in the amatta-v1 edit form. Order
// matches `TYPE_OPTIONS` so the visual sequence in the sheet is stable.
export const TYPE_LABELS_KO: Readonly<Record<ScheduleType, string>> = {
  school: '학교·유치원',
  academy: '학원',
  activity: '활동',
  other: '기타',
} as const;

// Unified to Settings § '기본 알림 시점' (app-settings.jsx). The user-facing
// picker exposes these three plus an explicit "없음" (null) pill. Existing
// schedules saved with a legacy non-option value (5 / 15) are coerced to the
// store default at form-load time; null is preserved as the "없음" choice
// (it already means "no notification" to the scheduler).
export const NOTIFY_OPTIONS: readonly number[] = [10, 30, 60] as const;

function coerceToNotifyOption(v: number | null): number | null {
  // null = 없음 — preserve the user's explicit "no notification" choice
  // (matches scheduler semantics: null ⇒ no trigger is armed).
  if (v === null) return null;
  const fallback = useNotifSettingsStore.getState().defaultMinutesBefore;
  return (NOTIFY_OPTIONS as readonly number[]).includes(v) ? v : fallback;
}

export const TYPE_OPTIONS: readonly ScheduleType[] = [
  'school',
  'academy',
  'activity',
  'other',
] as const;

export const DOW_LABELS_KO = ['월', '화', '수', '목', '금', '토', '일'] as const;

export function defaultFormState(
  childId: number | null,
  date: ISODate | null,
  startMinutes?: number,
): EditFormState {
  const validFrom = date !== null ? (date as unknown as string) : '';
  // Long-press creation passes the pressed slot; otherwise 15:00–16:00.
  const start = startMinutes ?? 15 * 60;
  return {
    childId,
    memberIds: childId !== null ? [childId] : [],
    withGuardian: false,
    title: '',
    type: null, // 종류는 기본 선택 없음 — 사용자가 직접 골라야 저장 가능
    daysOfWeek: 0,
    startMinutes: start,
    endMinutes: Math.min(start + 60, 24 * 60),
    validFrom,
    validUntil: '',
    location: '',
    notes: '',
    notifyMinutesBefore: useNotifSettingsStore.getState().defaultMinutesBefore,
    needsPickup: false,
    allDay: false,
    notifyEndMinutesBefore: null,
  };
}

export function formFromSchedule(s: Schedule): EditFormState {
  return {
    childId: s.childId,
    memberIds: [...(s.memberIds ?? [s.childId])],
    withGuardian: s.withGuardian === true,
    title: s.title,
    type: s.type,
    daysOfWeek: s.daysOfWeek,
    startMinutes: s.startMinutes,
    endMinutes: s.endMinutes,
    validFrom: s.validFrom as unknown as string,
    validUntil: s.validUntil === null ? '' : (s.validUntil as unknown as string),
    location: s.location ?? '',
    notes: s.notes ?? '',
    notifyMinutesBefore: coerceToNotifyOption(s.notifyMinutesBefore),
    needsPickup: s.needsPickup,
    allDay: s.allDay === true,
    notifyEndMinutesBefore: s.notifyEndMinutesBefore ?? null,
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
// ADR-007: events live inside one calendar day on the 00:00–24:00 axis.
const DAY_START_MIN = 0;
const DAY_END_MIN = 24 * 60; // 1440 — exclusive end of day

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
    errors.childId = '참여할 사람을 선택하세요.';
  }
  if (form.type === null) {
    errors.type = '종류를 선택하세요.';
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
  // All-day events have no times to check (saved as 0–1440).
  if (!form.allDay) {
    if (form.startMinutes < DAY_START_MIN || form.startMinutes >= DAY_END_MIN) {
      errors.startMinutes = '시작 시간이 올바르지 않습니다.';
    }
    if (form.endMinutes <= form.startMinutes) {
      errors.endMinutes = '종료 시간은 시작 시간보다 늦어야 합니다.';
    } else if (form.endMinutes > DAY_END_MIN) {
      errors.endMinutes = '종료 시간은 자정을 넘을 수 없습니다.';
    }
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
  // 30-min step; clamp 00:00..24:00 (ADR-007 0–24 axis).
  const next = current + deltaSlots * 30;
  if (next < DAY_START_MIN) return DAY_START_MIN;
  if (next > DAY_END_MIN) return DAY_END_MIN;
  return next;
}

// ── iPhone-style row summaries (ADR-007 §7) ─────────────────────────────────

const SUN_FIRST = ['일', '월', '화', '수', '목', '금', '토'] as const;
/** Sunday-first visual index → DaysOfWeekMask bit (Mon = bit 0 … Sun = bit 6). */
export const VISUAL_TO_MASK_BIT: readonly number[] = [6, 0, 1, 2, 3, 4, 5];

/** "안 함" / "매일" / "평일" / "주말" / "매주 화, 목". */
export function repeatSummary(mask: DaysOfWeekMask): string {
  if (mask === 0) return '안 함';
  if (mask === 0b1111111) return '매일';
  if (mask === 0b0011111) return '평일';
  if (mask === 0b1100000) return '주말';
  const days = SUN_FIRST.filter((_, i) => (mask & (1 << (VISUAL_TO_MASK_BIT[i] ?? 0))) !== 0);
  return `매주 ${days.join(', ')}`;
}

/** "없음" / "10분 전" / "1시간 전". */
export function alertSummary(minutes: number | null): string {
  if (minutes === null) return '없음';
  if (minutes % 60 === 0) return `${minutes / 60}시간 전`;
  return `${minutes}분 전`;
}

export function toggleDayMask(mask: DaysOfWeekMask, dayIdx: number): DaysOfWeekMask {
  return mask ^ (1 << dayIdx);
}

/** "2026. 11. 10." — iPhone Calendar (ko-KR) date chip. */
export function formatKoDateChip(iso: string): string {
  if (iso.length === 0) return '날짜 선택';
  return `${iso.slice(0, 4)}. ${Number(iso.slice(5, 7))}. ${Number(iso.slice(8, 10))}.`;
}

/** "3:00 PM" — iPhone Calendar time chip (AM/PM kept, ADR-007). 24:00 reads "12:00 AM". */
export function fmt12hrShortSpaced(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export type PersonPick = number | 'guardian';

/**
 * ADR-013 자녀 multi-select. Returns the next members + flags.
 *   · create: guardian alone → device-calendar event (`guardianOnly`);
 *     guardian + kids → `withGuardian` (saved in WeMoa).
 *   · editAll: at least one kid stays; guardian only flips `withGuardian`.
 */
export function togglePerson(
  state: { memberIds: readonly number[]; withGuardian: boolean; guardianOnly: boolean },
  pick: PersonPick,
  mode: 'create' | 'editAll',
): { memberIds: number[]; withGuardian: boolean; guardianOnly: boolean } {
  const guardianOn = state.withGuardian || state.guardianOnly;
  if (pick === 'guardian') {
    if (guardianOn) return { memberIds: [...state.memberIds], withGuardian: false, guardianOnly: false };
    if (state.memberIds.length === 0 && mode === 'create') {
      return { memberIds: [], withGuardian: false, guardianOnly: true };
    }
    return { memberIds: [...state.memberIds], withGuardian: true, guardianOnly: false };
  }
  const has = state.memberIds.includes(pick);
  const next = has ? state.memberIds.filter((id) => id !== pick) : [...state.memberIds, pick];
  if (next.length === 0 && mode === 'editAll') {
    return { memberIds: [...state.memberIds], withGuardian: state.withGuardian, guardianOnly: false };
  }
  if (next.length === 0) {
    return { memberIds: [], withGuardian: false, guardianOnly: guardianOn };
  }
  return { memberIds: next, withGuardian: guardianOn, guardianOnly: false };
}
