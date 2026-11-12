// Share link (ADR-016, wire v2 = rules). The viewer's expansion must match the app's.

import { expandOccurrences } from '../../src/domain/occurrences';
import { isChecklistItemVisibleOn } from '../../src/domain/checklist-membership';
import { buildSharePayload, decodeShare, encodeShare, repeatText, shareUrl } from '../../src/share/share-payload';
import type { ChecklistItem, Child, ColorIndex, ISODate, Schedule, ScheduleException } from '../../src/domain/types';
import { isoToYyyymmdd, shiftIsoDate } from '../../src/ui/utils/date';

const ISO = (s: string) => s as unknown as ISODate;
const AV = ['face-wink', 'face-dizzy', 'face-cool', 'face-sleep'] as const;
const kid = (id: number, name: string): Child =>
  ({ id, name, colorIndex: (id - 1) as ColorIndex, avatar: AV[id - 1], createdAt: ISO('2026-01-01') }) as Child;
const kids = [kid(1, '민준'), kid(2, '서연'), kid(3, '도윤'), kid(4, '하준')];

let nextId = 1;
const sched = (over: Partial<Schedule>): Schedule =>
  ({
    id: nextId++, childId: 1, memberIds: [1], withGuardian: false, title: '학교', type: 'school', location: '초등학교',
    notes: '실내화', daysOfWeek: 0b0011111, startMinutes: 9 * 60, endMinutes: 13 * 60, validFrom: ISO('2026-01-01'),
    validUntil: null, notifyMinutesBefore: null, needsPickup: false, allDay: false, notifyEndMinutesBefore: null, ...over,
  }) as Schedule;

function world() {
  nextId = 1;
  const schedules = [
    ...kids.map((k) => sched({ childId: k.id, memberIds: [k.id] })), // 1–4
    ...kids.map((k) => sched({ childId: k.id, memberIds: [k.id], title: `학원${k.id}`, type: 'academy', daysOfWeek: 0b0001010, startMinutes: 15 * 60, endMinutes: 16 * 60, needsPickup: true })), // 5–8
    sched({ childId: 1, memberIds: [1, 2], withGuardian: true, title: '가족 모임', type: 'other', daysOfWeek: 0b1000000, startMinutes: 18 * 60, endMinutes: 20 * 60 }), // 9
    sched({ childId: 3, memberIds: [3], title: '현장학습', type: 'activity', daysOfWeek: 0b0010000, allDay: true, startMinutes: 0, endMinutes: 1440, validFrom: ISO('2026-11-13'), validUntil: ISO('2026-11-13') }), // 10 (Fri)
    sched({ childId: 4, memberIds: [4], title: '방학특강', type: 'academy', daysOfWeek: 0b1111111, startMinutes: 600, endMinutes: 660, validFrom: ISO('2026-11-15'), validUntil: ISO('2026-11-16') }), // 11
  ];
  const exceptions: ScheduleException[] = [
    { id: 1, scheduleId: 1, date: ISO('2026-11-16'), kind: 'cancel', overrideStartMinutes: null, overrideEndMinutes: null, overrideTitle: null },
    { id: 2, scheduleId: 5, date: ISO('2026-11-17'), kind: 'modify', overrideStartMinutes: 16 * 60, overrideEndMinutes: 17 * 60, overrideTitle: '보강' },
  ];
  const supplies = new Map<number, ChecklistItem[]>([
    [5, [
      { id: 1, scheduleId: 5, label: '교재', sortOrder: 0, occurrenceDate: null, recurring: true, isDone: false, doneAt: null },
      { id: 2, scheduleId: 5, label: '이번만', sortOrder: 1, occurrenceDate: 20261112, recurring: false, isDone: false, doneAt: null },
      { id: 3, scheduleId: 5, label: '다음부터', sortOrder: 2, occurrenceDate: 20261117, recurring: true, isDone: false, doneAt: null },
    ] as ChecklistItem[]],
  ]);
  return { children: kids, schedules, exceptions, checklistByScheduleId: supplies };
}

const opts = { kidIds: [1, 2, 3, 4], from: ISO('2026-11-12'), includeSupplies: true, includePlaceNotes: false, createdOn: ISO('2026-11-12') };

function view(w = world(), o = opts) {
  const r = decodeShare(encodeShare(buildSharePayload(w, o)));
  if (r.kind !== 'ok') throw new Error(r.kind);
  return r.payload;
}

describe('wire v2 → view matches the app', () => {
  test('same occurrences (date, times, title) as expandOccurrences, one week', () => {
    const w = world();
    const p = view(w);
    expect(p.d).toBe(7);
    const byId = new Map(kids.map((k) => [k.id, k]));
    const app = expandOccurrences(w.schedules, w.exceptions, { from: opts.from, to: shiftIsoDate(opts.from, 6) }, byId);
    const fromApp = app
      .map((o) => `${o.date as unknown as string}|${o.startMinutes}-${o.endMinutes}|${o.title}`)
      .sort();
    const fromView = p.o
      .map((o) => `${shiftIsoDate(ISO(p.f), o[0]) as unknown as string}|${o[1]}-${o[2]}|${o[5] ?? p.s[o[3]]?.[0]}`)
      .sort();
    expect(fromView).toEqual(fromApp);
  });

  test('supplies per day follow the app membership rule', () => {
    const w = world();
    const p = view(w);
    const items = w.checklistByScheduleId.get(5) ?? [];
    const academy = p.s.findIndex((s) => s[0] === '학원1');
    for (const o of p.o.filter((x) => x[3] === academy)) {
      const dayInt = isoToYyyymmdd(shiftIsoDate(ISO(p.f), o[0]));
      const expected = items.filter((it) => isChecklistItemVisibleOn(it, dayInt)).map((it) => it.label);
      expect(o[6].map((i) => p.l[i])).toEqual(expected);
    }
  });

  test('derived text: repeat summary, type, one-off, guardian, pickup, place off by default', () => {
    const p = view();
    const school = p.s.find((s) => s[0] === '학교');
    expect(school?.[1]).toBe('school');
    expect(school?.[4]).toBe('평일');
    expect(school?.[6]).toBeNull();
    expect(p.s.find((s) => s[0] === '현장학습')?.[4]).toBe('');
    const family = p.s.find((s) => s[0] === '가족 모임');
    expect(family?.[2]).toEqual([0, 1]);
    expect(family?.[3]).toBe(1);
    expect(p.s.find((s) => s[0] === '학원1')?.[5]).toBe(1);
    expect(p.k[1]).toEqual(['서연', 1, 'face-dizzy']);
    expect(view(world(), { ...opts, includePlaceNotes: true }).s.find((s) => s[0] === '학교')?.[6]).toBe('초등학교');
  });

  test('only the chosen kids (shared schedules trimmed)', () => {
    const p = view(world(), { ...opts, kidIds: [2] });
    expect(p.k.map((k) => k[0])).toEqual(['서연']);
    expect(p.s.find((s) => s[0] === '가족 모임')?.[2]).toEqual([0]);
    expect(p.s.some((s) => s[0] === '학원1')).toBe(false);
  });
});

describe('encode / decode', () => {
  test('starts with the version; 4 kids, one week stays short', () => {
    const enc = encodeShare(buildSharePayload(world(), opts));
    expect(enc.startsWith('2.')).toBe(true);
    expect(shareUrl(buildSharePayload(world(), opts)).length).toBeLessThan(600);
  });
  test('broken / old / newer / oversized / out-of-range links', () => {
    expect(decodeShare('#garbage').kind).toBe('invalid');
    expect(decodeShare('').kind).toBe('invalid');
    expect(decodeShare('#2.garbage').kind).toBe('invalid');
    expect(decodeShare('#1.whatever').kind).toBe('invalid');
    expect(decodeShare('#99.whatever').kind).toBe('newer');
    expect(decodeShare(`#2.${'A'.repeat(20000)}`).kind).toBe('invalid');
    const w = buildSharePayload(world(), opts);
    expect(decodeShare(encodeShare({ ...w, x: [[999, 0, 0, null, null, null]] })).kind).toBe('invalid');
    expect(decodeShare(encodeShare({ ...w, s: [['x', 0, [9], 0, 1, 0, 60, null, null, []]], x: [] })).kind).toBe('invalid');
  });
  test('repeatText', () => {
    expect(repeatText(0b0001010, false)).toBe('매주 화, 목');
    expect(repeatText(0b1000001, false)).toBe('매주 일, 월');
    expect(repeatText(0b0011111, true)).toBe('');
  });
});
