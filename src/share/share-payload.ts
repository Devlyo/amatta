// Read-only calendar share link (ADR-016). Packs the chosen kids' schedules
// for the next week into the link as repeat RULES (format v2, see
// share-codec.ts); the web viewer expands them with the same rules as the app.
// Nothing is stored anywhere.

import { AVATAR_KEYS } from '../domain/avatar';
import { expandOccurrences } from '../domain/occurrences';
import type { ChecklistItem, Child, ISODate, Schedule, ScheduleException } from '../domain/types';
import { shiftIsoDate } from '../ui/utils/date';
import { SHARE_TYPES, SHARE_VERSION, type ShareWire, type WireException, type WireSchedule, type WireSupply } from './share-codec';

export * from './share-codec';

/** Owner, 2026-11-12: always one week (keeps the link short enough for chat apps). */
export const SHARE_DAYS = 7;

export interface ShareOptions {
  kidIds: readonly number[];
  from: ISODate;
  includeSupplies: boolean;
  includePlaceNotes: boolean;
  /** Local "today" when the link is made. */
  createdOn: ISODate;
  days?: number;
}

/** Whole days between two local YYYY-MM-DD dates (DST-safe via UTC). */
function dayNumber(iso: ISODate | string): number {
  const t = iso as unknown as string;
  return Math.round(Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1, Number(t.slice(8, 10))) / 86400000);
}

export function buildSharePayload(
  data: {
    children: readonly Child[];
    schedules: readonly Schedule[];
    exceptions: readonly ScheduleException[];
    checklistByScheduleId: ReadonlyMap<number, readonly ChecklistItem[]>;
  },
  opt: ShareOptions,
): ShareWire {
  const days = opt.days ?? SHARE_DAYS;
  const kids = data.children.filter((c) => opt.kidIds.includes(c.id));
  const kidIndex = new Map(kids.map((k, i) => [k.id, i]));
  const byId = new Map(data.children.map((c) => [c.id, c]));
  const to = shiftIsoDate(opt.from, days - 1);
  const f0 = dayNumber(opt.from);
  const off = (iso: ISODate | string): number => dayNumber(iso) - f0;

  // Which schedules actually show for the chosen kids in the range.
  const occ = expandOccurrences([...data.schedules], [...data.exceptions], { from: opt.from, to }, byId);
  const used: number[] = [];
  for (const x of occ) {
    const members = (x.memberIds ?? [x.childId]).filter((id) => kidIndex.has(id));
    if (members.length > 0 && !used.includes(x.scheduleId)) used.push(x.scheduleId);
  }

  const labels: string[] = [];
  const labelIndex = new Map<string, number>();
  const labelOf = (s: string): number => {
    let i = labelIndex.get(s);
    if (i === undefined) {
      i = labels.length;
      labelIndex.set(s, i);
      labels.push(s);
    }
    return i;
  };

  const s: WireSchedule[] = [];
  const sIndex = new Map<number, number>();
  for (const id of used) {
    const sch = data.schedules.find((y) => y.id === id);
    if (sch === undefined) continue;
    // Members still on the app (expandOccurrences drops deleted kids), then the chosen ones.
    const members = (sch.memberIds ?? [sch.childId]).filter((m) => byId.has(m) && kidIndex.has(m));
    const from = off(sch.validFrom);
    const until = sch.validUntil === null ? null : off(sch.validUntil);
    const supplies: WireSupply[] = [];
    if (opt.includeSupplies) {
      const items = [...(data.checklistByScheduleId.get(sch.id) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
      for (const it of items) {
        const anchor = it.occurrenceDate === null ? null : off(yyyymmddToIso(it.occurrenceDate));
        if (anchor !== null && !it.recurring && (anchor < 0 || anchor >= days)) continue; // 이번만, outside the week
        if (anchor !== null && it.recurring && anchor >= days) continue; // starts after the week
        supplies.push([labelOf(it.label), anchor !== null && anchor <= 0 && it.recurring ? null : anchor, it.recurring ? 1 : 0]);
      }
    }
    const flags = (sch.withGuardian ? 1 : 0) | (sch.needsPickup && !sch.allDay ? 2 : 0) | (sch.allDay ? 4 : 0);
    // A start before the week / an open end don't matter inside it → null.
    const wireFrom = from <= 0 ? null : from;
    const wireUntil = until === null || until >= days - 1 ? null : until;
    const oneOff = sch.validUntil !== null && sch.validUntil === sch.validFrom;
    const base = [
      sch.title,
      Math.max(0, SHARE_TYPES.indexOf(sch.type)),
      members.map((m) => kidIndex.get(m) as number),
      flags,
      sch.daysOfWeek,
      sch.startMinutes,
      sch.endMinutes,
      // Keep a one-off recognisable (from === until) even when it is today.
      oneOff ? from : wireFrom,
      oneOff ? until : wireUntil,
      supplies,
    ] as WireSchedule;
    s.push(opt.includePlaceNotes ? ([...base, sch.location, sch.notes] as WireSchedule) : base);
    sIndex.set(sch.id, s.length - 1);
  }

  const x: WireException[] = [];
  for (const e of data.exceptions) {
    const si = sIndex.get(e.scheduleId);
    if (si === undefined) continue;
    const day = off(e.date);
    if (day < 0 || day >= days) continue;
    x.push([si, day, e.kind === 'cancel' ? 0 : 1, e.overrideStartMinutes, e.overrideEndMinutes, e.overrideTitle]);
  }

  return {
    v: SHARE_VERSION,
    f: opt.from as unknown as string,
    d: days,
    c: off(opt.createdOn),
    k: kids.map((k) => [k.name, Math.max(0, (AVATAR_KEYS as readonly string[]).indexOf(k.avatar))]),
    s,
    x,
    l: labels,
  };
}

function yyyymmddToIso(n: number): string {
  const s = String(n);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}
