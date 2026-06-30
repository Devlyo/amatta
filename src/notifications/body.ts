// Notification title / body formatters.
//
// ADR-002 §알림 policy:
//   - 일정 알림 본문에 ChecklistItem 자동 prepend (≤ 80 자).
//   - Todo 는 dueAt 기반 단독 푸시.
//   - 새 푸시 surface 금지 (충돌 푸시 X).
//
// Body content is the only payload the scheduler hands to expo-
// notifications other than the trigger date, so all "what the user
// sees in the OS banner" logic lives here.

import type {
  Minutes,
  Schedule,
  Todo,
} from '../domain/types';
import { fmtKoTime } from '../ui/utils/date';

const BODY_MAX = 80; // ADR-002 cap (applies to the prep portion).
const ELLIPSIS = '…';
const PREP_PREFIX = '챙길 것: ';
const ITEM_SEP = '·';

/**
 * Schedule push — title = kid context + schedule title,
 * body = pending checklist labels (joined) · time range, capped at 80.
 *
 * Title-side context (kid name) is folded in here so the user can
 * tell whose schedule is firing without expanding the banner.
 *
 * v6 / PREP-RECUR: this function NO LONGER reads `is_done` (FROZEN as of v6).
 * Per-occurrence membership + completion is resolved by the caller
 * (`candidatesForSchedule` in scheduler.ts) against `checklist_completion`,
 * and the already-pending LABELS for THAT occurrence are handed in here.
 */
export function formatScheduleNotification(input: {
  schedule: Schedule;
  startMinutes: Minutes;
  endMinutes: Minutes;
  kidName: string;
  /** Already-resolved pending checklist labels for this single occurrence. */
  pendingLabels: readonly string[];
}): { title: string; body: string } {
  const { schedule, startMinutes, endMinutes, kidName, pendingLabels } = input;
  const title = `${kidName} · ${schedule.title}`;
  const timeRange = `${fmtKoTime(startMinutes)}–${fmtKoTime(endMinutes)}`;
  const lead = `${timeRange} 일정이에요.`;

  if (pendingLabels.length === 0) return { title, body: lead };

  // Prep portion: `챙길 것: {항목1}·{항목2}…`, itself ≤ 80 chars (ADR-002).
  const items = pendingLabels.join(ITEM_SEP);
  let prep = `${PREP_PREFIX}${items}`;
  if (prep.length > BODY_MAX) {
    const itemsRoom = BODY_MAX - PREP_PREFIX.length - ELLIPSIS.length;
    // itemsRoom is always > 0 here: PREP_PREFIX + ELLIPSIS is far under BODY_MAX.
    prep = `${PREP_PREFIX}${items.slice(0, itemsRoom)}${ELLIPSIS}`;
  }
  return { title, body: `${lead} ${prep}` };
}

/**
 * Todo push — single line; kid scope optional (todo.childId can be null).
 * Per ADR-002, todos are their own surface.
 */
export function formatTodoNotification(input: {
  todo: Todo;
  kidName: string | null;
}): { title: string; body: string } {
  const { todo, kidName } = input;
  const title =
    kidName !== null ? `${kidName} · 할 일` : '할 일';
  const body = todo.title;
  return { title, body };
}
