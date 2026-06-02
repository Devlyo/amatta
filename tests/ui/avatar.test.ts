import { avatarForColorIndex } from '../../src/ui/avatar';
import type { ColorIndex } from '../../src/domain/types';

describe('avatarForColorIndex', () => {
  // The mapping is contractual — seed-dev + future migrations must keep using
  // these face PNGs for the given colorIndex slots. If a designer asks for a
  // different face per slot, update this test deliberately.
  test.each<[ColorIndex, string]>([
    [0, 'wink'],
    [1, 'happy'],
    [2, 'cool'],
    [3, 'calm'],
    [4, 'surprise'],
    [5, 'dizzy'],
  ])('colorIndex %d → %s face', (idx, expected) => {
    expect(avatarForColorIndex(idx)).toBe(expected);
  });

  test('returns a stable AvatarFaceKey for every valid ColorIndex', () => {
    const allowed = new Set([
      'wink',
      'happy',
      'cool',
      'calm',
      'surprise',
      'dizzy',
    ]);
    for (const i of [0, 1, 2, 3, 4, 5] as ColorIndex[]) {
      expect(allowed.has(avatarForColorIndex(i))).toBe(true);
    }
  });
});
