// Read-only calendar share link (ADR-016). The app expands the chosen range
// at share time with the same rules as the calendar (repeats, exceptions,
// shared schedules, per-occurrence supplies) and packs it into the URL
// fragment — the web viewer only draws it. Nothing is stored anywhere.
//
// Format v1 (compact arrays, then lz-string compressToEncodedURIComponent):
//   { v: 1, c: createdDate, f: fromDate, d: days,
//     k: [[name, colorIndex, avatarKey]],                       kids
//     s: [[title, type, kidIdx[], withGuardian, repeat, pickup, place, notes]],
//     o: [[dayOffset, start, end, sIdx, allDay, titleOverride|null, labelIdx[]]],
//     l: [label] }

import { isChecklistItemVisibleOn } from '../domain/checklist-membership';
import { expandOccurrences } from '../domain/occurrences';
import type { ChecklistItem, Child, ISODate, Schedule, ScheduleException } from '../domain/types';
import { repeatSummary } from '../ui/sheets/edit-sheet-form';
import { isoToYyyymmdd, shiftIsoDate } from '../ui/utils/date';
import { SHARE_VERSION, type ShareKid, type ShareOccurrence, type SharePayload, type ShareSchedule } from './share-codec';

export * from './share-codec';

export interface ShareOptions {
  kidIds: readonly number[];
  from: ISODate;
  weeks: number;
  includeSupplies: boolean;
  includePlaceNotes: boolean;
  /** Local "today" when the link is made. */
  createdOn: ISODate;
}

export function buildSharePayload(
  data: {
    children: readonly Child[];
    schedules: readonly Schedule[];
    exceptions: readonly ScheduleException[];
    checklistByScheduleId: ReadonlyMap<number, readonly ChecklistItem[]>;
  },
  opt: ShareOptions,
): SharePayload {
  const kids = data.children.filter((c) => opt.kidIds.includes(c.id));
  const kidIndex = new Map(kids.map((k, i) => [k.id, i]));
  const byId = new Map(data.children.map((c) => [c.id, c]));
  const days = opt.weeks * 7;
  const to = shiftIsoDate(opt.from, days - 1);
  const occ = expandOccurrences([...data.schedules], [...data.exceptions], { from: opt.from, to }, byId);

  const sIndex = new Map<number, number>();
  const s: ShareSchedule[] = [];
  const labels: string[] = [];
  const labelIndex = new Map<string, number>();
  const o: ShareOccurrence[] = [];
  const fromInt = dayNumber(opt.from);

  for (const x of occ) {
    const members = (x.memberIds ?? [x.childId]).filter((id) => kidIndex.has(id));
    if (members.length === 0) continue; // none of the chosen kids is on it
    const sch = data.schedules.find((y) => y.id === x.scheduleId);
    if (sch === undefined) continue;
    let si = sIndex.get(sch.id);
    if (si === undefined) {
      si = s.length;
      sIndex.set(sch.id, si);
      const oneTime = sch.validUntil !== null && sch.validUntil === sch.validFrom;
      s.push([
        sch.title,
        sch.type,
        members.map((id) => kidIndex.get(id) as number),
        sch.withGuardian ? 1 : 0,
        oneTime ? '' : repeatSummary(sch.daysOfWeek),
        sch.needsPickup && !sch.allDay ? 1 : 0,
        opt.includePlaceNotes ? sch.location : null,
        opt.includePlaceNotes ? sch.notes : null,
      ]);
    }
    let li: number[] = [];
    if (opt.includeSupplies) {
      const dayInt = isoToYyyymmdd(x.date);
      li = (data.checklistByScheduleId.get(sch.id) ?? [])
        .filter((it) => isChecklistItemVisibleOn(it, dayInt))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
        .map((it) => {
          let idx = labelIndex.get(it.label);
          if (idx === undefined) {
            idx = labels.length;
            labelIndex.set(it.label, idx);
            labels.push(it.label);
          }
          return idx;
        });
    }
    o.push([
      dayNumber(x.date) - fromInt,
      x.startMinutes,
      x.endMinutes,
      si,
      x.allDay ? 1 : 0,
      x.title !== sch.title ? x.title : null,
      li,
    ]);
  }

  return {
    v: SHARE_VERSION,
    c: opt.createdOn as unknown as string,
    f: opt.from as unknown as string,
    d: days,
    k: kids.map((k) => [k.name, k.colorIndex, k.avatar]),
    s,
    o,
    l: labels,
  };
}

/** Whole days since the epoch for a local YYYY-MM-DD (DST-safe via UTC). */
function dayNumber(iso: ISODate): number {
  const t = iso as unknown as string;
  return Math.round(Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1, Number(t.slice(8, 10))) / 86400000);
}

