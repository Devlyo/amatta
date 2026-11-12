// Share link payload (ADR-016).

import { buildSharePayload, decodeShare, encodeShare, shareUrl } from '../../src/share/share-payload';
import type { ChecklistItem, Child, ColorIndex, ISODate, Schedule } from '../../src/domain/types';

const ISO = (s: string) => s as unknown as ISODate;
const kid = (id: number, name: string): Child =>
  ({ id, name, colorIndex: (id - 1) as ColorIndex, avatar: 'face-wink', createdAt: ISO('2026-01-01') }) as Child;
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
    ...kids.map((k) => sched({ childId: k.id, memberIds: [k.id] })),
    ...kids.map((k) => sched({ childId: k.id, memberIds: [k.id], title: `학원${k.id}`, type: 'academy', daysOfWeek: 0b0001010, startMinutes: 15 * 60, endMinutes: 16 * 60, needsPickup: true })),
    sched({ childId: 1, memberIds: [1, 2], withGuardian: true, title: '가족 모임', type: 'other', daysOfWeek: 0b1000000, startMinutes: 18 * 60, endMinutes: 20 * 60 }),
  ];
  const supplies = new Map<number, ChecklistItem[]>([
    [5, [
      { id: 1, scheduleId: 5, label: '교재', sortOrder: 0, occurrenceDate: null, recurring: true, isDone: false, doneAt: null },
      { id: 2, scheduleId: 5, label: '이번만', sortOrder: 1, occurrenceDate: 20261112, recurring: false, isDone: false, doneAt: null },
    ] as ChecklistItem[]],
  ]);
  return { children: kids, schedules, exceptions: [], checklistByScheduleId: supplies };
}

const opts = { kidIds: [1, 2, 3, 4], from: ISO('2026-11-12'), weeks: 4, includeSupplies: true, includePlaceNotes: false, createdOn: ISO('2026-11-12') };

describe('buildSharePayload', () => {
  test('expands the range, one entry per schedule+date, shared schedules list everyone', () => {
    const p = buildSharePayload(world(), opts);
    expect(p.d).toBe(28);
    expect(p.k.map((k) => k[0])).toEqual(['민준', '서연', '도윤', '하준']);
    const family = p.s.findIndex((s) => s[0] === '가족 모임');
    expect(p.s[family]?.[2]).toEqual([0, 1]);
    expect(p.s[family]?.[3]).toBe(1);
    // Sundays in 11/12–12/9: 11/15, 22, 29, 12/6 → 4 family occurrences.
    expect(p.o.filter((o) => o[3] === family)).toHaveLength(4);
  });

  test('place/notes only when asked; supplies per occurrence (이번만 only that day)', () => {
    const p = buildSharePayload(world(), opts);
    expect(p.s.every((s) => s[6] === null && s[7] === null)).toBe(true);
    const withPlace = buildSharePayload(world(), { ...opts, includePlaceNotes: true });
    expect(withPlace.s[0]?.[6]).toBe('초등학교');
    const academy = p.s.findIndex((s) => s[0] === '학원1');
    const first = p.o.find((o) => o[3] === academy && o[0] === 0); // Thu 11/12
    expect(first?.[6].map((i) => p.l[i])).toEqual(['교재', '이번만']);
    const later = p.o.find((o) => o[3] === academy && o[0] === 5); // Tue 11/17
    expect(later?.[6].map((i) => p.l[i])).toEqual(['교재']);
    expect(buildSharePayload(world(), { ...opts, includeSupplies: false }).l).toEqual([]);
  });

  test('only the chosen kids', () => {
    const p = buildSharePayload(world(), { ...opts, kidIds: [3] });
    expect(p.k.map((k) => k[0])).toEqual(['도윤']);
    expect(p.s.every((s) => s[2].every((i) => i === 0))).toBe(true);
    expect(p.s.some((s) => s[0] === '가족 모임')).toBe(false);
  });
});

describe('encode / decode', () => {
  test('round trip; 4 weeks × 4 kids stays a sane link length', () => {
    const p = buildSharePayload(world(), opts);
    const url = shareUrl(p);
    expect(url.startsWith('https://')).toBe(true);
    const frag = url.slice(url.indexOf('#'));
    expect(decodeShare(frag)).toEqual({ kind: 'ok', payload: p });
    expect(encodeShare(p).length).toBeLessThan(4000);
  });
  test('broken / newer / oversized / out-of-range links', () => {
    expect(decodeShare('#garbage').kind).toBe('invalid');
    expect(decodeShare('').kind).toBe('invalid');
    expect(decodeShare('#1.garbage').kind).toBe('invalid');
    expect(decodeShare('#99.whatever').kind).toBe('newer');
    expect(decodeShare(`#1.${'A'.repeat(20000)}`).kind).toBe('invalid');
    const p = buildSharePayload(world(), opts);
    const bad = { ...p, o: [[0, 0, 60, 999, 0, null, []]] as typeof p.o };
    expect(decodeShare(encodeShare(bad)).kind).toBe('invalid');
    const badKid = { ...p, s: [['x', 'school', [9], 0, '', 0, null, null]] as typeof p.s, o: [] };
    expect(decodeShare(encodeShare(badKid)).kind).toBe('invalid');
  });
  test('the fragment starts with the version', () => {
    expect(encodeShare(buildSharePayload(world(), opts)).startsWith('1.')).toBe(true);
  });
});
