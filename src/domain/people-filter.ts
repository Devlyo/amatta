// People filter for the calendar — ADR-007 §2 (revised 2026-11-10).
//
// Everyone (each kid + 보호자) starts ACTIVE.
//   · short tap  → toggle that person on/off
//   · long press → that person only (everyone else off); long press again on
//                  the person who is already alone → everyone back on
// Inactive people stay on the grid but fade (blocks 20%, pill 45%); when
// exactly one person is active their blocks get the stronger 80% fill.
// Pure helpers — the store keeps only the list of inactive keys.

/** A kid id, or the guardian (iPhone Calendar) column. */
export type PersonKey = number | 'guardian';

export type Emphasis = 'solo' | 'active' | 'inactive';

export function toggleActive(inactive: readonly PersonKey[], key: PersonKey): PersonKey[] {
  return inactive.includes(key) ? inactive.filter((k) => k !== key) : [...inactive, key];
}

/**
 * A tap on a pill (owner 2026-11-12): taps pick ONE person; sliding picks many.
 *   everyone on (no filter) → only this person
 *   this person off         → only this person
 *   this person on          → switch them off (the last one off → everyone again)
 */
export function tapPerson(inactive: readonly PersonKey[], key: PersonKey, everyone: readonly PersonKey[]): PersonKey[] {
  const allOn = everyone.every((k) => !inactive.includes(k));
  const isOn = !inactive.includes(key);
  if (allOn || !isOn) return everyone.filter((k) => k !== key);
  const next = [...inactive, key];
  return everyone.every((k) => next.includes(k)) ? [] : next;
}

/** Switch one person on or off explicitly (slide-select across the pills). */
export function setActive(inactive: readonly PersonKey[], key: PersonKey, on: boolean): PersonKey[] {
  if (on) return inactive.filter((k) => k !== key);
  return inactive.includes(key) ? [...inactive] : [...inactive, key];
}

export function soloActive(
  inactive: readonly PersonKey[],
  key: PersonKey,
  everyone: readonly PersonKey[],
): PersonKey[] {
  const others = everyone.filter((k) => k !== key);
  const alreadySolo = !inactive.includes(key) && others.every((k) => inactive.includes(k));
  return alreadySolo ? [] : others;
}

export function emphasisOf(
  inactive: readonly PersonKey[],
  everyone: readonly PersonKey[],
  key: PersonKey,
): Emphasis {
  if (inactive.includes(key)) return 'inactive';
  const activeCount = everyone.filter((k) => !inactive.includes(k)).length;
  return activeCount === 1 ? 'solo' : 'active';
}
