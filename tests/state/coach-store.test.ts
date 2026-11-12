// First-use tips (board CM2): one at a time, in order, each once.
import { nextCoach } from '../../src/state/coach-store';

describe('nextCoach', () => {
  test('nothing until loaded', () => {
    expect(nextCoach([], false, ['filter-solo'])).toBeNull();
  });
  test('first unseen tip this screen can host, one at a time', () => {
    expect(nextCoach([], true, ['filter-solo', 'week-pinch', 'block-drag'])).toBe('filter-solo');
    expect(nextCoach(['filter-solo'], true, ['filter-solo', 'week-pinch'])).toBe('week-pinch');
    // the week tip isn't on this screen → the drag tip doesn't wait for it
    expect(nextCoach(['filter-solo'], true, ['filter-solo', 'block-drag'])).toBe('block-drag');
    expect(nextCoach(['filter-solo', 'week-pinch'], true, ['block-drag'])).toBe('block-drag');
    expect(nextCoach(['filter-solo', 'week-pinch', 'block-drag'], true, ['block-drag'])).toBeNull();
  });
});
