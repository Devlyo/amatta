import { AVATAR_ANIMALS, AVATAR_FACES, LOGOS, MASCOTS } from '../../src/ui/assets';

describe('assets map', () => {
  test('AVATAR_FACES exposes all 7 expression keys', () => {
    const keys = Object.keys(AVATAR_FACES).sort();
    expect(keys).toEqual(
      ['calm', 'cool', 'dizzy', 'happy', 'sleep', 'surprise', 'wink'].sort(),
    );
    // Metro returns a module ID (number) for static requires; in jest the
    // value is a require shape — just assert it's defined and non-null.
    expect(AVATAR_FACES.wink).toBeDefined();
  });

  test('AVATAR_ANIMALS exposes 4 animal keys', () => {
    expect(Object.keys(AVATAR_ANIMALS).sort()).toEqual(['bear', 'cat', 'deer', 'rabbit']);
    expect(AVATAR_ANIMALS.bear).toBeDefined();
  });

  test('MASCOTS + LOGOS', () => {
    expect(Object.keys(MASCOTS).sort()).toEqual(['orange', 'pink', 'sleep', 'yellow']);
    expect(MASCOTS.orange).toBeDefined();
    expect(Object.keys(LOGOS).sort()).toEqual(['sparkle', 'wordmark']);
    expect(LOGOS.sparkle).toBeDefined();
  });
});
