import type { ISODate } from '../../domain/types';

const KOREAN_DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * Parses an ISO `YYYY-MM-DD` string into the user's *local* calendar — never UTC.
 * The grid is anchored to wall-clock day-of-week (e.g., Wed schedules on Wed),
 * so timezone drift would silently mis-bucket schedules.
 */
export function formatKoreanDateLabel(iso: ISODate): string {
  const s = iso as unknown as string;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  // Local-time Date constructor — getDay() returns the device-local weekday.
  const date = new Date(y, m - 1, d);
  const dayLabel = KOREAN_DAY_LABELS[date.getDay()] ?? '';
  return `${m}월 ${d}일 (${dayLabel})`;
}

/**
 * Shifts an ISO date by `deltaDays` (positive or negative). Result is also
 * computed via local Date so DST/timezone boundaries are honored.
 */
export function shiftIsoDate(iso: ISODate, deltaDays: number): ISODate {
  const s = iso as unknown as string;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const date = new Date(y, m - 1, d + deltaDays);
  const yy = String(date.getFullYear()).padStart(4, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}` as unknown as ISODate;
}

export function todayIso(): ISODate {
  const now = new Date();
  const yy = String(now.getFullYear()).padStart(4, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}` as unknown as ISODate;
}
