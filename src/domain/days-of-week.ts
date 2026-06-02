export const DOW = {
  MON: 1 << 0,
  TUE: 1 << 1,
  WED: 1 << 2,
  THU: 1 << 3,
  FRI: 1 << 4,
  SAT: 1 << 5,
  SUN: 1 << 6,
} as const;

export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function dayOfWeekIndex(date: Date): DayIndex {
  const jsDay = date.getDay();
  return ((jsDay + 6) % 7) as DayIndex;
}

export function maskHasDay(mask: number, dayIdx: DayIndex): boolean {
  return (mask & (1 << dayIdx)) !== 0;
}

export function setDay(mask: number, dayIdx: DayIndex): number {
  return mask | (1 << dayIdx);
}

export function clearDay(mask: number, dayIdx: DayIndex): number {
  return mask & ~(1 << dayIdx);
}

export function maskToDays(mask: number): DayIndex[] {
  const out: DayIndex[] = [];
  for (let i = 0; i < 7; i++) {
    if ((mask & (1 << i)) !== 0) {
      out.push(i as DayIndex);
    }
  }
  return out;
}

export function daysToMask(idxs: DayIndex[]): number {
  let mask = 0;
  for (let i = 0; i < idxs.length; i++) {
    const idx = idxs[i];
    if (idx === undefined) continue;
    mask |= 1 << idx;
  }
  return mask;
}
