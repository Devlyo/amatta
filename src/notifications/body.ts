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

const BODY_MAX = 80; // ADR-002 cap (applies to the prep portion).
const ELLIPSIS = '…';
const ITEM_SEP = ', ';

/** True when the last Hangul syllable has a final consonant (받침). */
function hasBatchim(word: string): boolean {
  for (let i = word.length - 1; i >= 0; i--) {
    const code = word.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
    if (/[0-9A-Za-z]/.test(word[i] ?? '')) return false;
  }
  return false;
}
/** 수학학원이 / 피아노가 */
export function withSubject(word: string): string {
  return `${word}${hasBatchim(word) ? '이' : '가'}`;
}
/** 연습장이에요 / 악보예요 */
function withCopula(word: string): string {
  return `${word}${hasBatchim(word) ? '이에요' : '예요'}`;
}
/** 1시 / 4시 30분 (12-hour, no 오전/오후 — owner 2026-11-11). */
export function fmtKoClock(minutes: Minutes): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}시` : `${h12}시 ${m}분`;
}

/**
 * Schedule "before start" push (owner wording, 2026-11-11):
 *   title = "민준 · 수학학원이 1시에 시작합니다."
 *   body  = "준비물은 연습장, 필통이에요." (pending supplies for this occurrence) or empty.
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
  const { schedule, startMinutes, kidName, pendingLabels } = input;
  const what = withSubject(schedule.title);
  const title =
    schedule.allDay === true
      ? `${kidName} · ${what} 오늘 하루 종일 있어요.`
      : `${kidName} · ${what} ${fmtKoClock(startMinutes)}에 시작합니다.`;
  if (pendingLabels.length === 0) return { title, body: '' };

  // Prep line ≤ 80 chars (ADR-002): "준비물은 {a}, {b}이에요."
  let items = pendingLabels.join(ITEM_SEP);
  const room = BODY_MAX - '준비물은 '.length - '이에요.'.length;
  if (items.length > room) items = `${items.slice(0, room - ELLIPSIS.length)}${ELLIPSIS}`;
  return { title, body: `준비물은 ${withCopula(items)}.` };
}

/**
 * "Before end" push (ADR-007 §8; owner wording 2026-11-11):
 *   title = "민준 · 수학학원이 3시에 끝나요."
 *   body  = "픽업해주세요." when the schedule needs a pickup, else empty.
 */
export function formatScheduleEndNotification(input: {
  schedule: Schedule;
  endMinutes: Minutes;
  kidName: string;
}): { title: string; body: string } {
  const { schedule, endMinutes, kidName } = input;
  return {
    title: `${kidName} · ${withSubject(schedule.title)} ${fmtKoClock(endMinutes)}에 끝나요.`,
    body: schedule.needsPickup ? '픽업해주세요.' : '',
  };
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
