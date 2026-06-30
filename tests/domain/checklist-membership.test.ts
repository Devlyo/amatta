// Unit tests for isChecklistItemVisibleOn — the SINGLE source of truth for
// checklist-item membership on an occurrence (ADR-006b / PREP-RECUR). Every
// membership site (ChecklistSection, scheduler body, EventDetailDrawer) routes
// through this helper, so it's tested hard here in isolation.
//
//   occurrenceDate === null  → always visible (legacy/unbounded recurring).
//   recurring === true (매번) → visible iff occ >= occurrenceDate (forward).
//   recurring === false(이번만)→ visible iff occ === occurrenceDate (that date).

import { isChecklistItemVisibleOn } from '../../src/domain/checklist-membership';

// yyyymmdd ints around a fixed anchor of 2026-06-20.
const ANCHOR = 20260620;
const BEFORE = 20260613; // a week earlier
const AFTER = 20260627; // a week later

describe('isChecklistItemVisibleOn — 매번 (recurring, anchored forward)', () => {
  const item = { occurrenceDate: ANCHOR, recurring: true };

  test('visible on the anchor date itself (occ === anchor)', () => {
    expect(isChecklistItemVisibleOn(item, ANCHOR)).toBe(true);
  });

  test('visible on any date AFTER the anchor (occ > anchor)', () => {
    expect(isChecklistItemVisibleOn(item, AFTER)).toBe(true);
  });

  test('hidden on any date BEFORE the anchor (occ < anchor)', () => {
    expect(isChecklistItemVisibleOn(item, BEFORE)).toBe(false);
  });

  test('boundary: one day before the anchor is hidden, anchor day is visible', () => {
    expect(isChecklistItemVisibleOn(item, ANCHOR - 1)).toBe(false);
    expect(isChecklistItemVisibleOn(item, ANCHOR)).toBe(true);
  });
});

describe('isChecklistItemVisibleOn — 이번만 (day-specific, anchor only)', () => {
  const item = { occurrenceDate: ANCHOR, recurring: false };

  test('visible ONLY on the exact anchor date', () => {
    expect(isChecklistItemVisibleOn(item, ANCHOR)).toBe(true);
  });

  test('hidden on a later date (occ > anchor)', () => {
    expect(isChecklistItemVisibleOn(item, AFTER)).toBe(false);
  });

  test('hidden on an earlier date (occ < anchor)', () => {
    expect(isChecklistItemVisibleOn(item, BEFORE)).toBe(false);
  });

  test('hidden one day on either side of the anchor', () => {
    expect(isChecklistItemVisibleOn(item, ANCHOR - 1)).toBe(false);
    expect(isChecklistItemVisibleOn(item, ANCHOR + 1)).toBe(false);
  });
});

describe('isChecklistItemVisibleOn — legacy NULL anchor (unbounded recurring)', () => {
  // A null anchor is always visible REGARDLESS of the recurring flag — the
  // null-check short-circuits before recurring is consulted.
  test('recurring=true + null anchor → always visible', () => {
    const item = { occurrenceDate: null, recurring: true };
    expect(isChecklistItemVisibleOn(item, BEFORE)).toBe(true);
    expect(isChecklistItemVisibleOn(item, ANCHOR)).toBe(true);
    expect(isChecklistItemVisibleOn(item, AFTER)).toBe(true);
  });

  test('recurring=false + null anchor → still always visible (null wins)', () => {
    const item = { occurrenceDate: null, recurring: false };
    expect(isChecklistItemVisibleOn(item, BEFORE)).toBe(true);
    expect(isChecklistItemVisibleOn(item, ANCHOR)).toBe(true);
    expect(isChecklistItemVisibleOn(item, AFTER)).toBe(true);
  });
});
