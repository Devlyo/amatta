// Owner 2026-11-12: adding a kid defaulted to the pink face even when it was
// taken, so a duplicate could be saved. New kids start on the first free one.
import { AVATAR_KEYS, nextAvailableAvatar } from '../../src/domain/avatar';

describe('nextAvailableAvatar', () => {
  test('first avatar nobody uses', () => {
    expect(nextAvailableAvatar([])).toBe(AVATAR_KEYS[0]);
    expect(nextAvailableAvatar(['face-wink'])).toBe('face-dizzy');
    expect(nextAvailableAvatar(['face-wink', 'face-dizzy', 'face-cool'])).toBe('face-sleep');
  });
  test('all taken → the first one (the picker still blocks saving a duplicate)', () => {
    expect(nextAvailableAvatar([...AVATAR_KEYS])).toBe(AVATAR_KEYS[0]);
  });
});
