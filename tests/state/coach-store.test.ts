// First-use tips (board CM2): one at a time, in order, each once.
import { nextCoach } from '../../src/state/coach-store';

describe('nextCoach', () => {
  test('nothing until loaded', () => {
    expect(nextCoach([], false, ['filter-solo'])).toBeNull();
  });
  test('in order; a later tip waits for the earlier one even if its screen is up', () => {
    expect(nextCoach([], true, ['filter-solo', 'week-pinch', 'block-drag'])).toBe('filter-solo');
    expect(nextCoach(['filter-solo'], true, ['filter-solo', 'week-pinch'])).toBe('week-pinch');
    // week tip not seen yet and not on screen → block tip waits
    expect(nextCoach(['filter-solo'], true, ['filter-solo', 'block-drag'])).toBeNull();
    expect(nextCoach(['filter-solo', 'week-pinch'], true, ['block-drag'])).toBe('block-drag');
    expect(nextCoach(['filter-solo', 'week-pinch', 'block-drag'], true, ['block-drag'])).toBeNull();
  });
});
