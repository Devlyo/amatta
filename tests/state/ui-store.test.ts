// State store tests for useUiStore.
// Pure state — no DB involved.

import { useUiStore } from '../../src/state/ui-store';
import type { ISODate } from '../../src/domain/types';

describe('useUiStore', () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    useUiStore.setState({
      currentDate: new Date().toISOString().slice(0, 10) as ISODate,
      selectedChildId: null,
      editSheetState: { mode: 'closed' },
    });
  });

  test('currentDate default is today in YYYY-MM-DD format', () => {
    const today = new Date().toISOString().slice(0, 10);
    const state = useUiStore.getState();
    expect(state.currentDate).toBe(today);
    expect(state.currentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('selectedChildId defaults to null', () => {
    expect(useUiStore.getState().selectedChildId).toBeNull();
  });

  test('editSheetState defaults to { mode: "closed" }', () => {
    expect(useUiStore.getState().editSheetState).toEqual({ mode: 'closed' });
  });

  test('setCurrentDate() updates currentDate', () => {
    useUiStore.getState().setCurrentDate('2026-07-04' as ISODate);
    expect(useUiStore.getState().currentDate).toBe('2026-07-04');
  });

  test('setSelectedChildId() updates selectedChildId', () => {
    useUiStore.getState().setSelectedChildId(42);
    expect(useUiStore.getState().selectedChildId).toBe(42);
  });

  test('setSelectedChildId(null) clears selectedChildId', () => {
    useUiStore.getState().setSelectedChildId(42);
    useUiStore.getState().setSelectedChildId(null);
    expect(useUiStore.getState().selectedChildId).toBeNull();
  });

  test('openEditSheet("create") transitions to create mode', () => {
    useUiStore.getState().openEditSheet('create');
    const { editSheetState } = useUiStore.getState();
    expect(editSheetState.mode).toBe('create');
    expect(editSheetState.scheduleId).toBeUndefined();
    expect(editSheetState.occurrenceDate).toBeUndefined();
    expect(editSheetState.preFill).toBeUndefined();
  });

  test('openEditSheet("editAll") with scheduleId', () => {
    useUiStore.getState().openEditSheet('editAll', { scheduleId: 7 });
    const { editSheetState } = useUiStore.getState();
    expect(editSheetState.mode).toBe('editAll');
    expect(editSheetState.scheduleId).toBe(7);
  });

  test('openEditSheet("editOccurrence") with scheduleId and occurrenceDate', () => {
    useUiStore.getState().openEditSheet('editOccurrence', {
      scheduleId: 5,
      occurrenceDate: '2026-06-04' as ISODate,
    });
    const { editSheetState } = useUiStore.getState();
    expect(editSheetState.mode).toBe('editOccurrence');
    expect(editSheetState.scheduleId).toBe(5);
    expect(editSheetState.occurrenceDate).toBe('2026-06-04');
  });

  test('openEditSheet("create") with preFill options', () => {
    useUiStore.getState().openEditSheet('create', {
      preFill: { childId: 3, date: '2026-06-15' as ISODate },
    });
    const { editSheetState } = useUiStore.getState();
    expect(editSheetState.mode).toBe('create');
    expect(editSheetState.preFill?.childId).toBe(3);
    expect(editSheetState.preFill?.date).toBe('2026-06-15');
  });

  test('closeEditSheet() resets to { mode: "closed" }', () => {
    useUiStore.getState().openEditSheet('create');
    useUiStore.getState().closeEditSheet();
    expect(useUiStore.getState().editSheetState).toEqual({ mode: 'closed' });
  });

  test('closeEditSheet() after editAll clears scheduleId', () => {
    useUiStore.getState().openEditSheet('editAll', { scheduleId: 10 });
    useUiStore.getState().closeEditSheet();
    const { editSheetState } = useUiStore.getState();
    expect(editSheetState.mode).toBe('closed');
    expect(editSheetState.scheduleId).toBeUndefined();
  });

  test('multiple open/close transitions work correctly', () => {
    useUiStore.getState().openEditSheet('create');
    expect(useUiStore.getState().editSheetState.mode).toBe('create');

    useUiStore.getState().closeEditSheet();
    expect(useUiStore.getState().editSheetState.mode).toBe('closed');

    useUiStore.getState().openEditSheet('editOccurrence', {
      scheduleId: 1,
      occurrenceDate: '2026-06-10' as ISODate,
    });
    expect(useUiStore.getState().editSheetState.mode).toBe('editOccurrence');

    useUiStore.getState().closeEditSheet();
    expect(useUiStore.getState().editSheetState.mode).toBe('closed');
  });
});
