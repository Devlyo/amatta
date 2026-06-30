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

const BODY_MAX = 80; // ADR-002 cap.
const ELLIPSIS = '…';

function fmt12hr(min: Minutes): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h < 12 ? '오전' : '오후';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${ap} ${h12}:${String(m).padStart(2, '0')}`;
}

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
  const timeRange = `${fmt12hr(startMinutes)}–${fmt12hr(endMinutes)}`;

  if (pendingLabels.length === 0) return { title, body: timeRange };

  const items = pendingLabels.join(', ');
  const full = `${items} · ${timeRange}`;
  if (full.length <= BODY_MAX) return { title, body: full };

  // Over cap. Reserve room for ` · ${timeRange}` + ellipsis at the end of items.
  const tailRoom = ` · ${timeRange}`.length;
  const itemsRoom = BODY_MAX - tailRoom - ELLIPSIS.length;
  if (itemsRoom <= 0) {
    // Pathological case: time range alone exceeds the budget. Hard-trim.
    return { title, body: full.slice(0, BODY_MAX - ELLIPSIS.length) + ELLIPSIS };
  }
  const trimmed = items.slice(0, itemsRoom) + ELLIPSIS;
  return { title, body: `${trimmed} · ${timeRange}` };
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
