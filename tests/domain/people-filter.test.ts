import {
  emphasisOf,
  soloActive,
  tapPerson,
  toggleActive,
  type PersonKey,
} from '../../src/domain/people-filter';

const everyone: PersonKey[] = [1, 2, 3, 'guardian'];

describe('people filter', () => {
  test('everyone starts active', () => {
    for (const k of everyone) expect(emphasisOf([], everyone, k)).toBe('active');
  });

  test('short tap toggles one person off and back on', () => {
    const off = toggleActive([], 2);
    expect(off).toEqual([2]);
    expect(emphasisOf(off, everyone, 2)).toBe('inactive');
    expect(emphasisOf(off, everyone, 1)).toBe('active');
    expect(toggleActive(off, 2)).toEqual([]);
  });

  test('long press keeps only that person; they become solo', () => {
    const solo = soloActive([], 'guardian', everyone);
    expect(solo).toEqual([1, 2, 3]);
    expect(emphasisOf(solo, everyone, 'guardian')).toBe('solo');
    expect(emphasisOf(solo, everyone, 1)).toBe('inactive');
  });

  test('long press on someone who is off switches solo to them', () => {
    expect(soloActive([2], 2, everyone)).toEqual([1, 3, 'guardian']);
  });

  test('long press again on the solo person brings everyone back', () => {
    const solo = soloActive([], 1, everyone);
    expect(soloActive(solo, 1, everyone)).toEqual([]);
  });

  test('turning everyone off but one by taps also reads as solo', () => {
    let inactive: PersonKey[] = [];
    for (const k of [1, 2, 'guardian'] as PersonKey[]) inactive = toggleActive(inactive, k);
    expect(emphasisOf(inactive, everyone, 3)).toBe('solo');
  });
});

describe('tapPerson (owner 2026-11-12: a tap picks one person)', () => {
  const all = [1, 2, 3, 'guardian'] as const;
  test('everyone on → only the tapped person', () => {
    expect(tapPerson([], 2, [...all])).toEqual([1, 3, 'guardian']);
  });
  test('an off person → only them', () => {
    expect(tapPerson([2, 3, 'guardian'], 3, [...all])).toEqual([1, 2, 'guardian']);
  });
  test('an on person (with others on) → switched off', () => {
    expect(tapPerson([3, 'guardian'], 1, [...all])).toEqual([3, 'guardian', 1]);
  });
  test('the last one on, tapped → everyone again', () => {
    expect(tapPerson([2, 3, 'guardian'], 1, [...all])).toEqual([]);
  });
});
