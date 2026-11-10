import {
  cascadeStep,
  clipToDay,
  layoutCascade,
  type CascadeInput,
} from '../../src/domain/layout';

const H = 60;

function item(id: string, start: number, end: number, column = 0): CascadeInput<number> {
  return { id, column, start, end };
}

function levels(items: CascadeInput<number>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of layoutCascade(items)) out[p.id] = p.level;
  return out;
}

describe('layoutCascade', () => {
  test('empty input → empty output', () => {
    expect(layoutCascade([])).toEqual([]);
  });

  test('non-overlapping items all sit at level 0', () => {
    expect(levels([item('a', 9 * H, 10 * H), item('b', 11 * H, 12 * H)])).toEqual({ a: 0, b: 0 });
  });

  test('touching ranges (end == start) do not overlap', () => {
    expect(levels([item('a', 15 * H, 16 * H), item('b', 16 * H, 17 * H)])).toEqual({ a: 0, b: 0 });
  });

  test('two overlapping items → 0 and 1, earlier start underneath', () => {
    expect(levels([item('late', 15 * H, 16 * H), item('early', 14 * H + 30, 15 * H + 30)])).toEqual({
      early: 0,
      late: 1,
    });
  });

  test('three mutually overlapping items → 0, 1, 2', () => {
    expect(
      levels([item('a', 9 * H, 14 * H), item('b', 9 * H, 13 * H), item('c', 9 * H + 30, 15 * H)]),
    ).toEqual({ a: 0, b: 1, c: 2 });
  });

  test('chain A–B–C where A and C do not overlap → C reuses level 0', () => {
    expect(
      levels([item('a', 9 * H, 10 * H), item('b', 9 * H + 30, 11 * H), item('c', 10 * H, 12 * H)]),
    ).toEqual({ a: 0, b: 1, c: 0 });
  });

  test('a gap in used levels is filled before going deeper', () => {
    // a(0) spans everything; b(1) ends early; c starts after b → takes level 1 again.
    expect(
      levels([item('a', 9 * H, 18 * H), item('b', 10 * H, 11 * H), item('c', 12 * H, 13 * H)]),
    ).toEqual({ a: 0, b: 1, c: 1 });
  });

  test('same start → the longer item sits underneath (level 0)', () => {
    expect(levels([item('short', 16 * H, 17 * H), item('long', 16 * H, 17 * H + 30)])).toEqual({
      long: 0,
      short: 1,
    });
  });

  test('columns are independent', () => {
    expect(
      levels([item('a', 9 * H, 10 * H, 0), item('b', 9 * H, 10 * H, 1), item('c', 9 * H, 10 * H, 0)]),
    ).toEqual({ a: 0, b: 0, c: 1 });
  });

  test('works with string column keys (kid id / guardian)', () => {
    const out = layoutCascade<string>([
      { id: 'x', column: 'guardian', start: 0, end: 60 },
      { id: 'y', column: 'guardian', start: 30, end: 90 },
      { id: 'z', column: 'kid-1', start: 30, end: 90 },
    ]);
    expect(Object.fromEntries(out.map((p) => [p.id, p.level]))).toEqual({ x: 0, y: 1, z: 0 });
  });

  test('result does not depend on input order', () => {
    const base = [
      item('a', 9 * H, 14 * H),
      item('b', 9 * H, 13 * H),
      item('c', 15 * H, 16 * H),
      item('d', 14 * H + 30, 15 * H + 30),
      item('e', 16 * H, 17 * H + 30),
    ];
    const expected = levels(base);
    expect(levels([...base].reverse())).toEqual(expected);
    expect(levels([base[3]!, base[0]!, base[4]!, base[2]!, base[1]!])).toEqual(expected);
  });

  test('keeps the input fields on each placement', () => {
    const [p] = layoutCascade([item('a', 60, 120, 3)]);
    expect(p).toEqual({ id: 'a', column: 3, start: 60, end: 120, level: 0, depth: 1 });
  });
});

describe('clipToDay', () => {
  test('range inside the day is unchanged', () => {
    expect(clipToDay(9 * H, 10 * H)).toEqual({ start: 9 * H, end: 10 * H });
  });

  test('range running past midnight is cut at 24:00', () => {
    expect(clipToDay(23 * H, 25 * H)).toEqual({ start: 23 * H, end: 24 * H });
  });

  test('range starting the previous day is cut at 00:00', () => {
    expect(clipToDay(-2 * H, 1 * H)).toEqual({ start: 0, end: 1 * H });
  });

  test('range entirely outside the day → null', () => {
    expect(clipToDay(25 * H, 26 * H)).toBeNull();
    expect(clipToDay(-3 * H, -1 * H)).toBeNull();
  });

  test('empty or inverted range → null', () => {
    expect(clipToDay(9 * H, 9 * H)).toBeNull();
    expect(clipToDay(10 * H, 9 * H)).toBeNull();
  });

  test('custom axis bounds', () => {
    expect(clipToDay(5 * H, 8 * H, 6 * H, 25 * H)).toEqual({ start: 6 * H, end: 8 * H });
  });
});

describe('cascade depth + step (many people in a narrow column)', () => {
  test('depth = levels used by the whole overlap group', () => {
    const out = layoutCascade([
      item('a', 9 * H, 14 * H),
      item('b', 9 * H, 13 * H),
      item('c', 9 * H + 30, 15 * H),
      item('d', 16 * H, 17 * H), // separate group
    ]);
    const depth = Object.fromEntries(out.map((p) => [p.id, p.depth]));
    expect(depth).toEqual({ a: 3, b: 3, c: 3, d: 1 });
  });

  test('six overlapping people get six distinct levels', () => {
    const six = [1, 2, 3, 4, 5, 6].map((i) => item(`k${i}`, 9 * H, (13 + i / 10) * H));
    const out = layoutCascade(six);
    expect(new Set(out.map((p) => p.level)).size).toBe(6);
    expect(out.every((p) => p.depth === 6)).toBe(true);
  });

  test('step shrinks so the deepest block keeps 45% of the column', () => {
    expect(cascadeStep(50, 1, 15)).toBe(0);
    expect(cascadeStep(50, 2, 15)).toBe(15);
    const step = cascadeStep(50, 6, 15);
    expect(step).toBeCloseTo(5.5);
    expect(50 - 5 * step).toBeCloseTo(22.5); // 45% of 50
  });
});
