// Pure-validation tests for the edit sheet form model.
// Component-level rendering is covered separately in
// ScheduleEditSheet.test.tsx; this file proves the validation contract.

import type { ISODate, Schedule } from '../../../src/domain/types';
import {
  defaultFormState,
  formFromOccurrence,
  formFromSchedule,
  stepMinutes,
  toggleDayMask,
  validate,
  type EditFormState,
} from '../../../src/ui/sheets/edit-sheet-form';

const iso = (s: string): ISODate => s as unknown as ISODate;

function makeForm(overrides: Partial<EditFormState> = {}): EditFormState {
  return {
    ...defaultFormState(1, iso('2026-06-02')),
    title: '영어학원',
    daysOfWeek: 0b0010101, // Mon/Wed/Fri
    ...overrides,
  };
}

describe('validate', () => {
  test('passes for a fully populated create form', () => {
    const r = validate(makeForm(), {
      requireChildId: true,
      requireDaysOfWeek: true,
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual({});
  });

  test('fails when childId is missing in create mode', () => {
    const r = validate(makeForm({ childId: null }), {
      requireChildId: true,
      requireDaysOfWeek: true,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.childId).toBeDefined();
  });

  test('does not require childId in editAll/editOccurrence', () => {
    const r = validate(makeForm({ childId: null }), {
      requireChildId: false,
      requireDaysOfWeek: true,
    });
    expect(r.errors.childId).toBeUndefined();
  });

  test('fails when title is empty', () => {
    const r = validate(makeForm({ title: '   ' }), {
      requireChildId: true,
      requireDaysOfWeek: true,
    });
    expect(r.errors.title).toBeDefined();
  });

  test('fails when title exceeds 60 chars', () => {
    const r = validate(makeForm({ title: 'x'.repeat(61) }), {
      requireChildId: true,
      requireDaysOfWeek: true,
    });
    expect(r.errors.title).toBeDefined();
  });

  test('fails when daysOfWeek mask is 0 in create mode', () => {
    const r = validate(makeForm({ daysOfWeek: 0 }), {
      requireChildId: true,
      requireDaysOfWeek: true,
    });
    expect(r.errors.daysOfWeek).toBeDefined();
  });

  test('skips daysOfWeek check for editOccurrence', () => {
    const r = validate(makeForm({ daysOfWeek: 0 }), {
      requireChildId: false,
      requireDaysOfWeek: false,
    });
    expect(r.errors.daysOfWeek).toBeUndefined();
  });

  test('fails when endMinutes <= startMinutes', () => {
    const r = validate(
      makeForm({ startMinutes: 600, endMinutes: 600 }),
      { requireChildId: true, requireDaysOfWeek: true },
    );
    expect(r.errors.endMinutes).toBeDefined();
  });

  test('fails when start is outside 06:00–23:30 range', () => {
    const r = validate(
      makeForm({ startMinutes: 5 * 60 }),
      { requireChildId: true, requireDaysOfWeek: true },
    );
    expect(r.errors.startMinutes).toBeDefined();
  });

  test('fails when validFrom is empty', () => {
    const r = validate(
      makeForm({ validFrom: '' }),
      { requireChildId: true, requireDaysOfWeek: true },
    );
    expect(r.errors.validFrom).toBeDefined();
  });

  test('fails when validFrom is malformed', () => {
    const r = validate(
      makeForm({ validFrom: '2026/06/02' }),
      { requireChildId: true, requireDaysOfWeek: true },
    );
    expect(r.errors.validFrom).toBeDefined();
  });

  test('fails when validUntil is before validFrom', () => {
    const r = validate(
      makeForm({ validFrom: '2026-06-10', validUntil: '2026-06-01' }),
      { requireChildId: true, requireDaysOfWeek: true },
    );
    expect(r.errors.validUntil).toBeDefined();
  });

  test('accepts validUntil empty (no end date)', () => {
    const r = validate(
      makeForm({ validUntil: '' }),
      { requireChildId: true, requireDaysOfWeek: true },
    );
    expect(r.errors.validUntil).toBeUndefined();
  });
});

describe('stepMinutes', () => {
  test('+1 advances by 30 min', () => {
    expect(stepMinutes(540, 1)).toBe(570);
  });
  test('-1 retreats by 30 min', () => {
    expect(stepMinutes(540, -1)).toBe(510);
  });
  test('clamps below 06:00', () => {
    expect(stepMinutes(6 * 60, -1)).toBe(6 * 60);
  });
  test('clamps above 24:00 (final allowed step is 23:30 → 24:00)', () => {
    expect(stepMinutes(24 * 60, 1)).toBe(24 * 60);
  });
});

describe('toggleDayMask', () => {
  test('sets a bit when not set', () => {
    expect(toggleDayMask(0, 0)).toBe(1);
    expect(toggleDayMask(0, 6)).toBe(64);
  });
  test('clears a bit when set', () => {
    expect(toggleDayMask(0b1111111, 3)).toBe(0b1110111);
  });
  test('round-trips', () => {
    const m1 = toggleDayMask(0, 2);
    expect(toggleDayMask(m1, 2)).toBe(0);
  });
});

describe('formFromSchedule', () => {
  const sample: Schedule = {
    id: 7,
    childId: 3,
    title: '영어학원',
    type: 'academy',
    location: '학원 1관',
    notes: '책 가져갈 것',
    daysOfWeek: 21,
    startMinutes: 960,
    endMinutes: 1050,
    validFrom: iso('2026-05-01'),
    validUntil: iso('2026-12-31'),
    notifyMinutesBefore: 30,
  };

  test('round-trips fields from a Schedule', () => {
    const form = formFromSchedule(sample);
    expect(form).toEqual({
      childId: 3,
      title: '영어학원',
      type: 'academy',
      daysOfWeek: 21,
      startMinutes: 960,
      endMinutes: 1050,
      validFrom: '2026-05-01',
      validUntil: '2026-12-31',
      location: '학원 1관',
      notes: '책 가져갈 것',
      notifyMinutesBefore: 30,
    });
  });

  test('null location/notes/validUntil → empty/empty/null', () => {
    const form = formFromSchedule({
      ...sample,
      location: null,
      notes: null,
      validUntil: null,
    });
    expect(form.location).toBe('');
    expect(form.notes).toBe('');
    expect(form.validUntil).toBe('');
  });

  test('formFromOccurrence applies override fields from existing exception', () => {
    const form = formFromOccurrence(sample, {
      id: 1,
      scheduleId: 7,
      date: iso('2026-06-04'),
      kind: 'modify',
      overrideStartMinutes: 1020,
      overrideEndMinutes: 1110,
      overrideTitle: '영어학원 (특별)',
    });
    expect(form.startMinutes).toBe(1020);
    expect(form.endMinutes).toBe(1110);
    expect(form.title).toBe('영어학원 (특별)');
  });

  test('formFromOccurrence without existing exception equals formFromSchedule', () => {
    expect(formFromOccurrence(sample, undefined)).toEqual(
      formFromSchedule(sample),
    );
  });
});
