// First-use tips (board CM2, owner's list 2026-11-12): one at a time, in order, each once.
import { nextCoach } from '../../src/state/coach-store';

describe('nextCoach', () => {
  test('nothing until loaded', () => {
    expect(nextCoach([], false, ['view-switch'])).toBeNull();
  });
  test('first unseen tip this screen can host, one at a time', () => {
    expect(nextCoach([], true, ['view-switch', 'week-slide', 'week-pinch'])).toBe('view-switch');
    expect(nextCoach(['view-switch'], true, ['view-switch', 'week-slide', 'week-pinch'])).toBe('week-slide');
    expect(nextCoach(['view-switch', 'week-slide'], true, ['view-switch', 'week-slide', 'week-pinch'])).toBe('week-pinch');
    // month tip shows in the month view even if the week tips are still unseen
    expect(nextCoach(['view-switch'], true, ['view-switch', 'month-pinch'])).toBe('month-pinch');
    expect(nextCoach(['view-switch', 'week-slide', 'week-pinch', 'month-pinch', 'share'], true, ['share'])).toBeNull();
  });
});
